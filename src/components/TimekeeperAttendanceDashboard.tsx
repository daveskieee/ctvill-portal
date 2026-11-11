/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardCheck, Calendar, HardHat, Check, X, Clock, AlertCircle,
  Lock, RefreshCw, CheckCircle2, Search, ShieldCheck, Info,
  AlertTriangle, CloudRain, DollarSign, Timer, Printer
} from 'lucide-react';
import {
  ProjectProfile, SiteWorker, AttendanceRecord, AttendanceStatus,
  UserSession, Contractor
} from '../types';
import { normalizeRole, UserRole } from '../utils/rbac';
import { openEnterprisePrintWindow, escapePrintHtml } from '../utils/printEngine';

export type GranularAttendanceStatus =
  | 'PRESENT'
  | 'LATE_UNDERTIME'
  | 'HALF_DAY_AM'
  | 'HALF_DAY_PM'
  | 'WEATHER_RAINOUT'
  | 'ABSENT';

export interface DtrEntryState {
  granularStatus: GranularAttendanceStatus;
  timeIn: string;       // HH:mm (24h format for <input type="time">)
  timeOut: string;      // HH:mm (24h format for <input type="time">)
  manualOtOverride?: number | null;
  remarks: string;
  auditTimestamp: string; // e.g. "Stamped 08:02 AM"
  id?: string;
  isLocked?: boolean;
}

export interface ComputedShiftMetrics {
  regularHours: number;      // max 8.0h after 1h lunch deduction (12:00-13:00)
  lateMinutes: number;       // minutes after 08:00 AM (or undertime before 17:00)
  arrivedAfter815: boolean;  // arrived strictly after 08:15 AM
  overtimeHours: number;     // hours worked past 17:00
  estimatedDailyEarns: number; // (RegularHrs / 8) * DailyRate + (OT Hrs * (DailyRate / 8) * 1.25)
}

interface TimekeeperAttendanceDashboardProps {
  projects: ProjectProfile[];
  contractors?: Contractor[];
  session?: UserSession | any;
  onUpdateProject?: (id: string, updates: Partial<ProjectProfile>) => Promise<void> | void;
  onRefreshData?: () => void;
  onNotify?: (msg: string) => void;
}

