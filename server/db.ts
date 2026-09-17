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
  max: 25,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
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
    console.log('✅ PostgreSQL commercial fit-out schema initialized.');
  } catch (err) {
    console.error('Database initialization error:', err);
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

