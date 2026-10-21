/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { prisma, pool } from '../db';
import { authenticateRequest, requireRole, requireExactRole, checkUserProjectAccess } from '../middleware/auth';
import { broadcastChange } from '../events';
import { computeDefaultHourlyOtRate } from '../services/payrollCalculation';

export const workersRouter = Router();

// Apply base authentication on all workers routes
workersRouter.use(authenticateRequest);

// ============================================================================
// GET /api/workers — List all workers in labor masterlist
// Allowed: ADMIN, ENGINEER, TIMEKEEPER, FINANCE, and authenticated operations users
// ============================================================================
workersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, project_id, status } = req.query;
    const targetProject = (projectId || project_id) as string | undefined;

    if (targetProject && req.user && !checkUserProjectAccess(req.user, targetProject)) {
      return res.status(403).json({ error: 'You do not have access to workers for this project.' });
    }

    let query = `
      SELECT 
        w.id,
        COALESCE(w.name, CONCAT(w.first_name, ' ', w.last_name)) as name,
        w.first_name,
        w.last_name,
        w.daily_rate,
        w.hourly_ot_rate,
        COALESCE(w.trade, w.position) as trade,
        COALESCE(w.position, w.trade) as position,
        w.assigned_project_id,
        w.status,
        w.created_at,
        w.updated_at,
        CASE 
          WHEN LOWER(COALESCE(c.department, '')) LIKE '%corporate%' 
            OR LOWER(COALESCE(c.department, '')) LIKE '%executive%'
            OR LOWER(COALESCE(c.department, '')) LIKE '%finance%'
            OR LOWER(COALESCE(c.department, '')) LIKE '%hr%'
            OR LOWER(COALESCE(c.department, '')) LIKE '%human resources%'
            OR LOWER(COALESCE(c.department, '')) LIKE '%accounting%'
            OR LOWER(COALESCE(c.department, '')) LIKE '%office%'
            OR LOWER(COALESCE(c.department, '')) LIKE '%procurement%'
            OR LOWER(COALESCE(c.department, '')) LIKE '%admin%'
            OR LOWER(COALESCE(c."roleTitle", '')) LIKE '%coo%'
            OR LOWER(COALESCE(c."roleTitle", '')) LIKE '%ceo%'
            OR LOWER(COALESCE(c."roleTitle", '')) LIKE '%director%'
            OR LOWER(COALESCE(c."roleTitle", '')) LIKE '%finance%'
            OR LOWER(COALESCE(c."roleTitle", '')) LIKE '%admin%'
            OR LOWER(COALESCE(w.position, '')) LIKE '%coo%'
            OR LOWER(COALESCE(w.position, '')) LIKE '%ceo%'
            OR LOWER(COALESCE(w.position, '')) LIKE '%director%'
            OR LOWER(COALESCE(w.position, '')) LIKE '%finance%'
            OR LOWER(COALESCE(w.position, '')) LIKE '%human resources%'
            OR LOWER(COALESCE(w.position, '')) LIKE '%accounting%'
            OR LOWER(COALESCE(w.position, '')) LIKE '%procurement%'
            OR LOWER(COALESCE(w.position, '')) LIKE '%admin%'
            OR c."workforceCategory" = 'OFFICE_STAFF'
          THEN 'Corporate'
          WHEN c."employmentType" = 'OUTSOURCED' 
            OR COALESCE(c."activeManpower", 1) > 1 
            OR COALESCE(c."workforceCategory", '') = 'TRADE_CREW'
            OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%manpower supply%'
            OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%subcontractor%'
            OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%trade crew%'
            OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%crew%'
            OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%gang%'
            OR LOWER(COALESCE(w.name, '')) LIKE '%manpower supply%'
            OR LOWER(COALESCE(w.name, '')) LIKE '%trade crew%'
            OR LOWER(COALESCE(c.name, '')) LIKE '%manpower supply%'
          THEN 'Trade Crew'
          ELSE 'Artisan'
        END as workforce_class,
        COALESCE(
          json_agg(
            json_build_object(
              'projectId', pwa.project_id,
              'projectName', cp.name,
              'assignedAt', pwa.assigned_at,
              'status', pwa.status
            )
          ) FILTER (WHERE pwa.project_id IS NOT NULL), '[]'
        ) as assignments
      FROM workers w
      LEFT JOIN contractors c ON w.id = c.id
      LEFT JOIN project_worker_assignments pwa ON w.id = pwa.worker_id
      LEFT JOIN commercial_projects cp ON (pwa.project_id = cp.id OR w.assigned_project_id = cp.id)
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (status && typeof status === 'string') {
      query += ` AND LOWER(w.status) = LOWER($${pIdx++})`;
      params.push(status);
    }

    if (req.query.onlyArtisans === 'true' || req.query.category === 'Artisan') {
      query += ` AND (c."employmentType" IS NULL OR c."employmentType" != 'OUTSOURCED')
                 AND (c."activeManpower" IS NULL OR c."activeManpower" <= 1)
                 AND NOT (
                   LOWER(COALESCE(c.company, '')) LIKE '%manpower supply%'
                   OR LOWER(COALESCE(c.company, '')) LIKE '%subcontractor%'
                 )`;
    }

    if (targetProject) {
      query += ` AND (
        w.assigned_project_id = $${pIdx} 
        OR w.assigned_project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($${pIdx}))
        OR w.id IN (
          SELECT worker_id FROM project_worker_assignments 
          WHERE project_id = $${pIdx} OR project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($${pIdx}))
        )
        OR LOWER(c.active_project_site) = LOWER($${pIdx})
        OR c.active_project_site = $${pIdx}
        OR LOWER(cp.name) = LOWER($${pIdx})
        OR w.id IN (SELECT unnest(assigned_contractor_ids) FROM commercial_projects WHERE id = $${pIdx} OR LOWER(name) = LOWER($${pIdx}))
      )`;
      params.push(targetProject);
      pIdx++;
    }

    query += ` GROUP BY w.id, c.id, c."employmentType", c."activeManpower", c.department, c."roleTitle", c.active_project_site, c."workforceCategory", c.specialty, c.company, c.name ORDER BY w.position ASC, w.last_name ASC, w.first_name ASC`;

    const result = await pool.query(query, params);
    const canViewRates = req.user?.role === 'ADMIN' || req.user?.role === 'FINANCE' || !req.user;
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const workers: any[] = [];

    for (const r of result.rows) {
      if (!r.id || seenIds.has(r.id)) continue;
      if (req.query.onlyArtisans === 'true' && (r.workforce_class === 'Trade Crew' || r.workforce_class === 'Corporate' || r.workforce_class === 'Subcontractor')) {
        continue;
      }
      const rawName = (r.name || `${r.first_name || ''} ${r.last_name || ''}`).trim();
      const normName = rawName.toLowerCase();
      // If filtering by project, prevent duplicate test/contractor rows with identical names
      if (targetProject && normName && seenNames.has(normName)) {
        continue;
      }
      seenIds.add(r.id);
      if (normName) seenNames.add(normName);

      workers.push({
        id: r.id,
        name: rawName,
        firstName: r.first_name,
        lastName: r.last_name,
        dailyRate: canViewRates ? Number(r.daily_rate) : undefined,
        hourlyOtRate: canViewRates ? Number(r.hourly_ot_rate) : undefined,
        position: r.position || r.trade,
        trade: r.trade || r.position,
        workforceClass: r.workforce_class || 'Artisan',
        assignedProjectId: r.assigned_project_id,
        status: r.status,
        assignments: r.assignments,
        assignedProjectIds: Array.from(new Set([
          ...(r.assigned_project_id ? [r.assigned_project_id] : []),
          ...(r.assignments || []).map((a: any) => a.projectId)
        ])),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      });
    }

    res.json(workers);
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// POST /api/workers — Create new worker
// Allowed: ADMIN
// ============================================================================
workersRouter.post('/', requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { name, firstName, first_name, lastName, last_name, dailyRate, daily_rate, hourlyOtRate, hourly_ot_rate, position, trade, status, projectIds, assignedProjectId, assigned_project_id } = req.body;

    let trimmedName = (name || '').trim();
    let fName = (firstName || first_name || '').trim();
    let lName = (lastName || last_name || '').trim();

    if (!trimmedName && (fName || lName)) {
      trimmedName = `${fName} ${lName}`.trim();
    } else if (trimmedName && !fName) {
      const parts = trimmedName.split(' ');
      fName = parts[0] || trimmedName;
      lName = parts.slice(1).join(' ') || fName;
    }

    const pos = (trade || position || 'Artisan').trim();
    const rate = Number(dailyRate || daily_rate || 0);

    if (!trimmedName || rate <= 0) {
      return res.status(400).json({
        error: 'Worker name and valid daily rate (> 0) are required.'
      });
    }

    const otRate = (hourlyOtRate !== undefined || hourly_ot_rate !== undefined)
      ? Number(hourlyOtRate || hourly_ot_rate)
      : computeDefaultHourlyOtRate(rate);

    const workerId = `CONT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const primaryProjId = assignedProjectId || assigned_project_id || (Array.isArray(projectIds) && projectIds.length > 0 ? projectIds[0] : null);

    await pool.query(`
      INSERT INTO workers (id, name, first_name, last_name, trade, position, daily_rate, hourly_ot_rate, assigned_project_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [workerId, trimmedName, fName, lName, pos, pos, rate, otRate, primaryProjId, status || 'Active']);

    // Sync to contractors table
    const projMatch = primaryProjId ? await pool.query('SELECT name FROM commercial_projects WHERE id = $1', [primaryProjId]) : null;
    const projSiteName = projMatch?.rows[0]?.name || null;
    await prisma.contractor.create({
      data: {
        id: workerId,
        name: trimmedName,
        company: 'CTVill Builders Corporation',
        specialty: pos,
        roleTitle: pos,
        dailyRate: rate,
        activeProjectSite: projSiteName,
        status: (status || 'Active').toUpperCase(),
      }
    }).catch(e => console.error('Error syncing to contractors table:', e));

    // Assign to initial projects if provided
    const targetProjectIds = Array.from(new Set([
      ...(primaryProjId ? [primaryProjId] : []),
      ...(Array.isArray(projectIds) ? projectIds : [])
    ]));

    for (const pId of targetProjectIds) {
      await pool.query(`
        INSERT INTO project_worker_assignments (id, project_id, worker_id, assigned_at, status)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'ACTIVE')
        ON CONFLICT (project_id, worker_id) DO UPDATE SET status = 'ACTIVE'
      `, [`PWA-${workerId.slice(-4)}-${pId.slice(-4)}`, pId, workerId]);
    }

    broadcastChange('workers');
    broadcastChange('contractors');

    res.status(201).json({
      success: true,
      worker: {
        id: workerId,
        firstName: fName,
        lastName: lName,
        name: trimmedName,
        dailyRate: rate,
        hourlyOtRate: otRate,
        position: pos,
        trade: pos,
        assignedProjectId: primaryProjId,
        status: status || 'Active'
      }
    });
  } catch (error) {
    console.error('Error creating worker:', error);
    res.status(500).json({ error: 'Failed to create worker' });
  }
});

// ============================================================================
// PATCH /api/workers/:id — Update worker
// Allowed: ADMIN
// ============================================================================
workersRouter.patch('/:id', requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, first_name, lastName, last_name, dailyRate, daily_rate, hourlyOtRate, hourly_ot_rate, position, status } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    const fName = firstName || first_name;
    if (fName !== undefined) {
      updates.push(`first_name = $${pIdx++}`);
      values.push(fName.trim());
    }

    const lName = lastName || last_name;
    if (lName !== undefined) {
      updates.push(`last_name = $${pIdx++}`);
      values.push(lName.trim());
    }

    const pos = position;
    if (pos !== undefined) {
      updates.push(`position = $${pIdx++}`);
      values.push(pos.trim());
    }

    const isFinance = req.user?.role === 'FINANCE';
    const rate = dailyRate !== undefined ? dailyRate : daily_rate;
    const otRate = hourlyOtRate !== undefined ? hourlyOtRate : hourly_ot_rate;

    if ((rate !== undefined || otRate !== undefined) && !isFinance) {
      const currentWorkerRes = await pool.query('SELECT daily_rate, hourly_ot_rate FROM workers WHERE id = $1', [id]);
      if (currentWorkerRes.rows.length > 0) {
        const cur = currentWorkerRes.rows[0];
        if (
          (rate !== undefined && Number(rate) !== Number(cur.daily_rate)) ||
          (otRate !== undefined && Number(otRate) !== Number(cur.hourly_ot_rate))
        ) {
          return res.status(403).json({ error: 'Wage rates can only be modified by Finance or HR.' });
        }
      }
    }

    if (rate !== undefined && isFinance) {
      const numRate = Number(rate);
      updates.push(`daily_rate = $${pIdx++}`);
      values.push(numRate);

      if (hourlyOtRate === undefined && hourly_ot_rate === undefined) {
        updates.push(`hourly_ot_rate = $${pIdx++}`);
        values.push(computeDefaultHourlyOtRate(numRate));
      }
    }

    if (otRate !== undefined && isFinance) {
      updates.push(`hourly_ot_rate = $${pIdx++}`);
      values.push(Number(otRate));
    }

    if (status !== undefined) {
      updates.push(`status = $${pIdx++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await pool.query(
      `UPDATE workers SET ${updates.join(', ')} WHERE id = $${pIdx}`,
      values
    );

    broadcastChange('workers');

    res.json({ success: true, message: 'Worker record updated successfully.' });
  } catch (error) {
    console.error('Error updating worker:', error);
    res.status(500).json({ error: 'Failed to update worker' });
  }
});

