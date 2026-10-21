/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { prisma, pool } from '../db';
import { broadcastChange, invalidateAllDataCache } from '../events';
import { resolveProjectCoordinates, resolveLocalGeocoding } from '../services/geocoding';
import { requireAuth, requireRole, checkUserProjectAccess } from '../middleware/auth';

export const projectsRouter = Router();

// Apply base authentication on all project management endpoints
projectsRouter.use((req: Request, res: Response, next) => {
  const projectPaths = ['/projects', '/tasks', '/geocoding', '/risks', '/tasks-list'];
  const matches = projectPaths.some(p => req.path === p || req.path.startsWith(`${p}/`));
  if (matches) {
    return requireAuth(req, res, next);
  }
  return next();
});

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

// GET /api/projects — Scoped to authorized projects for non-admin/finance users
projectsRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const selectProjectsSql = `
      SELECT 
        p.*,
        COALESCE(
          (
            SELECT ROUND(
              SUM(
                (CASE 
                  WHEN t.status = 'COMPLETED' OR t.progress >= 1.0 THEN 100.0 
                  WHEN t.progress > 0 AND t.progress <= 1.0 THEN t.progress * 100.0 
                  ELSE COALESCE(t.progress, 0.0) 
                END) * GREATEST(COALESCE(t.duration, 1), 1)
              ) 
              / NULLIF(SUM(GREATEST(COALESCE(t.duration, 1), 1)), 0)
            )
            FROM project_tasks t 
            WHERE t."projectId" = p.id
          ), 
          p.progress_percentage, 
          0
        ) AS progress,
        COALESCE(
          (
            SELECT ROUND(
              SUM(
                (CASE 
                  WHEN t.status = 'COMPLETED' OR t.progress >= 1.0 THEN 100.0 
                  WHEN t.progress > 0 AND t.progress <= 1.0 THEN t.progress * 100.0 
                  ELSE COALESCE(t.progress, 0.0) 
                END) * GREATEST(COALESCE(t.duration, 1), 1)
              ) 
              / NULLIF(SUM(GREATEST(COALESCE(t.duration, 1), 1)), 0)
            )
            FROM project_tasks t 
            WHERE t."projectId" = p.id
          ), 
          p.progress_percentage, 
          0
        ) AS "cpmProgress"
      FROM commercial_projects p
    `;
    let dbProjectsQuery = `${selectProjectsSql} ORDER BY p.created_at ASC`;
    const params: any[] = [];
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'FINANCE') {
      if (!req.user.projectIds || req.user.projectIds.length === 0) {
        return res.json([]);
      }
      dbProjectsQuery = `${selectProjectsSql} WHERE p.id = ANY($1) ORDER BY p.created_at ASC`;
      params.push(req.user.projectIds);
    }
    // Pre-aggregate labor expenses from finalized or paid payroll runs (distinguishing paid vs approved)
    const laborRes = await pool.query(
      `SELECT 
         project_id, 
         COALESCE(SUM(CASE WHEN UPPER(TRIM(status)) IN ('LOCKED & ARCHIVED', 'FINALIZED', 'ARCHIVED', 'PAID', 'DISBURSED') THEN COALESCE(total_net, total_gross) ELSE 0 END), 0) as paid_labor,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(status)) IN ('APPROVED', 'PENDING') THEN COALESCE(total_net, total_gross) ELSE 0 END), 0) as approved_labor,
         COALESCE(SUM(COALESCE(total_net, total_gross)), 0) as total_labor
       FROM payroll_runs 
       WHERE UPPER(TRIM(status)) IN ('LOCKED & ARCHIVED', 'FINALIZED', 'ARCHIVED', 'PAID', 'DISBURSED', 'APPROVED', 'PENDING') 
       GROUP BY project_id`
    ).catch(() => ({ rows: [] }));
    const laborMap = new Map<string, { paid: number; approved: number; total: number }>();
    for (const r of laborRes.rows) {
      laborMap.set(String(r.project_id).trim(), {
        paid: Number(r.paid_labor || 0),
        approved: Number(r.approved_labor || 0),
        total: Number(r.total_labor || 0)
      });
    }

    // Pre-aggregate subcontractor payables from approved or paid contractor billings (distinguishing paid vs approved)
    const subRes = await pool.query(
      `SELECT 
         project_site, 
         COALESCE(SUM(CASE WHEN UPPER(TRIM(status)) IN ('PAID', 'DISBURSED', 'PAID / DISBURSED') THEN COALESCE(disbursed_amount, approved_amount, billed_amount) ELSE 0 END), 0) as paid_sub,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(status)) IN ('APPROVED', 'PENDING', 'PENDING_APPROVAL') THEN COALESCE(approved_amount, billed_amount) ELSE 0 END), 0) as approved_sub,
         COALESCE(SUM(COALESCE(disbursed_amount, approved_amount, billed_amount)), 0) as total_sub
       FROM subcontractor_payables 
       WHERE UPPER(TRIM(status)) IN ('PAID', 'DISBURSED', 'PAID / DISBURSED', 'APPROVED', 'PENDING', 'PENDING_APPROVAL') 
       GROUP BY project_site`
    ).catch(() => ({ rows: [] }));
    const subMap = new Map<string, { paid: number; approved: number; total: number }>();
    for (const r of subRes.rows) {
      subMap.set(String(r.project_site).trim(), {
        paid: Number(r.paid_sub || 0),
        approved: Number(r.approved_sub || 0),
        total: Number(r.total_sub || 0)
      });
    }

    const findMatchingEntry = (map: Map<string, { paid: number; approved: number; total: number }>, p: { id: string; name?: string }) => {
      const pIdLower = (p.id || '').trim().toLowerCase();
      const pNameLower = (p.name || '').trim().toLowerCase();
      const pIdDigits = pIdLower.replace(/[^0-9]/g, '');

      // 1. Direct key matches
      for (const [key, val] of map.entries()) {
        const kLower = key.trim().toLowerCase();
        if (kLower === pIdLower || kLower === pNameLower) return val;
      }
      // 2. Digits code matches (e.g. 4127 matches PRJ-4127 / PAY-4127)
      if (pIdDigits) {
        for (const [key, val] of map.entries()) {
          const kDigits = key.trim().toLowerCase().replace(/[^0-9]/g, '');
          if (kDigits && kDigits === pIdDigits) return val;
        }
      }
      // 3. Substring site name match
      if (pNameLower) {
        for (const [key, val] of map.entries()) {
          const kLower = key.trim().toLowerCase();
          if (kLower && (pNameLower.includes(kLower) || kLower.includes(pNameLower))) return val;
        }
      }
      return { paid: 0, approved: 0, total: 0 };
    };

    const dbProjects = await pool.query(dbProjectsQuery, params);
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

      const laborInfo = findMatchingEntry(laborMap, p);
      const subInfo = findMatchingEntry(subMap, p);
      const paidExp = Number((laborInfo.paid + subInfo.paid).toFixed(2));
      const approvedExp = Number((laborInfo.approved + subInfo.approved).toFixed(2));
      const totalExp = Number((laborInfo.total + subInfo.total).toFixed(2));

        const computedProgress = Number(p.cpmProgress ?? p.progress ?? p.progress_percentage ?? 0);
        const resolvedStatus = (computedProgress > 0 && (p.status === 'PLANNING' || !p.status)) ? 'IN_PROGRESS' : (p.status || 'IN_PROGRESS');

        return {
          id: p.id,
          name: p.name,
          clientName: p.client_name || '',
          description: p.description || '',
          location: p.location || '',
          budget: Number(p.budget || 0),
          fundsCollected: Number(p.funds_collected || 0),
          laborExpenses: laborInfo.total,
          paidLaborExpenses: laborInfo.paid,
          approvedLaborExpenses: laborInfo.approved,
          subcontractorExpenses: subInfo.total,
          paidSubcontractorExpenses: subInfo.paid,
          approvedSubcontractorExpenses: subInfo.approved,
          paidExpenses: paidExp,
          approvedExpenses: approvedExp,
          totalExpenses: totalExp,
          progressPercentage: computedProgress,
          cpmProgress: computedProgress,
          overallProgress: computedProgress,
          progress: computedProgress,
          status: resolvedStatus,
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
projectsRouter.post('/projects', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
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

    // If created by an Engineer / Project Manager, automatically assign creator to the project
    if (req.user && req.user.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          projectIds: { push: id }
        }
      }).catch(err => console.warn('Could not auto-assign project to creator:', err));
      if (!req.user.projectIds) req.user.projectIds = [];
      if (!req.user.projectIds.includes(id)) req.user.projectIds.push(id);
    }

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

