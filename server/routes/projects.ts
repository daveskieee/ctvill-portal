/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { prisma, pool } from '../db';
import { broadcastChange, invalidateAllDataCache } from '../events';
import { resolveProjectCoordinates, resolveLocalGeocoding } from '../services/geocoding';

export const projectsRouter = Router();

// ============================================================================
// COMMERCIAL PROJECTS REST API
// ============================================================================

// GET /api/geocoding/lookup
projectsRouter.get('/geocoding/lookup', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const resolved = await resolveProjectCoordinates(q);
    res.json(resolved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to geocode location' });
  }
});

// GET /api/projects
projectsRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const dbProjects = await pool.query('SELECT * FROM commercial_projects ORDER BY created_at ASC');
    const projects = await Promise.all((dbProjects.rows || []).map(async (p) => {
      let lat = p.latitude !== null && p.latitude !== undefined ? Number(p.latitude) : undefined;
      let lon = p.longitude !== null && p.longitude !== undefined ? Number(p.longitude) : undefined;

      // Auto-backfill coordinates if missing
      if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
        const resolved = await resolveProjectCoordinates(p.location || '', p.name || '');
        lat = resolved.lat;
        lon = resolved.lon;
        // Asynchronously persist resolved coordinates to DB
        pool.query('UPDATE commercial_projects SET latitude = $1, longitude = $2 WHERE id = $3', [lat, lon, p.id])
          .catch(err => console.warn(`Failed to backfill coords for project ${p.id}:`, err));
      }

      return {
        id: p.id,
        name: p.name,
        clientName: p.client_name || '',
        description: p.description || '',
        location: p.location || '',
        budget: Number(p.budget || 0),
        fundsCollected: Number(p.funds_collected || 0),
        progressPercentage: Number(p.progress_percentage || 0),
        status: (Number(p.progress_percentage || 0) > 0 && p.status === 'PLANNING') ? 'IN_PROGRESS' : (p.status || 'IN_PROGRESS'),
        targetHandoverDate: p.target_handover_date ? (p.target_handover_date instanceof Date ? p.target_handover_date.toISOString().split('T')[0] : String(p.target_handover_date).split('T')[0]) : '2026-12-31',
        startDate: p.start_date ? (p.start_date instanceof Date ? p.start_date.toISOString().split('T')[0] : String(p.start_date).split('T')[0]) : '2026-01-01',
        assignedWorkersCount: Number(p.assigned_workers_count || 0),
        assignedContractorIds: Array.isArray(p.assigned_contractor_ids) ? p.assigned_contractor_ids : [],
        tasksCount: Number(p.tasks_count || 0),
        milestonesCount: Number(p.milestones_count || 0),
        isPrivateAccounting: Boolean(p.is_private_accounting),
        assignedProjectManagerId: p.assigned_project_manager_id || '',
        assignedProjectManagerName: p.assigned_project_manager_name || '',
        latitude: lat,
        longitude: lon,
        weatherSuspended: Boolean(p.weather_suspended),
        createdAt: p.created_at ? (p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at)) : new Date().toISOString()
      };
    }));
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/projects
projectsRouter.post('/projects', async (req: Request, res: Response) => {
  try {
    const {
      name,
      clientName,
      description,
      location,
      budget,
      fundsCollected,
      progressPercentage,
      status,
      targetHandoverDate,
      startDate,
      assignedWorkersCount,
      tasksCount,
      milestonesCount,
      isPrivateAccounting,
      assignedProjectManagerId,
      assignedProjectManagerName,
      latitude,
      longitude,
      weatherSuspended
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (startDate && targetHandoverDate && new Date(targetHandoverDate) < new Date(startDate)) {
      return res.status(400).json({ 
        error: 'Validation Error: Target handover date cannot be earlier than project start date.' 
      });
    }

    // Auto-resolve coordinates if not explicitly provided or invalid
    let finalLat = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null;
    let finalLon = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null;
    if (finalLat === null || finalLon === null || isNaN(finalLat) || isNaN(finalLon)) {
      const resolved = await resolveProjectCoordinates(location, name);
      finalLat = resolved.lat;
      finalLon = resolved.lon;
    }

    const id = req.body.id || `PRJ-${Date.now().toString().slice(-4)}`;
    const contractorIds = Array.isArray(req.body.assignedContractorIds) ? req.body.assignedContractorIds : [];
    await pool.query(
      `INSERT INTO commercial_projects 
       (id, name, client_name, description, location, budget, funds_collected, progress_percentage, status, target_handover_date, start_date, assigned_workers_count, assigned_contractor_ids, tasks_count, milestones_count, is_private_accounting, assigned_project_manager_id, assigned_project_manager_name, latitude, longitude, weather_suspended)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        id,
        name.trim(),
        (clientName || '').trim(),
        (description || '').trim(),
        (location || '').trim(),
        Number(budget) || 0,
        Number(fundsCollected) || 0,
        Number(progressPercentage) || 0,
        status || 'PLANNING',
        targetHandoverDate || '2026-12-31',
        startDate || new Date().toISOString().split('T')[0],
        Number(assignedWorkersCount) || contractorIds.length || 0,
        contractorIds,
        Number(tasksCount) || 0,
        Number(milestonesCount) || 0,
        Boolean(isPrivateAccounting),
        assignedProjectManagerId || null,
        assignedProjectManagerName || null,
        finalLat,
        finalLon,
        Boolean(weatherSuspended)
      ]
    );

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CIVIL_WORKS',
        entityId: id,
        action: 'PROJECT_CREATED',
        actorName: 'Operations Director',
        actorRole: 'ADMIN',
        details: `Created commercial fitout project "${name.trim()}" (Budget: ₱${Number(budget || 0).toLocaleString()}, PM: ${assignedProjectManagerName || 'Unassigned'}).`,
      }
    }).catch(() => {});

    broadcastChange('projects');
    broadcastChange('auditLogs');
    invalidateAllDataCache();

    const pRes = await pool.query('SELECT * FROM commercial_projects WHERE id = $1', [id]);
    const p = pRes.rows[0] || {};
    const createdProject = {
      id: p.id || id,
      name: p.name || name.trim(),
      clientName: p.client_name || '',
      description: p.description || '',
      location: p.location || '',
      budget: Number(p.budget || 0),
      fundsCollected: Number(p.funds_collected || 0),
      progressPercentage: Number(p.progress_percentage || 0),
      status: p.status || 'PLANNING',
      targetHandoverDate: p.target_handover_date ? (p.target_handover_date instanceof Date ? p.target_handover_date.toISOString().split('T')[0] : String(p.target_handover_date).split('T')[0]) : '2026-12-31',
      startDate: p.start_date ? (p.start_date instanceof Date ? p.start_date.toISOString().split('T')[0] : String(p.start_date).split('T')[0]) : '2026-01-01',
      assignedWorkersCount: Number(p.assigned_workers_count || 0),
      assignedContractorIds: Array.isArray(p.assigned_contractor_ids) ? p.assigned_contractor_ids : [],
      tasksCount: Number(p.tasks_count || 0),
      milestonesCount: Number(p.milestones_count || 0),
      isPrivateAccounting: Boolean(p.is_private_accounting),
      assignedProjectManagerId: p.assigned_project_manager_id || '',
      assignedProjectManagerName: p.assigned_project_manager_name || '',
      latitude: p.latitude !== null && p.latitude !== undefined ? Number(p.latitude) : undefined,
      longitude: p.longitude !== null && p.longitude !== undefined ? Number(p.longitude) : undefined,
      weatherSuspended: Boolean(p.weather_suspended),
      createdAt: p.created_at ? (p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at)) : new Date().toISOString()
    };
    res.json(createdProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/projects/:id
projectsRouter.patch('/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      clientName,
      description,
      location,
      budget,
      fundsCollected,
      progressPercentage,
      status,
      targetHandoverDate,
      startDate,
      assignedWorkersCount,
      tasksCount,
      milestonesCount,
      isPrivateAccounting,
      assignedProjectManagerId,
      assignedProjectManagerName,
      latitude,
      longitude,
      weatherSuspended
    } = req.body;

    if (startDate && targetHandoverDate && new Date(targetHandoverDate) < new Date(startDate)) {
      return res.status(400).json({ 
        error: 'Validation Error: Target handover date cannot be earlier than project start date.' 
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
    if (clientName !== undefined) { updates.push(`client_name = $${idx++}`); values.push(clientName.trim()); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description.trim()); }
    if (location !== undefined) { 
      updates.push(`location = $${idx++}`); 
      values.push(location.trim()); 

      // If latitude and longitude are not explicitly provided during location update, re-resolve them
      if (latitude === undefined && longitude === undefined && location.trim()) {
        const resolved = await resolveProjectCoordinates(location, name);
        updates.push(`latitude = $${idx++}`);
        values.push(resolved.lat);
        updates.push(`longitude = $${idx++}`);
        values.push(resolved.lon);
      }
    }
    if (budget !== undefined) { updates.push(`budget = $${idx++}`); values.push(Number(budget) || 0); }
    if (fundsCollected !== undefined) { updates.push(`funds_collected = $${idx++}`); values.push(Number(fundsCollected) || 0); }
    if (progressPercentage !== undefined) { updates.push(`progress_percentage = $${idx++}`); values.push(Number(progressPercentage) || 0); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (targetHandoverDate !== undefined) { updates.push(`target_handover_date = $${idx++}`); values.push(targetHandoverDate || null); }
    if (startDate !== undefined) { updates.push(`start_date = $${idx++}`); values.push(startDate || null); }
    if (assignedWorkersCount !== undefined) { updates.push(`assigned_workers_count = $${idx++}`); values.push(Number(assignedWorkersCount) || 0); }
    if (req.body.assignedContractorIds !== undefined) { updates.push(`assigned_contractor_ids = $${idx++}`); values.push(Array.isArray(req.body.assignedContractorIds) ? req.body.assignedContractorIds : []); }
    if (tasksCount !== undefined) { updates.push(`tasks_count = $${idx++}`); values.push(Number(tasksCount) || 0); }
    if (milestonesCount !== undefined) { updates.push(`milestones_count = $${idx++}`); values.push(Number(milestonesCount) || 0); }
    if (isPrivateAccounting !== undefined) { updates.push(`is_private_accounting = $${idx++}`); values.push(Boolean(isPrivateAccounting)); }
    if (assignedProjectManagerId !== undefined) { updates.push(`assigned_project_manager_id = $${idx++}`); values.push(assignedProjectManagerId || null); }
    if (assignedProjectManagerName !== undefined) { updates.push(`assigned_project_manager_name = $${idx++}`); values.push(assignedProjectManagerName || null); }
    if (latitude !== undefined) { updates.push(`latitude = $${idx++}`); values.push(latitude !== null && latitude !== '' ? Number(latitude) : null); }
    if (longitude !== undefined) { updates.push(`longitude = $${idx++}`); values.push(longitude !== null && longitude !== '' ? Number(longitude) : null); }
    if (weatherSuspended !== undefined) { updates.push(`weather_suspended = $${idx++}`); values.push(Boolean(weatherSuspended)); }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE commercial_projects SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    broadcastChange('projects');
    invalidateAllDataCache();

    const pRes = await pool.query('SELECT * FROM commercial_projects WHERE id = $1', [id]);
    const p = pRes.rows[0] || {};
    const updatedProject = {
      id: p.id || id,
      name: p.name || '',
      clientName: p.client_name || '',
      description: p.description || '',
      location: p.location || '',
      budget: Number(p.budget || 0),
      fundsCollected: Number(p.funds_collected || 0),
      progressPercentage: Number(p.progress_percentage || 0),
      status: p.status || 'IN_PROGRESS',
      targetHandoverDate: p.target_handover_date ? (p.target_handover_date instanceof Date ? p.target_handover_date.toISOString().split('T')[0] : String(p.target_handover_date).split('T')[0]) : '2026-12-31',
      startDate: p.start_date ? (p.start_date instanceof Date ? p.start_date.toISOString().split('T')[0] : String(p.start_date).split('T')[0]) : '2026-01-01',
      assignedWorkersCount: Number(p.assigned_workers_count || 0),
      assignedContractorIds: Array.isArray(p.assigned_contractor_ids) ? p.assigned_contractor_ids : [],
      tasksCount: Number(p.tasks_count || 0),
      milestonesCount: Number(p.milestones_count || 0),
      isPrivateAccounting: Boolean(p.is_private_accounting),
      assignedProjectManagerId: p.assigned_project_manager_id || '',
      assignedProjectManagerName: p.assigned_project_manager_name || '',
      latitude: p.latitude !== null && p.latitude !== undefined ? Number(p.latitude) : undefined,
      longitude: p.longitude !== null && p.longitude !== undefined ? Number(p.longitude) : undefined,
      weatherSuspended: Boolean(p.weather_suspended),
      createdAt: p.created_at ? (p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at)) : new Date().toISOString()
    };
    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/projects/:id/workers — Add or remove a worker from a project
projectsRouter.put('/projects/:id/workers', async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    const { workerId, action } = req.body;

    if (!workerId || !['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'workerId and action (add|remove) are required' });
    }

    const projResult = await pool.query(
      'SELECT assigned_contractor_ids, assigned_workers_count, name FROM commercial_projects WHERE id = $1',
      [projectId]
    );
    if (projResult.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const current: string[] = Array.isArray(projResult.rows[0].assigned_contractor_ids)
      ? projResult.rows[0].assigned_contractor_ids
      : [];
    const projectName: string = projResult.rows[0].name;

    let updated: string[];
    if (action === 'add') {
      updated = current.includes(workerId) ? current : [...current, workerId];
      // Remove worker from other commercial projects
      await pool.query(`
        UPDATE commercial_projects
        SET assigned_contractor_ids = array_remove(assigned_contractor_ids, $1)
        WHERE id != $2 AND $1 = ANY(assigned_contractor_ids)
      `, [workerId, projectId]);
    } else {
      updated = current.filter(id => id !== workerId);
    }

    await pool.query(
      'UPDATE commercial_projects SET assigned_contractor_ids = $1, assigned_workers_count = $2 WHERE id = $3',
      [updated, updated.length, projectId]
    );

    if (action === 'add') {
      await pool.query(
        'UPDATE contractors SET active_project_site = $1 WHERE id = $2',
        [projectName, workerId]
      );
      await pool.query(
        'UPDATE workers SET assigned_project_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [projectId, workerId]
      );
      await pool.query(
        'DELETE FROM project_worker_assignments WHERE worker_id = $1 AND project_id != $2',
        [workerId, projectId]
      );
      await pool.query(`
        INSERT INTO project_worker_assignments (id, project_id, worker_id, assigned_at, status)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'ACTIVE')
        ON CONFLICT (project_id, worker_id) DO UPDATE SET status = 'ACTIVE'
      `, [`PWA-${projectId}-${workerId}`, projectId, workerId]);
    } else {
      await pool.query(
        "UPDATE contractors SET active_project_site = NULL WHERE id = $1 AND active_project_site = $2",
        [workerId, projectName]
      );
      await pool.query(
        "UPDATE workers SET assigned_project_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND assigned_project_id = $2",
        [workerId, projectId]
      );
      await pool.query(
        'DELETE FROM project_worker_assignments WHERE worker_id = $1 AND project_id = $2',
        [workerId, projectId]
      );
    }

    broadcastChange('projects');
    broadcastChange('contractors');
    broadcastChange('workers');
    broadcastChange('attendance');
    res.json({ success: true, assignedContractorIds: updated, assignedWorkersCount: updated.length });
  } catch (error) {
    console.error('Error updating project workers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/projects/:id/weather-suspension
projectsRouter.patch('/projects/:id/weather-suspension', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { suspended, reason, actorName } = req.body;
    const isSuspended = Boolean(suspended);

    await pool.query(
      'UPDATE commercial_projects SET weather_suspended = $1 WHERE id = $2',
      [isSuspended, id]
    );

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CIVIL_WORKS',
        entityId: id,
        action: isSuspended ? 'WEATHER_SUSPENSION_ACTIVATED' : 'WEATHER_SUSPENSION_LIFTED',
        actorName: actorName || 'Engr. Ricardo Ramos',
        actorRole: 'PROJECT_MANAGER',
        details: isSuspended
          ? `Work Suspended due to Weather (Force Majeure): ${reason || 'Adverse weather on site'}. Timeline flagged for schedule delays.`
          : 'Weather suspension lifted. Regular site operations resumed.',
      }
    }).catch(() => {});

    broadcastChange('projects');
    broadcastChange('auditLogs');
    broadcastChange('siteLogs');
    res.json({ success: true, id, weatherSuspended: isSuspended });
  } catch (error) {
    console.error('Error toggling weather suspension:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/projects/:id (Safe cascade for tasks and links)
projectsRouter.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Clean up associated tasks safely
    const projectTasks = await prisma.projectTask.findMany({ where: { projectId: id }, select: { id: true } });
    const taskIds = projectTasks.map(t => t.id);
    if (taskIds.length > 0) {
      await prisma.taskLink.deleteMany({
        where: {
          OR: [
            { sourceId: { in: taskIds } },
            { targetId: { in: taskIds } }
          ]
        }
      }).catch(() => {});
    }
    await prisma.projectTask.deleteMany({ where: { projectId: id } }).catch(() => {});
    await pool.query('DELETE FROM commercial_projects WHERE id = $1', [id]);
    broadcastChange('projects');
    broadcastChange('tasks');
    invalidateAllDataCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// TASKS REST API
// ============================================================================

// GET /api/tasks-list
projectsRouter.get('/tasks-list', async (req: Request, res: Response) => {
  try {
    const dbTasks = await prisma.projectTask.findMany({ 
      include: { assignedContractor: true },
      orderBy: { createdAt: 'desc' } 
    });
    const tasks = dbTasks.map(t => {
      const p = typeof t.progress === 'number' ? t.progress : 0;
      let taskStatus = t.status || 'TODO';
      if (p >= 1.0) {
        taskStatus = 'COMPLETED';
      } else if (p > 0 && (taskStatus === 'TODO' || taskStatus === 'BACKLOG')) {
        taskStatus = 'IN_PROGRESS';
      }

      return {
        id: t.id,
        projectId: t.projectId,
        title: t.title || t.text,
        description: t.description || t.text,
        assigneeName: t.assigneeName || t.assignedContractor?.name || '',
        assigneeRole: t.assigneeRole || t.assignedContractor?.roleTitle || '',
        priority: t.priority || 'MEDIUM',
        status: taskStatus,
        progress: p,
        dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : (t.endDate ? t.endDate.toISOString().split('T')[0] : ''),
        startDate: t.startDate ? t.startDate.toISOString().split('T')[0] : '',
        estimatedHours: (t.duration || 1) * 8,
        actualHours: Math.round(p * 100),
        category: t.category || (t.type === 'milestone' ? 'QA' : 'CIVIL_WORKS'),
        milestonePhase: t.milestonePhase || t.wbsCode || '',
        subtasks: t.subtasksJson ? JSON.parse(t.subtasksJson) : [],
        tags: t.tags ? (typeof t.tags === 'string' ? t.tags.split(',') : t.tags) : [t.wbsCode || '', t.type || 'task'],
        createdAt: t.createdAt.toISOString(),
      };
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/tasks
projectsRouter.post('/tasks', async (req: Request, res: Response) => {
  const { title, text, projectId, assigneeName, duration, progress, startDate, endDate, category, wbsCode, priority, status, description, subtasks, tags, dueDate } = req.body;
  try {
    let targetProjectId = projectId;
    if (!targetProjectId) {
      const firstProj = await prisma.commercialProject.findFirst({ orderBy: { createdAt: 'asc' } });
      if (firstProj) {
        targetProjectId = firstProj.id;
      }
    }
    if (!targetProjectId) {
      return res.status(400).json({ error: 'Cannot create task: No active commercial project exists.' });
    }

    const proj = await prisma.commercialProject.findUnique({ where: { id: targetProjectId } });
    if (!proj) {
      return res.status(404).json({ error: `Project ${targetProjectId} not found.` });
    }

    const sDate = startDate ? new Date(startDate) : new Date();
    const dur = Number(duration) || 1;
    const eDate = endDate ? new Date(endDate) : new Date(sDate.getTime() + dur * 86400000);
    const dDate = dueDate ? new Date(dueDate) : eDate;
    const taskName = title || text || 'New Construction Task';

    const p = progress !== undefined ? Number(progress) : (status === 'COMPLETED' ? 1.0 : status === 'IN_PROGRESS' ? 0.5 : 0);
    const resolvedStatus = status || (p >= 1.0 ? 'COMPLETED' : p > 0 ? 'IN_PROGRESS' : 'TODO');

    const task = await prisma.projectTask.create({
      data: {
        projectId: targetProjectId,
        text: taskName,
        title: taskName,
        description: description || '',
        assigneeName: assigneeName || '',
        priority: priority || 'MEDIUM',
        status: resolvedStatus,
        category: category || 'CIVIL_WORKS',
        subtasksJson: subtasks ? JSON.stringify(subtasks) : '[]',
        tags: tags ? (Array.isArray(tags) ? tags.join(',') : String(tags)) : '',
        startDate: sDate,
        endDate: eDate,
        dueDate: dDate,
        duration: dur,
        progress: p,
        type: category === 'QA' ? 'milestone' : 'task',
        wbsCode: wbsCode || null
      }
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CIVIL_WORKS',
        entityId: task.id,
        action: 'TASK_CREATED',
        actorName: 'Mauro R. Principe Jr.',
        actorRole: 'ADMIN',
        details: `Created task "${task.text}" assigned to ${assigneeName || 'crew'}.`,
      }
    }).catch(() => {});

    broadcastChange('tasks');
    broadcastChange('auditLogs');
    res.json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/tasks/:id
projectsRouter.patch('/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, text, duration, progress, startDate, endDate, wbsCode, status, priority, description, assigneeName } = req.body;
  try {
    const data: any = {};
    if (text !== undefined || title !== undefined) {
      data.text = text || title;
      data.title = title || text;
    }
    if (description !== undefined) data.description = description;
    if (assigneeName !== undefined) data.assigneeName = assigneeName;
    if (priority !== undefined) data.priority = priority;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (duration !== undefined) data.duration = Number(duration);
    if (wbsCode !== undefined) data.wbsCode = wbsCode;

    if (progress !== undefined) {
      const p = Number(progress);
      data.progress = p;
      if (status === undefined) {
        if (p >= 1.0) data.status = 'COMPLETED';
        else if (p > 0) data.status = 'IN_PROGRESS';
        else data.status = 'TODO';
      }
    }
    if (status !== undefined) {
      data.status = status;
      if (progress === undefined) {
        if (status === 'COMPLETED') data.progress = 1.0;
        else if (status === 'IN_PROGRESS') data.progress = 0.5;
        else if (status === 'TODO' || status === 'BACKLOG') data.progress = 0.0;
      }
    }

    const task = await prisma.projectTask.update({
      where: { id },
      data,
    });

    if (task.projectId) {
      const allTasks = await prisma.projectTask.findMany({ where: { projectId: task.projectId } });
      if (allTasks.length > 0) {
        const milestones = allTasks.filter(t => t.type === 'milestone' || t.duration === 0);
        const items = milestones.length > 0 ? milestones : allTasks;
        const sumProgress = items.reduce((acc, curr) => {
          let p = curr.progress || 0;
          if (p > 0 && p <= 1) p = p * 100;
          return acc + p;
        }, 0);
        const avgProgress = Math.round(sumProgress / items.length);
        const existingProj = await prisma.commercialProject.findUnique({ where: { id: task.projectId } });
        const shouldAdvanceStatus = avgProgress > 0 && (!existingProj?.status || existingProj.status === 'PLANNING');
        await prisma.commercialProject.update({
          where: { id: task.projectId },
          data: {
            progressPercentage: avgProgress,
            tasksCount: allTasks.length,
            ...(shouldAdvanceStatus ? { status: 'IN_PROGRESS' } : {})
          }
        }).catch(() => {});
        broadcastChange('projects');
      }
    }

    broadcastChange('tasks');
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/tasks-clear-all
projectsRouter.delete('/tasks-clear-all', async (req: Request, res: Response) => {
  try {
    await prisma.taskLink.deleteMany({}).catch(() => {});
    await prisma.projectTask.deleteMany({});
    broadcastChange('tasks');
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing tasks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/tasks/:id
projectsRouter.delete('/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.taskLink.deleteMany({
      where: { OR: [{ sourceId: id }, { targetId: id }] }
    }).catch(() => {});
    await prisma.projectTask.delete({ where: { id } });
    broadcastChange('tasks');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// SCHEDULE EVENTS REST API
// ============================================================================

// GET /api/schedule
projectsRouter.get('/schedule', async (req: Request, res: Response) => {
  try {
    const dbEvents = await pool.query('SELECT * FROM schedule_events ORDER BY event_date ASC, start_time ASC');
    const scheduleEvents = (dbEvents.rows || []).map(e => ({
      id: e.id,
      projectId: e.project_id,
      projectName: e.project_name,
      title: e.title,
      eventType: e.event_type,
      eventDate: e.event_date ? (e.event_date instanceof Date ? e.event_date.toISOString().split('T')[0] : String(e.event_date).split('T')[0]) : new Date().toISOString().split('T')[0],
      startTime: e.start_time || '09:00',
      endTime: e.end_time || '10:00',
      location: e.location || 'Site Office',
      attendees: e.attendees || '',
      notes: e.notes || '',
      status: e.status || 'SCHEDULED',
      createdAt: e.created_at ? (e.created_at instanceof Date ? e.created_at.toISOString() : String(e.created_at)) : new Date().toISOString(),
    }));
    res.json(scheduleEvents);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/schedule
projectsRouter.post('/schedule', async (req: Request, res: Response) => {
  try {
    const {
      projectName,
      title,
      eventType,
      eventDate,
      startTime,
      endTime,
      location,
      attendees,
      notes
    } = req.body;

    if (!title || !eventDate) {
      return res.status(400).json({ error: 'Missing title or eventDate' });
    }

    const id = `EVT-${Date.now().toString().slice(-6)}`;
    await pool.query(
      `INSERT INTO schedule_events 
       (id, project_name, title, event_type, event_date, start_time, end_time, location, attendees, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SCHEDULED')`,
      [
        id,
        projectName || 'Master Schedule',
        title,
        eventType || 'MEETING',
        eventDate,
        startTime || '09:00',
        endTime || '10:00',
        location || 'Site Office',
        attendees || '',
        notes || ''
      ]
    );

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CIVIL_WORKS',
        entityId: id,
        action: 'SCHEDULE_EVENT_CREATED',
        actorName: 'Project Planner',
        actorRole: 'ADMIN',
        details: `Scheduled [${eventType || 'MEETING'}] "${title}" for ${eventDate} (${projectName || 'Master Schedule'})`,
      }
    }).catch(() => {});

    broadcastChange('schedule');
    broadcastChange('auditLogs');
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error creating schedule event:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/schedule/:id
projectsRouter.patch('/schedule/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, eventDate, startTime, endTime, notes } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (eventDate !== undefined) { updates.push(`event_date = $${idx++}`); values.push(eventDate); }
    if (startTime !== undefined) { updates.push(`start_time = $${idx++}`); values.push(startTime); }
    if (endTime !== undefined) { updates.push(`end_time = $${idx++}`); values.push(endTime); }
    if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes); }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE schedule_events SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    }

    broadcastChange('schedule');
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error updating schedule event:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/schedule/:id
projectsRouter.delete('/schedule/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM schedule_events WHERE id = $1', [id]);
    broadcastChange('schedule');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule event:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// RISKS REST API
// ============================================================================

// POST /api/risks
projectsRouter.post('/risks', async (req: Request, res: Response) => {
  const { title, category, likelihood, impact, mitigationPlan, status, ownerName } = req.body;
  try {
    const score = (Number(likelihood) || 3) * (Number(impact) || 3);
    const risk = await prisma.projectRisk.create({
      data: {
        title,
        category: category || 'WEATHER',
        likelihood: Number(likelihood) || 3,
        impact: Number(impact) || 3,
        riskScore: score,
        mitigationPlan: mitigationPlan || '',
        status: status || 'OPEN',
        ownerName: ownerName || 'Engr. Ricardo Gomez',
      }
    });
    broadcastChange('risks');
    res.json(risk);
  } catch (error) {
    console.error('Error creating risk:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/risks/:id
projectsRouter.patch('/risks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, mitigationPlan } = req.body;
  try {
    const data: any = {};
    if (status) data.status = status;
    if (mitigationPlan) data.mitigationPlan = mitigationPlan;
    const risk = await prisma.projectRisk.update({ where: { id }, data });
    broadcastChange('risks');
    res.json(risk);
  } catch (error) {
    console.error('Error updating risk:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
