/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users, HardHat, AlertTriangle, Award, BadgeAlert,
  BarChart3, Building, PieChart, RefreshCw, Sparkles, Bot, Zap,
  X, CheckCircle, CheckCheck, ChevronUp, ChevronDown, ArrowRight,
  Lightbulb, ClipboardList, Plus, TrendingUp, Check,
  ArrowRightLeft, Sliders, MapPin, Building2, UserCheck
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import {
  Contractor, DailyManpowerAudit, AIManpowerRecommendation,
  ProjectProfile, isOfficeOrExecutive, isIndividualStaffOrEngineer
} from '../types';
import { useTheme } from '../context/ThemeContext';
import WorkforceMessengerRoster from './WorkforceMessengerRoster';

export interface LaborWorkforceArtisanTradesProps {
  contractors: Contractor[];
  manpowerAudits: DailyManpowerAudit[];
  projects: ProjectProfile[];
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

export type WorkforceTabId = 'directory' | 'analytics';

const TABS: { id: WorkforceTabId; label: string; icon: React.ElementType }[] = [
  { id: 'directory', label: 'Personnel Directory & Roster', icon: Users },
  { id: 'analytics', label: 'Workforce Allocation & Analytics', icon: BarChart3 },
];

export const LaborWorkforceArtisanTrades: React.FC<LaborWorkforceArtisanTradesProps> = ({
  contractors,
  manpowerAudits,
  projects,
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeSubTab, setActiveSubTab] = useState<WorkforceTabId>(initialTab ?? 'directory');
  const [reallocatingId, setReallocatingId] = useState<string | null>(null);
  const [recommendationQueue, setRecommendationQueue] = useState<AIManpowerRecommendation[]>([]);
  const [appliedTransfersHistory, setAppliedTransfersHistory] = useState<AIManpowerRecommendation[]>([]);
  const [expandedRecIds, setExpandedRecIds] = useState<Record<string, boolean>>({});
  const [showAllRecCards, setShowAllRecCards] = useState<boolean>(false);

  // Manual Workforce Allocation & Transfer Console State (Coupled with Live Charts)
  const [manualWorkerId, setManualWorkerId] = useState<string>(() => contractors[0]?.id || '');
  const [manualSite, setManualSite] = useState<string>('');
  const [manualZone, setManualZone] = useState<string>('General Area');
  const [manualCount, setManualCount] = useState<number>(1);
  const [isManualTransferring, setIsManualTransferring] = useState<boolean>(false);

  const selectedManualWorker = contractors.find(c => c.id === manualWorkerId) || contractors[0];

  useEffect(() => {
    if (selectedManualWorker) {
      setManualSite(selectedManualWorker.activeProjectSite || '');
      setManualZone(selectedManualWorker.assignedZone || 'General Area');
      const isIndiv = isIndividualStaffOrEngineer(selectedManualWorker) || isOfficeOrExecutive(selectedManualWorker);
      setManualCount(isIndiv ? 1 : (selectedManualWorker.activeManpower || 1));
    }
  }, [selectedManualWorker?.id]);

  const handleExecuteManualTransfer = async (targetSite: string, targetZone?: string, count?: number) => {
    if (!selectedManualWorker) return;
    setIsManualTransferring(true);

    const cleanSite = targetSite.trim();
    const cleanZone = (targetZone !== undefined ? targetZone : manualZone).trim();
    const isIndiv = isIndividualStaffOrEngineer(selectedManualWorker) || isOfficeOrExecutive(selectedManualWorker);
    const cleanCount = isIndiv ? 1 : Math.max(1, count !== undefined ? count : (Number(manualCount) || 1));

    const updated: Contractor = {
      ...selectedManualWorker,
      activeProjectSite: cleanSite || undefined,
      assignedZone: cleanZone || undefined,
      activeManpower: cleanCount
    };

    if (onUpdateContractor) {
      onUpdateContractor(updated);
    }
    if (onUpdateContractors) {
      onUpdateContractors(contractors.map(c => c.id === updated.id ? updated : c));
    }

    try {
      if (cleanSite && projects && projects.length > 0) {
        const selectedProject = projects.find(p => p.name.toLowerCase() === cleanSite.toLowerCase());
        if (selectedProject) {
          await fetch(`/api/projects/${selectedProject.id}/workers`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workerId: selectedManualWorker.id, action: 'add' })
          });

          if (onUpdateProject) {
            const current = selectedProject.assignedContractorIds || [];
            if (!current.includes(selectedManualWorker.id)) {
              onUpdateProject(selectedProject.id, {
                assignedContractorIds: [...current, selectedManualWorker.id],
                assignedWorkersCount: (selectedProject.assignedWorkersCount || 0) + 1
              });
            }
          }
        }
      } else {
        if (selectedManualWorker.activeProjectSite) {
          const prevProject = projects.find(p => p.name.toLowerCase() === selectedManualWorker.activeProjectSite?.toLowerCase());
          if (prevProject) {
            await fetch(`/api/projects/${prevProject.id}/workers`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workerId: selectedManualWorker.id, action: 'remove' })
            }).catch(() => {});
          }
        }
      }

      notify(`Transferred ${selectedManualWorker.name} to ${cleanSite || 'General Standby Pool'}`);
    } catch (err) {
      console.error('Error applying manual transfer:', err);
      notify(`Transfer saved locally.`);
    } finally {
      setIsManualTransferring(false);
    }
  };

  const toggleExpandRec = (id: string) => {
    setExpandedRecIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  // Sync recommendationQueue and appliedTransfersHistory whenever aiRecommendations changes
  useEffect(() => {
    if (aiRecommendations && aiRecommendations.length > 0) {
      const pending = aiRecommendations.filter(r => !r.applied && !r.dismissed && !isNonArtisanStaff(r));
      setRecommendationQueue(pending);
      const applied = aiRecommendations.filter(r => r.applied && !r.dismissed && !isNonArtisanStaff(r));
      setAppliedTransfersHistory(applied);
    }
  }, [aiRecommendations]);

  const avgProductivity = manpowerAudits.length > 0
    ? (manpowerAudits.reduce((sum, a) => sum + (a.productivityIndex || 0), 0) / manpowerAudits.length).toFixed(1)
    : '0.0';

  const inHouseRatio = Math.round((inHouseCount / Math.max(1, inHouseCount + outsourcedCount)) * 100);

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
              <p className="text-xs text-slate-400 mt-0.5">Verified site artisans, trade specialties, wage rates, active deployments, and attendance tracking.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono px-3 py-1.5 rounded-lg font-medium">
                {totalManpower} Workers On-Site
              </span>
            </div>
          </div>

          {/* Top-Level Tab Switcher */}
          <div className={`flex items-center gap-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-2 overflow-x-auto`}>
            {TABS.map(tab => {
              const isActive = activeSubTab === tab.id;
              const IconComponent = tab.icon;
              const count = tab.id === 'directory' ? totalManpower : undefined;

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
      {/* SUB-TAB 1: PERSONNEL DIRECTORY & ROSTER                        */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'directory' && (
        <div className="animate-fadeIn">
          {/* Interactive Personnel Directory & Messenger Roster */}
          <WorkforceMessengerRoster
            contractors={contractors}
            manpowerAudits={manpowerAudits}
            projects={projects}
            onRegisterClick={onRegisterWorkerClick}
            onVerifyRollCall={onVerifyRollCall}
            onDeleteContractor={onDeleteContractor}
            onUpdateContractor={onUpdateContractor}
            onUpdateContractors={onUpdateContractors}
            onUpdateProject={onUpdateProject}
            onSwitchToAllocationTab={(workerId?: string) => {
              setActiveSubTab('analytics');
              if (workerId) setManualWorkerId(workerId);
            }}
            notify={notify}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 2: WORKFORCE ALLOCATION & ANALYTICS                   */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Executive Analytics KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">TOTAL FIELD PERSONNEL</span>
                <HardHat className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                <span>{totalManpower}</span>
                <span className="text-xs text-slate-400 font-normal">Laborers</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">{contractors.length} Registered Entities</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">IN-HOUSE CORE STAFF</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                <span>{inHouseCount}</span>
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
                <span>{outsourcedCount}</span>
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
                <span>{deployedFieldContractors.length}</span>
                <span className="text-xs text-slate-400 font-normal">Active Teams</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-mono">Mapped to Commercial Sites</span>
            </div>
          </div>

          {/* Visual Workforce Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Chart 1: Manpower Headcount Deployed per Commercial Project */}
            <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'} border rounded-xl p-4.5 space-y-3`}>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b ${isDark ? 'border-slate-800/80' : 'border-slate-100'} pb-2.5`}>
                <div>
                  <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                    <BarChart3 className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-blue-600'}`} />
                    Labor Allocation by Commercial Site
                  </h4>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Physical workforce distribution across active project sites</p>
                </div>
                <span className={`text-[10px] font-mono ${isDark ? 'bg-teal-950/80 border-teal-800/80 text-teal-300' : 'bg-blue-50 border-blue-200 text-blue-700'} border px-2.5 py-0.5 rounded-full font-bold`}>
                  {projectLaborChartData.reduce((sum, p) => sum + p.workers, 0)} Total Assigned
                </span>
              </div>

              {projectLaborChartData.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-4">
                  <Building className="w-8 h-8 text-slate-400" />
                  <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>No Commercial Sites Registered</span>
                  <span className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Register a commercial project site to track labor distribution.</span>
                </div>
              ) : (
                <>
                  <div className="h-52 w-full pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReBarChart data={projectLaborChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                        <defs>
                          <linearGradient id="blueAllocBarGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#0284c7" stopOpacity={0.8} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={isDark ? '#1e293b' : '#e2e8f0'}
                          strokeOpacity={isDark ? 0.8 : 0.5}
                          vertical={false}
                        />
                        <XAxis dataKey="name" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                        <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className={`${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'} border p-3 rounded-xl text-xs space-y-1 font-sans pointer-events-none select-none`}>
                                  <div className="font-bold">{data.fullName}</div>
                                  <div className={`${isDark ? 'text-teal-400' : 'text-blue-600'} font-mono font-bold`}>{data.workers} Active Workers</div>
                                  <div className={`${isDark ? 'text-slate-300' : 'text-slate-600'} font-mono`}>Completion: {data.progress}%</div>
                                  <div className="text-[10px] text-slate-400 font-mono uppercase">{data.status}</div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="workers" fill="url(#blueAllocBarGrad)" radius={[6, 6, 0, 0]} />
                      </ReBarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-100'} text-[11px]`}>
                    {projectLaborChartData.slice(0, 4).map((p, i) => (
                      <div key={i} className={`${isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-50 border-slate-200/80'} border rounded-xl p-2.5 space-y-1`}>
                        <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} truncate text-xs`}>{p.name}</div>
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className={`${isDark ? 'text-teal-400' : 'text-blue-600'} font-bold`}>{p.workers} Crew</span>
                          <span className="text-slate-400">{p.progress}%</span>
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
                  <p className="text-[11px] text-slate-400">Headcount distribution across specialized construction trades</p>
                </div>
                <span className="text-[10px] font-mono bg-indigo-950/80 border border-indigo-800/80 text-indigo-300 px-2.5 py-0.5 rounded-full font-bold">
                  {tradeManpowerChartData.length} Specialized Trades
                </span>
              </div>

              {tradeManpowerChartData.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-4">
                  <Users className="w-8 h-8 text-slate-600" />
                  <span className="text-xs font-semibold text-slate-400">No Trade Workers Registered</span>
                  <span className="text-[11px] text-slate-600">Click &quot;Register Worker&quot; above to add construction personnel and trades.</span>
                </div>
              ) : (
                (() => {
                  const totalCrew = tradeManpowerChartData.reduce((sum, item) => sum + (item.value || 0), 0);

                  return (
                    <>
                      <div className="h-52 w-full flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={tradeManpowerChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {tradeManpowerChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                              ))}
                            </Pie>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const disciplineCount = Number(data.value || 0);
                                  const percentage = totalCrew > 0 ? Math.round((disciplineCount / totalCrew) * 100) : 0;
                                  return (
                                    <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs font-sans pointer-events-none select-none">
                                      <div className="font-bold text-white">{data.name}</div>
                                      <div className="text-teal-400 font-mono font-bold mt-0.5">{disciplineCount} Workers ({percentage}%)</div>
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
                        {tradeManpowerChartData.slice(0, 6).map((item, idx) => {
                          const disciplineCount = Number(item.value || 0);
                          const percentage = totalCrew > 0 ? Math.round((disciplineCount / totalCrew) * 100) : 0;
                          return (
                            <div key={idx} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2 space-y-0.5">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-200 truncate">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                                <span className="truncate text-xs">{item.name}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                                <span>{percentage}%</span>
                                <strong className="text-white">{item.value} Men</strong>
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
                  <p className="text-[11px] text-slate-400">Direct employee supervision vs subcontractor specialized capacity</p>
                </div>
                <span className="text-[10px] font-mono bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                  {contractors.length} Total Workforce Entities
                </span>
              </div>

              {employmentMixChartData.length === 0 ? (
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
                          data={employmentMixChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {employmentMixChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const total = employmentMixChartData.reduce((s, i) => s + i.value, 0);
                              const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0';
                              return (
                                <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs font-sans pointer-events-none select-none">
                                  <div className="font-bold text-white">{data.name}</div>
                                  <div className="text-teal-400 font-mono font-bold mt-0.5">{data.value} Headcount ({pct}%)</div>
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
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                        <span>CTVill In-House Core</span>
                      </div>
                      <div className="text-2xl font-black font-mono text-white">{inHouseCount} Staff</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Permanent Engineers, Foremen & Core Skilled Trades directly under company payroll.</p>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                        <span>Outsourced Trade Partners</span>
                      </div>
                      <div className="text-2xl font-black font-mono text-white">{outsourcedCount} Workers</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Specialized Subcontractors, MEPFS Teams & Manpower Suppliers deployed per milestone.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* MANUAL WORKFORCE ALLOCATION & SITE TRANSFER COMMAND STATION   */}
          {/* Coupled directly with the live monitoring charts above        */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-500/10 border border-teal-500/30 rounded-xl text-teal-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Manual Labor Allocation &amp; Site Transfer Command
                  </h4>
                  <p className="text-xs text-slate-400">
                    Directly reassign personnel and specialized crews across commercial sites. Distribution charts above sync in real time.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono bg-teal-950/80 border border-teal-800 text-teal-300 px-3 py-1 rounded-full font-bold self-start sm:self-center shrink-0 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                <span>Live Sync Active</span>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Personnel / Trade Selection */}
              <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Step 1: Select Personnel / Crew</span>
                  <span className="text-teal-400">{contractors.length} in Roster</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-slate-400 block">
                    Choose Worker to Reallocate:
                  </label>
                  <select
                    value={manualWorkerId}
                    onChange={(e) => setManualWorkerId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {contractors.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.roleTitle || c.specialty || 'Artisan'} ({c.activeProjectSite || 'Standby'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Worker Info Snapshot */}
                {selectedManualWorker && (
                  <div className="p-3 bg-slate-900/90 border border-slate-800/80 rounded-xl space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold">{selectedManualWorker.name}</span>
                      <span className="text-teal-400 text-[11px] font-bold">
                        {isOfficeOrExecutive(selectedManualWorker) 
                          ? 'Corporate' 
                          : isIndividualStaffOrEngineer(selectedManualWorker) 
                            ? '1 Professional' 
                            : `${selectedManualWorker.activeManpower || 1} Crew`}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 truncate">
                      {selectedManualWorker.roleTitle || selectedManualWorker.specialty || 'General Trade'} • {selectedManualWorker.company}
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Current Assignment:</span>
                      <span className="text-teal-300 font-bold bg-teal-950/70 border border-teal-800/60 px-2 py-0.5 rounded-md">
                        📍 {selectedManualWorker.activeProjectSite || 'General Standby Pool'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Reallocation & Destination Action */}
              <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Step 2: Choose Destination &amp; Deploy</span>
                  <span className="text-slate-500">{projects.length} Registered Sites</span>
                </div>

                {/* 1-Click Fast Destination Buttons */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-400 block">
                    1-Click Target Destination:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {projects.map(p => {
                      const isCurrent = (selectedManualWorker?.activeProjectSite || '').toLowerCase() === p.name.toLowerCase();
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setManualSite(p.name);
                            handleExecuteManualTransfer(p.name);
                          }}
                          disabled={isManualTransferring}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                            isCurrent
                              ? 'bg-teal-950 border border-teal-600 text-teal-300 font-bold'
                              : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          <MapPin className="w-3 h-3 text-teal-400" />
                          <span>{p.name}</span>
                          {isCurrent && <Check className="w-3 h-3 text-teal-400 ml-1" />}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        setManualSite('');
                        handleExecuteManualTransfer('');
                      }}
                      disabled={isManualTransferring}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                        !selectedManualWorker?.activeProjectSite || selectedManualWorker.activeProjectSite.toLowerCase().includes('standby')
                          ? 'bg-slate-800 border border-slate-600 text-white font-bold'
                          : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Standby Pool</span>
                    </button>
                  </div>
                </div>

                {/* Detailed Parameters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs pt-1">
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[11px] font-mono text-slate-400 block">
                      Target Project
                    </label>
                    <select
                      value={manualSite}
                      onChange={(e) => setManualSite(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-sans focus:border-teal-500 focus:outline-none"
                    >
                      <option value="">-- General Standby Pool --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[11px] font-mono text-slate-400 block">
                      Work Zone / Area
                    </label>
                    <input
                      type="text"
                      value={manualZone}
                      onChange={(e) => setManualZone(e.target.value)}
                      placeholder="e.g. Ground Floor, Level 2"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-sans focus:border-teal-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-mono text-slate-400 block">
                      Crew Size
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={manualCount}
                      onChange={(e) => setManualCount(Number(e.target.value) || 1)}
                      disabled={isIndividualStaffOrEngineer(selectedManualWorker) || isOfficeOrExecutive(selectedManualWorker)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-sans focus:border-teal-500 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Transfer Action Button */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Updates commercial_projects roster &amp; charts immediately
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExecuteManualTransfer(manualSite, manualZone, manualCount)}
                    disabled={isManualTransferring}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>{isManualTransferring ? 'Reallocating...' : 'Reallocate Manpower'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Workforce Optimization Engine */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600/30 border border-indigo-500/50 p-2.5 rounded-xl text-indigo-300">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold text-white flex items-center gap-1.5">
                      AI Workforce Optimization Engine
                    </h4>
                    <span className="bg-indigo-950 border border-indigo-700 text-indigo-300 text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      {recommendationQueue.length > 0
                        ? `${recommendationQueue.length} Recommendations Available`
                        : 'Queue Balanced'}
                    </span>
                    {recommendationQueue.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllRecCards(!showAllRecCards)}
                        className="text-[10px] font-mono text-indigo-300 hover:text-white bg-slate-900 hover:bg-indigo-950/80 border border-indigo-700/60 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer flex items-center gap-1"
                        title={showAllRecCards ? 'Switch to compact view' : 'Expand all cards'}
                      >
                        {showAllRecCards 
                          ? `Showing All ${recommendationQueue.length} (Click to Collapse)` 
                          : `Showing 3 of ${recommendationQueue.length} (Click to View All)`}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cross-project labor flow recommendations: transfers surplus specialized trades from near-completion sites to critical path projects.
                  </p>
                </div>
              </div>

              <button
                onClick={handleTriggerAiScan}
                disabled={isAiScanning}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold font-mono cursor-pointer transition-all flex items-center gap-2 shadow-md shadow-indigo-600/20 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAiScanning ? 'animate-spin' : ''}`} />
                <span>{isAiScanning ? 'Scanning All Commercial Sites...' : 'Run Multi-Site AI Scan'}</span>
              </button>
            </div>

            {aiScanMessage && (
              <div className="bg-indigo-950/80 border border-indigo-500 text-indigo-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 animate-fadeIn">
                <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{aiScanMessage}</span>
              </div>
            )}

            {/* Visual Transfer Flow Cards (Top 3 or All from Dynamic Queue) */}
            {(() => {
              const visibleCards = showAllRecCards ? recommendationQueue : recommendationQueue.slice(0, 3);

              // Helper for concise optimization category tags
              const getCategoryTag = (rec: AIManpowerRecommendation) => {
                const scope = (rec.suggestedScope || '').trim();
                if (
                  scope === 'Trade Deficit Offset' ||
                  scope === 'Idle Labor Mitigation' ||
                  scope === 'Timeline Compression' ||
                  scope === 'Critical Path Expedite'
                ) {
                  return scope;
                }
                const isStandby = (rec.donorProjectName || '').toLowerCase().includes('standby') ||
                  (rec.rationale || '').toLowerCase().includes('standby') ||
                  (rec.rationale || '').toLowerCase().includes('idle');
                if (isStandby) return 'Idle Labor Mitigation';

                if (
                  (rec.rationale || '').toLowerCase().includes('completion') ||
                  (rec.rationale || '').toLowerCase().includes('timeline') ||
                  (rec.rationale || '').toLowerCase().includes('velocity') ||
                  (rec.rationale || '').toLowerCase().includes('compress')
                ) {
                  return 'Timeline Compression';
                }

                if (rec.priority === 'HIGH' || (rec.rationale || '').toLowerCase().includes('critical') || (rec.rationale || '').toLowerCase().includes('expedite')) {
                  return 'Critical Path Expedite';
                }

                return 'Trade Deficit Offset';
              };

              const handleDismissCard = async (rec: AIManpowerRecommendation) => {
                const targetId = rec.id;
                try {
                  if (onDismissAIRecommendation) {
                    await onDismissAIRecommendation(targetId);
                  }
                  setRecommendationQueue(prev => prev.filter(r => r.id !== targetId));
                  notify('Recommendation dismissed.');
                } catch (err: any) {
                  console.error('Failed to dismiss recommendation:', err);
                  notify(`Failed to dismiss: ${err?.message || 'Server error'}`);
                }
              };

              const handleApproveCard = async (rec: AIManpowerRecommendation) => {
                const targetId = rec.id;
                setReallocatingId(targetId);
                try {
                  if (onApplyAIRecommendation) {
                    await onApplyAIRecommendation(targetId);
                  }
                  // Append to history and remove from queue ONLY after verified success
                  const acceptedItem: AIManpowerRecommendation = { ...rec, applied: true };
                  setAppliedTransfersHistory(prev => [acceptedItem, ...prev.filter(r => r.id !== targetId)]);
                  setRecommendationQueue(prev => prev.filter(r => r.id !== targetId));

                  const targetDisplay = rec.targetProjectName || rec.targetLots || 'Commercial Site';
                  const workerDisplay = rec.workerName || rec.contractorName;
                  notify(`Workforce transfer approved: ${workerDisplay} reallocated to "${targetDisplay}".`);
                } catch (err: any) {
                  console.error('Failed to approve reallocation:', err);
                  notify(`Failed to reallocate: ${err?.message || 'Database error'}`);
                } finally {
                  setReallocatingId(null);
                }
              };

              return (
                <div className="space-y-4 pt-1">
                  {visibleCards.length === 0 ? (
                    <div className="py-12 px-4 flex flex-col items-center justify-center text-slate-500 space-y-3 text-center border border-dashed border-slate-800/80 rounded-2xl bg-slate-950/40 animate-fadeIn">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-950/70 border border-indigo-700/50 flex items-center justify-center text-indigo-400 shadow-inner">
                        <Bot className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h5 className="text-sm font-bold text-slate-200">
                          All sites balanced. No immediate reallocation needed.
                        </h5>
                        <p className="text-xs text-slate-400 max-w-md">
                          All specialized trade demands and active site timelines are in equilibrium. Click "Run Multi-Site AI Scan" above to re-analyze active projects for new trade flow opportunities.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visibleCards.map((rec) => {
                        const donorDisplay = rec.donorProjectName || (rec.title.includes('from') ? rec.title.split('from')[1]?.split('to')[0]?.replace(/"/g, '').trim() : 'General Standby Pool');
                        const targetDisplay = rec.targetProjectName || rec.targetLots || 'Commercial Site';
                        const workerDisplay = rec.workerName || rec.contractorName;
                        const crewDelta = rec.recommendedHeadcount - rec.currentHeadcount > 0 ? rec.recommendedHeadcount - rec.currentHeadcount : 1;

                        const isHigh = rec.priority === 'HIGH';
                        const isMed = rec.priority === 'MEDIUM';
                        const priorityBadgeClass = isHigh
                          ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                          : isMed
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                            : 'bg-slate-800 text-slate-300 border-slate-700';

                        const priorityLabel = isHigh ? 'HIGH' : isMed ? 'MEDIUM' : 'LOW';

                        // Concise Optimization Category Tag
                        const categoryTag = getCategoryTag(rec);
                        const fitScore = typeof rec.confidenceScore === 'number' ? rec.confidenceScore : null;
                        const isReallocating = reallocatingId === rec.id;
                        const isExpanded = Boolean(expandedRecIds[rec.id]);

                        return (
                          <div
                            key={rec.id}
                            className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden transition-all text-xs"
                          >
                            <div className="p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                              {/* Left: Worker & Route */}
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-300 font-bold shrink-0">
                                  {workerDisplay.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-white text-xs truncate">{workerDisplay}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">({rec.tradeType || 'General'})</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-teal-300 border border-slate-700">
                                      {crewDelta > 1 ? `+${crewDelta} Crew` : '1 Artisan'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                                    <span className="truncate max-w-[140px] text-slate-300" title={donorDisplay}>{donorDisplay}</span>
                                    <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                                    <span className="truncate max-w-[140px] text-amber-300 font-semibold" title={targetDisplay}>{targetDisplay}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Middle: Priority, Fit, AI Provider Badges */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${priorityBadgeClass}`}>
                                  {priorityLabel}
                                </span>
                                {fitScore !== null && (
                                  <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                    Fit: {fitScore}/100
                                  </span>
                                )}
                                {rec.source === 'GEMINI_AI' ? (
                                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border bg-indigo-950/80 text-indigo-300 border-indigo-700/80">
                                    Gemini AI
                                  </span>
                                ) : rec.source === 'GROQ_AI' ? (
                                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border bg-amber-950/80 text-amber-300 border-amber-700/80">
                                    Groq AI
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border bg-slate-900 text-amber-300 border-amber-800/80">
                                    Rule-Based
                                  </span>
                                )}
                              </div>

                              {/* Right: Controls */}
                              <div className="flex items-center gap-2 shrink-0 justify-end">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandRec(rec.id)}
                                  className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
                                  title={isExpanded ? 'Collapse Rationale' : 'Expand Rationale'}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDismissCard(rec)}
                                  className="px-2.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-xs font-mono transition cursor-pointer"
                                >
                                  Dismiss
                                </button>
                                <button
                                  type="button"
                                  disabled={isReallocating}
                                  onClick={() => handleApproveCard(rec)}
                                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  {isReallocating ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      <span>Applying...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>Approve</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Expandable Rationale Details */}
                            {isExpanded && (
                              <div className="px-3.5 pb-3 pt-1 border-t border-slate-800/60 bg-slate-900/40 text-xs text-slate-300 space-y-1">
                                <div className="text-[10px] font-mono text-amber-400 uppercase font-bold tracking-wider">
                                  AI Optimization Rationale ({categoryTag}):
                                </div>
                                <p className="leading-relaxed text-slate-300 text-[11px]">
                                  {rec.rationale || rec.impact || 'Mitigates critical path delay for milestone delivery.'}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!showAllRecCards && recommendationQueue.length > 3 && (
                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => setShowAllRecCards(true)}
                        className="text-xs font-mono font-medium text-indigo-300 hover:text-white bg-slate-950/80 hover:bg-slate-900 border border-indigo-900/60 hover:border-indigo-700 px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 mx-auto"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Show all {recommendationQueue.length} recommendations in deck</span>
                      </button>
                    </div>
                  )}
                  {showAllRecCards && recommendationQueue.length > 3 && (
                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => setShowAllRecCards(false)}
                        className="text-xs font-mono font-medium text-slate-400 hover:text-slate-200 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl transition cursor-pointer mx-auto"
                      >
                        Collapse to top 3 cards
                      </button>
                    </div>
                  )}

                  {/* Applied Transfers History Drawer */}
                  {appliedTransfersHistory.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => setShowAppliedRecsHistory(prev => !prev)}
                        className="w-full flex items-center justify-between py-2 px-4 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono transition-all cursor-pointer text-slate-400 hover:text-slate-200"
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          <CheckCheck className="w-4 h-4 text-emerald-400" />
                          <span>Applied Transfers History ({appliedTransfersHistory.length})</span>
                        </span>
                        {showAppliedRecsHistory ? (
                          <ChevronUp className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </button>

                      {showAppliedRecsHistory && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3 animate-fadeIn">
                          {appliedTransfersHistory.map((rec) => {
                            const donorDisplay = rec.donorProjectName || 'General Standby Pool';
                            const targetDisplay = rec.targetProjectName || rec.targetLots;
                            const workerDisplay = rec.workerName || rec.contractorName;

                            return (
                              <div
                                key={rec.id}
                                className="bg-emerald-950/15 border border-emerald-500/40 rounded-xl p-3 space-y-2 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-emerald-300 font-bold flex items-center gap-1">
                                    <CheckCheck className="w-3 h-3 text-emerald-400" /> DEPLOYED
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {rec.tradeType || 'Workforce'}
                                  </span>
                                </div>
                                <div className="font-bold text-white truncate text-xs">
                                  {workerDisplay}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                                  <span className="truncate max-w-[45%] text-slate-300">{donorDisplay}</span>
                                  <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="truncate max-w-[45%] text-teal-300 font-semibold">{targetDisplay}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-emerald-900/40">
                                  <span className="text-emerald-400/80">
                                    {rec.source === 'GEMINI_AI' ? 'Source: Gemini AI' : rec.source === 'GROQ_AI' ? 'Source: Groq AI' : 'Source: Rule-Based Fallback'}
                                  </span>
                                  <span className="text-slate-400 truncate max-w-[50%]">{rec.approvedByUserName ? `By: ${rec.approvedByUserName}` : 'Approved'}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
};

export default LaborWorkforceArtisanTrades;
