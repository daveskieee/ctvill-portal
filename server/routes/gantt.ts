/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export function createGanttRouter(prisma: PrismaClient) {
  const router = Router();

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
          parent: t.parentTaskId || 0,
          type: isMilestone ? 'milestone' : t.type || 'task',
          wbsCode: t.wbsCode || '',
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
  router.post('/:projectId/gantt/sync', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { action, entityType, data, tasks = [], links = [], deletedTaskIds = [], deletedLinkIds = [] } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const existingProject = await prisma.commercialProject.findUnique({ where: { id: projectId } });
      if (!existingProject) {
        return res.status(404).json({ error: 'Project not found' });
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
              const startDate = startRaw ? new Date(startRaw) : new Date();
              const duration = Math.max(0, parseInt(String(effectiveData?.duration ?? 1), 10));
              const endDate = endRaw ? new Date(endRaw) : addWorkingDays(startDate, duration);
              const progress = Math.max(0, Math.min(1, parseFloat(String(effectiveData?.progress ?? 0))));
              const parentId = effectiveData?.parent && effectiveData.parent !== 0 && effectiveData.parent !== '0' 
                ? String(effectiveData.parent) 
                : (effectiveData?.parentTaskId ? String(effectiveData.parentTaskId) : null);
              const type = (duration === 0 || effectiveData?.type === 'milestone') ? 'milestone' : (effectiveData?.type || 'task');

              await tx.projectTask.create({
                data: {
                  id,
                  projectId,
                  text: effectiveData?.text || 'New Construction Task',
                  startDate,
                  endDate,
                  duration,
                  progress,
                  type,
                  parentTaskId: parentId,
                  wbsCode: effectiveData?.wbsCode || null,
                  assignedContractorId: effectiveData?.assignedContractorId || null,
                  sortOrder: Number(effectiveData?.sortOrder ?? 0)
                }
              });

              // Predecessors linking
              if (Array.isArray(effectiveData?.predecessorIds) && effectiveData.predecessorIds.length > 0) {
                for (const predId of effectiveData.predecessorIds) {
                  await tx.taskLink.create({
                    data: {
                      id: `link-${predId}-${id}-${Date.now()}`,
                      projectId,
                      sourceId: String(predId),
                      targetId: id,
                      type: '0',
                      lagDays: 0
                    }
                  });
                }
              }
            } else if (action === 'update') {
              if (taskId) {
                const startRaw = effectiveData?.startDate || effectiveData?.start_date;
                const endRaw = effectiveData?.endDate || effectiveData?.end_date;
                const startDate = startRaw ? new Date(startRaw) : new Date();
                const duration = effectiveData?.duration !== undefined ? Math.max(0, parseInt(String(effectiveData.duration), 10)) : 1;
                const endDate = endRaw ? new Date(endRaw) : addWorkingDays(startDate, duration);
                const progress = effectiveData?.progress !== undefined ? Math.max(0, Math.min(1, parseFloat(String(effectiveData.progress)))) : 0;
                const parentId = effectiveData?.parent !== undefined 
                  ? (effectiveData.parent && effectiveData.parent !== 0 && effectiveData.parent !== '0' ? String(effectiveData.parent) : null) 
                  : (effectiveData?.parentTaskId !== undefined ? effectiveData.parentTaskId : undefined);
                const type = (duration === 0 || effectiveData?.type === 'milestone') ? 'milestone' : (effectiveData?.type || 'task');

                await tx.projectTask.upsert({
                  where: { id: taskId },
                  update: {
                    ...(effectiveData?.text !== undefined ? { text: effectiveData.text } : {}),
                    ...(startRaw ? { startDate } : {}),
                    ...(endRaw ? { endDate } : {}),
                    ...(effectiveData?.duration !== undefined ? { duration } : {}),
                    ...(effectiveData?.progress !== undefined ? { progress } : {}),
                    ...(effectiveData?.type !== undefined ? { type } : {}),
                    ...(parentId !== undefined ? { parentTaskId: parentId } : {}),
                    ...(effectiveData?.wbsCode !== undefined ? { wbsCode: effectiveData.wbsCode } : {}),
                    ...(effectiveData?.assignedContractorId !== undefined ? { assignedContractorId: effectiveData.assignedContractorId || null } : {}),
                    ...(effectiveData?.sortOrder !== undefined ? { sortOrder: Number(effectiveData.sortOrder) } : {}),
                    updatedAt: new Date()
                  },
                  create: {
                    id: taskId,
                    projectId,
                    text: effectiveData?.text || 'New Construction Task',
                    startDate,
                    endDate,
                    duration,
                    progress,
                    type,
                    parentTaskId: parentId || null,
                    wbsCode: effectiveData?.wbsCode || null,
                    assignedContractorId: effectiveData?.assignedContractorId || null,
                    sortOrder: Number(effectiveData?.sortOrder ?? 0)
                  }
                });

                // Update predecessor links if explicitly supplied
                if (Array.isArray(effectiveData?.predecessorIds)) {
                  await tx.taskLink.deleteMany({
                    where: { targetId: taskId, projectId }
                  });
                  for (const predId of effectiveData.predecessorIds) {
                    if (predId && predId !== taskId) {
                      const predExists = await tx.projectTask.findUnique({ where: { id: String(predId) } });
                      if (predExists) {
                        await tx.taskLink.create({
                          data: {
                            id: `link-${predId}-${taskId}-${Date.now()}`,
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

          // Recalculate summary metrics for commercial_projects
          const allTasks = await tx.projectTask.findMany({ where: { projectId } });
          let avgProgress = 0;
          if (allTasks.length > 0) {
            const totalDuration = allTasks.reduce((acc, curr) => acc + Math.max(1, curr.duration || 1), 0);
            const weightedProgress = allTasks.reduce((acc, curr) => acc + (curr.progress || 0) * Math.max(1, curr.duration || 1), 0);
            avgProgress = totalDuration > 0 ? Math.round((weightedProgress / totalDuration) * 100) : 0;
            await tx.commercialProject.update({
              where: { id: projectId },
              data: {
                progressPercentage: avgProgress,
                tasksCount: allTasks.length
              }
            }).catch(() => {});
          }

          return { 
            action, 
            entityType: effectiveEntityType, 
            id: effectiveData?.id,
            projectProgress: avgProgress,
            tasksCount: allTasks.length
          };
        });

        return res.json({
          success: true,
          message: `Successfully processed ${action} on ${effectiveEntityType}.`,
          result: opResult,
          syncedAt: new Date().toISOString()
        });
      }

      // Handle Bulk / Full State Batch Sync
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

        // 3. Upsert tasks
        for (const t of tasks) {
          if (!t.id) continue;
          const startDate = t.start_date ? new Date(t.start_date) : new Date();
          const duration = Math.max(0, parseInt(String(t.duration || 0), 10));
          const endDate = t.end_date ? new Date(t.end_date) : addWorkingDays(startDate, duration || 1);
          const parentId = t.parent && t.parent !== 0 && t.parent !== '0' ? String(t.parent) : null;
          const progress = Math.max(0, Math.min(1, parseFloat(String(t.progress || 0))));
          const type = (duration === 0 || t.type === 'milestone') ? 'milestone' : (t.type || 'task');

          await tx.projectTask.upsert({
            where: { id: String(t.id) },
            update: {
              text: t.text || 'Untitled Construction Task',
              startDate,
              endDate,
              duration,
              progress,
              type,
              parentTaskId: parentId,
              wbsCode: t.wbsCode || null,
              assignedContractorId: t.assignedContractorId || null,
              sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : 0,
              updatedAt: new Date()
            },
            create: {
              id: String(t.id),
              projectId,
              text: t.text || 'Untitled Construction Task',
              startDate,
              endDate,
              duration,
              progress,
              type,
              parentTaskId: parentId,
              wbsCode: t.wbsCode || null,
              assignedContractorId: t.assignedContractorId || null,
              sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : 0
            }
          });
        }

        // 4. Upsert links
        for (const l of links) {
          if (!l.id || !l.source || !l.target) continue;
          await tx.taskLink.upsert({
            where: { id: String(l.id) },
            update: {
              sourceId: String(l.source),
              targetId: String(l.target),
              type: String(l.type !== undefined ? l.type : '0'),
              lagDays: parseInt(String(l.lag || 0), 10)
            },
            create: {
              id: String(l.id),
              projectId,
              sourceId: String(l.source),
              targetId: String(l.target),
              type: String(l.type !== undefined ? l.type : '0'),
              lagDays: parseInt(String(l.lag || 0), 10)
            }
          });
        }

        // 5. Recalculate average progress for commercial_projects
        const allTasks = await tx.projectTask.findMany({
          where: { projectId }
        });

        let avgProgress = 0;
        if (allTasks.length > 0) {
          const totalDuration = allTasks.reduce((acc, curr) => acc + Math.max(1, curr.duration || 1), 0);
          const weightedProgress = allTasks.reduce((acc, curr) => acc + (curr.progress || 0) * Math.max(1, curr.duration || 1), 0);
          avgProgress = totalDuration > 0 ? Math.round((weightedProgress / totalDuration) * 100) : 0;

          await tx.commercialProject.update({
            where: { id: projectId },
            data: {
              progressPercentage: avgProgress,
              tasksCount: allTasks.length
            }
          }).catch(() => {});
        }

        return { tasksCount: tasks.length, linksCount: links.length, projectProgress: avgProgress };
      });

      res.json({
        success: true,
        message: `Successfully synchronized ${result.tasksCount} tasks and ${result.linksCount} links.`,
        result,
        syncedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error synchronizing Gantt data:', error);
      res.status(500).json({ error: 'Failed to synchronize Gantt schedule' });
    }
  });

  return router;
}
