const { pool } = require('../server/db');

async function sync() {
  const res1 = await pool.query("UPDATE project_tasks SET status = 'COMPLETED' WHERE progress >= 1.0 AND status != 'COMPLETED'");
  console.log('Updated to COMPLETED:', res1.rowCount);
  const res2 = await pool.query("UPDATE project_tasks SET status = 'IN_PROGRESS' WHERE progress > 0 AND progress < 1.0 AND status = 'TODO'");
  console.log('Updated to IN_PROGRESS:', res2.rowCount);
  await pool.end();
}

sync().catch(e => { console.error(e); process.exit(1); });
