/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Archive, Building2, CheckCircle2, MapPin, Calendar, DollarSign, Users,
  Package, ClipboardList, FileText, History, Printer, X, Search,
  TrendingUp, HardHat, CloudSun, Layers, ShieldCheck, ArrowRight
} from 'lucide-react';
import {
  ProjectProfile,
  ProjectTask,
  Contractor,
  DailySiteLog,
  ChangeOrder,
  ProjectRFI,
  ProcessAuditLog,
} from '../types';
import {
  calculateProjectBomProfitSync,
  getStoredMaterialDirectory,
  getProjectMaterialSpend,
} from '../utils/bomProfitSync';
import { openEnterprisePrintWindow, escapePrintHtml } from '../utils/printEngine';
import { useTheme } from '../context/ThemeContext';

interface ProjectHistoryProps {
  projects: ProjectProfile[];
  tasks?: ProjectTask[];
  contractors?: Contractor[];
  siteLogs?: DailySiteLog[];
  changeOrders?: ChangeOrder[];
  rfis?: ProjectRFI[];
  auditLogs?: ProcessAuditLog[];
  canMarkCompleted?: boolean;
  onUpdateProject?: (id: string, updates: Partial<ProjectProfile>) => Promise<void> | void;
}

type DossierTab = 'OVERVIEW' | 'FINANCIALS' | 'WBS' | 'MATERIALS' | 'WORKERS' | 'DIARY' | 'AUDIT';

