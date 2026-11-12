/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet, FileText, ShieldCheck, Building2, Calendar,
  CheckCircle2, AlertTriangle, CloudSun, CloudRain, HardHat,
  Wrench, Camera, Plus, Printer, Check, Users, Trash2, BarChart3
} from 'lucide-react';
import {
  ProjectTask,
  TaskStatus,
  ProjectProfile,
  Contractor,
  isIndividualStaffOrEngineer
} from '../types';
import { normalizeRole, UserRole } from '../utils/rbac';
import { DEFAULT_EM_JAY_TASKS } from './GanttTimeline';
import { openEnterprisePrintWindow, escapePrintHtml } from '../utils/printEngine';
import { ldmSiteConstructionAssets, LdmPortfolioAsset } from '../utils/ldmAssets';
import { OptimizedLdmImage } from './OptimizedLdmImage';
import {
  UnifiedGanttTaskLike,
  computePhaseProgressSummary,
  loadProjectGanttTasksFromStorage,
  resolveTaskConstructionPhase,
  GANTT_TASKS_UPDATED_EVENT,
} from '../utils/ganttProgress';

interface ProjectKanbanProps {
  tasks: ProjectTask[];
  projects?: ProjectProfile[];
  contractors?: Contractor[];
  userRole?: string;
  isAdmin?: boolean;
  onNavigateToGantt?: (projectId?: string, phaseName?: string) => void;
  onAddTask: (task: Omit<ProjectTask, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onDeleteTask?: (taskId: string) => void;
  onClearAllTasks?: () => void;
}

interface EquipmentEntry {
  id: string;
  name: string;
  qty: number;
  status: 'Operational' | 'For Repair';
}

interface ManpowerBreakdown {
  leadman: number;
  foreman: number;
  mason: number;
  laborer: number;
  skilled: number;
}

interface WeeklyActivityReportRecord {
  id: string;
  projectId: string;
  projectName: string;
  periodCovered: string;
  manpower: ManpowerBreakdown;
  equipment: EquipmentEntry[];
  weatherLog: Record<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat', 'Sunny' | 'Rainy'>;
  activitiesAccomplished: string;
  issuesEncountered: string;
  photos: { id: string; caption: string; timestamp: string; url?: string }[];
  preparedBy: string;
  preparedByRole: string;
  checkedBy: string;
  checkedByRole: string;
  createdAt: string;
}

interface ComplianceItem {
  id: string;
  projectId: string;
  category: 'PPE_ISSUANCE' | 'TOOLBOX_MEETING' | 'QUALITY_INSPECTION' | 'PUNCH_LIST';
  title: string;
  details: string;
  assignedTo: string;
  date: string;
  status: 'COMPLIANT' | 'OPEN_DEFECT' | 'RECTIFIED' | 'ISSUED';
}

const WEEKLY_REPORTS_STORAGE_KEY = 'ctvill_weekly_activity_reports_v1';
const SAFETY_QA_STORAGE_KEY = 'ctvill_safety_qa_items_v1';

function computeDefaultPeriodLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const sat = new Date(mon);
  sat.setDate(mon.getDate() + 5);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  return `${fmt(mon)} – ${fmt(sat)} (Mon–Sat)`;
}

function deriveProjectManpowerFromRoster(
  project: ProjectProfile | null,
  contractors: Contractor[]
): ManpowerBreakdown {
  const counts: ManpowerBreakdown = {
    leadman: 0,
    foreman: 0,
    mason: 0,
    laborer: 0,
    skilled: 0,
  };
  if (!project) return counts;

  // 1. Check project-specific DTR sync first (strictly scoped to project.id)
  try {
    const rawDtr = localStorage.getItem(`ctvill_dtr_manpower_${project.id}`);
    if (rawDtr) {
      const parsed = JSON.parse(rawDtr);
      if (parsed && typeof parsed.leadman === 'number') {
        return {
          leadman: Number(parsed.leadman) || 0,
          foreman: Number(parsed.foreman) || 0,
          mason: Number(parsed.mason) || 0,
          laborer: Number(parsed.laborer) || 0,
          skilled: Number(parsed.skilled) || 0,
        };
      }
    }
  } catch {
    // Ignore storage parse error
  }

  // 2. Dynamically derive from actual assigned workforce roster
  const assignedIds = project.assignedContractorIds || [];
  const projNameLower = (project.name || '').trim().toLowerCase();

  const assignedWorkers = contractors.filter(w => {
    if (w.status === 'INACTIVE') return false;
    const byId = assignedIds.includes(w.id) || w.assignedProjectId === project.id;
    const site = (w.activeProjectSite || '').trim().toLowerCase();
    const bySite = Boolean(site && !site.includes('standby') && projNameLower && site === projNameLower);
    return byId || bySite;
  });

  for (const w of assignedWorkers) {
    const pax =
      w.entityType === 'INDIVIDUAL' || isIndividualStaffOrEngineer(w)
        ? 1
        : Math.max(1, Number(w.activeManpower || 1));
    const roleText = `${w.roleTitle || ''} ${w.specialty || ''} ${w.tradeType || ''}`.toLowerCase();

    if (roleText.includes('leadman') || roleText.includes('lead')) {
      counts.leadman += pax;
    } else if (
      roleText.includes('foreman') ||
      roleText.includes('supervisor') ||
      roleText.includes('engineer') ||
      roleText.includes('project manager') ||
      roleText.includes('safety')
    ) {
      counts.foreman += pax;
    } else if (
      roleText.includes('mason') ||
      roleText.includes('tile') ||
      roleText.includes('concret') ||
      roleText.includes('masonry')
    ) {
      counts.mason += pax;
    } else if (roleText.includes('labor') || roleText.includes('helper')) {
      counts.laborer += pax;
    } else {
      counts.skilled += pax;
    }
  }

  return counts;
}

