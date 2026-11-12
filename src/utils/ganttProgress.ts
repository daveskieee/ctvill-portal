/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const STANDARD_CONSTRUCTION_PHASES: string[] = [
  'Earthworks',
  'Concreting Works',
  'Reinforcing Bar',
  'Formworks',
  'Masonry Works',
  'Roof Works',
  'Finishing & Tiling Works',
  'Ceiling Works',
  'Finishing Carpentry',
  'Doors and Windows',
  'Cabinet Works',
  'Painting Works',
  'Electrical Works',
  'Plumbing Works',
];

export const DEFAULT_PHASE_WEIGHTS: Record<string, number> = {
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
  'Plumbing Works': 4,
};

export const GANTT_TASKS_STORAGE_PREFIX = 'ctvill_gantt_tasks_';
export const GANTT_TASKS_UPDATED_EVENT = 'ctvill-gantt-tasks-updated';
export const GANTT_SELECT_PROJECT_EVENT = 'ctvill-gantt-select-project';

export interface UnifiedGanttTaskLike {
  id: string;
  projectId?: string;
  wbsCode?: string;
  text?: string;
  title?: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  dueDate?: string | Date | null;
  duration?: number;
  progress?: number;
  weight?: number;
  status?: string;
  type?: string;
  parentTaskId?: string | null;
  constructionPhase?: string;
  milestonePhase?: string;
}

const PHASE_KEYWORD_RULES: Array<{ phase: string; keywords: string[] }> = [
  { phase: 'Concreting Works', keywords: ['concret', 'pouring', 'slab', 'footing', 'beam', 'column'] },
  { phase: 'Reinforcing Bar', keywords: ['rebar', 'reinforc', 'steel bar', 'deformed bar', 'stirrup'] },
  { phase: 'Formworks', keywords: ['formwork', 'shoring', 'scaffold', 'phenolic'] },
  { phase: 'Masonry Works', keywords: ['masonry', 'chb', 'hollow block', 'plaster', 'skim coat'] },
  { phase: 'Roof Works', keywords: ['roof', 'truss', 'gutter', 'flashing', 'waterproof'] },
  { phase: 'Finishing & Tiling Works', keywords: ['tiling', 'tile', 'floor finish', 'grout'] },
  { phase: 'Ceiling Works', keywords: ['ceiling', 'gypsum', 'furring', 'acoustic'] },
  { phase: 'Finishing Carpentry', keywords: ['carpentry', 'woodwork', 'partition', 'trim'] },
  { phase: 'Doors and Windows', keywords: ['door', 'window', 'glazing', 'glass', 'jamb'] },
  { phase: 'Cabinet Works', keywords: ['cabinet', 'millwork', 'casework', 'joinery'] },
  { phase: 'Painting Works', keywords: ['paint', 'primer', 'coating', 'varnish', 'putty'] },
  { phase: 'Electrical Works', keywords: ['electric', 'wiring', 'conduit', 'panel', 'lighting', 'mep'] },
  { phase: 'Plumbing Works', keywords: ['plumb', 'sanitary', 'waterline', 'drainage', 'pipe'] },
  { phase: 'Earthworks', keywords: ['earthwork', 'excavat', 'grubbing', 'clearing', 'grading', 'backfill', 'compaction', 'mobilization'] },
];

export function resolveTaskConstructionPhase(task: Partial<UnifiedGanttTaskLike>): string {
  const direct = String(task.constructionPhase || '').trim();
  if (direct) {
    const exactMatch = STANDARD_CONSTRUCTION_PHASES.find(
      p => p.toLowerCase() === direct.toLowerCase()
    );
    return exactMatch || direct;
  }

  const milestone = String(task.milestonePhase || '').trim();
  if (milestone) {
    const phaseMatch = STANDARD_CONSTRUCTION_PHASES.find(
      p => p.toLowerCase() === milestone.toLowerCase()
    );
    if (phaseMatch) return phaseMatch;
  }

  const label = `${task.text || ''} ${task.title || ''} ${milestone}`.toLowerCase();
  for (const phase of STANDARD_CONSTRUCTION_PHASES) {
    if (label.includes(phase.toLowerCase())) {
      return phase;
    }
  }
  for (const rule of PHASE_KEYWORD_RULES) {
    if (rule.keywords.some(kw => label.includes(kw))) {
      return rule.phase;
    }
  }

  return STANDARD_CONSTRUCTION_PHASES[0]; // Default to 'Earthworks'
}

