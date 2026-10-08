import fetch from 'node-fetch';

async function verifyPipeline() {
  console.log('=== RUNNING WORKFORCE & PAYROLL INTEGRATION VERIFICATION ===\n');
  const baseUrl = 'http://localhost:3001';

  // 1. Fetch Projects to get ID of "2-Storey Residential House"
  console.log('Step 0: Locating "2-Storey Residential House" project...');
  const projRes = await fetch(`${baseUrl}/api/projects`, {
    headers: { 'x-user-role': 'ADMIN' }
  });
  const projects: any = await projRes.json();
  const targetProject = projects.find((p: any) => p.name.includes('2-Storey Residential House')) || projects[0];
  console.log(`  Found Project: "${targetProject.name}" (ID: ${targetProject.id})`);

  // 2. Register New Worker "Juan Dela Cruz", Mason, ₱600/day, assigned to "2-Storey Residential House"
  console.log('\nStep 1: Registering worker "Juan Dela Cruz" via workforce module...');
  const workerPayload = {
    id: `CONT-TEST-${Date.now()}`,
    name: 'Juan Dela Cruz',
    specialty: 'Mason',
    roleTitle: 'Mason',
    dailyRate: 600,
    hourlyOtRate: 93.75,
    activeProjectSite: targetProject.name,
    assignedProjectId: targetProject.id,
    status: 'ACTIVE',
    company: 'CTVill Builders Corporation',
    employmentType: 'INTERNAL',
    activeManpower: 1
  };

  const regRes = await fetch(`${baseUrl}/api/contractors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'ADMIN'
    },
    body: JSON.stringify(workerPayload)
  });
  
  if (!regRes.ok) {
    const err = await regRes.text();
    throw new Error(`Failed to register worker: ${err}`);
  }
  const registeredWorker: any = await regRes.json();
  console.log(`  ✅ Registered: ${registeredWorker.name} (ID: ${registeredWorker.id}, Daily Rate: ₱${registeredWorker.dailyRate})`);

  // 3. Navigate to Daily Roll-Call & Attendance as Timekeeper or OM
  console.log('\nStep 2: Querying muster roll for project in Daily Attendance...');
  const musterRes = await fetch(`${baseUrl}/api/workers?projectId=${targetProject.id}&status=Active`, {
    headers: { 'x-user-role': 'TIMEKEEPER' }
  });
  const musterRoll: any = await musterRes.json();
  const foundInMuster = musterRoll.find((w: any) => w.id === registeredWorker.id);
  
  if (!foundInMuster) {
    console.error('Muster roll workers:', musterRoll);
    throw new Error(`Worker "Juan Dela Cruz" not found in muster roll for project ${targetProject.name}`);
  }
  console.log(`  ✅ Verified "Juan Dela Cruz" is in the muster roll: Position: ${foundInMuster.position}, ID: ${foundInMuster.id}`);

  // 4. Log attendance for "Juan Dela Cruz" (Present + 2 hrs OT)
  const testDate = '2026-09-28';
  console.log(`\nStep 3: Logging attendance for "Juan Dela Cruz" on ${testDate} (PRESENT + 2.0 hrs OT)...`);
  const attRes = await fetch(`${baseUrl}/api/attendance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'TIMEKEEPER',
      'x-user-id': 'USR-004'
    },
    body: JSON.stringify({
      projectId: targetProject.id,
      date: testDate,
      entries: [
        {
          workerId: registeredWorker.id,
          status: 'PRESENT',
          overtimeHours: 2.0
        }
      ]
    })
  });

  if (!attRes.ok) {
    const err = await attRes.text();
    throw new Error(`Failed to log attendance: ${err}`);
  }
  console.log('  ✅ Attendance successfully saved.');

  // 5. Navigate to Weekly Site Payroll Engine as Finance: Click "Calculate Draft"
  console.log('\nStep 4: Running weekly payroll calculation as Finance...');
  const periodStart = '2026-09-28';
  const periodEnd = '2026-10-03';
  
  const payrollRes = await fetch(`${baseUrl}/api/payroll/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'FINANCE',
      'x-user-id': 'USR-005'
    },
    body: JSON.stringify({
      projectId: targetProject.id,
      periodStart,
      periodEnd
    })
  });

  if (!payrollRes.ok) {
    const err = await payrollRes.text();
    throw new Error(`Failed to calculate payroll: ${err}`);
  }

  const payrollDraft: any = await payrollRes.json();
  console.log(`  Draft Generated: Total Gross = ₱${payrollDraft.draft.totalGross}, Workers = ${payrollDraft.draft.workerCount}`);
  
  const juanItem = payrollDraft.draft.items.find((item: any) => item.workerId === registeredWorker.id);
  if (!juanItem) {
    console.error('Payroll items:', payrollDraft.draft.items);
    throw new Error('Juan Dela Cruz not found in payroll draft items!');
  }

  console.log('\n=== PAYROLL BREAKDOWN FOR JUAN DELA CRUZ ===');
  console.log(`  Worker Name:     ${juanItem.workerName}`);
  console.log(`  Position:        ${juanItem.position}`);
  console.log(`  Daily Rate:      ₱${juanItem.dailyRate}`);
  console.log(`  Days Worked:     ${juanItem.daysWorked}`);
  console.log(`  Base Pay:        ₱${juanItem.basePay} (Expected: ₱600.00)`);
  console.log(`  OT Hours:        ${juanItem.otHours} hrs`);
  console.log(`  Hourly OT Rate:  ₱${juanItem.hourlyOtRate}`);
  console.log(`  OT Pay:          ₱${juanItem.otPay} (Expected: 2 * ₱93.75 = ₱187.50)`);
  console.log(`  Gross Pay:       ₱${juanItem.grossPay} (Expected: ₱787.50)`);
  console.log(`  Net Pay:         ₱${juanItem.netPay} (Expected: ₱787.50)`);

  if (juanItem.basePay === 600 && juanItem.otPay === 187.5 && juanItem.grossPay === 787.5) {
    console.log('\n🎉 ALL VERIFICATION CRITERIA PERFECTLY SATISFIED!');
  } else {
    throw new Error(`Calculations did not match expected values. Base: ${juanItem.basePay}, OT: ${juanItem.otPay}`);
  }
}

verifyPipeline().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
