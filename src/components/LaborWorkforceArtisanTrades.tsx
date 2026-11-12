/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, HardHat, AlertTriangle, Award, BadgeAlert,
  BarChart3, Building, PieChart, RefreshCw, Sparkles, Bot, Zap,
  X, CheckCircle, CheckCheck, ChevronUp, ChevronDown, ArrowRight,
  Lightbulb, ClipboardList, Plus, TrendingUp, Check,
  ArrowRightLeft, Sliders, MapPin, Building2, UserCheck, Lock
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, PieChart as RePieChart, Pie, LabelList
} from 'recharts';
import {
  Contractor, DailyManpowerAudit, AIManpowerRecommendation,
  ProjectProfile, isOfficeOrExecutive, isIndividualStaffOrEngineer
} from '../types';
import { useTheme } from '../context/ThemeContext';
import { normalizeRole, UserRole } from '../utils/rbac';
import WorkforceMessengerRoster from './WorkforceMessengerRoster';

export interface LaborWorkforceArtisanTradesProps {
  contractors: Contractor[];
  manpowerAudits: DailyManpowerAudit[];
  projects: ProjectProfile[];
  userRole?: string;
  isAdmin?: boolean;
  aiRecommendations: AIManpowerRecommendation[];
  isAiScanning: boolean;
  aiScanMessage: string | null;
  handleTriggerAiScan: () => void;
  onApplyAIRecommendation?: (recId: string) => Promise<any> | void;
  onDismissAIRecommendation?: (recId: string) => Promise<any> | void;
  showAppliedRecsHistory: boolean;
  setShowAppliedRecsHistory: React.Dispatch<React.SetStateAction<boolean>>;
  totalManpower: number;
  deployedFieldContractors: Contractor[];
  inHouseCount: number;
  outsourcedCount: number;
  projectLaborChartData: any[];
  tradeManpowerChartData: any[];
  rollCallComparisonChartData: any[];
  employmentMixChartData: any[];
  onDeleteContractor?: (id: string) => void;
  onUpdateContractor?: (contractor: Contractor) => void;
  onUpdateContractors?: (contractors: Contractor[]) => void;
  onUpdateProject?: (id: string, updates: Partial<ProjectProfile>) => void;
  onRegisterWorkerClick: () => void;
  onLogAuditClick: () => void;
  onVerifyRollCall?: (contractorId: string) => void;
  notify: (msg: string) => void;
  /** Forces an initial sub-tab. */
  initialTab?: WorkforceTabId;
  readOnly?: boolean;
  isFinance?: boolean;
  hideTabs?: boolean;
}

export type WorkforceTabId = 'workbench' | 'analytics' | 'directory';

export interface AllocationAuditEntry {
  id: string;
  timestamp: string;
  actorRole: string;
  workerId: string;
  workerName: string;
  trade: string;
  projectId: string;
  projectName: string;
  action: 'Assigned' | 'Unassigned' | 'Conflict Override' | 'AI Recommendation Applied';
  source: 'Manual' | 'AI';
  hadScheduleConflict: boolean;
  conflictDetails?: string;
  overrideNote?: string;
  isLockedByAdmin: boolean;
  dailyRate: number;
}

const OVERRIDE_REASON_PRESETS = [
  'Executive Approval / Urgent Pull-Out',
  'Dual-Site Split Shift Authorized',
  'Critical Path Milestone Coverage',
  'Emergency Trade Substitution',
];

const TABS: { id: WorkforceTabId; label: string; icon: React.ElementType }[] = [
  { id: 'workbench', label: 'Tab 1: Dispatch Workbench', icon: Sliders },
  { id: 'analytics', label: 'Tab 2: Workforce Analytics & Reports', icon: BarChart3 },
  { id: 'directory', label: 'Personnel Directory & Roster', icon: Users },
];