// ============================================================================
// DELETE /api/workers/:id — Delete or inactivate worker
// Allowed: ADMIN
// ============================================================================
workersRouter.delete('/:id', requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM workers WHERE id = $1', [id]);
    broadcastChange('workers');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting worker:', error);
    res.status(500).json({ error: 'Failed to delete worker' });
  }
});

// ============================================================================
// POST /api/workers/:id/assign — Assign worker to project (Transactional & Dual-Auth)
// Allowed: ADMIN, ENGINEER
// ============================================================================
workersRouter.post('/:id/assign', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: workerId } = req.params;
    const { projectId, project_id } = req.body;
    let targetProject = projectId || project_id;

    if (!targetProject) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    // Resolve target project by ID or Name
    const pMatch = await client.query(
      'SELECT id, name, assigned_contractor_ids FROM commercial_projects WHERE id = $1 OR LOWER(name) = LOWER($1) LIMIT 1',
      [targetProject]
    );
    if (pMatch.rows.length === 0) {
      return res.status(404).json({ error: 'Target commercial project not found.' });
    }
    const targetProj = pMatch.rows[0];
    const resolvedProjectId = targetProj.id;

    // Verify Engineer permission for TARGET project
    if (!checkUserProjectAccess(req.user, resolvedProjectId)) {
      return res.status(403).json({ error: 'You do not have access to assign workers to this target project.' });
    }

    await client.query('BEGIN');

    // Fetch worker record and check for existing donor project
    const workerRes = await client.query(
      'SELECT id, assigned_project_id, status FROM workers WHERE id = $1 FOR UPDATE',
      [workerId]
    );

    // If not found in workers table, check contractors table
    if (workerRes.rows.length === 0) {
      const contRes = await client.query('SELECT id, "activeProjectSite" FROM contractors WHERE id = $1', [workerId]);
      if (contRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Worker not found.' });
      }
    }

    // Determine current active donor project from workers or project_worker_assignments
    let donorProjectId: string | null = workerRes.rows[0]?.assigned_project_id || null;
    if (!donorProjectId) {
      const curAssignRes = await client.query(
        'SELECT project_id FROM project_worker_assignments WHERE worker_id = $1 AND status = \'ACTIVE\' LIMIT 1',
        [workerId]
      );
      if (curAssignRes.rows.length > 0) {
        donorProjectId = curAssignRes.rows[0].project_id;
      }
    }

    // Verify Engineer permission for DONOR project if transferring from another project
    if (donorProjectId && donorProjectId !== resolvedProjectId) {
      if (!checkUserProjectAccess(req.user, donorProjectId)) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to transfer a worker from their current project.'
        });
      }
    }

    // 1. Remove conflicting active assignments for this worker in other projects (prevent duplicate deployments)
    await client.query(
      'DELETE FROM project_worker_assignments WHERE worker_id = $1 AND project_id != $2',
      [workerId, resolvedProjectId]
    );

    const assignId = `PWA-${resolvedProjectId.slice(-4)}-${workerId.slice(-4)}`;

    // 2. Upsert assignment in project_worker_assignments for target project
    await client.query(`
      INSERT INTO project_worker_assignments (id, project_id, worker_id, assigned_at, status)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'ACTIVE')
      ON CONFLICT (project_id, worker_id) DO UPDATE SET status = 'ACTIVE'
    `, [assignId, resolvedProjectId, workerId]);

    // 3. Update workers table assigned_project_id
    await client.query(
      'UPDATE workers SET assigned_project_id = $1, status = \'Active\', updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [resolvedProjectId, workerId]
    );

    // 4. Update contractors table activeProjectSite and active_project_site
    await client.query(
      'UPDATE contractors SET active_project_site = $1, "activeProjectSite" = $1, "status" = \'ACTIVE\' WHERE id = $2',
      [targetProj.name, workerId]
    ).catch(() => { });

    // 5. Update donor commercial_project roster and headcount if transferred (only if authorized)
    if (donorProjectId && donorProjectId !== resolvedProjectId) {
      await client.query(`
        UPDATE commercial_projects 
        SET assigned_contractor_ids = array_remove(COALESCE(assigned_contractor_ids, ARRAY[]::TEXT[]), $1),
            assigned_workers_count = COALESCE(cardinality(array_remove(COALESCE(assigned_contractor_ids, ARRAY[]::TEXT[]), $1)), 0)
        WHERE id = $2
      `, [workerId, donorProjectId]);
    }

    // 6. Update target commercial_project assigned_contractor_ids and assigned_workers_count
    await client.query(`
      UPDATE commercial_projects 
      SET assigned_contractor_ids = array_append(array_remove(COALESCE(assigned_contractor_ids, ARRAY[]::TEXT[]), $1), $1),
          assigned_workers_count = COALESCE(cardinality(array_append(array_remove(COALESCE(assigned_contractor_ids, ARRAY[]::TEXT[]), $1), $1)), 0)
      WHERE id = $2
    `, [workerId, resolvedProjectId]);

    // Note: Do not alter unauthorized third-party projects; transfers strictly update authorized donor and target projects.

    await client.query('COMMIT');

    broadcastChange('workers');
    broadcastChange('contractors');
    broadcastChange('projects');
    broadcastChange('attendance');

    res.json({ success: true, message: 'Worker assigned to project.', projectId: resolvedProjectId });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Error assigning worker:', error);
    res.status(500).json({ error: 'Failed to assign worker' });
  } finally {
    client.release();
  }
});

