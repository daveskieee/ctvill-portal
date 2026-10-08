/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { prisma, pool } from '../db';
import { authenticateRequest, requireRole, requireExactRole } from '../middleware/auth';
import { broadcastChange } from '../events';
import { 
  calculateProjectPayrollRun, 
  WorkerRateInfo, 
  AttendanceEntry, 
  CashAdvanceEntry 
} from '../services/payrollCalculation';

export const payrollRouter = Router();

// Apply base authentication on all payroll routes
payrollRouter.use(authenticateRequest);

/**
 * Ensures historical payroll cycles exist and align with the active 2026 project timeline.
 * Migrates any legacy 2020 seed years to 2026 (e.g., 2026-09-14 to 2026-09-21).
 */
export async function ensureHistoricalPayrollRuns() {
  try {
    // 1. Migrate any legacy 2020 dates to 2026
    await pool.query(`
      UPDATE payroll_runs 
      SET 
        period_start = REPLACE(period_start::text, '2020-', '2026-')::date,
        period_end = REPLACE(period_end::text, '2020-', '2026-')::date,
        id = REPLACE(id, '2020', '2026')
      WHERE period_start < '2025-01-01'
    `);

    // 2. Ensure historical seed record for active project PRJ-4693
    const projRes = await pool.query("SELECT id FROM commercial_projects WHERE id = 'PRJ-4693' OR name ILIKE '%2-Storey%' LIMIT 1");
    const projId = projRes.rows[0]?.id || 'PRJ-4693';

    const checkRes = await pool.query("SELECT COUNT(*) FROM payroll_runs WHERE project_id = $1", [projId]);
    if (parseInt(checkRes.rows[0].count, 10) === 0) {
      const histRunId = `PAY-${projId.slice(-4)}-20260914-20260921`;
      await pool.query(`
        INSERT INTO payroll_runs 
        (id, project_id, period_start, period_end, status, total_gross, total_deductions, total_net, approved_by_user_id, created_at, updated_at)
        VALUES 
        ($1, $2, '2026-09-14'::date, '2026-09-21'::date, 'FINALIZED', 46270.33, 0.00, 46270.33, 'usr-finance-controller', '2026-09-21 17:00:00+08', '2026-09-21 17:00:00+08')
        ON CONFLICT (id) DO NOTHING
      `, [histRunId, projId]);
    }
  } catch (err) {
    console.error('Error ensuring historical payroll runs:', err);
  }
}

// Initial ensure on startup
ensureHistoricalPayrollRuns().catch(err => console.error('ensureHistoricalPayrollRuns startup error:', err));

