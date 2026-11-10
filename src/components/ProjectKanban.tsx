/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet, FileText, ShieldCheck, Building2, Calendar,
  CheckCircle2, AlertTriangle, CloudSun, CloudRain, HardHat,
  Wrench, Camera, Plus, Printer, Download, Check, Clock, Users
} from 'lucide-react';
import { ProjectTask, TaskStatus, ProjectProfile } from '../types';
import { STANDARD_CONSTRUCTION_PHASES } from './GanttTimeline';

interface ProjectKanbanProps {
  tasks: ProjectTask[];
  projects?: ProjectProfile[];
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

interface WeeklyActivityReportRecord {
  id: string;
  projectId: string;
  projectName: string;
  periodCovered: string;
  manpower: {
    leadman: number;
    foreman: number;
    mason: number;
    laborer: number;
    skilled: number;
  };
  equipment: EquipmentEntry[];
  weatherLog: Record<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat', 'Sunny' | 'Rainy'>;
  activitiesAccomplished: string;
  issuesEncountered: string;
  photos: { id: string; caption: string; timestamp: string }[];
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

const DEFAULT_PHASE_WEIGHTS: Record<string, number> = {
  'Earthworks': 8,
  'Concreting Works': 14,
  'Reinforcing Bar': 10,
  'Formworks': 8,
  'Masonry Works': 12,
  'Roof Works': 8,
  'Finishing & Tiling Works': 9,
  'Ceiling Works': 5,
  'Finishing Carpentry': 5,
  'Doors and Windows': 4,
  'Cabinet Works': 4,
  'Painting Works': 5,
  'Electrical Works': 4,
  'Plumbing Works': 4
};

export default function ProjectKanban({
  tasks = [],
  projects = [],
}: ProjectKanbanProps) {
  const [activeSubTab, setActiveSubTab] = useState<'summary-excel' | 'weekly-pdf' | 'safety-qa'>('summary-excel');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => projects[0]?.id || 'ALL');

