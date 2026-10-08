/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { prisma, pool } from '../db';
import { authenticateRequest, requireRole, requireExactRole } from '../middleware/auth';
import { broadcastChange } from '../events';
import { computeDefaultHourlyOtRate } from '../services/payrollCalculation';

export const workersRouter = Router();

// Apply base authentication on all workers routes
workersRouter.use(authenticateRequest);

// ============================================================================
// GET /api/workers — List all workers in labor masterlist
// Allowed: ADMIN, ENGINEER, TIMEKEEPER, FINANCE
// ============================================================================
workersRouter.get('/', requireRole(['ADMIN', 'ENGINEER', 'TIMEKEEPER', 'FINANCE']), async (req: Request, res: Response) => {
  try {
    const { projectId, project_id, status } = req.query;
    const targetProject = (projectId || project_id) as string | undefined;

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
                 AND (c."workforceCategory" IS NULL OR c."workforceCategory" != 'TRADE_CREW')
                 AND NOT (
                   LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%manpower supply%'
                   OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%subcontractor%'
                   OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%trade crew%'
                   OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%crew%'
                   OR LOWER(COALESCE(w.name, '')) LIKE '%manpower supply%'
                   OR LOWER(COALESCE(w.name, '')) LIKE '%trade crew%'
                   OR LOWER(COALESCE(c.name, '')) LIKE '%manpower supply%'
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
      // When querying for project site labor, exclude executive and office administrative personnel
      query += ` AND NOT (
        LOWER(COALESCE(c.department, '')) IN ('executive', 'management', 'administration', 'human resources', 'finance', 'accounting', 'legal', 'procurement')
        OR LOWER(COALESCE(c."roleTitle", w.position, '')) SIMILAR TO '%(coo|chief operating officer|ceo|chief executive officer|general manager|president|vice president|vp|director|project manager|site manager|admin|finance|procurement|hr|human resource|accountant|architect|site engineer|safety officer)%'
      )`;
      params.push(targetProject);
      pIdx++;
    }

    query += ` GROUP BY w.id, c."employmentType", c."activeManpower", c.department, c."roleTitle", c.active_project_site ORDER BY w.position ASC, w.last_name ASC, w.first_name ASC`;

    const result = await pool.query(query, params);
    const isTimekeeper = req.user?.role === 'TIMEKEEPER';
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
        dailyRate: isTimekeeper ? undefined : Number(r.daily_rate),
        hourlyOtRate: isTimekeeper ? undefined : Number(r.hourly_ot_rate),
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
// POST /api/workers/:id/assign — Assign worker to project
// Allowed: ADMIN, ENGINEER
// ============================================================================
workersRouter.post('/:id/assign', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const { id: workerId } = req.params;
    const { projectId, project_id } = req.body;
    const targetProject = projectId || project_id;

    if (!targetProject) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    const assignId = `PWA-${targetProject.slice(-4)}-${workerId.slice(-4)}`;

    await pool.query(`
      INSERT INTO project_worker_assignments (id, project_id, worker_id, assigned_at, status)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'ACTIVE')
      ON CONFLICT (project_id, worker_id) DO UPDATE SET status = 'ACTIVE'
    `, [assignId, targetProject, workerId]);

    broadcastChange('workers');

    res.json({ success: true, message: 'Worker assigned to project.' });
  } catch (error) {
    console.error('Error assigning worker:', error);
    res.status(500).json({ error: 'Failed to assign worker' });
  }
});

// ============================================================================
// DELETE /api/workers/:id/assign/:projectId — Unassign worker from project
// Allowed: ADMIN, ENGINEER
// ============================================================================
workersRouter.delete('/:id/assign/:projectId', requireRole(['ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const { id: workerId, projectId } = req.params;
    await pool.query(
      `DELETE FROM project_worker_assignments WHERE worker_id = $1 AND project_id = $2`,
      [workerId, projectId]
    );

    broadcastChange('workers');
    res.json({ success: true, message: 'Worker unassigned from project.' });
  } catch (error) {
    console.error('Error unassigning worker:', error);
    res.status(500).json({ error: 'Failed to unassign worker' });
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
