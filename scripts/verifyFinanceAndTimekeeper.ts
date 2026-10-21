import http from 'http';
import { prisma, pool } from '../server/db';
import { createSession, generateCsrfToken } from '../server/services/sessionService';

const PORT = 3001; // Direct backend port
const BASE_URL = `http://localhost:${PORT}`;

interface RoleAuditReport {
  role: string;
  checks: { name: string; status: 'PASS' | 'FAIL'; details: string }[];
}

const reports: RoleAuditReport[] = [];

async function req(urlPath: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  cookie?: string;
  csrfToken?: string;
} = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; json?: any; setCookie?: string; csrfToken?: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Origin': `http://localhost:${PORT}`,
        ...(options.cookie ? { Cookie: options.cookie } : {}),
        ...(options.csrfToken ? { 'x-csrf-token': options.csrfToken } : {}),
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { /* not json */ }
        const rawCookies = res.headers['set-cookie'];
        const setCookie = rawCookies ? (Array.isArray(rawCookies) ? rawCookies.join('; ') : rawCookies) : undefined;
        const csrfMatch = setCookie?.match(/ctvill_csrf=([^;]+)/);
        const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : (json?.csrfToken || undefined);
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: data,
          json,
          setCookie,
          csrfToken,
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runAudit() {
  console.log('\n======================================================');
  console.log('   FINANCE & TIMEKEEPER OPERATIONAL & DATA AUDIT');
  console.log('======================================================\n');

  // Fetch or ensure test users
  const timekeeperUser = await prisma.user.findFirst({
    where: { role: 'TIMEKEEPER' as any }
  });
  const financeUser = await prisma.user.findFirst({
    where: { role: 'FINANCE' as any }
  });

  const sampleProject = await pool.query('SELECT id, name FROM commercial_projects LIMIT 1');
  const projectId = sampleProject.rows[0]?.id || 'PRJ-4693';
  const projectName = sampleProject.rows[0]?.name || '2-Storey Residential House';

  console.log(`Active Reference Project: ${projectName} (${projectId})\n`);

  // --------------------------------------------------------------------------
  // 1. TIMEKEEPER AUDIT
  // --------------------------------------------------------------------------
  const tkReport: RoleAuditReport = { role: 'TIMEKEEPER', checks: [] };

  if (!timekeeperUser) {
    tkReport.checks.push({
      name: 'Timekeeper User Exists in DB',
      status: 'FAIL',
      details: 'No user with role TIMEKEEPER found in database.'
    });
  } else {
    // Generate session
    const tkSession = await createSession(timekeeperUser.id);
    const tkCsrf = generateCsrfToken(tkSession.rawToken);
    const tkCookie = `ctvill_session=${tkSession.rawToken}; ctvill_csrf=${tkCsrf}`;

    // Check 1: /api/auth/me
    const meRes = await req('/api/auth/me', { cookie: tkCookie });
    const meRoleUpper = String(meRes.json?.user?.role || '').toUpperCase();
    tkReport.checks.push({
      name: 'Session Revalidation (/api/auth/me)',
      status: meRes.status === 200 && meRoleUpper === 'TIMEKEEPER' ? 'PASS' : 'FAIL',
      details: `HTTP ${meRes.status}, role=${meRes.json?.user?.role}`
    });

    // Check 2: /api/all-data
    const allDataRes = await req('/api/all-data', { cookie: tkCookie });
    const hasData = allDataRes.status === 200 && Array.isArray(allDataRes.json?.projects);
    const payrollIsHidden = allDataRes.json?.payroll?.length === 0;
    const coIsHidden = allDataRes.json?.changeOrders?.length === 0;
    tkReport.checks.push({
      name: 'All-Data Loading & Project Access',
      status: hasData ? 'PASS' : 'FAIL',
      details: `HTTP ${allDataRes.status}, Projects loaded: ${allDataRes.json?.projects?.length ?? 0}`
    });
    tkReport.checks.push({
      name: 'SoD: Financial Payroll Hidden from Timekeeper',
      status: payrollIsHidden ? 'PASS' : 'FAIL',
      details: `Payroll records exposed: ${allDataRes.json?.payroll?.length ?? 0} (Must be 0)`
    });
    tkReport.checks.push({
      name: 'SoD: Change Orders Hidden from Timekeeper',
      status: coIsHidden ? 'PASS' : 'FAIL',
      details: `Change Orders exposed: ${allDataRes.json?.changeOrders?.length ?? 0} (Must be 0)`
    });

    // Check 3: /api/attendance/roster
    const rosterRes = await req(`/api/attendance/roster?projectId=${projectId}`, { cookie: tkCookie });
    const hasWorkers = rosterRes.status === 200 && Array.isArray(rosterRes.json);
    tkReport.checks.push({
      name: 'Daily Muster Roster (/api/attendance/roster)',
      status: hasWorkers ? 'PASS' : 'FAIL',
      details: `HTTP ${rosterRes.status}, Active field artisans: ${rosterRes.json?.length ?? 0}`
    });

    // Check 4: /api/attendance records query
    const today = new Date().toISOString().split('T')[0];
    const attRes = await req(`/api/attendance?projectId=${projectId}&date=${today}`, { cookie: tkCookie });
    tkReport.checks.push({
      name: 'Daily Attendance Query (/api/attendance)',
      status: attRes.status === 200 && Array.isArray(attRes.json) ? 'PASS' : 'FAIL',
      details: `HTTP ${attRes.status}, Logs returned: ${attRes.json?.length ?? 0}`
    });

    // Check 5: Timekeeper cannot finalize payroll (SoD enforcement)
    const finPayrollRes = await req('/api/payroll/finalize', {
      method: 'POST',
      cookie: tkCookie,
      csrfToken: tkCsrf,
      body: JSON.stringify({ projectId, periodStart: '2026-09-14', periodEnd: '2026-09-21' })
    });
    tkReport.checks.push({
      name: 'SoD: Timekeeper Forbidden from Finalizing Payroll',
      status: finPayrollRes.status === 403 ? 'PASS' : 'FAIL',
      details: `HTTP ${finPayrollRes.status} (Expected 403 Forbidden)`
    });
  }

  reports.push(tkReport);

  // --------------------------------------------------------------------------
  // 2. FINANCE AUDIT
  // --------------------------------------------------------------------------
  const finReport: RoleAuditReport = { role: 'FINANCE', checks: [] };

  if (!financeUser) {
    finReport.checks.push({
      name: 'Finance User Exists in DB',
      status: 'FAIL',
      details: 'No user with role FINANCE found in database.'
    });
  } else {
    // Generate session
    const finSession = await createSession(financeUser.id);
    const finCsrf = generateCsrfToken(finSession.rawToken);
    const finCookie = `ctvill_session=${finSession.rawToken}; ctvill_csrf=${finCsrf}`;

    // Check 1: /api/auth/me
    const meRes = await req('/api/auth/me', { cookie: finCookie });
    const meRoleUpper = String(meRes.json?.user?.role || '').toUpperCase();
    finReport.checks.push({
      name: 'Session Revalidation (/api/auth/me)',
      status: meRes.status === 200 && meRoleUpper === 'FINANCE' ? 'PASS' : 'FAIL',
      details: `HTTP ${meRes.status}, role=${meRes.json?.user?.role}`
    });

    // Check 2: /api/all-data
    const allDataRes = await req('/api/all-data', { cookie: finCookie });
    const hasData = allDataRes.status === 200;
    const hasProjects = (allDataRes.json?.projects?.length ?? 0) > 0;
    const hasExtendedPayroll = Array.isArray(allDataRes.json?.extendedPayroll);
    const hasChangeOrders = Array.isArray(allDataRes.json?.changeOrders);
    const hasQuotations = Array.isArray(allDataRes.json?.quotations);

    finReport.checks.push({
      name: 'Global Financial Data in /api/all-data',
      status: hasData && hasProjects && hasExtendedPayroll ? 'PASS' : 'FAIL',
      details: `HTTP ${allDataRes.status}, Projects: ${allDataRes.json?.projects?.length ?? 0}, ExtendedPayroll items: ${allDataRes.json?.extendedPayroll?.length ?? 0}, ChangeOrders: ${allDataRes.json?.changeOrders?.length ?? 0}, Quotes: ${allDataRes.json?.quotations?.length ?? 0}`
    });

    // Check 3: /api/payroll/runs
    const runsRes = await req('/api/payroll/runs', { cookie: finCookie });
    finReport.checks.push({
      name: 'Payroll History Ledger (/api/payroll/runs)',
      status: runsRes.status === 200 && Array.isArray(runsRes.json) ? 'PASS' : 'FAIL',
      details: `HTTP ${runsRes.status}, Historical runs: ${runsRes.json?.length ?? 0}`
    });

    // Check 4: /api/payroll/calculate
    const calcRes = await req('/api/payroll/calculate', {
      method: 'POST',
      cookie: finCookie,
      csrfToken: finCsrf,
      body: JSON.stringify({
        projectId,
        periodStart: '2026-09-14',
        periodEnd: '2026-09-21'
      })
    });
    finReport.checks.push({
      name: 'Payroll Calculation Engine (/api/payroll/calculate)',
      status: calcRes.status === 200 && calcRes.json?.draft ? 'PASS' : 'FAIL',
      details: `HTTP ${calcRes.status}, Calculated gross: ₱${calcRes.json?.draft?.totalGross ?? 0}, workers: ${calcRes.json?.draft?.workerCount ?? 0}`
    });

    // Check 5: /api/subcontractor-payables
    const payablesRes = await req('/api/subcontractor-payables', { cookie: finCookie });
    finReport.checks.push({
      name: 'Subcontractor Accounts Payable (/api/subcontractor-payables)',
      status: payablesRes.status === 200 && Array.isArray(payablesRes.json) ? 'PASS' : 'FAIL',
      details: `HTTP ${payablesRes.status}, Payables records: ${payablesRes.json?.length ?? 0}`
    });

    // Check 6: Read-only attendance inspection
    const attInspectRes = await req(`/api/attendance?projectId=${projectId}`, { cookie: finCookie });
    finReport.checks.push({
      name: 'Attendance Read-Only Audit (/api/attendance)',
      status: attInspectRes.status === 200 && Array.isArray(attInspectRes.json) ? 'PASS' : 'FAIL',
      details: `HTTP ${attInspectRes.status}, Records accessible for audit: ${attInspectRes.json?.length ?? 0}`
    });

    const today = new Date().toISOString().split('T')[0];
    const attMutateRes = await req('/api/attendance', {
      method: 'POST',
      cookie: finCookie,
      csrfToken: finCsrf,
      body: JSON.stringify({
        projectId,
        date: today,
        records: [{ workerId: 'test-w', status: 'PRESENT', overtimeHours: 0 }]
      })
    });
    finReport.checks.push({
      name: 'SoD: Finance Forbidden from Direct Attendance Mutation',
      status: attMutateRes.status === 403 ? 'PASS' : 'FAIL',
      details: `HTTP ${attMutateRes.status} (Expected 403 Forbidden)`
    });
  }

  reports.push(finReport);

  // Print results
  for (const rep of reports) {
    console.log(`=== ROLE: ${rep.role} ===`);
    for (const c of rep.checks) {
      const mark = c.status === 'PASS' ? '✅' : '❌';
      console.log(`  ${mark} [${c.status}] ${c.name}: ${c.details}`);
    }
    console.log('');
  }

  const allPassed = reports.every(r => r.checks.every(c => c.status === 'PASS'));
  console.log(allPassed ? 'ALL AUDIT CHECKS PASSED ✅' : 'SOME AUDIT CHECKS FAILED ❌');
  
  await pool.end();
  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

runAudit().catch(err => {
  console.error('Audit exception:', err);
  process.exit(1);
});