export const LaborWorkforceArtisanTrades: React.FC<LaborWorkforceArtisanTradesProps> = ({
  contractors,
  manpowerAudits,
  projects,
  userRole,
  isAdmin = false,
  aiRecommendations,
  isAiScanning,
  aiScanMessage,
  handleTriggerAiScan,
  onApplyAIRecommendation,
  onDismissAIRecommendation,
  showAppliedRecsHistory,
  setShowAppliedRecsHistory,
  totalManpower,
  deployedFieldContractors,
  inHouseCount,
  outsourcedCount,
  projectLaborChartData,
  tradeManpowerChartData,
  rollCallComparisonChartData,
  employmentMixChartData,
  onDeleteContractor,
  onUpdateContractor,
  onUpdateContractors,
  onUpdateProject,
  onRegisterWorkerClick,
  onLogAuditClick,
  onVerifyRollCall,
  notify,
  initialTab,
  readOnly = false,
  isFinance = false,
  hideTabs = false,
}) => {
  const { isDark } = useTheme();

  const currentRole = normalizeRole(userRole);
  const isOM = currentRole === UserRole.OM || isAdmin;
  const isPM = currentRole === UserRole.PM;

  const availableTabs = useMemo(() => {
    return TABS.filter(tab => {
      // Tab 1 (Dispatch Workbench): Show ONLY for PM / Site Engineer (hide for OM)
      if (tab.id === 'workbench') return isPM || (!isOM && !isPM);
      // Tab 2 (Workforce Analytics & Reports): Show ONLY for OM (hide for PM / Site Engineer)
      if (tab.id === 'analytics') return isOM;
      // Tab 3 (Personnel Directory & Roster): Show for both
      return true;
    });
  }, [isOM, isPM]);

  const [activeSubTab, setActiveSubTab] = useState<WorkforceTabId>(() => {
    if (initialTab) return initialTab;
    if (isOM) return 'analytics';
    return 'workbench';
  });

  // Guard activeSubTab if role changes or tab is unauthorized
  useEffect(() => {
    if (isOM && activeSubTab === 'workbench') {
      setActiveSubTab('analytics');
    } else if (isPM && activeSubTab === 'analytics') {
      setActiveSubTab('workbench');
    }
  }, [isOM, isPM, activeSubTab]);
  const [recommendationQueue, setRecommendationQueue] = useState<AIManpowerRecommendation[]>([]);
  const [appliedTransfersHistory, setAppliedTransfersHistory] = useState<AIManpowerRecommendation[]>([]);

  // Live Immutable Synced State for Projects & Contractors (ensures instant reactive updates across Tab 1 & Tab 2)
  const [localContractors, setLocalContractors] = useState<Contractor[]>(contractors);
  const [localProjectAssignments, setLocalProjectAssignments] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setLocalContractors(contractors);
  }, [contractors]);

  useEffect(() => {
    setLocalProjectAssignments(prev => {
      const next = { ...prev };
      projects.forEach(p => {
        if (!next[p.id]) {
          const byId = p.assignedContractorIds || [];
          const bySite = contractors
            .filter(c => (c.activeProjectSite || '').trim().toLowerCase() === p.name.trim().toLowerCase())
            .map(c => c.id);
          next[p.id] = Array.from(new Set([...byId, ...bySite]));
        }
      });
      return next;
    });
  }, [projects, contractors]);

  // Unified Allocation Workbench State
  const [selectedWorkbenchProjectId, setSelectedWorkbenchProjectId] = useState<string>(() => {
    const active = projects.find(p => p.status !== 'COMPLETED' && p.status !== 'HANDED_OVER') || projects[0];
    return active?.id || '';
  });
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(true);
  const [aiSortMode, setAiSortMode] = useState<'match' | 'cost'>('match');
  const [rosterSearchQuery, setRosterSearchQuery] = useState<string>('');
  const [quickAddWorkerId, setQuickAddWorkerId] = useState<string>('');
  const [quickAddOverrideReason, setQuickAddOverrideReason] = useState<string>(OVERRIDE_REASON_PRESETS[0]);
  const [poolPendingOverrideReasons, setPoolPendingOverrideReasons] = useState<Record<string, string>>({});
  const [crewSelectedWorkerIds, setCrewSelectedWorkerIds] = useState<string[]>([]);
  const [dismissedWorkforceStagedIds, setDismissedWorkforceStagedIds] = useState<string[]>([]);
  const [crewAllocationSourceMap, setCrewAllocationSourceMap] = useState<Record<string, 'Manual' | 'AI'>>({});
  const [crewOverrideNotes, setCrewOverrideNotes] = useState<Record<string, string>>({});
  const [crewAdminLocks, setCrewAdminLocks] = useState<Record<string, boolean>>({});
  const [activeWorkforceNoteEditorId, setActiveWorkforceNoteEditorId] = useState<string | null>(null);
  const [allocationAuditTrail, setAllocationAuditTrail] = useState<AllocationAuditEntry[]>([]);
  const [lastAllocationFeedback, setLastAllocationFeedback] = useState<{
    workerId: string;
    workerName: string;
    source: 'Manual' | 'AI';
    action: 'assigned' | 'unassigned';
  } | null>(null);

  const currentActorRole = isFinance ? 'Finance Controller' : 'Operations Administrator';

  // Daily wage rate helper (₱/day)
  const getWorkerDailyRate = (w: Contractor): number => {
    if (w.dailyRate && Number(w.dailyRate) > 0) return Math.round(Number(w.dailyRate));
    if (w.monthlySalary && Number(w.monthlySalary) > 0) return Math.round(Number(w.monthlySalary) / 26);
    const trade = (w.tradeType || w.specialty || w.roleTitle || '').toLowerCase();
    if (trade.includes('foreman') || trade.includes('engineer') || trade.includes('architect')) return 1200;
    if (trade.includes('electrician') || trade.includes('plumber') || trade.includes('welder') || trade.includes('carpenter') || trade.includes('mason')) return 950;
    return 800;
  };

  // Human Override Protection Lock check: strictly true if locked by Admin or has a manual override note
  const isWorkerLockedByAdmin = (w: Contractor): boolean => {
    const note = (crewOverrideNotes[w.id] ?? w.manualOverrideNote ?? '').trim();
    return Boolean(crewAdminLocks[w.id] || w.isLockedByAdmin || note.length > 0);
  };

  // Active target project for the Allocation Workbench
  const targetAllocationProject = useMemo(() => {
    if (selectedWorkbenchProjectId && projects.length > 0) {
      const matched = projects.find(p => p.id === selectedWorkbenchProjectId);
      if (matched) return matched;
    }
    return projects.find(p => p.status !== 'COMPLETED' && p.status !== 'HANDED_OVER') || projects[0] || null;
  }, [selectedWorkbenchProjectId, projects]);

  // Keep selectedWorkbenchProjectId valid when projects load
  useEffect(() => {
    if (!selectedWorkbenchProjectId && targetAllocationProject) {
      setSelectedWorkbenchProjectId(targetAllocationProject.id);
    }
  }, [targetAllocationProject?.id]);

  // Helper to get live assigned worker IDs for any project
  const getProjectAssignedIds = (proj: ProjectProfile): string[] => {
    if (localProjectAssignments[proj.id]) {
      return localProjectAssignments[proj.id];
    }
    const assignedByIds = proj.assignedContractorIds || [];
    const assignedBySite = localContractors
      .filter(c => (c.activeProjectSite || '').trim().toLowerCase() === proj.name.trim().toLowerCase())
      .map(c => c.id);
    return Array.from(new Set([...assignedByIds, ...assignedBySite]));
  };

  // Sync assigned crew IDs when target project changes
  useEffect(() => {
    if (targetAllocationProject) {
      const merged = getProjectAssignedIds(targetAllocationProject);
      setCrewSelectedWorkerIds(merged);
      setCrewAllocationSourceMap(prev => {
        const next = { ...prev };
        merged.forEach(id => {
          const found = localContractors.find(c => c.id === id);
          if (!next[id]) next[id] = found?.allocationSource || 'Manual';
        });
        return next;
      });
    } else {
      setCrewSelectedWorkerIds([]);
    }
  }, [targetAllocationProject?.id, localProjectAssignments]);

  // Append an entry to the live Audit Trail (capturing exact timestamp, administrator role, and justification note)
  const appendAuditEntry = (entry: Omit<AllocationAuditEntry, 'id' | 'timestamp' | 'actorRole'> & { actorRole?: string }) => {
    const now = new Date();
    const formattedTimestamp = `${now.toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' })} • ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    const newEntry: AllocationAuditEntry = {
      ...entry,
      actorRole: entry.actorRole || currentActorRole,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: formattedTimestamp
    };
    setAllocationAuditTrail(prev => [newEntry, ...prev].slice(0, 25));
  };

  const handleUpdateWorkforceOverrideNote = (worker: Contractor, note: string) => {
    setCrewOverrideNotes(prev => ({ ...prev, [worker.id]: note }));
    const hasNote = note.trim().length > 0;
    const nextLocked = hasNote ? true : Boolean(crewAdminLocks[worker.id]);
    setCrewAdminLocks(prev => ({ ...prev, [worker.id]: nextLocked }));
    setCrewAllocationSourceMap(prev => ({ ...prev, [worker.id]: 'Manual' }));

    const updatedWorker: Contractor = {
      ...worker,
      manualOverrideNote: note,
      isLockedByAdmin: nextLocked,
      allocationSource: 'Manual'
    };
    setLocalContractors(prev => prev.map(c => (c.id === worker.id ? updatedWorker : c)));
    if (onUpdateContractor) onUpdateContractor(updatedWorker);
    if (onUpdateContractors) {
      onUpdateContractors(localContractors.map(c => (c.id === worker.id ? updatedWorker : c)));
    }

    if (hasNote && targetAllocationProject) {
      const avail = getWorkerAvailabilityAdvisory(worker, targetAllocationProject);
      appendAuditEntry({
        workerId: worker.id,
        workerName: worker.name,
        trade: worker.tradeType || worker.specialty || 'General Trade',
        projectId: targetAllocationProject.id,
        projectName: targetAllocationProject.name,
        action: 'Conflict Override',
        source: 'Manual',
        hadScheduleConflict: avail.isOverlapping,
        conflictDetails: avail.isOverlapping ? avail.badgeText : undefined,
        overrideNote: note,
        isLockedByAdmin: true,
        dailyRate: getWorkerDailyRate(worker)
      });
    }
  };

  const handleToggleWorkforceAdminLock = (worker: Contractor) => {
    const currentLock = isWorkerLockedByAdmin(worker);
    const nextLock = !currentLock;
    setCrewAdminLocks(prev => ({ ...prev, [worker.id]: nextLock }));
    setCrewAllocationSourceMap(prev => ({ ...prev, [worker.id]: 'Manual' }));

    const updatedWorker: Contractor = {
      ...worker,
      isLockedByAdmin: nextLock,
      allocationSource: 'Manual'
    };
    setLocalContractors(prev => prev.map(c => (c.id === worker.id ? updatedWorker : c)));
    if (onUpdateContractor) onUpdateContractor(updatedWorker);
    if (onUpdateContractors) {
      onUpdateContractors(localContractors.map(c => (c.id === worker.id ? updatedWorker : c)));
    }
  };

  // Non-Blocking Overlap & Availability Cross-Reference against startDate & targetHandoverDate
  const getWorkerAvailabilityAdvisory = (
    w: Contractor,
    targetProj?: ProjectProfile | null
  ): { isOverlapping: boolean; overlappingProjects: string[]; badgeText: string } => {
    const excludeId = targetProj?.id;
    const reqStart = targetProj?.startDate ? new Date(targetProj.startDate).getTime() : NaN;
    const reqEnd = targetProj?.targetHandoverDate ? new Date(targetProj.targetHandoverDate).getTime() : NaN;
    const hasValidTargetDates = !isNaN(reqStart) && !isNaN(reqEnd);

    const activeProjects = projects.filter(
      p => p.id !== excludeId && p.status !== 'COMPLETED' && p.status !== 'HANDED_OVER'
    );

    const overlappingNames: string[] = [];

    for (const proj of activeProjects) {
      const projIds = getProjectAssignedIds(proj);
      const isAssignedById = projIds.includes(w.id) || w.assignedProjectId === proj.id;
      const isAssignedBySiteName = Boolean(
        w.activeProjectSite &&
        !w.activeProjectSite.toLowerCase().includes('standby') &&
        proj.name.trim().toLowerCase() === w.activeProjectSite.trim().toLowerCase()
      );

      if (!isAssignedById && !isAssignedBySiteName) continue;

      const projStart = proj.startDate ? new Date(proj.startDate).getTime() : NaN;
      const projEnd = proj.targetHandoverDate ? new Date(proj.targetHandoverDate).getTime() : NaN;
      const hasValidProjDates = !isNaN(projStart) && !isNaN(projEnd);

      const datesOverlap =
        hasValidTargetDates && hasValidProjDates
          ? reqStart <= projEnd && reqEnd >= projStart
          : true;

      if (datesOverlap && !overlappingNames.includes(proj.name)) {
        overlappingNames.push(proj.name);
      }
    }

    if (overlappingNames.length > 0) {
      const primary = overlappingNames[0];
      const extra = overlappingNames.length > 1 ? ` (+${overlappingNames.length - 1})` : '';
      return {
        isOverlapping: true,
        overlappingProjects: overlappingNames,
        badgeText: `⚠️ Advisory: Active on ${primary}${extra}`
      };
    }

    return {
      isOverlapping: false,
      overlappingProjects: [],
      badgeText: 'Available'
    };
  };

  // Explainable AI Crew Suggestion Generator for Target Project (Strictly skips isLockedByAdmin & already-assigned workers)
  const workforceAiCrewSuggestions = useMemo(() => {
    const scopeText = `${targetAllocationProject?.name || ''} ${targetAllocationProject?.description || ''}`.toLowerCase();
    const projectBudget = Number(targetAllocationProject?.budget || 0);

    const desiredTrades = [
      { keyword: 'Foreman', matchTerms: ['foreman', 'lead', 'supervisor'] },
      { keyword: 'Carpenter', matchTerms: ['carpenter', 'carpentry', 'partition', 'fit-out', 'ceiling', 'wood', 'architectural'] },
      { keyword: 'Electrician', matchTerms: ['electrician', 'electrical', 'mep', 'lighting', 'power', 'wiring'] },
      { keyword: 'Mason', matchTerms: ['mason', 'masonry', 'civil', 'concrete', 'tile', 'structural', 'wall'] },
      { keyword: 'Plumber', matchTerms: ['plumber', 'plumbing', 'sanitary', 'water', 'pipe', 'mep'] },
      { keyword: 'Painter', matchTerms: ['painter', 'painting', 'finish', 'coating', 'interior'] },
      { keyword: 'Welder', matchTerms: ['welder', 'steel', 'metal', 'structural', 'fabrication'] }
    ];

    // Strictly skip any worker flagged as isLockedByAdmin or already assigned to the selected project
    const unlockedPool = localContractors.filter(
      c => !isWorkerLockedByAdmin(c) && !crewSelectedWorkerIds.includes(c.id)
    );
    const fieldCandidates = unlockedPool.filter(c => !isOfficeOrExecutive(c));
    const pool = fieldCandidates.length > 0 ? fieldCandidates : unlockedPool;

    const scored = pool.map(w => {
      const tradeStr = (w.tradeType || w.specialty || w.roleTitle || 'General').toLowerCase();
      const avail = getWorkerAvailabilityAdvisory(w, targetAllocationProject);
      const rate = getWorkerDailyRate(w);
      const matchesScope = desiredTrades.some(
        dt => dt.matchTerms.some(t => tradeStr.includes(t)) && (scopeText.length === 0 || dt.matchTerms.some(t => scopeText.includes(t)))
      );
      const rateFitsBudget = projectBudget <= 0 || rate <= Math.max(1500, projectBudget * 0.02);

      // Check if there is also an active cross-site AI recommendation for this worker
      const matchingAiRec = recommendationQueue.find(
        r => r.workerId === w.id || r.contractorId === w.id || (r.workerName || r.contractorName || '').toLowerCase() === w.name.toLowerCase()
      );

      // 4-Factor Score Breakdown (Trade /35, Availability /30, Budget /20, Performance /15)
      const tradeScore = matchesScope ? 35 : 28;
      const availabilityScore = avail.isOverlapping ? 12 : 30;
      const budgetScore = rateFitsBudget ? 20 : 12;
      const perfScore = Math.min(15, Math.max(10, Math.round(((w.rating || 4.5) / 5) * 15)));
      const score = tradeScore + availabilityScore + budgetScore + perfScore;

      const rationaleParts = [
        'Trade matches scope',
        avail.isOverlapping ? `Active on ${avail.overlappingProjects[0]} (Dual-site advisory)` : 'Currently Available',
        rateFitsBudget ? `Rate fits budget (₱${rate.toLocaleString()}/day)` : `Standard rate (₱${rate.toLocaleString()}/day)`
      ];

      return {
        worker: w,
        rate,
        avail,
        score,
        matchingAiRec,
        fourFactorBreakdown: `Trade ${tradeScore}/35 • Avail ${availabilityScore}/30 • Budget ${budgetScore}/20 • Rating ${perfScore}/15`,
        rationale: matchingAiRec?.rationale
          ? matchingAiRec.rationale
          : `Recommended: ${rationaleParts.join(' • ')}`
      };
    });

    scored.sort((a, b) => b.score - a.score || a.rate - b.rate);
    const picked: typeof scored = [];
    const seenTrades = new Set<string>();
    for (const item of scored) {
      if (picked.length >= 5) break;
      const tKey = (item.worker.tradeType || item.worker.specialty || 'General').toLowerCase();
      if (!seenTrades.has(tKey) || picked.length < 3) {
        picked.push(item);
        seenTrades.add(tKey);
      }
    }
    const baseList = picked.length > 0 ? picked : scored.slice(0, 4);
    const filtered = baseList.filter(item => !dismissedWorkforceStagedIds.includes(item.worker.id));
    if (aiSortMode === 'cost') {
      return [...filtered].sort((a, b) => a.rate - b.rate || b.score - a.score);
    }
    return [...filtered].sort((a, b) => b.score - a.score || a.rate - b.rate);
  }, [localContractors, projects, targetAllocationProject, crewSelectedWorkerIds, crewOverrideNotes, crewAdminLocks, dismissedWorkforceStagedIds, recommendationQueue, localProjectAssignments, aiSortMode]);

  // Unified Assign Worker Handler (Cohesive for both Manual & AI Recommendation actions, with Conflict Override Persistence)
  const handleAssignWorkerToProject = async (
    worker: Contractor,
    source: 'Manual' | 'AI',
    linkedRec?: AIManpowerRecommendation,
    explicitOverrideNote?: string
  ) => {
    if (!targetAllocationProject) return;
    const avail = getWorkerAvailabilityAdvisory(worker, targetAllocationProject);
    const nextIds = crewSelectedWorkerIds.includes(worker.id)
      ? crewSelectedWorkerIds
      : [...crewSelectedWorkerIds, worker.id];

    // If worker has an active conflict and is assigned manually, persist the selected override note and isLockedByAdmin = true
    const resolvedOverrideNote =
      explicitOverrideNote !== undefined
        ? explicitOverrideNote
        : avail.isOverlapping && source === 'Manual'
          ? poolPendingOverrideReasons[worker.id] || OVERRIDE_REASON_PRESETS[0]
          : crewOverrideNotes[worker.id] ?? worker.manualOverrideNote ?? '';

    const shouldLock =
      source === 'Manual' && (avail.isOverlapping || resolvedOverrideNote.trim().length > 0)
        ? true
        : Boolean(crewAdminLocks[worker.id] || worker.isLockedByAdmin);

    if (resolvedOverrideNote.trim().length > 0) {
      setCrewOverrideNotes(prev => ({ ...prev, [worker.id]: resolvedOverrideNote }));
    }
    if (shouldLock) {
      setCrewAdminLocks(prev => ({ ...prev, [worker.id]: true }));
    }

    // Immutably update local project assignments & crew selection
    setCrewSelectedWorkerIds(nextIds);
    setLocalProjectAssignments(prev => ({
      ...prev,
      [targetAllocationProject.id]: nextIds
    }));
    setCrewAllocationSourceMap(prev => ({ ...prev, [worker.id]: source }));

    const updatedWorker: Contractor = {
      ...worker,
      activeProjectSite: targetAllocationProject.name,
      assignedProjectId: targetAllocationProject.id,
      allocationSource: source,
      manualOverrideNote: resolvedOverrideNote || worker.manualOverrideNote,
      isLockedByAdmin: shouldLock
    };

    const nextContractorsList = localContractors.map(c => (c.id === worker.id ? updatedWorker : c));
    setLocalContractors(nextContractorsList);

    if (onUpdateContractor) {
      onUpdateContractor(updatedWorker);
    }
    if (onUpdateContractors) {
      onUpdateContractors(nextContractorsList);
    }
    if (onUpdateProject) {
      onUpdateProject(targetAllocationProject.id, {
        assignedContractorIds: nextIds,
        assignedWorkersCount: nextIds.length
      });
    }

    // Record in live Audit Trail
    appendAuditEntry({
      workerId: worker.id,
      workerName: worker.name,
      trade: worker.tradeType || worker.specialty || 'General Trade',
      projectId: targetAllocationProject.id,
      projectName: targetAllocationProject.name,
      action:
        source === 'AI'
          ? 'AI Recommendation Applied'
          : avail.isOverlapping
            ? 'Conflict Override'
            : 'Assigned',
      source,
      hadScheduleConflict: avail.isOverlapping,
      conflictDetails: avail.isOverlapping ? avail.badgeText : undefined,
      overrideNote: resolvedOverrideNote || undefined,
      isLockedByAdmin: shouldLock,
      dailyRate: getWorkerDailyRate(worker)
    });

    fetch(`/api/projects/${targetAllocationProject.id}/workers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId: worker.id,
        action: 'add',
        allocationSource: source,
        manualOverrideNote: resolvedOverrideNote || undefined,
        isLockedByAdmin: shouldLock
      })
    }).catch(() => {});

    if (linkedRec && onApplyAIRecommendation) {
      try {
        await onApplyAIRecommendation(linkedRec.id);
      } catch {
        // non-blocking
      }
    }

    setLastAllocationFeedback({
      workerId: worker.id,
      workerName: worker.name,
      source,
      action: 'assigned'
    });
    setTimeout(() => {
      setLastAllocationFeedback(prev => (prev?.workerId === worker.id ? null : prev));
    }, 3500);

    notify(
      source === 'AI'
        ? `✓ Applied AI recommendation: ${worker.name} assigned to "${targetAllocationProject.name}".`
        : avail.isOverlapping
          ? `✓ Assigned ${worker.name} to "${targetAllocationProject.name}" with Override (${resolvedOverrideNote}).`
          : `✓ Assigned ${worker.name} to "${targetAllocationProject.name}".`
    );
  };

  // Unified Unassign Worker Handler
  const handleUnassignWorkerFromProject = async (worker: Contractor) => {
    if (!targetAllocationProject) return;
    const nextIds = crewSelectedWorkerIds.filter(id => id !== worker.id);
    setCrewSelectedWorkerIds(nextIds);
    setLocalProjectAssignments(prev => ({
      ...prev,
      [targetAllocationProject.id]: nextIds
    }));

    const isCurrentSiteMatch =
      (worker.activeProjectSite || '').trim().toLowerCase() ===
      targetAllocationProject.name.trim().toLowerCase();

    const updatedWorker: Contractor = {
      ...worker,
      activeProjectSite: isCurrentSiteMatch ? 'General Standby Pool' : worker.activeProjectSite,
      assignedProjectId: worker.assignedProjectId === targetAllocationProject.id ? undefined : worker.assignedProjectId,
      allocationSource: 'Manual'
    };

    const nextContractorsList = localContractors.map(c => (c.id === worker.id ? updatedWorker : c));
    setLocalContractors(nextContractorsList);

    if (onUpdateContractor) {
      onUpdateContractor(updatedWorker);
    }
    if (onUpdateContractors) {
      onUpdateContractors(nextContractorsList);
    }
    if (onUpdateProject) {
      onUpdateProject(targetAllocationProject.id, {
        assignedContractorIds: nextIds,
        assignedWorkersCount: nextIds.length
      });
    }

    appendAuditEntry({
      workerId: worker.id,
      workerName: worker.name,
      trade: worker.tradeType || worker.specialty || 'General Trade',
      projectId: targetAllocationProject.id,
      projectName: targetAllocationProject.name,
      action: 'Unassigned',
      source: 'Manual',
      hadScheduleConflict: false,
      overrideNote: crewOverrideNotes[worker.id] || worker.manualOverrideNote,
      isLockedByAdmin: isWorkerLockedByAdmin(worker),
      dailyRate: getWorkerDailyRate(worker)
    });

    fetch(`/api/projects/${targetAllocationProject.id}/workers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId: worker.id, action: 'remove' })
    }).catch(() => {});

    setLastAllocationFeedback({
      workerId: worker.id,
      workerName: worker.name,
      source: 'Manual',
      action: 'unassigned'
    });
    setTimeout(() => {
      setLastAllocationFeedback(prev => (prev?.workerId === worker.id ? null : prev));
    }, 3500);

    notify(`Unassigned ${worker.name} from "${targetAllocationProject.name}".`);
  };

  // Dismiss a single AI suggestion from the assistant card
  const handleDismissWorkforceStagedSuggestion = (workerId: string) => {
    setDismissedWorkforceStagedIds(prev => (prev.includes(workerId) ? prev : [...prev, workerId]));
  };

  // Derived Live Workbench Metrics (Assigned Crew, Active Sites, Site Utilization, Live Labor Budget Burn)
  const assignedCrewWorkers = useMemo(
    () => localContractors.filter(c => crewSelectedWorkerIds.includes(c.id)),
    [localContractors, crewSelectedWorkerIds]
  );

  const unassignedRosterWorkers = useMemo(
    () =>
      localContractors.filter(c => {
        if (crewSelectedWorkerIds.includes(c.id)) return false;
        if (!rosterSearchQuery.trim()) return true;
        const q = rosterSearchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.tradeType || '').toLowerCase().includes(q) ||
          (c.specialty || '').toLowerCase().includes(q) ||
          (c.roleTitle || '').toLowerCase().includes(q)
        );
      }),
    [localContractors, crewSelectedWorkerIds, rosterSearchQuery]
  );

  const activeSitesCount = useMemo(
    () => projects.filter(p => p.status !== 'COMPLETED' && p.status !== 'HANDED_OVER').length,
    [projects]
  );

  // Live deployed field workers across all active projects
  const liveDeployedWorkerIds = useMemo(() => {
    const deployedSet = new Set<string>();
    projects.forEach(p => {
      if (p.status === 'COMPLETED' || p.status === 'HANDED_OVER') return;
      const ids = getProjectAssignedIds(p);
      ids.forEach(id => deployedSet.add(id));
    });
    localContractors.forEach(c => {
      const site = (c.activeProjectSite || '').trim().toLowerCase();
      if (site && !site.includes('standby') && !site.includes('unassigned')) {
        deployedSet.add(c.id);
      }
    });
    return deployedSet;
  }, [projects, localProjectAssignments, localContractors]);

  const liveTotalManpower = useMemo(() => {
    return Math.max(localContractors.length, totalManpower || 0);
  }, [localContractors, totalManpower]);

  const liveSiteUtilizationPct = useMemo(() => {
    if (liveTotalManpower <= 0) return 0;
    return Math.min(100, Math.round((liveDeployedWorkerIds.size / liveTotalManpower) * 100));
  }, [liveDeployedWorkerIds, liveTotalManpower]);

  const workbenchLaborBurn = useMemo(() => {
    const dailyCombinedRate = assignedCrewWorkers.reduce((sum, w) => sum + getWorkerDailyRate(w), 0);
    const startMs = targetAllocationProject?.startDate ? new Date(targetAllocationProject.startDate).getTime() : NaN;
    const endMs = targetAllocationProject?.targetHandoverDate ? new Date(targetAllocationProject.targetHandoverDate).getTime() : NaN;
    const rawDays = !isNaN(startMs) && !isNaN(endMs) && endMs > startMs
      ? Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)))
      : 30;
    const workingDays = Math.max(1, Math.round(rawDays * (26 / 30)));
    const projectedCost = dailyCombinedRate * workingDays;
    const contractBudget = Number(targetAllocationProject?.budget || 0);
    const burnPct = contractBudget > 0 ? Math.round((projectedCost / contractBudget) * 100) : 0;
    const isHighBurn = contractBudget > 0 && burnPct > 40;
    return {
      dailyCombinedRate,
      workingDays,
      projectedCost,
      contractBudget,
      burnPct,
      isHighBurn
    };
  }, [assignedCrewWorkers, targetAllocationProject]);

  // Live Reactive Analytics Data for Tab 2 (Connected directly to live project & contractor state)
  const liveProjectLaborChartData = useMemo(() => {
    if (projects.length === 0) return projectLaborChartData;
    return projects.map(p => {
      const assignedIds = getProjectAssignedIds(p);
      const dailyBurn = assignedIds.reduce((sum, id) => {
        const w = localContractors.find(c => c.id === id);
        return sum + (w ? getWorkerDailyRate(w) : 0);
      }, 0);
      const shortName = p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name;
      return {
        name: shortName,
        fullName: p.name,
        workers: assignedIds.length,
        dailyBurn,
        progress: p.progress ?? 0,
        status: (p.status || 'IN_PROGRESS').replace('_', ' ')
      };
    });
  }, [projects, localProjectAssignments, localContractors, projectLaborChartData]);

  const liveTradeManpowerChartData = useMemo(() => {
    if (localContractors.length === 0) return tradeManpowerChartData;
    const tradePalette = ['#14b8a6', '#38bdf8', '#f59e0b', '#818cf8', '#ec4899', '#10b981', '#f97316', '#a855f7'];
    const stats: Record<string, { count: number; dailyBurn: number }> = {};
    localContractors.forEach(c => {
      const rawTrade = (c.tradeType || c.specialty || c.roleTitle || 'General Artisan').trim();
      if (!stats[rawTrade]) {
        stats[rawTrade] = { count: 0, dailyBurn: 0 };
      }
      stats[rawTrade].count += 1;
      stats[rawTrade].dailyBurn += getWorkerDailyRate(c);
    });
    return Object.entries(stats)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data], idx) => ({
        name,
        value: data.count,
        dailyBurn: data.dailyBurn,
        color: tradePalette[idx % tradePalette.length]
      }));
  }, [localContractors, tradeManpowerChartData]);

  const liveInHouseAndOutsourced = useMemo(() => {
    if (localContractors.length === 0) {
      return {
        inHouse: inHouseCount,
        outsourced: outsourcedCount,
        inHouseDailyBurn: 0,
        outsourcedDailyBurn: 0,
        ratio: Math.round((inHouseCount / Math.max(1, inHouseCount + outsourcedCount)) * 100),
        chartData: employmentMixChartData
      };
    }
    let inHouse = 0;
    let outsourced = 0;
    let inHouseDailyBurn = 0;
    let outsourcedDailyBurn = 0;
    localContractors.forEach(c => {
      const empType = (c.employmentType || '').toLowerCase();
      const companyStr = (c.company || '').toLowerCase();
      const rate = getWorkerDailyRate(c);
      if (
        empType.includes('in-house') ||
        empType.includes('in_house') ||
        empType.includes('regular') ||
        companyStr.includes('ctvill') ||
        isIndividualStaffOrEngineer(c)
      ) {
        inHouse += 1;
        inHouseDailyBurn += rate;
      } else {
        outsourced += 1;
        outsourcedDailyBurn += rate;
      }
    });
    const total = Math.max(1, inHouse + outsourced);
    return {
      inHouse,
      outsourced,
      inHouseDailyBurn,
      outsourcedDailyBurn,
      ratio: Math.round((inHouse / total) * 100),
      chartData: [
        { name: 'LDM In-House Core', value: inHouse, dailyBurn: inHouseDailyBurn, color: '#10b981' },
        { name: 'Outsourced Trade Partners', value: outsourced, dailyBurn: outsourcedDailyBurn, color: '#f59e0b' }
      ]
    };
  }, [localContractors, inHouseCount, outsourcedCount, employmentMixChartData]);

  // Filter out non-artisan personnel (office staff, executives, architects, PMs, engineers, permanent safety inspectors)
  const isNonArtisanStaff = (rec: AIManpowerRecommendation) => {
    const role = (rec.tradeType || '').toLowerCase();
    const name = (rec.workerName || rec.contractorName || '').toLowerCase();
    return (
      name.includes('builders') ||
      name.includes('corporation') ||
      name.includes('inc.') ||
      role.includes('safety') ||
      role.includes('ehso') ||
      role.includes('inspector') ||
      role.includes('architect') ||
      role.includes('designer') ||
      role.includes('project manager') ||
      role.includes('pm') ||
      role.includes('construction manager') ||
      role.includes('site manager') ||
      role.includes('site engineer') ||
      role.includes('project engineer') ||
      role.includes('engineer') ||
      role.includes('coordinator') ||
      role.includes('consultant') ||
      (role.includes('officer') && !role.includes('artisan')) ||
      name.includes('coo') ||
      name.includes('president') ||
      name.includes('hr') ||
      name.includes('finance')
    );
  };

  // Sync recommendationQueue and appliedTransfersHistory whenever aiRecommendations or admin locks change
  useEffect(() => {
    if (aiRecommendations && aiRecommendations.length > 0) {
      const isRecWorkerLocked = (r: AIManpowerRecommendation) => {
        const wId = r.workerId || r.contractorId;
        const wName = (r.workerName || r.contractorName || '').trim().toLowerCase();
        const matched = localContractors.find(
          c => c.id === wId || c.name.trim().toLowerCase() === wName
        );
        return matched ? isWorkerLockedByAdmin(matched) : false;
      };
      const pending = aiRecommendations.filter(
        r => !r.applied && !r.dismissed && !isNonArtisanStaff(r) && !isRecWorkerLocked(r)
      );
      setRecommendationQueue(pending);
      const applied = aiRecommendations.filter(r => r.applied && !r.dismissed && !isNonArtisanStaff(r));
      setAppliedTransfersHistory(applied);
    }
  }, [aiRecommendations, localContractors, crewOverrideNotes, crewAdminLocks]);

  const inHouseRatio = liveInHouseAndOutsourced.ratio;

  const isDedicatedAuditView = hideTabs;

  return (
    <div className="space-y-6">

      {/* Top Header & Tab Switcher - Hidden in dedicated audit view */}
      {!isDedicatedAuditView && (
        <>
          {/* Top Header */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Labor Workforce &amp; Artisan Trades
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Operational Dispatch Workbench, non-blocking AI decision support, conflict override auditing, and live workforce analytics.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-slate-900 border border-slate-800 text-teal-300 text-xs font-mono px-3 py-1.5 rounded-lg font-medium whitespace-nowrap">
                {liveDeployedWorkerIds.size} / {liveTotalManpower} Deployed ({liveSiteUtilizationPct}% Util.)
              </span>
            </div>
          </div>

          {/* Top-Level Tab Switcher (Tab 1: Dispatch Workbench | Tab 2: Workforce Analytics & Reports | Personnel Directory) */}
          <div className={`flex items-center gap-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-2 overflow-x-auto`}>
            {availableTabs.map(tab => {
              const isActive = activeSubTab === tab.id;
              const IconComponent = tab.icon;
              const count =
                tab.id === 'workbench'
                  ? assignedCrewWorkers.length
                  : tab.id === 'directory'
                    ? liveTotalManpower
                    : undefined;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold font-mono transition-all cursor-pointer whitespace-nowrap ${isActive
                      ? isDark
                        ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-xs'
                        : 'bg-slate-900 text-white shadow-xs border border-slate-900'
                      : isDark
                        ? 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                    }`}
                >
                  <IconComponent className={`w-4 h-4 ${isActive ? (isDark ? 'text-teal-400' : 'text-amber-400') : (isDark ? 'text-slate-400' : 'text-slate-500')}`} />
                  <span>{tab.label}</span>
                  {count !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive
                        ? isDark
                          ? 'bg-teal-500/25 text-teal-200'
                          : 'bg-slate-800 text-slate-200'
                        : isDark
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PERSONNEL DIRECTORY & ROSTER                                   */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'directory' && (
        <div className="animate-fadeIn">
          <WorkforceMessengerRoster
            contractors={localContractors}
            manpowerAudits={manpowerAudits}
            projects={projects}
            userRole={userRole}
            isAdmin={isAdmin}
            onRegisterClick={onRegisterWorkerClick}
            onVerifyRollCall={onVerifyRollCall}
            onDeleteContractor={onDeleteContractor}
            onUpdateContractor={onUpdateContractor}
            onUpdateContractors={onUpdateContractors}
            onUpdateProject={onUpdateProject}
            onSwitchToAllocationTab={(workerId?: string) => {
              setActiveSubTab('workbench');
              if (workerId) setQuickAddWorkerId(workerId);
            }}
            notify={notify}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: DISPATCH WORKBENCH (OPERATIONAL EXECUTION ONLY)        */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'workbench' && (
        <div className="space-y-6 animate-fadeIn">
          {/* ============================================================= */}
          {/* UNIFIED TWO-PANEL RESOURCE ALLOCATION WORKBENCH               */}
          {/* ============================================================= */}
          <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-5">
            {/* Top Bar: Clean Project Selector Dropdown + Quick Status Metrics */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              {/* Project Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 flex-1 min-w-0">
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="p-2 bg-teal-500/10 border border-teal-500/25 rounded-xl text-teal-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      Dispatch Workbench
                    </span>
                    <h4 className="text-sm font-semibold text-white">
                      {targetAllocationProject?.name || 'Active Project Roster'}
                    </h4>
                  </div>
                </div>

                <div className="sm:max-w-xs w-full">
                  <select
                    value={targetAllocationProject?.id || ''}
                    onChange={(e) => {
                      setSelectedWorkbenchProjectId(e.target.value);
                      setDismissedWorkforceStagedIds([]);
                      setLastAllocationFeedback(null);
                    }}
                    className="w-full bg-slate-900/80 border border-slate-800 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs font-medium text-white focus:outline-none cursor-pointer transition"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.status.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subtle Inline Micro-Feedback Confirmation Pill */}
                {lastAllocationFeedback && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium animate-fadeIn shrink-0 whitespace-nowrap ${
                      lastAllocationFeedback.action === 'assigned'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {lastAllocationFeedback.action === 'assigned'
                        ? `${lastAllocationFeedback.workerName} assigned (${lastAllocationFeedback.source === 'AI' ? 'Source: AI' : 'Source: Manual'})`
                        : `${lastAllocationFeedback.workerName} unassigned`}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Status Metrics: Total Headcount & Site Utilization, Active Sites, Labor Budget Burn */}
              <div className="grid grid-cols-3 gap-3 shrink-0">
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl px-3.5 py-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block whitespace-nowrap">
                    Headcount &amp; Util.
                  </span>
                  <div className="text-sm font-semibold text-white flex items-baseline gap-1.5 mt-0.5 whitespace-nowrap">
                    <span className="text-teal-400">{assignedCrewWorkers.length}</span>
                    <span className="text-xs text-slate-400 font-normal">
                      / {liveTotalManpower} ({liveSiteUtilizationPct}%)
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl px-3.5 py-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block whitespace-nowrap">
                    Active Sites
                  </span>
                  <div className="text-sm font-semibold text-white flex items-baseline gap-1.5 mt-0.5 whitespace-nowrap">
                    <span className="text-amber-400">{activeSitesCount}</span>
                    <span className="text-xs text-slate-400 font-normal">Commercial</span>
                  </div>
                </div>

                <div
                  className={`rounded-xl px-3.5 py-2 border ${
                    workbenchLaborBurn.isHighBurn
                      ? 'bg-amber-950/25 border-amber-500/30'
                      : 'bg-slate-900/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase text-slate-400 whitespace-nowrap">
                      Labor Budget Burn
                    </span>
                    {workbenchLaborBurn.contractBudget > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap ${
                          workbenchLaborBurn.isHighBurn
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {workbenchLaborBurn.burnPct}%
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-white flex items-baseline gap-1 mt-0.5 whitespace-nowrap">
                    <span>₱{workbenchLaborBurn.dailyCombinedRate.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 font-normal">/day</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Non-Blocking High Labor Burn Advisory Banner (When > 40% of Contract Budget) */}
            {workbenchLaborBurn.isHighBurn && (
              <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Advisory: Selected crew daily rate (₱{workbenchLaborBurn.dailyCombinedRate.toLocaleString()}/day • est. ₱{workbenchLaborBurn.projectedCost.toLocaleString()} over {workbenchLaborBurn.workingDays} workdays) is {workbenchLaborBurn.burnPct}% of contract budget (₱{workbenchLaborBurn.contractBudget.toLocaleString()}).
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/15 text-amber-300 shrink-0 whitespace-nowrap">
                  Non-Blocking Advisory
                </span>
              </div>
            )}

            {/* Main View (Split Layout: Left Column = Assigned Crew, Available Pool & Audit Trail; Right Column = Sticky AI Advisory & Quick Add) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* LEFT COLUMN: Assigned Crew, Available Workforce Pool & Audit Trail */}
              <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-5">
                {/* Assigned Crew Section */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-teal-400" />
                        <h5 className="text-sm font-semibold text-white">
                          Assigned Crew — {targetAllocationProject?.name || 'Selected Project'}
                        </h5>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-teal-500/10 border border-teal-500/25 text-teal-300 whitespace-nowrap">
                          {assignedCrewWorkers.length} Assigned
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Schedule window: {targetAllocationProject?.startDate || 'TBD'} → {targetAllocationProject?.targetHandoverDate || 'TBD'}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Crew Card Rows */}
                  {assignedCrewWorkers.length === 0 ? (
                    <div className="py-8 px-4 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20 space-y-1.5">
                      <Users className="w-6 h-6 text-slate-500 mx-auto" />
                      <div className="text-sm font-semibold text-white">
                        0 Workers Currently Assigned to {targetAllocationProject?.name || 'This Project'}
                      </div>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Select a worker from the Available Workforce Pool below or click <span className="text-amber-300 font-medium">[Apply Recommendation]</span> in the ✨ AI Crew Assistant.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {assignedCrewWorkers.map(worker => {
                        const rate = getWorkerDailyRate(worker);
                        const avail = getWorkerAvailabilityAdvisory(worker, targetAllocationProject);
                        const isLocked = isWorkerLockedByAdmin(worker);
                        const overrideNote = crewOverrideNotes[worker.id] ?? worker.manualOverrideNote ?? '';
                        const sourceBadge = crewAllocationSourceMap[worker.id] === 'AI' && !isLocked ? 'Source: AI' : 'Source: Manual';
                        const isNoteOpen = activeWorkforceNoteEditorId === worker.id || overrideNote.trim().length > 0;
                        const isJustAssigned =
                          lastAllocationFeedback?.workerId === worker.id &&
                          lastAllocationFeedback?.action === 'assigned';

                        return (
                          <div
                            key={worker.id}
                            className={`bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 rounded-xl p-3.5 transition space-y-2.5 overflow-hidden ${
                              isJustAssigned ? 'ring-1 ring-emerald-500/40 bg-emerald-950/15' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              {/* Primary & Secondary Typography */}
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                                      {worker.name}
                                    </span>
                                    <span
                                      title={avail.badgeText}
                                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border truncate max-w-[200px] sm:max-w-xs ${
                                        avail.isOverlapping
                                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                      }`}
                                    >
                                      {avail.badgeText}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 border border-slate-700/80 text-slate-300 whitespace-nowrap">
                                      {sourceBadge}
                                    </span>
                                    {overrideNote.trim().length > 0 && (
                                      <span
                                        title={`Override: ${overrideNote}`}
                                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300 truncate max-w-[200px] sm:max-w-xs"
                                      >
                                        Override: {overrideNote}
                                      </span>
                                    )}
                                    {isJustAssigned && (
                                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">
                                        ✓ Added
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-xs text-slate-400 flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className="truncate max-w-[200px] sm:max-w-xs">
                                      {worker.tradeType || worker.specialty || worker.roleTitle || 'General Trade'}
                                    </span>
                                    <span>•</span>
                                    <span className="whitespace-nowrap font-mono text-slate-300">
                                      ₱{rate.toLocaleString()}/day
                                    </span>
                                    {worker.company && (
                                      <>
                                        <span>•</span>
                                        <span className="truncate max-w-[200px] sm:max-w-xs">{worker.company}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Actions: Lock/Note & Clean [Unassign] Button */}
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleToggleWorkforceAdminLock(worker);
                                    setActiveWorkforceNoteEditorId(prev => (prev === worker.id ? null : worker.id));
                                  }}
                                  title={isLocked ? 'Locked by Admin (isLockedByAdmin). AI skips this worker.' : 'Lock assignment or add override note'}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                                    isLocked
                                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                                      : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>{isLocked ? 'Locked' : 'Lock'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUnassignWorkerFromProject(worker)}
                                  className="px-3 py-1 rounded-lg bg-slate-950/80 hover:bg-rose-950/70 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 text-xs font-medium transition cursor-pointer whitespace-nowrap"
                                >
                                  Unassign
                                </button>
                              </div>
                            </div>

                            {/* Non-blocking Admin Override Note Input + Quick Presets */}
                            {isNoteOpen && (
                              <div className="pt-2 border-t border-slate-800/60 space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <input
                                    type="text"
                                    value={overrideNote}
                                    onChange={(e) => handleUpdateWorkforceOverrideNote(worker, e.target.value)}
                                    placeholder="Manual override note (sets isLockedByAdmin = true)..."
                                    className="flex-1 min-w-[180px] bg-slate-950/90 border border-slate-800 focus:border-amber-500/60 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                                  />
                                  {isLocked && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 border border-rose-500/30 text-rose-300 shrink-0 whitespace-nowrap">
                                      isLockedByAdmin
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-mono uppercase text-slate-500">Presets:</span>
                                  {OVERRIDE_REASON_PRESETS.map(preset => (
                                    <button
                                      key={preset}
                                      type="button"
                                      title={preset}
                                      onClick={() => handleUpdateWorkforceOverrideNote(worker, preset)}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition cursor-pointer truncate max-w-[200px] sm:max-w-xs ${
                                        overrideNote === preset
                                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                          : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200'
                                      }`}
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Available Workforce Pool Section */}
                <div className="pt-4 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h6 className="text-sm font-semibold text-white">
                        Available Workforce Pool ({unassignedRosterWorkers.length})
                      </h6>
                      <p className="text-xs text-slate-400">
                        Manually assign artisans from the company roster (schedule conflicts remain non-blocking)
                      </p>
                    </div>
                    <input
                      type="text"
                      value={rosterSearchQuery}
                      onChange={(e) => setRosterSearchQuery(e.target.value)}
                      placeholder="Filter unassigned by name or trade..."
                      className="w-full sm:w-64 bg-slate-900/80 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="max-h-[500px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                    {unassignedRosterWorkers.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                        No matching unassigned workers found.
                      </div>
                    ) : (
                      unassignedRosterWorkers.map(worker => {
                        const rate = getWorkerDailyRate(worker);
                        const avail = getWorkerAvailabilityAdvisory(worker, targetAllocationProject);
                        const selectedConflictReason =
                          poolPendingOverrideReasons[worker.id] || OVERRIDE_REASON_PRESETS[0];

                        return (
                          <div
                            key={worker.id}
                            className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-2 flex-wrap transition overflow-hidden"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                                  {worker.name}
                                </span>
                                <span
                                  title={avail.badgeText}
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium border truncate max-w-[200px] sm:max-w-xs ${
                                    avail.isOverlapping
                                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  }`}
                                >
                                  {avail.badgeText}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                                <span className="truncate max-w-[200px] sm:max-w-xs">
                                  {worker.tradeType || worker.specialty || 'General Trade'}
                                </span>
                                <span>•</span>
                                <span className="whitespace-nowrap font-mono text-slate-300">
                                  ₱{rate.toLocaleString()}/day
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              {avail.isOverlapping && (
                                <select
                                  value={selectedConflictReason}
                                  onChange={(e) =>
                                    setPoolPendingOverrideReasons(prev => ({
                                      ...prev,
                                      [worker.id]: e.target.value
                                    }))
                                  }
                                  title="Non-blocking conflict override reason (saved to audit trail & sets isLockedByAdmin)"
                                  className="bg-slate-950 border border-amber-500/30 rounded-lg px-2 py-1 text-[11px] text-amber-200 focus:outline-none cursor-pointer truncate max-w-[200px] sm:max-w-xs"
                                >
                                  {OVERRIDE_REASON_PRESETS.map(preset => (
                                    <option key={preset} value={preset}>
                                      {preset}
                                    </option>
                                  ))}
                                </select>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  handleAssignWorkerToProject(
                                    worker,
                                    'Manual',
                                    undefined,
                                    avail.isOverlapping ? selectedConflictReason : undefined
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-600 text-teal-300 hover:text-white border border-teal-500/30 text-xs font-medium transition cursor-pointer shrink-0 flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Assign</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Allocation & Conflict Override Audit Trail */}
                <div className="pt-4 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ClipboardList className="w-4 h-4 text-amber-400" />
                      <h6 className="text-sm font-semibold text-white">
                        Allocation &amp; Conflict Override Audit Trail
                      </h6>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 border border-slate-700/80 text-slate-300 whitespace-nowrap">
                        {allocationAuditTrail.length} Records
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                      Active Role: <strong className="text-teal-300">{currentActorRole}</strong>
                    </span>
                  </div>

                  {allocationAuditTrail.length === 0 ? (
                    <div className="py-4 px-3.5 text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                      All manual assignments, schedule conflict overrides (capturing exact timestamp, administrator role, and justification note such as <span className="text-amber-300">Executive Approval / Urgent Pull-Out</span>), and AI applications are recorded here in real time.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto pr-1 custom-scrollbar border border-slate-800/80 rounded-xl bg-slate-950/60">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800/90 bg-slate-900/80 text-[10px] font-mono uppercase text-slate-400">
                            <th className="py-2 px-3 whitespace-nowrap">Timestamp</th>
                            <th className="py-2 px-3 whitespace-nowrap">Admin Role</th>
                            <th className="py-2 px-3">Worker &amp; Site</th>
                            <th className="py-2 px-3">Action &amp; Justification Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {allocationAuditTrail.map(entry => (
                            <tr key={entry.id} className="hover:bg-slate-900/50 transition">
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap align-top">
                                {entry.timestamp}
                              </td>
                              <td className="py-2.5 px-3 align-top whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-teal-500/10 border border-teal-500/25 text-teal-300 whitespace-nowrap">
                                  {entry.actorRole}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 align-top">
                                <div className="font-semibold text-white truncate max-w-[180px] sm:max-w-[220px]">
                                  {entry.workerName}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className="truncate max-w-[160px]">{entry.projectName}</span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-300 whitespace-nowrap">
                                    ₱{entry.dailyRate.toLocaleString()}/day
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 align-top space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap ${
                                      entry.action === 'Conflict Override'
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                        : entry.action === 'Unassigned'
                                          ? 'bg-slate-800 border-slate-700 text-slate-300'
                                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    }`}
                                  >
                                    {entry.action}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 border border-slate-700/80 text-slate-300 whitespace-nowrap">
                                    Source: {entry.source}
                                  </span>
                                  {entry.isLockedByAdmin && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 border border-rose-500/30 text-rose-300 whitespace-nowrap">
                                      isLockedByAdmin
                                    </span>
                                  )}
                                </div>
                                {entry.overrideNote ? (
                                  <div
                                    title={entry.overrideNote}
                                    className="text-[11px] text-amber-300/90 font-mono truncate max-w-[200px] sm:max-w-xs"
                                  >
                                    Note: &ldquo;{entry.overrideNote}&rdquo;
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    Standard allocation logged
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Sticky AI Crew Assistant & Quick Add */}
              <div className="lg:col-span-5 sticky top-6 self-start space-y-4">
                {/* Quick Manual Add Card */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-teal-400" />
                      <span>Quick Manual Assign</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <select
                      value={quickAddWorkerId}
                      onChange={(e) => setQuickAddWorkerId(e.target.value)}
                      className="flex-1 min-w-0 bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer truncate"
                    >
                      <option value="">Select worker from roster...</option>
                      {localContractors
                        .filter(c => !crewSelectedWorkerIds.includes(c.id))
                        .map(c => {
                          const avail = getWorkerAvailabilityAdvisory(c, targetAllocationProject);
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name} — {c.tradeType || c.specialty || 'Artisan'} (₱{getWorkerDailyRate(c).toLocaleString()}/day • {avail.isOverlapping ? `Active on ${avail.overlappingProjects[0]}` : 'Available'})
                            </option>
                          );
                        })}
                    </select>
                    <button
                      type="button"
                      disabled={!quickAddWorkerId}
                      onClick={() => {
                        const chosen = localContractors.find(c => c.id === quickAddWorkerId);
                        if (chosen) {
                          const avail = getWorkerAvailabilityAdvisory(chosen, targetAllocationProject);
                          handleAssignWorkerToProject(
                            chosen,
                            'Manual',
                            undefined,
                            avail.isOverlapping ? quickAddOverrideReason : undefined
                          );
                          setQuickAddWorkerId('');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-xs font-semibold transition cursor-pointer shrink-0 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Assign</span>
                    </button>
                  </div>

                  {/* If selected quick-add worker has an active schedule conflict, offer non-blocking override reason */}
                  {(() => {
                    const chosen = localContractors.find(c => c.id === quickAddWorkerId);
                    if (!chosen) return null;
                    const avail = getWorkerAvailabilityAdvisory(chosen, targetAllocationProject);
                    if (!avail.isOverlapping) return null;
                    return (
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 text-xs">
                        <span
                          title={avail.badgeText}
                          className="text-amber-300 text-[11px] truncate max-w-[200px] sm:max-w-xs"
                        >
                          {avail.badgeText}:
                        </span>
                        <select
                          value={quickAddOverrideReason}
                          onChange={(e) => setQuickAddOverrideReason(e.target.value)}
                          className="flex-1 min-w-[160px] bg-slate-950 border border-amber-500/30 rounded-lg px-2.5 py-1 text-[11px] text-amber-200 focus:outline-none cursor-pointer truncate max-w-[200px] sm:max-w-xs"
                        >
                          {OVERRIDE_REASON_PRESETS.map(preset => (
                            <option key={preset} value={preset}>
                              {preset}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>

                {/* Dedicated AI Assistant Sidebar Card */}
                <div className="border border-amber-500/30 bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl overflow-hidden shadow-lg">
                  <div className="p-4 flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-sm font-semibold text-white">✨ AI Crew Assistant</h5>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/15 border border-amber-500/30 text-amber-300 whitespace-nowrap">
                            {workforceAiCrewSuggestions.length} Matches
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          Multi-skill recommendations • Respects admin locks
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDismissedWorkforceStagedIds([]);
                          setIsAiAssistantOpen(true);
                          handleTriggerAiScan();
                        }}
                        disabled={isAiScanning}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                        title="Refresh multi-skill AI recommendations"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isAiScanning ? 'animate-spin' : ''}`} />
                        <span>{isAiScanning ? 'Scanning...' : 'Scan'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsAiAssistantOpen(prev => !prev)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
                        title={isAiAssistantOpen ? 'Collapse AI Crew Assistant' : 'Expand AI Crew Assistant'}
                      >
                        {isAiAssistantOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isAiAssistantOpen && (
                    <div className="p-4 space-y-3 animate-fadeIn">
                      {/* Subtle AI Recommendation Sorting Toggle */}
                      <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-950/70 border border-slate-800/80 rounded-xl px-3 py-2">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                          Sort By:
                        </span>
                        <div className="inline-flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setAiSortMode('match')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                              aiSortMode === 'match'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                          >
                            Highest Match
                          </button>
                          <button
                            type="button"
                            onClick={() => setAiSortMode('cost')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                              aiSortMode === 'cost'
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                          >
                            Lowest Cost (₱/day)
                          </button>
                        </div>
                      </div>

                      {aiScanMessage && (
                        <div className="bg-slate-900/90 border border-amber-500/30 text-amber-200 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{aiScanMessage}</span>
                        </div>
                      )}

                      {workforceAiCrewSuggestions.length === 0 ? (
                        <div className="py-8 px-4 text-center text-xs text-slate-400 space-y-2 border-2 border-dashed border-slate-800/80 rounded-xl bg-slate-900/30">
                          <Bot className="w-6 h-6 text-amber-400/80 mx-auto" />
                          <div className="text-sm font-semibold text-white">All optimal candidates are assigned</div>
                          <button
                            type="button"
                            onClick={() => setDismissedWorkforceStagedIds([])}
                            className="text-xs text-amber-300 hover:text-amber-200 underline cursor-pointer"
                          >
                            Reset dismissed suggestions
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {workforceAiCrewSuggestions.map(({ worker, rate, avail, score, matchingAiRec, fourFactorBreakdown, rationale }) => (
                            <div
                              key={worker.id}
                              className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 rounded-xl p-3.5 transition space-y-2.5 overflow-hidden"
                            >
                              {/* Top Row: Primary Name, Secondary Metadata, Score Pill */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                                      {worker.name}
                                    </span>
                                    <span
                                      title={avail.badgeText}
                                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border truncate max-w-[200px] sm:max-w-xs ${
                                        avail.isOverlapping
                                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                      }`}
                                    >
                                      {avail.badgeText}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                                    <span className="truncate max-w-[200px] sm:max-w-xs">
                                      {worker.tradeType || worker.specialty || 'General Trade'}
                                    </span>
                                    <span>•</span>
                                    <span className="whitespace-nowrap font-mono text-slate-300">
                                      ₱{rate.toLocaleString()}/day
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/15 border border-amber-500/30 text-amber-300 whitespace-nowrap">
                                    {score} / 100 Match
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDismissWorkforceStagedSuggestion(worker.id)}
                                    className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition cursor-pointer"
                                    title="Dismiss suggestion"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Clean & Compact 4-Factor Breakdown + Rationale */}
                              <div className="bg-slate-950/60 border border-slate-800/70 rounded-lg px-3 py-2 space-y-1">
                                <div className="text-[11px] font-mono text-slate-400">
                                  {fourFactorBreakdown}
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                  {rationale}
                                </p>
                              </div>

                              {/* Action Footer */}
                              <div className="flex items-center justify-end gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleAssignWorkerToProject(worker, 'AI', matchingAiRec)}
                                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Apply Recommendation</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: WORKFORCE ANALYTICS & REPORTS (EXECUTIVE VIEW)         */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Executive Analytics KPI Cards (Live Synced) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">TOTAL FIELD PERSONNEL</span>
                <HardHat className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                <span>{liveTotalManpower}</span>
                <span className="text-xs text-slate-400 font-normal">Laborers</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">{localContractors.length} Registered Entities</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">IN-HOUSE CORE STAFF</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                <span>{liveInHouseAndOutsourced.inHouse}</span>
                <span className="text-xs text-slate-400 font-normal">Permanent</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">{inHouseRatio}% of Total Workforce</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">OUTSOURCED CREWS</span>
                <Building className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                <span>{liveInHouseAndOutsourced.outsourced}</span>
                <span className="text-xs text-slate-400 font-normal">Contractors</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">Specialized Trade Partners</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">ACTIVE SITE DEPLOYMENTS</span>
                <Award className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                <span>{liveDeployedWorkerIds.size}</span>
                <span className="text-xs text-slate-400 font-normal">Active Workers</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">{liveSiteUtilizationPct}% Fleet Utilization</span>
            </div>
          </div>

          {/* Visual Workforce Analytics Charts (Connected Directly to Live Project & Contractor State) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Chart 1: Manpower Headcount Deployed per Commercial Project */}
            <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'} border rounded-xl p-4.5 space-y-3`}>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-100'} pb-2.5`}>
                <div>
                  <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                    <BarChart3 className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-blue-600'}`} />
                    Labor Allocation by Commercial Site
                  </h4>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Live physical workforce distribution &amp; daily burn across active project sites</p>
                </div>
                <span className={`text-[10px] font-mono ${isDark ? 'bg-teal-950/80 border-teal-800/80 text-teal-300' : 'bg-blue-50 border-blue-200 text-blue-700'} border px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap`}>
                  {liveProjectLaborChartData.reduce((sum, p) => sum + p.workers, 0)} Total Assigned
                </span>
              </div>

              {liveProjectLaborChartData.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-4">
                  <Building className="w-8 h-8 text-slate-400" />
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>No Commercial Sites Registered</span>
                  <span className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Register a commercial project site to track labor distribution.</span>
                </div>
              ) : (
                <>
                  <div className="h-60 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReBarChart data={liveProjectLaborChartData} margin={{ top: 20, right: 16, left: -12, bottom: 42 }}>
                        <defs>
                          <linearGradient id="blueAllocBarGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isDark ? '#38bdf8' : '#0284c7'} stopOpacity={0.98} />
                            <stop offset="100%" stopColor={isDark ? '#0284c7' : '#0369a1'} stopOpacity={0.92} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={isDark ? '#1e293b' : '#e2e8f0'}
                          strokeOpacity={isDark ? 0.8 : 0.9}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          stroke={isDark ? '#64748b' : '#334155'}
                          tick={{ fill: isDark ? '#cbd5e1' : '#334155', fontSize: 11, fontWeight: 600 }}
                          tickLine={false}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          height={46}
                          dy={6}
                        />
                        <YAxis
                          stroke={isDark ? '#64748b' : '#334155'}
                          tick={{ fill: isDark ? '#94a3b8' : '#334155', fontSize: 11, fontWeight: 600 }}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className={`${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-xl'} border p-3 rounded-xl text-xs space-y-1 font-sans pointer-events-none select-none`}>
                                  <div className="font-bold">{data.fullName}</div>
                                  <div className={`${isDark ? 'text-teal-400' : 'text-blue-800'} font-mono font-bold`}>
                                    Personnel Headcount: {data.workers} Active Workers
                                  </div>
                                  <div className={`${isDark ? 'text-amber-400' : 'text-amber-800'} font-mono font-semibold`}>
                                    Cumulative Daily Burn: ₱{Number(data.dailyBurn || 0).toLocaleString()}/day
                                  </div>
                                  <div className={`${isDark ? 'text-slate-300' : 'text-slate-700'} font-mono`}>Completion: {data.progress}%</div>
                                  <div className="text-[10px] text-slate-500 font-mono uppercase">{data.status}</div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="workers" fill="url(#blueAllocBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={54}>
                          <LabelList
                            dataKey="workers"
                            position="top"
                            fill={isDark ? '#f8fafc' : '#0f172a'}
                            fontSize={11}
                            fontWeight={700}
                            formatter={(val: any) => `${val} pax`}
                          />
                        </Bar>
                      </ReBarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'} text-[11px]`}>
                    {liveProjectLaborChartData.slice(0, 4).map((p, i) => (
                      <div key={i} className={`${isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-50 border-slate-200/80'} border rounded-xl p-2.5 space-y-1`}>
                        <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} truncate text-xs`}>{p.name}</div>
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className={`${isDark ? 'text-teal-400' : 'text-blue-600'} font-bold`}>{p.workers} Crew</span>
                          <span className="text-amber-400">₱{Number(p.dailyBurn || 0).toLocaleString()}/d</span>
                        </div>
                        <div className={`w-full h-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} rounded-full overflow-hidden`}>
                          <div className={`h-full ${isDark ? 'bg-teal-400' : 'bg-blue-600'} rounded-full`} style={{ width: `${p.progress}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Chart 2: Engineering Specialty & Trade Distribution Donut */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-400" />
                    Trade Discipline &amp; Specialty Breakdown
                  </h4>
                  <p className="text-[11px] text-slate-400">Headcount &amp; cumulative daily labor burn across specialized trades</p>
                </div>
                <span className="text-[10px] font-mono bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                  {liveTradeManpowerChartData.length} Specialized Trades
                </span>
              </div>

              {liveTradeManpowerChartData.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-4">
                  <Users className="w-8 h-8 text-slate-600" />
                  <span className="text-xs font-semibold text-slate-400">No Trade Workers Registered</span>
                  <span className="text-[11px] text-slate-600">Click &quot;Register Worker&quot; above to add construction personnel and trades.</span>
                </div>
              ) : (
                (() => {
                  const totalCrew = liveTradeManpowerChartData.reduce((sum, item) => sum + (item.value || 0), 0);

                  return (
                    <>
                      <div className="h-52 w-full flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={liveTradeManpowerChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {liveTradeManpowerChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? '#0f172a' : '#ffffff'} strokeWidth={2} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const disciplineCount = Number(data.value || 0);
                                  const percentage = totalCrew > 0 ? Math.round((disciplineCount / totalCrew) * 100) : 0;
                                  return (
                                    <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1 font-sans pointer-events-none select-none">
                                      <div className="font-bold text-white">{data.name}</div>
                                      <div className="text-teal-400 font-mono font-bold">
                                        Personnel Headcount: {disciplineCount} Workers ({percentage}%)
                                      </div>
                                      <div className="text-amber-400 font-mono font-semibold">
                                        Cumulative Daily Burn: ₱{Number(data.dailyBurn || 0).toLocaleString()}/day
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </RePieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-black font-mono text-white">{totalCrew}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Total Crew</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                        {liveTradeManpowerChartData.slice(0, 6).map((item, idx) => {
                          const disciplineCount = Number(item.value || 0);
                          const percentage = totalCrew > 0 ? Math.round((disciplineCount / totalCrew) * 100) : 0;
                          return (
                            <div key={idx} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2 space-y-0.5">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-200 truncate">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                                <span className="truncate text-xs">{item.name}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                                <span>{percentage}% • <strong className="text-white">{item.value} Men</strong></span>
                                <span className="text-amber-400">₱{Number(item.dailyBurn || 0).toLocaleString()}/d</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()
              )}
            </div>

            {/* Chart 3: Employment Mix: In-House Core vs Outsourced Partners */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 shadow-xs space-y-3 lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    Workforce Structure: In-House vs Outsourced
                  </h4>
                  <p className="text-[11px] text-slate-400">Direct employee supervision vs subcontractor specialized capacity &amp; daily burn</p>
                </div>
                <span className="text-[10px] font-mono bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                  {localContractors.length} Total Workforce Entities
                </span>
              </div>

              {liveInHouseAndOutsourced.chartData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-4">
                  <Users className="w-8 h-8 text-slate-600" />
                  <span className="text-xs font-semibold text-slate-400">No Workforce Registered</span>
                  <span className="text-[11px] text-slate-600">Register in-house personnel or subcontracted trade partners to view organizational mix.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="h-48 w-full flex items-center justify-center relative md:col-span-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={liveInHouseAndOutsourced.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {liveInHouseAndOutsourced.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? '#0f172a' : '#ffffff'} strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const total = liveInHouseAndOutsourced.chartData.reduce((s, i) => s + i.value, 0);
                              const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0';
                              return (
                                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1 font-sans pointer-events-none select-none">
                                  <div className="font-bold text-white">{data.name}</div>
                                  <div className="text-teal-400 font-mono font-bold">
                                    Personnel Headcount: {data.value} ({pct}%)
                                  </div>
                                  <div className="text-amber-400 font-mono font-semibold">
                                    Cumulative Daily Burn: ₱{Number(data.dailyBurn || 0).toLocaleString()}/day
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </RePieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-black font-mono text-white">
                        {inHouseRatio}%
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">In-House</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:col-span-2 text-xs">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                          <span>LDM In-House Core</span>
                        </div>
                        <span className="text-[11px] font-mono text-amber-400">
                          ₱{liveInHouseAndOutsourced.inHouseDailyBurn.toLocaleString()}/day
                        </span>
                      </div>
                      <div className="text-2xl font-black font-mono text-white">{liveInHouseAndOutsourced.inHouse} Staff</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Permanent Engineers, Foremen &amp; Core Skilled Trades directly under company payroll.</p>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                          <span>Outsourced Trade Partners</span>
                        </div>
                        <span className="text-[11px] font-mono text-amber-400">
                          ₱{liveInHouseAndOutsourced.outsourcedDailyBurn.toLocaleString()}/day
                        </span>
                      </div>
                      <div className="text-2xl font-black font-mono text-white">{liveInHouseAndOutsourced.outsourced} Workers</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Specialized Subcontractors, MEPFS Teams &amp; Manpower Suppliers deployed per milestone.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LaborWorkforceArtisanTrades;
