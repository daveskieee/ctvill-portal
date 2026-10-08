/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, Calendar, HardHat, Check, X, Clock, AlertCircle, 
  Lock, RefreshCw, CheckCircle2, Search, ArrowRight, UserCheck, 
  ShieldCheck, Info, Sparkles, AlertTriangle
} from 'lucide-react';
import { ProjectProfile, SiteWorker, AttendanceRecord, AttendanceStatus, UserSession } from '../types';
import { normalizeRole, UserRole, getAttendanceCapabilities } from '../utils/rbac';

interface TimekeeperAttendanceDashboardProps {
  projects: ProjectProfile[];
  session?: UserSession | any;
  onRefreshData?: () => void;
  onNotify?: (msg: string) => void;
}

export default function TimekeeperAttendanceDashboard({
  projects,
  session,
  onRefreshData
}: TimekeeperAttendanceDashboardProps) {
  // State
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [workers, setWorkers] = useState<SiteWorker[]>([]);
  const setArtisans = setWorkers;
  const [hasLoadedArtisans, setHasLoadedArtisans] = useState<boolean>(false);
  const [existingLogs, setExistingLogs] = useState<AttendanceRecord[]>([]);
  const [localAttendance, setLocalAttendance] = useState<Map<string, { status: AttendanceStatus; otHours: number; id?: string; isLocked?: boolean }>>(new Map());
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDateLocked, setIsDateLocked] = useState<boolean>(false);
  const [isEndorsed, setIsEndorsed] = useState<boolean>(false);
  
  // OM Administrative Override Confirmation Modal State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');

  // RBAC Hierarchy Context
  const currentRole = normalizeRole(session?.role);
  const capabilities = getAttendanceCapabilities(currentRole);
  const isOM = currentRole === UserRole.OM;
  const isPM = currentRole === UserRole.PM;
  const isTimekeeper = currentRole === UserRole.TIMEKEEPER;
  const isFinance = currentRole === UserRole.FINANCE || session?.role === 'FINANCE';

  // Auto-clear toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Sync selected project with user assigned project if applicable
  useEffect(() => {
    if (session?.projectIds && session.projectIds.length > 0) {
      if (!session.projectIds.includes(selectedProjectId)) {
        setSelectedProjectId(session.projectIds[0]);
      }
    } else if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [session, projects]);

  // Fetch workers & existing attendance logs when project or date changes
  const loadData = async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    setHasLoadedArtisans(false);
    try {
      // 1. Fetch only ACTIVE workers for this project roll-call (try /api/attendance/roster first, fallback to /api/workers)
      let rawWorkersData: SiteWorker[] = [];
      const rosterRes = await fetch(`/api/attendance/roster?projectId=${selectedProjectId}&status=Active&onlyArtisans=true`, {
        headers: { 'x-user-role': session?.role || 'TIMEKEEPER', 'x-user-id': session?.id || '' }
      });
      if (rosterRes.ok) {
        rawWorkersData = await rosterRes.json();
      } else {
        const workersRes = await fetch(`/api/workers?projectId=${selectedProjectId}&status=Active&onlyArtisans=true`, {
          headers: { 'x-user-role': session?.role || 'TIMEKEEPER', 'x-user-id': session?.id || '' }
        });
        if (workersRes.ok) rawWorkersData = await workersRes.json();
      }

      // Filter strictly to individual field artisans (Artisan / In-House Labor / Direct Hire)
      // Exclude Executive/Office staff, Trade Crews, Manpower Supply Agencies, and Outsourced Subcontractors
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      const workersData: SiteWorker[] = [];
      for (const w of rawWorkersData) {
        if (!w || !w.id) continue;
        if (w.status && w.status.toLowerCase() !== 'active') continue;

        // Exclude Executive/Office/Corporate personnel from daily labor roll-call
        if (
          w.workforceClass === 'Corporate' ||
          (w as any).workforce_class === 'Corporate'
        ) {
          continue;
        }

        // Exclude Subcontractor Trade Crews, Manpower Supply agencies, and Outsourced Partners
        // These entities bill through Contractor Progress Invoices based on verified audit headcounts, NOT internal payroll
        if (
          w.workforceClass === 'Trade Crew' ||
          (w as any).workforce_class === 'Trade Crew' ||
          w.workforceClass === 'Subcontractor' ||
          (w as any).workforce_class === 'Subcontractor' ||
          (w as any).employmentType === 'OUTSOURCED' ||
          ((w as any).activeManpower && (w as any).activeManpower > 1)
        ) {
          continue;
        }

        const normName = (w.name || '').trim().toLowerCase();
        const pos = (w.position || w.trade || '').toLowerCase();
        const comp = ((w as any).company || '').toLowerCase();

        // Additional guard against crew providers or agency titles
        if (
          normName.includes('manpower supply') ||
          normName.includes('trade crew') ||
          normName.includes('facilities maintenance') ||
          normName.includes('subcontractor') ||
          pos.includes('manpower supply') ||
          pos.includes('trade crew') ||
          pos.includes('subcontractor') ||
          comp.includes('manpower supply') ||
          comp.includes('facilities maintenance')
        ) {
          continue;
        }

        if (
          pos.includes('corporate') ||
          pos.includes('office') ||
          pos.includes('coo') ||
          pos.includes('chief operating officer') ||
          pos.includes('ceo') ||
          pos.includes('chief executive') ||
          pos.includes('director') ||
          pos.includes('general manager') ||
          pos.includes('president') ||
          pos.includes('vice president') ||
          pos.includes('vp') ||
          pos.includes('admin') ||
          pos.includes('administration') ||
          pos.includes('finance') ||
          pos.includes('human resource') ||
          pos.includes('hr') ||
          pos.includes('procurement') ||
          pos.includes('accountant') ||
          pos.includes('project manager')
        ) {
          continue;
        }

        if (!seenIds.has(w.id) && (!normName || !seenNames.has(normName))) {
          seenIds.add(w.id);
          if (normName) seenNames.add(normName);
          workersData.push({
            ...w,
            workforceClass: 'Artisan' // Guaranteed individual in-house artisan
          });
        }
      }
      setWorkers(workersData);

      // 2. Fetch existing logs for this date
      const logsRes = await fetch(`/api/attendance?projectId=${selectedProjectId}&date=${selectedDate}`, {
        headers: { 'x-user-role': session?.role || 'TIMEKEEPER', 'x-user-id': session?.id || '' }
      });
      const logsData: AttendanceRecord[] = logsRes.ok ? await logsRes.json() : [];
      setExistingLogs(logsData);

      // Check if date is locked by finalized payroll
      const isPeriodLockedHeader = logsRes.headers.get('x-period-locked') === 'true';
      const locked = isPeriodLockedHeader || logsData.some(l => l.isLocked);
      setIsDateLocked(locked);

      // Build local map
      const map = new Map<string, { status: AttendanceStatus; otHours: number; id?: string; isLocked?: boolean }>();
      
      // Seed with existing logs or defaults
      for (const w of workersData) {
        const existing = logsData.find(l => l.workerId === w.id);
        if (existing) {
          map.set(w.id, {
            status: existing.status,
            otHours: existing.overtimeHours,
            id: existing.id,
            isLocked: existing.isLocked
          });
        } else {
          // Default to PRESENT for assigned workers on site
          map.set(w.id, {
            status: 'PRESENT',
            otHours: 0,
            isLocked: false
          });
        }
      }
      setLocalAttendance(map);
      setHasLoadedArtisans(true);
    } catch (err) {
      console.error('Error loading attendance data:', err);
      setToastMessage({ text: 'Failed to load attendance logs.', type: 'error' });
      setHasLoadedArtisans(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProjectId, selectedDate]);

  // Handle project selector change: immediately clear artisans and set loading to prevent stale UI
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setArtisans([]);
    setIsLoading(true);
    setHasLoadedArtisans(false);
  };

  // Toggle worker status
  const handleSetStatus = (workerId: string, status: AttendanceStatus) => {
    if (isDateLocked) return;
    setLocalAttendance(prev => {
      const next = new Map(prev);
      const curr = next.get(workerId) || { status: 'PRESENT', otHours: 0 };
      next.set(workerId, { ...curr, status });
      return next;
    });
  };

  // Update OT Hours
  const handleSetOt = (workerId: string, otHours: number) => {
    if (isDateLocked) return;
    setLocalAttendance(prev => {
      const next = new Map(prev);
      const curr = next.get(workerId) || { status: 'PRESENT', otHours: 0 };
      next.set(workerId, { ...curr, otHours: Math.max(0, otHours) });
      return next;
    });
  };

  // Quick Batch actions
  const handleSetAll = (status: AttendanceStatus) => {
    if (isDateLocked) return;
    setLocalAttendance(prev => {
      const next = new Map(prev);
      for (const [wId, val] of next.entries()) {
        next.set(wId, { ...val, status });
      }
      return next;
    });
    setToastMessage({ text: `Set all workers to ${status}`, type: 'info' });
  };

  // Initiate Submit or Trigger OM Override Modal
  const handleInitiateSubmit = () => {
    if (!selectedProjectId || isDateLocked || isSubmitting || workers.length === 0) return;
    if (isOM) {
      setOverrideReason('');
      setShowOverrideModal(true);
    } else {
      handleSubmitBatch();
    }
  };

  // Submit Batch Attendance
  const handleSubmitBatch = async (customReason?: string) => {
    if (!selectedProjectId || isDateLocked || isSubmitting) return;

    const records = Array.from(localAttendance.entries()).map(([workerId, entry]) => ({
      workerId,
      status: entry.status,
      overtimeHours: entry.otHours
    }));

    if (records.length === 0) {
      setToastMessage({ text: 'No workers found to submit attendance.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        projectId: selectedProjectId,
        date: selectedDate,
        records
      };

      if (isOM) {
        const finalReason = (customReason !== undefined ? customReason : overrideReason).trim();
        const userId = session?.id || session?.userId || 'USR-OM';
        payload.override_reason = finalReason;
        payload.overrideReason = finalReason;
        payload.overridden_by = userId;
        payload.overriddenBy = userId;
      }

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': session?.role || 'TIMEKEEPER',
          'x-user-id': session?.id || ''
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit attendance');
      }

      setShowOverrideModal(false);
      setOverrideReason('');

      setToastMessage({ 
        text: isOM 
          ? `Administrative attendance override logged successfully!`
          : `Daily attendance logged successfully for ${data.count} workers!`, 
        type: 'success' 
      });

      // Reload fresh logs
      await loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Error submitting attendance', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) return workers;
    const q = searchQuery.toLowerCase();
    return workers.filter(w => 
      w.name.toLowerCase().includes(q) || 
      w.position.toLowerCase().includes(q)
    );
  }, [workers, searchQuery]);

  // Daily Statistics calculation
  const stats = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let totalOt = 0;

    for (const [_, entry] of localAttendance.entries()) {
      if (entry.status === 'PRESENT') present++;
      else if (entry.status === 'HALF_DAY') halfDay++;
      else if (entry.status === 'ABSENT') absent++;
      totalOt += Number(entry.otHours || 0);
    }

    return {
      total: workers.length,
      present,
      halfDay,
      absent,
      totalOt
    };
  }, [localAttendance, workers]);

  const activeProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md border animate-slideDown ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50' 
            : toastMessage.type === 'error'
            ? 'bg-red-950/90 text-red-200 border-red-500/50'
            : 'bg-amber-950/90 text-amber-200 border-amber-500/50'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {toastMessage.type === 'info' && <Info className="w-4 h-4 text-amber-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner / Attendance Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isTimekeeper 
                ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' 
                : isPM 
                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Daily In-House Artisan Roll-Call &amp; Timesheet (Direct Payroll)
                </h1>
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold border ${
                  isFinance
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    : isDateLocked
                    ? 'bg-slate-800 text-slate-400 border-slate-700/80 shadow-xs'
                    : isTimekeeper
                    ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                    : isPM
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}>
                  {isFinance
                    ? 'AUDIT & READ-ONLY (FINANCE)'
                    : isDateLocked
                    ? 'OM OVERRIDE & AUDIT (FINALIZED & LOCKED)'
                    : isTimekeeper
                    ? 'TIMEKEEPER PORTAL'
                    : isPM
                    ? 'PM ENDORSEMENT MODE'
                    : 'OM OVERRIDE & AUDIT'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isTimekeeper
                  ? 'Fast in-house artisan roll-call logging • Direct automated link to weekly payroll processing'
                  : isPM
                  ? 'Review, verify, and endorse in-house artisan attendance logs for weekly direct payroll'
                  : 'Company-wide in-house artisan attendance review, administrative back-fill, and payroll audit oversight'}
              </p>
            </div>
          </div>
        </div>

        {/* User Session Info Pill */}
        <div className="flex items-center gap-3 self-end md:self-auto bg-slate-950/60 border border-slate-800 px-3.5 py-2 rounded-xl text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <div className="text-right">
            <div className="font-semibold text-white">{session?.name || (isTimekeeper ? 'Site Timekeeper' : isPM ? 'Site Project Manager' : 'Operations Manager')}</div>
            <div className="text-[10px] text-slate-400 font-mono">Logged by: {session?.email || (isTimekeeper ? 'timekeeper@ctvill.com' : 'user@ctvill.com')}</div>
          </div>
        </div>
      </div>

      {/* Filter & Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
          
          {/* Project Selector */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5 text-amber-400" />
              <span>Assigned Construction Site</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Attendance Date</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              {...(!isOM ? { max: new Date().toISOString().split('T')[0] } : {})}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            />
          </div>

          {/* Search Worker Input */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search Worker / Position</span>
            </label>
            <input
              type="text"
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Refresh Button */}
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Locked Notice if applicable */}
        {isDateLocked && (
          <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span><strong>Records Locked:</strong> Attendance for this project date has been finalized into a Finance Payroll Run. Modifications are restricted to prevent wage discrepancy.</span>
            </div>
            <span className="font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">FINALIZED RUN</span>
          </div>
        )}

        {/* Quick Batch Bar */}
        {!isDateLocked && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Quick Batch:</span>
              <button
                disabled={isFinance}
                onClick={() => handleSetAll('PRESENT')}
                className={isFinance ? "opacity-50 cursor-not-allowed pointer-events-none px-2.5 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded-lg text-[11px] font-medium" : "px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"}
              >
                Mark All Present
              </button>
              <button
                disabled={isFinance}
                onClick={() => handleSetAll('HALF_DAY')}
                className={isFinance ? "opacity-50 cursor-not-allowed pointer-events-none px-2.5 py-1 bg-amber-950/60 text-amber-300 border border-amber-800/60 rounded-lg text-[11px] font-medium" : "px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"}
              >
                Mark All Half-Day
              </button>
              <button
                disabled={isFinance}
                onClick={() => handleSetAll('ABSENT')}
                className={isFinance ? "opacity-50 cursor-not-allowed pointer-events-none px-2.5 py-1 bg-rose-950/60 text-rose-300 border border-rose-800/60 rounded-lg text-[11px] font-medium" : "px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"}
              >
                Mark All Absent
              </button>
            </div>

            {/* 24-Hour Edit Compliance Notice */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Timekeeper adjustments allowed within 24 hours of logging.</span>
            </div>
          </div>
        )}
      </div>

      {/* Summary KPI Cards for the Date */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Assigned</div>
          <div className="text-xl font-bold text-white mt-1">{stats.total} <span className="text-xs font-normal text-slate-500">workers</span></div>
        </div>
        <div className="bg-slate-900 border border-emerald-900/40 rounded-xl p-3">
          <div className="text-[10px] text-emerald-400 uppercase font-semibold">Present (1.0 Day)</div>
          <div className="text-xl font-bold text-emerald-300 mt-1">{stats.present}</div>
        </div>
        <div className="bg-slate-900 border border-amber-900/40 rounded-xl p-3">
          <div className="text-[10px] text-amber-400 uppercase font-semibold">Half-Day (0.5 Day)</div>
          <div className="text-xl font-bold text-amber-300 mt-1">{stats.halfDay}</div>
        </div>
        <div className="bg-slate-900 border border-rose-900/40 rounded-xl p-3">
          <div className="text-[10px] text-rose-400 uppercase font-semibold">Absent (0.0 Day)</div>
          <div className="text-xl font-bold text-rose-300 mt-1">{stats.absent}</div>
        </div>
        <div className="bg-slate-900 border border-blue-900/40 rounded-xl p-3">
          <div className="text-[10px] text-blue-400 uppercase font-semibold">Total Overtime</div>
          <div className="text-xl font-bold text-blue-300 mt-1">{stats.totalOt.toFixed(1)} <span className="text-xs font-normal text-slate-500">hrs</span></div>
        </div>
      </div>

      {/* Warning Alert Banner: Only displays AFTER API returns empty array, never during intermediate loading */}
      {!isLoading && hasLoadedArtisans && workers.length === 0 && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-200 shadow-md">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="font-semibold text-amber-300">No active artisans assigned: </span>
            <span className="text-amber-200/90">No active in-house artisans found for this project. Assign workers via Workforce Management.</span>
          </div>
        </div>
      )}

      {/* Workers Attendance Check-In Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-white">In-House Artisan Muster Roll (Direct Payroll)</h2>
            <span className="text-xs text-slate-400">({filteredWorkers.length} workers shown)</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
              Weekly Direct Payroll
            </span>
          </div>

          {/* Submit / Endorse Actions */}
          <div className="flex items-center gap-2">
            {isPM && (
              isEndorsed ? (
                <div className="px-3 py-1.5 bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  <span>Endorsed by PM ({session?.name || 'Site Engineer'})</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsEndorsed(true);
                    setToastMessage({ text: `Daily attendance for ${selectedDate} endorsed by Project Manager.`, type: 'success' });
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Endorse Daily Logs</span>
                </button>
              )
            )}

            {isDateLocked && (
              <div 
                className="px-4 py-2 bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-not-allowed shadow-xs"
                title="Attendance records for this date have been finalized by Finance and cannot be modified."
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Override & Audit (Locked)</span>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Worker Name & Position</th>
                {!isTimekeeper && <th className="py-3 px-4">Daily Rate</th>}
                <th className="py-3 px-4 text-center">Attendance Status</th>
                <th className="py-3 px-4 text-center">Overtime Hours</th>
                {!isTimekeeper && <th className="py-3 px-4 text-right">Effective Wage Ratio</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={isTimekeeper ? 4 : 6} className="py-12 text-center text-slate-500">
                    {isLoading || !hasLoadedArtisans ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading assigned project workforce...</span>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs sm:text-sm font-medium">
                        No active artisans assigned to this project. Assign workers via Workforce Management.
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((worker, idx) => {
                  const entry = localAttendance.get(worker.id) || { status: 'PRESENT', otHours: 0 };
                  const isPresent = entry.status === 'PRESENT';
                  const isHalfDay = entry.status === 'HALF_DAY';
                  const isAbsent = entry.status === 'ABSENT';

                  return (
                    <tr 
                      key={worker.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isAbsent ? 'bg-rose-950/10' : isHalfDay ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                      
                      {/* Name & Position */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{worker.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{worker.position}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-mono">
                            In-House Artisan
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-500">{worker.id}</span>
                        </div>
                      </td>

                      {/* Daily Rate (Hidden from Timekeeper) */}
                      {!isTimekeeper && (
                        <td className="py-3 px-4 font-mono text-slate-300">
                          ₱{(worker.dailyRate || 0).toLocaleString()}
                          <div className="text-[10px] text-slate-500">OT: ₱{worker.hourlyOtRate || 0}/hr</div>
                        </td>
                      )}

                      {/* Quick Toggles: Present / Half-day / Absent */}
                      <td className="py-3 px-4">
                        <div className={`flex items-center justify-center gap-1.5 ${isFinance ? 'pointer-events-none opacity-80 cursor-default' : ''}`}>
                          {/* Present Button */}
                          <button
                            type="button"
                            disabled={isDateLocked || isFinance}
                            onClick={() => handleSetStatus(worker.id, 'PRESENT')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              isFinance ? 'pointer-events-none opacity-80 cursor-default' : 'cursor-pointer'
                            } ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                                : 'bg-slate-800 text-slate-400 hover:text-emerald-300 hover:bg-slate-700'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </button>

                          {/* Half-Day Button */}
                          <button
                            type="button"
                            disabled={isDateLocked || isFinance}
                            onClick={() => handleSetStatus(worker.id, 'HALF_DAY')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              isFinance ? 'pointer-events-none opacity-80 cursor-default' : 'cursor-pointer'
                            } ${
                              isHalfDay
                                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                                : 'bg-slate-800 text-slate-400 hover:text-amber-300 hover:bg-slate-700'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Half-Day</span>
                          </button>

                          {/* Absent Button */}
                          <button
                            type="button"
                            disabled={isDateLocked || isFinance}
                            onClick={() => handleSetStatus(worker.id, 'ABSENT')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              isFinance ? 'pointer-events-none opacity-80 cursor-default' : 'cursor-pointer'
                            } ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                                : 'bg-slate-800 text-slate-400 hover:text-rose-300 hover:bg-slate-700'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </button>
                        </div>
                      </td>

                      {/* OT Hours Input */}
                      <td className="py-3 px-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1 ${isFinance ? 'pointer-events-none opacity-80 cursor-default' : ''}`}>
                          <input
                            type="number"
                            min="0"
                            max="16"
                            step="0.5"
                            disabled={isDateLocked || isAbsent || isFinance}
                            value={entry.otHours}
                            onChange={(e) => handleSetOt(worker.id, parseFloat(e.target.value) || 0)}
                            className={`w-14 bg-transparent text-center text-xs font-mono font-bold text-amber-400 focus:outline-none disabled:opacity-30 ${isFinance ? 'pointer-events-none opacity-80 cursor-default' : ''}`}
                          />
                          <span className="text-[10px] text-slate-500 font-mono">hrs</span>
                        </div>
                      </td>

                      {/* Effective Wage Ratio (Hidden from Timekeeper) */}
                      {!isTimekeeper && (
                        <td className="py-3 px-4 text-right font-mono">
                          {isPresent && (
                            <span className="text-emerald-400 font-bold">1.0 Day</span>
                          )}
                          {isHalfDay && (
                            <span className="text-amber-400 font-bold">0.5 Day</span>
                          )}
                          {isAbsent && (
                            <span className="text-slate-500 font-bold">0.0 Day</span>
                          )}
                          {entry.otHours > 0 && !isAbsent && (
                            <div className="text-[10px] text-blue-400 font-bold">
                              +₱{Number((entry.otHours * (worker.hourlyOtRate || 0)).toFixed(2)).toLocaleString()} OT
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400" />
            <span>Attendance logs auto-calculate in Finance weekly draft payroll runs upon submission.</span>
          </div>

          {!isDateLocked && !isFinance && (
            <button
              onClick={handleInitiateSubmit}
              disabled={isSubmitting || workers.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>{isOM ? 'Processing Override...' : 'Saving Daily Roll-Call...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isOM ? 'Save & Override Logs' : `Submit Daily Log for ${selectedDate}`}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* OM Administrative Override Confirmation Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Confirm Administrative Attendance Override
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {activeProject?.name || 'Site Project'} • {selectedDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) {
                    setShowOverrideModal(false);
                    setOverrideReason('');
                  }
                }}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-200">
                  Reason for Override (Required for QA Audit Trail)
                </label>
                <textarea
                  rows={4}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Enter detailed reason for override (min. 5 characters)..."
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none resize-none transition-all"
                  autoFocus
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Minimum 5 characters required</span>
                  <span className={overrideReason.trim().length >= 5 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {overrideReason.trim().length} / 5 chars
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-start gap-2.5 text-[11px] text-amber-200/90 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  This action will update attendance logs and create a timestamped immutable record in the system Audit Trail.
                </span>
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setShowOverrideModal(false);
                  setOverrideReason('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || overrideReason.trim().length < 5}
                onClick={() => handleSubmitBatch(overrideReason.trim())}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Logging Override...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Confirm & Log Override</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