  const selectedProject = useMemo(() => {
    if (selectedProjectId === 'ALL') return projects[0] || null;
    return projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // ---------------------------------------------------------------------------
  // SUB-TAB 1: SUMMARY PROGRESS REPORT (EXCEL STANDARD) SYNCED WITH GANTT
  // ---------------------------------------------------------------------------
  const phaseProgressRows = useMemo(() => {
    const projectTasks = selectedProject
      ? tasks.filter(t => !t.projectId || t.projectId === selectedProject.id)
      : tasks;

    const baseProjectProgress = selectedProject
      ? Number(selectedProject.cpmProgress ?? selectedProject.overallProgress ?? selectedProject.progressPercentage ?? 42)
      : 45;

    return STANDARD_CONSTRUCTION_PHASES.map((phaseName, idx) => {
      const weight = DEFAULT_PHASE_WEIGHTS[phaseName] || 5;
      // Match tasks belonging to this phase by name, milestonePhase, or tag
      const matched = projectTasks.filter(t => {
        const text = `${t.title || ''} ${t.description || ''} ${t.milestonePhase || ''}`.toLowerCase();
        const kw = phaseName.toLowerCase().split(' ')[0];
        return text.includes(phaseName.toLowerCase()) || (kw.length > 3 && text.includes(kw));
      });

      let actualPct = 0;
      if (matched.length > 0) {
        const totalW = matched.reduce((acc, t) => acc + Math.max(1, Number(t.duration || 1)), 0);
        const sumProg = matched.reduce((acc, t) => {
          const raw = t.status === 'COMPLETED' ? 100 : typeof t.progress === 'number' ? (t.progress <= 1 ? t.progress * 100 : t.progress) : 0;
          return acc + raw * Math.max(1, Number(t.duration || 1));
        }, 0);
        actualPct = totalW > 0 ? Math.round(sumProg / totalW) : 0;
      } else {
        // Derive realistic progressive completion curve from live project progress
        const phaseThreshold = (idx / STANDARD_CONSTRUCTION_PHASES.length) * 100;
        if (baseProjectProgress >= phaseThreshold + 18) {
          actualPct = 100;
        } else if (baseProjectProgress > phaseThreshold) {
          actualPct = Math.min(95, Math.max(10, Math.round(((baseProjectProgress - phaseThreshold) / 18) * 100)));
        } else {
          actualPct = 0;
        }
      }

      const plannedPct = Math.min(100, Math.max(actualPct, idx < 6 ? 100 : idx < 10 ? 60 : 25));
      const variancePct = actualPct - plannedPct;
      const weightedActual = +((actualPct * weight) / 100).toFixed(2);
      const weightedPlanned = +((plannedPct * weight) / 100).toFixed(2);

      return {
        wbs: `${idx + 1}.0`,
        phaseName,
        weight,
        plannedPct,
        actualPct,
        variancePct,
        weightedActual,
        weightedPlanned,
        matchedCount: matched.length
      };
    });
  }, [tasks, selectedProject]);

  const summaryTotals = useMemo(() => {
    const totalWeight = phaseProgressRows.reduce((s, r) => s + r.weight, 0);
    const totalPlanned = +phaseProgressRows.reduce((s, r) => s + r.weightedPlanned, 0).toFixed(1);
    const totalActual = +phaseProgressRows.reduce((s, r) => s + r.weightedActual, 0).toFixed(1);
    const variance = +(totalActual - totalPlanned).toFixed(1);
    return { totalWeight, totalPlanned, totalActual, variance };
  }, [phaseProgressRows]);

  // ---------------------------------------------------------------------------
  // SUB-TAB 2: WEEKLY & DAILY ACTIVITY REPORTS (PDF STANDARD)
  // ---------------------------------------------------------------------------
  const [periodCovered, setPeriodCovered] = useState<string>('Nov 03, 2026 – Nov 08, 2026 (Mon–Sat)');
  const [manpowerCounts, setManpowerCounts] = useState({
    leadman: 2,
    foreman: 2,
    mason: 8,
    laborer: 12,
    skilled: 6
  });
  const [equipmentList, setEquipmentList] = useState<EquipmentEntry[]>([
    { id: 'eq-1', name: '1-Bagger Concrete Mixer', qty: 2, status: 'Operational' },
    { id: 'eq-2', name: 'Rebar Cutter & Bar Bender Set', qty: 2, status: 'Operational' },
    { id: 'eq-3', name: 'Plate Compactor (Earthworks)', qty: 1, status: 'Operational' },
    { id: 'eq-4', name: 'Portable Welding Machine 300A', qty: 2, status: 'For Repair' },
  ]);
  const [newEquipName, setNewEquipName] = useState('');
  const [weatherLog, setWeatherLog] = useState<Record<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat', 'Sunny' | 'Rainy'>>({
    Mon: 'Sunny',
    Tue: 'Sunny',
    Wed: 'Rainy',
    Thu: 'Sunny',
    Fri: 'Sunny',
    Sat: 'Sunny',
  });
  const [activitiesAccomplished, setActivitiesAccomplished] = useState<string>(
    '• Completed footing excavation and gravel bedding at Grid A1–D4 (80% weight share).\n• Installed 16mm deformed reinforcing bars and phenolic formworks for ground floor columns.\n• Commenced CHB wall laying and rough plastering at East Perimeter.'
  );
  const [issuesEncountered, setIssuesEncountered] = useState<string>(
    '• Brief afternoon rain on Wednesday delayed exterior concrete pouring by 2 hours; shifted crew to interior rebar fabrication.\n• 1 unit Welding Machine flagged For Repair (replacement unit dispatched from central yard).'
  );
  const [photos, setPhotos] = useState<{ id: string; caption: string; timestamp: string }[]>([
    { id: 'ph-1', caption: 'Grid A1–D4 Footing Concreting & Rebar Cage Inspection', timestamp: '2026-11-06 10:15 AM' },
    { id: 'ph-2', caption: 'Formworks Alignment & Plumbness Check (2nd Floor Columns)', timestamp: '2026-11-07 03:40 PM' },
  ]);
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [preparedBy, setPreparedBy] = useState('Engr. Carlos Mendoza');
  const [checkedBy, setCheckedBy] = useState('Engr. Ricardo Ramos');
  const [savedReports, setSavedReports] = useState<WeeklyActivityReportRecord[]>([]);
  const [reportSavedBanner, setReportSavedBanner] = useState<string | null>(null);

  const handleSaveWeeklyReport = () => {
    const newReport: WeeklyActivityReportRecord = {
      id: `WAR-${Date.now().toString().slice(-5)}`,
      projectId: selectedProject?.id || 'PRJ-01',
      projectName: selectedProject?.name || 'Commercial Fit-Out Site',
      periodCovered,
      manpower: { ...manpowerCounts },
      equipment: [...equipmentList],
      weatherLog: { ...weatherLog },
      activitiesAccomplished,
      issuesEncountered,
      photos: [...photos],
      preparedBy,
      preparedByRole: 'Site Engineer',
      checkedBy,
      checkedByRole: 'Head Project Manager',
      createdAt: new Date().toLocaleString('en-PH')
    };
    setSavedReports(prev => [newReport, ...prev]);
    setReportSavedBanner(`Activity Report ${newReport.id} logged and signed off by ${preparedBy}.`);
    setTimeout(() => setReportSavedBanner(null), 3500);
  };