// PATCH /api/projects/:id — Restricted to ADMIN and ENGINEER
projectsRouter.patch('/projects/:id', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!checkUserProjectAccess(req.user, id)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }
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
    // Note: progress_percentage is strictly driven by CPM Gantt task completion and locked from manual modification
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

    // Query updated project with computed CPM progress and live ledger disbursements
    const pRes = await pool.query(`
      SELECT 
        p.*,
        COALESCE(
          (
            SELECT ROUND(
              SUM(
                (CASE 
                  WHEN t.status = 'COMPLETED' OR t.progress >= 1.0 THEN 100.0 
                  WHEN t.progress > 0 AND t.progress <= 1.0 THEN t.progress * 100.0 
                  ELSE COALESCE(t.progress, 0.0) 
                END) * GREATEST(COALESCE(t.duration, 1), 1)
              ) 
              / NULLIF(SUM(GREATEST(COALESCE(t.duration, 1), 1)), 0)
            )
            FROM project_tasks t 
            WHERE t."projectId" = p.id
          ), 
          p.progress_percentage, 
          0
        ) AS cpm_progress
      FROM commercial_projects p
      WHERE p.id = $1
    `, [id]);
    const p = pRes.rows[0] || {};

    // Get live actual labor & subcontractor paid expenses
    const laborRes = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN UPPER(TRIM(status)) IN ('LOCKED & ARCHIVED', 'FINALIZED', 'ARCHIVED', 'PAID', 'DISBURSED') THEN COALESCE(total_net, total_gross) ELSE 0 END), 0) as paid_labor,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(status)) IN ('APPROVED', 'PENDING') THEN COALESCE(total_net, total_gross) ELSE 0 END), 0) as approved_labor,
         COALESCE(SUM(COALESCE(total_net, total_gross)), 0) as total_labor
       FROM payroll_runs 
       WHERE (project_id = $1 OR project_id ILIKE '%' || $2 || '%')
         AND UPPER(TRIM(status)) IN ('LOCKED & ARCHIVED', 'FINALIZED', 'ARCHIVED', 'PAID', 'DISBURSED', 'APPROVED', 'PENDING')`,
      [id, id.replace(/[^0-9]/g, '') || id]
    ).catch(() => ({ rows: [] }));
    const lRow = laborRes.rows[0] || {};
    const paidLabor = Number(lRow.paid_labor || 0);
    const approvedLabor = Number(lRow.approved_labor || 0);
    const totalLabor = Number(lRow.total_labor || 0);

    const subRes = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN UPPER(TRIM(status)) IN ('PAID', 'DISBURSED', 'PAID / DISBURSED') THEN COALESCE(disbursed_amount, approved_amount, billed_amount) ELSE 0 END), 0) as paid_sub,
         COALESCE(SUM(CASE WHEN UPPER(TRIM(status)) IN ('APPROVED', 'PENDING', 'PENDING_APPROVAL') THEN COALESCE(approved_amount, billed_amount) ELSE 0 END), 0) as approved_sub,
         COALESCE(SUM(COALESCE(disbursed_amount, approved_amount, billed_amount)), 0) as total_sub
       FROM subcontractor_payables 
       WHERE (LOWER(TRIM(project_site)) = LOWER(TRIM($1)) OR LOWER(TRIM(project_site)) = LOWER(TRIM($2)) OR project_site ILIKE '%' || $1 || '%')
         AND UPPER(TRIM(status)) IN ('PAID', 'DISBURSED', 'PAID / DISBURSED', 'APPROVED', 'PENDING', 'PENDING_APPROVAL')`,
      [p.name || '', id]
    ).catch(() => ({ rows: [] }));
    const sRow = subRes.rows[0] || {};
    const paidSub = Number(sRow.paid_sub || 0);
    const approvedSub = Number(sRow.approved_sub || 0);
    const totalSub = Number(sRow.total_sub || 0);

    const paidExp = Number((paidLabor + paidSub).toFixed(2));
    const approvedExp = Number((approvedLabor + approvedSub).toFixed(2));
    const totalExp = Number((totalLabor + totalSub).toFixed(2));

    const computedProgress = Number(p.cpm_progress ?? p.progress_percentage ?? 0);
    const updatedProject = {
      id: p.id || id,
      name: p.name || '',
      clientName: p.client_name || '',
      description: p.description || '',
      location: p.location || '',
      budget: Number(p.budget || 0),
      fundsCollected: Number(p.funds_collected || 0),
      laborExpenses: totalLabor,
      paidLaborExpenses: paidLabor,
      approvedLaborExpenses: approvedLabor,
      subcontractorExpenses: totalSub,
      paidSubcontractorExpenses: paidSub,
      approvedSubcontractorExpenses: approvedSub,
      paidExpenses: paidExp,
      approvedExpenses: approvedExp,
      totalExpenses: totalExp,
      progressPercentage: computedProgress,
      cpmProgress: computedProgress,
      overallProgress: computedProgress,
      progress: computedProgress,
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

// PUT /api/projects/:id/workers — Add or remove a worker from a project (ADMIN and ENGINEER)
projectsRouter.put('/projects/:id/workers', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const { id: projectId } = req.params;
    if (!checkUserProjectAccess(req.user, projectId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }
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

// PATCH /api/projects/:id/weather-suspension (ADMIN and ENGINEER)
projectsRouter.patch('/projects/:id/weather-suspension', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!checkUserProjectAccess(req.user, id)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
    }
    const { suspended, reason } = req.body;
    const isSuspended = Boolean(suspended);

    await pool.query(
      'UPDATE commercial_projects SET weather_suspended = $1 WHERE id = $2',
      [isSuspended, id]
    );

    // Halt active CPM tasks when Force Majeure is declared
    if (isSuspended) {
      await prisma.projectTask.updateMany({
        where: { projectId: id, status: 'IN_PROGRESS' },
        data: { status: 'BLOCKED' }
      });
      broadcastChange('tasks');
    }

    const actorId = req.user?.id || 'usr-pm';
    const actorRole = req.user?.role || 'ENGINEER';
    const actorName = req.user?.name || 'Project Manager';
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const nowIso = new Date().toISOString();

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CIVIL_WORKS',
        entityId: id,
        action: isSuspended ? 'WEATHER_SUSPENSION_ACTIVATED' : 'WEATHER_SUSPENSION_LIFTED',
        actorName,
        actorRole,
        details: isSuspended
          ? `Work Suspended due to Weather (Force Majeure): ${reason || 'Adverse weather on site'}. Timeline flagged for schedule delays. Active CPM tasks halted to BLOCKED status. [User: ${actorId}, Role: ${actorRole}, IP: ${clientIp}, Timestamp: ${nowIso}]`
          : `Weather suspension lifted. Regular site operations resumed. [User: ${actorId}, Role: ${actorRole}, IP: ${clientIp}, Timestamp: ${nowIso}]`,
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

// DELETE /api/projects/:id (Safe cascade for tasks and links - ADMIN only)
projectsRouter.delete('/projects/:id', requireRole(['ADMIN']), async (req: Request, res: Response) => {
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

// GET /api/tasks-list — Scoped to authorized projects for non-admin/finance
projectsRouter.get('/tasks-list', async (req: Request, res: Response) => {
  try {
    let whereClause: any = {};
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'FINANCE') {
      if (!req.user.projectIds || req.user.projectIds.length === 0) {
        return res.json([]);
      }
      whereClause.projectId = { in: req.user.projectIds };
    }

    const dbTasks = await prisma.projectTask.findMany({ 
      where: whereClause,
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
        duration: typeof t.duration === 'number' ? t.duration : (Number(t.duration) || 0),
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

// POST /api/tasks — Restricted to ADMIN and ENGINEER
projectsRouter.post('/tasks', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
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

    if (!checkUserProjectAccess(req.user, targetProjectId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project.' });
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

    // Recalculate summary metrics for parent commercial project
    if (task.projectId) {
      const allTasks = await prisma.projectTask.findMany({ where: { projectId: task.projectId } });
      let avgProgress = 0;
      if (allTasks.length > 0) {
        const milestones = allTasks.filter(t => t.type === 'milestone' || t.duration === 0);
        const items = milestones.length > 0 ? milestones : allTasks;
        const sumProgress = items.reduce((acc, curr) => {
          let p = curr.progress || 0;
          if (p > 0 && p <= 1) p = p * 100;
          return acc + p;
        }, 0);
        avgProgress = Math.round(sumProgress / items.length);
      }
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

    broadcastChange('tasks');
    broadcastChange('auditLogs');
    res.json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PATCH /api/tasks/:id — Restricted to ADMIN and ENGINEER
projectsRouter.patch('/tasks/:id', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, text, duration, progress, startDate, endDate, wbsCode, status, priority, description, assigneeName } = req.body;
  try {
    const existingTask = await prisma.projectTask.findUnique({ where: { id } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!checkUserProjectAccess(req.user, existingTask.projectId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project task.' });
    }

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
      data.progress = Math.max(0, Math.min(1, Number(progress)));
    }
    if (status !== undefined) {
      data.status = status;
    }

    // Bidirectionally reconcile status and progress
    if (data.status === 'COMPLETED' && (data.progress === undefined || data.progress < 1.0)) {
      data.progress = 1.0;
    } else if (data.progress !== undefined && data.progress >= 1.0) {
      data.status = 'COMPLETED';
    } else if (data.progress !== undefined && data.progress < 1.0 && data.status === 'COMPLETED') {
      data.status = data.progress > 0 ? 'IN_PROGRESS' : 'TODO';
    } else if (data.status === undefined && data.progress !== undefined) {
      data.status = data.progress > 0 ? 'IN_PROGRESS' : 'TODO';
    } else if (data.progress === undefined && data.status !== undefined) {
      if (data.status === 'IN_PROGRESS') data.progress = 0.5;
      else if (data.status === 'TODO' || data.status === 'BACKLOG') data.progress = 0.0;
    }

    const task = await prisma.projectTask.update({
      where: { id },
      data,
    });

    if (task.projectId) {
      const allTasks = await prisma.projectTask.findMany({ where: { projectId: task.projectId } });
      if (allTasks.length > 0) {
        const totalDuration = allTasks.reduce((acc, curr) => acc + Math.max(1, curr.duration || 1), 0);
        const weightedProgress = allTasks.reduce((acc, curr) => {
          let p = 0;
          if (curr.status === 'COMPLETED' || (typeof curr.progress === 'number' && curr.progress >= 1.0)) {
            p = 1.0;
          } else {
            const raw = typeof curr.progress === 'number' ? curr.progress : 0;
            p = raw > 1.0 ? raw / 100 : raw;
          }
          return acc + (p * Math.max(1, curr.duration || 1));
        }, 0);
        const avgProgress = totalDuration > 0 ? Math.round((weightedProgress / totalDuration) * 100) : 0;
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

      if (data.status === 'COMPLETED' || (data.progress !== undefined && Number(data.progress) >= 1.0)) {
        const actorId = req.user?.id || 'usr-pm';
        const actorRole = req.user?.role || 'ENGINEER';
        const actorName = req.user?.name || 'Project Manager';
        const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
        const nowIso = new Date().toISOString();

        await prisma.processAuditLog.create({
          data: {
            entityType: 'CIVIL_WORKS',
            entityId: task.id,
            action: 'MILESTONE_COMPLETED',
            actorName,
            actorRole,
            details: `Task/Milestone "${task.text || task.title}" marked COMPLETED on project ${task.projectId}. [User: ${actorId}, Role: ${actorRole}, IP: ${clientIp}, Timestamp: ${nowIso}]`,
          }
        }).catch(() => {});
        broadcastChange('auditLogs');
      }
    }

    broadcastChange('tasks');
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/tasks-clear-all (ADMIN only)
projectsRouter.delete('/tasks-clear-all', requireRole(['ADMIN']), async (req: Request, res: Response) => {
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

// DELETE /api/tasks/:id — Restricted to ADMIN and ENGINEER
projectsRouter.delete('/tasks/:id', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existingTask = await prisma.projectTask.findUnique({ where: { id } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!checkUserProjectAccess(req.user, existingTask.projectId)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this project task.' });
    }

    const targetProjId = existingTask.projectId;
    await prisma.taskLink.deleteMany({
      where: { OR: [{ sourceId: id }, { targetId: id }] }
    }).catch(() => {});
    await prisma.projectTask.delete({ where: { id } });

    // Recalculate summary metrics for parent commercial project on task deletion
    if (targetProjId) {
      const allTasks = await prisma.projectTask.findMany({ where: { projectId: targetProjId } });
      let avgProgress = 0;
      if (allTasks.length > 0) {
        const milestones = allTasks.filter(t => t.type === 'milestone' || t.duration === 0);
        const items = milestones.length > 0 ? milestones : allTasks;
        const sumProgress = items.reduce((acc, curr) => {
          let p = curr.progress || 0;
          if (p > 0 && p <= 1) p = p * 100;
          return acc + p;
        }, 0);
        avgProgress = Math.round(sumProgress / items.length);
      }
      await prisma.commercialProject.update({
        where: { id: targetProjId },
        data: {
          progressPercentage: avgProgress,
          tasksCount: allTasks.length
        }
      }).catch(() => {});
      broadcastChange('projects');
    }

    broadcastChange('tasks');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// SCHEDULE & UNIFIED CALENDAR EVENTS REST API
// ============================================================================

// GET /api/calendar/events — Aggregates live dates across:
// 1. Manual / Coordination Events (schedule_events)
// 2. Master CPM Gantt & Milestones (project_tasks)
// 3. Milestone Billing Due Dates (installment_ledgers)
// 4. Project Target Handovers (commercial_projects)
// 5. Government Permits & Clearances (government_permits)
projectsRouter.get(['/calendar/events', '/projects/calendar/events'], async (req: Request, res: Response) => {
  try {
    const rawProjectId = (req.query.projectId as string || '').trim();
    const isAll = !rawProjectId || rawProjectId === 'ALL';

    // Resolve target project ID and name if a specific filter is provided
    let targetProjId = rawProjectId;
    let targetProjName = rawProjectId;

    if (!isAll) {
      const pMatch = await pool.query(
        'SELECT id, name FROM commercial_projects WHERE id = $1 OR LOWER(name) = LOWER($1) OR name ILIKE $2 LIMIT 1',
        [rawProjectId, `%${rawProjectId}%`]
      );
      if (pMatch.rows.length > 0) {
        targetProjId = pMatch.rows[0].id;
        targetProjName = pMatch.rows[0].name;
      }
    }

    // 1. Manual / Coordination Events
    let scheduleSql = 'SELECT * FROM schedule_events';
    const scheduleParams: any[] = [];
    if (!isAll) {
      scheduleSql += ' WHERE project_id = $1 OR project_id = $2 OR project_name ILIKE $1 OR project_name ILIKE $2 OR project_name ILIKE $3';
      scheduleParams.push(targetProjId, targetProjName, `%${targetProjName}%`);
    }
    scheduleSql += ' ORDER BY event_date ASC, start_time ASC';

    const scheduleRes = await pool.query(scheduleSql, scheduleParams);
    const manualEvents = (scheduleRes.rows || []).map((e: any) => {
      const dateStr = e.event_date ? (e.event_date instanceof Date ? e.event_date.toISOString().split('T')[0] : String(e.event_date).split('T')[0]) : new Date().toISOString().split('T')[0];
      const rawType = (e.event_type || 'MEETING').toUpperCase();
      let normType: 'Meeting' | 'Inspection' | 'Milestone' | 'Deadline' = 'Meeting';
      if (rawType === 'INSPECTION') normType = 'Inspection';
      else if (rawType === 'MILESTONE') normType = 'Milestone';
      else if (rawType === 'DEADLINE') normType = 'Deadline';

      return {
        id: e.id,
        title: e.title || 'Coordination Meeting',
        date: dateStr,
        type: normType,
        eventType: normType.toUpperCase(),
        eventDate: dateStr,
        projectId: e.project_id || '',
        projectName: e.project_name || 'Master Operations',
        source: 'Manual / Coordination',
        startTime: e.start_time || '09:00',
        endTime: e.end_time || '10:00',
        location: e.location || 'Site Office',
        attendees: e.attendees || '',
        notes: e.notes || '',
        status: e.status || 'SCHEDULED'
      };
    });

    // 2. Master CPM Gantt & Milestones
    let taskSql = `
      SELECT t.id, t.text, t.title, t.status, t.type, t."startDate", t."endDate", t."dueDate", t.duration, t.progress, t."milestonePhase", t.category,
             p.id as project_id, p.name as project_name, p.location as project_location
      FROM project_tasks t
      LEFT JOIN commercial_projects p ON t."projectId" = p.id
      WHERE (t."endDate" IS NOT NULL OR t."dueDate" IS NOT NULL OR t."startDate" IS NOT NULL)
    `;
    const taskParams: any[] = [];
    if (!isAll) {
      taskSql += ` AND (t."projectId" = $1 OR t."projectId" = $2 OR p.name ILIKE $1 OR p.name ILIKE $2 OR p.name ILIKE $3)`;
      taskParams.push(targetProjId, targetProjName, `%${targetProjName}%`);
    }
    taskSql += ` ORDER BY COALESCE(t."endDate", t."dueDate", t."startDate") ASC`;

    const tasksRes = await pool.query(taskSql, taskParams);
    const cpmEvents = (tasksRes.rows || []).map((t: any) => {
      const rawDate = t.endDate || t.dueDate || t.startDate;
      const dateStr = rawDate instanceof Date ? rawDate.toISOString().split('T')[0] : String(rawDate).split('T')[0];
      const isCompleted = t.status === 'COMPLETED' || (t.progress !== null && Number(t.progress) >= 1.0);
      const text = (t.text || t.title || 'CPM Milestone').trim();
      const textLower = text.toLowerCase();

      let normType: 'Milestone' | 'Inspection' = 'Milestone';
      if (textLower.includes('inspect') || textLower.includes('testing') || textLower.includes('qa') || textLower.includes('audit')) {
        normType = 'Inspection';
      } else {
        normType = 'Milestone';
      }

      return {
        id: `cpm-${t.id}`,
        title: text,
        date: dateStr,
        type: normType,
        eventType: normType.toUpperCase(),
        eventDate: dateStr,
        projectId: t.project_id || '',
        projectName: t.project_name || 'Commercial Site',
        source: 'Master CPM Gantt',
        startTime: '08:00',
        endTime: '17:00',
        location: t.project_location || 'Jobsite',
        attendees: 'Site Engineer & Artisan Trades',
        notes: `Phase: ${t.milestonePhase || 'Field Execution'}. Progress: ${Math.round((Number(t.progress) || 0) * 100)}%. Duration: ${t.duration || 1} day(s).`,
        status: isCompleted ? 'COMPLETED' : 'SCHEDULED'
      };
    });

    // 3. Milestone Billing Due Dates
    let billingSql = `
      SELECT il.id, il."dueDate", il."amountDue", il.status,
             cp."packageType", u.name as client_name,
             p.id as project_id, p.name as project_name
      FROM installment_ledgers il
      JOIN client_packages cp ON il."clientPackageId" = cp.id
      JOIN users u ON cp."userId" = u.id
      LEFT JOIN commercial_projects p ON (cp."packageType" ILIKE p.name OR cp."packageType" ILIKE CONCAT('%', p.name, '%'))
      WHERE il.status != 'PAID' AND il."dueDate" IS NOT NULL
    `;
    const billingParams: any[] = [];
    if (!isAll) {
      billingSql += ` AND (p.id = $1 OR p.name ILIKE $1 OR cp."packageType" ILIKE $1 OR cp."packageType" ILIKE $2 OR cp."packageType" ILIKE $3)`;
      billingParams.push(targetProjId, targetProjName, `%${targetProjName}%`);
    }
    billingSql += ` ORDER BY il."dueDate" ASC`;

    const billingsRes = await pool.query(billingSql, billingParams);
    const billingEvents = (billingsRes.rows || []).map((b: any) => {
      const dateStr = b.dueDate instanceof Date ? b.dueDate.toISOString().split('T')[0] : String(b.dueDate).split('T')[0];
      const amountStr = Number(b.amountDue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return {
        id: `billing-${b.id}`,
        title: `Billing Due: ${b.client_name || 'Client'} (₱${amountStr})`,
        date: dateStr,
        type: 'Deadline' as const,
        eventType: 'DEADLINE',
        eventDate: dateStr,
        projectId: b.project_id || '',
        projectName: b.project_name || b.packageType || 'Commercial Fit-Out',
        source: 'Milestone Billing',
        startTime: '10:00',
        endTime: '17:00',
        location: 'Finance Treasury Desk',
        attendees: `${b.client_name || 'Client'}, Finance Officer`,
        notes: `Milestone installment receivable of ₱${amountStr}. Payment requires verified deposit slip / wire confirmation.`,
        status: 'SCHEDULED'
      };
    });

    // 4. Project Target Handovers
    let handoverSql = `
      SELECT id, name, target_handover_date, client_name, location, budget, status
      FROM commercial_projects
      WHERE target_handover_date IS NOT NULL
    `;
    const handoverParams: any[] = [];
    if (!isAll) {
      handoverSql += ` AND (id = $1 OR id = $2 OR name ILIKE $1 OR name ILIKE $2 OR name ILIKE $3)`;
      handoverParams.push(targetProjId, targetProjName, `%${targetProjName}%`);
    }
    handoverSql += ` ORDER BY target_handover_date ASC`;

    const handoversRes = await pool.query(handoverSql, handoverParams);
    const handoverEvents = (handoversRes.rows || []).map((h: any) => {
      const dateStr = h.target_handover_date instanceof Date ? h.target_handover_date.toISOString().split('T')[0] : String(h.target_handover_date).split('T')[0];
      return {
        id: `handover-${h.id}`,
        title: `Project Handover: ${h.name}`,
        date: dateStr,
        type: 'Milestone' as const,
        eventType: 'MILESTONE',
        eventDate: dateStr,
        projectId: h.id,
        projectName: h.name,
        source: 'Project Handover',
        startTime: '10:00',
        endTime: '16:00',
        location: h.location || 'Site Office',
        attendees: `${h.client_name || 'Client'}, Project Manager, Operations Director`,
        notes: `Contractual turnover and handover completion for ${h.name}. Contract Price: ₱${Number(h.budget || 0).toLocaleString()}.`,
        status: h.status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED'
      };
    });

    // 5. Government Permits & Clearances
    let permitSql = `
      SELECT id, project_id, project_name, permit_name, permit_type, issuing_agency, reference_no, expiry_date, status, notes
      FROM government_permits
      WHERE expiry_date IS NOT NULL
    `;
    const permitParams: any[] = [];
    if (!isAll) {
      permitSql += ` AND (project_id = $1 OR project_id = $2 OR project_name ILIKE $1 OR project_name ILIKE $2 OR project_name ILIKE $3)`;
      permitParams.push(targetProjId, targetProjName, `%${targetProjName}%`);
    }
    permitSql += ` ORDER BY expiry_date ASC`;

    const permitsRes = await pool.query(permitSql, permitParams);
    const permitEvents = (permitsRes.rows || []).map((pm: any) => {
      const dateStr = pm.expiry_date instanceof Date ? pm.expiry_date.toISOString().split('T')[0] : String(pm.expiry_date).split('T')[0];
      return {
        id: `permit-${pm.id}`,
        title: `Permit Expiry: ${pm.permit_name || pm.permit_type} (${pm.reference_no || pm.id})`,
        date: dateStr,
        type: 'Deadline' as const,
        eventType: 'DEADLINE',
        eventDate: dateStr,
        projectId: pm.project_id || '',
        projectName: pm.project_name || 'Commercial Site',
        source: 'Statutory Permit',
        startTime: '09:00',
        endTime: '17:00',
        location: pm.issuing_agency || 'City Hall / PEZA Office',
        attendees: 'Compliance Officer, Site PM',
        notes: `Statutory permit renewal deadline for ${pm.permit_name} (${pm.permit_type}). Agency: ${pm.issuing_agency}. Status: ${pm.status}.`,
        status: pm.status === 'EXPIRED' ? 'CANCELLED' : 'SCHEDULED'
      };
    });

    // Merge all 5 sources and sort by date ascending
    const allAggregatedEvents = [
      ...manualEvents,
      ...cpmEvents,
      ...billingEvents,
      ...handoverEvents,
      ...permitEvents
    ].sort((a, b) => a.date.localeCompare(b.date));

    res.json(allAggregatedEvents);
  } catch (error) {
    console.error('Error aggregating calendar events:', error);
    res.status(500).json({ error: 'Internal Server Error fetching calendar events' });
  }
});

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