export default function ProjectKanban({
  tasks = [],
  projects = [],
  contractors = [],
  userRole,
  isAdmin = false,
  onNavigateToGantt,
}: ProjectKanbanProps) {
  const currentRole = normalizeRole(userRole);
  const isOM = currentRole === UserRole.OM || isAdmin;
  const isPM = currentRole === UserRole.PM;

  const [activeSubTab, setActiveSubTab] = useState<'summary-excel' | 'weekly-pdf' | 'safety-qa'>('summary-excel');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => projects[0]?.id || '');

  // Keep selectedProjectId synchronized whenever projects prop loads or changes
  useEffect(() => {
    if (projects.length > 0) {
      if (!selectedProjectId || !projects.some(p => p.id === selectedProjectId)) {
        setSelectedProjectId(projects[0].id);
      }
    } else if (selectedProjectId) {
      setSelectedProjectId('');
    }
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return projects[0] || null;
    return projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  const activeProjectId = selectedProject?.id || '';

  // ---------------------------------------------------------------------------
  // LIVE GANTT TASK SYNCHRONIZATION FOR SELECTED PROJECT
  // ---------------------------------------------------------------------------
  const [liveGanttTasks, setLiveGanttTasks] = useState<UnifiedGanttTaskLike[]>([]);
  const [isLoadingGantt, setIsLoadingGantt] = useState<boolean>(false);

  const loadLiveGanttForProject = useCallback(async (projectId: string) => {
    if (!projectId) {
      setLiveGanttTasks([]);
      return;
    }

    // Immediate read from shared Gantt localStorage for zero-lag updates
    const cached = loadProjectGanttTasksFromStorage(projectId);
    if (cached !== null) {
      setLiveGanttTasks(cached);
    }

    setIsLoadingGantt(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/gantt`);
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const rawTasks = Array.isArray(json?.data) ? json.data : [];
        if (rawTasks.length > 0) {
          const cachedLatest = loadProjectGanttTasksFromStorage(projectId) || [];
          const cachedById = new Map(cachedLatest.map(ct => [String(ct.id), ct]));

          const normalized: UnifiedGanttTaskLike[] = rawTasks.map((t: any, idx: number) => {
            const cachedMatch = cachedById.get(String(t.id));
            return {
              id: String(t.id),
              projectId,
              wbsCode: t.wbsCode || `${idx + 1}.0`,
              text: t.text || t.title || 'Construction Task',
              title: t.text || t.title || 'Construction Task',
              startDate: t.start_date || t.startDate,
              endDate: t.end_date || t.endDate,
              duration: t.duration !== undefined ? Number(t.duration) : 1,
              progress: typeof t.progress === 'number' ? t.progress : 0,
              weight:
                typeof t.weight === 'number'
                  ? t.weight
                  : typeof cachedMatch?.weight === 'number'
                  ? cachedMatch.weight
                  : undefined,
              status: t.status,
              type: t.type || 'task',
              parentTaskId:
                t.parent && t.parent !== 0 && t.parent !== '0'
                  ? String(t.parent)
                  : t.parentTaskId || null,
              milestonePhase: t.milestonePhase || '',
              constructionPhase: resolveTaskConstructionPhase({
                text: t.text || t.title,
                milestonePhase: t.milestonePhase,
                constructionPhase: t.constructionPhase || cachedMatch?.constructionPhase,
              }),
            };
          });
          setLiveGanttTasks(normalized);
          setIsLoadingGantt(false);
          return;
        }
      }
    } catch {
      // Fall back safely below
    }

    // Fallback order: 1) cached localStorage 2) strict project-matched prop tasks 3) default demo project only 4) []
    const latestCached = loadProjectGanttTasksFromStorage(projectId);
    if (latestCached !== null) {
      setLiveGanttTasks(latestCached);
    } else {
      const strictPropTasks = tasks.filter(t => t.projectId === projectId);
      if (strictPropTasks.length > 0) {
        setLiveGanttTasks(strictPropTasks);
      } else if (projectId === 'default') {
        setLiveGanttTasks(DEFAULT_EM_JAY_TASKS);
      } else {
        setLiveGanttTasks([]);
      }
    }
    setIsLoadingGantt(false);
  }, [tasks]);

  useEffect(() => {
    loadLiveGanttForProject(activeProjectId);
  }, [activeProjectId, loadLiveGanttForProject]);

  // Real-time synchronization listener when Master Gantt edits, drags, adds, or deletes tasks
  useEffect(() => {
    const onGanttUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.projectId === activeProjectId) {
        if (Array.isArray(detail?.tasks)) {
          setLiveGanttTasks(detail.tasks);
        } else {
          loadLiveGanttForProject(activeProjectId);
        }
      }
    };
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === `ctvill_gantt_tasks_${activeProjectId}`) {
        loadLiveGanttForProject(activeProjectId);
      }
    };
    window.addEventListener(GANTT_TASKS_UPDATED_EVENT, onGanttUpdated);
    window.addEventListener('storage', onStorageChange);
    return () => {
      window.removeEventListener(GANTT_TASKS_UPDATED_EVENT, onGanttUpdated);
      window.removeEventListener('storage', onStorageChange);
    };
  }, [activeProjectId, loadLiveGanttForProject]);

  // ---------------------------------------------------------------------------
  // SUB-TAB 1: SUMMARY PROGRESS REPORT (100% LIVE GANTT PHASE MATH)
  // ---------------------------------------------------------------------------
  const { rows: phaseProgressRows, totals: summaryTotals } = useMemo(() => {
    return computePhaseProgressSummary(liveGanttTasks);
  }, [liveGanttTasks]);

  const handleJumpToMasterGantt = (phaseName?: string) => {
    if (!activeProjectId) return;
    if (onNavigateToGantt) {
      onNavigateToGantt(activeProjectId, phaseName);
    } else {
      localStorage.setItem('ctvill_gantt_selected_project', activeProjectId);
      if (phaseName) {
        localStorage.setItem('ctvill_gantt_prefill_phase', phaseName);
      }
      window.dispatchEvent(
        new CustomEvent('ctvill-gantt-select-project', {
          detail: { projectId: activeProjectId, phaseName },
        })
      );
    }
  };

  // ---------------------------------------------------------------------------
  // SUB-TAB 2: WEEKLY & DAILY ACTIVITY REPORTS (STRICTLY SCOPED PER PROJECT)
  // ---------------------------------------------------------------------------
  const assignedRosterManpower = useMemo(
    () => deriveProjectManpowerFromRoster(selectedProject, contractors),
    [selectedProject, contractors]
  );

  const assignedRosterTotal =
    assignedRosterManpower.leadman +
    assignedRosterManpower.foreman +
    assignedRosterManpower.mason +
    assignedRosterManpower.laborer +
    assignedRosterManpower.skilled;

  const [savedReports, setSavedReports] = useState<WeeklyActivityReportRecord[]>(() => {
    try {
      const raw = localStorage.getItem(WEEKLY_REPORTS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const projectReports = useMemo(
    () => savedReports.filter(r => r.projectId === activeProjectId),
    [savedReports, activeProjectId]
  );

  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [periodCovered, setPeriodCovered] = useState<string>(() => computeDefaultPeriodLabel());
  const [manpowerCounts, setManpowerCounts] = useState<ManpowerBreakdown>(assignedRosterManpower);
  const [equipmentList, setEquipmentList] = useState<EquipmentEntry[]>([]);
  const [newEquipName, setNewEquipName] = useState('');
  const [weatherLog, setWeatherLog] = useState<Record<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat', 'Sunny' | 'Rainy'>>({
    Mon: 'Sunny',
    Tue: 'Sunny',
    Wed: 'Sunny',
    Thu: 'Sunny',
    Fri: 'Sunny',
    Sat: 'Sunny',
  });
  const [activitiesAccomplished, setActivitiesAccomplished] = useState<string>('');
  const [issuesEncountered, setIssuesEncountered] = useState<string>('');
  const [photos, setPhotos] = useState<{ id: string; caption: string; timestamp: string; url?: string }[]>([]);
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [showLdmPhotoPicker, setShowLdmPhotoPicker] = useState<boolean>(false);
  const [ldmPhotoPickerPage, setLdmPhotoPickerPage] = useState<number>(0);
  const [preparedBy, setPreparedBy] = useState<string>('Site Engineer');
  const [checkedBy, setCheckedBy] = useState<string>('Head Project Manager');
  const [reportSavedBanner, setReportSavedBanner] = useState<string | null>(null);

  // Reset Weekly Report composer cleanly whenever switching projects
  useEffect(() => {
    setIsComposerOpen(false);
    setPeriodCovered(computeDefaultPeriodLabel());
    setManpowerCounts(assignedRosterManpower);
    setEquipmentList([]);
    setWeatherLog({
      Mon: 'Sunny',
      Tue: 'Sunny',
      Wed: 'Sunny',
      Thu: 'Sunny',
      Fri: 'Sunny',
      Sat: 'Sunny',
    });
    setActivitiesAccomplished('');
    setIssuesEncountered('');
    setPhotos([]);
    const pmName = selectedProject?.assignedProjectManagerName?.split('(')[0]?.trim() || 'Head Project Manager';
    setPreparedBy('Site Engineer');
    setCheckedBy(pmName);
  }, [activeProjectId]);

  // Update manpower counts dynamically if DTR or roster changes while composer is fresh
  useEffect(() => {
    setManpowerCounts(assignedRosterManpower);
  }, [assignedRosterManpower]);

  useEffect(() => {
    const syncFromDtr = () => {
      if (!activeProjectId) return;
      setManpowerCounts(deriveProjectManpowerFromRoster(selectedProject, contractors));
    };
    window.addEventListener('ctvill-dtr-manpower-sync', syncFromDtr);
    return () => window.removeEventListener('ctvill-dtr-manpower-sync', syncFromDtr);
  }, [activeProjectId, selectedProject, contractors]);

  const handleOpenNewWeeklyReport = () => {
    setPeriodCovered(computeDefaultPeriodLabel());
    setManpowerCounts(deriveProjectManpowerFromRoster(selectedProject, contractors));
    setEquipmentList([]);
    setWeatherLog({
      Mon: 'Sunny',
      Tue: 'Sunny',
      Wed: 'Sunny',
      Thu: 'Sunny',
      Fri: 'Sunny',
      Sat: 'Sunny',
    });
    setActivitiesAccomplished('');
    setIssuesEncountered('');
    setPhotos([]);
    const pmName = selectedProject?.assignedProjectManagerName?.split('(')[0]?.trim() || 'Head Project Manager';
    setPreparedBy('Site Engineer');
    setCheckedBy(pmName);
    setIsComposerOpen(true);
  };

  const handleSaveWeeklyReport = () => {
    if (!activeProjectId) return;
    const newReport: WeeklyActivityReportRecord = {
      id: `WAR-${Date.now().toString().slice(-5)}`,
      projectId: activeProjectId,
      projectName: selectedProject?.name || 'LDM Design & Build Site',
      periodCovered,
      manpower: { ...manpowerCounts },
      equipment: [...equipmentList],
      weatherLog: { ...weatherLog },
      activitiesAccomplished: activitiesAccomplished.trim() || 'No accomplished works logged for this period.',
      issuesEncountered: issuesEncountered.trim() || 'None reported.',
      photos: [...photos],
      preparedBy: preparedBy.trim() || 'Site Engineer',
      preparedByRole: 'Site Engineer',
      checkedBy: checkedBy.trim() || 'Head Project Manager',
      checkedByRole: 'Head Project Manager',
      createdAt: new Date().toLocaleString('en-PH')
    };
    setSavedReports(prev => {
      const updated = [newReport, ...prev];
      try {
        localStorage.setItem(WEEKLY_REPORTS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setIsComposerOpen(false);
    setReportSavedBanner(`Activity Report ${newReport.id} saved for ${selectedProject?.name || activeProjectId}.`);
    setTimeout(() => setReportSavedBanner(null), 3500);
  };

  const handleDeleteWeeklyReport = (reportId: string) => {
    setSavedReports(prev => {
      const updated = prev.filter(r => r.id !== reportId);
      try {
        localStorage.setItem(WEEKLY_REPORTS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // ---------------------------------------------------------------------------
  // SUB-TAB 3: SAFETY, PPE, QA & PUNCH LIST (STRICTLY SCOPED BY PROJECT ID)
  // ---------------------------------------------------------------------------
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>(() => {
    try {
      const raw = localStorage.getItem(SAFETY_QA_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const projectComplianceItems = useMemo(
    () => complianceItems.filter(item => item.projectId === activeProjectId),
    [complianceItems, activeProjectId]
  );

  const [newCompCategory, setNewCompCategory] = useState<ComplianceItem['category']>('QUALITY_INSPECTION');
  const [newCompTitle, setNewCompTitle] = useState('');
  const [newCompDetails, setNewCompDetails] = useState('');
  const [newCompAssignee, setNewCompAssignee] = useState('Site Engineer');

  const handleAddComplianceItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompTitle.trim() || !activeProjectId) return;
    const item: ComplianceItem = {
      id: `CMP-${Date.now().toString().slice(-4)}`,
      projectId: activeProjectId,
      category: newCompCategory,
      title: newCompTitle.trim(),
      details: newCompDetails.trim() || 'Field verification recorded on site.',
      assignedTo: newCompAssignee.trim() || 'Site Engineer',
      date: new Date().toISOString().split('T')[0],
      status: newCompCategory === 'PUNCH_LIST' ? 'OPEN_DEFECT' : newCompCategory === 'PPE_ISSUANCE' ? 'ISSUED' : 'COMPLIANT'
    };
    setComplianceItems(prev => {
      const updated = [item, ...prev];
      try {
        localStorage.setItem(SAFETY_QA_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setNewCompTitle('');
    setNewCompDetails('');
  };

  const handleToggleComplianceStatus = (itemId: string) => {
    setComplianceItems(prev => {
      const updated = prev.map(c =>
        c.id === itemId
          ? {
              ...c,
              status:
                c.status === 'OPEN_DEFECT'
                  ? ('RECTIFIED' as const)
                  : c.status === 'RECTIFIED'
                  ? ('COMPLIANT' as const)
                  : c.status,
            }
          : c
      );
      try {
        localStorage.setItem(SAFETY_QA_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const totalManpower =
    manpowerCounts.leadman +
    manpowerCounts.foreman +
    manpowerCounts.mason +
    manpowerCounts.laborer +
    manpowerCounts.skilled;

  // ---------------------------------------------------------------------------
  // ENTERPRISE A4 PRINT HANDLERS
  // ---------------------------------------------------------------------------
  const handlePrintSummaryProgressReport = () => {
    const projName = selectedProject?.name || 'LDM Construction Project';
    const projLoc = selectedProject?.location || 'Brgy. Banlic, Cabuyao, Laguna';
    const projClient =
      (selectedProject as any)?.clientName ||
      (selectedProject as any)?.client ||
      'Private Client';

    const rowsHtml = phaseProgressRows
      .map((row) => {
        const varLabel = row.variancePct > 0 ? `+${row.variancePct}%` : `${row.variancePct}%`;
        const varBadge = !row.isScheduled
          ? 'badge-slate'
          : row.variancePct >= 0
          ? 'badge-emerald'
          : row.variancePct < -10
          ? 'badge-rose'
          : 'badge-amber';
        return `
          <tr>
            <td class="mono font-bold">${escapePrintHtml(row.wbs)}</td>
            <td><strong>${escapePrintHtml(row.phaseName)}</strong></td>
            <td class="text-center mono">
              ${
                row.matchedCount === 0
                  ? '<span class="badge badge-slate">0 Tasks (Unscheduled)</span>'
                  : `<span class="badge badge-emerald">${row.matchedCount} Task${row.matchedCount === 1 ? '' : 's'}</span>`
              }
            </td>
            <td class="text-right mono">${row.weight.toFixed(1)}%</td>
            <td class="text-right mono">${row.plannedPct}%</td>
            <td class="text-right mono font-bold">${row.actualPct}%</td>
            <td style="width: 150px;">
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, row.actualPct))}%;"></div>
              </div>
            </td>
            <td class="text-right mono">
              <span class="badge ${varBadge}">${varLabel}</span>
            </td>
            <td class="text-right mono font-bold">${row.weightedActual.toFixed(2)}%</td>
          </tr>
        `;
      })
      .join('');

    const totalVarLabel =
      summaryTotals.overallVariancePct > 0
        ? `+${summaryTotals.overallVariancePct}%`
        : `${summaryTotals.overallVariancePct}%`;

    const bodyHtml = `
      <div class="section-title">14-Phase WBS Bill of Quantities & Live Master Gantt Accomplishment Schedule</div>
      <table>
        <thead>
          <tr>
            <th>WBS Item</th>
            <th>Scope of Works / Construction Phase</th>
            <th class="text-center">Task Count</th>
            <th class="text-right">Weight (%)</th>
            <th class="text-right">Planned (%)</th>
            <th class="text-right">Actual (%)</th>
            <th>Visual Progress Bar</th>
            <th class="text-right">Variance</th>
            <th class="text-right">Weighted Accomplishment (%)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td class="mono font-bold">TOTAL</td>
            <td><strong>Cumulative Project Accomplishment (${summaryTotals.totalTasksCount} Scheduled Task${summaryTotals.totalTasksCount === 1 ? '' : 's'})</strong></td>
            <td class="text-center mono">${summaryTotals.totalTasksCount}</td>
            <td class="text-right mono">${summaryTotals.totalWeight.toFixed(1)}%</td>
            <td class="text-right mono">${summaryTotals.overallPlannedPct}%</td>
            <td class="text-right mono">${summaryTotals.overallActualPct}%</td>
            <td>
              <div class="progress-bar-wrap">
                <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, summaryTotals.overallActualPct))}%;"></div>
              </div>
            </td>
            <td class="text-right mono">${totalVarLabel}</td>
            <td class="text-right mono font-bold" style="color: #047857; font-size: 10.5pt;">${summaryTotals.overallActualPct}%</td>
          </tr>
        </tfoot>
      </table>
    `;

    openEnterprisePrintWindow({
      title: '14-Phase WBS Summary Progress Report',
      subtitle: 'Official Civil Engineering Weighted Bill of Quantities & Live Master Gantt Ledger',
      docRef: `WBS-PROG-${(selectedProject?.id || 'PRJ01').toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      orientation: 'landscape',
      projectMeta: {
        name: projName,
        location: projLoc,
        period: periodCovered,
        client: projClient
      },
      kpiSummary: [
        { label: 'Scheduled Gantt Tasks', value: `${summaryTotals.totalTasksCount} Task(s)` },
        { label: 'Planned Completion', value: `${summaryTotals.overallPlannedPct}%` },
        { label: 'Overall Weighted Progress', value: `${summaryTotals.overallActualPct}%` },
        { label: 'Schedule Variance', value: totalVarLabel }
      ],
      bodyHtml,
      signatures: [
        { role: 'Prepared By (Site Engineer)', name: preparedBy, title: 'Licensed Civil / Site Engineer' },
        { role: 'Checked & Verified By (Project Manager)', name: checkedBy, title: 'Head Project Manager' },
        { role: 'Conformed & Accepted By', name: projClient, title: 'Authorized Client Representative' }
      ]
    });
  };

  const handlePrintWeeklyActivityReport = (record?: WeeklyActivityReportRecord) => {
    const srcManpower = record ? record.manpower : manpowerCounts;
    const srcEquip = record ? record.equipment : equipmentList;
    const srcWeather = record ? record.weatherLog : weatherLog;
    const srcPeriod = record ? record.periodCovered : periodCovered;
    const srcActivities = record ? record.activitiesAccomplished : activitiesAccomplished;
    const srcIssues = record ? record.issuesEncountered : issuesEncountered;
    const srcPreparedBy = record ? record.preparedBy : preparedBy;
    const srcCheckedBy = record ? record.checkedBy : checkedBy;
    const srcTotalManpower =
      srcManpower.leadman +
      srcManpower.foreman +
      srcManpower.mason +
      srcManpower.laborer +
      srcManpower.skilled;

    const projName = selectedProject?.name || 'LDM Construction Project';
    const projLoc = selectedProject?.location || 'Brgy. Banlic, Cabuyao, Laguna';
    const projClient =
      (selectedProject as any)?.clientName ||
      (selectedProject as any)?.client ||
      'Private Client';

    const activePhaseRow =
      phaseProgressRows.find(r => r.isScheduled && r.actualPct > 0 && r.actualPct < 100) ||
      phaseProgressRows.find(r => r.isScheduled) ||
      null;

    const equipRowsHtml =
      srcEquip.length === 0
        ? `<tr><td colspan="4" class="text-center" style="color: #64748b;">No equipment entries logged for this period.</td></tr>`
        : srcEquip
            .map(
              (eq, i) => `
        <tr>
          <td class="mono">${i + 1}</td>
          <td><strong>${escapePrintHtml(eq.name)}</strong></td>
          <td class="text-center mono font-bold">${eq.qty} unit(s)</td>
          <td class="text-center">
            <span class="badge ${eq.status === 'Operational' ? 'badge-emerald' : 'badge-rose'}">
              ${escapePrintHtml(eq.status)}
            </span>
          </td>
        </tr>`
            )
            .join('');

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
    const weatherCellsHtml = days
      .map((d) => {
        const w = srcWeather[d];
        const badge = w === 'Sunny' ? 'badge-amber' : 'badge-sky';
        return `
          <td class="text-center">
            <div><span class="badge ${badge}">AM: ${w}</span></div>
            <div style="margin-top: 3px;"><span class="badge ${badge}">PM: ${w}</span></div>
          </td>
        `;
      })
      .join('');

    const bodyHtml = `
      <div class="section-title">1. Manpower Designation Table (Deployed Field Personnel)</div>
      <table>
        <thead>
          <tr>
            <th class="text-center">Leadman</th>
            <th class="text-center">Foreman</th>
            <th class="text-center">Mason</th>
            <th class="text-center">Laborer</th>
            <th class="text-center">Skilled Trades</th>
            <th class="text-center">Total On-Site Workforce</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="text-center mono font-bold">${srcManpower.leadman}</td>
            <td class="text-center mono font-bold">${srcManpower.foreman}</td>
            <td class="text-center mono font-bold">${srcManpower.mason}</td>
            <td class="text-center mono font-bold">${srcManpower.laborer}</td>
            <td class="text-center mono font-bold">${srcManpower.skilled}</td>
            <td class="text-center mono font-bold" style="background: #f1f5f9;">${srcTotalManpower} Pax</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">2. Weekly Weather Log Table (Mon–Sat AM & PM Telemetry)</div>
      <table>
        <thead>
          <tr>
            <th class="text-center">Monday</th>
            <th class="text-center">Tuesday</th>
            <th class="text-center">Wednesday</th>
            <th class="text-center">Thursday</th>
            <th class="text-center">Friday</th>
            <th class="text-center">Saturday</th>
          </tr>
        </thead>
        <tbody>
          <tr>${weatherCellsHtml}</tr>
        </tbody>
      </table>

      <div class="section-title">3. Site Equipment & Tools Used</div>
      <table>
        <thead>
          <tr>
            <th style="width: 45px;">#</th>
            <th>Equipment / Machinery Description</th>
            <th class="text-center" style="width: 120px;">Quantity</th>
            <th class="text-center" style="width: 150px;">Field Condition Status</th>
          </tr>
        </thead>
        <tbody>
          ${equipRowsHtml}
        </tbody>
      </table>

      <div class="section-title">4. Accomplished Works & Site Issues Encountered</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50%;">Accomplished Works (Current Period)</th>
            <th style="width: 50%;">Site Issues / Delays Encountered & Mitigation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="white-space: pre-wrap; line-height: 1.5;">${escapePrintHtml(srcActivities || 'None logged.')}</td>
            <td style="white-space: pre-wrap; line-height: 1.5;">${escapePrintHtml(srcIssues || 'None reported.')}</td>
          </tr>
        </tbody>
      </table>
    `;

    openEnterprisePrintWindow({
      title: 'Weekly & Daily Engineering Site Activity Report',
      subtitle: `Active Construction Phase: ${activePhaseRow?.phaseName || 'Unscheduled (Add Tasks in Master Gantt)'}`,
      docRef: record?.id || `WAR-${(selectedProject?.id || 'PRJ01').toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      orientation: 'portrait',
      projectMeta: {
        name: projName,
        location: projLoc,
        period: srcPeriod,
        client: `${projClient} • Active Phase: ${activePhaseRow?.phaseName || 'Pending Schedule'}`
      },
      kpiSummary: [
        { label: 'Total Manpower', value: `${srcTotalManpower} Pax` },
        { label: 'Equipment Deployed', value: `${srcEquip.length} Unit(s)` },
        { label: 'Active WBS Phase', value: activePhaseRow?.phaseName || 'None Scheduled' },
        { label: 'Overall Progress', value: `${summaryTotals.overallActualPct}%` }
      ],
      bodyHtml,
      signatures: [
        { role: 'Prepared By (Site Engineer)', name: srcPreparedBy, title: 'Site Engineer' },
        { role: 'Checked By (Head Engineer / PM)', name: srcCheckedBy, title: 'Head Engineer / Project Manager' },
        { role: 'Noted & Approved By', name: 'Operations Manager', title: 'Operations Management' }
      ]
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Project Filter + 3 Sub-Tabs */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Civil Engineer Standard
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {isLoadingGantt ? 'Syncing Master Gantt...' : '100% Live Synced with Master CPM Gantt'}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white mt-1 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            Progress & Field Activity Reports
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Selector */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={activeProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {projects.length === 0 ? (
                <option value="" className="bg-slate-900 text-slate-400">No Commercial Sites</option>
              ) : (
                projects.map(p => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 3 Sub-Tabs Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveSubTab('summary-excel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'summary-excel'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>1. Summary Progress (Excel)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('weekly-pdf')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'weekly-pdf'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>2. Weekly & Daily Activity (PDF)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('safety-qa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'safety-qa'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>3. Safety, PPE, QA & Punch List</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: SUMMARY PROGRESS REPORT (EXCEL STANDARD - LIVE GANTT SYNC) */}
      {/* ===================================================================== */}
      {activeSubTab === 'summary-excel' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Summary Progress Report — {selectedProject?.name || 'Commercial Project'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Standard 14-Phase WBS Progress Table computed directly from Master Gantt tasks ({summaryTotals.totalTasksCount} scheduled task{summaryTotals.totalTasksCount === 1 ? '' : 's'})
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-xs font-mono">
                <span className="text-slate-400 mr-1.5">Overall Weighted Progress:</span>
                <span className="text-emerald-400 font-bold">{summaryTotals.overallActualPct}%</span>
              </div>
              {!isOM && (
                <button
                  type="button"
                  onClick={() => handleJumpToMasterGantt()}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule Tasks in Master Gantt</span>
                </button>
              )}
              <button
                type="button"
                onClick={handlePrintSummaryProgressReport}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Print Official Progress Report</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                  <th className="py-3 px-4 w-16">Item</th>
                  <th className="py-3 px-4">Scope of Works / Construction Phase</th>
                  <th className="py-3 px-3 text-center">Task Count</th>
                  <th className="py-3 px-3 text-right">Weight (%)</th>
                  <th className="py-3 px-3 text-right">Planned (%)</th>
                  <th className="py-3 px-3 text-right">Actual (%)</th>
                  <th className="py-3 px-4 w-56">Live Gantt Progress Bar</th>
                  <th className="py-3 px-3 text-right">Variance</th>
                  <th className="py-3 px-4 text-right">Weighted Accomplishment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {phaseProgressRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 text-amber-400 mb-1">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-bold text-white">No Construction Tasks or WBS Phases Configured</p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          This project does not have active Gantt tasks yet. Use the <strong>BOM &amp; Quotation Builder</strong> to sync standard 15-phase WBS tasks, or jump to the <strong>Master Gantt Schedule</strong> to add custom tasks.
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleJumpToMasterGantt()}
                            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition shadow-xs"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Open Master Gantt Schedule</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : phaseProgressRows.map((row) => {
                  const isCompleted = row.isScheduled && row.actualPct >= 100;
                  const isDelayed = row.isScheduled && row.variancePct < -10;
                  return (
                    <tr key={row.wbs} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-amber-400">{row.wbs}</td>
                      <td className="py-2.5 px-4 font-semibold text-white">{row.phaseName}</td>
                      <td className="py-2.5 px-3 text-center">
                        {row.isScheduled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-semibold">
                            {row.matchedCount} Task{row.matchedCount === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700 text-[10px] font-mono">
                              0 Tasks (Unscheduled)
                            </span>
                            {!isOM && (
                              <button
                                type="button"
                                onClick={() => handleJumpToMasterGantt(row.phaseName)}
                                className="text-[10px] font-mono font-semibold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                                title={`Schedule ${row.phaseName} task in Master Gantt`}
                              >
                                + Schedule
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">{row.weight.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{row.plannedPct}%</td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${row.isScheduled ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {row.actualPct}%
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="w-full bg-slate-950 rounded-md h-4 overflow-hidden border border-slate-800 relative flex items-center">
                          <div
                            className={`h-full transition-all duration-300 ${
                              !row.isScheduled
                                ? 'bg-slate-800'
                                : isCompleted
                                ? 'bg-emerald-500'
                                : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, row.actualPct))}%` }}
                          />
                          <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold drop-shadow ${
                            row.isScheduled ? 'text-white' : 'text-slate-500'
                          }`}>
                            {row.actualPct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={
                            !row.isScheduled
                              ? 'text-slate-500'
                              : row.variancePct >= 0
                              ? 'text-emerald-400'
                              : isDelayed
                              ? 'text-rose-400 font-semibold'
                              : 'text-amber-400'
                          }
                        >
                          {row.variancePct > 0 ? `+${row.variancePct}%` : `${row.variancePct}%`}
                        </span>
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold ${row.isScheduled ? 'text-white' : 'text-slate-500'}`}>
                        {row.weightedActual.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950 border-t-2 border-slate-700 font-mono text-xs font-bold text-white">
                  <td className="py-3 px-4 text-amber-400">TOTAL</td>
                  <td className="py-3 px-4">
                    Cumulative Project Accomplishment
                    <span className="ml-2 text-[10px] font-normal text-slate-400">
                      ({summaryTotals.scheduledPhasesCount}/14 phases scheduled)
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-amber-400">{summaryTotals.totalTasksCount}</td>
                  <td className="py-3 px-3 text-right text-emerald-400">{summaryTotals.totalWeight.toFixed(1)}%</td>
                  <td className="py-3 px-3 text-right text-slate-300">{summaryTotals.overallPlannedPct}%</td>
                  <td className="py-3 px-3 text-right text-emerald-400">{summaryTotals.overallActualPct}%</td>
                  <td className="py-3 px-4">
                    <div className="w-full bg-slate-900 rounded-md h-4 overflow-hidden border border-emerald-500/40 relative">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, summaryTotals.overallActualPct))}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white">
                        {summaryTotals.overallActualPct}% Overall
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={summaryTotals.overallVariancePct >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {summaryTotals.overallVariancePct > 0
                        ? `+${summaryTotals.overallVariancePct}%`
                        : `${summaryTotals.overallVariancePct}%`}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 text-sm">
                    {summaryTotals.overallActualPct}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: WEEKLY & DAILY ACTIVITY REPORTS (STRICTLY PROJECT-SCOPED)  */}
      {/* ===================================================================== */}
      {activeSubTab === 'weekly-pdf' && (
        <div className="space-y-5">
          {reportSavedBanner && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{reportSavedBanner}</span>
              </div>
              <button onClick={() => setReportSavedBanner(null)} className="text-xs underline cursor-pointer">Dismiss</button>
            </div>
          )}

          {/* Project Weekly Activity Reports Header & Saved Logs */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                  PROJECT-SCOPED FIELD ACTIVITY REGISTER
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {selectedProject?.name || 'Selected Commercial Site'} — Weekly Activity Logs ({projectReports.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Assigned Workforce Roster: <span className="font-mono font-bold text-teal-400">{assignedRosterTotal} Pax</span> •
                  Leadman: {assignedRosterManpower.leadman}, Foreman: {assignedRosterManpower.foreman}, Mason: {assignedRosterManpower.mason}, Laborer: {assignedRosterManpower.laborer}, Skilled: {assignedRosterManpower.skilled}
                </p>
              </div>
              {!isOM && !isComposerOpen ? (
                <button
                  type="button"
                  onClick={handleOpenNewWeeklyReport}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ New Weekly Activity Report</span>
                </button>
              ) : isOM ? (
                <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Accomplishment Records (Read-Only)</span>
                </div>
              ) : null}
            </div>

            {projectReports.length === 0 && !isComposerOpen ? (
              <div className="py-12 px-6 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/50 space-y-3">
                <FileText className="w-9 h-9 text-amber-400/70 mx-auto" />
                <div className="text-sm font-bold text-white">
                  No Weekly Activity Reports Logged for {selectedProject?.name || 'This Project'}
                </div>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  {isOM
                    ? 'Activity logs, equipment deployments, weather records, and site photo attachments are submitted by the on-site Project Manager.'
                    : `Activity logs, equipment deployments, weather records, and site photo attachments are strictly scoped per project. Click below to draft a new weekly report pre-loaded with this site's live assigned manpower (${assignedRosterTotal} Pax).`}
                </p>
                {!isOM && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleOpenNewWeeklyReport}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ New Weekly Activity Report</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              projectReports.length > 0 && (
                <div className="space-y-2.5">
                  {projectReports.map((rep) => {
                    const repPax =
                      rep.manpower.leadman +
                      rep.manpower.foreman +
                      rep.manpower.mason +
                      rep.manpower.laborer +
                      rep.manpower.skilled;
                    return (
                      <div
                        key={rep.id}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              {rep.id}
                            </span>
                            <span className="text-xs font-bold text-white">{rep.periodCovered}</span>
                            <span className="text-[11px] font-mono text-teal-400">{repPax} Pax</span>
                            <span className="text-[11px] font-mono text-slate-400">{rep.equipment.length} Equipment</span>
                          </div>
                          <p className="text-xs text-slate-300 line-clamp-2">{rep.activitiesAccomplished}</p>
                          <div className="text-[11px] font-mono text-slate-500">
                            Prepared by {rep.preparedBy} • Checked by {rep.checkedBy} • Logged {rep.createdAt}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePrintWeeklyActivityReport(rep)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                            <span>Print PDF Form</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWeeklyReport(rep.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                            title="Delete Activity Report"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Weekly Activity Report Composer Form */}
          {isComposerOpen && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-xl">
              {/* PDF Standard Document Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                    FIELD ENGINEERING STANDARD FORM • WEEKLY / DAILY SITE ACTIVITY REPORT
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    {selectedProject?.name || 'LDM Construction Project'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Location: {selectedProject?.location || 'Brgy. Banlic, Cabuyao, Laguna'}
                  </p>
                </div>
                <div className="flex flex-col sm:items-end gap-1.5">
                  <label className="text-[10px] font-mono uppercase text-slate-400">Period Covered (Mon–Sat)</label>
                  <input
                    type="text"
                    value={periodCovered}
                    onChange={(e) => setPeriodCovered(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white w-64 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 1: Manpower Designation Counts + Mon-Sat Weather Log */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Manpower Designation Counts */}
                <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-teal-400 font-bold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Manpower Designation Count (Live Roster Sync)
                    </span>
                    <span className="text-xs font-mono font-bold text-white bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded">
                      Total: {totalManpower} Pax
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {([
                      { key: 'leadman', label: 'Leadman' },
                      { key: 'foreman', label: 'Foreman' },
                      { key: 'mason', label: 'Mason' },
                      { key: 'laborer', label: 'Laborer' },
                      { key: 'skilled', label: 'Skilled' },
                    ] as const).map(role => (
                      <div key={role.key} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                        <div className="text-[10px] font-mono uppercase text-slate-400">{role.label}</div>
                        <input
                          type="number"
                          min={0}
                          value={manpowerCounts[role.key]}
                          onChange={(e) =>
                            setManpowerCounts(prev => ({
                              ...prev,
                              [role.key]: Math.max(0, parseInt(e.target.value, 10) || 0)
                            }))
                          }
                          className="w-full text-center bg-transparent text-base font-bold font-mono text-white mt-1 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mon-Sat Weather Log */}
                <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1.5">
                      <CloudSun className="w-3.5 h-3.5" />
                      Mon–Sat Weather Telemetry Log
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Click day to toggle</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const).map(day => {
                      const isSunny = weatherLog[day] === 'Sunny';
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() =>
                            setWeatherLog(prev => ({
                              ...prev,
                              [day]: prev[day] === 'Sunny' ? 'Rainy' : 'Sunny'
                            }))
                          }
                          className={`p-2 rounded-lg border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                            isSunny
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                          }`}
                        >
                          <span className="text-[10px] font-mono font-bold">{day}</span>
                          {isSunny ? <CloudSun className="w-4 h-4 text-amber-400" /> : <CloudRain className="w-4 h-4 text-sky-400" />}
                          <span className="text-[9px] font-mono">{weatherLog[day]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 2: Equipment Used (Operational / For Repair) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    Site Equipment & Machinery Status ({equipmentList.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newEquipName}
                      onChange={(e) => setNewEquipName(e.target.value)}
                      placeholder="Add equipment (e.g. Concrete Vibrator)..."
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newEquipName.trim()) return;
                        setEquipmentList(prev => [
                          ...prev,
                          { id: `eq-${Date.now()}`, name: newEquipName.trim(), qty: 1, status: 'Operational' }
                        ]);
                        setNewEquipName('');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {equipmentList.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2">
                    No equipment added yet for this report. Use the input above to log tools/machinery deployed on site.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {equipmentList.map(eq => (
                      <div key={eq.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">{eq.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">Qty: {eq.qty} unit(s)</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setEquipmentList(prev =>
                              prev.map(item =>
                                item.id === eq.id
                                  ? { ...item, status: item.status === 'Operational' ? 'For Repair' : 'Operational' }
                                  : item
                              )
                            )
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 cursor-pointer border ${
                            eq.status === 'Operational'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {eq.status}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 3: Activities Accomplished & Issues Encountered */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold mb-1.5">
                    Activities Accomplished (Current Period)
                  </label>
                  <textarea
                    rows={4}
                    value={activitiesAccomplished}
                    onChange={(e) => setActivitiesAccomplished(e.target.value)}
                    placeholder="Enter actual accomplished works on site for this period..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-rose-400 font-bold mb-1.5">
                    Site Issues / Delays Encountered & Mitigation
                  </label>
                  <textarea
                    rows={4}
                    value={issuesEncountered}
                    onChange={(e) => setIssuesEncountered(e.target.value)}
                    placeholder="Document weather delays, material bottlenecks, or site coordination notes..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 4: Photo Attachments */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    Site Progress Photo Attachments ({photos.length})
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowLdmPhotoPicker(!showLdmPhotoPicker)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                    >
                      <Camera className="w-3 h-3" />
                      <span>{showLdmPhotoPicker ? 'Close Library' : '📸 Attach from LDM Site Photo Library'}</span>
                    </button>
                    <input
                      type="text"
                      value={newPhotoCaption}
                      onChange={(e) => setNewPhotoCaption(e.target.value)}
                      placeholder="Custom caption..."
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPhotoCaption.trim()) return;
                        setPhotos(prev => [
                          ...prev,
                          {
                            id: `ph-${Date.now()}`,
                            caption: newPhotoCaption.trim(),
                            timestamp: new Date().toLocaleString('en-PH')
                          }
                        ]);
                        setNewPhotoCaption('');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Paginated 8-Per-Page LDM Construction Site Photo Picker */}
                {showLdmPhotoPicker && (
                  <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-amber-300 font-bold uppercase">
                        Select Verified Field Photo from LDM Site Construction Archive:
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <button
                          type="button"
                          disabled={ldmPhotoPickerPage === 0}
                          onClick={() => setLdmPhotoPickerPage(prev => Math.max(0, prev - 1))}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer"
                        >
                          &larr; Prev
                        </button>
                        <span className="text-slate-400">
                          Page {ldmPhotoPickerPage + 1} of {Math.ceil(ldmSiteConstructionAssets.length / 8)}
                        </span>
                        <button
                          type="button"
                          disabled={(ldmPhotoPickerPage + 1) * 8 >= ldmSiteConstructionAssets.length}
                          onClick={() => setLdmPhotoPickerPage(prev => prev + 1)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer"
                        >
                          Next &rarr;
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ldmSiteConstructionAssets
                        .slice(ldmPhotoPickerPage * 8, (ldmPhotoPickerPage + 1) * 8)
                        .map((asset) => (
                          <div
                            key={asset.id}
                            onClick={() => {
                              setPhotos(prev => [
                                ...prev,
                                {
                                  id: `ldm-ph-${asset.id}-${Date.now()}`,
                                  caption: asset.title,
                                  url: asset.url,
                                  timestamp: new Date().toLocaleString('en-PH')
                                }
                              ]);
                            }}
                            className="group/item relative h-20 rounded-lg overflow-hidden border border-slate-800 hover:border-amber-400 cursor-pointer bg-slate-950"
                          >
                            <OptimizedLdmImage
                              src={asset.url}
                              alt={asset.title}
                              className="w-full h-full object-cover group-hover/item:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold text-amber-300">
                              + Attach
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {photos.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-1">
                    No photo captions attached yet. Click "+ Attach from LDM Site Photo Library" to pick live progress images.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {photos.map(ph => (
                      <div key={ph.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {ph.url ? (
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 shrink-0 bg-slate-950">
                              <OptimizedLdmImage src={ph.url} alt={ph.caption} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                              <Camera className="w-4 h-4 text-amber-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{ph.caption}</div>
                            <div className="text-[10px] font-mono text-slate-400">{ph.timestamp} • Geotagged Site Photo</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPhotos(prev => prev.filter(p => p.id !== ph.id))}
                          className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 5: Signature Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                  <div className="text-[10px] font-mono uppercase text-slate-400">Prepared By (Site Engineer)</div>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="bg-transparent text-sm font-bold text-white mt-1 w-full focus:outline-none border-b border-slate-800 pb-1"
                  />
                  <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Digitally Signed • Site Engineer</span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                  <div className="text-[10px] font-mono uppercase text-slate-400">Checked & Verified By (Project Manager / Ops)</div>
                  <input
                    type="text"
                    value={checkedBy}
                    onChange={(e) => setCheckedBy(e.target.value)}
                    className="bg-transparent text-sm font-bold text-white mt-1 w-full focus:outline-none border-b border-slate-800 pb-1"
                  />
                  <div className="text-[11px] text-amber-400 font-mono mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verified • Lead Project Manager</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintWeeklyActivityReport()}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Print Weekly Activity Report (PDF Form)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveWeeklyReport}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Log & Sign Activity Report</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: SAFETY, PPE, QA & PUNCH LIST (STRICTLY PROJECT-SCOPED)     */}
      {/* ===================================================================== */}
      {activeSubTab === 'safety-qa' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Compliance & Merged Punch List Feed */}
          <div className={`${isOM ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-3`}>
            {projectComplianceItems.length === 0 ? (
              <div className="bg-slate-900/80 border border-dashed border-slate-800 rounded-xl p-10 text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-sky-400/70 mx-auto" />
                <div className="text-sm font-bold text-white">
                  No Safety, PPE, QA or Punch-List Entries for {selectedProject?.name || 'This Site'}
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {isOM
                    ? 'Field safety briefings, PPE issuances, quality inspections, and punch-list items are recorded and verified by the on-site Project Manager.'
                    : 'Field safety briefings, PPE issuances, quality inspections, and punch-list items are strictly scoped by project. Use the form on the right to log an entry for this site.'}
                </p>
              </div>
            ) : (
              projectComplianceItems.map(item => (
                <div
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                        {item.id}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                          item.category === 'PPE_ISSUANCE'
                            ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                            : item.category === 'TOOLBOX_MEETING'
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            : item.category === 'QUALITY_INSPECTION'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {item.category.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{item.date}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-slate-400">{item.details}</p>
                    <div className="text-[11px] text-amber-400/90 font-mono">
                      Responsible: {item.assignedTo}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOM ? (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                          item.status === 'OPEN_DEFECT'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {item.status === 'OPEN_DEFECT' ? '⚠️ Open Defect' : `✓ ${item.status}`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleComplianceStatus(item.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                          item.status === 'OPEN_DEFECT'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {item.status === 'OPEN_DEFECT' ? '⚠️ Open Punch-List (Click to Rectify)' : `✓ ${item.status}`}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: Quick Log Form (PM / Site Engineer ONLY) */}
          {!isOM && (
            <div className="lg:col-span-4">
              <form
                onSubmit={handleAddComplianceItem}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3.5 sticky top-6"
              >
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  Log Field Safety, QA or Punch Item
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Site: <span className="text-amber-400 font-semibold">{selectedProject?.name || 'Select a project'}</span>
                </p>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Record Type</label>
                  <select
                    value={newCompCategory}
                    onChange={(e) => setNewCompCategory(e.target.value as ComplianceItem['category'])}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="PPE_ISSUANCE">PPE Issuance Log</option>
                    <option value="TOOLBOX_MEETING">Daily Toolbox Meeting</option>
                    <option value="QUALITY_INSPECTION">Quality Inspection Sign-off</option>
                    <option value="PUNCH_LIST">Punch-List Defect / Rectification</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Summary / Title *</label>
                  <input
                    type="text"
                    required
                    value={newCompTitle}
                    onChange={(e) => setNewCompTitle(e.target.value)}
                    placeholder="e.g. Issued 10 Safety Harnesses to Roof Crew"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Inspection / Safety Notes</label>
                  <textarea
                    rows={3}
                    value={newCompDetails}
                    onChange={(e) => setNewCompDetails(e.target.value)}
                    placeholder="Enter observations, headcount, or rectification notes..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Verified By / Assigned Trade</label>
                  <input
                    type="text"
                    value={newCompAssignee}
                    onChange={(e) => setNewCompAssignee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!activeProjectId}
                  className="w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer transition disabled:opacity-50"
                >
                  + Record Field Entry
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