// ============================================================================
// DELETE /api/workers/:id/assign/:projectId — Unassign worker from project (Transactional)
// Allowed: ADMIN, ENGINEER
// ============================================================================
workersRouter.delete('/:id/assign/:projectId', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: workerId, projectId } = req.params;

    // Resolve target project by ID or Name
    const pMatch = await client.query(
      'SELECT id, name FROM commercial_projects WHERE id = $1 OR LOWER(name) = LOWER($1) LIMIT 1',
      [projectId]
    );
    const targetProjectId = pMatch.rows[0]?.id || projectId;
    const targetProjName = pMatch.rows[0]?.name;

    if (!checkUserProjectAccess(req.user, targetProjectId)) {
      return res.status(403).json({ error: 'You do not have access to unassign workers from this project.' });
    }

    await client.query('BEGIN');

    // 1. Delete assignment from project_worker_assignments
    await client.query(
      `DELETE FROM project_worker_assignments WHERE worker_id = $1 AND project_id = $2`,
      [workerId, targetProjectId]
    );

    // 2. Clear worker's assigned_project_id if it matches this project
    await client.query(
      `UPDATE workers SET assigned_project_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND assigned_project_id = $2`,
      [workerId, targetProjectId]
    );

    // 3. Clear contractor's activeProjectSite if pointing to this project
    if (targetProjName) {
      await client.query(
        `UPDATE contractors SET active_project_site = NULL, "activeProjectSite" = NULL WHERE id = $1 AND ("activeProjectSite" = $2 OR "activeProjectSite" = $3 OR active_project_site = $2 OR active_project_site = $3)`,
        [workerId, targetProjName, targetProjectId]
      ).catch(() => { });
    }

    // 4. Remove from commercial_projects assigned_contractor_ids and recalculate headcount from actual assigned IDs
    await client.query(`
      UPDATE commercial_projects 
      SET assigned_contractor_ids = array_remove(COALESCE(assigned_contractor_ids, ARRAY[]::TEXT[]), $1),
          assigned_workers_count = COALESCE(cardinality(array_remove(COALESCE(assigned_contractor_ids, ARRAY[]::TEXT[]), $1)), 0)
      WHERE id = $2
    `, [workerId, targetProjectId]);

    await client.query('COMMIT');

    broadcastChange('workers');
    broadcastChange('contractors');
    broadcastChange('projects');
    broadcastChange('attendance');

    res.json({ success: true, message: 'Worker unassigned from project.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Error unassigning worker:', error);
    res.status(500).json({ error: 'Failed to unassign worker' });
  } finally {
    client.release();
  }
});