export function parseGanttDateAtNoon(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    if (isNaN(dateStr.getTime())) return null;
    const d = new Date(dateStr);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const cleanStr = String(dateStr).trim().split('T')[0].split(' ')[0];
  if (!cleanStr) return null;

  const ymd = cleanStr.split('-').map(n => parseInt(n, 10));
  if (ymd.length === 3 && !isNaN(ymd[0]) && !isNaN(ymd[1]) && !isNaN(ymd[2])) {
    if (ymd[0] > 999) return new Date(ymd[0], ymd[1] - 1, ymd[2], 12, 0, 0, 0);
    if (ymd[2] > 999) return new Date(ymd[2], ymd[0] - 1, ymd[1], 12, 0, 0, 0);
  }

  const nativeParsed = new Date(cleanStr);
  if (!isNaN(nativeParsed.getTime())) {
    nativeParsed.setHours(12, 0, 0, 0);
    return nativeParsed;
  }
  return null;
}

export function normalizeTaskProgressFraction(task: Partial<UnifiedGanttTaskLike>): number {
  if (typeof task.progress === 'number' && !isNaN(task.progress)) {
    return task.progress > 1
      ? Math.max(0, Math.min(1, task.progress / 100))
      : Math.max(0, Math.min(1, task.progress));
  }
  if (task.status === 'COMPLETED') return 1;
  return 0;
}

export function getLeafGanttTasks<T extends UnifiedGanttTaskLike>(taskList: T[]): T[] {
  if (!taskList || taskList.length === 0) return [];
  const parentIds = new Set(
    taskList.map(t => t.parentTaskId).filter((id): id is string => Boolean(id))
  );
  const leafTasks = taskList.filter(t => !parentIds.has(t.id));
  return leafTasks.length > 0 ? leafTasks : taskList;
}

function resolveTaskWeight(
  task: UnifiedGanttTaskLike,
  hasExplicitWeights: boolean
): number {
  if (hasExplicitWeights) {
    return Math.max(1, Number(task.weight ?? task.duration ?? 10));
  }
  return Math.max(1, Number(task.duration ?? 1));
}

