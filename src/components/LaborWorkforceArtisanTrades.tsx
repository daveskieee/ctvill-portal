/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users, HardHat, ShieldCheck, AlertTriangle, Award, BadgeAlert,
  BarChart3, Building, PieChart, RefreshCw, Sparkles, Bot, Zap,
  X, CheckCircle, CheckCheck, ChevronUp, ChevronDown, ArrowRight,
  Lightbulb, ClipboardList, Plus, TrendingUp, Check
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import {
  Contractor, DailyManpowerAudit, AIManpowerRecommendation,
  ProjectProfile
} from '../types';
import WorkforceMessengerRoster from './WorkforceMessengerRoster';
import SubcontractorRollCallAudits from './SubcontractorRollCallAudits';

export interface LaborWorkforceArtisanTradesProps {
  contractors: Contractor[];
  manpowerAudits: DailyManpowerAudit[];
  projects: ProjectProfile[];
  aiRecommendations: AIManpowerRecommendation[];
  isAiScanning: boolean;
  aiScanMessage: string;
  handleTriggerAiScan: () => void;
  onApplyAIRecommendation?: (recId: string) => void;
  onDismissAIRecommendation?: (recId: string) => void;
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
  /** Forces an initial sub-tab. Used by Finance to land directly on Audits. */
  initialTab?: WorkforceTabId;
  readOnly?: boolean;
  isFinance?: boolean;
  hideTabs?: boolean;
}

export type WorkforceTabId = 'directory' | 'analytics' | 'audits';

