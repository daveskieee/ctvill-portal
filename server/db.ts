/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
const isCloudDb = connectionString.includes('sslmode=') || connectionString.includes('neon.tech') || connectionString.includes('supabase') || connectionString.includes('render');

export const pool = new Pool({
  connectionString,
  max: 50,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  ...(isCloudDb ? { ssl: { rejectUnauthorized: false } } : {})
});

export const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

// Ensure critical commercial fit-out tables exist in PostgreSQL
export async function initializeDatabaseTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS fitout_quotations (
        id TEXT PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        client_phone TEXT,
        project_scope TEXT NOT NULL,
        estimated_cost NUMERIC DEFAULT 0,
        estimated_weeks NUMERIC DEFAULT 0,
        estimator_area NUMERIC DEFAULT 0,
        space_type TEXT,
        finish_tier TEXT,
        project_notes TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE fitout_quotations ADD COLUMN IF NOT EXISTS converted_project_id TEXT;

      CREATE TABLE IF NOT EXISTS government_permits (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        project_name TEXT NOT NULL,
        permit_name TEXT NOT NULL,
        permit_type TEXT NOT NULL,
        issuing_agency TEXT NOT NULL,
        reference_no TEXT,
        status TEXT DEFAULT 'PENDING',
        application_date DATE,
        approval_date DATE,
        expiry_date DATE,
        notes TEXT,
        document_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS project_rfis (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        rfi_number TEXT NOT NULL,
        subject TEXT NOT NULL,
        question TEXT NOT NULL,
        suggested_solution TEXT,
        assigned_to TEXT NOT NULL,
        priority TEXT DEFAULT 'MEDIUM',
        status TEXT DEFAULT 'OPEN',
        date_submitted TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        date_required DATE,
        official_answer TEXT,
        answered_by TEXT,
        answered_at TIMESTAMP WITH TIME ZONE,
        drawings_affected TEXT,
        cost_impact_estimated NUMERIC DEFAULT 0,
        schedule_impact_days NUMERIC DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS commercial_change_orders (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        co_number TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        reason TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING_REVIEW',
        date_requested TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        date_approved TIMESTAMP WITH TIME ZONE,
        cost_impact NUMERIC DEFAULT 0,
        schedule_impact_days NUMERIC DEFAULT 0,
        client_signature TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE contractors ADD COLUMN IF NOT EXISTS active_presence TEXT DEFAULT 'ONLINE';

      -- Extend Role enum with ENGINEER and TIMEKEEPER if needed
      DO $$ 
      BEGIN
        BEGIN
          ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ENGINEER';
        EXCEPTION WHEN duplicate_object THEN null;
        END;
        BEGIN
          ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TIMEKEEPER';
        EXCEPTION WHEN duplicate_object THEN null;
        END;
      END $$;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS project_ids TEXT[] DEFAULT '{}';

      -- Workers masterlist (Unified Single Source of Truth)
      CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        name TEXT,
        first_name TEXT,
        last_name TEXT,
        trade TEXT,
        daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 600,
        hourly_ot_rate NUMERIC(10, 2) NOT NULL DEFAULT 93.75,
        position TEXT NOT NULL DEFAULT 'Artisan',
        assigned_project_id TEXT REFERENCES commercial_projects(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE workers ADD COLUMN IF NOT EXISTS name TEXT;
      ALTER TABLE workers ADD COLUMN IF NOT EXISTS trade TEXT;
      ALTER TABLE workers ADD COLUMN IF NOT EXISTS assigned_project_id TEXT REFERENCES commercial_projects(id) ON DELETE SET NULL;
      ALTER TABLE workers ALTER COLUMN first_name DROP NOT NULL;
      ALTER TABLE workers ALTER COLUMN last_name DROP NOT NULL;
      ALTER TABLE workers ALTER COLUMN position DROP NOT NULL;

      -- Deprecate/remove static mock workers and test records
      DELETE FROM workers 
      WHERE id LIKE 'WRK-%' 
      AND id IN ('WRK-001', 'WRK-002', 'WRK-003', 'WRK-004', 'WRK-005', 'WRK-006', 'WRK-007', 'WRK-008', 'WRK-009', 'WRK-010');
      DELETE FROM workers WHERE id LIKE 'CONT-TEST-%';
      DELETE FROM contractors WHERE id LIKE 'CONT-TEST-%';
      DELETE FROM project_worker_assignments WHERE worker_id LIKE 'CONT-TEST-%';
      DELETE FROM attendance_logs WHERE worker_id LIKE 'CONT-TEST-%';

      -- Synchronize real database contractors into workers masterlist
      INSERT INTO workers (id, name, first_name, last_name, trade, position, daily_rate, hourly_ot_rate, assigned_project_id, status, created_at, updated_at)
      SELECT 
        c.id,
        c.name,
        split_part(c.name, ' ', 1) as first_name,
        COALESCE(NULLIF(substring(c.name from length(split_part(c.name, ' ', 1)) + 2), ''), split_part(c.name, ' ', 1)) as last_name,
        COALESCE(c.specialty, c."roleTitle", 'Artisan') as trade,
        COALESCE(c."roleTitle", c.specialty, 'Artisan') as position,
        COALESCE(c."dailyRate", 600) as daily_rate,
        ROUND((COALESCE(c."dailyRate", 600) / 8.0) * 1.25, 2) as hourly_ot_rate,
        cp.id as assigned_project_id,
        CASE WHEN UPPER(c.status) = 'INACTIVE' THEN 'Inactive' ELSE 'Active' END as status,
        COALESCE(c."createdAt", CURRENT_TIMESTAMP),
        CURRENT_TIMESTAMP
      FROM contractors c
      LEFT JOIN commercial_projects cp ON (c.active_project_site = cp.id OR LOWER(c.active_project_site) = LOWER(cp.name) OR c.id = ANY(cp.assigned_contractor_ids))
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        trade = EXCLUDED.trade,
        position = EXCLUDED.position,
        daily_rate = EXCLUDED.daily_rate,
        hourly_ot_rate = EXCLUDED.hourly_ot_rate,
        assigned_project_id = COALESCE(EXCLUDED.assigned_project_id, workers.assigned_project_id),
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP;

      -- Project Worker Assignments
      CREATE TABLE IF NOT EXISTS project_worker_assignments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES commercial_projects(id) ON DELETE CASCADE,
        worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'ACTIVE',
        CONSTRAINT uq_proj_worker UNIQUE (project_id, worker_id)
      );

      -- Sync project_worker_assignments from commercial_projects.assigned_contractor_ids
      INSERT INTO project_worker_assignments (id, project_id, worker_id, assigned_at, status)
      SELECT 
        CONCAT('PWA-', cp.id, '-', u.w_id),
        cp.id,
        u.w_id,
        CURRENT_TIMESTAMP,
        'ACTIVE'
      FROM commercial_projects cp,
      LATERAL unnest(cp.assigned_contractor_ids) AS u(w_id)
      JOIN workers w ON u.w_id = w.id
      ON CONFLICT (project_id, worker_id) DO NOTHING;

      -- Attendance Logs
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES commercial_projects(id) ON DELETE CASCADE,
        worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        logged_by_user_id TEXT NOT NULL REFERENCES users(id),
        date DATE NOT NULL,
        status TEXT NOT NULL,
        overtime_hours DOUBLE PRECISION DEFAULT 0,
        is_locked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_attendance_entry UNIQUE (project_id, worker_id, date)
      );

      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS override_reason TEXT;
      ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS overridden_by TEXT;

      -- Payroll Runs
      CREATE TABLE IF NOT EXISTS payroll_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES commercial_projects(id) ON DELETE CASCADE,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        status TEXT DEFAULT 'DRAFT',
        total_gross NUMERIC(12, 2) DEFAULT 0,
        total_deductions NUMERIC(12, 2) DEFAULT 0,
        total_net NUMERIC(12, 2) DEFAULT 0,
        approved_by_user_id TEXT REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Cash Advances (Vale / Deductions)
      CREATE TABLE IF NOT EXISTS cash_advances (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES commercial_projects(id) ON DELETE CASCADE,
        worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        date_issued TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deducted_in_payroll_id TEXT REFERENCES payroll_runs(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'PENDING',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Payroll Items (Worker Breakdown)
      CREATE TABLE IF NOT EXISTS payroll_items (
        id TEXT PRIMARY KEY,
        payroll_run_id TEXT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
        worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        days_worked DOUBLE PRECISION NOT NULL,
        ot_hours DOUBLE PRECISION DEFAULT 0,
        gross_pay NUMERIC(10, 2) NOT NULL,
        total_deductions NUMERIC(10, 2) DEFAULT 0,
        net_pay NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_payroll_item UNIQUE (payroll_run_id, worker_id)
      );
    `);

    // High-performance database indexing (executed individually for schema resilience)
    const indexStatements = [
      'CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks("projectId")',
      'CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_id ON project_tasks("parentTaskId")',
      'CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_contractor ON project_tasks("assignedContractorId")',
      'CREATE INDEX IF NOT EXISTS idx_project_tasks_created_at ON project_tasks("createdAt" DESC)',
      'CREATE INDEX IF NOT EXISTS idx_task_links_project_id ON task_links("projectId")',
      'CREATE INDEX IF NOT EXISTS idx_task_links_source_id ON task_links("sourceId")',
      'CREATE INDEX IF NOT EXISTS idx_task_links_target_id ON task_links("targetId")',
      'CREATE INDEX IF NOT EXISTS idx_commercial_projects_created_at ON commercial_projects(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_contractors_status ON contractors(status)',
      'CREATE INDEX IF NOT EXISTS idx_slots_parcel_id ON slots("parcelId")',
      'CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status)',
      'CREATE INDEX IF NOT EXISTS idx_daily_site_logs_date ON daily_site_logs(date DESC)',
      'CREATE INDEX IF NOT EXISTS idx_government_permits_project_id ON government_permits(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_government_permits_status ON government_permits(status)',
      'CREATE INDEX IF NOT EXISTS idx_schedule_events_date ON schedule_events(event_date ASC, start_time ASC)',
      'CREATE INDEX IF NOT EXISTS idx_project_rfis_project_id ON project_rfis(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_commercial_change_orders_project_id ON commercial_change_orders(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_extended_payroll_created_at ON extended_payroll(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_project_documents_created_at ON project_documents(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_logs_project_date ON attendance_logs(project_id, date)',
      'CREATE INDEX IF NOT EXISTS idx_attendance_logs_worker ON attendance_logs(worker_id)',
      'CREATE INDEX IF NOT EXISTS idx_cash_advances_worker ON cash_advances(worker_id)',
      'CREATE INDEX IF NOT EXISTS idx_cash_advances_project ON cash_advances(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_payroll_runs_project ON payroll_runs(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_project_worker_assignments_project ON project_worker_assignments(project_id)',
    ];

    for (const stmt of indexStatements) {
      try {
        await pool.query(stmt);
      } catch {
        // Safe fallback if column name differs between legacy and prisma schemas
      }
    }

    try {
      // Auto-align task statuses with progress (Gantt-to-Kanban bidirectional sync)
      await pool.query(`
        UPDATE project_tasks
        SET status = 'COMPLETED'
        WHERE progress >= 1.0 AND status != 'COMPLETED';

        UPDATE project_tasks
        SET status = 'IN_PROGRESS'
        WHERE progress > 0 AND progress < 1.0 AND status = 'TODO';
      `);
    } catch {}

    console.log('✅ PostgreSQL commercial fit-out schema and performance indexes initialized.');
  } catch (err: any) {
    console.warn('Database initialization advisory (non-blocking):', err.message || err);
  }
}

// System settings persistence in PostgreSQL
export async function getSystemSetting(key: string): Promise<any> {
  try {
    const res = await pool.query('SELECT value FROM system_settings WHERE key = $1', [key]);
    if (res.rows && res.rows.length > 0) {
      return res.rows[0].value;
    }
    return null;
  } catch (err) {
    console.error(`Error reading system setting "${key}":`, err);
    return null;
  }
}

export async function setSystemSetting(key: string, value: any): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value)]
    );
    return true;
  } catch (err) {
    console.error(`Error writing system setting "${key}":`, err);
    return false;
  }
}

// Password security helpers using scrypt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combined: string): boolean {
  try {
    const [salt, key] = combined.split(':');
    if (!salt || !key) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