export function computeUnifiedProjectProgress(taskList: UnifiedGanttTaskLike[]): number {
  if (!taskList || taskList.length === 0) return 0;
  const targetList = getLeafGanttTasks(taskList);
  const hasExplicitWeights = targetList.some(t => typeof t.weight === 'number' && t.weight > 0);

  let totalWeight = 0;
  let weightedSum = 0;
  for (const t of targetList) {
    const w = resolveTaskWeight(t, hasExplicitWeights);
    totalWeight += w;
    weightedSum += normalizeTaskProgressFraction(t) * w;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

export function computeTaskPlannedPct(
  task: UnifiedGanttTaskLike,
  referenceDate: Date = new Date()
): number {
  const today = new Date(referenceDate);
  today.setHours(12, 0, 0, 0);

  const start = parseGanttDateAtNoon(task.startDate);
  const end = parseGanttDateAtNoon(task.endDate || task.dueDate);

  if (!start && !end) return 0;
  if (start && today.getTime() < start.getTime()) return 0;
  if (end && today.getTime() >= end.getTime()) return 100;
  if (!start || !end || end.getTime() <= start.getTime()) return 0;

  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = today.getTime() - start.getTime();
  return Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
}

export function computeUnifiedProjectPlannedProgress(
  taskList: UnifiedGanttTaskLike[],
  referenceDate: Date = new Date()
): number {
  if (!taskList || taskList.length === 0) return 0;
  const targetList = getLeafGanttTasks(taskList);
  const hasExplicitWeights = targetList.some(t => typeof t.weight === 'number' && t.weight > 0);

  let totalWeight = 0;
  let weightedSum = 0;
  for (const t of targetList) {
    const w = resolveTaskWeight(t, hasExplicitWeights);
    totalWeight += w;
    weightedSum += (computeTaskPlannedPct(t, referenceDate) / 100) * w;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

export interface PhaseProgressRow {
  wbs: string;
  phaseName: string;
  weight: number;
  plannedPct: number;
  actualPct: number;
  variancePct: number;
  weightedActual: number;
  weightedPlanned: number;
  matchedCount: number;
  isScheduled: boolean;
}

export function computePhaseProgressSummary(
  taskList: UnifiedGanttTaskLike[],
  referenceDate: Date = new Date()
): {
  rows: PhaseProgressRow[];
  totals: {
    totalWeight: number;
    overallActualPct: number;
    overallPlannedPct: number;
    overallVariancePct: number;
    boqWeightedActualSum: number;
    scheduledPhasesCount: number;
    totalTasksCount: number;
  };
} {
  if (!taskList || taskList.length === 0) {
    return {
      rows: [],
      totals: {
        totalWeight: 0,
        overallActualPct: 0,
        overallPlannedPct: 0,
        overallVariancePct: 0,
        boqWeightedActualSum: 0,
        scheduledPhasesCount: 0,
        totalTasksCount: 0,
      },
    };
  }

  const leafTasks = getLeafGanttTasks(taskList);
  const parentTasks = taskList.filter(
    t => t.type === 'phase' || t.type === 'project' || taskList.some(c => c.parentTaskId === t.id)
  );

  let rows: PhaseProgressRow[] = [];

  // Case 1: Project has explicit parent Phase containers (e.g., from BOM or WBS hierarchy)
  if (parentTasks.length > 0) {
    const totalExplicitPhaseWeights = parentTasks.reduce(
      (sum, p) => sum + (typeof p.weight === 'number' && p.weight > 0 ? p.weight : 0),
      0
    );

    rows = parentTasks.map((phaseTask, idx) => {
      // Find all leaf children under this phase container
      const childTasks = leafTasks.filter(
        c => c.parentTaskId === phaseTask.id ||
             (c.wbsCode && phaseTask.wbsCode && c.wbsCode.startsWith(phaseTask.wbsCode)) ||
             (c.constructionPhase && phaseTask.text && c.constructionPhase.toLowerCase() === phaseTask.text.toLowerCase())
      );

      const matched = childTasks.length > 0 ? childTasks : [phaseTask];
      const hasExplicitChildWeights = matched.some(t => typeof t.weight === 'number' && t.weight > 0);

      let totalW = 0;
      let sumActual = 0;
      let sumPlanned = 0;

      for (const t of matched) {
        const w = resolveTaskWeight(t, hasExplicitChildWeights);
        totalW += w;
        sumActual += normalizeTaskProgressFraction(t) * 100 * w;
        sumPlanned += computeTaskPlannedPct(t, referenceDate) * w;
      }

      const actualPct = totalW > 0 ? Math.round(sumActual / totalW) : normalizeTaskProgressFraction(phaseTask) * 100;
      const plannedPct = totalW > 0 ? Math.round(sumPlanned / totalW) : computeTaskPlannedPct(phaseTask, referenceDate);
      const variancePct = actualPct - plannedPct;

      let weight = 0;
      if (totalExplicitPhaseWeights > 0 && typeof phaseTask.weight === 'number' && phaseTask.weight > 0) {
        weight = +((phaseTask.weight / totalExplicitPhaseWeights) * 100).toFixed(1);
      } else {
        weight = +(100 / parentTasks.length).toFixed(1);
      }

      const weightedActual = +((actualPct * weight) / 100).toFixed(2);
      const weightedPlanned = +((plannedPct * weight) / 100).toFixed(2);

      return {
        wbs: phaseTask.wbsCode || `${idx + 1}.0`,
        phaseName: phaseTask.text || phaseTask.title || `Phase ${idx + 1}`,
        weight,
        plannedPct,
        actualPct,
        variancePct,
        weightedActual,
        weightedPlanned,
        matchedCount: matched.length,
        isScheduled: true,
      };
    });
  } else {
    // Case 2: Flat tasks or resolved construction phases.
    // Display all 14 standard WBS construction phases so Summary Progress Report is always complete and 100% synced
    const activePhaseMap = new Map<string, UnifiedGanttTaskLike[]>();
    for (const t of leafTasks) {
      const pName = resolveTaskConstructionPhase(t);
      if (!activePhaseMap.has(pName)) {
        activePhaseMap.set(pName, []);
      }
      activePhaseMap.get(pName)!.push(t);
    }

    const phaseNames = STANDARD_CONSTRUCTION_PHASES;
    const totalRawWeights = phaseNames.reduce(
      (sum, pName) => sum + (DEFAULT_PHASE_WEIGHTS[pName] || 5),
      0
    );

    rows = phaseNames.map((phaseName, idx) => {
      const matched = activePhaseMap.get(phaseName) || [];
      const hasExplicitWeights = matched.some(t => typeof t.weight === 'number' && t.weight > 0);

      let totalW = 0;
      let sumActual = 0;
      let sumPlanned = 0;

      for (const t of matched) {
        const w = resolveTaskWeight(t, hasExplicitWeights);
        totalW += w;
        sumActual += normalizeTaskProgressFraction(t) * 100 * w;
        sumPlanned += computeTaskPlannedPct(t, referenceDate) * w;
      }

      const actualPct = totalW > 0 ? Math.round(sumActual / totalW) : 0;
      const plannedPct = totalW > 0 ? Math.round(sumPlanned / totalW) : 0;
      const variancePct = actualPct - plannedPct;

      const rawWeight = DEFAULT_PHASE_WEIGHTS[phaseName] || 5;
      const normalizedWeight = totalRawWeights > 0 ? +((rawWeight / totalRawWeights) * 100).toFixed(1) : +(100 / phaseNames.length).toFixed(1);

      const weightedActual = +((actualPct * normalizedWeight) / 100).toFixed(2);
      const weightedPlanned = +((plannedPct * normalizedWeight) / 100).toFixed(2);

      return {
        wbs: `${idx + 1}.0`,
        phaseName,
        weight: normalizedWeight,
        plannedPct,
        actualPct,
        variancePct,
        weightedActual,
        weightedPlanned,
        matchedCount: matched.length,
        isScheduled: matched.length > 0,
      };
    });
  }

  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const boqWeightedActualSum = +rows.reduce((s, r) => s + r.weightedActual, 0).toFixed(2);
  const overallActualPct = computeUnifiedProjectProgress(taskList);
  const overallPlannedPct = computeUnifiedProjectPlannedProgress(taskList, referenceDate);
  const overallVariancePct = overallActualPct - overallPlannedPct;

  return {
    rows,
    totals: {
      totalWeight: Math.round(totalWeight),
      overallActualPct,
      overallPlannedPct,
      overallVariancePct,
      boqWeightedActualSum,
      scheduledPhasesCount: rows.filter(r => r.isScheduled).length,
      totalTasksCount: leafTasks.length,
    },
  };
}

export function getGanttStorageKey(projectId: string): string {
  return `${GANTT_TASKS_STORAGE_PREFIX}${projectId}`;
}

export function createDefaultWbsTasksForProject(projectId: string): UnifiedGanttTaskLike[] {
  const baseDate = new Date('2026-06-01');
  const defaults: Array<{ name: string; progress: number; duration: number; startOffsetDays: number }> = [
    { name: 'Earthworks', progress: 1.0, duration: 12, startOffsetDays: 0 },
    { name: 'Concreting Works', progress: 0.85, duration: 25, startOffsetDays: 10 },
    { name: 'Reinforcing Bar', progress: 0.70, duration: 20, startOffsetDays: 15 },
    { name: 'Formworks', progress: 0.60, duration: 18, startOffsetDays: 20 },
    { name: 'Masonry Works', progress: 0.35, duration: 24, startOffsetDays: 32 },
    { name: 'Roof Works', progress: 0.20, duration: 16, startOffsetDays: 45 },
    { name: 'Finishing & Tiling Works', progress: 0.0, duration: 20, startOffsetDays: 60 },
    { name: 'Ceiling Works', progress: 0.0, duration: 14, startOffsetDays: 70 },
    { name: 'Finishing Carpentry', progress: 0.0, duration: 18, startOffsetDays: 78 },
    { name: 'Doors and Windows', progress: 0.0, duration: 12, startOffsetDays: 85 },
    { name: 'Cabinet Works', progress: 0.0, duration: 15, startOffsetDays: 92 },
    { name: 'Painting Works', progress: 0.0, duration: 18, startOffsetDays: 98 },
    { name: 'Electrical Works', progress: 0.15, duration: 30, startOffsetDays: 35 },
    { name: 'Plumbing Works', progress: 0.10, duration: 25, startOffsetDays: 38 },
  ];

  return defaults.map((d, idx) => {
    const start = new Date(baseDate.getTime() + d.startOffsetDays * 86400000);
    const end = new Date(start.getTime() + d.duration * 86400000);
    const weight = DEFAULT_PHASE_WEIGHTS[d.name] || 5;
    return {
      id: `task-${projectId}-${idx + 1}`,
      projectId,
      wbsCode: `${idx + 1}.0`,
      text: d.name,
      title: d.name,
      constructionPhase: d.name,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      duration: d.duration,
      progress: d.progress,
      weight,
      type: 'phase',
      parentTaskId: null,
      status: d.progress === 1 ? 'COMPLETED' : d.progress > 0 ? 'IN_PROGRESS' : 'PENDING'
    };
  });
}

export function loadProjectGanttTasksFromStorage(projectId: string, autoSeed = true): UnifiedGanttTaskLike[] | null {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getGanttStorageKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    if (autoSeed) {
      const seeded = createDefaultWbsTasksForProject(projectId);
      window.localStorage.setItem(getGanttStorageKey(projectId), JSON.stringify(seeded));
      window.dispatchEvent(
        new CustomEvent(GANTT_TASKS_UPDATED_EVENT, {
          detail: { projectId, tasks: seeded },
        })
      );
      return seeded;
    }
    return null;
  } catch {
    return autoSeed ? createDefaultWbsTasksForProject(projectId) : null;
  }
}

export function saveProjectGanttTasks(projectId: string, tasks: UnifiedGanttTaskLike[]): void {
  if (!projectId || typeof window === 'undefined') return;
  try {
    const normalized = tasks.map(t => ({
      ...t,
      projectId,
      constructionPhase: resolveTaskConstructionPhase(t),
    }));
    window.localStorage.setItem(getGanttStorageKey(projectId), JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent(GANTT_TASKS_UPDATED_EVENT, {
        detail: { projectId, tasks: normalized },
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