const TABS: { id: WorkforceTabId; label: string; icon: React.ElementType }[] = [
  { id: 'directory', label: 'Personnel Directory & Roster', icon: Users },
  { id: 'analytics', label: 'Workforce Allocation & Analytics', icon: BarChart3 },
  { id: 'audits', label: 'Subcontractor Roll-Call Audits', icon: ShieldCheck },
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
  const [activeSubTab, setActiveSubTab] = useState<WorkforceTabId>(initialTab ?? 'directory');
  const [reallocatingId, setReallocatingId] = useState<string | null>(null);
  const [recommendationQueue, setRecommendationQueue] = useState<AIManpowerRecommendation[]>([]);
  const [appliedTransfersHistory, setAppliedTransfersHistory] = useState<AIManpowerRecommendation[]>([]);

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

  const isDedicatedAuditView = hideTabs || (readOnly && initialTab === 'audits') || (isFinance && initialTab === 'audits');

  return (
    <div className="space-y-6">
      
      {/* Top Header & Tab Switcher - Hidden in dedicated audit view */}
      {!isDedicatedAuditView && (
        <>
          {/* Top Header */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse"></span>
                <span className="text-[10px] font-mono text-teal-400 font-bold uppercase tracking-wider">LIVE WORKFORCE OPERATIONS</span>
              </div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-teal-400" />
                Labor Workforce &amp; Artisan Trades
              </h3>
              <p className="text-xs text-slate-400 mt-1">Verified site artisans, trade specialties, daily wage rates, active site deployments, and live attendance tracking.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-teal-950 border border-teal-800 text-teal-300 text-xs font-mono px-3 py-2 rounded-xl font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{totalManpower} Workers On-Site</span>
              </span>
            </div>
          </div>

          {/* Top-Level Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {TABS.map(tab => {
          const isActive = activeSubTab === tab.id;
          const IconComponent = tab.icon;
          const count = tab.id === 'directory' ? totalManpower : tab.id === 'audits' ? manpowerAudits.length : undefined;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold font-mono transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-teal-500/25 text-teal-200'
                    : 'bg-slate-800 text-slate-400'
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
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">TOTAL FIELD PERSONNEL</span>
                <HardHat className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                <span>{totalManpower}</span>
                <span className="text-xs text-slate-400 font-normal">Laborers</span>
              </div>
              <span className="text-[10px] text-teal-400 block font-mono">{contractors.length} Registered Entities</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">IN-HOUSE CORE STAFF</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-300 flex items-baseline gap-1.5">
                <span>{inHouseCount}</span>
                <span className="text-xs text-slate-400 font-normal">Permanent</span>
              </div>
              <span className="text-[10px] text-emerald-400/80 block font-mono">{inHouseRatio}% of Total Workforce</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">OUTSOURCED CREWS</span>
                <Building className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-300 flex items-baseline gap-1.5">
                <span>{outsourcedCount}</span>
                <span className="text-xs text-slate-400 font-normal">Contractors</span>
              </div>
              <span className="text-[10px] text-amber-400/80 block font-mono">Specialized Trade Partners</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span className="uppercase">ACTIVE SITE DEPLOYMENTS</span>
                <Award className="w-4 h-4 text-teal-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-teal-300 flex items-baseline gap-1.5">
                <span>{deployedFieldContractors.length}</span>
                <span className="text-xs text-slate-400 font-normal">Active Teams</span>
              </div>
              <span className="text-[10px] text-teal-400/90 block font-mono">Mapped to Commercial Sites</span>
            </div>
          </div>

          {/* Visual Workforce Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Manpower Headcount Deployed per Commercial Project */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-400" />
                    Labor Allocation by Commercial Site
                  </h4>
                  <p className="text-xs text-slate-400">Physical workforce distribution across active project sites</p>
                </div>
                <span className="text-[10px] font-mono bg-teal-950 border border-teal-800 text-teal-300 px-2.5 py-1 rounded-full font-bold">
                  {projectLaborChartData.reduce((sum, p) => sum + p.workers, 0)} Total Assigned
                </span>
              </div>

              {projectLaborChartData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-4">
                  <Building className="w-8 h-8 text-slate-600" />
                  <span className="text-xs font-semibold text-slate-400">No Commercial Sites Registered</span>
                  <span className="text-[11px] text-slate-600">Register a commercial project site to track labor distribution.</span>
                </div>
              ) : (
                <>
                  <div className="h-64 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReBarChart data={projectLaborChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1 font-sans pointer-events-none select-none">
                                  <div className="font-bold text-white">{data.fullName}</div>
                                  <div className="text-teal-400 font-mono font-bold">{data.workers} Active Workers</div>
                                  <div className="text-slate-300 font-mono">Completion: {data.progress}%</div>
                                  <div className="text-[10px] text-slate-400 font-mono uppercase">{data.status}</div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="workers" radius={[6, 6, 0, 0]}>
                          {projectLaborChartData.map((_entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4'][index % 6]} 
                            />
                          ))}
                        </Bar>
                      </ReBarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                    {projectLaborChartData.slice(0, 4).map((p, i) => (
                      <div key={i} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 space-y-1">
                        <div className="font-bold text-white truncate text-xs">{p.name}</div>
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="text-teal-400 font-bold">{p.workers} Crew</span>
                          <span className="text-slate-400">{p.progress}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-400 rounded-full" style={{ width: `${p.progress}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Chart 2: Engineering Specialty & Trade Distribution Donut */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-400" />
                    Trade Discipline &amp; Specialty Breakdown
                  </h4>
                  <p className="text-xs text-slate-400">Headcount distribution across specialized construction trades</p>
                </div>
                <span className="text-[10px] font-mono bg-indigo-950 border border-indigo-800 text-indigo-300 px-2.5 py-1 rounded-full font-bold">
                  {tradeManpowerChartData.length} Specialized Trades
                </span>
              </div>

              {tradeManpowerChartData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-4">
                  <Users className="w-8 h-8 text-slate-600" />
                  <span className="text-xs font-semibold text-slate-400">No Trade Workers Registered</span>
                  <span className="text-[11px] text-slate-600">Click &quot;Register Worker&quot; above to add construction personnel and trades.</span>
                </div>
              ) : (
                (() => {
                  const totalCrew = tradeManpowerChartData.reduce((sum, item) => sum + (item.value || 0), 0);

                  return (
                    <>
                      <div className="h-64 w-full flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={tradeManpowerChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
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

            {/* Chart 4: Employment Mix: In-House Core vs Outsourced Partners */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-4 lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    Workforce Structure: In-House vs Outsourced
                  </h4>
                  <p className="text-xs text-slate-400">Direct employee supervision vs subcontractor specialized capacity</p>
                </div>
                <span className="text-[10px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-300 px-2.5 py-1 rounded-full font-bold">
                  {contractors.length} Total Workforce Entities
                </span>
              </div>

              {employmentMixChartData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-4">
                  <Users className="w-8 h-8 text-slate-600" />
                  <span className="text-xs font-semibold text-slate-400">No Workforce Registered</span>
                  <span className="text-[11px] text-slate-600">Register in-house personnel or subcontracted trade partners to view organizational mix.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="h-56 w-full flex items-center justify-center relative md:col-span-1">
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
                      <span className="text-xl font-black font-mono text-emerald-400">
                        {inHouseRatio}%
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">In-House</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:col-span-2 text-xs">
                    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                        <span>CTVill In-House Core</span>
                      </div>
                      <div className="text-2xl font-black font-mono text-emerald-300">{inHouseCount} Staff</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Permanent Engineers, Foremen & Core Skilled Trades directly under company payroll.</p>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                        <span>Outsourced Trade Partners</span>
                      </div>
                      <div className="text-2xl font-black font-mono text-amber-300">{outsourcedCount} Workers</div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Specialized Subcontractors, MEPFS Teams & Manpower Suppliers deployed per milestone.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* AI Workforce Optimization Engine */}
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 shadow-lg space-y-4">
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
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                        Showing 3 of {recommendationQueue.length} (Deck Auto-Replenishes)
                      </span>
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

            {/* Visual Transfer Flow Cards (Top 3 from Dynamic Queue) */}
            {(() => {
              const visibleCards = recommendationQueue.slice(0, 3);

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

              const handleDismissCard = (rec: AIManpowerRecommendation) => {
                const targetId = rec.id;
                // Auto-replenish: remove dismissed item from queue
                setRecommendationQueue(prev => prev.filter(r => r.id !== targetId));
                if (onDismissAIRecommendation) {
                  onDismissAIRecommendation(targetId);
                }
                notify('AI recommendation dismissed. Feedback logged.');
              };

              const handleApproveCard = async (rec: AIManpowerRecommendation) => {
                const targetId = rec.id;
                setReallocatingId(targetId);
                try {
                  if (onApplyAIRecommendation) {
                    await onApplyAIRecommendation(targetId);
                  }
                  // Append to history and remove from queue to auto-replenish next in line
                  const acceptedItem: AIManpowerRecommendation = { ...rec, applied: true };
                  setAppliedTransfersHistory(prev => [acceptedItem, ...prev.filter(r => r.id !== targetId)]);
                  setRecommendationQueue(prev => prev.filter(r => r.id !== targetId));

                  const targetDisplay = rec.targetProjectName || rec.targetLots || 'Commercial Site';
                  const workerDisplay = rec.workerName || rec.contractorName;
                  notify(`AI transfer approved: ${workerDisplay} reallocated to "${targetDisplay}".`);
                } catch (err) {
                  console.error('Failed to approve reallocation:', err);
                  notify('Failed to reallocate worker.');
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

                        const priorityLabel = isHigh ? 'HIGH PRIORITY' : isMed ? 'MEDIUM PRIORITY' : 'LOW';

                        // Concise Optimization Category Tag
                        const categoryTag = getCategoryTag(rec);
                        const categoryBadgeClass =
                          categoryTag === 'Idle Labor Mitigation'
                            ? 'bg-amber-950/70 text-amber-300 border-amber-800/80'
                            : categoryTag === 'Timeline Compression'
                              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80'
                              : categoryTag === 'Critical Path Expedite'
                                ? 'bg-rose-950/70 text-rose-300 border-rose-800/80'
                                : 'bg-indigo-950/70 text-indigo-300 border-indigo-800/80';

                        // Fit/Confidence score
                        const fitScore = (rec as any).fitScore || (isHigh ? 96 : isMed ? 92 : 88);

                        // Origin & Target subtitles
                        const originSubtitle = rec.donorProjectName ? 'Standby Pool • Idle' : 'Standby Pool • Idle';
                        const targetSubtitle = rec.targetLots ? `Phase: Lots ${rec.targetLots}` : 'Phase: Structural Framing';

                        const isReallocating = reallocatingId === rec.id;

                        return (
                          <div 
                            key={rec.id} 
                            className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4.5 space-y-4 transition-all flex flex-col justify-between shadow-md animate-fadeIn"
                          >
                            <div className="space-y-3.5">
                              {/* 1. CARD HEADER */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border tracking-wider ${priorityBadgeClass}`}>
                                    {priorityLabel}
                                  </span>
                                  <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${categoryBadgeClass}`}>
                                    {categoryTag}
                                  </span>
                                </div>

                                <div className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 shadow-xs">
                                  <Sparkles className="w-3 h-3 text-emerald-400" />
                                  <span>{fitScore}% Fit Score</span>
                                </div>
                              </div>

                              {/* 2. WORKER PROFILE & ROUTE VISUALIZER */}
                              <div className="space-y-2.5">
                                {/* Worker Profile Header */}
                                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 font-bold text-xs shrink-0">
                                      <Users className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white truncate">{workerDisplay}</div>
                                      <div className="text-[10px] text-slate-400 font-mono truncate">{rec.tradeType || 'Specialized Trade Artisan'}</div>
                                    </div>
                                  </div>
                                  <span className="bg-teal-950/80 border border-teal-800/80 text-teal-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold shrink-0">
                                    {crewDelta > 1 ? `+${crewDelta} Crew` : '1 Artisan'}
                                  </span>
                                </div>

                                {/* Route Container */}
                                <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-2 shadow-inner">
                                  {/* Origin Project Box */}
                                  <div className="flex-1 min-w-0 bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 space-y-0.5">
                                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider block font-semibold">
                                      Origin Project
                                    </span>
                                    <div className="text-xs font-bold text-slate-200 truncate" title={donorDisplay}>
                                      {donorDisplay}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono truncate block" title={originSubtitle}>
                                      {originSubtitle}
                                    </span>
                                  </div>

                                  {/* Center Directional Arrow */}
                                  <div className="flex flex-col items-center shrink-0 px-1">
                                    <div className="w-7 h-7 rounded-full bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-300 shadow-sm">
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    </div>
                                  </div>

                                  {/* Target Project Box */}
                                  <div className="flex-1 min-w-0 bg-slate-900/80 border border-slate-800/80 rounded-lg p-2.5 space-y-0.5 text-right">
                                    <span className="text-[9px] text-teal-400 font-mono uppercase tracking-wider block font-semibold">
                                      Target Project
                                    </span>
                                    <div className="text-xs font-bold text-teal-300 truncate" title={targetDisplay}>
                                      {targetDisplay}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono truncate block" title={targetSubtitle}>
                                      {targetSubtitle}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* 3. IMPACT STATEMENT BANNER */}
                              <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900/60 to-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-100 shadow-xs">
                                <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                                    Operational Impact
                                  </span>
                                  <p className="leading-relaxed text-slate-200 text-xs">
                                    {rec.rationale || rec.impact || 'Mitigates critical path delay for milestone delivery.'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* 4. CARD ACTIONS */}
                            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleDismissCard(rec)}
                                className="px-3 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer"
                              >
                                Dismiss
                              </button>

                              <button
                                type="button"
                                disabled={isReallocating}
                                onClick={() => handleApproveCard(rec)}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-60"
                              >
                                {isReallocating ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Reallocating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-white" />
                                    <span>Approve Reallocation</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
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

      {/* ------------------------------------------------------------- */}
      {/* SUB-TAB 3: SUBCONTRACTOR ROLL-CALL AUDITS                     */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'audits' && (
        <SubcontractorRollCallAudits
          manpowerAudits={manpowerAudits}
          projects={projects}
          contractors={contractors}
          readOnly={readOnly}
          isFinance={isFinance}
          onLogAuditClick={readOnly || isFinance ? undefined : onLogAuditClick}
          notify={notify}
        />
      )}

    </div>
  );
};

export default LaborWorkforceArtisanTrades;
