/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Calendar, RefreshCw, ZoomIn, ZoomOut, Save, Plus,
  CheckCircle2, Layers, HardHat, AlertTriangle, Edit3, Trash2,
  X, ChevronRight, ChevronDown, Clock, ArrowRight, Link2,
  AlertCircle, ChevronLeft, CornerDownRight, ChevronsDown, ChevronsUp,
  Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Scan,
  Printer, Download, Wand2, BookmarkCheck, RotateCw
} from 'lucide-react';
import { ProjectProfile, Contractor, DailySiteLog } from '../types';
import { useTheme } from '../context/ThemeContext';

// ==========================================
// 1. Core Interfaces & Data Types
// ==========================================

export interface GanttTaskItem {
  id: string;
  projectId: string;
  wbsCode: string;
  text: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  duration: number;  // working days (Mon-Sat, skipping Sundays)
  progress: number;  // 0.0 to 1.0
  baselineStart?: string | null;
  baselineEnd?: string | null;
  type: 'task' | 'project' | 'milestone';
  parentTaskId?: string | null;
  sortOrder: number;
  assignedContractorId?: string | null;
  contractorName?: string;
  predecessorIds: string[]; // Finish-to-Start predecessor task IDs
}

export interface GanttLinkItem {
  id: string;
  source: string; // predecessor task ID
  target: string; // successor task ID
  type: string;   // '0' = Finish-to-Start
  lag: number;
}

interface GanttTimelineProps {
  projects?: ProjectProfile[];
  contractors?: Contractor[];
  siteLogs?: DailySiteLog[];
  milestones?: any[];
  tasks?: any[];
  onUpdateProject?: (id: string, updates: Partial<ProjectProfile>) => void | Promise<void>;
  onDeleteTask?: (taskId: string) => void;
}

type ZoomLevel = 'year' | 'quarter' | 'month' | 'week' | 'day';

interface DragState {
  active: boolean;
  type: 'move' | 'resize-left' | 'resize-right';
  taskId: string;
  initialPointerX: number;
  initialStartDate: string;
  initialEndDate: string;
  initialDuration: number;
}

// ==========================================
// 2. Philippine 6-Day Workweek Calendar Math
// ==========================================

export function isSunday(d: Date): boolean {
  return d.getDay() === 0;
}

export function parseDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) {
    const fallback = new Date();
    fallback.setHours(12, 0, 0, 0);
    return fallback;
  }
  if (dateStr instanceof Date) {
    const d = new Date(dateStr);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const cleanStr = String(dateStr).trim().split('T')[0].split(' ')[0];

  // Match YYYY-MM-DD or MM-DD-YYYY
  const ymd = cleanStr.split('-').map(n => parseInt(n, 10));
  if (ymd.length === 3 && !isNaN(ymd[0]) && !isNaN(ymd[1]) && !isNaN(ymd[2])) {
    if (ymd[0] > 999) {
      return new Date(ymd[0], ymd[1] - 1, ymd[2], 12, 0, 0, 0);
    }
    if (ymd[2] > 999) {
      return new Date(ymd[2], ymd[0] - 1, ymd[1], 12, 0, 0, 0);
    }
  }

  // Match MM-DD (e.g. "09-21", "09-28")
  if (ymd.length === 2 && !isNaN(ymd[0]) && !isNaN(ymd[1])) {
    return new Date(2026, ymd[0] - 1, ymd[1], 12, 0, 0, 0);
  }

  // Match slashes YYYY/MM/DD or MM/DD/YYYY or MM/DD
  const slash = cleanStr.split('/').map(n => parseInt(n, 10));
  if (slash.length === 3 && !isNaN(slash[0]) && !isNaN(slash[1]) && !isNaN(slash[2])) {
    if (slash[0] > 999) {
      return new Date(slash[0], slash[1] - 1, slash[2], 12, 0, 0, 0);
    }
    return new Date(slash[2], slash[0] - 1, slash[1], 12, 0, 0, 0);
  }
  if (slash.length === 2 && !isNaN(slash[0]) && !isNaN(slash[1])) {
    return new Date(2026, slash[0] - 1, slash[1], 12, 0, 0, 0);
  }

  const nativeParsed = new Date(cleanStr);
  if (!isNaN(nativeParsed.getTime())) {
    nativeParsed.setHours(12, 0, 0, 0);
    return nativeParsed;
  }

  const fallback = new Date();
  fallback.setHours(12, 0, 0, 0);
  return fallback;
}

