import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to PostgreSQL to align project_tasks and task_links...');
  await pool.query(`
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "projectId" TEXT REFERENCES commercial_projects(id) ON DELETE CASCADE;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "wbsCode" TEXT;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "text" TEXT;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "duration" INTEGER DEFAULT 1;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "progress" DOUBLE PRECISION DEFAULT 0.0;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "baselineStart" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "baselineEnd" TIMESTAMP WITH TIME ZONE;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'task';
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "parentTaskId" TEXT;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER DEFAULT 0;
    ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS "assignedContractorId" TEXT REFERENCES contractors(id);

    ALTER TABLE project_tasks ALTER COLUMN "title" DROP NOT NULL;
    ALTER TABLE project_tasks ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE project_tasks ALTER COLUMN "priority" DROP NOT NULL;
    ALTER TABLE project_tasks ALTER COLUMN "status" DROP NOT NULL;

    CREATE TABLE IF NOT EXISTS task_links (
      id TEXT PRIMARY KEY,
      "projectId" TEXT NOT NULL,
      "sourceId" TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
      "targetId" TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
      "type" TEXT DEFAULT '0',
      "lagDays" INTEGER DEFAULT 0
    );
  `);
  console.log('Schema alignment complete!');
  await pool.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