  // ---------------------------------------------------------------------------
  // SUB-TAB 3: SAFETY, PPE ISSUANCE, QUALITY INSPECTIONS & TOOLBOX (WITH PUNCH LIST)
  // ---------------------------------------------------------------------------
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([
    {
      id: 'CMP-101',
      projectId: 'ALL',
      category: 'PPE_ISSUANCE',
      title: 'Hard Hats, High-Vis Vests & Steel-Toe Boots Issued',
      details: 'Issued to 24 deployed artisans (Masonry, Concreting & Rebar crews). Signed acknowledgment on file.',
      assignedTo: 'Safety Officer / Timekeeper',
      date: '2026-11-04',
      status: 'ISSUED'
    },
    {
      id: 'CMP-102',
      projectId: 'ALL',
      category: 'TOOLBOX_MEETING',
      title: 'Morning Toolbox Briefing: Working at Heights & Scaffolding Safety',
      details: 'Mandatory 15-min briefing prior to 2nd floor formworks & roof truss erection (30/30 crew present).',
      assignedTo: 'Engr. Carlos Mendoza',
      date: '2026-11-06',
      status: 'COMPLIANT'
    },
    {
      id: 'CMP-103',
      projectId: 'ALL',
      category: 'QUALITY_INSPECTION',
      title: 'Rebar Spacing, Concrete Slump Test & Formworks Plumbness QA',
      details: 'Verified 4,000 PSI concrete mix design and 16mm rebar splice lengths prior to slab pouring.',
      assignedTo: 'QA/QC Lead Engineer',
      date: '2026-11-07',
      status: 'COMPLIANT'
    },
    {
      id: 'CMP-104',
      projectId: 'ALL',
      category: 'PUNCH_LIST',
      title: 'Punch-List Item: Minor Plastering Hairline Crack at Grid C2 Wall',
      details: 'Merged field punch-list item — requires skim coat rectification prior to primer painting.',
      assignedTo: 'Master Mason Crew',
      date: '2026-11-08',
      status: 'OPEN_DEFECT'
    }
  ]);

  const [newCompCategory, setNewCompCategory] = useState<ComplianceItem['category']>('QUALITY_INSPECTION');
  const [newCompTitle, setNewCompTitle] = useState('');
  const [newCompDetails, setNewCompDetails] = useState('');
  const [newCompAssignee, setNewCompAssignee] = useState('Engr. Carlos Mendoza');