// ============================================================================
// GET /api/payroll/runs — List all finalized or draft payroll runs
// Allowed: FINANCE, ADMIN, ENGINEER
// ============================================================================
payrollRouter.get('/runs', requireRole(['FINANCE', 'ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    await ensureHistoricalPayrollRuns();
    const { projectId, project_id } = req.query;
    const targetProject = (projectId || project_id) as string | undefined;

    let query = `
      SELECT 
        pr.id,
        pr.project_id,
        TO_CHAR(pr.period_start, 'YYYY-MM-DD') as period_start,
        TO_CHAR(pr.period_end, 'YYYY-MM-DD') as period_end,
        pr.status,
        pr.total_gross,
        pr.total_deductions,
        pr.total_net,
        pr.approved_by_user_id,
        pr.created_at,
        p.name as project_name,
        p.client_name,
        u.name as approved_by_name,
        COUNT(pi.id) as worker_count
      FROM payroll_runs pr
      LEFT JOIN commercial_projects p ON pr.project_id = p.id
      LEFT JOIN users u ON pr.approved_by_user_id = u.id
      LEFT JOIN payroll_items pi ON pr.id = pi.payroll_run_id
    `;
    const params: any[] = [];
    if (targetProject) {
      query += ` WHERE pr.project_id = $1`;
      params.push(targetProject);
    }
    query += ` GROUP BY pr.id, p.name, p.client_name, u.name ORDER BY pr.created_at DESC`;

    const result = await pool.query(query, params);
    const runs = result.rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name || 'Project Site',
      clientName: r.client_name || '',
      periodStart: r.period_start,
      periodEnd: r.period_end,
      status: r.status,
      totalGross: Number(r.total_gross || 0),
      totalDeductions: Number(r.total_deductions || 0),
      totalNet: Number(r.total_net || 0),
      approvedByUserId: r.approved_by_user_id,
      approvedByName: r.approved_by_name || 'Finance Controller',
      workerCount: Number(r.worker_count || 0),
      createdAt: r.created_at
    }));

    res.json(runs);
  } catch (error) {
    console.error('Error fetching payroll runs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// GET /api/payroll/runs/:id — Get details of a single payroll run with items
// Allowed: FINANCE, ADMIN, ENGINEER
// ============================================================================
payrollRouter.get('/runs/:id', requireRole(['FINANCE', 'ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const runRes = await pool.query(`
      SELECT 
        pr.*,
        TO_CHAR(pr.period_start, 'YYYY-MM-DD') as period_start_formatted,
        TO_CHAR(pr.period_end, 'YYYY-MM-DD') as period_end_formatted,
        p.name as project_name,
        p.client_name,
        p.location as project_location,
        u.name as approved_by_name
      FROM payroll_runs pr
      LEFT JOIN commercial_projects p ON pr.project_id = p.id
      LEFT JOIN users u ON pr.approved_by_user_id = u.id
      WHERE pr.id = $1
    `, [id]);

    if (runRes.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll run not found' });
    }

    const run = runRes.rows[0];

    const itemsRes = await pool.query(`
      SELECT 
        pi.*,
        w.first_name,
        w.last_name,
        w.position,
        w.daily_rate,
        w.hourly_ot_rate
      FROM payroll_items pi
      JOIN workers w ON pi.worker_id = w.id
      WHERE pi.payroll_run_id = $1
      ORDER BY w.last_name ASC, w.first_name ASC
    `, [id]);

    // Fetch deducted cash advances for this run
    const advancesRes = await pool.query(`
      SELECT ca.*, w.first_name, w.last_name
      FROM cash_advances ca
      JOIN workers w ON ca.worker_id = w.id
      WHERE ca.deducted_in_payroll_id = $1
    `, [id]);

    res.json({
      id: run.id,
      projectId: run.project_id,
      projectName: run.project_name || 'Project Site',
      clientName: run.client_name || '',
      location: run.project_location || '',
      periodStart: run.period_start_formatted,
      periodEnd: run.period_end_formatted,
      status: run.status,
      totalGross: Number(run.total_gross || 0),
      totalDeductions: Number(run.total_deductions || 0),
      totalNet: Number(run.total_net || 0),
      approvedByUserId: run.approved_by_user_id,
      approvedByName: run.approved_by_name || 'Finance Department',
      createdAt: run.created_at,
      items: itemsRes.rows.map(item => ({
        id: item.id,
        workerId: item.worker_id,
        workerName: `${item.first_name} ${item.last_name}`.trim(),
        position: item.position,
        dailyRate: Number(item.daily_rate),
        hourlyOtRate: Number(item.hourly_ot_rate),
        daysWorked: Number(item.days_worked),
        otHours: Number(item.ot_hours),
        grossPay: Number(item.gross_pay),
        totalDeductions: Number(item.total_deductions),
        netPay: Number(item.net_pay)
      })),
      cashAdvances: advancesRes.rows.map(ca => ({
        id: ca.id,
        workerId: ca.worker_id,
        workerName: `${ca.first_name} ${ca.last_name}`.trim(),
        amount: Number(ca.amount),
        dateIssued: ca.date_issued,
        notes: ca.notes
      }))
    });
  } catch (error) {
    console.error('Error fetching payroll run detail:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// POST /api/payroll/generate & /api/payroll/calculate — Preview/calculate weekly payroll draft
// Allowed: FINANCE ONLY (Separation of Duties)
// ============================================================================
const handleCalculateDraft = async (req: Request, res: Response) => {
  try {
    const { projectId, project_id, periodStart, period_start, periodEnd, period_end } = req.body;
    const targetProject = projectId || project_id;
    const cycleStartDate = periodStart || period_start;
    const cycleEndDate = periodEnd || period_end;

    if (!targetProject || !cycleStartDate || !cycleEndDate) {
      return res.status(400).json({
        error: 'project_id, period_start, and period_end are required to calculate payroll.'
      });
    }

    // Strict Cycle Date Bounds Query Definition
    const attendanceQuery = {
      projectId: targetProject,
      date: {
        $gte: cycleStartDate,
        $lte: cycleEndDate
      }
    };

    // 1. Fetch assigned workers (or all active workers with assignments or logs)
    const workersRes = await pool.query(`
      SELECT DISTINCT 
        w.id, 
        COALESCE(w.name, CONCAT(w.first_name, ' ', w.last_name)) as name,
        w.first_name, 
        w.last_name, 
        COALESCE(w.trade, w.position) as position, 
        w.daily_rate, 
        w.hourly_ot_rate, 
        w.status
      FROM workers w
      LEFT JOIN project_worker_assignments pwa ON w.id = pwa.worker_id
      LEFT JOIN contractors c ON w.id = c.id
      WHERE (
        w.assigned_project_id = $1 
        OR w.assigned_project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($1))
        OR pwa.project_id = $1 
        OR pwa.project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($1))
        OR w.id IN (
          SELECT worker_id FROM attendance_logs 
          WHERE (project_id = $1 OR project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($1)))
          AND date >= $2::DATE AND date <= $3::DATE
        )
      ) 
      AND LOWER(w.status) = 'active'
      AND (c."employmentType" IS NULL OR c."employmentType" != 'OUTSOURCED')
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
      )
      ORDER BY 1 ASC
    `, [attendanceQuery.projectId, attendanceQuery.date.$gte, attendanceQuery.date.$lte]);

    const workers: WorkerRateInfo[] = workersRes.rows.map(r => ({
      id: r.id,
      name: r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      firstName: r.first_name,
      lastName: r.last_name,
      position: r.position,
      dailyRate: Number(r.daily_rate),
      hourlyOtRate: Number(r.hourly_ot_rate),
      status: r.status
    }));

    // Check if any candidate logs for this project fall outside the date bounds
    const outOfBoundsCheck = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM attendance_logs
      WHERE (project_id = $1 OR project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($1)))
      AND (date < $2::DATE OR date > $3::DATE)
    `, [attendanceQuery.projectId, attendanceQuery.date.$gte, attendanceQuery.date.$lte]);
    const outOfBoundsDbCount = Number(outOfBoundsCheck.rows[0]?.count || 0);

    // 2. Fetch attendance logs in the cycle strictly constrained to cycleStartDate and cycleEndDate
    const logsRes = await pool.query(`
      SELECT id, worker_id, TO_CHAR(date, 'YYYY-MM-DD') as date, status, overtime_hours, is_locked
      FROM attendance_logs
      WHERE (project_id = $1 OR project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($1)))
      AND date >= $2::DATE AND date <= $3::DATE
    `, [attendanceQuery.projectId, attendanceQuery.date.$gte, attendanceQuery.date.$lte]);

    // Enforce strict bounds: if an attendance log's timestamp falls outside cycle bounds, exclude it from draft
    let runtimeExcludedCount = 0;
    const logs: AttendanceEntry[] = [];
    for (const r of logsRes.rows) {
      const recordDate = r.date;
      if (recordDate >= attendanceQuery.date.$gte && recordDate <= attendanceQuery.date.$lte) {
        logs.push({
          id: r.id,
          workerId: r.worker_id,
          date: r.date,
          status: r.status,
          overtimeHours: Number(r.overtime_hours || 0),
          isLocked: Boolean(r.is_locked)
        });
      } else {
        runtimeExcludedCount++;
      }
    }

    const totalExcluded = outOfBoundsDbCount + runtimeExcludedCount;
    const recordsExcludedNotice = totalExcluded > 0 
      ? 'Records outside the selected cycle bounds were excluded.' 
      : null;

    // 3. Fetch pending cash advances (vale) within pay cycle
    const advancesRes = await pool.query(`
      SELECT id, worker_id, amount, date_issued, status, notes
      FROM cash_advances
      WHERE (project_id = $1 OR project_id IN (SELECT id FROM commercial_projects WHERE LOWER(name) = LOWER($1)))
      AND status = 'PENDING' AND date_issued <= ($2::DATE + INTERVAL '1 day')
    `, [attendanceQuery.projectId, attendanceQuery.date.$lte]);

    const advances: CashAdvanceEntry[] = advancesRes.rows.map(r => ({
      id: r.id,
      workerId: r.worker_id,
      amount: Number(r.amount),
      dateIssued: r.date_issued,
      status: r.status,
      notes: r.notes
    }));

    // Project metadata
    const projRes = await pool.query(`SELECT id, name, client_name FROM commercial_projects WHERE id = $1`, [targetProject]);
    const projectName = projRes.rows[0]?.name || 'Site Project';

    // 4. Calculate with dedicated payroll calculation service
    const calculation = calculateProjectPayrollRun({
      projectId: targetProject,
      periodStart: cycleStartDate,
      periodEnd: cycleEndDate,
      workers,
      attendanceLogs: logs,
      cashAdvances: advances
    });

    res.json({
      success: true,
      projectName,
      clientName: projRes.rows[0]?.client_name || '',
      draft: calculation,
      excludedCount: totalExcluded,
      outOfBoundsExcluded: totalExcluded > 0,
      recordsExcludedNotice,
      notice: recordsExcludedNotice
    });
  } catch (error) {
    console.error('Error generating payroll draft:', error);
    res.status(500).json({ error: 'Failed to generate payroll calculation' });
  }
};

