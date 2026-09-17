/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Calendar, RefreshCw, ZoomIn, ZoomOut, Save, Plus,
  CheckCircle2, Layers, HardHat, AlertTriangle, Edit3, Trash2,
  X, ChevronRight, ChevronDown, Clock, ArrowRight, Link2,
  AlertCircle, ChevronLeft, CornerDownRight
} from 'lucide-react';
import { ProjectProfile, Contractor, DailySiteLog } from '../types';

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
}

type ZoomLevel = 'day' | 'week' | 'month';

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
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return new Date(dateStr);
  const cleanStr = String(dateStr).split('T')[0].split(' ')[0];
  const [year, month, day] = cleanStr.split('-').map(n => parseInt(n, 10));
  if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date();
  return new Date(year, month - 1, day, 0, 0, 0, 0);
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

// Add working days (Mon-Sat, skipping Sundays)
export function addWorkingDays(startDate: Date | string, durationDays: number): Date {
  const result = parseDate(startDate);
  if (durationDays <= 1) {
    if (isSunday(result)) result.setDate(result.getDate() + 1);
    return result;
  }

  let added = 1;
  while (added < durationDays) {
    result.setDate(result.getDate() + 1);
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
  if (end < start) return 0;

  let count = 0;
  const curr = new Date(start);
  while (curr <= end) {
    if (!isSunday(curr)) {
      count++;
    }
    curr.setDate(curr.getDate() + 1);
  }
  return count;
}

// Next working day strictly after a date (skipping Sundays)
export function getNextWorkingDay(date: Date | string): Date {
  const next = parseDate(date);
  next.setDate(next.getDate() + 1);
  while (isSunday(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// ==========================================
// 3. Cascading Auto-Scheduling Engine
// ==========================================

export function cascadeDownstreamSchedule(
  tasks: GanttTaskItem[],
  links: GanttLinkItem[],
  changedTaskId: string
): GanttTaskItem[] {
  const taskMap = new Map<string, GanttTaskItem>(tasks.map(t => [t.id, { ...t }]));
  const queue = [changedTaskId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentTask = taskMap.get(currentId);
    if (!currentTask) continue;

    // Find all successor task IDs
    const outgoingLinkTargets = links
      .filter(l => String(l.source) === currentId)
      .map(l => String(l.target));

    const explicitSuccessors = Array.from(taskMap.values())
      .filter(t => t.predecessorIds && t.predecessorIds.includes(currentId))
      .map(t => t.id);

    const allSuccessorIds = Array.from(new Set([...outgoingLinkTargets, ...explicitSuccessors]));

    for (const succId of allSuccessorIds) {
      const succTask = taskMap.get(succId);
      if (!succTask || succId === currentId) continue;

      const currentEnd = parseDate(currentTask.endDate);
      const succStart = parseDate(succTask.startDate);

      // Finish-to-Start rule: successor must start at earliest next working day after predecessor's end date
      const earliestSuccessorStart = getNextWorkingDay(currentEnd);

      if (succStart < earliestSuccessorStart) {
        const newStartStr = formatDateISO(earliestSuccessorStart);
        const newEnd = (succTask.type === 'milestone' || succTask.duration === 0)
          ? earliestSuccessorStart
          : addWorkingDays(earliestSuccessorStart, Math.max(1, succTask.duration));
        const newEndStr = formatDateISO(newEnd);

        taskMap.set(succId, {
          ...succTask,
          startDate: newStartStr,
          endDate: newEndStr
        });

        // Continue cascade downstream
        queue.push(succId);
      }
    }
  }

  return Array.from(taskMap.values());
}

// ==========================================
// 4. Main Component
// ==========================================

export default function GanttTimeline({
  projects = [],
  contractors = [],
  siteLogs = [],
  onUpdateProject
}: GanttTimelineProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return projects.length > 0 ? projects[0].id : '';
  });

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // Edit Modal State
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

  // Synchronized Scrolling References
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingSync = useRef<boolean>(false);

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
        const duration = t.duration !== undefined ? Number(t.duration) : countWorkingDays(sDate, eDate);

        return {
          id: String(t.id),
          projectId,
          wbsCode: t.wbsCode || `${idx + 1}.0`,
          text: t.text || t.title || 'Construction Task',
          startDate: formatDateISO(sDate),
          endDate: formatDateISO(eDate),
          duration: Math.max(0, duration),
          progress: typeof t.progress === 'number' ? Math.max(0, Math.min(1, t.progress)) : 0,
          baselineStart: t.baselineStart ? formatDateISO(parseDate(t.baselineStart)) : null,
          baselineEnd: t.baselineEnd ? formatDateISO(parseDate(t.baselineEnd)) : null,
          type: (duration === 0 || t.type === 'milestone') ? 'milestone' : (t.type || 'task'),
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

      setTasks(parsedTasks);
      setLinks(parsedLinks);
    } catch (err) {
      console.error('Failed to load project gantt data:', err);
      setSyncFeedback({ type: 'error', message: 'Failed to retrieve project timeline.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

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
  // 7. Timescale & Geometry Math
  // ==========================================

  const columnWidth = useMemo(() => {
    switch (zoomLevel) {
      case 'day': return 36;
      case 'week': return 22;
      case 'month': return 9;
    }
  }, [zoomLevel]);

  const ROW_HEIGHT = 54;

  // Determine timeline boundary dates
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return { timelineStart: start, timelineEnd: end, totalDays: diff };
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    tasks.forEach(t => {
      const s = parseDate(t.startDate).getTime();
      const e = parseDate(t.endDate).getTime();
      if (s < minTime) minTime = s;
      if (e > maxTime) maxTime = e;
      if (t.baselineStart) {
        const bs = parseDate(t.baselineStart).getTime();
        if (bs < minTime) minTime = bs;
      }
      if (t.baselineEnd) {
        const be = parseDate(t.baselineEnd).getTime();
        if (be > maxTime) maxTime = be;
      }
    });

    const start = new Date(minTime);
    start.setDate(start.getDate() - 7); // 7-day left padding
    start.setHours(0, 0, 0, 0);

    const end = new Date(maxTime);
    end.setDate(end.getDate() + 21); // 21-day right padding
    end.setHours(0, 0, 0, 0);

    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { timelineStart: start, timelineEnd: end, totalDays: Math.max(diff, 60) };
  }, [tasks]);

  const timelineWidth = Math.max(1200, totalDays * columnWidth);

  const dateToPixel = useCallback((date: Date | string): number => {
    const d = parseDate(date);
    const diffTime = d.getTime() - timelineStart.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays * columnWidth;
  }, [timelineStart, columnWidth]);

  const pixelToDate = useCallback((pixelX: number): Date => {
    const days = Math.round(pixelX / columnWidth);
    const result = new Date(timelineStart);
    result.setDate(result.getDate() + days);
    result.setHours(0, 0, 0, 0);
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
    const headers: { monthLabel: string; leftPixel: number; widthPixel: number }[] = [];
    let currentMonth = -1;
    let startIdx = 0;

    daysList.forEach((day, idx) => {
      const m = day.date.getMonth();
      if (m !== currentMonth) {
        if (currentMonth !== -1) {
          headers.push({
            monthLabel: daysList[startIdx].date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            leftPixel: startIdx * columnWidth,
            widthPixel: (idx - startIdx) * columnWidth
          });
        }
        currentMonth = m;
        startIdx = idx;
      }
    });

    if (startIdx < daysList.length) {
      headers.push({
        monthLabel: daysList[startIdx].date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
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
    e: React.PointerEvent,
    taskId: string,
    type: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.stopPropagation();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

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

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.active) return;

    const deltaX = e.clientX - dragState.initialPointerX;
    const deltaDays = Math.round(deltaX / columnWidth);
    if (deltaDays === 0) return;

    setTasks(prevTasks => {
      const taskIndex = prevTasks.findIndex(t => t.id === dragState.taskId);
      if (taskIndex === -1) return prevTasks;
      const targetTask = { ...prevTasks[taskIndex] };

      if (dragState.type === 'move') {
        const origStart = parseDate(dragState.initialStartDate);
        const newStart = new Date(origStart);
        newStart.setDate(newStart.getDate() + deltaDays);
        if (isSunday(newStart)) newStart.setDate(newStart.getDate() + 1);

        const newEnd = targetTask.type === 'milestone' || targetTask.duration === 0
          ? newStart
          : addWorkingDays(newStart, Math.max(1, targetTask.duration));

        targetTask.startDate = formatDateISO(newStart);
        targetTask.endDate = formatDateISO(newEnd);
      } else if (dragState.type === 'resize-left') {
        const origStart = parseDate(dragState.initialStartDate);
        const fixedEnd = parseDate(dragState.initialEndDate);
        const newStart = new Date(origStart);
        newStart.setDate(newStart.getDate() + deltaDays);

        if (newStart <= fixedEnd) {
          const newDur = countWorkingDays(newStart, fixedEnd);
          targetTask.startDate = formatDateISO(newStart);
          targetTask.duration = Math.max(1, newDur);
        }
      } else if (dragState.type === 'resize-right') {
        const fixedStart = parseDate(dragState.initialStartDate);
        const origEnd = parseDate(dragState.initialEndDate);
        const newEnd = new Date(origEnd);
        newEnd.setDate(newEnd.getDate() + deltaDays);

        if (newEnd >= fixedStart) {
          const newDur = countWorkingDays(fixedStart, newEnd);
          targetTask.endDate = formatDateISO(newEnd);
          targetTask.duration = Math.max(1, newDur);
        }
      }

      const updatedList = [...prevTasks];
      updatedList[taskIndex] = targetTask;

      // Ripple cascading auto-schedule downstream
      return cascadeDownstreamSchedule(updatedList, links, targetTask.id);
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState.active) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const updatedTask = tasks.find(t => t.id === dragState.taskId);
    if (updatedTask) {
      queueDebouncedSync('update', updatedTask);
    }

    setDragState(prev => ({ ...prev, active: false }));
  };

  // ==========================================
  // 9. Quick Edit Modal Handlers
  // ==========================================

  const handleOpenEditModal = (task: GanttTaskItem) => {
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
    const dur = Math.max(0, Number(editFormData.duration));
    const eDate = dur === 0 || editFormData.type === 'milestone' 
      ? sDate 
      : addWorkingDays(sDate, dur);

    const updatedTask: GanttTaskItem = {
      ...editingTask,
      text: editFormData.text,
      startDate: formatDateISO(sDate),
      endDate: formatDateISO(eDate),
      duration: dur,
      progress: progressVal,
      type: dur === 0 ? 'milestone' : editFormData.type,
      assignedContractorId: editFormData.assignedContractorId || null,
      contractorName: contractor?.name || editingTask.contractorName,
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

    // Update tasks state and cascade
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === updatedTask.id);
      const copy = [...prev];
      copy[idx] = updatedTask;
      const scheduled = cascadeDownstreamSchedule(copy, updatedLinks, updatedTask.id);
      const newProg = computeProjectProgress(scheduled);
      onUpdateProject?.(selectedProjectId, {
        progressPercentage: newProg,
        tasksCount: scheduled.length
      });
      return scheduled;
    });

    syncBackend('update', updatedTask);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!window.confirm(`Are you sure you want to delete "${task.text}"? Connected dependency lines will be unlinked.`)) {
      return;
    }

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

    syncBackend('delete', { id: taskId });
    if (editingTask && editingTask.id === taskId) {
      setEditingTask(null);
    }
  };

  const handleAddSubtask = (parentTask: GanttTaskItem) => {
    const parentStart = parseDate(parentTask.startDate);
    const newId = `task-${Date.now()}`;
    const newStart = parentStart;
    const newEnd = addWorkingDays(newStart, 3);

    const newSubtask: GanttTaskItem = {
      id: newId,
      projectId: selectedProjectId,
      wbsCode: `${parentTask.wbsCode}.${tasks.filter(t => t.parentTaskId === parentTask.id).length + 1}`,
      text: `Subtask of ${parentTask.text}`,
      startDate: formatDateISO(newStart),
      endDate: formatDateISO(newEnd),
      duration: 3,
      progress: 0,
      type: 'task',
      parentTaskId: parentTask.id,
      sortOrder: tasks.length + 1,
      assignedContractorId: parentTask.assignedContractorId,
      contractorName: parentTask.contractorName,
      predecessorIds: [parentTask.id]
    };

    const newLink: GanttLinkItem = {
      id: `link-${parentTask.id}-${newId}`,
      source: parentTask.id,
      target: newId,
      type: '0',
      lag: 0
    };

    setLinks(prev => [...prev, newLink]);
    setTasks(prev => {
      const next = [...prev, newSubtask];
      const newProg = computeProjectProgress(next);
      onUpdateProject?.(selectedProjectId, {
        progressPercentage: newProg,
        tasksCount: next.length
      });
      return next;
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

    const newTask: GanttTaskItem = {
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

    setTasks(prev => {
      const next = [...prev, newTask];
      const newProg = computeProjectProgress(next);
      onUpdateProject?.(selectedProjectId, {
        progressPercentage: newProg,
        tasksCount: next.length
      });
      return next;
    });
    syncBackend('create', newTask);
    handleOpenEditModal(newTask);
  };

  const handleAddNewMilestone = () => {
    if (!selectedProjectId) return;
    const now = new Date();
    if (isSunday(now)) now.setDate(now.getDate() + 1);
    const newId = `milestone-${Date.now()}`;
    const dateStr = formatDateISO(now);

    const newMilestone: GanttTaskItem = {
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

    setTasks(prev => {
      const next = [...prev, newMilestone];
      const newProg = computeProjectProgress(next);
      onUpdateProject?.(selectedProjectId, {
        progressPercentage: newProg,
        tasksCount: next.length
      });
      return next;
    });
    syncBackend('create', newMilestone);
    handleOpenEditModal(newMilestone);
  };

  // Quick Metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.progress >= 1).length;
    const milestones = tasks.filter(t => t.type === 'milestone' || t.duration === 0).length;
    return { total, completed, milestones };
  }, [tasks]);

  return (
    <div className="space-y-4 select-none">
      {/* 1. Header Toolbar */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold tracking-wider uppercase">
                Enterprise Gantt Scheduling Engine
              </span>
              <span className="text-xs text-slate-400 font-mono">React 19 Direct Manipulation • 6-Day Workweek</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Layers className="w-6 h-6 text-amber-400" />
              Construction CPM Scheduling & Task Management
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Drag bars to reschedule, drag edges to adjust duration, or double-click to configure predecessors and dependencies.
            </p>
          </div>

          {/* Metrics summary */}
          <div className="flex items-center gap-4 text-xs font-mono bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Total Items</span>
              <span className="font-bold text-white text-sm">{metrics.total}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Completed</span>
              <span className="font-bold text-emerald-400 text-sm">{metrics.completed}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Milestones</span>
              <span className="font-bold text-amber-400 text-sm">{metrics.milestones}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Physical Progress</span>
              <span className="font-bold text-amber-400 text-sm">{currentProjectProgress}%</span>
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Project Switcher */}
            {projects.length > 0 ? (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                aria-label="Select Commercial Project"
                className="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.id === selectedProjectId ? currentProjectProgress : (p.progressPercentage || 0)}% Complete)
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                No Commercial Sites Registered
              </span>
            )}

            {/* Active Project Physical Progress Bar Indicator */}
            {activeProject && (
              <div className="flex items-center gap-3 bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
                    <span className="text-slate-400 font-semibold">Overall Project Progress:</span>
                    <span className="text-amber-400 font-bold">{currentProjectProgress}%</span>
                  </div>
                  <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5 border border-slate-700/50">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, currentProjectProgress))}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Timescale Zoom */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
              <span className="text-[10px] text-slate-500 font-mono uppercase px-2">Zoom:</span>
              {(['day', 'week', 'month'] as ZoomLevel[]).map(z => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomLevel(z)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-mono font-semibold transition cursor-pointer capitalize ${
                    zoomLevel === z ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>

            {/* Add Task / Milestone Buttons */}
            <button
              type="button"
              disabled={!selectedProjectId}
              onClick={handleAddNewTask}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-xl text-xs transition shadow-md ${
                !selectedProjectId
                  ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-amber-500/20'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
            <button
              type="button"
              disabled={!selectedProjectId}
              onClick={handleAddNewMilestone}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                !selectedProjectId
                  ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border-slate-800'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700 cursor-pointer'
              }`}
            >
              <span>◆</span>
              <span>Add Milestone</span>
            </button>
          </div>

          {/* Sync status & Refresh */}
          <div className="flex items-center gap-2">
            {isSyncing && (
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Auto-syncing to DB...</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => loadGanttData(selectedProjectId)}
              disabled={isLoading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs border border-slate-700 transition cursor-pointer"
              title="Reload from Server"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {syncFeedback && (
          <div className={`mt-3 p-3 rounded-xl border text-xs font-mono flex items-center gap-2 animate-fadeIn ${
            syncFeedback.type === 'success' 
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300' 
              : 'bg-rose-950/80 border-rose-700 text-rose-300'
          }`}>
            {syncFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{syncFeedback.message}</span>
          </div>
        )}
      </div>

      {/* 2. Visual Legend & Operation Tips */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-4 text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-sm bg-slate-500 inline-block border border-slate-400" />
            <span>Top Thin Bar: Baseline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-600 inline-block border border-indigo-400" />
            <span>Bottom Bar: Actual Schedule (Drag / Resize)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600 inline-block border border-emerald-400" />
            <span>Completed (100%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rotate-45 bg-amber-400 inline-block border border-amber-300" />
            <span>Milestone Diamond</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-400 inline-block" />
            <span>Valid Dependency Link</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-500 inline-block" />
            <span>Collision / Schedule Breach</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500/30 border border-rose-500/60 inline-block" />
            <span>Red Today Line</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Double-click any task bar or click ✏️ to edit dates & dependencies.
        </div>
      </div>

      {/* 3. Dual-Pane Synchronized Gantt Canvas */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col xl:flex-row h-[660px]">
        {/* LEFT PANE: WBS Data Grid */}
        <div className="w-full xl:w-[480px] shrink-0 border-r border-slate-800 flex flex-col bg-slate-950">
          {/* Table Header */}
          <div className="h-[60px] bg-slate-900 border-b border-slate-800 flex items-center px-3 text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
            <div className="w-12 text-center">WBS</div>
            <div className="w-[170px] px-2 truncate">Task Name</div>
            <div className="w-16 text-center">Start</div>
            <div className="w-16 text-center">End</div>
            <div className="w-12 text-center">Days</div>
            <div className="w-14 text-center">Progress</div>
            <div className="w-20 text-center">Actions</div>
          </div>

          {/* Table Body (Synchronized Scroll) */}
          <div 
            ref={tableBodyRef}
            onScroll={handleTableScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-slate-900"
          >
            {tasks.map((task) => {
              const isMilestone = task.type === 'milestone' || task.duration === 0;
              const pct = Math.round(task.progress * 100);

              return (
                <div
                  key={task.id}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  onDoubleClick={() => handleOpenEditModal(task)}
                  className="flex items-center px-3 text-xs font-mono hover:bg-slate-900/60 transition group cursor-pointer"
                >
                  <div className="w-12 text-center font-bold text-amber-400/90 truncate">
                    {task.wbsCode}
                  </div>
                  <div className="w-[170px] px-2 truncate">
                    <span 
                      className={`${isMilestone ? 'font-bold text-amber-300' : 'text-slate-200 font-medium'} truncate block`}
                      title={task.text}
                    >
                      {task.parentTaskId && <span className="text-slate-600 mr-1">↳</span>}
                      {task.text}
                    </span>
                  </div>
                  <div className="w-16 text-center text-[11px] text-slate-400 truncate">
                    {formatDateShort(task.startDate)}
                  </div>
                  <div className="w-16 text-center text-[11px] text-slate-400 truncate">
                    {formatDateShort(task.endDate)}
                  </div>
                  <div className="w-12 text-center text-[11px] font-bold text-slate-300">
                    {task.duration}d
                  </div>
                  <div className="w-14 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      pct >= 100 ? 'text-emerald-400 bg-emerald-950/60 border-emerald-700' :
                      pct > 0 ? 'text-indigo-400 bg-indigo-950/60 border-indigo-700' :
                      'text-slate-400 bg-slate-800 border-slate-700'
                    }`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="w-20 flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleAddSubtask(task); }}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-slate-800 hover:border-indigo-500/50 transition cursor-pointer"
                      title="Add Subtask"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal(task); }}
                      className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer"
                      title="Edit Task Details"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                      className="p-1 rounded bg-slate-900 hover:bg-rose-950 text-rose-400 border border-slate-800 hover:border-rose-500/50 transition cursor-pointer"
                      title="Delete Task"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANE: Interactive Timeline Grid */}
        <div
          ref={timelineScrollRef}
          onScroll={handleTimelineScroll}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex-1 overflow-auto bg-slate-950/90 relative relative-timeline"
        >
          <div style={{ width: `${timelineWidth}px` }} className="relative min-h-full">
            {/* Timeline Multi-Tier Header */}
            <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md">
              {/* Tier 1: Month Groups */}
              <div className="h-7 border-b border-slate-800 relative text-xs font-mono font-bold text-slate-300">
                {monthHeaders.map((m, idx) => (
                  <div
                    key={idx}
                    style={{ left: `${m.leftPixel}px`, width: `${m.widthPixel}px` }}
                    className="absolute top-0 bottom-0 flex items-center px-3 border-r border-slate-800 truncate"
                  >
                    {m.monthLabel}
                  </div>
                ))}
              </div>

              {/* Tier 2: Days Header */}
              <div className="h-8 flex text-[10px] font-mono">
                {daysList.map((d, idx) => (
                  <div
                    key={idx}
                    style={{ width: `${columnWidth}px` }}
                    className={`shrink-0 flex items-center justify-center border-r border-slate-800/80 ${
                      d.isSun ? 'bg-slate-950/70 text-slate-600 font-bold' :
                      d.isWeatherSuspended ? 'bg-amber-500/10 text-amber-400 font-bold' :
                      'text-slate-400'
                    }`}
                  >
                    {zoomLevel === 'day' ? (
                      <span>{d.date.getDate()}</span>
                    ) : zoomLevel === 'week' ? (
                      <span>{idx % 7 === 0 ? `Wk${Math.ceil((idx + 1) / 7)}` : ''}</span>
                    ) : (
                      <span>{idx % 30 === 0 ? d.date.getMonth() + 1 : ''}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Background Grid Columns */}
            <div className="absolute top-[60px] bottom-0 left-0 right-0 flex pointer-events-none z-0">
              {daysList.map((d, idx) => (
                <div
                  key={idx}
                  style={{ width: `${columnWidth}px` }}
                  className={`shrink-0 h-full border-r border-slate-900/80 ${
                    d.isSun ? 'bg-slate-950/40 opacity-70' :
                    d.isWeatherSuspended ? 'bg-amber-500/5' : ''
                  }`}
                />
              ))}
            </div>

            {/* Red "Today" Line Marker */}
            {todayPixel >= 0 && todayPixel <= timelineWidth && (
              <div
                style={{ left: `${todayPixel}px` }}
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-25 pointer-events-none shadow-[0_0_10px_#ef4444]"
              >
                <div className="sticky top-[62px] -ml-6 bg-rose-500 text-white font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-lg uppercase tracking-wider">
                  TODAY
                </div>
              </div>
            )}

            {/* SVG Dependency Connector Curves */}
            <svg
              className="absolute top-[60px] left-0 pointer-events-none z-10"
              style={{ width: `${timelineWidth}px`, height: `${tasks.length * ROW_HEIGHT}px` }}
            >
              <defs>
                <marker
                  id="arrow-normal"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 1, 8 4, 0 7" fill="#f59e0b" />
                </marker>
                <marker
                  id="arrow-breached"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 1, 8 4, 0 7" fill="#ef4444" />
                </marker>
              </defs>

              {tasks.flatMap((task, succIndex) => {
                const succY = succIndex * ROW_HEIGHT + 30;
                const succX = dateToPixel(task.startDate);

                return (task.predecessorIds || []).map(predId => {
                  const predIndex = tasks.findIndex(t => t.id === predId);
                  if (predIndex === -1) return null;
                  const predTask = tasks[predIndex];

                  const predY = predIndex * ROW_HEIGHT + 30;
                  const predX = (predTask.type === 'milestone' || predTask.duration === 0)
                    ? dateToPixel(predTask.startDate) + 12
                    : dateToPixel(predTask.endDate);

                  // Conflict detection: Upstream predecessor's end date breaches/collides with successor's start date
                  const isBreached = parseDate(predTask.endDate) >= parseDate(task.startDate);
                  const strokeColor = isBreached ? '#ef4444' : '#f59e0b';
                  const markerId = isBreached ? 'url(#arrow-breached)' : 'url(#arrow-normal)';

                  let pathD = '';
                  if (succX >= predX + 16) {
                    // Standard smooth forward curve
                    pathD = `M ${predX} ${predY} C ${predX + 24} ${predY}, ${succX - 24} ${succY}, ${succX} ${succY}`;
                  } else {
                    // Looped backward curve for schedule collisions
                    pathD = `M ${predX} ${predY} H ${predX + 12} V ${(predY + succY) / 2} H ${succX - 16} V ${succY} H ${succX}`;
                  }

                  return (
                    <path
                      key={`${predId}-${task.id}`}
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isBreached ? 2.5 : 1.75}
                      strokeDasharray={isBreached ? '4 2' : undefined}
                      markerEnd={markerId}
                      className="transition-all duration-200"
                    />
                  );
                });
              })}
            </svg>

            {/* Timeline Task Rows & Double-Bars */}
            <div className="absolute top-[60px] left-0 right-0 z-20">
              {tasks.map((task, rowIndex) => {
                const isMilestone = task.type === 'milestone' || task.duration === 0;
                const startX = dateToPixel(task.startDate);
                const endX = dateToPixel(task.endDate);
                const barWidth = Math.max(columnWidth * 0.75, endX - startX);
                const pct = Math.round(task.progress * 100);

                // Baseline coordinates
                const hasBaseline = Boolean(task.baselineStart && task.baselineEnd);
                const bStartX = hasBaseline ? dateToPixel(task.baselineStart!) : 0;
                const bEndX = hasBaseline ? dateToPixel(task.baselineEnd!) : 0;
                const bWidth = Math.max(10, bEndX - bStartX);

                return (
                  <div
                    key={task.id}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className="relative border-b border-slate-900/90 group"
                  >
                    {/* Baseline Thin Bar (Contract Target Schedule) */}
                    {hasBaseline && (
                      <div
                        style={{ left: `${bStartX}px`, width: `${bWidth}px` }}
                        className="absolute top-2 h-1.5 rounded-sm bg-slate-500/70 border border-slate-400/50 shadow-sm"
                        title={`Contract Baseline: ${formatDateDisplay(task.baselineStart)} - ${formatDateDisplay(task.baselineEnd)}`}
                      />
                    )}

                    {/* Actual / Forecasted Main Bar or Milestone Diamond */}
                    {isMilestone ? (
                      /* Solid Milestone Diamond (◆) */
                      <div
                        style={{ left: `${startX - 10}px` }}
                        onDoubleClick={() => handleOpenEditModal(task)}
                        className="absolute top-[20px] flex items-center gap-2 cursor-pointer group/ms"
                      >
                        <div className="w-5 h-5 rotate-45 bg-amber-400 border-2 border-amber-200 rounded-xs shadow-lg shadow-amber-500/40 hover:scale-125 transition-transform" />
                        <span className="text-[11px] font-mono font-bold text-amber-400 whitespace-nowrap drop-shadow">
                          {task.text} ({formatDateShort(task.startDate)})
                        </span>
                      </div>
                    ) : (
                      /* Actual Schedule Bar with Left/Right Resize Handles */
                      <div
                        style={{ left: `${startX}px`, width: `${barWidth}px` }}
                        onDoubleClick={() => handleOpenEditModal(task)}
                        className={`absolute top-[17px] h-[26px] rounded-lg shadow-md flex items-center justify-between transition-shadow select-none group/bar ${
                          pct >= 100
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 border border-emerald-400/50'
                            : task.type === 'project'
                            ? 'bg-gradient-to-r from-slate-700 to-slate-800 border border-slate-500/50'
                            : 'bg-gradient-to-r from-indigo-600 to-indigo-700 border border-indigo-400/50'
                        } hover:shadow-indigo-500/30 hover:ring-1 hover:ring-white/40 cursor-grab active:cursor-grabbing`}
                        onPointerDown={(e) => handlePointerDown(e, task.id, 'move')}
                      >
                        {/* Left Edge Resize Handle */}
                        <div
                          onPointerDown={(e) => handlePointerDown(e, task.id, 'resize-left')}
                          className="absolute left-0 top-0 bottom-0 w-2.5 bg-white/20 hover:bg-white/60 cursor-ew-resize rounded-l-lg z-10 transition opacity-0 group-hover/bar:opacity-100"
                          title="Drag to adjust Start Date"
                        />

                        {/* Inner Progress Fill */}
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-white/20 rounded-l-lg pointer-events-none transition-all"
                        />

                        {/* Text Inside Bar */}
                        <div className="absolute inset-0 px-2 flex items-center justify-between text-[11px] font-mono font-bold text-white pointer-events-none truncate drop-shadow">
                          <span className="truncate max-w-[80%]">{task.text}</span>
                          <span className="text-[10px] opacity-90">{pct}%</span>
                        </div>

                        {/* Right Edge Resize Handle */}
                        <div
                          onPointerDown={(e) => handlePointerDown(e, task.id, 'resize-right')}
                          className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/20 hover:bg-white/60 cursor-ew-resize rounded-r-lg z-10 transition opacity-0 group-hover/bar:opacity-100"
                          title="Drag to adjust End Date"
                        />
                      </div>
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
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden font-mono text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white text-sm">Edit Task Scope & Dependencies</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider text-[10px] mb-1 font-bold">
                  Task Name & Scope
                </label>
                <input
                  type="text"
                  value={editFormData.text}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. Reinforced Footing Concreting"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px] mb-1 font-bold">
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px] mb-1 font-bold">
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px] mb-1 font-bold">
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 uppercase tracking-wider text-[10px] mb-1 font-bold">
                    Task Classification
                  </label>
                  <select
                    value={editFormData.type}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none cursor-pointer"
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
                  <label className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                    Progress Completion (%)
                  </label>
                  <span className="font-bold text-amber-400">{editFormData.progress}%</span>
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
                    className="w-16 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1 text-center text-white font-bold"
                  />
                </div>
              </div>

              {/* Contractor Assignment */}
              <div>
                <label className="block text-slate-400 uppercase tracking-wider text-[10px] mb-1 font-bold">
                  Assigned Contractor / Trade Crew
                </label>
                <select
                  value={editFormData.assignedContractorId}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, assignedContractorId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none cursor-pointer"
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
                <label className="block text-slate-400 uppercase tracking-wider text-[10px] mb-1 font-bold flex items-center justify-between">
                  <span>Predecessors (Finish-to-Start Dependencies)</span>
                  <span className="text-slate-500 font-normal">Successor starts after predecessor finishes</span>
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5">
                  {tasks.filter(t => t.id !== editingTask.id).map(t => {
                    const isChecked = editFormData.predecessorIds.includes(t.id);
                    return (
                      <label 
                        key={t.id} 
                        className="flex items-center gap-2 p-1 rounded hover:bg-slate-900 cursor-pointer transition text-slate-300"
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
                        <span className="text-[11px] font-mono text-amber-400 font-bold">{t.wbsCode}</span>
                        <span className="text-xs truncate">{t.text}</span>
                        <span className="text-[10px] text-slate-500 ml-auto">({formatDateShort(t.endDate)})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDeleteTask(editingTask.id)}
                className="px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-bold rounded-xl text-xs border border-rose-800 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Task</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditModal}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