// Parse "HH:mm" into total minutes from midnight
function parseTimeToMins(timeStr: string): number | null {
  if (!timeStr || !timeStr.includes(':')) return null;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// Format current Date into "HH:mm" for <input type="time">
function formatNow24h(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Format current Date into "HH:MM AM/PM" for audit stamp
function formatAuditClockTime(d: Date = new Date()): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Format full live clock badge: "Nov 11, 2026 • HH:MM:SS AM/PM"
function formatLiveDigitalClock(d: Date): string {
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  return `${datePart} • ${timePart}`;
}

/**
 * Core DTR Shift & Wage Calculator
 * Standard Shift: 08:00 (480m) to 17:00 (1020m), with 1h Lunch Break 12:00 (720m) to 13:00 (780m).
 * Overtime: Hours worked past 17:00 (1020m) paid at 1.25x hourly rate.
 */
export function computeWorkerShiftMetrics(
  entry: DtrEntryState,
  dailyRate: number
): ComputedShiftMetrics {
  const safeRate = Math.max(0, Number(dailyRate) || 750);
  if (entry.granularStatus === 'ABSENT') {
    return {
      regularHours: 0,
      lateMinutes: 0,
      arrivedAfter815: false,
      overtimeHours: 0,
      estimatedDailyEarns: 0
    };
  }

  const inMins = parseTimeToMins(entry.timeIn);
  const outMins = parseTimeToMins(entry.timeOut);

  if (inMins === null || outMins === null || outMins <= inMins) {
    return {
      regularHours: 0,
      lateMinutes: 0,
      arrivedAfter815: inMins !== null && inMins > 495,
      overtimeHours: 0,
      estimatedDailyEarns: 0
    };
  }

  // Regular shift window: 08:00 (480) to 17:00 (1020)
  const regStart = Math.max(480, inMins);
  const regEnd = Math.min(1020, outMins);
  const rawRegMins = Math.max(0, regEnd - regStart);

  // Deduct 1h lunch overlap between 12:00 (720) and 13:00 (780)
  const lunchOverlap = Math.max(0, Math.min(regEnd, 780) - Math.max(regStart, 720));
  const netRegMins = Math.max(0, rawRegMins - lunchOverlap);
  const regularHours = Math.min(8.0, +(netRegMins / 60).toFixed(2));

  // Late / Undertime minutes calculation
  const arrivedAfter815 = inMins > 495; // strictly after 08:15 AM
  let lateMinutes = 0;

  if (entry.granularStatus === 'HALF_DAY_PM') {
    // Afternoon shift starts at 13:00 (780)
    lateMinutes = inMins > 780 ? inMins - 780 : 0;
  } else if (entry.granularStatus === 'HALF_DAY_AM' || entry.granularStatus === 'WEATHER_RAINOUT') {
    // Morning shift starts at 08:00 (480)
    lateMinutes = inMins > 480 ? inMins - 480 : 0;
  } else {
    // Full shift: late arrival after 08:00 + undertime departure before 17:00
    const lateArrival = inMins > 480 ? inMins - 480 : 0;
    const earlyDeparture = outMins < 1020 ? Math.max(0, 480 - netRegMins - lateArrival) : 0;
    lateMinutes = Math.max(0, lateArrival + earlyDeparture);
  }

  // Overtime hours: hours worked past 17:00 (1020m)
  const computedOtHours = outMins > 1020 ? +((outMins - 1020) / 60).toFixed(2) : 0;
  const overtimeHours =
    entry.manualOtOverride !== undefined && entry.manualOtOverride !== null
      ? Math.max(0, entry.manualOtOverride)
      : computedOtHours;

  // Live Earnings Formula: (Regular Hrs / 8) * DailyRate + (OT Hrs * (DailyRate / 8) * 1.25)
  const hourlyBase = safeRate / 8;
  const regularPay = (regularHours / 8) * safeRate;
  const otPay = overtimeHours * hourlyBase * 1.25;
  const estimatedDailyEarns = +(regularPay + otPay).toFixed(2);

  return {
    regularHours,
    lateMinutes,
    arrivedAfter815,
    overtimeHours,
    estimatedDailyEarns
  };
}

// Convert granular UI status to API AttendanceStatus ('PRESENT' | 'HALF_DAY' | 'ABSENT')
function toApiAttendanceStatus(granular: GranularAttendanceStatus, regHours: number): AttendanceStatus {
  if (granular === 'ABSENT' || regHours <= 0) return 'ABSENT';
  if (
    granular === 'HALF_DAY_AM' ||
    granular === 'HALF_DAY_PM' ||
    granular === 'WEATHER_RAINOUT' ||
    regHours <= 4.5
  ) {
    return 'HALF_DAY';
  }
  return 'PRESENT';
}

// Master fallback commercial projects list if live prop & localStorage are empty under Timekeeper role
const FALLBACK_COMMERCIAL_PROJECTS: ProjectProfile[] = [
  {
    id: 'PRJ-001',
    name: 'NexBridge Software Hub',
    clientName: 'NexBridge Technologies Inc.',
    description: 'Turnkey Commercial Office & Data Center Fit-Out',
    location: 'BGC, Taguig City',
    budget: 14500000,
    fundsCollected: 8500000,
    progressPercentage: 68,
    status: 'IN_PROGRESS',
    targetHandoverDate: '2026-12-15',
    startDate: '2026-06-01',
    assignedWorkersCount: 12,
    tasksCount: 14,
    milestonesCount: 5,
    isPrivateAccounting: false,
    weatherSuspended: false
  },
  {
    id: 'PRJ-002',
    name: 'Summit Corporate Tower Fit-Out',
    clientName: 'Summit Holdings Corp.',
    description: 'Executive Floor & MEPFS Fit-Out Package',
    location: 'Makati CBD',
    budget: 9800000,
    fundsCollected: 5200000,
    progressPercentage: 45,
    status: 'IN_PROGRESS',
    targetHandoverDate: '2026-11-30',
    startDate: '2026-07-10',
    assignedWorkersCount: 8,
    tasksCount: 10,
    milestonesCount: 4,
    isPrivateAccounting: false,
    weatherSuspended: false
  },
  {
    id: 'PRJ-003',
    name: 'Vertex BPO Center Phase 2',
    clientName: 'Vertex Global Solutions',
    description: 'Acoustic Partitions, Raised Flooring & Electrical Rough-In',
    location: 'Alabang, Muntinlupa',
    budget: 11200000,
    fundsCollected: 6400000,
    progressPercentage: 52,
    status: 'IN_PROGRESS',
    targetHandoverDate: '2026-12-28',
    startDate: '2026-08-01',
    assignedWorkersCount: 10,
    tasksCount: 12,
    milestonesCount: 4,
    isPrivateAccounting: false,
    weatherSuspended: false
  }
];

const FALLBACK_IN_HOUSE_ARTISANS: SiteWorker[] = [
  { id: 'ART-101', name: 'Ramon Dela Cruz', position: 'Site Leadman / Master Carpenter', trade: 'Carpentry & Architectural Fit-Out', dailyRate: 950, hourlyOtRate: 148.44, status: 'Active', workforceClass: 'Artisan' },
  { id: 'ART-102', name: 'Ernesto Villanueva', position: 'Site Foreman (Civil & Masonry)', trade: 'Civil & Masonry', dailyRate: 1050, hourlyOtRate: 164.06, status: 'Active', workforceClass: 'Artisan' },
  { id: 'ART-103', name: 'Jomar Santos', position: 'Master Electrician (MEPFS)', trade: 'Electrical & Rough-In', dailyRate: 900, hourlyOtRate: 140.63, status: 'Active', workforceClass: 'Artisan' },
  { id: 'ART-104', name: 'Arnel Mendoza', position: 'Senior Tile & Finishing Mason', trade: 'Masonry & Tiling', dailyRate: 850, hourlyOtRate: 132.81, status: 'Active', workforceClass: 'Artisan' },
  { id: 'ART-105', name: 'Carlo Bautista', position: 'HVAC & Plumbing Technician', trade: 'Mechanical & Plumbing', dailyRate: 880, hourlyOtRate: 137.5, status: 'Active', workforceClass: 'Artisan' },
  { id: 'ART-106', name: 'Dennis Soriano', position: 'Drywall & Acoustic Partition Installer', trade: 'Drywall & Ceiling', dailyRate: 800, hourlyOtRate: 125.0, status: 'Active', workforceClass: 'Artisan' },
  { id: 'ART-107', name: 'Reynaldo Pascual', position: 'Finishing Painter & Coating Specialist', trade: 'Painting & Finishes', dailyRate: 800, hourlyOtRate: 125.0, status: 'Active', workforceClass: 'Artisan' },
  { id: 'ART-108', name: 'Mark Anthony Reyes', position: 'General Construction Laborer', trade: 'General Site Labor', dailyRate: 700, hourlyOtRate: 109.38, status: 'Active', workforceClass: 'Artisan' }
];

function resolveProjectDisplayName(project: any): string {
  if (!project) return 'Active Commercial Site';
  return (
    project.name ||
    project.projectName ||
    project.title ||
    `Commercial Site #${project.id}`
  );
}

export default function TimekeeperAttendanceDashboard({
  projects = [],
  contractors = [],
  session,
  onUpdateProject,
  onRefreshData,
  onNotify
}: TimekeeperAttendanceDashboardProps) {
  // 1. Live Ticking Digital Clock State
  const [nowClock, setNowClock] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNowClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fallback-fetched projects state if parent prop is initially empty
  const [fetchedProjects, setFetchedProjects] = useState<ProjectProfile[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/projects')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setFetchedProjects(data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Build unified live + localStorage + fallback commercial projects list (without restrictive status/role filters)
  const effectiveProjects = useMemo<ProjectProfile[]>(() => {
    const byId = new Map<string, ProjectProfile>();

    const addList = (list: any[]) => {
      if (!Array.isArray(list)) return;
      for (const item of list) {
        if (!item || item.id === undefined || item.id === null) continue;
        const key = String(item.id);
        if (!byId.has(key)) {
          byId.set(key, {
            ...item,
            id: key,
            name: resolveProjectDisplayName(item)
          });
        }
      }
    };

    // 1. Live projects prop from App.tsx / AdminPortal.tsx
    addList(projects);

    // 2. Direct API fetched projects
    addList(fetchedProjects);

    // 3. Cached projects from localStorage (includes newly created projects across roles)
    try {
      const cachedPrimary = localStorage.getItem('ctvill_cached_projects');
      if (cachedPrimary) addList(JSON.parse(cachedPrimary));
      const cachedSecondary = localStorage.getItem('ctvill_projects');
      if (cachedSecondary) addList(JSON.parse(cachedSecondary));
    } catch {
      // Ignore storage parse errors
    }

    // 4. Master fallback commercial sites if still empty
    if (byId.size === 0) {
      addList(FALLBACK_COMMERCIAL_PROJECTS);
    }

    return Array.from(byId.values());
  }, [projects, fetchedProjects]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() =>
    effectiveProjects[0]?.id ? String(effectiveProjects[0].id) : ''
  );
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [workers, setWorkers] = useState<SiteWorker[]>(() => FALLBACK_IN_HOUSE_ARTISANS);
  const [hasLoadedArtisans, setHasLoadedArtisans] = useState<boolean>(true);
  const [existingLogs, setExistingLogs] = useState<AttendanceRecord[]>([]);
  const [localDtr, setLocalDtr] = useState<Map<string, DtrEntryState>>(() => {
    const initMap = new Map<string, DtrEntryState>();
    for (const w of FALLBACK_IN_HOUSE_ARTISANS) {
      initMap.set(w.id, {
        granularStatus: 'PRESENT',
        timeIn: '08:00',
        timeOut: '17:00',
        remarks: 'On-time roll call',
        auditTimestamp: 'Stamped 08:00 AM',
        isLocked: false
      });
    }
    return initMap;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDateLocked, setIsDateLocked] = useState<boolean>(false);
  const [isEndorsed, setIsEndorsed] = useState<boolean>(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<{
    timestampStr: string;
    submittedByEmail: string;
    totalWorkers: number;
    totalRegHours: number;
    totalOtHours: number;
    totalDailyWageBurn: number;
  } | null>(null);

  // OM Administrative Override Confirmation Modal State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');

  // RBAC Hierarchy Context
  const currentRole = normalizeRole(session?.role);
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

  // Ensure first active project is automatically selected if none is selected or when projects prop / effectiveProjects changes
  useEffect(() => {
    if (effectiveProjects.length > 0) {
      const exists = effectiveProjects.some(p => String(p.id) === String(selectedProjectId));
      if (!selectedProjectId || !exists) {
        setSelectedProjectId(String(effectiveProjects[0].id));
      }
    }
  }, [effectiveProjects, selectedProjectId]);

  const activeProject = useMemo(
    () =>
      effectiveProjects.find(p => String(p.id) === String(selectedProjectId)) ||
      effectiveProjects[0] ||
      null,
    [effectiveProjects, selectedProjectId]
  );

  const activeProjectName = useMemo(
    () => resolveProjectDisplayName(activeProject),
    [activeProject]
  );

  // Helper to filter and normalize raw worker records into direct In-House Artisans
  const filterInHouseArtisans = useCallback((rawList: any[]): SiteWorker[] => {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const result: SiteWorker[] = [];

    for (const w of rawList) {
      if (!w || !w.id) continue;
      if (w.status && String(w.status).toLowerCase() !== 'active' && String(w.status).toLowerCase() !== 'deployed') continue;
      if (
        w.workforceClass === 'Subcontractor' ||
        w.workforce_class === 'Subcontractor' ||
        w.employmentType === 'OUTSOURCED' ||
        (w.activeManpower && w.activeManpower > 1)
      ) {
        continue;
      }

      const normName = String(w.name || '').trim().toLowerCase();
      const pos = String(w.position || w.trade || w.specialty || 'Skilled Artisan').toLowerCase();
      const comp = String(w.company || '').toLowerCase();

      if (
        normName.includes('manpower supply') ||
        comp.includes('manpower supply') ||
        (pos.includes('subcontractor') && !pos.includes('coordinator'))
      ) {
        continue;
      }

      if (!seenIds.has(String(w.id)) && (!normName || !seenNames.has(normName))) {
        seenIds.add(String(w.id));
        if (normName) seenNames.add(normName);
        const dailyRate = Number(w.dailyRate ?? w.daily_rate ?? 750);
        result.push({
          ...w,
          id: String(w.id),
          name: String(w.name || 'Site Artisan'),
          position: String(w.position || w.trade || w.specialty || 'Carpenter / Mason'),
          trade: String(w.trade || w.position || w.specialty || 'Civil Works'),
          dailyRate,
          hourlyOtRate: Number(w.hourlyOtRate ?? +((dailyRate / 8) * 1.25).toFixed(2)),
          status: 'Active',
          workforceClass: w.workforceClass || 'Artisan'
        });
      }
    }
    return result;
  }, [selectedProjectId]);

  // Synchronously resolve assigned in-house artisans for a project so the table renders immediately (never 0 workers)
  const resolveSyncArtisansForProject = useCallback(
    (projId: string): SiteWorker[] => {
      if (!projId) return FALLBACK_IN_HOUSE_ARTISANS;
      try {
        const cachedLedgerRaw = localStorage.getItem(`ctvill_dtr_project_ledger_${projId}`);
        if (cachedLedgerRaw) {
          const parsed = JSON.parse(cachedLedgerRaw);
          if (Array.isArray(parsed?.workers) && parsed.workers.length > 0) {
            return parsed.workers;
          }
        }
      } catch {}

      if (contractors && contractors.length > 0) {
        const proj = effectiveProjects.find(p => String(p.id) === String(projId));
        const projNameLower = resolveProjectDisplayName(proj).toLowerCase();
        const assignedFromProps = contractors.filter(c =>
          String(c.assignedProjectId || '') === String(projId) ||
          (proj?.assignedContractorIds || []).map(String).includes(String(c.id)) ||
          (proj && (c.activeProjectSite || '').toLowerCase() === projNameLower)
        );
        const filtered = filterInHouseArtisans(assignedFromProps.length > 0 ? assignedFromProps : contractors);
        if (filtered.length > 0) return filtered;
      }

      return FALLBACK_IN_HOUSE_ARTISANS;
    },
    [contractors, effectiveProjects, filterInHouseArtisans]
  );

  // Persist active & verified project DTR records into shared localStorage so Finance Weekly Payroll Engine reads them automatically
  const persistProjectDtrLedger = useCallback(
    (
      projId: string,
      projName: string,
      dateStr: string,
      workersList: SiteWorker[],
      dtrMap: Map<string, DtrEntryState>,
      isSubmittedFlag: boolean = false
    ) => {
      if (!projId || workersList.length === 0) return;
      try {
        const ledgerKey = `ctvill_dtr_project_ledger_${projId}`;
        let existingLedger: any = {};
        const raw = localStorage.getItem(ledgerKey);
        if (raw) {
          existingLedger = JSON.parse(raw) || {};
        }

        const serializedEntries: Record<string, any> = {};
        for (const w of workersList) {
          const entry = dtrMap.get(w.id) || {
            granularStatus: 'PRESENT' as GranularAttendanceStatus,
            timeIn: '08:00',
            timeOut: '17:00',
            remarks: 'Standard Shift',
            auditTimestamp: 'Stamped 08:00 AM'
          };
          const metrics = computeWorkerShiftMetrics(entry, w.dailyRate || 750);
          serializedEntries[w.id] = {
            ...entry,
            workerId: w.id,
            workerName: w.name,
            position: w.position || w.trade || 'Skilled Artisan',
            dailyRate: Number(w.dailyRate || 750),
            hourlyOtRate: Number(w.hourlyOtRate || +(((w.dailyRate || 750) / 8) * 1.25).toFixed(2)),
            status: toApiAttendanceStatus(entry.granularStatus, metrics.regularHours),
            regularHours: metrics.regularHours,
            overtimeHours: metrics.overtimeHours,
            lateMinutes: metrics.lateMinutes,
            estimatedDailyEarns: metrics.estimatedDailyEarns,
            date: dateStr,
            submitted: isSubmittedFlag || Boolean(existingLedger?.dates?.[dateStr]?.[w.id]?.submitted)
          };
        }

        const updatedDates = {
          ...(existingLedger.dates || {}),
          [dateStr]: serializedEntries
        };

        const ledgerPayload = {
          projectId: String(projId),
          projectName: projName,
          updatedAt: new Date().toISOString(),
          workers: workersList,
          dates: updatedDates
        };

        localStorage.setItem(ledgerKey, JSON.stringify(ledgerPayload));
        if (projName) {
          localStorage.setItem(
            `ctvill_dtr_project_ledger_name_${projName.toLowerCase().trim()}`,
            JSON.stringify(ledgerPayload)
          );
        }
      } catch {
        // Ignore storage quota errors
      }
    },
    []
  );

  // Fetch workers & existing attendance logs when project or date changes
  const loadData = useCallback(async () => {
    if (!selectedProjectId) return;
    // Immediately populate with synchronous fallback/assigned artisans so table is never empty while fetching
    const immediateArtisans = resolveSyncArtisansForProject(selectedProjectId);
    setWorkers(prev => (prev.length > 0 ? prev : immediateArtisans));
    setHasLoadedArtisans(true);
    setIsLoading(true);
    try {
      let rawWorkersData: any[] = [];
      const rosterRes = await fetch(`/api/attendance/roster?projectId=${selectedProjectId}&status=Active`);
      if (rosterRes.ok) {
        rawWorkersData = await rosterRes.json();
      } else {
        const workersRes = await fetch(`/api/workers?projectId=${selectedProjectId}&status=Active`);
        if (workersRes.ok) rawWorkersData = await workersRes.json();
      }

      let workersData = filterInHouseArtisans(rawWorkersData);

      // If project-specific API returned 0 workers, check assigned contractors from props or global active workers
      if (workersData.length === 0 && contractors && contractors.length > 0) {
        const proj = effectiveProjects.find(p => String(p.id) === String(selectedProjectId));
        const projNameLower = resolveProjectDisplayName(proj).toLowerCase();
        const assignedFromProps = contractors.filter(c =>
          String(c.assignedProjectId || '') === String(selectedProjectId) ||
          (proj?.assignedContractorIds || []).map(String).includes(String(c.id)) ||
          (proj && (c.activeProjectSite || '').toLowerCase() === projNameLower)
        );
        workersData = filterInHouseArtisans(assignedFromProps.length > 0 ? assignedFromProps : contractors);
      }

      if (workersData.length === 0) {
        const allWorkersRes = await fetch(`/api/workers?status=Active`).catch(() => null);
        if (allWorkersRes && allWorkersRes.ok) {
          const allRaw = await allWorkersRes.json();
          workersData = filterInHouseArtisans(allRaw).slice(0, 12);
        }
      }

      if (workersData.length === 0) {
        workersData = FALLBACK_IN_HOUSE_ARTISANS;
      }

      setWorkers(workersData);

      // 2. Fetch existing logs for this date
      const logsRes = await fetch(`/api/attendance?projectId=${selectedProjectId}&date=${selectedDate}`);
      const logsData: AttendanceRecord[] = logsRes.ok ? await logsRes.json() : [];
      setExistingLogs(logsData);

      const isPeriodLockedHeader = logsRes.headers.get('x-period-locked') === 'true';
      const locked = isPeriodLockedHeader || logsData.some(l => l.isLocked);
      setIsDateLocked(locked);

      // Check localStorage for saved rich DTR timestamps for this project + date
      let savedLocalMap: Record<string, DtrEntryState> = {};
      try {
        const cached = localStorage.getItem(`ctvill_dtr_entries_${selectedProjectId}_${selectedDate}`);
        if (cached) savedLocalMap = JSON.parse(cached);
        const savedReceipt = localStorage.getItem(`ctvill_dtr_receipt_${selectedProjectId}_${selectedDate}`);
        if (savedReceipt) {
          setSubmissionReceipt(JSON.parse(savedReceipt));
        } else {
          setSubmissionReceipt(null);
        }
      } catch {}

      const map = new Map<string, DtrEntryState>();
      for (const w of workersData) {
        const cachedEntry = savedLocalMap[w.id];
        const existing = logsData.find(l => l.workerId === w.id);

        if (cachedEntry) {
          map.set(w.id, {
            ...cachedEntry,
            id: existing?.id || cachedEntry.id,
            isLocked: existing?.isLocked ?? cachedEntry.isLocked
          });
        } else if (existing) {
          const isHalf = existing.status === 'HALF_DAY';
          const isAbs = existing.status === 'ABSENT';
          const otHrs = Number(existing.overtimeHours || 0);
          const outHour = 17 + Math.floor(otHrs);
          const outMin = Math.round((otHrs % 1) * 60);
          const computedOut = isAbs
            ? ''
            : isHalf
            ? '12:00'
            : `${String(Math.min(23, outHour)).padStart(2, '0')}:${String(outMin).padStart(2, '0')}`;

          map.set(w.id, {
            granularStatus: isAbs ? 'ABSENT' : isHalf ? 'HALF_DAY_AM' : 'PRESENT',
            timeIn: isAbs ? '' : '08:00',
            timeOut: computedOut,
            remarks: isHalf ? 'Half-Day Shift' : isAbs ? 'Absent' : 'Standard Shift',
            auditTimestamp: `Stamped 08:00 AM`,
            id: existing.id,
            isLocked: existing.isLocked
          });
        } else {
          map.set(w.id, {
            granularStatus: 'PRESENT',
            timeIn: '08:00',
            timeOut: '17:00',
            remarks: 'On-time roll call',
            auditTimestamp: `Stamped 08:00 AM`,
            isLocked: false
          });
        }
      }

      setLocalDtr(map);
      setHasLoadedArtisans(true);
      persistProjectDtrLedger(selectedProjectId, activeProjectName, selectedDate, workersData, map, logsData.length > 0);
    } catch (err) {
      console.error('Error loading attendance data:', err);
      setToastMessage({ text: 'Failed to load attendance logs.', type: 'error' });
      setHasLoadedArtisans(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId, selectedDate, contractors, effectiveProjects, filterInHouseArtisans, resolveSyncArtisansForProject, persistProjectDtrLedger, activeProjectName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep shared project DTR ledger synced whenever localDtr or workers change
  useEffect(() => {
    if (selectedProjectId && workers.length > 0 && localDtr.size > 0) {
      persistProjectDtrLedger(selectedProjectId, activeProjectName, selectedDate, workers, localDtr, Boolean(submissionReceipt));
    }
  }, [selectedProjectId, activeProjectName, selectedDate, workers, localDtr, submissionReceipt, persistProjectDtrLedger]);

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const immediateWorkers = resolveSyncArtisansForProject(projectId);
    setWorkers(immediateWorkers);
    setHasLoadedArtisans(true);
  };

  // Update individual worker's Attendance Status dropdown/buttons
  const handleStatusChange = (workerId: string, nextStatus: GranularAttendanceStatus) => {
    if (isDateLocked || isFinance) return;
    const stamp = `Stamped ${formatAuditClockTime()}`;
    setLocalDtr(prev => {
      const next = new Map(prev);
      const curr = next.get(workerId) || {
        granularStatus: 'PRESENT',
        timeIn: '08:00',
        timeOut: '17:00',
        remarks: '',
        auditTimestamp: stamp
      };

      let timeIn = curr.timeIn || '08:00';
      let timeOut = curr.timeOut || '17:00';
      let remarks = curr.remarks;

      if (nextStatus === 'PRESENT') {
        timeIn = '08:00';
        timeOut = '17:00';
        remarks = 'Standard Full Shift';
      } else if (nextStatus === 'LATE_UNDERTIME') {
        if (timeIn === '08:00') timeIn = '08:30';
        if (!timeOut) timeOut = '17:00';
        remarks = 'Late Arrival / Undertime';
      } else if (nextStatus === 'HALF_DAY_AM') {
        timeIn = '08:00';
        timeOut = '12:00';
        remarks = 'Half-Day Morning Shift (AM)';
      } else if (nextStatus === 'HALF_DAY_PM') {
        timeIn = '13:00';
        timeOut = '17:00';
        remarks = 'Half-Day Afternoon Shift (PM)';
      } else if (nextStatus === 'WEATHER_RAINOUT') {
        timeIn = '08:00';
        timeOut = '12:00';
        remarks = 'Weather Rainout Stoppage (Half-Day)';
      } else if (nextStatus === 'ABSENT') {
        timeIn = '';
        timeOut = '';
        remarks = 'Unexcused / Logged Absent';
      }

      next.set(workerId, {
        ...curr,
        granularStatus: nextStatus,
        timeIn,
        timeOut,
        manualOtOverride: null,
        remarks,
        auditTimestamp: stamp
      });
      return next;
    });
  };

  // Update Time-In or Time-Out input or Punch button
  const handleTimeChange = (workerId: string, field: 'timeIn' | 'timeOut', value: string) => {
    if (isDateLocked || isFinance) return;
    const stamp = `Stamped ${formatAuditClockTime()}`;
    setLocalDtr(prev => {
      const next = new Map(prev);
      const curr = next.get(workerId) || {
        granularStatus: 'PRESENT',
        timeIn: '08:00',
        timeOut: '17:00',
        remarks: '',
        auditTimestamp: stamp
      };

      const updatedTimeIn = field === 'timeIn' ? value : curr.timeIn || '08:00';
      const updatedTimeOut = field === 'timeOut' ? value : curr.timeOut || '17:00';
      const inMins = parseTimeToMins(updatedTimeIn);
      const outMins = parseTimeToMins(updatedTimeOut);

      let nextStatus: GranularAttendanceStatus =
        curr.granularStatus === 'ABSENT' ? 'PRESENT' : curr.granularStatus;

      if (inMins !== null && inMins > 495) {
        // Arrived after 08:15 AM
        nextStatus = 'LATE_UNDERTIME';
      } else if (outMins !== null && outMins <= 750 && inMins !== null && inMins <= 540) {
        if (nextStatus !== 'WEATHER_RAINOUT') nextStatus = 'HALF_DAY_AM';
      } else if (inMins !== null && inMins >= 750) {
        nextStatus = 'HALF_DAY_PM';
      } else if (inMins !== null && inMins <= 495 && outMins !== null && outMins >= 1020) {
        nextStatus = 'PRESENT';
      }

      next.set(workerId, {
        ...curr,
        granularStatus: nextStatus,
        timeIn: updatedTimeIn,
        timeOut: updatedTimeOut,
        manualOtOverride: null,
        auditTimestamp: stamp
      });
      return next;
    });
  };

  // Update Remarks
  const handleRemarksChange = (workerId: string, remarks: string) => {
    if (isDateLocked || isFinance) return;
    setLocalDtr(prev => {
      const next = new Map(prev);
      const curr = next.get(workerId);
      if (!curr) return prev;
      next.set(workerId, { ...curr, remarks });
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // 3. ENHANCED QUICK BATCH ACTIONS
  // ---------------------------------------------------------------------------
  const handleBatchTimeInAll = () => {
    if (isDateLocked || isFinance) return;
    const stamp = `Stamped ${formatAuditClockTime()}`;
    setLocalDtr(prev => {
      const next = new Map(prev);
      for (const [wId, val] of next.entries()) {
        next.set(wId, {
          ...val,
          granularStatus: 'PRESENT',
          timeIn: '08:00',
          timeOut: val.timeOut || '17:00',
          remarks: 'Batch Time-In (08:00 AM)',
          auditTimestamp: stamp
        });
      }
      return next;
    });
    setToastMessage({ text: '⏱️ Batch Time-In (08:00 AM) applied to all assigned workers.', type: 'info' });
  };

  const handleBatchTimeOutAll = () => {
    if (isDateLocked || isFinance) return;
    const stamp = `Stamped ${formatAuditClockTime()}`;
    setLocalDtr(prev => {
      const next = new Map(prev);
      for (const [wId, val] of next.entries()) {
        if (val.granularStatus === 'ABSENT') continue;
        next.set(wId, {
          ...val,
          timeOut: '17:00',
          auditTimestamp: stamp
        });
      }
      return next;
    });
    setToastMessage({ text: '⏱️ Batch Time-Out (05:00 PM) applied to all active workers.', type: 'info' });
  };

  const handleBatchRainoutStoppage = () => {
    if (isDateLocked || isFinance) return;
    const stamp = `Stamped ${formatAuditClockTime()}`;
    setLocalDtr(prev => {
      const next = new Map(prev);
      for (const [wId, val] of next.entries()) {
        next.set(wId, {
          ...val,
          granularStatus: 'WEATHER_RAINOUT',
          timeIn: '08:00',
          timeOut: '12:00',
          manualOtOverride: 0,
          remarks: 'Weather Rainout Stoppage (Half-Day)',
          auditTimestamp: stamp
        });
      }
      return next;
    });
    setToastMessage({ text: '🌧️ Marked all workers as Weather Rainout Stoppage (Half-Day 4.0h).', type: 'info' });
  };

  const handleBatchAbsentAll = () => {
    if (isDateLocked || isFinance) return;
    const stamp = `Stamped ${formatAuditClockTime()}`;
    setLocalDtr(prev => {
      const next = new Map(prev);
      for (const [wId, val] of next.entries()) {
        next.set(wId, {
          ...val,
          granularStatus: 'ABSENT',
          timeIn: '',
          timeOut: '',
          manualOtOverride: 0,
          remarks: 'Marked Absent (Batch)',
          auditTimestamp: stamp
        });
      }
      return next;
    });
    setToastMessage({ text: 'Marked all workers as Absent (0.0h).', type: 'info' });
  };

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) return workers;
    const q = searchQuery.toLowerCase();
    return workers.filter(
      w =>
        w.name.toLowerCase().includes(q) ||
        w.position.toLowerCase().includes(q) ||
        (w.trade || '').toLowerCase().includes(q)
    );
  }, [workers, searchQuery]);

  // Real-time KPI Summary Calculations
  const stats = useMemo(() => {
    let onSitePresentCount = 0;
    let totalRegularHours = 0;
    let lateUndertimeCount = 0;
    let totalLateMinutes = 0;
    let halfDayRainoutCount = 0;
    let absentCount = 0;
    let totalOtHours = 0;
    let totalDailyPayrollBurn = 0;

    for (const w of workers) {
      const entry = localDtr.get(w.id) || {
        granularStatus: 'PRESENT',
        timeIn: '08:00',
        timeOut: '17:00',
        remarks: '',
        auditTimestamp: 'Stamped 08:00 AM'
      };
      const metrics = computeWorkerShiftMetrics(entry, w.dailyRate || 750);

      if (entry.granularStatus === 'ABSENT') {
        absentCount++;
        continue;
      }

      if (
        entry.granularStatus === 'HALF_DAY_AM' ||
        entry.granularStatus === 'HALF_DAY_PM' ||
        entry.granularStatus === 'WEATHER_RAINOUT'
      ) {
        halfDayRainoutCount++;
      } else {
        onSitePresentCount++;
      }

      if (entry.granularStatus === 'LATE_UNDERTIME' || metrics.arrivedAfter815 || metrics.lateMinutes > 0) {
        lateUndertimeCount++;
        totalLateMinutes += metrics.lateMinutes;
      }

      totalRegularHours += metrics.regularHours;
      totalOtHours += metrics.overtimeHours;
      totalDailyPayrollBurn += metrics.estimatedDailyEarns;
    }

    return {
      totalAssigned: workers.length,
      onSitePresentCount,
      totalRegularHours: +totalRegularHours.toFixed(1),
      lateUndertimeCount,
      totalLateMinutes,
      halfDayRainoutCount,
      absentCount,
      totalOtHours: +totalOtHours.toFixed(1),
      totalDailyPayrollBurn: +totalDailyPayrollBurn.toFixed(2)
    };
  }, [localDtr, workers]);

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

  // ---------------------------------------------------------------------------
  // 4. SUBMISSION & AUDIT LOG LOCK + PROJECT & WEEKLY REPORT SYNC
  // ---------------------------------------------------------------------------
  const handleSubmitBatch = async (customReason?: string) => {
    if (!selectedProjectId || isDateLocked || isSubmitting) return;

    const records = workers.map(w => {
      const entry = localDtr.get(w.id) || {
        granularStatus: 'PRESENT' as GranularAttendanceStatus,
        timeIn: '08:00',
        timeOut: '17:00',
        remarks: '',
        auditTimestamp: `Stamped ${formatAuditClockTime()}`
      };
      const metrics = computeWorkerShiftMetrics(entry, w.dailyRate || 750);
      return {
        workerId: w.id,
        status: toApiAttendanceStatus(entry.granularStatus, metrics.regularHours),
        overtimeHours: metrics.overtimeHours,
        regularHours: metrics.regularHours,
        lateMinutes: metrics.lateMinutes,
        timeIn: entry.timeIn,
        timeOut: entry.timeOut,
        estimatedDailyEarns: metrics.estimatedDailyEarns,
        remarks: entry.remarks
      };
    });

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({ count: records.length }));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit attendance');
      }

      const now = new Date();
      const exactTimeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      const submitterEmail = session?.email || (isTimekeeper ? 'timekeeper@ctvill.com' : 'admin@ctvill.com');

      const receipt = {
        timestampStr: `Submitted on ${selectedDate} at ${exactTimeStr} by ${submitterEmail}`,
        submittedByEmail: submitterEmail,
        totalWorkers: stats.onSitePresentCount + stats.halfDayRainoutCount,
        totalRegHours: stats.totalRegularHours,
        totalOtHours: stats.totalOtHours,
        totalDailyWageBurn: stats.totalDailyPayrollBurn
      };
      setSubmissionReceipt(receipt);

      // Persist rich DTR entries and receipt to localStorage
      try {
        const serializedMap: Record<string, DtrEntryState> = {};
        localDtr.forEach((v, k) => {
          serializedMap[k] = v;
        });
        localStorage.setItem(
          `ctvill_dtr_entries_${selectedProjectId}_${selectedDate}`,
          JSON.stringify(serializedMap)
        );
        localStorage.setItem(
          `ctvill_dtr_receipt_${selectedProjectId}_${selectedDate}`,
          JSON.stringify(receipt)
        );

        // Compute manpower designation counts for Weekly Activity Report sync
        let leadman = 0;
        let foreman = 0;
        let mason = 0;
        let laborer = 0;
        let skilled = 0;

        workers.forEach(w => {
          const entry = localDtr.get(w.id);
          if (entry?.granularStatus === 'ABSENT') return;
          const pos = `${w.position || ''} ${w.trade || ''}`.toLowerCase();
          if (pos.includes('leadman') || pos.includes('lead')) leadman++;
          else if (pos.includes('foreman') || pos.includes('supervisor') || pos.includes('engineer')) foreman++;
          else if (pos.includes('mason') || pos.includes('tile') || pos.includes('concret')) mason++;
          else if (pos.includes('labor') || pos.includes('helper')) laborer++;
          else skilled++;
        });

        const manpowerSyncPayload = {
          leadman: Math.max(1, leadman),
          foreman: Math.max(1, foreman),
          mason: Math.max(1, mason),
          laborer: Math.max(1, laborer),
          skilled: Math.max(1, skilled)
        };
        localStorage.setItem(`ctvill_dtr_manpower_${selectedProjectId}`, JSON.stringify(manpowerSyncPayload));
        localStorage.setItem('ctvill_dtr_manpower_latest', JSON.stringify(manpowerSyncPayload));
        persistProjectDtrLedger(selectedProjectId, activeProjectName, selectedDate, workers, localDtr, true);
        window.dispatchEvent(new CustomEvent('ctvill-dtr-manpower-sync'));
        window.dispatchEvent(new CustomEvent('ctvill-dtr-payroll-sync', { detail: { projectId: selectedProjectId, date: selectedDate } }));
      } catch {}

      // Sync computed daily labor cost to the project's Disbursed Labor Expenses
      if (onUpdateProject && activeProject) {
        const updatedLaborSpend = Number(activeProject.paidLaborExpenses || 0) + stats.totalDailyPayrollBurn;
        await onUpdateProject(selectedProjectId, {
          paidLaborExpenses: updatedLaborSpend
        });
      }

      setShowOverrideModal(false);
      setOverrideReason('');

      const msg = `${receipt.timestampStr} • ₱${stats.totalDailyPayrollBurn.toLocaleString()} synced to Project Labor & Activity Report.`;
      setToastMessage({ text: msg, type: 'success' });
      onNotify?.(msg);

      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Error submitting attendance', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasExistingLogs = existingLogs.length > 0 || Boolean(submissionReceipt);

  const handlePrintDailyDtrSheet = () => {
    const rowsHtml = filteredWorkers
      .map((w, idx) => {
        const entry = localDtr.get(w.id) || {
          granularStatus: 'PRESENT' as GranularAttendanceStatus,
          timeIn: '08:00',
          timeOut: '17:00',
          remarks: 'On-time roll call',
          auditTimestamp: 'Stamped 08:00 AM'
        };
        const metrics = computeWorkerShiftMetrics(entry, w.dailyRate || 750);
        const statusBadge =
          entry.granularStatus === 'PRESENT'
            ? 'badge-emerald'
            : entry.granularStatus === 'ABSENT'
            ? 'badge-rose'
            : 'badge-amber';

        return `
          <tr>
            <td class="mono text-center">${idx + 1}</td>
            <td>
              <div><strong>${escapePrintHtml(w.name)}</strong></div>
              <div style="font-size: 7.5pt; color: #475569;">${escapePrintHtml(w.id)} • ₱${(w.dailyRate || 750).toLocaleString()}/day</div>
            </td>
            <td>${escapePrintHtml(w.position || w.trade || 'Skilled Artisan')}</td>
            <td class="text-center">
              <span class="badge ${statusBadge}">${escapePrintHtml(entry.granularStatus.replace(/_/g, ' '))}</span>
            </td>
            <td class="text-center mono font-bold">${escapePrintHtml(entry.timeIn || '—')}</td>
            <td class="text-center mono font-bold">${escapePrintHtml(entry.timeOut || '—')}</td>
            <td class="text-right mono font-bold">${metrics.regularHours.toFixed(1)}h</td>
            <td class="text-right mono">${metrics.overtimeHours > 0 ? `+${metrics.overtimeHours.toFixed(1)}h` : '0.0h'}</td>
            <td class="text-right mono font-bold">₱${metrics.estimatedDailyEarns.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="mono" style="font-size: 7.5pt;">${escapePrintHtml(entry.auditTimestamp || 'Stamped')}</td>
            <td style="width: 120px; border-bottom: 1px solid #94a3b8;"></td>
          </tr>
        `;
      })
      .join('');

    const bodyHtml = `
      <div class="section-title">Official Daily Time Record (DTR) & In-House Artisan Muster Roll</div>
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 32px;">#</th>
            <th>Worker Name & Daily Rate</th>
            <th>Trade / Designation</th>
            <th class="text-center">Attendance Status</th>
            <th class="text-center">Time-In</th>
            <th class="text-center">Time-Out</th>
            <th class="text-right">Regular Hrs</th>
            <th class="text-right">OT Hrs (1.25x)</th>
            <th class="text-right">Computed Daily Pay (₱)</th>
            <th>Audit Timestamp</th>
            <th class="text-center" style="width: 120px;">Worker Signature</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" class="text-right">DAILY MUSTER ROLL TOTALS:</td>
            <td class="text-right mono">${stats.totalRegularHours.toFixed(1)}h</td>
            <td class="text-right mono">+${stats.totalOtHours.toFixed(1)}h</td>
            <td class="text-right mono" style="color: #047857;">₱${stats.totalDailyPayrollBurn.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    `;

    openEnterprisePrintWindow({
      title: 'Official Daily Time Record (DTR) & Muster Roll',
      subtitle: 'Timestamped In-House Artisan Attendance, Regular Shift (08:00–17:00) & 1.25x Overtime Register',
      docRef: `DTR-${(selectedProjectId || 'SITE01').toUpperCase()}-${selectedDate.replace(/-/g, '')}`,
      orientation: 'landscape',
      projectMeta: {
        name: activeProjectName,
        location: activeProject?.location || 'Commercial Fit-Out Jobsite',
        period: `Attendance Date: ${selectedDate} (08:00 AM – 05:00 PM Shift)`,
        client: (activeProject as any)?.clientName || (activeProject as any)?.client || 'CTVill Commercial Operations'
      },
      kpiSummary: [
        { label: 'On-Site Present', value: `${stats.onSitePresentCount + stats.halfDayRainoutCount} / ${stats.totalAssigned} Artisans` },
        { label: 'Total Regular Hours', value: `${stats.totalRegularHours.toFixed(1)} hrs` },
        { label: 'Total Overtime (1.25x)', value: `+${stats.totalOtHours.toFixed(1)} hrs` },
        { label: 'Computed Daily Labor Burn', value: `₱${stats.totalDailyPayrollBurn.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
      ],
      bodyHtml,
      signatures: [
        { role: 'Recorded & Verified By (Timekeeper)', name: session?.name || 'Site Timekeeper', title: 'Site Timekeeper & Roll-Call Officer' },
        { role: 'Checked & Endorsed By (Site Engineer / PM)', name: 'Engr. Ricardo Ramos', title: 'Project Manager / Site Engineer' },
        { role: 'Audited For Payroll By (Finance)', name: 'Ma. Theresa Santos, CPA', title: 'Finance & Payroll Accounting' }
      ]
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md border animate-slideDown ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50'
              : toastMessage.type === 'error'
              ? 'bg-red-950/90 text-red-200 border-red-500/50'
              : 'bg-amber-950/90 text-amber-200 border-amber-500/50'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {toastMessage.type === 'info' && <Info className="w-4 h-4 text-amber-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner / Attendance Header with Live Ticking Digital Clock */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-white tracking-tight">
                Daily In-House Artisan Roll-Call &amp; Dynamic DTR
              </h1>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-medium border ${
                  isFinance
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    : isDateLocked
                    ? 'bg-slate-800 text-slate-400 border-slate-700/80'
                    : isTimekeeper
                    ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                    : isPM
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
              >
                {isFinance
                  ? 'AUDIT & READ-ONLY (FINANCE)'
                  : isDateLocked
                  ? 'LOCKED & FINALIZED'
                  : isTimekeeper
                  ? 'TIMEKEEPER DTR'
                  : isPM
                  ? 'PM VERIFICATION'
                  : 'OM OVERVIEW'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Timestamped Time-In / Time-Out • Auto-deducted 1h lunch (12:00–13:00) • 1.25x Overtime past 05:00 PM
            </p>
          </div>
        </div>

        {/* Live Digital Clock Badge + User Session Info Pill */}
        <div className="flex flex-wrap items-center gap-2.5 self-end xl:self-auto">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
            <span className="text-amber-300 font-semibold">{formatLiveDigitalClock(nowClock)}</span>
            <span className="text-slate-500 hidden sm:inline">—</span>
            <span className="text-slate-300 text-[11px] hidden sm:inline">Standard Shift: 08:00 AM - 05:00 PM</span>
          </div>

          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <div className="text-right">
              <div className="font-medium text-white">
                {session?.name || (isTimekeeper ? 'Site Timekeeper' : isPM ? 'Site Project Manager' : 'Operations Manager')}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {session?.email || (isTimekeeper ? 'timekeeper@ctvill.com' : 'user@ctvill.com')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Submission Receipt Banner */}
      {submissionReceipt && (
        <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-emerald-300 font-mono">{submissionReceipt.timestampStr}</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Synced <strong className="text-white">{submissionReceipt.totalWorkers} active workers</strong> ({submissionReceipt.totalRegHours}h Reg + {submissionReceipt.totalOtHours}h OT = <strong className="text-emerald-400 font-mono">₱{submissionReceipt.totalDailyWageBurn.toLocaleString()}</strong>) to Project Disbursed Labor Expenses &amp; Weekly Activity Report.
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold shrink-0">
            VERIFIED DTR RECEIPT
          </span>
        </div>
      )}

      {/* Filter & Quick Batch Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Project Selector */}
          <div className="md:col-span-4">
            <label className="block text-[10px] font-mono text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider font-bold">
              <HardHat className="w-3.5 h-3.5 text-amber-400" />
              <span>Commercial Site</span>
            </label>
            <select
              value={String(selectedProjectId || effectiveProjects[0]?.id || '')}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-slate-900 text-slate-100 font-medium border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {effectiveProjects.map((project: any) => (
                <option
                  key={String(project.id)}
                  value={String(project.id)}
                  className="bg-slate-900 text-slate-100 py-1"
                >
                  {`${project.name || project.projectName || project.title || `Commercial Site #${project.id}`} — ${project.location || project.status || 'Active'}`}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="md:col-span-3">
            <label className="block text-[10px] font-mono text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider font-bold">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Attendance Date</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              {...(!isOM ? { max: new Date().toISOString().split('T')[0] } : {})}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
            />
          </div>

          {/* Search Worker Input */}
          <div className="md:col-span-3">
            <label className="block text-[10px] font-mono text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider font-bold">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Filter Worker / Trade</span>
            </label>
            <input
              type="text"
              placeholder="Search by name or trade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Refresh & Print DTR Buttons */}
          <div className="md:col-span-2 flex items-end gap-1.5">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="flex-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handlePrintDailyDtrSheet}
              className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer shrink-0"
              title="Print Official Daily DTR & Muster Roll"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Print Daily DTR Sheet</span>
            </button>
          </div>
        </div>

        {/* Locked Notice if applicable */}
        {isDateLocked && (
          <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Records Locked:</strong> Attendance for this project date has been finalized into a Finance Payroll Run.
              </span>
            </div>
            <span className="font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
              FINALIZED RUN
            </span>
          </div>
        )}

        {/* Enhanced Quick Batch Bar */}
        {!isDateLocked && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold">Quick Batch:</span>
              <button
                type="button"
                disabled={isFinance}
                onClick={handleBatchTimeInAll}
                className="px-2.5 py-1 bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-700/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                ⏱️ Batch Time-In All (08:00 AM)
              </button>
              <button
                type="button"
                disabled={isFinance}
                onClick={handleBatchTimeOutAll}
                className="px-2.5 py-1 bg-teal-950/70 hover:bg-teal-900/70 text-teal-300 border border-teal-700/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                ⏱️ Batch Time-Out All (05:00 PM)
              </button>
              <button
                type="button"
                disabled={isFinance}
                onClick={handleBatchRainoutStoppage}
                className="px-2.5 py-1 bg-sky-950/70 hover:bg-sky-900/70 text-sky-300 border border-sky-700/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                🌧️ Mark Rainout Stoppage (Half-Day)
              </button>
              <button
                type="button"
                disabled={isFinance}
                onClick={handleBatchAbsentAll}
                className="px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900/70 text-rose-300 border border-rose-700/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Mark All Absent
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>1h lunch (12:00–01:00 PM) auto-deducted • OT 1.25x past 05:00 PM</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Real-Time Calculated KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Assigned */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">
            Total Assigned
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {stats.totalAssigned} <span className="text-xs font-normal text-slate-400">workers</span>
          </div>
          <div className="text-[11px] text-slate-300 font-medium truncate">
            {activeProjectName}
          </div>
        </div>

        {/* Card 2: On-Site / Present */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>On-Site / Present</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {stats.onSitePresentCount} <span className="text-xs font-normal text-slate-400">pax</span>
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            {stats.totalRegularHours}h Total Regular Man-Hours
          </div>
        </div>

        {/* Card 3: Late / Undertime */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Late / Undertime</span>
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            {stats.lateUndertimeCount} <span className="text-xs font-normal text-slate-400">workers</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {stats.totalLateMinutes} mins late / undertime
          </div>
        </div>

        {/* Card 4: Half-Day / Rainout */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-mono tracking-wider font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>Half-Day / Rainout</span>
          </div>
          <div className="text-xl font-bold font-mono text-sky-400">
            {stats.halfDayRainoutCount} <span className="text-xs font-normal text-slate-400">partial</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {stats.absentCount} Absent today
          </div>
        </div>

        {/* Card 5: Total Overtime & Daily Payroll Burn */}
        <div className="bg-slate-900/70 border border-emerald-500/30 rounded-xl p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 uppercase font-mono tracking-wider font-semibold">
            <DollarSign className="w-3.5 h-3.5" />
            <span>OT &amp; Daily Payroll Burn</span>
          </div>
          <div className="text-xl font-bold font-mono text-white">
            ₱{stats.totalDailyPayrollBurn.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono text-cyan-400">
            +{stats.totalOtHours.toFixed(1)} hrs Total Overtime
          </div>
        </div>
      </div>

      {/* 2. Upgraded 7-Column Muster Roll DTR Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-white">
              In-House Artisan Muster Roll &amp; Timestamped DTR ({filteredWorkers.length} Workers)
            </h2>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
              Live Hour &amp; Wage Engine
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isPM &&
              (isEndorsed ? (
                <div className="px-3 py-1.5 bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  <span>Endorsed by PM ({session?.name || 'Site Engineer'})</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsEndorsed(true);
                    setToastMessage({
                      text: `Daily attendance for ${selectedDate} endorsed by Project Manager.`,
                      type: 'success'
                    });
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Endorse Daily Logs</span>
                </button>
              ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans border-collapse">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-semibold font-mono">
              <tr>
                <th className="py-3 px-3 w-10">#</th>
                <th className="py-3 px-3">Worker Name, Trade &amp; Daily Rate (₱/day)</th>
                <th className="py-3 px-3">Attendance Status</th>
                <th className="py-3 px-3">Time In &amp; Time Out</th>
                <th className="py-3 px-3">Computed Hours</th>
                <th className="py-3 px-3 text-right">Est. Daily Earns (₱)</th>
                <th className="py-3 px-3">Audit Timestamp &amp; Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    {isLoading || !hasLoadedArtisans ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Loading assigned project workforce...</span>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs font-medium">
                        No active artisans matched your search filter.
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((worker, idx) => {
                  const dailyRate = Number(worker.dailyRate || 750);
                  const hourlyRate = +(dailyRate / 8).toFixed(2);
                  const entry = localDtr.get(worker.id) || {
                    granularStatus: 'PRESENT' as GranularAttendanceStatus,
                    timeIn: '08:00',
                    timeOut: '17:00',
                    remarks: 'Standard Shift',
                    auditTimestamp: 'Stamped 08:00 AM'
                  };
                  const metrics = computeWorkerShiftMetrics(entry, dailyRate);
                  const isAbsent = entry.granularStatus === 'ABSENT';

                  return (
                    <tr
                      key={worker.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isAbsent
                          ? 'bg-rose-950/15 opacity-75'
                          : entry.granularStatus === 'WEATHER_RAINOUT'
                          ? 'bg-sky-950/15'
                          : entry.granularStatus === 'LATE_UNDERTIME'
                          ? 'bg-amber-950/10'
                          : ''
                      }`}
                    >
                      {/* 1. # */}
                      <td className="py-3 px-3 font-mono text-slate-500">{idx + 1}</td>

                      {/* 2. Worker Name, Trade & Daily Rate (₱/day) */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{worker.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">{worker.position}</span>
                          <span className="text-emerald-400 font-bold">₱{dailyRate.toLocaleString()}/day</span>
                          <span className="text-slate-500">(₱{hourlyRate}/hr)</span>
                        </div>
                      </td>

                      {/* 3. Attendance Status */}
                      <td className="py-3 px-3">
                        <select
                          disabled={isDateLocked || isFinance}
                          value={entry.granularStatus}
                          onChange={(e) =>
                            handleStatusChange(worker.id, e.target.value as GranularAttendanceStatus)
                          }
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border focus:outline-none cursor-pointer ${
                            entry.granularStatus === 'PRESENT'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                              : entry.granularStatus === 'LATE_UNDERTIME'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-600/50'
                              : entry.granularStatus === 'WEATHER_RAINOUT'
                              ? 'bg-sky-950/80 text-sky-300 border-sky-600/50'
                              : entry.granularStatus === 'ABSENT'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-600/50'
                              : 'bg-indigo-950/80 text-indigo-300 border-indigo-600/50'
                          }`}
                        >
                          <option value="PRESENT">Present (Full Shift)</option>
                          <option value="LATE_UNDERTIME">Late / Undertime</option>
                          <option value="HALF_DAY_AM">Half-Day AM (08:00–12:00)</option>
                          <option value="HALF_DAY_PM">Half-Day PM (13:00–17:00)</option>
                          <option value="WEATHER_RAINOUT">Weather Rainout</option>
                          <option value="ABSENT">Absent</option>
                        </select>
                      </td>

                      {/* 4. Time In & Time Out + Quick [Punch In] / [Punch Out] */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400 w-7">IN:</span>
                            <input
                              type="time"
                              disabled={isDateLocked || isFinance || isAbsent}
                              value={entry.timeIn}
                              onChange={(e) => handleTimeChange(worker.id, 'timeIn', e.target.value)}
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-white focus:border-amber-500 focus:outline-none disabled:opacity-40"
                            />
                            <button
                              type="button"
                              disabled={isDateLocked || isFinance}
                              onClick={() => handleTimeChange(worker.id, 'timeIn', formatNow24h())}
                              className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-semibold cursor-pointer disabled:opacity-40"
                            >
                              Punch In
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-slate-400 w-7">OUT:</span>
                            <input
                              type="time"
                              disabled={isDateLocked || isFinance || isAbsent}
                              value={entry.timeOut}
                              onChange={(e) => handleTimeChange(worker.id, 'timeOut', e.target.value)}
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-white focus:border-amber-500 focus:outline-none disabled:opacity-40"
                            />
                            <button
                              type="button"
                              disabled={isDateLocked || isFinance}
                              onClick={() => handleTimeChange(worker.id, 'timeOut', formatNow24h())}
                              className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-semibold cursor-pointer disabled:opacity-40"
                            >
                              Punch Out
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 5. Computed Hours (Regular Hrs, Late/Undertime Mins, Overtime Hrs) */}
                      <td className="py-3 px-3 font-mono">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                            {metrics.regularHours.toFixed(1)}h Reg
                          </span>
                          {metrics.lateMinutes > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                              -{metrics.lateMinutes}m Late/UT
                            </span>
                          )}
                          {metrics.overtimeHours > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                              +{metrics.overtimeHours.toFixed(1)}h OT
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {isAbsent ? '0.0h shift' : '1h lunch deducted (12–1PM)'}
                        </div>
                      </td>

                      {/* 6. Est. Daily Earns (₱) */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="text-sm font-bold text-white">
                          ₱{metrics.estimatedDailyEarns.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Reg: ₱{((metrics.regularHours / 8) * dailyRate).toFixed(0)}
                          {metrics.overtimeHours > 0 && (
                            <span className="text-cyan-400 ml-1">
                              +OT: ₱{(metrics.overtimeHours * (dailyRate / 8) * 1.25).toFixed(0)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Audit Timestamp & Remarks */}
                      <td className="py-3 px-3">
                        <div className="text-[10px] font-mono text-teal-400 flex items-center gap-1 mb-1">
                          <Timer className="w-3 h-3 shrink-0" />
                          <span>{entry.auditTimestamp}</span>
                        </div>
                        <input
                          type="text"
                          disabled={isDateLocked || isFinance}
                          value={entry.remarks}
                          onChange={(e) => handleRemarksChange(worker.id, e.target.value)}
                          placeholder="Shift note / remarks..."
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 focus:border-amber-500 focus:outline-none"
                        />
                      </td>
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
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Submitting syncs computed regular/OT hours &amp; daily wage burn (₱{stats.totalDailyPayrollBurn.toLocaleString()}) to Project Disbursed Labor &amp; Weekly Activity Reports.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrintDailyDtrSheet}
              className="w-full sm:w-auto px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Print Daily DTR Sheet</span>
            </button>

            {!isDateLocked && !isFinance && (
              <button
                onClick={handleInitiateSubmit}
                disabled={isSubmitting || workers.length === 0}
                className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Saving Timestamped DTR...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {isOM
                        ? `Save & Override Log for ${selectedDate}`
                        : `Submit Daily Log for ${selectedDate}`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* OM Administrative Override Confirmation Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
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
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setShowOverrideModal(false);
                  setOverrideReason('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || overrideReason.trim().length < 5}
                onClick={() => handleSubmitBatch(overrideReason.trim())}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Confirm &amp; Log Override</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
