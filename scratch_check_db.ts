import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || '';
const isCloudDb = connectionString.includes('sslmode=') || connectionString.includes('neon.tech') || connectionString.includes('supabase') || connectionString.includes('render');
const pool = new Pool({ connectionString, ...(isCloudDb ? { ssl: { rejectUnauthorized: false } } : {}) });

async function main() {
  await pool.query('ALTER TABLE contractors ADD COLUMN IF NOT EXISTS active_presence TEXT DEFAULT \'ONLINE\'');
  console.log('ADDED active_presence COLUMN TO contractors TABLE');
  const cols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'contractors';
  `);
  console.log('CONTRACTORS TABLE COLUMNS:', cols.rows.map(r => r.column_name));
  await pool.end();
}
main();