export default function ProjectHistory({
  projects = [],
  tasks = [],
  contractors = [],
  siteLogs = [],
  changeOrders = [],
  rfis = [],
  auditLogs = [],
  canMarkCompleted = true,
  onUpdateProject,
}: ProjectHistoryProps) {
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectProfile | null>(null);
  const [activeDossierTab, setActiveDossierTab] = useState<DossierTab>('OVERVIEW');
  const [dossierGanttTasks, setDossierGanttTasks] = useState<any[]>([]);
  const [isLoadingGantt, setIsLoadingGantt] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const completedProjects = useMemo(
    () =>
      projects.filter((p) => {
        const st = (p.status || '').toUpperCase();
        return st === 'COMPLETED' || st === 'HANDED_OVER';
      }),
    [projects]
  );

  const activeFinishableProjects = useMemo(
    () =>
      projects.filter((p) => {
        const st = (p.status || '').toUpperCase();
        return st !== 'COMPLETED' && st !== 'HANDED_OVER';
      }),
    [projects]
  );

  const filteredCompleted = useMemo(() => {
    if (!searchQuery.trim()) return completedProjects;
    const q = searchQuery.toLowerCase();
    return completedProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.clientName || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [completedProjects, searchQuery]);

  // Fetch authoritative Gantt/WBS tasks from PostgreSQL when a completed project dossier opens
  useEffect(() => {
    if (!selectedProject) {
      setDossierGanttTasks([]);
      return;
    }
    let cancelled = false;
    setIsLoadingGantt(true);
    fetch(`/api/projects/${selectedProject.id}/gantt`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) {
          const rows = Array.isArray(json?.data) ? json.data : [];
          setDossierGanttTasks(rows);
        }
      })
      .catch(() => {
        if (!cancelled) setDossierGanttTasks([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGantt(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  const handleMarkAsCompleted = async (proj: ProjectProfile) => {
    if (!onUpdateProject) return;
    if (!confirm(`Mark "${proj.name}" as COMPLETED and archive it in Project History?`)) return;
    setMarkingId(proj.id);
    try {
      await onUpdateProject(proj.id, {
        status: 'COMPLETED',
        progressPercentage: 100,
      });
      setToastMsg(`"${proj.name}" marked as COMPLETED and added to Project History Archive.`);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err) {
      console.error('Failed to mark project completed:', err);
    } finally {
      setMarkingId(null);
    }
  };

  // Compute full dossier metrics for the currently selected completed project
  const dossierData = useMemo(() => {
    if (!selectedProject) return null;
    const projNameLower = (selectedProject.name || '').toLowerCase();

    const approvedCOs = changeOrders.filter(
      (co) =>
        (co.projectId === selectedProject.id ||
          (co.projectName || '').toLowerCase() === projNameLower) &&
        (co.status || '').toUpperCase() === 'APPROVED'
    );
    const approvedCOValue = approvedCOs.reduce(
      (sum, co) => sum + (Number(co.approvedAmount ?? co.requestedAmount ?? co.amount ?? 0) || 0),
      0
    );

    const allMaterials = getStoredMaterialDirectory();
    const projectMaterials = allMaterials.filter((m) => {
      const mp = (m.projectName || '').toLowerCase();
      return mp && (mp === projNameLower || mp.includes(projNameLower) || projNameLower.includes(mp));
    });
    const totalMaterialCost = getProjectMaterialSpend(selectedProject.name, allMaterials);

    const deployedWorkers = contractors.filter(
      (c) =>
        (selectedProject.assignedContractorIds || []).includes(c.id) ||
        c.assignedProjectId === selectedProject.id ||
        (c.activeProjectSite || '').toLowerCase() === projNameLower
    );
    const totalLaborCost = deployedWorkers.reduce(
      (sum, w) => sum + (Number(w.paidAmount || 0) || Number(w.dailyRate || 0) * 22),
      0
    );

    const profitSync = calculateProjectBomProfitSync({
      projectId: selectedProject.id,
      projectName: selectedProject.name,
    });

    const projectRfis = rfis.filter(
      (r) =>
        r.projectId === selectedProject.id ||
        (r.projectName || '').toLowerCase() === projNameLower
    );

    const projectSiteLogs = siteLogs.filter(
      (log) =>
        (log as any).projectId === selectedProject.id ||
        ((log as any).projectName || '').toLowerCase() === projNameLower ||
        (log.workCompleted || '').toLowerCase().includes(projNameLower)
    );

    const projectAuditLogs = auditLogs.filter(
      (a) =>
        a.entityId === selectedProject.id ||
        (a.details || '').toLowerCase().includes(projNameLower)
    );

    const fallbackTasks = tasks.filter((t) => t.projectId === selectedProject.id);
    const finalTasks = dossierGanttTasks.length > 0 ? dossierGanttTasks : fallbackTasks;

    return {
      contractAmount: Number(selectedProject.budget || 0),
      approvedCOs,
      approvedCOValue,
      totalFundsCollected: Number(selectedProject.fundsCollected || 0),
      totalMaterialCost,
      totalLaborCost,
      profitSync,
      projectMaterials,
      projectRfis,
      deployedWorkers,
      projectSiteLogs,
      projectAuditLogs,
      finalTasks,
    };
  }, [selectedProject, changeOrders, contractors, rfis, siteLogs, auditLogs, tasks, dossierGanttTasks]);

  const handlePrintDossier = () => {
    if (!selectedProject || !dossierData) return;
    const wbsRows = dossierData.finalTasks
      .map(
        (t: any) => `
      <tr>
        <td class="mono">${escapePrintHtml(t.wbsCode || '—')}</td>
        <td>${escapePrintHtml(t.text || t.title || 'Task')}</td>
        <td class="mono">${escapePrintHtml(String(t.start_date || t.startDate || '').slice(0, 10))}</td>
        <td class="mono">${escapePrintHtml(String(t.end_date || t.endDate || '').slice(0, 10))}</td>
        <td class="mono" style="text-align:center;font-weight:700;">${Math.round(Number(t.progress || 0) <= 1 ? Number(t.progress || 0) * 100 : Number(t.progress || 0))}%</td>
      </tr>`
      )
      .join('');

    openEnterprisePrintWindow({
      title: `Completed Project History Dossier — ${selectedProject.name}`,
      subtitle: 'Final Financial Closeout, WBS Completion, Workforce & Compliance Archive',
      docRef: `ARCHIVE-${selectedProject.id}`,
      orientation: 'portrait',
      projectMeta: {
        name: selectedProject.name,
        client: selectedProject.clientName,
        location: selectedProject.location,
        period: `${selectedProject.startDate || 'N/A'} to ${selectedProject.targetHandoverDate || 'Completed'}`,
      },
      kpiSummary: [
        { label: 'Final Contract Value', value: `₱${(dossierData.contractAmount + dossierData.approvedCOValue).toLocaleString()}` },
        { label: 'Total Funds Collected', value: `₱${dossierData.totalFundsCollected.toLocaleString()}` },
        { label: 'Material + Labor Spend', value: `₱${(dossierData.totalMaterialCost + dossierData.totalLaborCost).toLocaleString()}` },
        { label: 'Final Profit Margin', value: `${dossierData.profitSync.profitMarginPct}%` },
      ],
      bodyHtml: `
        <div class="section-title">1. Final Financial Closeout Summary</div>
        <table>
          <tbody>
            <tr><th>Base Contract Amount</th><td class="mono" style="text-align:right;">₱${dossierData.contractAmount.toLocaleString()}</td></tr>
            <tr><th>Approved Change Orders (${dossierData.approvedCOs.length})</th><td class="mono" style="text-align:right;">₱${dossierData.approvedCOValue.toLocaleString()}</td></tr>
            <tr><th>Total Funds Collected</th><td class="mono" style="text-align:right;color:#047857;font-weight:700;">₱${dossierData.totalFundsCollected.toLocaleString()}</td></tr>
            <tr><th>Total Material / BOM Cost</th><td class="mono" style="text-align:right;">₱${dossierData.totalMaterialCost.toLocaleString()}</td></tr>
            <tr><th>Total Labor Cost</th><td class="mono" style="text-align:right;">₱${dossierData.totalLaborCost.toLocaleString()}</td></tr>
            <tr><th>Final Remaining Profit Pool</th><td class="mono" style="text-align:right;font-weight:700;">₱${dossierData.profitSync.remainingProfit.toLocaleString()} (${dossierData.profitSync.profitMarginPct}%)</td></tr>
          </tbody>
        </table>

        <div class="section-title" style="margin-top:16px;">2. Final WBS / Gantt Completion (${dossierData.finalTasks.length} Tasks)</div>
        <table>
          <thead><tr><th>WBS</th><th>Task / Phase</th><th>Start</th><th>Finish</th><th style="text-align:center;">Completion</th></tr></thead>
          <tbody>${wbsRows || '<tr><td colspan="5" style="text-align:center;color:#64748b;">No archived WBS tasks recorded.</td></tr>'}</tbody>
        </table>
      `,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-emerald-400" />
            <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Completed Project History Archive
            </h2>
          </div>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Permanent closeout dossiers for completed builds — financial closeout, WBS completion, material ledger, deployed workers, site diary &amp; audit trail.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search completed projects..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-emerald-500 ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Completed Projects Grid */}
      {filteredCompleted.length === 0 ? (
        <div className={`rounded-2xl border p-10 text-center space-y-2 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
          <Archive className="w-10 h-10 text-slate-500 mx-auto opacity-60" />
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            No Completed Projects Archived Yet
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Mark a finished active project as <strong>Completed</strong> below (or from Commercial Sites Hub) to generate its permanent Project History Dossier.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompleted.map((proj) => {
            const profitSync = calculateProjectBomProfitSync({ projectId: proj.id, projectName: proj.name });
            return (
              <div
                key={proj.id}
                onClick={() => {
                  setSelectedProject(proj);
                  setActiveDossierTab('OVERVIEW');
                }}
                className={`rounded-2xl border p-4 transition-all cursor-pointer group flex flex-col justify-between space-y-3 ${
                  isDark
                    ? 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900'
                    : 'bg-white border-slate-200 hover:border-emerald-400 shadow-xs hover:shadow-md'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      {proj.id}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {proj.status === 'HANDED_OVER' ? 'HANDED OVER' : 'COMPLETED'}
                    </span>
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold group-hover:text-emerald-400 transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {proj.name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">{proj.clientName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{proj.location}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/70 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Contract Value</span>
                    <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      ₱{Number(proj.budget || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Final Margin</span>
                    <span className="font-bold text-emerald-400">{profitSync.profitMarginPct}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 pt-1">
                  <span>Open Full Dossier</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mark Finished Projects as Completed */}
      {canMarkCompleted && activeFinishableProjects.length > 0 && (
        <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-xs font-bold uppercase font-mono tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Active Projects Ready for Closeout Archive
              </h3>
              <p className="text-[11px] text-slate-400">
                Mark a finished build as Completed to lock its historical dossier into Project History.
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-800/60">
            {activeFinishableProjects.map((proj) => (
              <div key={proj.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {proj.name}{' '}
                    <span className="text-[10px] font-mono text-slate-400 font-normal">({proj.id})</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Progress: <span className="text-amber-400 font-bold">{Math.round(proj.progressPercentage || 0)}%</span> • Budget: ₱{Number(proj.budget || 0).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={markingId === proj.id}
                  onClick={() => handleMarkAsCompleted(proj)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{markingId === proj.id ? 'Archiving...' : 'Mark as Completed'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comprehensive Completed Project History Dossier Modal */}
      {selectedProject && dossierData && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setSelectedProject(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-5xl max-h-[92vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Dossier Header */}
            <div className={`px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                    COMPLETED ARCHIVE • {selectedProject.id}
                  </span>
                </div>
                <h2 className={`text-base sm:text-lg font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {selectedProject.name}
                </h2>
                <p className="text-xs text-slate-400">
                  {selectedProject.clientName} • {selectedProject.location}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintDossier}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Dossier</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Dossier Navigation Tabs */}
            <div className={`px-5 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
              {(
                [
                  { id: 'OVERVIEW', label: 'Overview', icon: Building2 },
                  { id: 'FINANCIALS', label: 'Final Financials', icon: DollarSign },
                  { id: 'WBS', label: `WBS / Gantt (${dossierData.finalTasks.length})`, icon: Layers },
                  { id: 'MATERIALS', label: `Materials (${dossierData.projectMaterials.length})`, icon: Package },
                  { id: 'WORKERS', label: `Workers (${dossierData.deployedWorkers.length})`, icon: Users },
                  { id: 'DIARY', label: `Site Diary (${dossierData.projectSiteLogs.length})`, icon: CloudSun },
                  { id: 'AUDIT', label: `Audit Trail (${dossierData.projectAuditLogs.length})`, icon: History },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDossierTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                      activeDossierTab === tab.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : isDark
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dossier Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {activeDossierTab === 'OVERVIEW' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Client Account</span>
                      <span className="text-sm font-bold text-white mt-1 block">{selectedProject.clientName || '—'}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Lead Project Manager</span>
                      <span className="text-sm font-bold text-amber-300 mt-1 block">{selectedProject.assignedProjectManagerName || 'Operations Director'}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Start → Completion</span>
                      <span className="text-sm font-bold font-mono text-white mt-1 block">
                        {selectedProject.startDate || '—'} → {selectedProject.targetHandoverDate || 'Completed'}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Site Coordinates</span>
                      <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block">
                        {selectedProject.latitude && selectedProject.longitude
                          ? `${Number(selectedProject.latitude).toFixed(4)}°N, ${Number(selectedProject.longitude).toFixed(4)}°E`
                          : '14.2785°N, 121.1235°E'}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <h4 className="text-[11px] font-mono uppercase text-slate-400 mb-1.5">Project Scope &amp; Architectural Brief</h4>
                    <p className="text-slate-300 leading-relaxed">
                      {selectedProject.description || 'Turnkey residential & commercial design-build scope completed to specification.'}
                    </p>
                  </div>
                </div>
              )}

              {activeDossierTab === 'FINANCIALS' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 font-mono">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block">Base Contract Amount</span>
                    <span className="text-lg font-bold text-white mt-1 block">₱{dossierData.contractAmount.toLocaleString()}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block">Approved Change Orders ({dossierData.approvedCOs.length})</span>
                    <span className="text-lg font-bold text-sky-400 mt-1 block">₱{dossierData.approvedCOValue.toLocaleString()}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block">Total Funds Collected</span>
                    <span className="text-lg font-bold text-emerald-400 mt-1 block">₱{dossierData.totalFundsCollected.toLocaleString()}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block">Total Material / BOM Cost</span>
                    <span className="text-lg font-bold text-amber-400 mt-1 block">₱{dossierData.totalMaterialCost.toLocaleString()}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block">Total Labor Cost</span>
                    <span className="text-lg font-bold text-indigo-400 mt-1 block">₱{dossierData.totalLaborCost.toLocaleString()}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40">
                    <span className="text-[10px] uppercase text-emerald-400 block">Final Profit Margin</span>
                    <span className="text-lg font-bold text-emerald-400 mt-1 block">
                      {dossierData.profitSync.profitMarginPct}% (₱{dossierData.profitSync.remainingProfit.toLocaleString()})
                    </span>
                  </div>
                </div>
              )}

              {activeDossierTab === 'WBS' && (
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                  {isLoadingGantt ? (
                    <div className="p-8 text-center text-slate-400 font-mono">Loading PostgreSQL WBS tasks...</div>
                  ) : dossierData.finalTasks.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic">No WBS / Gantt tasks recorded for this project.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                          <th className="py-2.5 px-3">WBS</th>
                          <th className="py-2.5 px-3">Task / Phase</th>
                          <th className="py-2.5 px-3">Start</th>
                          <th className="py-2.5 px-3">Finish</th>
                          <th className="py-2.5 px-3 text-right">Completion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {dossierData.finalTasks.map((t: any) => {
                          const pct = Math.round(Number(t.progress || 0) <= 1 ? Number(t.progress || 0) * 100 : Number(t.progress || 0));
                          return (
                            <tr key={t.id}>
                              <td className="py-2 px-3 font-mono text-amber-400">{t.wbsCode || '—'}</td>
                              <td className="py-2 px-3 text-white font-medium">{t.text || t.title}</td>
                              <td className="py-2 px-3 font-mono text-slate-400">{String(t.start_date || t.startDate || '').slice(0, 10)}</td>
                              <td className="py-2 px-3 font-mono text-slate-400">{String(t.end_date || t.endDate || '').slice(0, 10)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeDossierTab === 'MATERIALS' && (
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                  {dossierData.projectMaterials.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic">No Material Directory records linked to this project.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                          <th className="py-2.5 px-3">Material</th>
                          <th className="py-2.5 px-3 text-right">Ordered</th>
                          <th className="py-2.5 px-3 text-right">Received</th>
                          <th className="py-2.5 px-3 text-right">Used</th>
                          <th className="py-2.5 px-3 text-right">Unit Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {dossierData.projectMaterials.map((m) => (
                          <tr key={m.id}>
                            <td className="py-2 px-3 text-white font-medium">{m.materialDescription}</td>
                            <td className="py-2 px-3 text-right font-mono">{m.ordered}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-400">{m.received}</td>
                            <td className="py-2 px-3 text-right font-mono text-amber-400">{m.used ?? 0}</td>
                            <td className="py-2 px-3 text-right font-mono">₱{Number(m.unitCostPhp || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeDossierTab === 'WORKERS' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {dossierData.deployedWorkers.length === 0 ? (
                    <div className="col-span-full p-8 text-center text-slate-500 italic bg-slate-950 rounded-xl border border-slate-800">
                      No deployed workers recorded for this project.
                    </div>
                  ) : (
                    dossierData.deployedWorkers.map((w) => (
                      <div key={w.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white">{w.name}</div>
                          <div className="text-[11px] text-slate-400">{w.roleTitle || w.specialty || 'Site Artisan'}</div>
                        </div>
                        <span className="font-mono text-emerald-400 font-bold">
                          {w.dailyRate ? `₱${Number(w.dailyRate).toLocaleString()}/day` : 'Contract'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeDossierTab === 'DIARY' && (
                <div className="space-y-2.5">
                  {dossierData.projectSiteLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic bg-slate-950 rounded-xl border border-slate-800">
                      No Site Diary entries recorded for this project.
                    </div>
                  ) : (
                    dossierData.projectSiteLogs.map((log) => (
                      <div key={log.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span className="text-amber-400 font-bold">{String(log.date).slice(0, 10)} • {log.weather}</span>
                          <span>Supervisor: {log.supervisorName} • {log.activeHeadcount} pax</span>
                        </div>
                        <p className="text-slate-200">{log.workCompleted}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeDossierTab === 'AUDIT' && (
                <div className="space-y-2">
                  {dossierData.projectAuditLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic bg-slate-950 rounded-xl border border-slate-800">
                      No audit trail entries logged for this project.
                    </div>
                  ) : (
                    dossierData.projectAuditLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold mr-2">
                            {log.action}
                          </span>
                          <span className="text-slate-200">{log.details}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {log.actorName}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