export function getTaskDate(task: { startDate?: string | Date | null; text?: string; title?: string }): Date {
  if (task.startDate) {
    const d = parseDate(task.startDate);
    if (!isNaN(d.getTime())) return d;
  }
  // Try extracting date embedded in text/title like "1.M.1.2 Subtask of Excavation (09-21)" or "Footing (09-28)"
  const label = `${task.text || ''} ${task.title || ''}`;
  const mFull = label.match(/\b(20\d\d)[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (mFull) {
    const y = parseInt(mFull[1], 10);
    const m = parseInt(mFull[2], 10);
    const d = parseInt(mFull[3], 10);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  const mShort = label.match(/\b(\d{1,2})[-/](\d{1,2})\b/);
  if (mShort) {
    const m = parseInt(mShort[1], 10);
    const d = parseInt(mShort[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(2026, m - 1, d, 12, 0, 0, 0);
    }
  }
  return parseDate(task.startDate);
}

export function formatDateISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateDisplay(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateMMDD(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// Add working days (Mon-Sat, skipping Sundays)
export function addWorkingDays(startDate: Date | string, durationDays: number): Date {
  const result = parseDate(startDate);
  // If start is Sunday, advance to first working day (Monday)
  while (isSunday(result)) {
    result.setDate(result.getDate() + 1);
    result.setHours(12, 0, 0, 0);
  }
  if (durationDays <= 1) {
    return result;
  }

  let added = 1;
  while (added < durationDays) {
    result.setDate(result.getDate() + 1);
    result.setHours(12, 0, 0, 0);
    if (!isSunday(result)) {
      added++;
    }
  }
  return result;
}

// Count working days between two dates inclusive (skipping Sundays)
export function countWorkingDays(startDate: Date | string, endDate: Date | string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  if (end < start) return 0;

  let count = 0;
  const curr = new Date(start);
  while (curr <= end) {
    if (!isSunday(curr)) {
      count++;
    }
    curr.setDate(curr.getDate() + 1);
    curr.setHours(12, 0, 0, 0);
  }
  return count;
}

// Next working day strictly after a date (skipping Sundays)
export function getNextWorkingDay(date: Date | string): Date {
  const next = parseDate(date);
  next.setDate(next.getDate() + 1);
  next.setHours(12, 0, 0, 0);
  while (isSunday(next)) {
    next.setDate(next.getDate() + 1);
    next.setHours(12, 0, 0, 0);
  }
  return next;
}

// ==========================================
// 3. Cascading Auto-Scheduling Engine
// ==========================================

export function autoScheduleProject(
  tasks: GanttTaskItem[],
  links: GanttLinkItem[]
): { updatedTasks: GanttTaskItem[]; shiftedCount: number } {
  if (!tasks || tasks.length === 0) {
    return { updatedTasks: [], shiftedCount: 0 };
  }

  const taskMap = new Map<string, GanttTaskItem>(tasks.map(t => [t.id, { ...t }]));
  const taskById = new Map<string, GanttTaskItem>(tasks.map(t => [t.id, t]));

  // Build predecessor and successor maps combining links and predecessorIds
  const predMap = new Map<string, Set<string>>();
  const succMap = new Map<string, Set<string>>();

  tasks.forEach(t => {
    predMap.set(t.id, new Set());
    succMap.set(t.id, new Set());
  });

  // Incorporate links
  links.forEach(l => {
    const s = String(l.source);
    const tgt = String(l.target);
    if (!taskById.has(s) || !taskById.has(tgt) || s === tgt) return;
    const tgtTask = taskById.get(tgt);
    const sTask = taskById.get(s);
    if (tgtTask?.parentTaskId === s || sTask?.parentTaskId === tgt) return; // Ignore parent-child hierarchy
    predMap.get(tgt)?.add(s);
    succMap.get(s)?.add(tgt);
  });

  // Incorporate task.predecessorIds
  tasks.forEach(t => {
    (t.predecessorIds || []).forEach(pId => {
      const s = String(pId);
      const tgt = String(t.id);
      if (!taskById.has(s) || !taskById.has(tgt) || s === tgt) return;
      const sTask = taskById.get(s);
      if (t.parentTaskId === s || sTask?.parentTaskId === tgt) return; // Ignore parent-child hierarchy
      predMap.get(tgt)?.add(s);
      succMap.get(s)?.add(tgt);
    });
  });

  // Kahn's algorithm for topological sorting
  const inDegree = new Map<string, number>();
  tasks.forEach(t => {
    inDegree.set(t.id, predMap.get(t.id)?.size || 0);
  });

  const queue: string[] = [];
  tasks.forEach(t => {
    if ((inDegree.get(t.id) || 0) === 0) {
      queue.push(t.id);
    }
  });

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const currId = queue.shift()!;
    topoOrder.push(currId);

    const successors = succMap.get(currId) || new Set();
    successors.forEach(succId => {
      const curDeg = inDegree.get(succId) || 0;
      inDegree.set(succId, curDeg - 1);
      if (curDeg - 1 === 0) {
        queue.push(succId);
      }
    });
  }

  // If cycle or disconnected, append remaining tasks in chronological order
  if (topoOrder.length < tasks.length) {
    const seen = new Set(topoOrder);
    const remaining = tasks
      .filter(t => !seen.has(t.id))
      .sort((a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime());
    remaining.forEach(t => topoOrder.push(t.id));
  }

  const shiftedTaskIds = new Set<string>();

  // Process tasks in topological sequence
  for (const taskId of topoOrder) {
    const currentTask = taskMap.get(taskId);
    if (!currentTask) continue;

    const preds = Array.from(predMap.get(taskId) || []);
    if (preds.length === 0) continue;

    let maxRequiredStart: Date | null = null;

    for (const predId of preds) {
      const predTask = taskMap.get(predId);
      if (!predTask) continue;

      const predEnd = parseDate(predTask.endDate);
      const requiredStart = getNextWorkingDay(predEnd);

      if (!maxRequiredStart || requiredStart > maxRequiredStart) {
        maxRequiredStart = requiredStart;
      }
    }

    if (maxRequiredStart) {
      const currentStart = parseDate(currentTask.startDate);

      // Finish-to-Start rule: if successor starts on or before predecessor end date
      // (i.e. strictly before earliest allowed next working day)
      if (currentStart < maxRequiredStart) {
        const newStartStr = formatDateISO(maxRequiredStart);
        const duration = (currentTask.type === 'milestone' || currentTask.duration === 0)
          ? 0
          : Math.max(1, currentTask.duration || countWorkingDays(currentTask.startDate, currentTask.endDate) || 1);
        const newEnd = duration === 0
          ? maxRequiredStart
          : addWorkingDays(maxRequiredStart, duration);
        const newEndStr = formatDateISO(newEnd);

        taskMap.set(taskId, {
          ...currentTask,
          startDate: newStartStr,
          endDate: newEndStr,
          duration
        });

        shiftedTaskIds.add(taskId);
      }
    }
  }

  return {
    updatedTasks: Array.from(taskMap.values()),
    shiftedCount: shiftedTaskIds.size
  };
}

export function cascadeDownstreamSchedule(
  tasks: GanttTaskItem[],
  links: GanttLinkItem[],
  changedTaskId: string
): GanttTaskItem[] {
  const { updatedTasks } = autoScheduleProject(tasks, links);
  return updatedTasks;
}

// ==========================================
// 3b. Critical Path Method (CPM) & Float Calculation Engine
// (Em Jay Construction CPM Standard)
// ==========================================

export function getPrevWorkingDay(date: Date | string): Date {
  const prev = parseDate(date);
  prev.setDate(prev.getDate() - 1);
  prev.setHours(12, 0, 0, 0);
  while (isSunday(prev)) {
    prev.setDate(prev.getDate() - 1);
    prev.setHours(12, 0, 0, 0);
  }
  return prev;
}

// Explicit Critical Path Flagging for Em Jay Construction CPM Standard
export const STRUCTURAL_CRITICAL_KEYWORDS = [
  'foundation',
  'footing',
  'column base prep',
  'concrete pouring',
  'columns',
  'beams',
  'wall framing',
  'slab pouring',
  'wall plastering',
  'painting',
  'mobilization',
  'excavation',
  'chb wall'
];

export const SECONDARY_UTILITY_KEYWORDS = [
  'electrical',
  'plumbing',
  'interior partition',
  'roofing structure',
  'roof framing',
  'sanitary',
  'suspended slab'
];

export function isTaskStructurallyCritical(task: { text?: string; title?: string }): boolean | null {
  const name = (task.text || task.title || '').toLowerCase().trim();
  if (SECONDARY_UTILITY_KEYWORDS.some(kw => name.includes(kw))) {
    return false;
  }
  if (STRUCTURAL_CRITICAL_KEYWORDS.some(kw => name.includes(kw))) {
    return true;
  }
  return null;
}

// Full-width bar metrics calculator based on task calendar dates
export function computeTaskBarMetrics(
  startDateStr: string | Date,
  endDateStr: string | Date,
  timelineStart: Date,
  colWidth: number
): { left: number; width: number; startCol: number; endCol: number } {
  const sDate = parseDate(startDateStr);
  const eDate = parseDate(endDateStr);
  const tStart = timelineStart instanceof Date && !isNaN(timelineStart.getTime()) ? timelineStart : new Date();

  const safeColWidth = colWidth > 0 ? colWidth : 22;
  const sTime = !isNaN(sDate.getTime()) ? sDate.getTime() : tStart.getTime();
  const eTime = !isNaN(eDate.getTime()) ? eDate.getTime() : sTime;

  // Day column offsets from timeline start
  const startCol = Math.round((sTime - tStart.getTime()) / (1000 * 60 * 60 * 24));
  const endCol = Math.round((eTime - tStart.getTime()) / (1000 * 60 * 60 * 24));

  const left = startCol * safeColWidth;
  const width = Math.max((endCol - startCol + 1) * safeColWidth, 40);

  return { left, width, startCol, endCol };
}

// Em Jay Construction Standard Waterfall Schedule
export const DEFAULT_EM_JAY_TASKS: GanttTaskItem[] = [
  {
    id: 'tsk-01',
    projectId: 'default',
    wbsCode: 'TSK-001',
    text: 'Mobilization & Temporary Facilities',
    startDate: '2026-05-29',
    endDate: '2026-06-02',
    duration: 5,
    progress: 1.0,
    type: 'task',
    parentTaskId: null,
    sortOrder: 1,
    contractorName: 'Em Jay General Contractor',
    predecessorIds: []
  },
  {
    id: 'tsk-02',
    projectId: 'default',
    wbsCode: 'TSK-002',
    text: 'Excavation & Footings',
    startDate: '2026-06-08',
    endDate: '2026-06-19',
    duration: 12,
    progress: 1.0,
    type: 'task',
    parentTaskId: null,
    sortOrder: 2,
    contractorName: 'Em Jay Earthworks & Foundations',
    predecessorIds: ['tsk-01']
  },
  {
    id: 'tsk-03',
    projectId: 'default',
    wbsCode: 'TSK-003',
    text: 'Foundation Concrete Works',
    startDate: '2026-06-15',
    endDate: '2026-06-24',
    duration: 10,
    progress: 1.0,
    type: 'task',
    parentTaskId: null,
    sortOrder: 3,
    contractorName: 'Em Jay Concrete Crew',
    predecessorIds: ['tsk-02']
  },
  {
    id: 'tsk-04',
    projectId: 'default',
    wbsCode: 'TSK-004',
    text: 'Columns & Beams — 2nd Floor',
    startDate: '2026-06-25',
    endDate: '2026-07-12',
    duration: 18,
    progress: 1.0,
    type: 'task',
    parentTaskId: null,
    sortOrder: 4,
    contractorName: 'Em Jay Structural Team',
    predecessorIds: ['tsk-03']
  },
  {
    id: 'tsk-05',
    projectId: 'default',
    wbsCode: 'TSK-005',
    text: 'Suspended Slab — 2nd Floor',
    startDate: '2026-07-13',
    endDate: '2026-07-24',
    duration: 12,
    progress: 1.0,
    type: 'task',
    parentTaskId: null,
    sortOrder: 5,
    contractorName: 'Em Jay Structural Team',
    predecessorIds: ['tsk-04']
  },
  {
    id: 'tsk-06',
    projectId: 'default',
    wbsCode: 'TSK-006',
    text: 'Structural Topping-Off',
    startDate: '2026-07-25',
    endDate: '2026-07-25',
    duration: 0,
    progress: 0.25,
    type: 'milestone',
    parentTaskId: null,
    sortOrder: 6,
    contractorName: 'Em Jay Construction',
    predecessorIds: ['tsk-05']
  },
  {
    id: 'tsk-07',
    projectId: 'default',
    wbsCode: 'TSK-007',
    text: 'Roof Framing & Roofing Works',
    startDate: '2026-07-26',
    endDate: '2026-08-04',
    duration: 10,
    progress: 0.0,
    type: 'task',
    parentTaskId: null,
    sortOrder: 7,
    contractorName: 'Em Jay Roofing Team',
    predecessorIds: ['tsk-06']
  },
  {
    id: 'tsk-08',
    projectId: 'default',
    wbsCode: 'TSK-008',
    text: 'CHB Walls & Plastering',
    startDate: '2026-07-08',
    endDate: '2026-07-27',
    duration: 20,
    progress: 0.25,
    type: 'task',
    parentTaskId: null,
    sortOrder: 8,
    contractorName: 'Em Jay Masonry Team',
    predecessorIds: ['tsk-04']
  },
  {
    id: 'tsk-09',
    projectId: 'default',
    wbsCode: 'TSK-009',
    text: 'Painting Works',
    startDate: '2026-09-01',
    endDate: '2026-09-20',
    duration: 20,
    progress: 0.0,
    type: 'task',
    parentTaskId: null,
    sortOrder: 9,
    contractorName: 'Em Jay Finishing Crew',
    predecessorIds: ['tsk-08']
  },
  {
    id: 'tsk-10',
    projectId: 'default',
    wbsCode: 'TSK-010',
    text: 'Electrical Rough-in',
    startDate: '2026-07-18',
    endDate: '2026-08-01',
    duration: 15,
    progress: 0.10,
    type: 'task',
    parentTaskId: null,
    sortOrder: 10,
    contractorName: 'Em Jay MEP Services',
    predecessorIds: ['tsk-08']
  },
  {
    id: 'tsk-11',
    projectId: 'default',
    wbsCode: 'TSK-011',
    text: 'Plumbing & Sanitary Rough-in',
    startDate: '2026-07-18',
    endDate: '2026-08-01',
    duration: 15,
    progress: 0.10,
    type: 'task',
    parentTaskId: null,
    sortOrder: 11,
    contractorName: 'Em Jay MEP Services',
    predecessorIds: ['tsk-08']
  }
];

export const DEFAULT_EM_JAY_LINKS: GanttLinkItem[] = [
  { id: 'lnk-1', source: 'tsk-01', target: 'tsk-02', type: '0', lag: 0 },
  { id: 'lnk-2', source: 'tsk-02', target: 'tsk-03', type: '0', lag: 0 },
  { id: 'lnk-3', source: 'tsk-03', target: 'tsk-04', type: '0', lag: 0 },
  { id: 'lnk-4', source: 'tsk-04', target: 'tsk-05', type: '0', lag: 0 },
  { id: 'lnk-5', source: 'tsk-05', target: 'tsk-06', type: '0', lag: 0 },
  { id: 'lnk-6', source: 'tsk-06', target: 'tsk-07', type: '0', lag: 0 },
  { id: 'lnk-7', source: 'tsk-04', target: 'tsk-08', type: '0', lag: 0 },
  { id: 'lnk-8', source: 'tsk-08', target: 'tsk-09', type: '0', lag: 0 },
  { id: 'lnk-9', source: 'tsk-08', target: 'tsk-10', type: '0', lag: 0 },
  { id: 'lnk-10', source: 'tsk-08', target: 'tsk-11', type: '0', lag: 0 }
];

export function computeCriticalPath(
  tasks: GanttTaskItem[],
  links: GanttLinkItem[]
): {
  criticalTaskIds: Set<string>;
  taskFloatMap: Map<string, number>;
  criticalLinkKeys: Set<string>;
} {
  const criticalTaskIds = new Set<string>();
  const taskFloatMap = new Map<string, number>();
  const criticalLinkKeys = new Set<string>();

  if (!tasks || tasks.length === 0) {
    return { criticalTaskIds, taskFloatMap, criticalLinkKeys };
  }

  // 1. Build adjacency maps
  const succMap = new Map<string, Set<string>>();
  const predMap = new Map<string, Set<string>>();

  tasks.forEach(t => {
    succMap.set(t.id, new Set());
    predMap.set(t.id, new Set(t.predecessorIds || []));
  });

  links.forEach(l => {
    const s = String(l.source);
    const tgt = String(l.target);
    if (predMap.has(tgt)) {
      predMap.get(tgt)!.add(s);
    }
    if (succMap.has(s)) {
      succMap.get(s)!.add(tgt);
    }
  });

  predMap.forEach((preds, tgt) => {
    preds.forEach(p => {
      if (succMap.has(p)) {
        succMap.get(p)!.add(tgt);
      }
    });
  });

  // 2. Project Target Completion Date
  let maxProjectEndMs = -Infinity;
  tasks.forEach(t => {
    const eMs = parseDate(t.endDate).getTime();
    if (!isNaN(eMs) && eMs > maxProjectEndMs) {
      maxProjectEndMs = eMs;
    }
  });

  if (!isFinite(maxProjectEndMs) || maxProjectEndMs <= 0) {
    tasks.forEach(t => {
      criticalTaskIds.add(t.id);
      taskFloatMap.set(t.id, 0);
    });
    return { criticalTaskIds, taskFloatMap, criticalLinkKeys };
  }

  const projectEndDate = new Date(maxProjectEndMs);

  // 3. Backward Pass: Late Finish (LF) and Late Start (LS)
  const lateFinishMap = new Map<string, Date>();

  // Initialize LF of all tasks to projectEndDate
  tasks.forEach(t => {
    lateFinishMap.set(t.id, new Date(projectEndDate));
  });

  // Backward relaxation (converges within tasks.length iterations)
  const maxIterations = Math.min(50, tasks.length + 2);
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    for (const t of tasks) {
      const successors = succMap.get(t.id);
      const currentLF = lateFinishMap.get(t.id) || new Date(projectEndDate);

      if (successors && successors.size > 0) {
        let minAllowedLF = new Date(projectEndDate);

        for (const succId of successors) {
          const succTask = tasks.find(x => x.id === succId);
          if (!succTask) continue;

          // Late Finish of successor
          const succLF = lateFinishMap.get(succId) || parseDate(succTask.endDate);
          const succDur = (succTask.type === 'milestone' || succTask.duration === 0) 
            ? 0 
            : Math.max(1, succTask.duration);

          // Calculate successor's Late Start (LS)
          const succLS = new Date(succLF);
          if (succDur > 1) {
            let rem = succDur - 1;
            while (rem > 0) {
              succLS.setDate(succLS.getDate() - 1);
              succLS.setHours(12, 0, 0, 0);
              if (!isSunday(succLS)) {
                rem--;
              }
            }
          }

          // Predecessor must finish on or before the working day immediately before succLS
          const allowedPredFinish = getPrevWorkingDay(succLS);
          if (allowedPredFinish.getTime() < minAllowedLF.getTime()) {
            minAllowedLF = allowedPredFinish;
          }
        }

        if (minAllowedLF.getTime() < currentLF.getTime()) {
          lateFinishMap.set(t.id, minAllowedLF);
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  // 4. Compute Total Float = LF - EF (in working days)
  tasks.forEach(t => {
    const ef = parseDate(t.endDate);
    const lf = lateFinishMap.get(t.id) || ef;

    if (lf.getTime() <= ef.getTime()) {
      taskFloatMap.set(t.id, 0);
      criticalTaskIds.add(t.id);
    } else {
      const nextDay = getNextWorkingDay(ef);
      if (nextDay > lf) {
        taskFloatMap.set(t.id, 0);
        criticalTaskIds.add(t.id);
      } else {
        const floatDays = countWorkingDays(nextDay, lf);
        taskFloatMap.set(t.id, floatDays);
        if (floatDays <= 0) {
          criticalTaskIds.add(t.id);
        }
      }
    }
  });

  // 5. Explicitly flag the main structural sequence as Critical (isCritical = true)
  tasks.forEach(t => {
    const structuralFlag = isTaskStructurallyCritical(t);
    if (structuralFlag === true) {
      criticalTaskIds.add(t.id);
      taskFloatMap.set(t.id, 0);
    } else if (structuralFlag === false) {
      criticalTaskIds.delete(t.id);
      if ((taskFloatMap.get(t.id) ?? 0) <= 0) {
        taskFloatMap.set(t.id, 5); // Ensure non-critical tasks have Float > 0
      }
    }
  });

  // 6. Identify critical dependency connectors (connecting two critical tasks)
  predMap.forEach((preds, succId) => {
    if (criticalTaskIds.has(succId)) {
      preds.forEach(predId => {
        if (criticalTaskIds.has(predId)) {
          criticalLinkKeys.add(`${predId}-${succId}`);
        }
      });
    }
  });

  return { criticalTaskIds, taskFloatMap, criticalLinkKeys };
}

// ==========================================
// 4. Main Component
// ==========================================

export default function GanttTimeline({
  projects = [],
  contractors = [],
  siteLogs = [],
  tasks: tasksProp = [],
  onUpdateProject,
  onDeleteTask
}: GanttTimelineProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return projects.length > 0 ? projects[0].id : '';
  });

  // Client-side tombstone registry to prevent race-condition reappearances
  const recentlyDeletedTaskIdsRef = useRef<Map<string, number>>(new Map());

  const isTaskTombstoned = useCallback((id: string) => {
    const exp = recentlyDeletedTaskIdsRef.current.get(id);
    if (!exp) return false;
    if (Date.now() > exp) {
      recentlyDeletedTaskIdsRef.current.delete(id);
      return false;
    }
    return true;
  }, []);

  // Keep selectedProjectId synchronized with available projects
  useEffect(() => {
    if (projects.length > 0) {
      if (!selectedProjectId || !projects.some(p => p.id === selectedProjectId)) {
        setSelectedProjectId(projects[0].id);
      }
    } else if (selectedProjectId) {
      setSelectedProjectId('');
      setTasks([]);
      setLinks([]);
    }
  }, [projects, selectedProjectId]);

  const [tasks, setTasks] = useState<GanttTaskItem[]>([]);
  const [links, setLinks] = useState<GanttLinkItem[]>([]);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week');
  const [zoomFactor, setZoomFactor] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState<boolean>(false);
  const [timelineContainerWidth, setTimelineContainerWidth] = useState<number>(1000);
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingSync = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Synchronize dynamic container width for zero-scroll auto-fit
  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setTimelineContainerWidth(el.clientWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    window.addEventListener('resize', updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [isFullscreen, isLeftPaneCollapsed]);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      if (ganttContainerRef.current?.requestFullscreen) {
        ganttContainerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  const handleZoomIn = useCallback(() => {
    setZoomFactor(prev => Math.min(3.0, +(prev + 0.15).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomFactor(prev => Math.max(0.15, +(prev - 0.15).toFixed(2)));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomFactor(1.0);
  }, []);

  // Helper to compute duration-weighted physical progress from tasks
  const computeProjectProgress = useCallback((taskList: GanttTaskItem[]) => {
    if (!taskList || taskList.length === 0) return 0;
    const totalDuration = taskList.reduce((acc, curr) => acc + Math.max(1, curr.duration || 1), 0);
    const weightedProgress = taskList.reduce((acc, curr) => acc + (curr.progress || 0) * Math.max(1, curr.duration || 1), 0);
    return totalDuration > 0 ? Math.round((weightedProgress / totalDuration) * 100) : 0;
  }, []);

  const currentProjectProgress = useMemo(() => {
    return computeProjectProgress(tasks);
  }, [tasks, computeProjectProgress]);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Critical Path Method (CPM) and Float Calculation
  const { criticalTaskIds, taskFloatMap, criticalLinkKeys } = useMemo(() => {
    return computeCriticalPath(tasks, links);
  }, [tasks, links]);

  // Unified, deduplicated dependency connections (from links array and task.predecessorIds)
  const dependencyConnections = useMemo(() => {
    const pairMap = new Map<string, { predId: string; succId: string }>();
    const taskById = new Map<string, GanttTaskItem>(tasks.map(t => [t.id, t]));

    // Read from links state array
    links.forEach(l => {
      const predId = String(l.source);
      const succId = String(l.target);
      if (!predId || !succId || predId === succId) return;
      const succTask = taskById.get(succId);
      const predTask = taskById.get(predId);
      if (!succTask || !predTask) return;
      // Filter out parent-child hierarchy links
      if (succTask.parentTaskId === predId || predTask.parentTaskId === succId) return;
      pairMap.set(`${predId}->${succId}`, { predId, succId });
    });

    // Read from task predecessorIds
    tasks.forEach(task => {
      (task.predecessorIds || []).forEach(pId => {
        const predId = String(pId);
        const succId = String(task.id);
        if (!predId || !succId || predId === succId) return;
        const predTask = taskById.get(predId);
        if (!predTask) return;
        // Filter out parent-child hierarchy links
        if (task.parentTaskId === predId || predTask.parentTaskId === succId) return;
        pairMap.set(`${predId}->${succId}`, { predId, succId });
      });
    });

    return Array.from(pairMap.values());
  }, [tasks, links]);

  // Edit Modal & Creation Draft State
  const [isNewTaskDraft, setIsNewTaskDraft] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<GanttTaskItem | null>(null);
  const [editFormData, setEditFormData] = useState<{
    text: string;
    startDate: string;
    endDate: string;
    duration: number;
    progress: number;
    type: 'task' | 'project' | 'milestone';
    assignedContractorId: string;
    predecessorIds: string[];
  }>({
    text: '',
    startDate: '',
    endDate: '',
    duration: 1,
    progress: 0,
    type: 'task',
    assignedContractorId: '',
    predecessorIds: []
  });

  // Direct Manipulation Drag & Resize State
  const [dragState, setDragState] = useState<DragState>({
    active: false,
    type: 'move',
    taskId: '',
    initialPointerX: 0,
    initialStartDate: '',
    initialEndDate: '',
    initialDuration: 1
  });

  // Debounced Sync Queue
  const pendingSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle synchronized vertical scroll
  const handleTableScroll = () => {
    if (isScrollingSync.current) return;
    isScrollingSync.current = true;
    if (timelineScrollRef.current && tableBodyRef.current) {
      timelineScrollRef.current.scrollTop = tableBodyRef.current.scrollTop;
    }
    setTimeout(() => { isScrollingSync.current = false; }, 10);
  };

  const handleTimelineScroll = () => {
    if (isScrollingSync.current) return;
    isScrollingSync.current = true;
    if (tableBodyRef.current && timelineScrollRef.current) {
      tableBodyRef.current.scrollTop = timelineScrollRef.current.scrollTop;
    }
    setTimeout(() => { isScrollingSync.current = false; }, 10);
  };

  // Weather-suspended date set
  const weatherSuspendedDates = useMemo(() => {
    const set = new Set<string>();
    siteLogs.forEach(log => {
      if (log.weather === 'STORM' || (log.delaysOrIssues && log.delaysOrIssues.toLowerCase().includes('suspended'))) {
        const d = parseDate(log.date);
        set.add(formatDateISO(d));
      }
    });
    return set;
  }, [siteLogs]);

  // ==========================================
  // 5. Load Project Gantt Data from API
  // ==========================================

  const loadGanttData = useCallback(async (projectId: string) => {
    if (!projectId) {
      setTasks([]);
      setLinks([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/gantt`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const rawTasks = Array.isArray(json.data) ? json.data : [];
      const rawLinks = Array.isArray(json.links) ? json.links : [];

      // Link mapping: map links into predecessorIds
      const predMap = new Map<string, string[]>();
      rawLinks.forEach((l: any) => {
        const targetId = String(l.target);
        const sourceId = String(l.source);
        if (!predMap.has(targetId)) predMap.set(targetId, []);
        predMap.get(targetId)!.push(sourceId);
      });

      const parsedTasks: GanttTaskItem[] = rawTasks.map((t: any, idx: number) => {
        const sDate = parseDate(t.start_date || t.startDate);
        const eDate = parseDate(t.end_date || t.endDate);
        const rawDuration = t.duration !== undefined ? Number(t.duration) : countWorkingDays(sDate, eDate);
        const isMilestone = (rawDuration === 0 || t.type === 'milestone');
        const duration = isMilestone ? 0 : Math.max(1, rawDuration);
        const startDateStr = formatDateISO(sDate);
        const endDateStr = isMilestone ? startDateStr : formatDateISO(eDate);

        return {
          id: String(t.id),
          projectId,
          wbsCode: t.wbsCode || `${idx + 1}.0`,
          text: t.text || t.title || 'Construction Task',
          startDate: startDateStr,
          endDate: endDateStr,
          duration,
          progress: typeof t.progress === 'number' ? Math.max(0, Math.min(1, t.progress)) : 0,
          baselineStart: t.baselineStart ? formatDateISO(parseDate(t.baselineStart)) : null,
          baselineEnd: t.baselineEnd ? formatDateISO(parseDate(t.baselineEnd)) : null,
          type: isMilestone ? 'milestone' : (t.type || 'task'),
          parentTaskId: t.parent && t.parent !== 0 && t.parent !== '0' ? String(t.parent) : (t.parentTaskId || null),
          sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : idx,
          assignedContractorId: t.assignedContractorId || null,
          contractorName: t.contractor || 'CTVill Construction Crew',
          predecessorIds: predMap.get(String(t.id)) || []
        };
      });

      const parsedLinks: GanttLinkItem[] = rawLinks.map((l: any) => ({
        id: String(l.id),
        source: String(l.source),
        target: String(l.target),
        type: String(l.type ?? '0'),
        lag: Number(l.lag ?? 0)
      }));

      // Filter out any recently deleted tasks that might still be returned due to race conditions
      const validTasks = parsedTasks.filter(t => !isTaskTombstoned(t.id));
      const validLinks = parsedLinks.filter(l => !isTaskTombstoned(l.source) && !isTaskTombstoned(l.target));

      if (validTasks.length > 0) {
        setTasks(validTasks);
        setLinks(validLinks);
      } else if (tasksProp && tasksProp.length > 0) {
        setTasks(tasksProp);
        setLinks(validLinks);
      } else {
        setTasks(DEFAULT_EM_JAY_TASKS);
        setLinks(DEFAULT_EM_JAY_LINKS);
      }
    } catch (err) {
      console.error('Failed to load project gantt data:', err);
      if (tasksProp && tasksProp.length > 0) {
        setTasks(tasksProp);
      } else {
        setTasks(DEFAULT_EM_JAY_TASKS);
        setLinks(DEFAULT_EM_JAY_LINKS);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isTaskTombstoned, tasksProp]);

  useEffect(() => {
    loadGanttData(selectedProjectId);
  }, [selectedProjectId, loadGanttData]);

  // ==========================================
  // 6. Backend Synchronization Helper
  // ==========================================

  const syncBackend = useCallback(async (
    action: 'create' | 'update' | 'delete',
    task: Partial<GanttTaskItem> & { id: string }
  ) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/gantt/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          entityType: 'task',
          task: {
            id: task.id,
            text: task.text,
            startDate: task.startDate,
            endDate: task.endDate,
            duration: task.duration,
            progress: task.progress,
            type: task.type,
            parentTaskId: task.parentTaskId,
            wbsCode: task.wbsCode,
            assignedContractorId: task.assignedContractorId,
            predecessorIds: task.predecessorIds
          }
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const resData = await res.json().catch(() => null);
      if (resData?.result?.projectProgress !== undefined) {
        onUpdateProject?.(selectedProjectId, {
          progressPercentage: resData.result.projectProgress,
          tasksCount: resData.result.tasksCount
        });
      }
      setSyncFeedback({ type: 'success', message: 'Schedule synchronized with database.' });
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err) {
      console.error('syncBackend error:', err);
      setSyncFeedback({ type: 'error', message: 'Failed to save changes to database.' });
    } finally {
      setIsSyncing(false);
    }
  }, [selectedProjectId, onUpdateProject]);

  const queueDebouncedSync = useCallback((
    action: 'create' | 'update' | 'delete',
    task: Partial<GanttTaskItem> & { id: string }
  ) => {
    if (pendingSyncTimerRef.current) {
      clearTimeout(pendingSyncTimerRef.current);
    }
    pendingSyncTimerRef.current = setTimeout(() => {
      syncBackend(action, task);
    }, 400);
  }, [syncBackend]);

  // ==========================================
  // 6b. Multi-Level Task Tree & Collapsible Subtasks
  // ==========================================
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Set<string>>(new Set());

  const toggleTaskCollapse = useCallback((taskId: string) => {
    setCollapsedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setCollapsedTaskIds(new Set());
  }, []);

  const handleCollapseAll = useCallback(() => {
    // Collect all task IDs that have children
    const parentIds = new Set<string>();
    tasks.forEach(t => {
      if (t.parentTaskId) {
        parentIds.add(t.parentTaskId);
      }
    });
    setCollapsedTaskIds(parentIds);
  }, [tasks]);

  const { visibleTasks, depthMap, hasChildrenMap, descendantCountMap } = useMemo(() => {
    const allIds = new Set(tasks.map(t => t.id));
    const childMap = new Map<string, GanttTaskItem[]>();
    const rootTasks: GanttTaskItem[] = [];

    // Group tasks into parent-children buckets
    tasks.forEach(t => {
      if (t.parentTaskId && allIds.has(t.parentTaskId)) {
        if (!childMap.has(t.parentTaskId)) childMap.set(t.parentTaskId, []);
        childMap.get(t.parentTaskId)!.push(t);
      } else {
        rootTasks.push(t);
      }
    });

    const dMap = new Map<string, number>();
    const hcMap = new Map<string, boolean>();
    const descCountMap = new Map<string, number>();

    // Recursively count all descendants (children, grandchildren, etc.)
    const countDescendants = (taskId: string): number => {
      const children = childMap.get(taskId) || [];
      let count = children.length;
      for (const child of children) {
        count += countDescendants(child.id);
      }
      descCountMap.set(taskId, count);
      return count;
    };

    tasks.forEach(t => {
      hcMap.set(t.id, (childMap.get(t.id)?.length || 0) > 0);
      countDescendants(t.id);
    });

    // Pre-calculate effective start date for every task (earliest start date among the task itself and all its descendants)
    const effectiveStartTimeMap = new Map<string, number>();

    const getEffectiveStartTime = (taskId: string): number => {
      if (effectiveStartTimeMap.has(taskId)) {
        return effectiveStartTimeMap.get(taskId)!;
      }
      const t = tasks.find(x => x.id === taskId);
      let minTime = t ? getTaskDate(t).getTime() : Infinity;

      const children = childMap.get(taskId) || [];
      for (const child of children) {
        const childTime = getEffectiveStartTime(child.id);
        if (childTime < minTime) {
          minTime = childTime;
        }
      }
      effectiveStartTimeMap.set(taskId, minTime);
      return minTime;
    };

    tasks.forEach(t => {
      getEffectiveStartTime(t.id);
    });

    // Chronological WBS Sequence:
    // Sort child tasks under parent milestones strictly by startDate ascending across all WBS levels
    const sortByStartDate = (a: GanttTaskItem, b: GanttTaskItem) => {
      const timeA = effectiveStartTimeMap.get(a.id) ?? getTaskDate(a).getTime();
      const timeB = effectiveStartTimeMap.get(b.id) ?? getTaskDate(b).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const directA = getTaskDate(a).getTime();
      const directB = getTaskDate(b).getTime();
      if (directA !== directB) return directA - directB;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    };

    rootTasks.sort(sortByStartDate);

    // Traverse tree in depth-first order to construct properly nested list
    const ordered: { task: GanttTaskItem; depth: number }[] = [];
    const visited = new Set<string>();

    const traverse = (items: GanttTaskItem[], depth: number) => {
      const sortedItems = items.slice().sort(sortByStartDate);
      sortedItems.forEach(item => {
        if (visited.has(item.id)) return;
        visited.add(item.id);
        dMap.set(item.id, depth);
        ordered.push({ task: item, depth });
        const children = childMap.get(item.id) || [];
        if (children.length > 0) {
          const sortedChildren = children.slice().sort(sortByStartDate);
          traverse(sortedChildren, depth + 1);
        }
      });
    };

    traverse(rootTasks, 0);

    // Fallback for any unreachable tasks (e.g. self-referencing) sorted by startDate
    const unreachable = tasks.filter(t => !visited.has(t.id)).sort(sortByStartDate);
    unreachable.forEach(t => {
      dMap.set(t.id, 0);
      ordered.push({ task: t, depth: 0 });
    });

    // Build visible list: task is visible if NO ancestor is collapsed
    const visList: GanttTaskItem[] = [];
    ordered.forEach(({ task }) => {
      let isHidden = false;
      let currParentId = task.parentTaskId;

      const ancestorChain = new Set<string>();
      while (currParentId && allIds.has(currParentId) && !ancestorChain.has(currParentId)) {
        ancestorChain.add(currParentId);
        if (collapsedTaskIds.has(currParentId)) {
          isHidden = true;
          break;
        }
        const parentObj = tasks.find(t => t.id === currParentId);
        currParentId = parentObj?.parentTaskId || null;
      }

      if (!isHidden) {
        visList.push(task);
      }
    });

    return {
      visibleTasks: visList,
      depthMap: dMap,
      hasChildrenMap: hcMap,
      descendantCountMap: descCountMap
    };
  }, [tasks, collapsedTaskIds]);

  // ==========================================
  // 7. Timescale & Geometry Math
  // ==========================================

  const columnWidth = useMemo(() => {
    let base = 22;
    switch (zoomLevel) {
      case 'day': base = 42; break;
      case 'week': base = 22; break;
      case 'month': base = 10; break;
      case 'quarter': base = 5; break;
      case 'year': base = 2.5; break;
    }
    return Math.max(1.5, +(base * zoomFactor).toFixed(2));
  }, [zoomLevel, zoomFactor]);

  const ROW_HEIGHT = 54;

  // Determine timeline boundary dates
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 3, 0, 12, 0, 0, 0);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return { timelineStart: start, timelineEnd: end, totalDays: Math.max(diff, 60) };
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    tasks.forEach(t => {
      const s = parseDate(t.startDate).getTime();
      const e = parseDate(t.endDate).getTime();
      if (!isNaN(s) && s < minTime) minTime = s;
      if (!isNaN(e) && e > maxTime) maxTime = e;
      if (t.baselineStart) {
        const bs = parseDate(t.baselineStart).getTime();
        if (!isNaN(bs) && bs < minTime) minTime = bs;
      }
      if (t.baselineEnd) {
        const be = parseDate(t.baselineEnd).getTime();
        if (!isNaN(be) && be > maxTime) maxTime = be;
      }
    });

    if (!isFinite(minTime) || !isFinite(maxTime) || isNaN(minTime) || isNaN(maxTime)) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 3, 0, 12, 0, 0, 0);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return { timelineStart: start, timelineEnd: end, totalDays: Math.max(diff, 60) };
    }

    const start = new Date(minTime);
    start.setDate(start.getDate() - 3); // 3-day left padding
    start.setHours(12, 0, 0, 0);

    const end = new Date(maxTime);
    end.setDate(end.getDate() + 15); // 15-day right padding for in-canvas task labels and connectors
    end.setHours(12, 0, 0, 0);

    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { timelineStart: start, timelineEnd: end, totalDays: Math.max(diff, 60) };
  }, [tasks]);

  const timelineWidth = Math.max(timelineContainerWidth, Math.round(totalDays * columnWidth));

  // Fit Entire Project Timeline to Screen (Zero horizontal scroll)
  const handleFitToScreen = useCallback(() => {
    const containerW = timelineScrollRef.current?.clientWidth || timelineContainerWidth || 1000;
    const availableW = Math.max(300, containerW - 32);
    const targetColW = availableW / Math.max(1, totalDays);

    let base = 10;
    let targetLevel: ZoomLevel = 'month';
    if (targetColW <= 3.5) {
      targetLevel = 'year';
      base = 2.5;
    } else if (targetColW <= 7.5) {
      targetLevel = 'quarter';
      base = 5.0;
    } else if (targetColW <= 16) {
      targetLevel = 'month';
      base = 10.0;
    } else if (targetColW <= 30) {
      targetLevel = 'week';
      base = 22.0;
    } else {
      targetLevel = 'day';
      base = 42.0;
    }
    const factor = +(targetColW / base).toFixed(2);
    setZoomLevel(targetLevel);
    setZoomFactor(Math.max(0.15, Math.min(3.0, factor)));
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollLeft = 0;
    }
  }, [timelineContainerWidth, totalDays]);

  // Automatically fit all tasks and milestones across the monitor whenever Full Screen Mode is activated
  useEffect(() => {
    if (isFullscreen) {
      const timer = setTimeout(() => {
        handleFitToScreen();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen, handleFitToScreen]);

  const dateToPixel = useCallback((date: Date | string): number => {
    const d = parseDate(date);
    const tStart = timelineStart instanceof Date && !isNaN(timelineStart.getTime()) ? timelineStart : new Date();
    const dTime = !isNaN(d.getTime()) ? d.getTime() : tStart.getTime();
    const diffTime = dTime - tStart.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const colW = columnWidth || 22;
    const px = diffDays * colW;
    return isNaN(px) ? 0 : Math.round(px);
  }, [timelineStart, columnWidth]);

  const pixelToDate = useCallback((pixelX: number): Date => {
    const colW = columnWidth || 22;
    const days = Math.round((pixelX || 0) / colW);
    const tStart = timelineStart instanceof Date && !isNaN(timelineStart.getTime()) ? timelineStart : new Date();
    const result = new Date(tStart);
    result.setDate(result.getDate() + (isNaN(days) ? 0 : days));
    result.setHours(12, 0, 0, 0);
    return result;
  }, [timelineStart, columnWidth]);

  // Today marker line position
  const todayPixel = useMemo(() => {
    return dateToPixel(new Date());
  }, [dateToPixel]);

  // Days list for timeline header
  const daysList = useMemo(() => {
    const list: { date: Date; dateStr: string; isSun: boolean; isWeatherSuspended: boolean }[] = [];
    const curr = new Date(timelineStart);
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(curr);
      const str = formatDateISO(d);
      list.push({
        date: d,
        dateStr: str,
        isSun: isSunday(d),
        isWeatherSuspended: weatherSuspendedDates.has(str)
      });
      curr.setDate(curr.getDate() + 1);
    }
    return list;
  }, [timelineStart, totalDays, weatherSuspendedDates]);

  // Month grouping headers
  const monthHeaders = useMemo(() => {
    const headers: { monthLabel: string; shortLabel: string; leftPixel: number; widthPixel: number }[] = [];
    let currentMonthKey = '';
    let startIdx = 0;

    daysList.forEach((day, idx) => {
      const monthKey = `${day.date.getFullYear()}-${day.date.getMonth()}`;
      if (monthKey !== currentMonthKey) {
        if (currentMonthKey !== '') {
          headers.push({
            monthLabel: daysList[startIdx].date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            shortLabel: daysList[startIdx].date.toLocaleDateString('en-US', { month: 'short' }),
            leftPixel: startIdx * columnWidth,
            widthPixel: (idx - startIdx) * columnWidth
          });
        }
        currentMonthKey = monthKey;
        startIdx = idx;
      }
    });

    if (startIdx < daysList.length) {
      headers.push({
        monthLabel: daysList[startIdx].date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        shortLabel: daysList[startIdx].date.toLocaleDateString('en-US', { month: 'short' }),
        leftPixel: startIdx * columnWidth,
        widthPixel: (daysList.length - startIdx) * columnWidth
      });
    }

    return headers;
  }, [daysList, columnWidth]);

  // ==========================================
  // 8. Direct Manipulation: Drag & Resize
  // ==========================================

  const handlePointerDown = (
    e: React.PointerEvent | React.MouseEvent,
    taskId: string,
    type: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.stopPropagation();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setDragState({
      active: true,
      type,
      taskId,
      initialPointerX: e.clientX,
      initialStartDate: task.startDate,
      initialEndDate: task.endDate,
      initialDuration: task.duration
    });
  };

  useEffect(() => {
    if (!dragState.active) return;

    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const onPointerMove = (e: MouseEvent | PointerEvent) => {
      const deltaX = e.clientX - dragState.initialPointerX;
      const deltaDays = Math.round(deltaX / columnWidth);

      setTasks(prevTasks => {
        const taskIndex = prevTasks.findIndex(t => t.id === dragState.taskId);
        if (taskIndex === -1) return prevTasks;
        const targetTask = { ...prevTasks[taskIndex] };
        const dur = dragState.initialDuration || countWorkingDays(dragState.initialStartDate, dragState.initialEndDate) || 1;

        if (dragState.type === 'move') {
          const origStart = parseDate(dragState.initialStartDate);
          const newStart = new Date(origStart);
          newStart.setDate(newStart.getDate() + deltaDays);
          if (isSunday(newStart)) newStart.setDate(newStart.getDate() + 1);

          const isMilestone = targetTask.type === 'milestone' || dur === 0;
          const newEnd = isMilestone
            ? newStart
            : addWorkingDays(newStart, Math.max(1, dur));

          targetTask.startDate = formatDateISO(newStart);
          targetTask.endDate = formatDateISO(newEnd);
          targetTask.duration = isMilestone ? 0 : dur;
        } else if (dragState.type === 'resize-left') {
          const origStart = parseDate(dragState.initialStartDate);
          const fixedEnd = parseDate(dragState.initialEndDate);
          const newStart = new Date(origStart);
          newStart.setDate(newStart.getDate() + deltaDays);
          if (isSunday(newStart)) newStart.setDate(newStart.getDate() + 1);

          if (newStart <= fixedEnd) {
            const newDur = countWorkingDays(newStart, fixedEnd);
            targetTask.startDate = formatDateISO(newStart);
            targetTask.endDate = dragState.initialEndDate;
            targetTask.duration = Math.max(1, newDur);
          }
        } else if (dragState.type === 'resize-right') {
          const fixedStart = parseDate(dragState.initialStartDate);
          const origEnd = parseDate(dragState.initialEndDate);
          const newEnd = new Date(origEnd);
          newEnd.setDate(newEnd.getDate() + deltaDays);
          if (isSunday(newEnd)) newEnd.setDate(newEnd.getDate() - 1);

          if (newEnd >= fixedStart) {
            const newDur = countWorkingDays(fixedStart, newEnd);
            targetTask.startDate = dragState.initialStartDate;
            targetTask.endDate = formatDateISO(newEnd);
            targetTask.duration = Math.max(1, newDur);
          }
        }

        const updatedList = [...prevTasks];
        updatedList[taskIndex] = targetTask;
        return updatedList;
      });
    };

    const onPointerUp = () => {
      document.body.style.userSelect = originalUserSelect;

      setTasks(currentTasks => {
        const finalTask = currentTasks.find(t => t.id === dragState.taskId);
        if (finalTask) {
          queueDebouncedSync('update', finalTask);
        }
        return currentTasks;
      });

      setDragState(prev => ({ ...prev, active: false }));
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    return () => {
      document.body.style.userSelect = originalUserSelect;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
    };
  }, [dragState, columnWidth, queueDebouncedSync]);

  // ==========================================
  // 9. Quick Edit Modal Handlers
  // ==========================================

  const handleOpenEditModal = (task: GanttTaskItem) => {
    setIsNewTaskDraft(false);
    setEditingTask(task);
    setEditFormData({
      text: task.text,
      startDate: task.startDate,
      endDate: task.endDate,
      duration: task.duration,
      progress: Math.round(task.progress * 100),
      type: task.type,
      assignedContractorId: task.assignedContractorId || '',
      predecessorIds: [...task.predecessorIds]
    });
  };

  const handleSaveEditModal = () => {
    if (!editingTask) return;

    const contractor = contractors.find(c => c.id === editFormData.assignedContractorId);
    const progressVal = Math.max(0, Math.min(1, editFormData.progress / 100));
    const sDate = parseDate(editFormData.startDate);
    const isMs = Number(editFormData.duration) === 0 || editFormData.type === 'milestone';
    const eDate = isMs ? sDate : (editFormData.endDate ? parseDate(editFormData.endDate) : addWorkingDays(sDate, Number(editFormData.duration) || 1));
    const dur = isMs ? 0 : Math.max(1, countWorkingDays(sDate, eDate) || Number(editFormData.duration) || 1);

    const updatedTask: GanttTaskItem = {
      ...editingTask,
      text: editFormData.text,
      startDate: formatDateISO(sDate),
      endDate: formatDateISO(eDate),
      duration: dur,
      progress: progressVal,
      type: (dur === 0 || editFormData.type === 'milestone') ? 'milestone' : editFormData.type,
      assignedContractorId: editFormData.assignedContractorId || null,
      contractorName: contractor?.name || editingTask.contractorName || 'CTVill Construction Crew',
      predecessorIds: editFormData.predecessorIds
    };

    // Update predecessor links list
    const updatedLinks = links.filter(l => l.target !== updatedTask.id);
    editFormData.predecessorIds.forEach(pId => {
      if (pId && pId !== updatedTask.id) {
        updatedLinks.push({
          id: `link-${pId}-${updatedTask.id}`,
          source: pId,
          target: updatedTask.id,
          type: '0',
          lag: 0
        });
      }
    });

    setLinks(updatedLinks);

    if (isNewTaskDraft) {
      setTasks(prev => {
        const next = [...prev, updatedTask];
        const scheduled = cascadeDownstreamSchedule(next, updatedLinks, updatedTask.id);
        const newProg = computeProjectProgress(scheduled);
        onUpdateProject?.(selectedProjectId, {
          progressPercentage: newProg,
          tasksCount: scheduled.length
        });
        return scheduled;
      });
      syncBackend('create', updatedTask);
    } else {
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === updatedTask.id);
        const copy = [...prev];
        if (idx !== -1) copy[idx] = updatedTask;
        const scheduled = cascadeDownstreamSchedule(copy, updatedLinks, updatedTask.id);
        const newProg = computeProjectProgress(scheduled);
        onUpdateProject?.(selectedProjectId, {
          progressPercentage: newProg,
          tasksCount: scheduled.length
        });
        return scheduled;
      });
      syncBackend('update', updatedTask);
    }

    setIsNewTaskDraft(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!window.confirm(`Are you sure you want to delete "${task.text}"? Connected dependency lines will be unlinked.`)) {
      return;
    }

    // Tombstone for 15 seconds to guarantee zero ghost reappearances
    recentlyDeletedTaskIdsRef.current.set(taskId, Date.now() + 15000);

    setTasks(prev => {
      const remaining = prev.filter(t => t.id !== taskId).map(t => ({
        ...t,
        predecessorIds: t.predecessorIds.filter(id => id !== taskId)
      }));
      const newProg = computeProjectProgress(remaining);
      onUpdateProject?.(selectedProjectId, {
        progressPercentage: newProg,
        tasksCount: remaining.length
      });
      return remaining;
    });

    setLinks(prev => prev.filter(l => l.source !== taskId && l.target !== taskId));
    setCollapsedTaskIds(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });

    // Notify parent App component to drop task from App state immediately
    onDeleteTask?.(taskId);

    syncBackend('delete', { id: taskId });
    if (editingTask && editingTask.id === taskId) {
      setEditingTask(null);
      setIsNewTaskDraft(false);
    }
  };

  const handleAddSubtask = (parentTask: GanttTaskItem) => {
    const parentStart = parseDate(parentTask.startDate);
    const newId = `task-${Date.now()}`;
    const newStart = parentStart;
    const newEnd = addWorkingDays(newStart, 3);
    const existingChildrenCount = tasks.filter(t => t.parentTaskId === parentTask.id).length;

    // Clean WBS generation:
    // e.g. parent "1.0" -> "1.1", "1.2"; parent "1.1" -> "1.1.1"; parent "2" -> "2.1"
    let baseCode = parentTask.wbsCode || '1.0';
    if (baseCode.endsWith('.0')) {
      baseCode = baseCode.slice(0, -2);
    }
    const childWbs = `${baseCode}.${existingChildrenCount + 1}`;

    const newSubtask: GanttTaskItem = {
      id: newId,
      projectId: selectedProjectId,
      wbsCode: childWbs,
      text: `Subtask of ${parentTask.text}`,
      startDate: formatDateISO(newStart),
      endDate: formatDateISO(newEnd),
      duration: 3,
      progress: 0,
      type: 'task',
      parentTaskId: parentTask.id,
      sortOrder: parentTask.sortOrder + 1,
      assignedContractorId: parentTask.assignedContractorId,
      contractorName: parentTask.contractorName,
      predecessorIds: []
    };

    // Auto-expand parent task if it was collapsed
    setCollapsedTaskIds(prev => {
      const next = new Set(prev);
      next.delete(parentTask.id);
      return next;
    });
    setTasks(prev => {
      // Find parent index and insert immediately below it (or after existing children of that parent)
      const parentIdx = prev.findIndex(t => t.id === parentTask.id);
      if (parentIdx === -1) {
        return [...prev, newSubtask];
      }
      let insertIdx = parentIdx + 1;
      while (insertIdx < prev.length && prev[insertIdx].parentTaskId === parentTask.id) {
        insertIdx++;
      }
      const next = [...prev];
      next.splice(insertIdx, 0, newSubtask);
      const reindexed = next.map((t, idx) => ({ ...t, sortOrder: idx + 1 }));
      const newProg = computeProjectProgress(reindexed);
      onUpdateProject?.(selectedProjectId, {
        progressPercentage: newProg,
        tasksCount: reindexed.length
      });
      return reindexed;
    });
    syncBackend('create', newSubtask);
  };

  const handleAddNewTask = () => {
    if (!selectedProjectId) return;
    const now = new Date();
    if (isSunday(now)) now.setDate(now.getDate() + 1);
    const newId = `task-${Date.now()}`;
    const startStr = formatDateISO(now);
    const endStr = formatDateISO(addWorkingDays(now, 5));

    const draftTask: GanttTaskItem = {
      id: newId,
      projectId: selectedProjectId,
      wbsCode: `${tasks.length + 1}.0`,
      text: 'New Civil Construction Task',
      startDate: startStr,
      endDate: endStr,
      duration: 5,
      progress: 0,
      type: 'task',
      parentTaskId: null,
      sortOrder: tasks.length + 1,
      assignedContractorId: contractors[0]?.id || null,
      contractorName: contractors[0]?.name || 'CTVill Construction Crew',
      predecessorIds: []
    };

    setIsNewTaskDraft(true);
    setEditingTask(draftTask);
    setEditFormData({
      text: draftTask.text,
      startDate: draftTask.startDate,
      endDate: draftTask.endDate,
      duration: draftTask.duration,
      progress: 0,
      type: draftTask.type,
      assignedContractorId: draftTask.assignedContractorId || '',
      predecessorIds: []
    });
  };

  const handleAddNewMilestone = () => {
    if (!selectedProjectId) return;
    const now = new Date();
    if (isSunday(now)) now.setDate(now.getDate() + 1);
    const newId = `milestone-${Date.now()}`;
    const dateStr = formatDateISO(now);

    const draftMilestone: GanttTaskItem = {
      id: newId,
      projectId: selectedProjectId,
      wbsCode: `${tasks.length + 1}.M`,
      text: 'Milestone Inspection & Sign-off',
      startDate: dateStr,
      endDate: dateStr,
      duration: 0,
      progress: 0,
      type: 'milestone',
      parentTaskId: null,
      sortOrder: tasks.length + 1,
      assignedContractorId: null,
      contractorName: 'CTVill Lead PM',
      predecessorIds: []
    };

    setIsNewTaskDraft(true);
    setEditingTask(draftMilestone);
    setEditFormData({
      text: draftMilestone.text,
      startDate: draftMilestone.startDate,
      endDate: draftMilestone.endDate,
      duration: 0,
      progress: 0,
      type: 'milestone',
      assignedContractorId: '',
      predecessorIds: []
    });
  };

  // Quick Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.progress >= 1).length;
    const milestones = tasks.filter(t => t.type === 'milestone' || t.duration === 0).length;
    return { total, completed, milestones };
  }, [tasks]);

  const totalGridHeight = useMemo(() => {
    return Math.max(600, visibleTasks.length * ROW_HEIGHT);
  }, [visibleTasks.length]);

  const handleScrollToToday = useCallback(() => {
    if (timelineScrollRef.current && todayPixel >= 0) {
      timelineScrollRef.current.scrollTo({
        left: Math.max(0, todayPixel - 200),
        behavior: 'smooth'
      });
    }
  }, [todayPixel]);

  const handleScrollToFirstTask = useCallback(() => {
    if (timelineScrollRef.current && visibleTasks.length > 0) {
      const firstTaskStart = visibleTasks[0].startDate;
      const px = dateToPixel(firstTaskStart);
      timelineScrollRef.current.scrollTo({
        left: Math.max(0, px - 150),
        behavior: 'smooth'
      });
    }
  }, [visibleTasks, dateToPixel]);

  return (
    <div 
      ref={ganttContainerRef}
      className={`transition-all duration-300 ${
        isFullscreen 
          ? (isDark ? 'fixed inset-0 z-50 bg-slate-950 p-4 md:p-6 flex flex-col h-screen w-screen overflow-hidden' : 'fixed inset-0 z-50 bg-slate-100 p-4 md:p-6 flex flex-col h-screen w-screen overflow-hidden')
          : 'space-y-4 select-none'
      }`}
    >
      {/* 1. Header Toolbar */}
      <div className={`${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
      } border rounded-xl transition-all ${
        isFullscreen ? 'p-3 mb-2 shrink-0' : 'p-4'
      }`}>
        {!isFullscreen ? (
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold tracking-wider uppercase border ${
                  isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  Critical Path Method
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  React 19 Direct Manipulation • 6-Day Workweek
                </span>
              </div>
              <h2 className={`text-base font-bold tracking-tight flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                <Layers className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                Construction CPM Scheduling & Task Management
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Drag bars to reschedule, drag edges to adjust duration, or double-click to configure predecessors and dependencies.
              </p>
            </div>

            {/* Metrics summary */}
            <div className={`flex items-center gap-3 text-xs font-mono px-3.5 py-1.5 rounded-xl border self-start xl:self-auto ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200/80 shadow-2xs'
            }`}>
              <div className="text-center px-1">
                <span className={`text-[10px] uppercase block tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total</span>
                <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{metrics.total}</span>
              </div>
              <div className={`h-5 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div className="text-center px-1">
                <span className={`text-[10px] uppercase block tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Done</span>
                <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{metrics.completed}</span>
              </div>
              <div className={`h-5 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div className="text-center px-1">
                <span className={`text-[10px] uppercase block tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Milestones</span>
                <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{metrics.milestones}</span>
              </div>
              <div className={`h-5 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <div className="text-center px-1">
                <span className={`text-[10px] uppercase block tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Progress</span>
                <span className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentProjectProgress}%</span>
              </div>
            </div>
          </div>
        ) : (
          /* Sleek Fullscreen Status Banner */
          <div className={`flex items-center justify-between gap-4 text-xs font-mono pb-2 border-b ${
            isDark ? 'border-slate-800/80' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className={`font-bold text-sm tracking-tight flex items-center gap-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                <Layers className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                {activeProject?.name || 'Project Schedule'}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                isDark ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}>
                {currentProjectProgress}% Done ({metrics.completed}/{metrics.total} Tasks • {metrics.milestones} Milestones)
              </span>
            </div>
            <div className={`flex items-center gap-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>Press <kbd className={`px-1.5 py-0.5 rounded border ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}>Esc</kbd> to exit full screen</span>
            </div>
          </div>
        )}

        {/* Action Controls Bar */}
        <div className={`mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2.5 ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          <div className="flex flex-wrap items-center gap-2">
            {/* Project Switcher */}
            {projects.length > 0 ? (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                aria-label="Select Commercial Project"
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:border-amber-500 focus:outline-none cursor-pointer border ${
                  isDark 
                    ? 'bg-slate-950 border-slate-700 text-slate-200' 
                    : 'bg-white border-slate-300 text-slate-800 shadow-2xs'
                }`}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id === selectedProjectId ? currentProjectProgress : (p.progressPercentage || 0)}% Complete)
                  </option>
                ))}
              </select>
            ) : (
              <span className={`text-xs font-mono px-2.5 py-1.5 rounded-lg border ${
                isDark ? 'text-slate-400 bg-slate-950 border-slate-800' : 'text-slate-500 bg-slate-50 border-slate-200'
              }`}>
                No Commercial Sites Registered
              </span>
            )}

            {/* Active Project Physical Progress Bar Indicator */}
            {activeProject && (
              <div className={`flex items-center gap-2.5 border rounded-xl px-3 py-1.5 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-2xs'
              }`}>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className={isDark ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>Progress:</span>
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentProjectProgress}%</span>
                </div>
                <div className={`w-20 h-1.5 rounded-full overflow-hidden border ${
                  isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-slate-200 border-slate-300/80'
                }`}>
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, currentProjectProgress))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Full Screen Mode */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300/80 shadow-2xs'
              }`}
              title={isFullscreen ? 'Exit Full Screen Mode (Esc)' : 'Open Full Screen Mode (Auto-fits entire schedule across monitor)'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
                  <span>Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
                  <span>Full Screen</span>
                </>
              )}
            </button>

            {/* Left Task Grid Pane Toggle (Wide Timeline View) */}
            <button
              type="button"
              onClick={() => setIsLeftPaneCollapsed(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                isLeftPaneCollapsed
                  ? isDark 
                    ? 'bg-indigo-950/70 text-indigo-300 border-indigo-700/60 hover:bg-indigo-900/60' 
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 shadow-2xs'
                  : isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300/80 shadow-2xs'
              }`}
              title={isLeftPaneCollapsed ? 'Show Task Grid' : 'Maximize Timeline (Hide Task Grid)'}
            >
              {isLeftPaneCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
              <span>{isLeftPaneCollapsed ? 'Show Grid' : 'Wide Timeline'}</span>
            </button>

            {/* Timescale Zoom Controls with Zoom In & Zoom Out */}
            <div className={`flex items-center border rounded-lg p-0.5 gap-0.5 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100/90 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={handleZoomOut}
                className={`p-1 rounded-md transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-amber-300 hover:bg-slate-800' : 'text-slate-600 hover:text-amber-700 hover:bg-white'
                }`}
                title="Zoom Out Timeline (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <div className={`flex items-center gap-0.5 border-x px-1 ${
                isDark ? 'border-slate-800/80' : 'border-slate-200'
              }`}>
                {(['year', 'quarter', 'month', 'week', 'day'] as ZoomLevel[]).map(z => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => { setZoomLevel(z); setZoomFactor(1); }}
                    className={`px-2 py-0.5 text-xs rounded font-mono font-medium transition cursor-pointer capitalize ${
                      zoomLevel === z 
                        ? (isDark ? 'bg-slate-800 text-amber-400 font-bold' : 'bg-white text-amber-700 font-bold shadow-2xs')
                        : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleZoomIn}
                className={`p-1 rounded-md transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-amber-300 hover:bg-slate-800' : 'text-slate-600 hover:text-amber-700 hover:bg-white'
                }`}
                title="Zoom In Timeline (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {/* Quick Auto-Fit Helper Button inside zoom group */}
              <button
                type="button"
                onClick={handleFitToScreen}
                className={`p-1 rounded-md transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-amber-300 hover:bg-slate-800' : 'text-slate-600 hover:text-amber-700 hover:bg-white'
                }`}
                title="Auto-Fit Timeline into current window width"
              >
                <Scan className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-amber-300' : 'text-slate-600 hover:text-amber-700'
                }`}
                title="Reset Zoom to 100%"
              >
                {Math.round(zoomFactor * 100)}%
              </button>
            </div>

            {/* Add Task / Milestone Buttons */}
            <button
              type="button"
              disabled={!selectedProjectId}
              onClick={handleAddNewTask}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 font-bold rounded-lg text-xs transition cursor-pointer ${
                !selectedProjectId
                  ? isDark 
                    ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
            <button
              type="button"
              disabled={!selectedProjectId}
              onClick={handleAddNewMilestone}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                !selectedProjectId
                  ? isDark 
                    ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border-slate-800'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                  : isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300/80 shadow-2xs'
              }`}
            >
              <span className={isDark ? 'text-amber-400 text-xs' : 'text-amber-600 text-xs'}>◆</span>
              <span>Add Milestone</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Tree Expand / Collapse All Quick Controls */}
            <div className={`flex items-center gap-0.5 border rounded-lg p-0.5 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100/90 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={handleExpandAll}
                className={`px-2 py-1 rounded text-xs font-mono transition flex items-center gap-1 cursor-pointer ${
                  isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white shadow-2xs'
                }`}
                title="Expand All Subtasks"
              >
                <ChevronsDown className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <span className="hidden sm:inline">Expand All</span>
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className={`px-2 py-1 rounded text-xs font-mono transition flex items-center gap-1 cursor-pointer ${
                  isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-white shadow-2xs'
                }`}
                title="Collapse All Subtasks"
              >
                <ChevronsUp className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <span className="hidden sm:inline">Collapse All</span>
              </button>
            </div>

            {/* Quick Timeline Scroll Jumper */}
            <div className={`flex items-center gap-0.5 border rounded-lg p-0.5 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100/90 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={handleScrollToToday}
                className={`px-2 py-1 rounded text-xs font-mono transition flex items-center gap-1 cursor-pointer ${
                  isDark ? 'text-rose-400 hover:text-white hover:bg-slate-800' : 'text-rose-600 hover:text-rose-700 hover:bg-white font-semibold shadow-2xs'
                }`}
                title="Scroll Timeline View to Today"
              >
                <span>Today</span>
              </button>
              <button
                type="button"
                onClick={handleScrollToFirstTask}
                className={`px-2 py-1 rounded text-xs font-mono transition flex items-center gap-1 cursor-pointer ${
                  isDark ? 'text-amber-400 hover:text-white hover:bg-slate-800' : 'text-amber-700 hover:text-amber-900 hover:bg-white font-semibold shadow-2xs'
                }`}
                title="Scroll Timeline View to First Scheduled Task"
              >
                <span>Jump to Tasks</span>
              </button>
            </div>

            {/* Sync status & Refresh */}
            <div className="flex items-center gap-2">
              {isSyncing && (
                <span className={`text-[11px] font-mono px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-pulse border ${
                  isDark ? 'text-indigo-400 bg-indigo-950/60 border-indigo-700' : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                }`}>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Auto-syncing to DB...</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => loadGanttData(selectedProjectId)}
                disabled={isLoading}
                className={`p-1.5 rounded-lg text-xs border transition cursor-pointer ${
                  isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700' 
                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300/80 shadow-2xs'
                }`}
                title="Reload from Server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {syncFeedback && (
          <div className={`mt-3 p-3 rounded-xl border text-xs font-mono flex items-center gap-2 animate-fadeIn ${
            syncFeedback.type === 'success' 
              ? isDark ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : isDark ? 'bg-rose-950/80 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            {syncFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{syncFeedback.message}</span>
          </div>
        )}
      </div>

      {/* 2. Em Jay Construction CPM Gantt Toolbar & Legend */}
      {!isFullscreen && (
        <div className={`border rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono select-none ${
          isDark ? 'bg-slate-950/90 border-slate-800 text-slate-300' : 'bg-slate-900 border-slate-800 text-slate-200 shadow-md'
        }`}>
          {/* Left: View Mode Pills & Action Tools */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Pills: Day / Week / Month */}
            <div className="flex items-center rounded-lg overflow-hidden bg-slate-900/90 border border-slate-700/80 p-0.5">
              {(['day', 'week', 'month'] as ZoomLevel[]).map(z => {
                const isActive = zoomLevel === z;
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => { setZoomLevel(z); setZoomFactor(1); }}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition cursor-pointer capitalize ${
                      isActive
                        ? 'bg-[#ea580c] text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {z === 'day' ? 'Day' : z === 'week' ? 'Week' : 'Month'}
                  </button>
                );
              })}
            </div>

            {/* Link mode */}
            <button
              type="button"
              onClick={() => {
                setSyncFeedback({
                  type: 'success',
                  message: 'Link mode enabled: Drag connectors between tasks to define Finish-to-Start relationships'
                });
                setTimeout(() => setSyncFeedback(null), 3500);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer shadow-2xs"
              title="Link Mode"
            >
              <Link2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Link mode</span>
            </button>

            {/* Auto-schedule */}
            <button
              type="button"
              onClick={() => {
                const { updatedTasks, shiftedCount } = autoScheduleProject(tasks, links);
                setTasks(updatedTasks);
                if (selectedProjectId) {
                  updatedTasks.forEach(t => {
                    const orig = tasks.find(ot => ot.id === t.id);
                    if (orig && (orig.startDate !== t.startDate || orig.endDate !== t.endDate)) {
                      syncBackend('update', t);
                    }
                  });
                }
                setSyncFeedback({
                  type: 'success',
                  message: `Auto-schedule completed: Cascaded ${shiftedCount} ${shiftedCount === 1 ? 'dependency' : 'dependencies'}`
                });
                setTimeout(() => setSyncFeedback(null), 3500);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer shadow-2xs"
              title="Auto-Schedule CPM"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Auto-schedule</span>
            </button>

            {/* Re-baseline */}
            <button
              type="button"
              onClick={() => {
                if (!selectedProjectId) return;
                const rebaselined = tasks.map(t => ({
                  ...t,
                  baselineStart: t.startDate,
                  baselineEnd: t.endDate
                }));
                setTasks(rebaselined);
                rebaselined.forEach(t => syncBackend('update', t));
                setSyncFeedback({
                  type: 'success',
                  message: 'Re-baseline complete: Contract baseline synchronized to current dates'
                });
                setTimeout(() => setSyncFeedback(null), 3500);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer shadow-2xs"
              title="Re-baseline Schedule"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Re-baseline</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer shadow-2xs"
              title="Print Gantt Chart"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print</span>
            </button>

            {/* Export */}
            <button
              type="button"
              onClick={() => {
                const headers = ['WBS,Task,Start,End,Duration,Progress,Type\n'];
                const rows = tasks.map(t =>
                  `"${t.wbsCode}","${t.text.replace(/"/g, '""')}","${t.startDate}","${t.endDate}",${t.duration},${Math.round(t.progress * 100)}%,"${t.type}"`
                );
                const blob = new Blob([...headers, ...rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Gantt_Schedule_${activeProject?.name?.replace(/\s+/g, '_') || 'CTVill'}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer shadow-2xs"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export</span>
            </button>

            {/* Reload */}
            <button
              type="button"
              onClick={() => loadGanttData(selectedProjectId)}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-xs border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer shadow-2xs"
              title="Reload from Server"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          </div>

          {/* Right: Reference Legend Items */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-2xs bg-emerald-600 inline-block" />
              <span className="text-slate-300">Task</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-2xs bg-red-600 inline-block" />
              <span className="text-slate-300">Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 font-bold text-xs select-none">◆</span>
              <span className="text-slate-300">Milestone</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-[2.5px] bg-slate-400/80 rounded-full inline-block" />
              <span className="text-slate-300">Baseline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-0.5 h-3 bg-red-500 inline-block" />
              <span className="text-slate-300">Today</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Dual-Pane Synchronized Gantt Canvas */}
      <div className={`border rounded-2xl overflow-hidden flex flex-col xl:flex-row ${
        isDark ? 'bg-slate-950 border-slate-800 shadow-2xl' : 'bg-white border-slate-200/90 shadow-sm'
      } ${
        isFullscreen ? 'flex-1 min-h-0' : 'h-[520px] sm:h-[600px] xl:h-[660px]'
      }`}>
        {/* LEFT PANE: WBS Data Grid (Collapsible to maximize Timeline Canvas) */}
        <div className={`${
          isLeftPaneCollapsed ? 'w-14 shrink-0' : 'w-full xl:w-[480px] shrink-0'
        } border-r flex flex-col transition-all duration-200 select-none ${
          isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
        }`}>
          {isLeftPaneCollapsed ? (
            <div className={`flex flex-col items-center py-4 h-full justify-between ${
              isDark ? 'bg-slate-950' : 'bg-slate-50'
            }`}>
              <div className="flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsLeftPaneCollapsed(false)}
                  className={`p-2 rounded-xl transition cursor-pointer border shadow-xs ${
                    isDark 
                      ? 'bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border-slate-800' 
                      : 'bg-white hover:bg-slate-100 text-amber-700 hover:text-amber-800 border-slate-200'
                  }`}
                  title="Expand WBS Task Grid"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
                <div className={`[writing-mode:vertical-rl] rotate-180 text-[10px] font-mono tracking-widest uppercase font-bold py-2 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Task Grid ({visibleTasks.length})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLeftPaneCollapsed(false)}
                className={`p-2 rounded-lg transition cursor-pointer ${
                  isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Open Task Details"
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Table Header: WBS, TASK, START, END, DUR, % */}
              <div className={`h-[60px] flex items-center px-3 text-[11px] font-mono font-bold uppercase tracking-wider ${
                isDark 
                  ? 'bg-slate-900 border-b border-slate-800 text-slate-400' 
                  : 'bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs'
              }`}>
                <button
                  type="button"
                  onClick={() => setIsLeftPaneCollapsed(true)}
                  className={`p-1 -ml-1 mr-1 rounded transition cursor-pointer ${
                    isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-700'
                  }`}
                  title="Collapse Task Grid (Maximize Timeline Canvas)"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
                <div className="w-12 text-center">WBS</div>
                <div className="flex-1 px-2 min-w-[140px] truncate">TASK</div>
                <div className="w-14 text-center">START</div>
                <div className="w-14 text-center">END</div>
                <div className="w-10 text-center">DUR</div>
                <div className="w-10 text-center">%</div>
                <div className="w-10 text-center">EDIT</div>
              </div>

          {/* Table Body (Synchronized Scroll) */}
          <div 
            ref={tableBodyRef}
            onScroll={handleTableScroll}
            className={`flex-1 overflow-y-auto overflow-x-hidden ${
              isDark ? 'divide-y divide-slate-900' : 'divide-y divide-slate-100'
            }`}
          >
            {visibleTasks.map((task, taskIndex) => {
              const isMilestone = task.type === 'milestone' || task.duration === 0;
              const isCritical = criticalTaskIds.has(task.id);
              const pct = Math.round(task.progress * 100);
              const depth = depthMap.get(task.id) || 0;
              const hasChildren = hasChildrenMap.get(task.id) || false;
              const isCollapsed = collapsedTaskIds.has(task.id);
              const hiddenCount = descendantCountMap.get(task.id) || 0;
              const isParentSummary = depth === 0;

              const rowBgClass = isDark
                ? (depth === 0 ? 'hover:bg-slate-900/80 bg-slate-950/40 border-t border-slate-900/80' : 'hover:bg-slate-900/50 bg-slate-950/80')
                : (isParentSummary
                    ? 'bg-amber-50/40 text-slate-800 font-bold hover:bg-amber-100/60 border-t border-amber-200/40'
                    : (taskIndex % 2 === 0 ? 'bg-white hover:bg-slate-100/70' : 'bg-slate-50/40 hover:bg-slate-100/70')
                  );

              return (
                <div
                  key={task.id}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  onDoubleClick={() => handleOpenEditModal(task)}
                  className={`flex items-center px-3 text-xs font-mono transition group cursor-pointer ${rowBgClass}`}
                >
                  <div className={`w-12 text-center truncate ${
                    isDark 
                      ? (depth === 0 ? 'font-bold text-amber-400/90 text-[11px]' : 'text-slate-400 text-[10px]')
                      : (depth === 0 ? 'font-bold text-amber-700 text-[11px]' : 'text-slate-500 text-[10px]')
                  }`}>
                    {task.wbsCode}
                  </div>

                  {/* Hierarchical Tree Item */}
                  <div 
                    className="flex-1 px-2 truncate flex items-center min-w-[140px]"
                    style={{ paddingLeft: `${depth * 16}px` }}
                  >
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskCollapse(task.id);
                        }}
                        className={`p-0.5 -ml-1 mr-1 rounded transition-colors flex items-center shrink-0 cursor-pointer ${
                          isDark 
                            ? 'hover:bg-slate-800 text-amber-400 hover:text-amber-300' 
                            : 'hover:bg-amber-100/80 text-amber-700 hover:text-amber-800'
                        }`}
                        title={isCollapsed ? `Expand ${hiddenCount} subtask(s)` : 'Collapse subtasks'}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                        )}
                      </button>
                    )}

                    {/* Left Table Critical Indicators & Milestone Diamond:
                        - Critical Tasks: Prepend small red dot indicator (`text-red-500 font-bold mr-1.5`)
                        - Milestone Rows: Prepend yellow milestone diamond icon `◆` (`text-amber-400 mr-1.5`)
                    */}
                    {isMilestone ? (
                      <span className="text-amber-400 font-bold mr-1.5 select-none shrink-0">◆</span>
                    ) : isCritical ? (
                      <span className="text-red-500 font-bold mr-1.5 select-none shrink-0">•</span>
                    ) : null}

                    <span 
                      className={`truncate ${
                        isDark
                          ? (isMilestone ? 'font-bold text-amber-300' : isCritical ? 'font-semibold text-slate-100' : 'text-slate-300 font-medium')
                          : (isMilestone ? 'font-bold text-amber-800' : isCritical ? 'font-bold text-slate-900' : 'text-slate-700 font-medium')
                      }`}
                      title={task.text}
                    >
                      {task.text}
                    </span>

                    {/* Collapsed Hidden Subtask Counter Badge */}
                    {isCollapsed && hiddenCount > 0 && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskCollapse(task.id);
                        }}
                        className={`ml-1.5 px-1 py-0.2 text-[9px] font-mono font-bold rounded shrink-0 transition cursor-pointer border ${
                          isDark 
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25' 
                            : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
                        }`}
                        title={`Click to expand ${hiddenCount} hidden subtasks`}
                      >
                        +{hiddenCount}
                      </span>
                    )}
                  </div>

                  <div className={`w-14 text-center text-[11px] truncate font-mono ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {formatDateMMDD(task.startDate)}
                  </div>
                  <div className={`w-14 text-center text-[11px] truncate font-mono ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {formatDateMMDD(isMilestone ? task.startDate : task.endDate)}
                  </div>
                  <div className={`w-10 text-center text-[11px] font-bold font-mono ${
                    isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}>
                    {isMilestone ? (
                      <span className="text-amber-400 font-bold select-none">◆</span>
                    ) : (
                      task.duration
                    )}
                  </div>
                  <div className={`w-10 text-center text-[11px] font-medium font-mono ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {pct}
                  </div>
                  <div className="w-10 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal(task); }}
                      className={`p-1 rounded transition cursor-pointer ${
                        isDark 
                          ? 'text-amber-400 hover:text-white hover:bg-slate-800' 
                          : 'text-amber-600 hover:text-amber-800 hover:bg-amber-100'
                      }`}
                      title="Edit Task Scope & Dates"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                      className={`p-1 rounded transition cursor-pointer ${
                        isDark 
                          ? 'text-slate-500 hover:text-rose-400 hover:bg-slate-800' 
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                      title="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANE: Interactive Timeline Grid */}
        <div
          ref={timelineScrollRef}
          onScroll={handleTimelineScroll}
          className={`flex-1 overflow-auto relative relative-timeline ${
            isDark ? 'bg-slate-950/90' : 'bg-white'
          }`}
        >
          <div style={{ width: `${timelineWidth}px`, height: `${totalGridHeight + 60}px` }} className="relative min-h-full">
            {/* Timeline Multi-Tier Header */}
            <div className={`sticky top-0 z-30 border-b ${
              isDark ? 'bg-slate-900 border-slate-800 shadow-md' : 'bg-slate-50 border-slate-200 shadow-2xs'
            }`}>
              {/* Tier 1: Month Groups */}
              <div className={`h-7 border-b relative text-xs font-mono font-bold ${
                isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'
              }`}>
                {monthHeaders.map((m, idx) => {
                  const isNarrow = m.widthPixel < 65;
                  return (
                    <div
                      key={idx}
                      style={{ left: `${m.leftPixel}px`, width: `${m.widthPixel}px` }}
                      className={`absolute top-0 bottom-0 flex items-center px-2 border-r truncate text-[11px] ${
                        isDark ? 'border-slate-800' : 'border-slate-200'
                      }`}
                      title={m.monthLabel}
                    >
                      {isNarrow ? m.shortLabel : m.monthLabel}
                    </div>
                  );
                })}
              </div>

              {/* Tier 2: Days Header */}
              <div className="h-8 flex text-[10px] font-mono">
                {daysList.map((d, idx) => (
                  <div
                    key={idx}
                    style={{ width: `${columnWidth}px` }}
                    className={`shrink-0 flex items-center justify-center border-r ${
                      isDark ? 'border-slate-800/80' : 'border-slate-200/70'
                    } ${
                      d.isSun ? (isDark ? 'bg-slate-950/70 text-slate-600 font-bold' : 'bg-slate-100/70 text-slate-400 font-bold') :
                      d.isWeatherSuspended ? (isDark ? 'bg-amber-500/10 text-amber-400 font-bold' : 'bg-amber-50 text-amber-700 font-bold') :
                      (isDark ? 'text-slate-400' : 'text-slate-500')
                    }`}
                  >
                    {columnWidth >= 32 ? (
                      <span>{d.date.getDate()}</span>
                    ) : (d.date.getDay() === 1) ? (
                      <span className="whitespace-nowrap overflow-visible text-[10px] font-medium">
                        {d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    ) : columnWidth >= 24 ? (
                      <span>{d.date.getDate()}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Background Grid Columns */}
            <div 
              style={{ height: `${totalGridHeight}px` }}
              className="absolute top-[60px] left-0 right-0 flex pointer-events-none z-0"
            >
              {daysList.map((d, idx) => (
                <div
                  key={idx}
                  style={{ width: `${columnWidth}px` }}
                  className={`shrink-0 h-full ${
                    isDark ? 'border-r border-slate-900/80' : 'border-r border-slate-200/70'
                  } ${
                    d.isSun ? (isDark ? 'bg-slate-950/40 opacity-70' : 'bg-slate-100/50') :
                    d.isWeatherSuspended ? (isDark ? 'bg-amber-500/5' : 'bg-amber-50/40') : ''
                  }`}
                />
              ))}
            </div>

            {/* Red "Today" Line Marker */}
            {todayPixel >= 0 && todayPixel <= timelineWidth && (
              <div
                style={{ left: `${todayPixel}px`, height: `${totalGridHeight + 60}px` }}
                className="absolute top-0 z-25 pointer-events-none w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
              >
                <div className="sticky top-[62px] -ml-6 bg-red-600 text-white font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-sm uppercase tracking-wider">
                  TODAY
                </div>
              </div>
            )}

            {/* SVG Dependency Connector Right-Angle Stepped Lines (Professional CPM Standard) */}
            <svg
              className="absolute top-[60px] left-0 pointer-events-none z-10"
              style={{ width: `${timelineWidth}px`, height: `${totalGridHeight}px` }}
            >
              <defs>
                <marker
                  id="cpm-arrow-critical"
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 1, 6 3.5, 0 6" fill="#ef4444" />
                </marker>
                <marker
                  id="cpm-arrow-standard"
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 1, 6 3.5, 0 6" fill="#64748b" />
                </marker>
              </defs>

              {dependencyConnections.map(({ predId, succId }) => {
                const predIndex = visibleTasks.findIndex(t => t.id === predId);
                const succIndex = visibleTasks.findIndex(t => t.id === succId);
                if (predIndex === -1 || succIndex === -1) return null;

                const predTask = visibleTasks[predIndex];
                const succTask = visibleTasks[succIndex];

                const predY = predIndex * ROW_HEIGHT + 28;
                const succY = succIndex * ROW_HEIGHT + 28;

                const isPredMilestone = predTask.type === 'milestone' || predTask.duration === 0;
                const isSuccMilestone = succTask.type === 'milestone' || succTask.duration === 0;

                const predMetrics = computeTaskBarMetrics(predTask.startDate, predTask.endDate, timelineStart, columnWidth);
                const succMetrics = computeTaskBarMetrics(succTask.startDate, succTask.endDate, timelineStart, columnWidth);

                const predX = isPredMilestone
                  ? predMetrics.left + 8
                  : predMetrics.left + predMetrics.width;

                const succX = isSuccMilestone
                  ? succMetrics.left - 8
                  : succMetrics.left;

                if (isNaN(predX) || isNaN(predY) || isNaN(succX) || isNaN(succY)) return null;

                // Predecessor exit -> 90° right-angle turn -> horizontal entry into successor start
                const isCriticalDep = criticalTaskIds.has(predId) && criticalTaskIds.has(succId);
                const strokeColor = isCriticalDep ? '#ef4444' : '#64748b';
                const markerId = isCriticalDep ? 'url(#cpm-arrow-critical)' : 'url(#cpm-arrow-standard)';

                const x1 = predX;
                const y1 = predY;
                const x2 = succX;
                const y2 = succY;
                const xMid = x1 + 12;

                let pathD = '';
                if (x2 >= xMid) {
                  // Standard orthogonal step: (x1, y1) -> (x1 + 12, y1) -> (x1 + 12, y2) -> (x2, y2)
                  pathD = `M ${x1} ${y1} H ${xMid} V ${y2} H ${x2}`;
                } else {
                  // Overlap/loopback right-angle step: (x1, y1) -> (x1 + 12, y1) -> (x1 + 12, midY) -> (x2 - 12, midY) -> (x2 - 12, y2) -> (x2, y2)
                  const midY = (y1 + y2) / 2;
                  pathD = `M ${x1} ${y1} H ${xMid} V ${midY} H ${x2 - 12} V ${y2} H ${x2}`;
                }

                return (
                  <path
                    key={`dep-${predId}-${succId}`}
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isCriticalDep ? 2 : 1.5}
                    markerEnd={markerId}
                    className="pointer-events-none transition-all duration-200"
                  />
                );
              })}
            </svg>

            {/* Timeline Task Rows & Double-Bars */}
            <div 
              style={{ height: `${totalGridHeight}px` }}
              className="absolute top-[60px] left-0 right-0 z-20 pointer-events-none"
            >
              {visibleTasks.map((task, rowIndex) => {
                const isMilestone = task.type === 'milestone' || task.duration === 0;
                const isCritical = criticalTaskIds.has(task.id);
                const taskFloat = taskFloatMap.get(task.id) ?? 0;
                const { left: barLeft, width: barWidth } = computeTaskBarMetrics(
                  task.startDate,
                  task.endDate,
                  timelineStart,
                  columnWidth
                );
                const pct = Math.round(task.progress * 100);

                // Baseline coordinates: original baseline schedule span (or current dates fallback)
                const hasBaseline = Boolean(task.baselineStart && task.baselineEnd);
                const { left: bLeft, width: bWidth } = computeTaskBarMetrics(
                  task.baselineStart || task.startDate,
                  task.baselineEnd || task.endDate,
                  timelineStart,
                  columnWidth
                );

                return (
                  <div
                    key={task.id}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className={`relative group pointer-events-none ${
                      isDark ? 'border-b border-slate-900/90' : 'border-b border-slate-100'
                    }`}
                  >
                    {/* Baseline Underline Track (Clearly visible 3px slate-400 track directly beneath each task bar) */}
                    <div
                      style={{ left: `${bLeft}px`, width: `${bWidth}px` }}
                      className="absolute top-[44px] h-[3px] bg-slate-400/80 rounded-full z-10 shadow-2xs pointer-events-none"
                      title={`Baseline: ${formatDateDisplay(task.baselineStart || task.startDate)} - ${formatDateDisplay(task.baselineEnd || task.endDate)}`}
                    />

                    {/* Actual / Forecasted Main Bar or Milestone Diamond */}
                    {isMilestone ? (
                      /* Solid Milestone Diamond (◆) with gold diamond marker (#eab308) */
                      <div
                        style={{ left: `${barLeft - 8}px` }}
                        onDoubleClick={() => handleOpenEditModal(task)}
                        onPointerDown={(e) => handlePointerDown(e, task.id, 'move')}
                        onMouseDown={(e) => handlePointerDown(e, task.id, 'move')}
                        className="absolute top-[18px] flex items-center gap-2 cursor-grab active:cursor-grabbing group/ms z-30 pointer-events-auto select-none"
                        title={`Milestone: ${task.text} (${formatDateShort(task.startDate)}) • 0d Duration (Drag to reschedule)`}
                      >
                        <div 
                          className="w-4 h-4 rotate-45 rounded-2xs transition-transform hover:scale-125 shrink-0 bg-[#eab308] border border-amber-200 shadow-md shadow-amber-500/40" 
                        />
                        <span className="text-xs font-medium whitespace-nowrap select-none text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                          {task.text}
                        </span>
                      </div>
                    ) : (
                      /* 2. Full-Width Two-Tone Duration Bars (Remove Fixed Pill Stubs)
                         - Spans full width calculated dynamically from calendar columns
                         - Height ~22px, rounded-sm
                         - Critical Path (0 Float):
                           - Completed portion: Solid Red (bg-red-600 / #dc2626) with bold white centered text
                           - Remaining uncompleted: Dark/Muted Red (bg-red-950/80 border border-red-700/60)
                         - Non-Critical (Float > 0):
                           - Completed portion: Solid Green (bg-emerald-600 / #16a34a) with bold white centered text
                           - Remaining uncompleted: Dark/Muted Green (bg-emerald-950/80 border border-emerald-700/60)
                      */
                      <>
                        <div
                          style={{ left: `${barLeft}px`, width: `${barWidth}px` }}
                          onDoubleClick={() => handleOpenEditModal(task)}
                          onPointerDown={(e) => handlePointerDown(e, task.id, 'move')}
                          onMouseDown={(e) => handlePointerDown(e, task.id, 'move')}
                          className={`absolute top-[17px] h-[22px] rounded-sm shadow-md overflow-hidden flex items-center transition-shadow select-none group/bar pointer-events-auto cursor-grab active:cursor-grabbing z-20 ${
                            isCritical
                              ? 'bg-red-950/80 border border-red-700/60 shadow-red-950/40'
                              : 'bg-emerald-950/80 border border-emerald-700/60 shadow-emerald-950/40'
                          } hover:ring-1 hover:ring-white/40`}
                          title={`${task.text}: ${pct}% complete • ${isCritical ? 'Critical Path (0 Float)' : `Non-Critical (Float: ${taskFloat}d)`}`}
                        >
                          {/* Completed progress portion */}
                          {pct > 0 && (
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, pct))}%`,
                                minWidth: '34px'
                              }}
                              className={`h-full flex items-center justify-center shrink-0 pointer-events-none select-none ${
                                isCritical ? 'bg-red-600' : 'bg-emerald-600'
                              }`}
                            >
                              <span className="font-mono font-bold text-[10px] sm:text-[11px] text-white px-1 whitespace-nowrap drop-shadow select-none">
                                {pct}%
                              </span>
                            </div>
                          )}

                          {/* 0% progress indicator */}
                          {pct === 0 && (
                            <div className={`h-full px-2 flex items-center justify-center shrink-0 pointer-events-none select-none ${
                              isCritical ? 'bg-red-600' : 'bg-emerald-600'
                            }`}>
                              <span className="font-mono font-bold text-[10px] text-white select-none">
                                0%
                              </span>
                            </div>
                          )}

                          {/* Left Edge Resize Handle */}
                          <div
                            onPointerDown={(e) => handlePointerDown(e, task.id, 'resize-left')}
                            onMouseDown={(e) => handlePointerDown(e, task.id, 'resize-left')}
                            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-30 pointer-events-auto hover:bg-white/60 bg-white/20 transition-all rounded-l-sm"
                            title="Drag left edge to adjust Start Date"
                          />

                          {/* Right Edge Resize Handle */}
                          <div
                            onPointerDown={(e) => handlePointerDown(e, task.id, 'resize-right')}
                            onMouseDown={(e) => handlePointerDown(e, task.id, 'resize-right')}
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-30 pointer-events-auto hover:bg-white/60 bg-white/20 transition-all rounded-r-sm"
                            title="Drag right edge to adjust End Date"
                          />
                        </div>

                        {/* White task title label immediately to the right of each bar (left + width + 8px) */}
                        <div
                          style={{ left: `${barLeft + barWidth + 8}px` }}
                          className="absolute top-[17px] h-[22px] flex items-center text-xs font-medium whitespace-nowrap pointer-events-none select-none text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] z-20"
                        >
                          {task.text}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quick-Edit & Dependency Modal */}
      {editingTask && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setEditingTask(null)}
        >
          <div 
            className={`border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden font-mono text-xs ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${
              isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2">
                <Edit3 className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Edit Task Scope & Dependencies</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className={`p-1 rounded-lg transition cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className={`block uppercase tracking-wider text-[10px] mb-1 font-bold ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Task Name & Scope
                </label>
                <input
                  type="text"
                  value={editFormData.text}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, text: e.target.value }))}
                  className={`w-full rounded-xl px-3 py-2 font-medium focus:border-amber-500 focus:outline-none border ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                  placeholder="e.g. Reinforced Footing Concreting"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block uppercase tracking-wider text-[10px] mb-1 font-bold ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.startDate}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      const s = parseDate(newStart);
                      const eDate = addWorkingDays(s, editFormData.duration);
                      setEditFormData(prev => ({
                        ...prev,
                        startDate: newStart,
                        endDate: formatDateISO(eDate)
                      }));
                    }}
                    className={`w-full rounded-xl px-3 py-2 font-medium focus:border-amber-500 focus:outline-none border ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block uppercase tracking-wider text-[10px] mb-1 font-bold ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.endDate}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      const dur = countWorkingDays(editFormData.startDate, newEnd);
                      setEditFormData(prev => ({
                        ...prev,
                        endDate: newEnd,
                        duration: Math.max(1, dur)
                      }));
                    }}
                    className={`w-full rounded-xl px-3 py-2 font-medium focus:border-amber-500 focus:outline-none border ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block uppercase tracking-wider text-[10px] mb-1 font-bold ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Duration (Working Days, Mon-Sat)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={editFormData.duration}
                    onChange={(e) => {
                      const dur = Math.max(0, parseInt(e.target.value, 10) || 0);
                      const s = parseDate(editFormData.startDate);
                      const eDate = dur === 0 ? s : addWorkingDays(s, dur);
                      setEditFormData(prev => ({
                        ...prev,
                        duration: dur,
                        endDate: formatDateISO(eDate),
                        type: dur === 0 ? 'milestone' : prev.type
                      }));
                    }}
                    className={`w-full rounded-xl px-3 py-2 font-medium focus:border-amber-500 focus:outline-none border ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block uppercase tracking-wider text-[10px] mb-1 font-bold ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Task Classification
                  </label>
                  <select
                    value={editFormData.type}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className={`w-full rounded-xl px-3 py-2 font-medium focus:border-amber-500 focus:outline-none cursor-pointer border ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="task">Standard Task</option>
                    <option value="project">Phase / Summary Bar</option>
                    <option value="milestone">Milestone (0 Days)</option>
                  </select>
                </div>
              </div>

              {/* Progress Slider + Numeric Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`uppercase tracking-wider text-[10px] font-bold ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Progress Completion (%)
                  </label>
                  <span className={`font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{editFormData.progress}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editFormData.progress}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, progress: parseInt(e.target.value, 10) }))}
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editFormData.progress}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, progress: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) }))}
                    className={`w-16 rounded-xl px-2 py-1 text-center font-bold border ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Contractor Assignment */}
              <div>
                <label className={`block uppercase tracking-wider text-[10px] mb-1 font-bold ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Assigned Contractor / Trade Crew
                </label>
                <select
                  value={editFormData.assignedContractorId}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, assignedContractorId: e.target.value }))}
                  className={`w-full rounded-xl px-3 py-2 font-medium focus:border-amber-500 focus:outline-none cursor-pointer border ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="">CTVill In-House Crew</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.company || c.specialty || 'Subcontractor'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Predecessors / Dependencies */}
              <div>
                <label className={`block uppercase tracking-wider text-[10px] mb-1 font-bold flex items-center justify-between ${
                  isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  <span>Predecessors (Finish-to-Start Dependencies)</span>
                  <span className={`${isDark ? 'text-slate-500' : 'text-slate-400'} font-normal`}>Successor starts after predecessor finishes</span>
                </label>
                <div className={`rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5 border ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  {tasks
                    .filter(t => {
                      if (t.id === editingTask.id) return false;
                      // Milestones should only link to parent tasks / milestones, not granular subtasks
                      if (editFormData.type === 'milestone' && t.parentTaskId) return false;
                      return true;
                    })
                    .map(t => {
                    const isChecked = editFormData.predecessorIds.includes(t.id);
                    return (
                      <label 
                        key={t.id} 
                        className={`flex items-center gap-2 p-1 rounded cursor-pointer transition ${
                          isDark ? 'hover:bg-slate-900 text-slate-300' : 'hover:bg-slate-200/60 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditFormData(prev => ({
                                ...prev,
                                predecessorIds: [...prev.predecessorIds, t.id]
                              }));
                            } else {
                              setEditFormData(prev => ({
                                ...prev,
                                predecessorIds: prev.predecessorIds.filter(id => id !== t.id)
                              }));
                            }
                          }}
                          className="accent-amber-500 rounded cursor-pointer"
                        />
                        <span className={`text-[11px] font-mono font-bold ${
                          isDark ? 'text-amber-400' : 'text-amber-700'
                        }`}>{t.wbsCode}</span>
                        <span className="text-xs truncate">{t.text}</span>
                        <span className={`text-[10px] ml-auto ${
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}>({formatDateShort(t.endDate)})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className={`px-5 py-4 border-t flex items-center justify-between gap-3 ${
              isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
            }`}>
              {isNewTaskDraft ? (
                <button
                  type="button"
                  onClick={() => { setEditingTask(null); setIsNewTaskDraft(false); }}
                  className={`px-3 py-2 font-medium rounded-xl text-xs border transition cursor-pointer ${
                    isDark 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700' 
                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300 shadow-2xs'
                  }`}
                >
                  Discard Draft
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeleteTask(editingTask.id)}
                  className={`px-3 py-2 font-bold rounded-xl text-xs border transition cursor-pointer flex items-center gap-1.5 ${
                    isDark 
                      ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-800' 
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 shadow-2xs'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Task</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setEditingTask(null); setIsNewTaskDraft(false); }}
                  className={`px-4 py-2 font-medium rounded-xl text-xs border transition cursor-pointer ${
                    isDark 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditModal}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
                >
                  {isNewTaskDraft ? 'Create & Add to Schedule' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
