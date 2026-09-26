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