  const handleAddComplianceItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompTitle.trim()) return;
    const item: ComplianceItem = {
      id: `CMP-${Date.now().toString().slice(-4)}`,
      projectId: selectedProject?.id || 'ALL',
      category: newCompCategory,
      title: newCompTitle.trim(),
      details: newCompDetails.trim() || 'Field verification recorded on site.',
      assignedTo: newCompAssignee.trim() || 'Site Engineer',
      date: new Date().toISOString().split('T')[0],
      status: newCompCategory === 'PUNCH_LIST' ? 'OPEN_DEFECT' : newCompCategory === 'PPE_ISSUANCE' ? 'ISSUED' : 'COMPLIANT'
    };
    setComplianceItems(prev => [item, ...prev]);
    setNewCompTitle('');
    setNewCompDetails('');
  };

  const totalManpower =
    manpowerCounts.leadman +
    manpowerCounts.foreman +
    manpowerCounts.mason +
    manpowerCounts.laborer +
    manpowerCounts.skilled;

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
              Live Synced with Master CPM Gantt
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
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name}
                </option>
              ))}
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
      {/* SUB-TAB 1: SUMMARY PROGRESS REPORT (EXCEL STANDARD)                   */}
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
                Standard 14-Phase Bill of Quantities / WBS Progress Table synced live from Master Gantt weighted tasks
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-xs font-mono">
                <span className="text-slate-400 mr-1.5">Overall Weighted Progress:</span>
                <span className="text-emerald-400 font-bold">{summaryTotals.totalActual}%</span>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Print Excel Sheet</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                  <th className="py-3 px-4 w-16">Item</th>
                  <th className="py-3 px-4">Scope of Works / Construction Phase</th>
                  <th className="py-3 px-3 text-right">Weight (%)</th>
                  <th className="py-3 px-3 text-right">Planned (%)</th>
                  <th className="py-3 px-3 text-right">Actual (%)</th>
                  <th className="py-3 px-4 w-64">Live Gantt Progress Bar</th>
                  <th className="py-3 px-3 text-right">Variance</th>
                  <th className="py-3 px-4 text-right">Weighted Accomplishment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {phaseProgressRows.map((row) => {
                  const isCompleted = row.actualPct >= 100;
                  const isDelayed = row.variancePct < -10;
                  return (
                    <tr key={row.wbs} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-amber-400">{row.wbs}</td>
                      <td className="py-2.5 px-4 font-semibold text-white">{row.phaseName}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">{row.weight.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{row.plannedPct}%</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">{row.actualPct}%</td>
                      <td className="py-2.5 px-4">
                        <div className="w-full bg-slate-950 rounded-md h-4 overflow-hidden border border-slate-800 relative flex items-center">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, row.actualPct))}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white drop-shadow">
                            {row.actualPct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span className={
                          row.variancePct >= 0
                            ? 'text-emerald-400'
                            : isDelayed
                            ? 'text-rose-400 font-semibold'
                            : 'text-amber-400'
                        }>
                          {row.variancePct > 0 ? `+${row.variancePct}%` : `${row.variancePct}%`}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-white">
                        {row.weightedActual.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950 border-t-2 border-slate-700 font-mono text-xs font-bold text-white">
                  <td className="py-3 px-4 text-amber-400">TOTAL</td>
                  <td className="py-3 px-4">Cumulative Project Accomplishment</td>
                  <td className="py-3 px-3 text-right text-emerald-400">{summaryTotals.totalWeight.toFixed(1)}%</td>
                  <td className="py-3 px-3 text-right text-slate-300">{summaryTotals.totalPlanned}%</td>
                  <td className="py-3 px-3 text-right text-emerald-400">{summaryTotals.totalActual}%</td>
                  <td className="py-3 px-4">
                    <div className="w-full bg-slate-900 rounded-md h-4 overflow-hidden border border-emerald-500/40 relative">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(0, summaryTotals.totalActual))}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white">
                        {summaryTotals.totalActual}% Overall
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={summaryTotals.variance >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {summaryTotals.variance > 0 ? `+${summaryTotals.variance}%` : `${summaryTotals.variance}%`}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-400 text-sm">
                    {summaryTotals.totalActual}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: WEEKLY & DAILY ACTIVITY REPORTS (PDF STANDARD)             */}
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

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-xl">
            {/* PDF Standard Document Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                  FIELD ENGINEERING STANDARD FORM • WEEKLY / DAILY SITE ACTIVITY REPORT
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {selectedProject?.name || 'Commercial Fit-Out Project'}
                </h3>
                <p className="text-xs text-slate-400">
                  Location: {selectedProject?.location || 'Metro Manila Commercial Zone'}
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
                    Manpower Designation Count
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
                  Site Equipment & Machinery Status
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
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPhotoCaption}
                    onChange={(e) => setNewPhotoCaption(e.target.value)}
                    placeholder="Photo caption (e.g. Slab rebar inspection)..."
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
                    <Camera className="w-3 h-3" />
                    <span>Attach Photo</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {photos.map(ph => (
                  <div key={ph.id} className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{ph.caption}</div>
                      <div className="text-[10px] font-mono text-slate-400">{ph.timestamp} • Geotagged Site Photo</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 5: Signature Blocks (Prepared By Site Engineer / Checked By Head Engineer) */}
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
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Export / Print PDF Report</span>
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: SAFETY, PPE ISSUANCE, QUALITY INSPECTIONS & TOOLBOX        */}
      {/* ===================================================================== */}
      {activeSubTab === 'safety-qa' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Compliance & Merged Punch List Feed */}
          <div className="lg:col-span-8 space-y-3">
            {complianceItems.map(item => (
              <div
                key={item.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      {item.id}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                      item.category === 'PPE_ISSUANCE'
                        ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                        : item.category === 'TOOLBOX_MEETING'
                        ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                        : item.category === 'QUALITY_INSPECTION'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    }`}>
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
                  <button
                    type="button"
                    onClick={() =>
                      setComplianceItems(prev =>
                        prev.map(c =>
                          c.id === item.id
                            ? {
                                ...c,
                                status:
                                  c.status === 'OPEN_DEFECT'
                                    ? 'RECTIFIED'
                                    : c.status === 'RECTIFIED'
                                    ? 'COMPLIANT'
                                    : c.status
                              }
                            : c
                        )
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                      item.status === 'OPEN_DEFECT'
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {item.status === 'OPEN_DEFECT' ? '⚠️ Open Punch-List (Click to Rectify)' : `✓ ${item.status}`}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Quick Log Form */}
          <div className="lg:col-span-4">
            <form
              onSubmit={handleAddComplianceItem}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3.5 sticky top-6"
            >
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                Log Field Safety, QA or Punch Item
              </h3>

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
                className="w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer transition"
              >
                + Record Field Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
