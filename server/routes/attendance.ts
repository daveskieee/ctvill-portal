/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { prisma, pool } from '../db';
import { authenticateRequest, requireRole } from '../middleware/auth';
import { broadcastChange } from '../events';
import { AttendanceStatus } from '@prisma/client';

export const attendanceRouter = Router();

// Apply base authentication on all attendance routes
attendanceRouter.use(authenticateRequest);

// Enforce Separation of Duties (SoD): Reject any direct POST, PUT, PATCH, or DELETE requests from accounts with role FINANCE
attendanceRouter.use((req: Request, res: Response, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.user?.role === 'FINANCE') {
    return res.status(403).json({
      error: 'Forbidden: Accounts with role FINANCE have read-only audit permissions on in-house attendance (Separation of Duties Compliance).'
    });
  }
  next();
});

// ============================================================================
// GET /api/attendance — List attendance filtered by project_id and date_range
// Allowed: TIMEKEEPER, ENGINEER, FINANCE, ADMIN
// ============================================================================
attendanceRouter.get('/', requireRole(['TIMEKEEPER', 'ENGINEER', 'FINANCE', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { projectId, project_id, startDate, start_date, endDate, end_date, date } = req.query;
    const targetProject = (projectId || project_id) as string | undefined;
    const targetDate = date as string | undefined;
    const fromDate = (startDate || start_date) as string | undefined;
    const toDate = (endDate || end_date) as string | undefined;

    let query = `
      SELECT 
        a.id,
        a.project_id,
        a.worker_id,
        a.logged_by_user_id,
        TO_CHAR(a.date, 'YYYY-MM-DD') as date,
        a.status,
        a.overtime_hours,
        a.is_locked,
        a.created_at,
        a.updated_at,
        w.first_name,
        w.last_name,
        w.position,
        w.daily_rate,
        w.hourly_ot_rate,
        u.name as logged_by_name,
        p.name as project_name
      FROM attendance_logs a
      JOIN workers w ON a.worker_id = w.id
      LEFT JOIN users u ON a.logged_by_user_id = u.id
      LEFT JOIN commercial_projects p ON a.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (targetProject) {
      query += ` AND a.project_id = $${paramIndex++}`;
      params.push(targetProject);
    }

    if (targetDate) {
      query += ` AND a.date = $${paramIndex++}::DATE`;
      params.push(targetDate);
    } else {
      if (fromDate) {
        query += ` AND a.date >= $${paramIndex++}::DATE`;
        params.push(fromDate);
      }
      if (toDate) {
        query += ` AND a.date <= $${paramIndex++}::DATE`;
        params.push(toDate);
      }
    }

    query += ` ORDER BY a.date DESC, w.last_name ASC, w.first_name ASC`;

    const result = await pool.query(query, params);
    const isTimekeeper = req.user?.role === 'TIMEKEEPER';

    let isPeriodLocked = false;
    if (targetProject && targetDate) {
      const payrollCheck = await pool.query(
        `SELECT id FROM payroll_runs 
         WHERE project_id = $1 
           AND $2::DATE BETWEEN period_start AND period_end 
           AND status IN ('FINALIZED', 'PAID') 
         LIMIT 1`,
        [targetProject, targetDate]
      );
      if (payrollCheck.rows.length > 0) {
        isPeriodLocked = true;
      }
    }

    const logs = result.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name || 'Site Project',
      workerId: r.worker_id,
      workerName: `${r.first_name} ${r.last_name}`.trim(),
      position: r.position,
      dailyRate: isTimekeeper ? undefined : Number(r.daily_rate),
      hourlyOtRate: isTimekeeper ? undefined : Number(r.hourly_ot_rate),
      loggedByUserId: r.logged_by_user_id,
      loggedByName: r.logged_by_name || 'Timekeeper',
      date: r.date,
      status: r.status,
      overtimeHours: Number(r.overtime_hours || 0),
      isLocked: isPeriodLocked || Boolean(r.is_locked),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    if (isPeriodLocked) {
      res.setHeader('x-period-locked', 'true');
    }
    res.json(logs);
  } catch (error) {
    console.error('Error fetching attendance logs:', error);
    res.status(500).json({ error: 'Internal Server Error fetching attendance records' });
  }
});

// ============================================================================
// GET /api/attendance/roster — Deduplicated muster roll for daily roll-call
// Allowed: TIMEKEEPER, ENGINEER, FINANCE, ADMIN
// ============================================================================
attendanceRouter.get('/roster', requireRole(['TIMEKEEPER', 'ENGINEER', 'FINANCE', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { projectId, project_id, status } = req.query;
    const targetProject = (projectId || project_id) as string | undefined;

    if (!targetProject) {
      return res.status(400).json({ error: 'Project ID is required to fetch muster roll.' });
    }

    // Query active workers assigned to project_id (via direct assignment, pwa, or contractor active_project_site)
    // Exclude Executive/Office staff (e.g. COO, CEO, HR, Finance, Procurement, Legal, Executive)
    // Enforce that only active field artisans and trade crews appear
    const query = `
      SELECT DISTINCT ON (w.id)
        w.id,
        COALESCE(w.name, CONCAT(w.first_name, ' ', w.last_name)) as name,
        w.first_name,
        w.last_name,
        w.daily_rate,
        w.hourly_ot_rate,
        COALESCE(w.trade, w.position, c.specialty) as trade,
        COALESCE(w.position, w.trade, c."roleTitle", c.specialty) as position,
        w.assigned_project_id,
        w.status,
        w.created_at,
        w.updated_at,
        CASE 
          WHEN LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%crew%' 
            OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%team%'
            OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%gang%'
            OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%manpower%'
            OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%subcontractor%'
            OR LOWER(COALESCE(w.name, '')) LIKE '%manpower%'
            OR LOWER(COALESCE(w.name, '')) LIKE '%crew%'
            OR c."employmentType" = 'OUTSOURCED'
            OR (c."activeManpower" IS NOT NULL AND c."activeManpower" > 1) 
            OR c."workforceCategory" = 'TRADE_CREW' THEN 'Trade Crew'
          ELSE 'Artisan'
        END as workforce_class
      FROM workers w
      LEFT JOIN project_worker_assignments pwa ON w.id = pwa.worker_id
      LEFT JOIN contractors c ON w.id = c.id
      WHERE LOWER(w.status) = 'active'
        AND (c.status IS NULL OR LOWER(c.status) != 'inactive')
        AND (
          w.assigned_project_id = $1 
          OR w.assigned_project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($1))
          OR pwa.project_id = $1 
          OR pwa.project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($1))
          OR c.active_project_site = $1
          OR LOWER(c.active_project_site) = LOWER($1)
          OR c.active_project_site IN (SELECT name FROM commercial_projects WHERE id = $1)
          OR w.id IN (SELECT unnest(assigned_contractor_ids) FROM commercial_projects WHERE id = $1 OR LOWER(name) = LOWER($1))
        )
        AND NOT (
          c."employmentType" = 'OUTSOURCED'
          OR (c."activeManpower" IS NOT NULL AND c."activeManpower" > 1)
          OR COALESCE(c."workforceCategory", '') = 'TRADE_CREW'
          OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%manpower supply%'
          OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%subcontractor%'
          OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%trade crew%'
          OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%crew%'
          OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%gang%'
          OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%facilities maintenance%'
          OR LOWER(COALESCE(w.name, '')) LIKE '%manpower supply%'
          OR LOWER(COALESCE(w.name, '')) LIKE '%trade crew%'
          OR LOWER(COALESCE(w.name, '')) LIKE '%facilities maintenance%'
          OR LOWER(COALESCE(w.name, '')) LIKE '%subcontractor%'
          OR LOWER(COALESCE(c.name, '')) LIKE '%manpower supply%'
          OR LOWER(COALESCE(c.name, '')) LIKE '%facilities maintenance%'
          OR LOWER(COALESCE(c.name, '')) LIKE '%subcontractor%'
          OR LOWER(COALESCE(c.department, '')) LIKE '%executive%'
          OR LOWER(COALESCE(c.department, '')) LIKE '%corporate%'
          OR LOWER(COALESCE(c.department, '')) LIKE '%finance%'
          OR LOWER(COALESCE(c.department, '')) LIKE '%accounting%'
          OR LOWER(COALESCE(c.department, '')) LIKE '%human resources%'
          OR LOWER(COALESCE(c.department, '')) LIKE '%admin%'
          OR LOWER(COALESCE(c.department, '')) LIKE '%legal%'
          OR LOWER(COALESCE(c.department, '')) LIKE '%procurement%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%coo%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%ceo%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%president%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%director%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%architect%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%human resources%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%accounting%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%procurement%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%admin%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%project manager%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%site engineer%'
          OR LOWER(COALESCE(w.position, c."roleTitle", c.specialty, '')) LIKE '%safety officer%'
          OR COALESCE(c."workforceCategory", '') = 'OFFICE_STAFF'
        )
      ORDER BY w.id, w.created_at DESC
    `;

    const result = await pool.query(query, [targetProject]);
    const isTimekeeper = req.user?.role === 'TIMEKEEPER';

    // In JavaScript, guarantee exactly 1 row per unique worker ID (and guard against any duplicate names)
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const deduplicatedWorkers: any[] = [];

    for (const r of result.rows) {
      if (!r.id || seenIds.has(r.id)) continue;
      // Strictly exclude Corporate, Trade Crew, and Subcontractor entities from In-House Artisan Roll-Call
      if (r.workforce_class === 'Corporate' || r.workforce_class === 'Trade Crew' || r.workforce_class === 'Subcontractor') continue;

      const rawName = (r.name || `${r.first_name || ''} ${r.last_name || ''}`).trim();
      const normName = rawName.toLowerCase();
      const posLower = (r.position || r.trade || '').toLowerCase();

      // Additional defense against crew providers or agency titles
      if (
        normName.includes('manpower supply') ||
        normName.includes('trade crew') ||
        normName.includes('facilities maintenance') ||
        normName.includes('subcontractor') ||
        posLower.includes('manpower supply') ||
        posLower.includes('trade crew') ||
        posLower.includes('subcontractor')
      ) {
        continue;
      }

      if (normName && seenNames.has(normName)) continue;

      seenIds.add(r.id);
      if (normName) seenNames.add(normName);

      deduplicatedWorkers.push({
        id: r.id,
        name: rawName,
        firstName: r.first_name,
        lastName: r.last_name,
        dailyRate: isTimekeeper ? undefined : Number(r.daily_rate),
        hourlyOtRate: isTimekeeper ? undefined : Number(r.hourly_ot_rate),
        position: r.position || r.trade || 'Artisan',
        trade: r.trade || r.position || 'Artisan',
        workforceClass: 'Artisan',
        assignedProjectId: r.assigned_project_id,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      });
    }

    res.json(deduplicatedWorkers);
  } catch (error) {
    console.error('Error fetching attendance roster:', error);
    res.status(500).json({ error: 'Internal Server Error fetching attendance roster' });
  }
});

// ============================================================================
// POST /api/attendance — Submit daily batch attendance for a project
// Allowed: TIMEKEEPER, ADMIN
// ============================================================================
attendanceRouter.post('/', requireRole(['TIMEKEEPER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { 
      projectId, project_id, date, records, entries,
      override_reason, overrideReason,
      overridden_by, overriddenBy
    } = req.body;
    const targetProject = projectId || project_id;
    const effectiveDate = date ? String(date).split('T')[0] : new Date().toISOString().split('T')[0];
    const attendanceItems = records || entries;
    const overrideReasonText = (override_reason || overrideReason || '').trim();
    const overriddenUserId = overridden_by || overriddenBy || req.user?.id || 'sys-admin';

    if (!targetProject) {
      return res.status(400).json({ error: 'Project ID is required for logging attendance.' });
    }

    if (!Array.isArray(attendanceItems) || attendanceItems.length === 0) {
      return res.status(400).json({ error: 'Attendance records array is required.' });
    }

    const currentUserId = req.user?.id || 'sys-admin';

    // 1. Verify if individual records for this project and date are already locked
    const lockedCheck = await pool.query(
      `SELECT id FROM attendance_logs WHERE project_id = $1 AND date = $2::DATE AND is_locked = true LIMIT 1`,
      [targetProject, effectiveDate]
    );

    // 2. Verify if target date falls within any finalized or paid PayrollRun
    const payrollLockedCheck = await pool.query(
      `SELECT id FROM payroll_runs 
       WHERE project_id = $1 
         AND $2::DATE BETWEEN period_start AND period_end 
         AND status IN ('FINALIZED', 'PAID') 
       LIMIT 1`,
      [targetProject, effectiveDate]
    );

    if (lockedCheck.rows.length > 0 || payrollLockedCheck.rows.length > 0) {
      return res.status(423).json({
        error: "Attendance records for this date have been finalized by Finance and cannot be modified."
      });
    }

    const client = await pool.connect();
    let savedCount = 0;
    try {
      await client.query('BEGIN');

      // Fetch pre-existing records to track OM overrides for audit logging
      const existingRes = await client.query(
        `SELECT worker_id, status, overtime_hours FROM attendance_logs WHERE project_id = $1 AND date = $2::DATE`,
        [targetProject, effectiveDate]
      );
      const existingMap = new Map<string, { status: string; otHours: number }>();
      for (const row of existingRes.rows) {
        existingMap.set(row.worker_id, { status: row.status, otHours: Number(row.overtime_hours || 0) });
      }

      const overrides: string[] = [];

      // Query active worker IDs to ensure inactive workers cannot be checked in
      const activeWorkersRes = await client.query(
        `SELECT id FROM workers WHERE LOWER(status) = 'active'`
      );
      const activeWorkerIds = new Set(activeWorkersRes.rows.map(r => r.id));

      for (const rec of attendanceItems) {
        if (!rec.workerId || !activeWorkerIds.has(rec.workerId)) continue;
        const status = (rec.status || 'PRESENT').toUpperCase().trim();
        const otHours = Math.max(0, Number(rec.overtimeHours || rec.ot_hours || 0));
        const logId = rec.id || `ATT-${targetProject.slice(-4)}-${rec.workerId.slice(-4)}-${effectiveDate.replace(/-/g, '')}`;

        const prev = existingMap.get(rec.workerId);
        if (prev && (prev.status !== status || prev.otHours !== otHours)) {
          overrides.push(`Worker ${rec.workerId}: status [${prev.status} -> ${status}], OT [${prev.otHours}h -> ${otHours}h]`);
        }

        await client.query(
          `INSERT INTO attendance_logs 
            (id, project_id, worker_id, logged_by_user_id, date, status, overtime_hours, is_locked, override_reason, overridden_by, updated_at)
           VALUES ($1, $2, $3, $4, $5::DATE, $6, $7, false, $8, $9, CURRENT_TIMESTAMP)
           ON CONFLICT (project_id, worker_id, date) DO UPDATE SET
            status = EXCLUDED.status,
            overtime_hours = EXCLUDED.overtime_hours,
            logged_by_user_id = EXCLUDED.logged_by_user_id,
            override_reason = COALESCE(EXCLUDED.override_reason, attendance_logs.override_reason),
            overridden_by = COALESCE(EXCLUDED.overridden_by, attendance_logs.overridden_by),
            updated_at = CURRENT_TIMESTAMP
           WHERE attendance_logs.is_locked = false`,
          [logId, targetProject, rec.workerId, currentUserId, effectiveDate, status, otHours, overrideReasonText || null, overrideReasonText ? overriddenUserId : null]
        );
        savedCount++;
      }

      // If user is OM / ADMIN or if override reason was provided, record audit log in process_audit_logs
      const isOM = req.user?.role === 'ADMIN';
      if ((isOM && (overrideReasonText || overrides.length > 0)) || overrideReasonText) {
        const auditDetails = overrideReasonText
          ? `Administrative Attendance Override on ${effectiveDate} for project ${targetProject}. Reason: "${overrideReasonText}". ${overrides.length > 0 ? `Modifications: ${overrides.join('; ')}` : `Records saved: ${savedCount}`}`
          : `Attendance override applied on ${effectiveDate} across ${overrides.length} worker record(s): ${overrides.join('; ')}`;

        await client.query(`
          INSERT INTO process_audit_logs (id, "entityType", "entityId", action, "actorName", "actorRole", details, "createdAt")
          VALUES ($1, 'ATTENDANCE', $2, 'ATTENDANCE_OVERRIDE', $3, 'OPERATIONS_MANAGER', $4, CURRENT_TIMESTAMP)
        `, [
          `AUDIT-${Date.now()}`,
          targetProject,
          req.user?.name || 'Operations Manager',
          auditDetails
        ]);
        broadcastChange('auditLogs');
      }

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    broadcastChange('attendance');

    res.json({
      success: true,
      message: `Successfully logged daily attendance for ${savedCount} worker(s).`,
      count: savedCount,
      projectId: targetProject,
      date: effectiveDate
    });
  } catch (error: any) {
    console.error('Error submitting batch attendance:', error);
    res.status(500).json({ error: error?.message || 'Failed to submit batch attendance' });
  }
});

// ============================================================================
// PATCH /api/attendance/:id — Correct an entry
// Allowed: TIMEKEEPER if within 24h and not locked; ADMIN always.
// ============================================================================
attendanceRouter.patch('/:id', requireRole(['TIMEKEEPER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, overtimeHours, overtime_hours } = req.body;

    const existingRes = await pool.query(
      `SELECT id, is_locked, created_at, project_id, worker_id FROM attendance_logs WHERE id = $1`,
      [id]
    );

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Attendance entry not found.' });
    }

    const entry = existingRes.rows[0];

    // Check if entry is locked
    if (entry.is_locked) {
      return res.status(403).json({
        error: 'Entry is locked by a finalized payroll run and cannot be adjusted.'
      });
    }

    // Role check: If TIMEKEEPER, verify within 24h of creation
    const userRole = req.user?.role || 'TIMEKEEPER';
    if (userRole === 'TIMEKEEPER') {
      const createdAt = new Date(entry.created_at).getTime();
      const now = Date.now();
      const elapsedHours = (now - createdAt) / (1000 * 60 * 60);

      if (elapsedHours > 24) {
        return res.status(403).json({
          error: `Timekeeper correction window expired: Entries can only be corrected within 24 hours of logging (${elapsedHours.toFixed(1)}h elapsed). Please request an Operations Admin to perform this adjustment.`
        });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status) {
      updates.push(`status = $${idx++}`);
      values.push(status.toUpperCase().trim());
    }

    const ot = overtimeHours !== undefined ? overtimeHours : overtime_hours;
    if (ot !== undefined) {
      updates.push(`overtime_hours = $${idx++}`);
      values.push(Math.max(0, Number(ot)));
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await pool.query(
      `UPDATE attendance_logs SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    broadcastChange('attendance');

    res.json({
      success: true,
      message: 'Attendance entry successfully corrected.',
      id
    });
  } catch (error) {
    console.error('Error patching attendance entry:', error);
    res.status(500).json({ error: 'Failed to correct attendance entry' });
  }
});

// ============================================================================
// PUT /api/attendance & PUT /api/attendance/:id
// Allowed: TIMEKEEPER, ADMIN (Strictly Forbidden for FINANCE)
// ============================================================================
attendanceRouter.put('/', requireRole(['TIMEKEEPER', 'ADMIN']), async (req: Request, res: Response) => {
  return res.status(405).json({ error: 'Method Not Allowed. Use POST /api/attendance for batch roll-call.' });
});

attendanceRouter.put('/:id', requireRole(['TIMEKEEPER', 'ADMIN']), async (req: Request, res: Response) => {
  return res.status(405).json({ error: 'Method Not Allowed. Use PATCH /api/attendance/:id for entry adjustments.' });
});