payrollRouter.post('/generate', requireExactRole(['FINANCE']), handleCalculateDraft);
payrollRouter.post('/calculate', requireExactRole(['FINANCE']), handleCalculateDraft);

// ============================================================================
// POST /api/payroll/finalize — Lock attendance, deduct vale, save finalized payroll
// Allowed: FINANCE ONLY (Separation of Duties)
// ============================================================================
payrollRouter.post('/finalize', requireExactRole(['FINANCE']), async (req: Request, res: Response) => {
  try {
    const { 
      projectId, project_id, 
      periodStart, period_start, 
      periodEnd, period_end,
      adjustments 
    } = req.body;

    const targetProject = projectId || project_id;
    const cycleStartDate = periodStart || period_start;
    const cycleEndDate = periodEnd || period_end;
    const startDate = cycleStartDate;
    const endDate = cycleEndDate;

    if (!targetProject || !cycleStartDate || !cycleEndDate) {
      return res.status(400).json({
        error: 'project_id, period_start, and period_end are required to finalize payroll.'
      });
    }

    // Strict Cycle Date Bounds Query Definition
    const attendanceQuery = {
      projectId: targetProject,
      date: {
        $gte: cycleStartDate,
        $lte: cycleEndDate
      }
    };

    const currentUserId = req.user?.id || 'sys-finance';

    // 1. Fetch current workers, attendance, and pending advances
    const workersRes = await pool.query(`
      SELECT DISTINCT 
        w.id, w.first_name, w.last_name, w.position, w.daily_rate, w.hourly_ot_rate, w.status
      FROM workers w
      LEFT JOIN project_worker_assignments pwa ON w.id = pwa.worker_id AND pwa.project_id = $1
      LEFT JOIN contractors c ON w.id = c.id
      WHERE (pwa.project_id = $1 OR w.id IN (
        SELECT worker_id FROM attendance_logs 
        WHERE project_id = $1 AND date >= $2::DATE AND date <= $3::DATE
      )) 
      AND w.status = 'Active'
      AND (c."employmentType" IS NULL OR c."employmentType" != 'OUTSOURCED')
      AND (c."activeManpower" IS NULL OR c."activeManpower" <= 1)
      AND (c."workforceCategory" IS NULL OR c."workforceCategory" != 'TRADE_CREW')
      AND NOT (
        LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%manpower supply%'
        OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%subcontractor%'
        OR LOWER(COALESCE(w.position, w.trade, c.specialty, c.company, '')) LIKE '%trade crew%'
        OR LOWER(COALESCE(w.name, '')) LIKE '%manpower supply%'
        OR LOWER(COALESCE(c.name, '')) LIKE '%manpower supply%'
      )
    `, [attendanceQuery.projectId, attendanceQuery.date.$gte, attendanceQuery.date.$lte]);

    const workers: WorkerRateInfo[] = workersRes.rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      position: r.position,
      dailyRate: Number(r.daily_rate),
      hourlyOtRate: Number(r.hourly_ot_rate),
      status: r.status
    }));

    const logsRes = await pool.query(`
      SELECT id, worker_id, TO_CHAR(date, 'YYYY-MM-DD') as date, status, overtime_hours, is_locked
      FROM attendance_logs
      WHERE project_id = $1 AND date >= $2::DATE AND date <= $3::DATE
    `, [attendanceQuery.projectId, attendanceQuery.date.$gte, attendanceQuery.date.$lte]);

    // Enforce strict bounds: exclude any log falling outside bounds
    const logs: AttendanceEntry[] = [];
    for (const r of logsRes.rows) {
      if (r.date >= attendanceQuery.date.$gte && r.date <= attendanceQuery.date.$lte) {
        logs.push({
          id: r.id,
          workerId: r.worker_id,
          date: r.date,
          status: r.status,
          overtimeHours: Number(r.overtime_hours || 0),
          isLocked: Boolean(r.is_locked)
        });
      }
    }

    const advancesRes = await pool.query(`
      SELECT id, worker_id, amount, date_issued, status, notes
      FROM cash_advances
      WHERE project_id = $1 AND status = 'PENDING' AND date_issued <= ($2::DATE + INTERVAL '1 day')
    `, [targetProject, endDate]);

    const advances: CashAdvanceEntry[] = advancesRes.rows.map(r => ({
      id: r.id,
      workerId: r.worker_id,
      amount: Number(r.amount),
      dateIssued: r.date_issued,
      status: r.status,
      notes: r.notes
    }));

    // Calculate official payroll items
    const calc = calculateProjectPayrollRun({
      projectId: targetProject,
      periodStart: startDate,
      periodEnd: endDate,
      workers,
      attendanceLogs: logs,
      cashAdvances: advances
    });

    const runId = `PAY-${targetProject.slice(-4)}-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`;

    // Transaction execution
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert or update PayrollRun
      await client.query(`
        INSERT INTO payroll_runs 
          (id, project_id, period_start, period_end, status, total_gross, total_deductions, total_net, approved_by_user_id, updated_at)
        VALUES ($1, $2, $3::DATE, $4::DATE, 'FINALIZED', $5, $6, $7, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          status = 'FINALIZED',
          total_gross = EXCLUDED.total_gross,
          total_deductions = EXCLUDED.total_deductions,
          total_net = EXCLUDED.total_net,
          approved_by_user_id = EXCLUDED.approved_by_user_id,
          updated_at = CURRENT_TIMESTAMP
      `, [
        runId, targetProject, startDate, endDate, 
        calc.totalGross, calc.totalDeductions, calc.totalNet, currentUserId
      ]);

      // 2. Insert PayrollItems
      for (const item of calc.items) {
        const itemId = `PI-${runId.slice(-6)}-${item.workerId.slice(-4)}`;
        await client.query(`
          INSERT INTO payroll_items 
            (id, payroll_run_id, worker_id, days_worked, ot_hours, gross_pay, total_deductions, net_pay)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (payroll_run_id, worker_id) DO UPDATE SET
            days_worked = EXCLUDED.days_worked,
            ot_hours = EXCLUDED.ot_hours,
            gross_pay = EXCLUDED.gross_pay,
            total_deductions = EXCLUDED.total_deductions,
            net_pay = EXCLUDED.net_pay
        `, [
          itemId, runId, item.workerId, 
          item.daysWorked, item.otHours, 
          item.grossPay, item.totalDeductions, item.netPay
        ]);
      }

      // 3. Lock attendance records for this period
      const lockRes = await client.query(`
        UPDATE attendance_logs 
        SET is_locked = true, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = $1 AND date >= $2::DATE AND date <= $3::DATE
      `, [targetProject, startDate, endDate]);

      // 4. Mark cash advances as deducted and link to payroll run
      const appliedAdvanceIds = calc.items.flatMap(i => i.appliedCashAdvanceIds);
      if (appliedAdvanceIds.length > 0) {
        await client.query(`
          UPDATE cash_advances 
          SET status = 'DEDUCTED', deducted_in_payroll_id = $1
          WHERE id = ANY($2::text[])
        `, [runId, appliedAdvanceIds]);
      }

      // 5. Create Process Audit Log
      await client.query(`
        INSERT INTO process_audit_logs (id, "entityType", "entityId", action, "actorName", "actorRole", details, "createdAt")
        VALUES ($1, 'PAYROLL', $2, 'PAYROLL_FINALIZED', $3, 'FINANCE', $4, CURRENT_TIMESTAMP)
      `, [
        `AUDIT-${Date.now()}`,
        runId,
        req.user?.name || 'Finance Officer',
        `Finalized weekly payroll run for period ${startDate} to ${endDate}. Locked ${lockRes.rowCount} attendance records. Total Gross: ₱${calc.totalGross.toLocaleString()}, Net Disbursal: ₱${calc.totalNet.toLocaleString()}.`
      ]);

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    broadcastChange('payroll');
    broadcastChange('payrollRuns');
    broadcastChange('attendance');
    broadcastChange('cashAdvances');
    broadcastChange('auditLogs');

    res.json({
      success: true,
      message: `Weekly Payroll Run successfully finalized and locked.`,
      payrollRunId: runId,
      totalGross: calc.totalGross,
      totalDeductions: calc.totalDeductions,
      totalNet: calc.totalNet,
      workersCount: calc.items.length
    });
  } catch (error: any) {
    console.error('Error finalizing payroll run:', error);
    res.status(500).json({ error: error?.message || 'Failed to finalize payroll run' });
  }
});

