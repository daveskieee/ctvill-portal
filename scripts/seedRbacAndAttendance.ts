/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { pool, hashPassword } from '../server/db';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  console.log('--- SEEDING 4 ROLES, WORKERS, ASSIGNMENTS & ATTENDANCE ---');

  // 1. Ensure 4 Role Users exist
  const users = [
    {
      id: 'usr-admin-om',
      email: 'om@ctvill.com',
      name: 'Operations Manager',
      role: 'ADMIN',
      password: 'admin123',
      contact: '+63 917 100 0001'
    },
    {
      id: 'usr-admin-default',
      email: 'admin@ctvill.com',
      name: 'Dave Matthew Reglos (Admin)',
      role: 'ADMIN',
      password: 'admin123',
      contact: '+63 917 100 0002'
    },
    {
      id: 'usr-site-engineer',
      email: 'engineer@ctvill.com',
      name: 'Engr. Marco Santos',
      role: 'ENGINEER',
      password: 'pm123',
      contact: '+63 917 200 0002'
    },
    {
      id: 'usr-pm-legacy',
      email: 'pm@ctvill.com',
      name: 'Project Manager / Site Engineer',
      role: 'ENGINEER',
      password: 'pm123',
      contact: '+63 917 200 0001'
    },
    {
      id: 'usr-site-timekeeper',
      email: 'timekeeper@ctvill.com',
      name: 'Rodel Reyes (Site Timekeeper)',
      role: 'TIMEKEEPER',
      password: 'tk123',
      contact: '+63 917 300 0003'
    },
    {
      id: 'usr-finance-controller',
      email: 'finance@ctvill.com',
      name: 'Clarisse Mendoza (Finance Controller)',
      role: 'FINANCE',
      password: 'finance123',
      contact: '+63 917 400 0004'
    }
  ];

  // Fetch a project ID for assignments
  const projRes = await pool.query('SELECT id, name FROM commercial_projects LIMIT 4');
  const projectList = projRes.rows;
  const mainProjectId = projectList[0]?.id || 'PRJ-4693';
  const secondProjectId = projectList[1]?.id || 'PRJ-0105';
  console.log(`Using primary project: ${mainProjectId} (${projectList[0]?.name})`);

  for (const u of users) {
    const pHash = hashPassword(u.password);
    await pool.query(`
      INSERT INTO users (id, email, name, role, "accountStatus", "passwordHash", contact, project_ids, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4::"Role", 'ACTIVE', $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        "passwordHash" = EXCLUDED."passwordHash",
        project_ids = EXCLUDED.project_ids,
        "updatedAt" = CURRENT_TIMESTAMP
    `, [u.id, u.email.toLowerCase(), u.name, u.role, pHash, u.contact, [mainProjectId, secondProjectId]]);
    console.log(`  ✅ User: ${u.email} [${u.role}] (Pass: ${u.password})`);
  }

  // 2. Seed Workers (Labor Masterlist)
  const workerSeeds = [
    { id: 'WRK-001', firstName: 'Danilo', lastName: 'Mercado', dailyRate: 950.00, position: 'General Foreman', status: 'Active' },
    { id: 'WRK-002', firstName: 'Nestor', lastName: 'Alcantara', dailyRate: 850.00, position: 'Lead Carpenter (Skilled)', status: 'Active' },
    { id: 'WRK-003', firstName: 'Rodrigo', lastName: 'Bautista', dailyRate: 850.00, position: 'Master Electrician (Skilled)', status: 'Active' },
    { id: 'WRK-004', firstName: 'Eduardo', lastName: 'Villanueva', dailyRate: 800.00, position: 'Lead Welder & Steelman', status: 'Active' },
    { id: 'WRK-005', firstName: 'Reynaldo', lastName: 'Castro', dailyRate: 750.00, position: 'Mason & Plasterer (Skilled)', status: 'Active' },
    { id: 'WRK-006', firstName: 'Arnel', lastName: 'Soriano', dailyRate: 750.00, position: 'Plumber & Pipefitter (Skilled)', status: 'Active' },
    { id: 'WRK-007', firstName: 'Joel', lastName: 'Dela Cruz', dailyRate: 550.00, position: 'General Site Laborer', status: 'Active' },
    { id: 'WRK-008', firstName: 'Crisanto', lastName: 'Mendoza', dailyRate: 550.00, position: 'General Site Laborer', status: 'Active' },
    { id: 'WRK-009', firstName: 'Benigno', lastName: 'Tolentino', dailyRate: 550.00, position: 'General Site Laborer', status: 'Active' },
    { id: 'WRK-010', firstName: 'Manuel', lastName: 'Navarro', dailyRate: 600.00, position: 'Finishing Helper', status: 'Active' },
  ];

  console.log('\nSeeding Workers Masterlist...');
  for (const w of workerSeeds) {
    const otRate = Number(((w.dailyRate / 8) * 1.25).toFixed(2));
    await pool.query(`
      INSERT INTO workers (id, first_name, last_name, daily_rate, hourly_ot_rate, position, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        daily_rate = EXCLUDED.daily_rate,
        hourly_ot_rate = EXCLUDED.hourly_ot_rate,
        position = EXCLUDED.position,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `, [w.id, w.firstName, w.lastName, w.dailyRate, otRate, w.position, w.status]);

    // Assign worker to main project
    await pool.query(`
      INSERT INTO project_worker_assignments (id, project_id, worker_id, assigned_at, status)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'ACTIVE')
      ON CONFLICT (project_id, worker_id) DO NOTHING
    `, [`PWA-${mainProjectId.slice(-4)}-${w.id}`, mainProjectId, w.id]);
  }
  console.log(`  ✅ Seeded ${workerSeeds.length} workers and assigned to ${mainProjectId}.`);

  // 3. Seed Cash Advances (Vale)
  console.log('\nSeeding Cash Advances (Vale)...');
  const advances = [
    { id: 'VALE-2026-001', workerId: 'WRK-002', amount: 1500.00, notes: 'Emergency medical assistance vale' },
    { id: 'VALE-2026-002', workerId: 'WRK-007', amount: 800.00, notes: 'Mid-week transportation allowance cash advance' },
    { id: 'VALE-2026-003', workerId: 'WRK-005', amount: 500.00, notes: 'Tool replacement advance' },
  ];

  for (const adv of advances) {
    await pool.query(`
      INSERT INTO cash_advances (id, project_id, worker_id, amount, date_issued, status, notes, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_DATE - INTERVAL '2 days', 'PENDING', $5, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        status = 'PENDING',
        notes = EXCLUDED.notes
    `, [adv.id, mainProjectId, adv.workerId, adv.amount, adv.notes]);
  }
  console.log(`  ✅ Seeded ${advances.length} pending cash advances (vale).`);

  // 4. Seed Attendance Logs for the Past 6 Days (Mon - Sat)
  console.log('\nSeeding Attendance Logs for the weekly cycle...');
  const timekeeperId = 'usr-site-timekeeper';
  
  // Dates for the current weekly cycle
  const dayOffsets = [5, 4, 3, 2, 1, 0]; // 6 working days
  for (const offset of dayOffsets) {
    const dateRes = await pool.query(`SELECT TO_CHAR(CURRENT_DATE - INTERVAL '${offset} days', 'YYYY-MM-DD') as d`);
    const logDate = dateRes.rows[0].d;

    for (const w of workerSeeds) {
      // Deterministic realistic attendance:
      // Most present, occasional half-day or absent, overtime on certain workers
      let status = 'PRESENT';
      let otHours = 0;

      if (w.id === 'WRK-009' && (offset === 3 || offset === 1)) {
        status = 'ABSENT';
      } else if (w.id === 'WRK-008' && offset === 2) {
        status = 'HALF_DAY';
      } else if (w.id === 'WRK-001') {
        otHours = 2.0; // Foreman site coordination OT
      } else if (w.id === 'WRK-002' || w.id === 'WRK-004') {
        otHours = offset % 2 === 0 ? 3.0 : 0.0; // Fabrication rush OT
      } else if (w.id === 'WRK-007' && offset % 3 === 0) {
        otHours = 2.0;
      }

      const logId = `ATT-${mainProjectId.slice(-4)}-${w.id}-${logDate.replace(/-/g, '')}`;
      await pool.query(`
        INSERT INTO attendance_logs (id, project_id, worker_id, logged_by_user_id, date, status, overtime_hours, is_locked, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::DATE, $6, $7, false, CURRENT_TIMESTAMP - INTERVAL '${offset} days', CURRENT_TIMESTAMP)
        ON CONFLICT (project_id, worker_id, date) DO UPDATE SET
          status = EXCLUDED.status,
          overtime_hours = EXCLUDED.overtime_hours,
          is_locked = false,
          updated_at = CURRENT_TIMESTAMP
      `, [logId, mainProjectId, w.id, timekeeperId, logDate, status, otHours]);
    }
  }
  console.log(`  ✅ Seeded daily attendance for ${workerSeeds.length} workers over 6 workdays.`);

  console.log('\n🎉 ALL RBAC & ATTENDANCE SEEDS COMPLETED SUCCESSFULLY!');
}

seed()
  .catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
