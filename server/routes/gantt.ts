/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { broadcastChange, invalidateAllDataCache } from '../events';
import { requireAuth, requireRole, checkUserProjectAccess } from '../middleware/auth';

export function createGanttRouter(prisma: PrismaClient) {
  const router = Router();

  // Apply authentication to all Gantt routes
  router.use(requireAuth);

  function formatGanttDate(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  // Helper to add working days (Mon-Sat, skipping Sundays)
  function addWorkingDays(startDate: Date, days: number): Date {
    const result = new Date(startDate);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0) { // Skip Sunday (0)
        added++;
      }
    }
    return result;
  }

  /**
   * GET /api/projects/:projectId/gantt
   * Returns { data: tasks, links: links } formatted for Gantt engine
   */
  router.get('/:projectId/gantt', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      if (!projectId) {
        return res.json({ data: [], links: [] });
      }

      if (!checkUserProjectAccess(req.user, projectId)) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
      }

      const existingProject = await prisma.commercialProject.findUnique({ where: { id: projectId } });
      if (!existingProject) {
        return res.json({ data: [], links: [] });
      }

      let tasks = await prisma.projectTask.findMany({
        where: { projectId },
        include: { assignedContractor: true },
        orderBy: { sortOrder: 'asc' }
      });

      let links = await prisma.taskLink.findMany({
        where: { projectId }
      });

      // If no tasks exist, return empty lists without injecting sample data
      // Tasks and schedule milestones can be added manually or imported by the user.

      // Format payload directly for gantt.parse({ data, links })
      const data = tasks.map(t => {
        const isMilestone = t.type === 'milestone' || t.duration === 0;
        return {
          id: t.id,
          text: t.text,
          start_date: formatGanttDate(t.startDate),
          end_date: formatGanttDate(t.endDate),
          duration: t.duration,
          progress: typeof t.progress === 'number' ? t.progress : 0,
          status: t.status || ((typeof t.progress === 'number' && t.progress >= 1.0) ? 'COMPLETED' : (typeof t.progress === 'number' && t.progress > 0) ? 'IN_PROGRESS' : 'TODO'),
          parent: t.parentTaskId || 0,
          type: isMilestone ? 'milestone' : t.type || 'task',
          wbsCode: t.wbsCode || '',
          milestonePhase: t.milestonePhase || '',
          assignedContractorId: t.assignedContractorId || '',
          contractor: t.assignedContractor?.name || (t.assignedContractorId ? 'Assigned Contractor' : 'CTVill In-House Crew'),
          baselineStart: t.baselineStart ? formatGanttDate(t.baselineStart) : null,
          baselineEnd: t.baselineEnd ? formatGanttDate(t.baselineEnd) : null,
          sortOrder: t.sortOrder
        };
      });

      const formattedLinks = links.map(l => ({
        id: l.id,
        source: l.sourceId,
        target: l.targetId,
        type: l.type || '0',
        lag: l.lagDays || 0
      }));

      res.json({
        data,
        links: formattedLinks
      });
    } catch (error) {
      console.error('Error fetching Gantt data:', error);
      res.status(500).json({ error: 'Failed to retrieve Gantt chart data' });
    }
  });

  /**
   * POST /api/projects/:projectId/gantt/sync
   * Unified sync handler supporting:
   * 1. Granular events: { action: 'create' | 'update' | 'delete', entityType: 'task' | 'link', data: any }
   * 2. Batch payload: { tasks: [...], links: [...], deletedTaskIds: [...], deletedLinkIds: [...] }
   */
  router.post('/:projectId/gantt/sync', requireRole(['ADMIN', 'ENGINEER', 'PROJECT_MANAGER']), async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { action, entityType, data, tasks = [], links = [], deletedTaskIds = [], deletedLinkIds = [] } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      if (!checkUserProjectAccess(req.user, projectId)) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
      }

      const existingProject = await prisma.commercialProject.findUnique({ where: { id: projectId } });
      if (!existingProject) {
        // Project exists only in client/demo storage — acknowledge cleanly without failing UI
        return res.json({ success: true, localOnly: true, result: { tasksCount: tasks.length } });
      }

      const effectiveEntityType = entityType || (req.body.task ? 'task' : req.body.link ? 'link' : undefined);
      const effectiveData = data || req.body.task || req.body.link;

      // Handle Single Granular Action (DataProcessor / Drag & Drop Event)
      if (action && effectiveEntityType) {
        const opResult = await prisma.$transaction(async (tx) => {
          if (effectiveEntityType === 'task') {
            const taskId = String(effectiveData?.id || '');
            if (action === 'delete') {
              if (taskId) {
                // Delete connected dependency links first
                await tx.taskLink.deleteMany({
                  where: {
                    OR: [{ sourceId: taskId }, { targetId: taskId }]
                  }
                });
                await tx.projectTask.deleteMany({
                  where: { id: taskId }
                });
              }
            } else if (action === 'create') {
              const id = taskId || `task-${Date.now()}`;
              const startRaw = effectiveData?.startDate || effectiveData?.start_date;
              const endRaw = effectiveData?.endDate || effectiveData?.end_date;
              const parsedStart = startRaw ? new Date(startRaw) : new Date();
              const startDate = isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
              const isMilestone = effectiveData?.type === 'milestone' || parseInt(String(effectiveData?.duration ?? 1), 10) === 0;
              const duration = isMilestone ? 0 : Math.max(1, parseInt(String(effectiveData?.duration ?? 1), 10));
              const parsedEnd = endRaw ? new Date(endRaw) : addWorkingDays(startDate, duration);
              const endDate = isMilestone ? startDate : (isNaN(parsedEnd.getTime()) ? addWorkingDays(startDate, duration) : parsedEnd);
              let progress = Math.max(0, Math.min(1, parseFloat(String(effectiveData?.progress ?? 0)) || 0));
              let status = effectiveData?.status;
              if (status === 'COMPLETED' && (!effectiveData?.progress || progress < 1.0)) {
                progress = 1.0;
              } else if (progress >= 1.0) {
                status = 'COMPLETED';
              } else if (status === undefined) {
                status = progress > 0 ? 'IN_PROGRESS' : 'TODO';
              }
              const rawParentId = effectiveData?.parent && effectiveData.parent !== 0 && effectiveData.parent !== '0'
                ? String(effectiveData.parent)
                : (effectiveData?.parentTaskId ? String(effectiveData.parentTaskId) : null);
              let safeParentId: string | null = null;
              if (rawParentId && rawParentId !== id) {
                const parentExists = await tx.projectTask.findUnique({ where: { id: rawParentId }, select: { id: true } });
                if (parentExists) safeParentId = rawParentId;
              }
              let safeContractorId: string | null = null;
              if (effectiveData?.assignedContractorId) {
                const cExists = await tx.contractor.findUnique({ where: { id: String(effectiveData.assignedContractorId) }, select: { id: true } });
                if (cExists) safeContractorId = String(effectiveData.assignedContractorId);
              }
              const type = (duration === 0 || effectiveData?.type === 'milestone') ? 'milestone' : (effectiveData?.type || 'task');

              await tx.projectTask.create({
                data: {
                  id,
                  projectId,
                  text: effectiveData?.text || 'New Construction Task',
                  title: effectiveData?.text || 'New Construction Task',
                  startDate,
                  endDate,
                  duration,
                  progress,
                  status,
                  type,
                  parentTaskId: safeParentId,
                  wbsCode: effectiveData?.wbsCode || null,
                  milestonePhase: effectiveData?.milestonePhase || effectiveData?.constructionPhase || null,
                  assignedContractorId: safeContractorId,
                  sortOrder: Number(effectiveData?.sortOrder ?? 0)
                }
              });

              // Predecessors linking
              if (Array.isArray(effectiveData?.predecessorIds) && effectiveData.predecessorIds.length > 0) {
                for (let idx = 0; idx < effectiveData.predecessorIds.length; idx++) {
                  const predId = effectiveData.predecessorIds[idx];
                  if (!predId || predId === id) continue;
                  const predExists = await tx.projectTask.findUnique({ where: { id: String(predId) }, select: { id: true } });
                  if (predExists) {
                    await tx.taskLink.create({
                      data: {
                        id: `link-${predId}-${id}-${Date.now()}-${idx}`,
                        projectId,
                        sourceId: String(predId),
                        targetId: id,
                        type: '0',
                        lagDays: 0
                      }
                    });
                  }
                }
              }
            } else if (action === 'update') {
              if (taskId) {
                const startRaw = effectiveData?.startDate || effectiveData?.start_date;
                const endRaw = effectiveData?.endDate || effectiveData?.end_date;
                const parsedStart = startRaw ? new Date(startRaw) : new Date();
                const startDate = isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
                const isMilestone = effectiveData?.type === 'milestone' || (effectiveData?.duration !== undefined && parseInt(String(effectiveData.duration), 10) === 0);
                const duration = isMilestone ? 0 : (effectiveData?.duration !== undefined ? Math.max(1, parseInt(String(effectiveData.duration), 10) || 1) : 1);
                const parsedEnd = endRaw ? new Date(endRaw) : addWorkingDays(startDate, duration);
                const endDate = isMilestone ? startDate : (isNaN(parsedEnd.getTime()) ? addWorkingDays(startDate, duration) : parsedEnd);
                const hasExplicitProgress = effectiveData?.progress !== undefined;
                let progress = hasExplicitProgress ? Math.max(0, Math.min(1, parseFloat(String(effectiveData.progress)) || 0)) : undefined;
                let derivedStatus = effectiveData?.status;
                if (derivedStatus === 'COMPLETED' && (progress === undefined || progress < 1.0)) {
                  progress = 1.0;
                } else if (progress !== undefined && progress >= 1.0) {
                  derivedStatus = 'COMPLETED';
                } else if (progress !== undefined && progress < 1.0 && derivedStatus === 'COMPLETED') {
                  derivedStatus = progress > 0 ? 'IN_PROGRESS' : 'TODO';
                } else if (derivedStatus === undefined && progress !== undefined) {
                  derivedStatus = progress > 0 ? 'IN_PROGRESS' : 'TODO';
                }
                const rawParentId = effectiveData?.parent !== undefined
                  ? (effectiveData.parent && effectiveData.parent !== 0 && effectiveData.parent !== '0' ? String(effectiveData.parent) : null)
                  : (effectiveData?.parentTaskId !== undefined ? effectiveData.parentTaskId : undefined);
                let safeParentId: string | null | undefined = rawParentId === undefined ? undefined : null;
                if (rawParentId && rawParentId !== taskId) {
                  const parentExists = await tx.projectTask.findUnique({ where: { id: String(rawParentId) }, select: { id: true } });
                  if (parentExists) safeParentId = String(rawParentId);
                }
                let safeContractorId: string | null | undefined = effectiveData?.assignedContractorId === undefined ? undefined : null;
                if (effectiveData?.assignedContractorId) {
                  const cExists = await tx.contractor.findUnique({ where: { id: String(effectiveData.assignedContractorId) }, select: { id: true } });
                  if (cExists) safeContractorId = String(effectiveData.assignedContractorId);
                }
                const type = (duration === 0 || effectiveData?.type === 'milestone') ? 'milestone' : (effectiveData?.type || 'task');

                await tx.projectTask.upsert({
                  where: { id: taskId },
                  update: {
                    ...(effectiveData?.text !== undefined ? { text: effectiveData.text, title: effectiveData.text } : {}),
                    ...(startRaw && !isNaN(parsedStart.getTime()) ? { startDate } : {}),
                    ...(endRaw && !isNaN(parsedEnd.getTime()) ? { endDate } : {}),
                    ...(effectiveData?.duration !== undefined ? { duration } : {}),
                    ...(progress !== undefined ? { progress } : {}),
                    ...(derivedStatus !== undefined ? { status: derivedStatus } : {}),
                    ...(effectiveData?.type !== undefined ? { type } : {}),
                    ...(safeParentId !== undefined ? { parentTaskId: safeParentId } : {}),
                    ...(effectiveData?.wbsCode !== undefined ? { wbsCode: effectiveData.wbsCode } : {}),
                    ...(effectiveData?.milestonePhase !== undefined || effectiveData?.constructionPhase !== undefined
                      ? { milestonePhase: effectiveData.milestonePhase || effectiveData.constructionPhase || null }
                      : {}),
                    ...(safeContractorId !== undefined ? { assignedContractorId: safeContractorId } : {}),
                    ...(effectiveData?.sortOrder !== undefined ? { sortOrder: Number(effectiveData.sortOrder) } : {}),
                    updatedAt: new Date()
                  },
                  create: {
                    id: taskId,
                    projectId,
                    text: effectiveData?.text || 'New Construction Task',
                    title: effectiveData?.text || 'New Construction Task',
                    startDate,
                    endDate,
                    duration,
                    progress: progress ?? 0,
                    status: derivedStatus || (progress !== undefined && progress >= 1.0 ? 'COMPLETED' : progress !== undefined && progress > 0 ? 'IN_PROGRESS' : 'TODO'),
                    type,
                    parentTaskId: safeParentId || null,
                    wbsCode: effectiveData?.wbsCode || null,
                    milestonePhase: effectiveData?.milestonePhase || effectiveData?.constructionPhase || null,
                    assignedContractorId: safeContractorId || null,
                    sortOrder: Number(effectiveData?.sortOrder ?? 0)
                  }
                });

                // Update predecessor links if explicitly supplied
                if (Array.isArray(effectiveData?.predecessorIds)) {
                  await tx.taskLink.deleteMany({
                    where: { targetId: taskId, projectId }
                  });
                  for (let idx = 0; idx < effectiveData.predecessorIds.length; idx++) {
                    const predId = effectiveData.predecessorIds[idx];
                    if (predId && predId !== taskId) {
                      const predExists = await tx.projectTask.findUnique({ where: { id: String(predId) }, select: { id: true } });
                      if (predExists) {
                        await tx.taskLink.create({
                          data: {
                            id: `link-${predId}-${taskId}-${Date.now()}-${idx}`,
                            projectId,
                            sourceId: String(predId),
                            targetId: taskId,
                            type: '0',
                            lagDays: 0
                          }
                        });
                      }
                    }
                  }
                }
              }
            }
          } else if (effectiveEntityType === 'link') {
            const linkId = String(effectiveData?.id || '');
            if (action === 'delete') {
              if (linkId) {
                await tx.taskLink.deleteMany({
                  where: { id: linkId }
                });
              }
            } else if (action === 'create') {
              const id = linkId || `link-${Date.now()}`;
              const source = effectiveData?.source || effectiveData?.sourceId;
              const target = effectiveData?.target || effectiveData?.targetId;
              if (source && target) {
                await tx.taskLink.create({
                  data: {
                    id,
                    projectId,
                    sourceId: String(source),
                    targetId: String(target),
                    type: String(effectiveData.type ?? '0'),
                    lagDays: parseInt(String(effectiveData.lag ?? effectiveData.lagDays ?? 0), 10)
                  }
                });
              }
            } else if (action === 'update') {
              const source = effectiveData?.source || effectiveData?.sourceId;
              const target = effectiveData?.target || effectiveData?.targetId;
              if (linkId && source && target) {
                await tx.taskLink.update({
                  where: { id: linkId },
                  data: {
                    sourceId: String(source),
                    targetId: String(target),
                    type: String(effectiveData.type ?? '0'),
                    lagDays: parseInt(String(effectiveData.lag ?? effectiveData.lagDays ?? 0), 10)
                  }
                });
              }
            }
          }

          // Recalculate summary metrics for commercial_projects using leaf tasks
          const allTasks = await tx.projectTask.findMany({ where: { projectId } });
          const parentIds = new Set(allTasks.map(t => t.parentTaskId).filter(Boolean));
          const leafTasks = allTasks.filter(t => !parentIds.has(t.id));
          const targetTasks = leafTasks.length > 0 ? leafTasks : allTasks;
          let avgProgress = 0;
          if (targetTasks.length > 0) {
            const totalDuration = targetTasks.reduce((acc, curr) => acc + Math.max(1, curr.duration || 1), 0);
            const weightedProgress = targetTasks.reduce((acc, curr) => {
              let p = 0;
              if (curr.status === 'COMPLETED' || (typeof curr.progress === 'number' && curr.progress >= 1.0)) {
                p = 1.0;
              } else {
                const raw = typeof curr.progress === 'number' ? curr.progress : 0;
                p = raw > 1.0 ? raw / 100 : raw;
              }
              return acc + (p * Math.max(1, curr.duration || 1));
            }, 0);
            avgProgress = totalDuration > 0 ? Math.round((weightedProgress / totalDuration) * 100) : 0;
          }
          const existingProj = await tx.commercialProject.findUnique({ where: { id: projectId } });
          const shouldAdvanceStatus = avgProgress > 0 && (!existingProj?.status || existingProj.status === 'PLANNING');
          await tx.commercialProject.update({
            where: { id: projectId },
            data: {
              progressPercentage: avgProgress,
              tasksCount: allTasks.length,
              ...(shouldAdvanceStatus ? { status: 'IN_PROGRESS' } : {})
            }
          }).catch(() => { });

          const freshTasks = await tx.projectTask.findMany({
            where: { projectId },
            include: { assignedContractor: true },
            orderBy: { sortOrder: 'asc' }
          });
          const freshLinks = await tx.taskLink.findMany({ where: { projectId } });

          return {
            action,
            entityType: effectiveEntityType,
            id: effectiveData?.id,
            projectProgress: avgProgress,
            tasksCount: freshTasks.length,
            data: freshTasks.map(t => {
              const isMilestone = t.type === 'milestone' || t.duration === 0;
              return {
                id: t.id,
                text: t.text,
                start_date: formatGanttDate(t.startDate),
                end_date: formatGanttDate(t.endDate),
                duration: t.duration,
                progress: typeof t.progress === 'number' ? t.progress : 0,
                status: t.status || ((typeof t.progress === 'number' && t.progress >= 1.0) ? 'COMPLETED' : (typeof t.progress === 'number' && t.progress > 0) ? 'IN_PROGRESS' : 'TODO'),
                parent: t.parentTaskId || 0,
                type: isMilestone ? 'milestone' : t.type || 'task',
                wbsCode: t.wbsCode || '',
                milestonePhase: t.milestonePhase || '',
                assignedContractorId: t.assignedContractorId || '',
                contractor: t.assignedContractor?.name || (t.assignedContractorId ? 'Assigned Contractor' : 'LDM Construction Crew'),
                baselineStart: t.baselineStart ? formatGanttDate(t.baselineStart) : null,
                baselineEnd: t.baselineEnd ? formatGanttDate(t.baselineEnd) : null,
                sortOrder: t.sortOrder
              };
            }),
            links: freshLinks.map(l => ({
              id: l.id,
              source: l.sourceId,
              target: l.targetId,
              type: l.type || '0',
              lag: l.lagDays || 0
            }))
          };
        });

        broadcastChange('tasks');
        broadcastChange('projects');
        invalidateAllDataCache();

        return res.json({
          success: true,
          message: `Successfully processed ${action} on ${effectiveEntityType}.`,
          result: opResult,
          data: opResult.data,
          links: opResult.links,
          syncedAt: new Date().toISOString()
        });
      }

      // Handle Bulk / Full State Batch Sync (Auto-Migration & Full Schedule Save)
      const result = await prisma.$transaction(async (tx) => {
        // 1. Delete removed links
        if (Array.isArray(deletedLinkIds) && deletedLinkIds.length > 0) {
          await tx.taskLink.deleteMany({
            where: {
              id: { in: deletedLinkIds },
              projectId
            }
          });
        }

        // 2. Delete removed tasks
        if (Array.isArray(deletedTaskIds) && deletedTaskIds.length > 0) {
          await tx.projectTask.deleteMany({
            where: {
              id: { in: deletedTaskIds },
              projectId
            }
          });
        }

        // 3. Upsert tasks — insert root/parent tasks first so parentTaskId FK references always exist
        const orderedIncomingTasks = [...tasks].sort((a: any, b: any) => {
          const aHasParent = Boolean(a.parentTaskId || (a.parent && a.parent !== 0 && a.parent !== '0'));
          const bHasParent = Boolean(b.parentTaskId || (b.parent && b.parent !== 0 && b.parent !== '0'));
          if (aHasParent !== bHasParent) return aHasParent ? 1 : -1;
          return Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
        });

        for (let idx = 0; idx < orderedIncomingTasks.length; idx++) {
          const t = orderedIncomingTasks[idx];
          if (!t.id) continue;
          const startRaw = t.start_date || t.startDate;
          const endRaw = t.end_date || t.endDate;
          const parsedStart = startRaw ? new Date(startRaw) : new Date();
          const startDate = isNaN(parsedStart.getTime()) ? new Date() : parsedStart;
          const duration = Math.max(0, parseInt(String(t.duration ?? 1), 10) || 0);
          const parsedEnd = endRaw ? new Date(endRaw) : addWorkingDays(startDate, duration || 1);
          const endDate = isNaN(parsedEnd.getTime()) ? addWorkingDays(startDate, duration || 1) : parsedEnd;

          const rawParentId =
            t.parent && t.parent !== 0 && t.parent !== '0'
              ? String(t.parent)
              : t.parentTaskId
                ? String(t.parentTaskId)
                : null;
          let safeParentId: string | null = null;
          if (rawParentId && rawParentId !== String(t.id)) {
            const pExists = await tx.projectTask.findUnique({ where: { id: rawParentId }, select: { id: true } });
            if (pExists) safeParentId = rawParentId;
          }

          let safeContractorId: string | null = null;
          if (t.assignedContractorId) {
            const cExists = await tx.contractor.findUnique({ where: { id: String(t.assignedContractorId) }, select: { id: true } });
            if (cExists) safeContractorId = String(t.assignedContractorId);
          }

          const rawProg = parseFloat(String(t.progress ?? 0)) || 0;
          const progress = Math.max(0, Math.min(1, rawProg > 1 ? rawProg / 100 : rawProg));
          const status = progress >= 1.0
            ? 'COMPLETED'
            : (t.status === 'COMPLETED' && progress < 1.0)
              ? (progress > 0 ? 'IN_PROGRESS' : 'TODO')
              : (t.status || (progress > 0 ? 'IN_PROGRESS' : 'TODO'));
          const type = (duration === 0 || t.type === 'milestone') ? 'milestone' : (t.type || 'task');

          await tx.projectTask.upsert({
            where: { id: String(t.id) },
            update: {
              text: t.text || t.title || 'Untitled Construction Task',
              title: t.text || t.title || 'Untitled Construction Task',
              startDate,
              endDate,
              duration,
              progress,
              status,
              type,
              parentTaskId: safeParentId,
              wbsCode: t.wbsCode || null,
              milestonePhase: t.milestonePhase || t.constructionPhase || null,
              assignedContractorId: safeContractorId,
              sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : idx,
              updatedAt: new Date()
            },
            create: {
              id: String(t.id),
              projectId,
              text: t.text || t.title || 'Untitled Construction Task',
              title: t.text || t.title || 'Untitled Construction Task',
              startDate,
              endDate,
              duration,
              progress,
              status,
              type,
              parentTaskId: safeParentId,
              wbsCode: t.wbsCode || null,
              milestonePhase: t.milestonePhase || t.constructionPhase || null,
              assignedContractorId: safeContractorId,
              sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : idx
            }
          });
        }

        // 4. Upsert explicit links & task predecessorIds
        const normalizedLinks: Array<{ id: string; source: string; target: string; type: string; lag: number }> = [];
        for (const l of links) {
          if (!l.source || !l.target) continue;
          normalizedLinks.push({
            id: String(l.id || `link-${l.source}-${l.target}`),
            source: String(l.source),
            target: String(l.target),
            type: String(l.type !== undefined ? l.type : '0'),
            lag: parseInt(String(l.lag ?? l.lagDays ?? 0), 10) || 0,
          });
        }
        for (const t of orderedIncomingTasks) {
          if (Array.isArray(t.predecessorIds)) {
            for (const predId of t.predecessorIds) {
              if (!predId || String(predId) === String(t.id)) continue;
              const linkKey = `link-${predId}-${t.id}`;
              if (!normalizedLinks.some(nl => nl.source === String(predId) && nl.target === String(t.id))) {
                normalizedLinks.push({
                  id: linkKey,
                  source: String(predId),
                  target: String(t.id),
                  type: '0',
                  lag: 0,
                });
              }
            }
          }
        }
        for (const l of normalizedLinks) {
          const [srcExists, tgtExists] = await Promise.all([
            tx.projectTask.findUnique({ where: { id: l.source }, select: { id: true } }),
            tx.projectTask.findUnique({ where: { id: l.target }, select: { id: true } }),
          ]);
          if (!srcExists || !tgtExists) continue;
          await tx.taskLink.upsert({
            where: { id: l.id },
            update: {
              sourceId: l.source,
              targetId: l.target,
              type: l.type,
              lagDays: l.lag
            },
            create: {
              id: l.id,
              projectId,
              sourceId: l.source,
              targetId: l.target,
              type: l.type,
              lagDays: l.lag
            }
          });
        }

        // 5. Recalculate average progress & return fresh DB state
        const freshTasks = await tx.projectTask.findMany({
          where: { projectId },
          include: { assignedContractor: true },
          orderBy: { sortOrder: 'asc' }
        });
        const freshLinks = await tx.taskLink.findMany({ where: { projectId } });

        let avgProgress = 0;
        if (freshTasks.length > 0) {
          const parentIds = new Set(freshTasks.map(t => t.parentTaskId).filter(Boolean));
          const leafTasks = freshTasks.filter(t => !parentIds.has(t.id));
          const targetTasks = leafTasks.length > 0 ? leafTasks : freshTasks;
          const totalDuration = targetTasks.reduce((acc, curr) => acc + Math.max(1, curr.duration || 1), 0);
          const weightedProgress = targetTasks.reduce((acc, curr) => acc + (curr.progress || 0) * Math.max(1, curr.duration || 1), 0);
          avgProgress = totalDuration > 0 ? Math.round((weightedProgress / totalDuration) * 100) : 0;

          await tx.commercialProject.update({
            where: { id: projectId },
            data: {
              progressPercentage: avgProgress,
              tasksCount: freshTasks.length
            }
          }).catch(() => { });
        }

        return {
          tasksCount: freshTasks.length,
          linksCount: freshLinks.length,
          projectProgress: avgProgress,
          data: freshTasks.map(t => {
            const isMilestone = t.type === 'milestone' || t.duration === 0;
            return {
              id: t.id,
              text: t.text,
              start_date: formatGanttDate(t.startDate),
              end_date: formatGanttDate(t.endDate),
              duration: t.duration,
              progress: typeof t.progress === 'number' ? t.progress : 0,
              status: t.status || ((typeof t.progress === 'number' && t.progress >= 1.0) ? 'COMPLETED' : (typeof t.progress === 'number' && t.progress > 0) ? 'IN_PROGRESS' : 'TODO'),
              parent: t.parentTaskId || 0,
              type: isMilestone ? 'milestone' : t.type || 'task',
              wbsCode: t.wbsCode || '',
              milestonePhase: t.milestonePhase || '',
              assignedContractorId: t.assignedContractorId || '',
              contractor: t.assignedContractor?.name || (t.assignedContractorId ? 'Assigned Contractor' : 'LDM Construction Crew'),
              baselineStart: t.baselineStart ? formatGanttDate(t.baselineStart) : null,
              baselineEnd: t.baselineEnd ? formatGanttDate(t.baselineEnd) : null,
              sortOrder: t.sortOrder
            };
          }),
          links: freshLinks.map(l => ({
            id: l.id,
            source: l.sourceId,
            target: l.targetId,
            type: l.type || '0',
            lag: l.lagDays || 0
          }))
        };
      });

      broadcastChange('tasks');
      broadcastChange('projects');
      invalidateAllDataCache();

      res.json({
        success: true,
        message: `Successfully synchronized ${result.tasksCount} tasks and ${result.linksCount} links.`,
        result,
        data: result.data,
        links: result.links,
        syncedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error synchronizing Gantt data:', error);
      res.status(500).json({ error: 'Failed to synchronize Gantt schedule' });
    }
  });

  return router;
}