// ============================================================================
// GET /api/payroll/:id/export — Return print-ready payloads / HTML
// Allowed: FINANCE, ADMIN, ENGINEER
// ============================================================================
payrollRouter.get('/:id/export', requireRole(['FINANCE', 'ADMIN', 'ENGINEER']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format } = req.query; // 'html' or 'json'

    const runRes = await pool.query(`
      SELECT 
        pr.*,
        TO_CHAR(pr.period_start, 'MM/DD/YYYY') as start_str,
        TO_CHAR(pr.period_end, 'MM/DD/YYYY') as end_str,
        p.name as project_name,
        p.client_name,
        p.location as project_location,
        u.name as approved_by_name
      FROM payroll_runs pr
      LEFT JOIN commercial_projects p ON pr.project_id = p.id
      LEFT JOIN users u ON pr.approved_by_user_id = u.id
      WHERE pr.id = $1
    `, [id]);

    if (runRes.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll record not found.' });
    }

    const run = runRes.rows[0];

    const itemsRes = await pool.query(`
      SELECT 
        pi.*,
        w.first_name,
        w.last_name,
        w.position,
        w.daily_rate,
        w.hourly_ot_rate
      FROM payroll_items pi
      JOIN workers w ON pi.worker_id = w.id
      WHERE pi.payroll_run_id = $1
      ORDER BY w.position ASC, w.last_name ASC
    `, [id]);

    const advancesRes = await pool.query(`
      SELECT ca.*, w.first_name, w.last_name
      FROM cash_advances ca
      JOIN workers w ON ca.worker_id = w.id
      WHERE ca.deducted_in_payroll_id = $1
    `, [id]);

    const items = itemsRes.rows.map(i => ({
      workerId: i.worker_id,
      workerName: `${i.first_name} ${i.last_name}`.trim(),
      position: i.position,
      dailyRate: Number(i.daily_rate),
      hourlyOtRate: Number(i.hourly_ot_rate),
      daysWorked: Number(i.days_worked),
      otHours: Number(i.ot_hours),
      basePay: Number((Number(i.days_worked) * Number(i.daily_rate)).toFixed(2)),
      otPay: Number((Number(i.ot_hours) * Number(i.hourly_ot_rate)).toFixed(2)),
      grossPay: Number(i.gross_pay),
      totalDeductions: Number(i.total_deductions),
      netPay: Number(i.net_pay)
    }));

    if (format === 'html') {
      const html = generatePrintableHtml(run, items);
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    res.json({
      runId: run.id,
      project: {
        id: run.project_id,
        name: run.project_name || 'Site Project',
        client: run.client_name || '',
        location: run.project_location || ''
      },
      period: {
        start: run.start_str,
        end: run.end_str
      },
      totals: {
        gross: Number(run.total_gross || 0),
        deductions: Number(run.total_deductions || 0),
        net: Number(run.total_net || 0),
        headcount: items.length
      },
      approvedBy: run.approved_by_name || 'Finance Controller',
      items,
      cashAdvances: advancesRes.rows
    });
  } catch (error) {
    console.error('Error generating payroll export:', error);
    res.status(500).json({ error: 'Failed to generate payroll export' });
  }
});

