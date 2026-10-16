/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import dotenv from 'dotenv';
import { prisma, pool, hashPassword, initializeDatabaseTables } from '../db';
import { createSession, hashSessionToken, revokeAllUserSessions, SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from '../services/sessionService';
import { cookieParserMiddleware } from '../middleware/cookies';
import { corsMiddleware, securityHeadersMiddleware, preventSensitiveFileExposure } from '../middleware/security';
import { ensureCsrfCookieMiddleware, verifyCsrfMiddleware } from '../middleware/csrf';
import { authenticateRequest, requireAuth, requireRole, requireExactRole, normalizeAppRole, checkUserProjectAccess } from '../middleware/auth';
import { normalizeRole, UserRole } from '../middleware/rbac';
import { authRouter, isPasswordStrong } from '../routes/auth';
import { projectsRouter } from '../routes/projects';
import { payrollRouter } from '../routes/payroll';
import { attendanceRouter } from '../routes/attendance';
import { Role, AccountStatus } from '@prisma/client';

dotenv.config();
process.env.NODE_ENV = 'test';

// Create test application instance
function createTestApp() {
  const app = express();
  app.use(securityHeadersMiddleware);
  app.use(corsMiddleware);
  app.use(preventSensitiveFileExposure);
  app.use(cookieParserMiddleware);
  app.use(express.json());
  app.use(ensureCsrfCookieMiddleware);
  app.use(authenticateRequest);
  app.use('/api', verifyCsrfMiddleware);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', authRouter);
  app.use('/api', projectsRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/attendance', attendanceRouter);

  return app;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  Testing: ${name}... `);
  try {
    await fn();
    console.log('✅ PASSED');
    results.push({ name, passed: true });
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    results.push({ name, passed: false, error: err.message });
  }
}

// Helper to make requests with cookies and headers
async function request(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
    csrfToken?: string;
  } = {}
) {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = { ...options.headers };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }
  if (options.csrfToken) {
    headers['X-CSRF-Token'] = options.csrfToken;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}

  // Parse cookies from response
  const setCookie = res.headers.get('set-cookie');
  let sessionCookie: string | undefined;
  let csrfCookie: string | undefined;

  if (setCookie) {
    const sessionMatch = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (sessionMatch) sessionCookie = sessionMatch[1];
    const csrfMatch = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
    if (csrfMatch) csrfCookie = csrfMatch[1];
  }

  return {
    status: res.status,
    headers: res.headers,
    json,
    text,
    sessionCookie,
    csrfCookie,
  };
}

async function main() {
  console.log('\n🔒 ==============================================================');
  console.log('   CTVILL ERP — PHASE 1 SECURITY & AUTHENTICATION TEST SUITE');
  console.log('==============================================================\n');

  await initializeDatabaseTables();

  const app = createTestApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Ensure test users exist in DB with known passwords
  const testAdminEmail = 'test.admin.phase1@ctvill.internal';
  const testTimekeeperEmail = 'test.timekeeper.phase1@ctvill.internal';
  const testFinanceEmail = 'test.finance.phase1@ctvill.internal';
  const testEngineerEmail = 'test.engineer.phase1@ctvill.internal';
  const testSuspendedEmail = 'test.suspended.phase1@ctvill.internal';
  const testPassword = 'Password123!';

  // Clean up old test accounts safely
  await prisma.user.deleteMany({
    where: { email: { in: [testAdminEmail, testTimekeeperEmail, testFinanceEmail, testEngineerEmail, testSuspendedEmail] } }
  }).catch(() => {});

  const testAdmin = await prisma.user.create({
    data: {
      email: testAdminEmail,
      name: 'Test Administrator',
      role: Role.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      passwordHash: hashPassword(testPassword),
      projectIds: [],
    }
  });

  const testTimekeeper = await prisma.user.create({
    data: {
      email: testTimekeeperEmail,
      name: 'Test Timekeeper',
      role: Role.TIMEKEEPER,
      accountStatus: AccountStatus.ACTIVE,
      passwordHash: hashPassword(testPassword),
      projectIds: ['PRJ-4693'],
    }
  });

  const testFinance = await prisma.user.create({
    data: {
      email: testFinanceEmail,
      name: 'Test Finance Officer',
      role: Role.FINANCE,
      accountStatus: AccountStatus.ACTIVE,
      passwordHash: hashPassword(testPassword),
      projectIds: [],
    }
  });

  const testEngineer = await prisma.user.create({
    data: {
      email: testEngineerEmail,
      name: 'Test Site Engineer',
      role: Role.ENGINEER,
      accountStatus: AccountStatus.ACTIVE,
      passwordHash: hashPassword(testPassword),
      projectIds: ['PRJ-4693'],
    }
  });

  const testSuspended = await prisma.user.create({
    data: {
      email: testSuspendedEmail,
      name: 'Test Suspended User',
      role: Role.ENGINEER,
      accountStatus: AccountStatus.SUSPENDED,
      passwordHash: hashPassword(testPassword),
      projectIds: [],
    }
  });

  try {
    // 1. Password Strength Validation
    await runTest('Password strength policy requires min 8 chars with letters & numbers', async () => {
      assert.strictEqual(isPasswordStrong('short').valid, false);
      assert.strictEqual(isPasswordStrong('alllettersnodigits').valid, false);
      assert.strictEqual(isPasswordStrong('12345678').valid, false);
      assert.strictEqual(isPasswordStrong('ValidPass123').valid, true);
    });

    // 2. Valid credentials authenticate and return session cookie
    let adminCookie = '';
    let adminCsrf = '';
    await runTest('Valid credentials authenticate active user and issue HttpOnly session cookie', async () => {
      const res = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testAdminEmail, password: testPassword },
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json?.success, true);
      assert.ok(res.json?.session);
      assert.strictEqual(res.json.session.role, 'Admin');
      assert.ok(res.sessionCookie, 'Session cookie must be set');
      assert.ok(res.csrfCookie || res.json.csrfToken, 'CSRF cookie or token must be issued');

      adminCookie = `${SESSION_COOKIE_NAME}=${res.sessionCookie}`;
      adminCsrf = res.csrfCookie || res.json.csrfToken;
    });

    // 3. Incorrect credentials rejected
    await runTest('Incorrect credentials rejected with generic error (no user enumeration)', async () => {
      const res = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testAdminEmail, password: 'WrongPassword999!' },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.json?.error, 'Invalid email or password.');

      // Non-existent email returns same generic error
      const nonExistent = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: 'nonexistent999@ctvill.internal', password: 'AnyPassword123!' },
      });
      assert.strictEqual(nonExistent.status, 401);
      assert.strictEqual(nonExistent.json?.error, 'Invalid email or password.');
    });

    // 4. Requests without valid session return 401
    await runTest('Protected endpoints return 401 Unauthorized without session', async () => {
      const res = await request(baseUrl, '/api/auth/me');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.json?.code, 'UNAUTHORIZED');

      const staffRes = await request(baseUrl, '/api/staff');
      assert.strictEqual(staffRes.status, 401);

      const projectsRes = await request(baseUrl, '/api/projects');
      assert.strictEqual(projectsRes.status, 401);
    });

    // 5. Forged x-user-role and x-user-id cannot elevate privileges
    await runTest('Forged x-user-role and x-user-id headers are ignored and cannot elevate privileges', async () => {
      const res = await request(baseUrl, '/api/staff', {
        headers: {
          'x-user-role': 'ADMIN',
          'x-user-id': testAdmin.id,
          'user-role': 'ADMIN',
        }
      });
      assert.strictEqual(res.status, 401, 'Request with forged headers must be rejected as 401');
    });

    // 6. User IDs in query or body cannot impersonate another user
    await runTest('Query parameter and body userId cannot impersonate another user', async () => {
      const res = await request(baseUrl, `/api/auth/profile?userId=${testAdmin.id}`);
      assert.strictEqual(res.status, 401, 'Unauthenticated query param userId must return 401');

      // Authenticate as timekeeper
      const tkRes = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testTimekeeperEmail, password: testPassword },
      });
      const tkCookie = `${SESSION_COOKIE_NAME}=${tkRes.sessionCookie}`;
      const tkCsrf = tkRes.csrfCookie || tkRes.json.csrfToken;

      // Timekeeper attempts to read profile passing admin's ID
      const spoofProfile = await request(baseUrl, `/api/auth/profile?userId=${testAdmin.id}`, {
        cookie: tkCookie,
      });
      assert.strictEqual(spoofProfile.status, 200);
      // Profile MUST be the authenticated timekeeper's profile, NOT the admin's!
      assert.strictEqual(spoofProfile.json?.profile?.id, testTimekeeper.id);
      assert.strictEqual(spoofProfile.json?.profile?.role, 'Timekeeper');
    });

    // 7. Unknown roles cannot become administrators
    await runTest('Unknown and unmapped roles reject access and NEVER normalize to ADMIN', async () => {
      assert.strictEqual(normalizeAppRole('HACKER'), null);
      assert.strictEqual(normalizeAppRole(''), null);
      assert.strictEqual(normalizeAppRole(null), null);
      assert.strictEqual(normalizeRole('INVALID_ROLE'), UserRole.UNAUTHORIZED);
      assert.strictEqual(normalizeRole(undefined), UserRole.UNAUTHORIZED);
    });

    // 8. Restricted operations return 403 for authenticated users without permission
    await runTest('Restricted operations return 403 Forbidden for unauthorized roles', async () => {
      // Timekeeper session
      const tkLogin = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testTimekeeperEmail, password: testPassword },
      });
      const tkCookie = `${SESSION_COOKIE_NAME}=${tkLogin.sessionCookie}; ${CSRF_COOKIE_NAME}=${tkLogin.csrfCookie}`;
      const tkCsrf = tkLogin.csrfCookie || tkLogin.json.csrfToken;

      // Timekeeper attempts to view staff list (ADMIN only)
      const staffRes = await request(baseUrl, '/api/staff', { cookie: tkCookie });
      assert.strictEqual(staffRes.status, 403);
    });

    // 9. Timekeeper cannot approve payroll or access unauthorized financial actions
    await runTest('Timekeeper cannot finalize/approve payroll (Separation of Duties)', async () => {
      const tkLogin = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testTimekeeperEmail, password: testPassword },
      });
      const tkCookie = `${SESSION_COOKIE_NAME}=${tkLogin.sessionCookie}; ${CSRF_COOKIE_NAME}=${tkLogin.csrfCookie}`;
      const tkCsrf = tkLogin.csrfCookie || tkLogin.json.csrfToken;

      const payrollRes = await request(baseUrl, '/api/payroll/finalize', {
        method: 'POST',
        cookie: tkCookie,
        csrfToken: tkCsrf,
        body: {
          projectId: 'PRJ-4693',
          periodStart: '2026-09-14',
          periodEnd: '2026-09-21',
        }
      });
      assert.strictEqual(payrollRes.status, 403);
      assert.strictEqual(payrollRes.json?.code, 'FORBIDDEN_SOD');
    });

    // 10. Finance users cannot create Administrator accounts
    await runTest('Finance users cannot create Administrator accounts (Admin only)', async () => {
      const finLogin = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testFinanceEmail, password: testPassword },
      });
      const finCookie = `${SESSION_COOKIE_NAME}=${finLogin.sessionCookie}; ${CSRF_COOKIE_NAME}=${finLogin.csrfCookie}`;
      const finCsrf = finLogin.csrfCookie || finLogin.json.csrfToken;

      const createAdminRes = await request(baseUrl, '/api/staff', {
        method: 'POST',
        cookie: finCookie,
        csrfToken: finCsrf,
        body: {
          email: 'rogue.admin@ctvill.internal',
          name: 'Rogue Admin',
          password: 'Password123!',
          role: 'Admin',
        }
      });
      assert.strictEqual(createAdminRes.status, 403);
    });

    // 11. Project assignment scoping checks
    await runTest('Users restricted by projectIds cannot access unauthorized projects', async () => {
      const user = {
        id: 'u1',
        email: 'eng@ctvill.com',
        name: 'Engineer',
        role: 'ENGINEER' as const,
        projectIds: ['PRJ-4693'],
      };

      assert.strictEqual(checkUserProjectAccess(user, 'PRJ-4693'), true);
      assert.strictEqual(checkUserProjectAccess(user, 'PRJ-OTHER-999'), false);

      // Admin has global access
      const admin = {
        id: 'u2',
        email: 'admin@ctvill.com',
        name: 'Admin',
        role: 'ADMIN' as const,
        projectIds: [],
      };
      assert.strictEqual(checkUserProjectAccess(admin, 'PRJ-OTHER-999'), true);
    });

    // 12. Suspended accounts are rejected
    await runTest('Suspended accounts cannot log in or access resources', async () => {
      const res = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testSuspendedEmail, password: testPassword },
      });
      assert.strictEqual(res.status, 403);
      assert.ok(res.json?.error?.toLowerCase().includes('suspended'));
    });

    // 13. Expired sessions are rejected
    await runTest('Expired sessions are rejected with 401', async () => {
      // Create session expired in the past
      const { rawToken } = await createSession(testAdmin.id, { rememberMe: false });
      const tokenHash = hashSessionToken(rawToken);
      await prisma.session.update({
        where: { tokenHash },
        data: { expiresAt: new Date(Date.now() - 10000) }
      });

      const res = await request(baseUrl, '/api/auth/me', {
        cookie: `${SESSION_COOKIE_NAME}=${rawToken}`,
      });
      assert.strictEqual(res.status, 401);
    });

    // 14. Logout invalidates the active server-side session
    await runTest('Logout invalidates active session in PostgreSQL and clears cookie', async () => {
      const loginRes = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testAdminEmail, password: testPassword },
      });
      const cookie = `${SESSION_COOKIE_NAME}=${loginRes.sessionCookie}; ${CSRF_COOKIE_NAME}=${loginRes.csrfCookie}`;
      const csrf = loginRes.csrfCookie || loginRes.json.csrfToken;

      // Verify authenticated
      const meRes = await request(baseUrl, '/api/auth/me', { cookie });
      assert.strictEqual(meRes.status, 200);

      // Logout
      const logoutRes = await request(baseUrl, '/api/auth/logout', {
        method: 'POST',
        cookie,
        csrfToken: csrf,
      });
      assert.strictEqual(logoutRes.status, 200);

      // Verify session is dead
      const postLogoutMe = await request(baseUrl, '/api/auth/me', { cookie });
      assert.strictEqual(postLogoutMe.status, 401);
    });

    // 15. Password changes invalidate existing sessions
    await runTest('Password change invalidates existing sessions', async () => {
      // Create session 1
      const login1 = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testEngineerEmail, password: testPassword },
      });
      const cookie1 = `${SESSION_COOKIE_NAME}=${login1.sessionCookie}; ${CSRF_COOKIE_NAME}=${login1.csrfCookie}`;
      const csrf1 = login1.csrfCookie || login1.json.csrfToken;

      // Change password
      const newPass = 'NewEngineerPass123!';
      const changeRes = await request(baseUrl, '/api/auth/change-password', {
        method: 'POST',
        cookie: cookie1,
        csrfToken: csrf1,
        body: {
          currentPassword: testPassword,
          newPassword: newPass,
        }
      });
      assert.strictEqual(changeRes.status, 200);

      // Old session 1 should now be revoked (or invalidated)
      const oldCheck = await request(baseUrl, '/api/auth/me', { cookie: cookie1 });
      assert.strictEqual(oldCheck.status, 401);

      // Can log in with new password
      const newLogin = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: testEngineerEmail, password: newPass },
      });
      assert.strictEqual(newLogin.status, 200);
    });

    // 16. CSRF protection blocks unauthorized state-changing requests
    await runTest('CSRF protection blocks state-changing requests with missing or mismatched token', async () => {
      // Missing token
      const resNoCsrf = await request(baseUrl, '/api/projects', {
        method: 'POST',
        cookie: adminCookie,
        body: { name: 'Unauthorized CSRF Project', clientName: 'Attacker' }
      });
      assert.strictEqual(resNoCsrf.status, 403);
      assert.strictEqual(resNoCsrf.json?.code, 'CSRF_MISSING');

      // Mismatched token
      const resBadCsrf = await request(baseUrl, '/api/projects', {
        method: 'POST',
        cookie: adminCookie,
        csrfToken: 'forged_fake_csrf_token_1234567890',
        body: { name: 'Unauthorized CSRF Project', clientName: 'Attacker' }
      });
      assert.strictEqual(resBadCsrf.status, 403);
    });

    // 17. Existing database records and demo users are preserved
    await runTest('Existing database users and data are intact and preserved', async () => {
      const realAdmin = await prisma.user.findFirst({ where: { email: 'admin@ctvill.com' } });
      assert.ok(realAdmin, 'admin@ctvill.com must exist in database');

      const realOM = await prisma.user.findFirst({ where: { email: 'om@ctvill.com' } });
      assert.ok(realOM, 'om@ctvill.com must exist in database');

      const realFinance = await prisma.user.findFirst({ where: { email: 'finance@ctvill.com' } });
      assert.ok(realFinance, 'finance@ctvill.com must exist in database');

      const realTimekeeper = await prisma.user.findFirst({ where: { email: 'timekeeper@ctvill.com' } });
      assert.ok(realTimekeeper, 'timekeeper@ctvill.com must exist in database');

      const projectCount = await prisma.commercialProject.count();
      assert.ok(projectCount >= 1, 'Commercial projects must be preserved');
    });

  } finally {
    // Clean up test accounts safely
    await prisma.user.deleteMany({
      where: { email: { in: [testAdminEmail, testTimekeeperEmail, testFinanceEmail, testEngineerEmail, testSuspendedEmail] } }
    }).catch(() => {});

    server.close();
  }

  console.log('\n==============================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${results.length} total tests.`);
  console.log('==============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