// ============================================================================
// GET /api/cash-advances — List cash advances
// Allowed: FINANCE, ADMIN
// ============================================================================
workersRouter.get('/cash-advances', requireRole(['FINANCE', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { projectId, project_id, workerId, status } = req.query;
    const targetProject = (projectId || project_id) as string | undefined;

    let query = `
      SELECT 
        ca.id,
        ca.project_id,
        ca.worker_id,
        ca.amount,
        TO_CHAR(ca.date_issued, 'YYYY-MM-DD') as date_issued,
        ca.deducted_in_payroll_id,
        ca.status,
        ca.notes,
        ca.created_at,
        w.first_name,
        w.last_name,
        w.position,
        p.name as project_name
      FROM cash_advances ca
      JOIN workers w ON ca.worker_id = w.id
      LEFT JOIN commercial_projects p ON ca.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (targetProject) {
      query += ` AND ca.project_id = $${pIdx++}`;
      params.push(targetProject);
    }
    if (workerId) {
      query += ` AND ca.worker_id = $${pIdx++}`;
      params.push(workerId);
    }
    if (status) {
      query += ` AND ca.status = $${pIdx++}`;
      params.push(status);
    }

    query += ` ORDER BY ca.date_issued DESC, ca.created_at DESC`;

    const result = await pool.query(query, params);
    const advances = result.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name || 'Site Project',
      workerId: r.worker_id,
      workerName: `${r.first_name} ${r.last_name}`.trim(),
      position: r.position,
      amount: Number(r.amount),
      dateIssued: r.date_issued,
      deductedInPayrollId: r.deducted_in_payroll_id,
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at
    }));

    res.json(advances);
  } catch (error) {
    console.error('Error fetching cash advances:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// POST /api/cash-advances — Issue a new Cash Advance (Vale)
// Allowed: FINANCE ONLY (Separation of Duties)
// ============================================================================
workersRouter.post('/cash-advances', requireExactRole(['FINANCE']), async (req: Request, res: Response) => {
  try {
    const { projectId, project_id, workerId, worker_id, amount, notes, dateIssued, date_issued } = req.body;
    const targetProject = projectId || project_id;
    const targetWorker = workerId || worker_id;
    const advAmount = Number(amount || 0);

    if (!targetProject || !targetWorker || advAmount <= 0) {
      return res.status(400).json({
        error: 'project_id, worker_id, and positive amount (> 0) are required.'
      });
    }

    if (!checkUserProjectAccess(req.user, targetProject)) {
      return res.status(403).json({ error: 'You do not have access to issue cash advances for this project.' });
    }

    const dateVal = dateIssued || date_issued || new Date().toISOString().split('T')[0];
    const advId = `VALE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    await pool.query(`
      INSERT INTO cash_advances (id, project_id, worker_id, amount, date_issued, status, notes, created_at)
      VALUES ($1, $2, $3, $4, $5::DATE, 'PENDING', $6, CURRENT_TIMESTAMP)
    `, [advId, targetProject, targetWorker, advAmount, dateVal, notes || 'Vale Cash Advance']);

    broadcastChange('cashAdvances');

    res.status(201).json({
      success: true,
      message: `Cash advance of ₱${advAmount.toLocaleString()} recorded for worker.`,
      id: advId
    });
  } catch (error) {
    console.error('Error creating cash advance:', error);
    res.status(500).json({ error: 'Failed to create cash advance' });
  }
});

// ============================================================================
// DELETE /api/cash-advances/:id — Void or delete pending cash advance
// Allowed: FINANCE ONLY (Separation of Duties)
// ============================================================================
workersRouter.delete('/cash-advances/:id', requireExactRole(['FINANCE']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT status FROM cash_advances WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Cash advance not found.' });
    }
    if (check.rows[0].status === 'DEDUCTED') {
      return res.status(400).json({ error: 'Cannot delete cash advance that has already been deducted in a finalized payroll run.' });
    }

    await pool.query('DELETE FROM cash_advances WHERE id = $1', [id]);
    broadcastChange('cashAdvances');
    res.json({ success: true, message: 'Cash advance voided.' });
  } catch (error) {
    console.error('Error deleting cash advance:', error);
    res.status(500).json({ error: 'Failed to delete cash advance' });
  }
});