/**
 * Generates an executive print-ready HTML page with CSS @media print layout
 */
function generatePrintableHtml(run: any, items: any[]): string {
  const formatCurrency = (val: number) => `₱${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Master Payroll Sheet - ${run.project_name}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    @media print {
      body { background: white !important; color: black !important; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #1e293b;
      background: #f8fafc;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      background: #fff;
      padding: 30px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 15px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0f172a;
    }
    .doc-title {
      font-size: 14px;
      font-weight: 600;
      color: #b45309;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .meta-box {
      font-size: 11px;
      color: #475569;
      line-height: 1.5;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .card {
      border: 1px solid #cbd5e1;
      padding: 10px;
      border-radius: 6px;
      background: #f8fafc;
    }
    .card-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    .card-val {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 25px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      color: #334155;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .total-row {
      font-weight: 800;
      background: #f8fafc;
    }
    .signature-section {
      margin-top: 40px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      font-size: 11px;
    }
    .sig-line {
      border-top: 1px solid #0f172a;
      padding-top: 5px;
      margin-top: 40px;
      text-align: center;
      font-weight: 600;
    }
    /* Payslip grid */
    .payslip-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .payslip-card {
      border: 1px solid #0f172a;
      padding: 12px;
      border-radius: 4px;
      font-size: 10px;
      page-break-inside: avoid;
    }
    .payslip-header {
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      font-weight: bold;
    }
    .payslip-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
    }
    .payslip-total {
      border-top: 1px solid #0f172a;
      font-weight: bold;
      font-size: 11px;
      margin-top: 6px;
      padding-top: 4px;
    }
    .btn-print {
      background: #d97706;
      color: white;
      border: none;
      padding: 10px 18px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 960px; margin: 0 auto 15px; display: flex; justify-content: space-between; align-items: center;">
    <div><strong>CTVill Real Estate ERP</strong> &mdash; Printable Master Payroll & Worker Payslips</div>
    <button class="btn-print" onclick="window.print()">🖨️ Print Document</button>
  </div>

  <div class="container">
    <!-- MASTER PAYROLL SHEET -->
    <div class="header">
      <div>
        <div class="brand-title">CTVill Builders Corporation</div>
        <div class="doc-title">Official Master Labor Payroll Sheet</div>
      </div>
      <div class="meta-box text-right">
        <div><strong>Project:</strong> ${run.project_name || 'Site Project'}</div>
        <div><strong>Cycle:</strong> ${run.start_str} &ndash; ${run.end_str}</div>
        <div><strong>Payroll Ref:</strong> ${run.id}</div>
      </div>
    </div>

    <div class="summary-cards">
      <div class="card">
        <div class="card-label">Total Manpower</div>
        <div class="card-val">${items.length} Workers</div>
      </div>
      <div class="card">
        <div class="card-label">Total Gross Wages</div>
        <div class="card-val">${formatCurrency(run.total_gross)}</div>
      </div>
      <div class="card">
        <div class="card-label">Total Vale / Deductions</div>
        <div class="card-val">${formatCurrency(run.total_deductions)}</div>
      </div>
      <div class="card" style="border-color: #d97706;">
        <div class="card-label" style="color: #b45309;">Net Payout</div>
        <div class="card-val" style="color: #b45309;">${formatCurrency(run.total_net)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Worker Name</th>
          <th>Trade / Position</th>
          <th class="text-right">Rate</th>
          <th class="text-center">Days</th>
          <th class="text-center">OT Hrs</th>
          <th class="text-right">Gross Pay</th>
          <th class="text-right">Vale / Deduct</th>
          <th class="text-right">Net Pay</th>
          <th class="text-center">Worker Signature</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td><strong>${item.workerName}</strong></td>
            <td>${item.position}</td>
            <td class="text-right">${formatCurrency(item.dailyRate)}</td>
            <td class="text-center">${item.daysWorked}</td>
            <td class="text-center">${item.otHours}</td>
            <td class="text-right">${formatCurrency(item.grossPay)}</td>
            <td class="text-right">${formatCurrency(item.totalDeductions)}</td>
            <td class="text-right" style="font-weight: 700;">${formatCurrency(item.netPay)}</td>
            <td style="min-width: 110px;"></td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="4" class="text-right">TOTALS:</td>
          <td class="text-center">${items.reduce((s, i) => s + i.daysWorked, 0)}</td>
          <td class="text-center">${items.reduce((s, i) => s + i.otHours, 0)}</td>
          <td class="text-right">${formatCurrency(run.total_gross)}</td>
          <td class="text-right">${formatCurrency(run.total_deductions)}</td>
          <td class="text-right">${formatCurrency(run.total_net)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div class="signature-section">
      <div>
        <div class="sig-line">Prepared By (Timekeeper)</div>
      </div>
      <div>
        <div class="sig-line">Verified By (Project Engineer)</div>
      </div>
      <div>
        <div class="sig-line">Approved for Disbursal (Finance)</div>
      </div>
    </div>

    <!-- PAGE BREAK FOR INDIVIDUAL PAYSLIPS -->
    <div class="page-break" style="margin-top: 50px;"></div>

    <div class="header">
      <div>
        <div class="brand-title">CTVill Builders Corporation</div>
        <div class="doc-title">Individual Worker Payout Slips</div>
      </div>
      <div class="meta-box text-right">
        <div><strong>Project:</strong> ${run.project_name}</div>
        <div><strong>Pay Cycle:</strong> ${run.start_str} &ndash; ${run.end_str}</div>
      </div>
    </div>

    <div class="payslip-grid">
      ${items.map(item => `
        <div class="payslip-card">
          <div class="payslip-header">
            <span>${item.workerName}</span>
            <span>${item.position}</span>
          </div>
          <div class="payslip-row">
            <span>Daily Wage Rate:</span>
            <span>${formatCurrency(item.dailyRate)}</span>
          </div>
          <div class="payslip-row">
            <span>Days Worked (Present/Half-day):</span>
            <span>${item.daysWorked} days</span>
          </div>
          <div class="payslip-row">
            <span>Overtime (${item.otHours} hrs):</span>
            <span>${formatCurrency(item.otPay)}</span>
          </div>
          <div class="payslip-row">
            <span>Gross Earnings:</span>
            <span>${formatCurrency(item.grossPay)}</span>
          </div>
          <div class="payslip-row" style="color: #dc2626;">
            <span>Vale / Deductions:</span>
            <span>-${formatCurrency(item.totalDeductions)}</span>
          </div>
          <div class="payslip-row payslip-total">
            <span>NET TAKE-HOME PAY:</span>
            <span>${formatCurrency(item.netPay)}</span>
          </div>
          <div style="margin-top: 25px; border-top: 1px dashed #94a3b8; padding-top: 4px; text-align: center; color: #64748b; font-size: 9px;">
            Received by: ________________________ (Sign & Date)
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;
}
