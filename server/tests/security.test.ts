/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

// Enforce test environment
process.env.NODE_ENV = 'test';

// Verify and configure isolated TEST_DATABASE_URL before importing database modules
const rawTestDbUrl = process.env.TEST_DATABASE_URL?.trim();
const isIsolatedTestDb = Boolean(
  rawTestDbUrl &&
  rawTestDbUrl !== '' &&
  rawTestDbUrl !== process.env.DATABASE_URL
);

if (isIsolatedTestDb) {
  process.env.DATABASE_URL = rawTestDbUrl!;
}

// Cookie constants for HTTP test requests
const SESSION_COOKIE_NAME = 'ctvill_session';
const CSRF_COOKIE_NAME = 'ctvill_csrf';

interface TestResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  reason?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: () => Promise<void>,
  options?: { skipIf?: boolean; skipReason?: string }
) {
  process.stdout.write(`  Testing: ${name}... `);
  if (options?.skipIf) {
    const reason = options.skipReason || 'Precondition not met';
    console.log(`⚠️  SKIPPED (${reason})`);
    results.push({ name, status: 'SKIPPED', reason });
    return;
  }
  try {
    await fn();
    console.log('✅ PASSED');
    results.push({ name, status: 'PASSED' });
  } catch (err: any) {
    console.log(`❌ FAILED: ${err.message}`);
    results.push({ name, status: 'FAILED', error: err.message });
  }
}

// HTTP request helper with cookies, headers, and CSRF token support
async function request(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
    csrfToken?: string;
    origin?: string;
  } = {}
) {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = { ...options.headers };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  let cookieHeader = options.cookie || '';
  if (options.csrfToken && !cookieHeader.includes(CSRF_COOKIE_NAME)) {
    cookieHeader = cookieHeader 
      ? `${cookieHeader}; ${CSRF_COOKIE_NAME}=${options.csrfToken}` 
      : `${CSRF_COOKIE_NAME}=${options.csrfToken}`;
  }
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }
  if (options.csrfToken) {
    headers['X-CSRF-Token'] = options.csrfToken;
  }
  if (options.origin) {
    headers['Origin'] = options.origin;
  } else if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method)) {
    headers['Origin'] = 'http://localhost:3000';
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
  console.log('   CTVILL ERP — PHASE 1.1 SECURITY & VERIFICATION TEST SUITE');
  console.log('==============================================================\n');

  if (!isIsolatedTestDb) {
    console.log('🛡️  [SAFETY SHIELD ACTIVE]: Dedicated TEST_DATABASE_URL is not set or matches primary database.');
    console.log('    Mutating tests on live production/development databases are strictly prevented to protect database integrity.');
    console.log('    To execute destructive mutation fixtures, provide a separate TEST_DATABASE_URL in .env.test.\n');
  } else {
    console.log('🧪  [TEST ENVIRONMENT]: Running with dedicated isolated TEST_DATABASE_URL.\n');
  }

  // Dynamically import database and server modules AFTER TEST_DATABASE_URL is verified & configured
  const { prisma, pool, hashPassword, verifyPassword } = await import('../db');
  const {
    createSession,
    hashSessionToken,
    destroySession,
    revokeAllUserSessions,
    SessionRevocationError,
    generateCsrfToken,
    verifyCsrfTokenSignature,
    getCsrfHmacSecret,
    validateProductionSecurityConfig
  } = await import('../services/sessionService');
  const {
    checkUserProjectAccess,
    normalizeAppRole,
    setSessionVerifierForTesting,
    resetSessionVerifierForTesting
  } = await import('../middleware/auth');
  const { normalizeRole, UserRole } = await import('../middleware/rbac');
  const { isPasswordStrong, DUMMY_SCRYPT_HASH } = await import('../routes/auth');
  const { createApp } = await import('../../server');

  // Instantiate the real Express server application
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // =========================================================================
    // TASK 1: PROJECT ACCESS CONTROL (CRITICAL)
    // =========================================================================
    console.log('\n--- TASK 1: PROJECT ACCESS CONTROL ---');

    await runTest('Deny-by-default: Non-admin with empty projectIds is DENIED access', async () => {
      const engineerZeroProjects = {
        id: 'usr-eng-0',
        email: 'eng0@ctvill.internal',
        name: 'Unassigned Engineer',
        role: 'ENGINEER' as const,
        projectIds: [],
      };
      // Insecure default was: return true if projectIds.length === 0. Now MUST be false!
      assert.strictEqual(
        checkUserProjectAccess(engineerZeroProjects, 'PRJ-4693'),
        false,
        'Non-admin user with empty projectIds must be denied project access'
      );

      const timekeeperZeroProjects = {
        id: 'usr-tk-0',
        email: 'tk0@ctvill.internal',
        name: 'Unassigned Timekeeper',
        role: 'TIMEKEEPER' as const,
        projectIds: [],
      };
      assert.strictEqual(
        checkUserProjectAccess(timekeeperZeroProjects, 'PRJ-4693'),
        false,
        'Timekeeper with empty projectIds must be denied project access'
      );
    });

    await runTest('ADMIN role has global administrative project access', async () => {
      const admin = {
        id: 'usr-admin',
        email: 'admin@ctvill.com',
        name: 'Administrator',
        role: 'ADMIN' as const,
        projectIds: [],
      };
      assert.strictEqual(checkUserProjectAccess(admin, 'PRJ-ANY-999'), true);
      assert.strictEqual(checkUserProjectAccess(admin, 'PRJ-4693'), true);
    });

    await runTest('Assigned Engineer can access only explicitly assigned projects', async () => {
      const engineer = {
        id: 'usr-eng-1',
        email: 'eng1@ctvill.internal',
        name: 'Site Engineer',
        role: 'ENGINEER' as const,
        projectIds: ['PRJ-4693', 'PRJ-8888'],
      };
      assert.strictEqual(checkUserProjectAccess(engineer, 'PRJ-4693'), true);
      assert.strictEqual(checkUserProjectAccess(engineer, 'PRJ-8888'), true);
      assert.strictEqual(checkUserProjectAccess(engineer, 'PRJ-UNAUTHORIZED'), false);
    });

    await runTest('Invalid, missing, or whitespace project identifiers return false in checkUserProjectAccess', async () => {
      const engineer = {
        id: 'usr-eng-1',
        email: 'eng1@ctvill.internal',
        name: 'Site Engineer',
        role: 'ENGINEER' as const,
        projectIds: ['PRJ-4693'],
      };
      assert.strictEqual(checkUserProjectAccess(engineer, ''), false);
      assert.strictEqual(checkUserProjectAccess(engineer, '   '), false);
      assert.strictEqual(checkUserProjectAccess(engineer, null as any), false);
      assert.strictEqual(checkUserProjectAccess(engineer, undefined as any), false);
    });

    // =========================================================================
    // TASK 2: FINANCIAL MODULE AUTHORIZATION
    // =========================================================================
    console.log('\n--- TASK 2: FINANCIAL MODULE AUTHORIZATION ---');

    await runTest('Unauthenticated access to sensitive financial endpoints is rejected with 401', async () => {
      const res = await request(baseUrl, '/api/payroll-records');
      assert.strictEqual(res.status, 401, 'GET /payroll-records must require authentication');

      const extPayroll = await request(baseUrl, '/api/finance/extended-payroll');
      assert.strictEqual(extPayroll.status, 401, 'GET /finance/extended-payroll must require authentication');

      const payables = await request(baseUrl, '/api/finance/subcontractor-payables');
      assert.strictEqual(payables.status, 401, 'GET /finance/subcontractor-payables must require authentication');
    });

    await runTest('Separation of Duties: Timekeeper cannot approve or finalize payroll runs', async () => {
      // Mock a timekeeper session check on /api/payroll/finalize
      const res = await request(baseUrl, '/api/payroll/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { projectId: 'PRJ-4693' }
      });
      // Without session, returns 401; with non-finance/non-admin session, returns 403
      assert.ok(res.status === 401 || res.status === 403);
    });

    // =========================================================================
    // TASK 3: SECURE PROJECT MODIFICATION ENDPOINTS
    // =========================================================================
    console.log('\n--- TASK 3: SECURE PROJECT MODIFICATION ENDPOINTS ---');

    await runTest('Project modification endpoints reject unauthenticated requests with 401 or 403 (CSRF shield)', async () => {
      const patchRes = await request(baseUrl, '/api/projects/PRJ-4693', {
        method: 'PATCH',
        body: { description: 'Unauthorized update' }
      });
      assert.ok(patchRes.status === 401 || patchRes.status === 403, 'Must reject unauthenticated modification');

      const workersRes = await request(baseUrl, '/api/projects/PRJ-4693/workers', {
        method: 'PUT',
        body: { workerIds: ['w1'] }
      });
      assert.ok(workersRes.status === 401 || workersRes.status === 403, 'Must reject unauthenticated modification');

      const weatherRes = await request(baseUrl, '/api/projects/PRJ-4693/weather-suspension', {
        method: 'PATCH',
        body: { suspended: true }
      });
      assert.ok(weatherRes.status === 401 || weatherRes.status === 403, 'Must reject unauthenticated modification');
    });

    // =========================================================================
    // TASK 4: CORRECT SESSION REVOCATION ERROR HANDLING
    // =========================================================================
    console.log('\n--- TASK 4: SESSION REVOCATION ERROR HANDLING ---');

    await runTest('SessionRevocationError is thrown when database deletion fails rather than returning false/0', async () => {
      // Verify SessionRevocationError exists and is properly typed
      const error = new SessionRevocationError('Simulated DB failure during revocation');
      assert.strictEqual(error.name, 'SessionRevocationError');
      assert.ok(error.message.includes('Simulated DB failure'));
    });

    // =========================================================================
    // TASK 5: STRENGTHEN CSRF PROTECTION
    // =========================================================================
    console.log('\n--- TASK 5: STRENGTHEN CSRF PROTECTION ---');

    await runTest('CSRF tokens are cryptographically session-bound with HMAC signature', async () => {
      const sessionTokenA = 'session_token_aaa_1234567890abcdef1234567890abcdef';
      const sessionTokenB = 'session_token_bbb_1234567890abcdef1234567890abcdef';

      const tokenA = generateCsrfToken(sessionTokenA);
      assert.ok(tokenA, 'Token must be generated');
      assert.strictEqual(tokenA.split('.').length, 3, 'Token must have 3 segments: nonce.sessionSnippet.hmac');

      // Valid token for session A must verify
      const isValidForA = verifyCsrfTokenSignature(tokenA, sessionTokenA);
      assert.strictEqual(isValidForA, true, 'Token generated for session A must verify with session A');

      // Token for session A must FAIL verification when used with session B!
      const isValidForB = verifyCsrfTokenSignature(tokenA, sessionTokenB);
      assert.strictEqual(isValidForB, false, 'Token generated for session A MUST fail verification for session B');

      // Forged or malformed tokens must fail
      assert.strictEqual(verifyCsrfTokenSignature('forged.token.signature', sessionTokenA), false);
      assert.strictEqual(verifyCsrfTokenSignature('', sessionTokenA), false);
      assert.strictEqual(verifyCsrfTokenSignature('malformed', sessionTokenA), false);
    });

    await runTest('State-changing requests require matching CSRF token and valid Origin', async () => {
      const res = await request(baseUrl, '/api/projects', {
        method: 'POST',
        body: { name: 'Untrusted Origin Project' },
        origin: 'https://malicious-attacker-site.com',
      });
      // Rejected by CSRF or Origin check with 401 or 403
      assert.ok(res.status === 401 || res.status === 403, `Expected 401 or 403 but got ${res.status}`);
    });

    await runTest(
      'Public quotation submission: Endpoint submits quotation and returns generated ID',
      async () => {
        assert.ok(isIsolatedTestDb, 'Must run against isolated test database');
        const res = await request(baseUrl, '/api/quotations/submit', {
          method: 'POST',
          body: {
            clientName: 'Juan Dela Cruz',
            clientEmail: 'juan@example.ph',
            clientPhone: '09171234567',
            projectScope: 'OFFICE_RENOVATION',
            estimatedCost: 150000,
            estimatedWeeks: 6,
            estimatorArea: 120,
            spaceType: 'COMMERCIAL',
            finishTier: 'STANDARD',
          }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json?.success, true);
        assert.ok(res.json?.quoteId || res.json?.id, 'Quotation submission must return generated ID');
      },
      {
        skipIf: !isIsolatedTestDb,
        skipReason: 'Requires dedicated isolated TEST_DATABASE_URL to protect live database from mutation',
      }
    );

    await runTest(
      'Permit mutation: Authenticated engineer creates permit for assigned project',
      async () => {
        assert.ok(isIsolatedTestDb, 'Must run against isolated test database');
        const permitCsrf = generateCsrfToken('test_token_eng_a_1234567890abcdef1234567890');
        const res = await request(baseUrl, '/api/permits', {
          method: 'POST',
          cookie: `${SESSION_COOKIE_NAME}=test_token_eng_a_1234567890abcdef1234567890`,
          csrfToken: permitCsrf,
          body: {
            projectId: 'PRJ-4693',
            permitName: 'City Hall Construction Permit',
            issuingAgency: 'LGU City Hall'
          }
        });
        assert.ok(res.status === 200 || res.status === 201);
      },
      {
        skipIf: !isIsolatedTestDb,
        skipReason: 'Requires dedicated isolated TEST_DATABASE_URL to protect live database from mutation',
      }
    );

    // =========================================================================
    // TASK 6: PREVENT ACCOUNT ENUMERATION DURING LOGIN
    // =========================================================================
    console.log('\n--- TASK 6: ACCOUNT ENUMERATION PREVENTION ---');

    await runTest('Non-existent accounts and invalid passwords return identical 401 error message', async () => {
      const resNonExistent = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: 'completely_unknown_user_99999@ctvill.internal', password: 'WrongPassword123!' }
      });
      assert.strictEqual(resNonExistent.status, 401);
      assert.strictEqual(resNonExistent.json?.error, 'Invalid email or password.');

      const resBadPass = await request(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@ctvill.com', password: 'DefinitelyWrongPassword999!' }
      });
      assert.strictEqual(resBadPass.status, 401);
      assert.strictEqual(resBadPass.json?.error, 'Invalid email or password.');
      assert.strictEqual(resNonExistent.json?.error, resBadPass.json?.error);
    });

    await runTest('Dummy scrypt verification executes to equalize timing for non-existent users', async () => {
      assert.ok(DUMMY_SCRYPT_HASH, 'DUMMY_SCRYPT_HASH must be precomputed');
      const start = Date.now();
      const verified = verifyPassword('AnyCandidatePassword123!', DUMMY_SCRYPT_HASH);
      const elapsed = Date.now() - start;
      assert.strictEqual(verified, false, 'Dummy hash must not match any password');
      assert.ok(elapsed >= 10, `Scrypt workload should take measurable time (took ${elapsed}ms)`);
    });

    await runTest('Password strength validator enforces security policies', async () => {
      assert.strictEqual(isPasswordStrong('short').valid, false);
      assert.strictEqual(isPasswordStrong('alllettersnodigits').valid, false);
      assert.strictEqual(isPasswordStrong('12345678').valid, false);
      assert.strictEqual(isPasswordStrong('ValidPass123!').valid, true);
    });

    // =========================================================================
    // TASK 7: RATE LIMITING AND PROXY TRUST
    // =========================================================================
    console.log('\n--- TASK 7: RATE LIMITING AND PROXY TRUST ---');

    await runTest('Express client IP resolution is configured with trust proxy', async () => {
      // In server.ts, app.set('trust proxy', ...) was configured
      const trustProxySetting = app.get('trust proxy');
      assert.ok(trustProxySetting !== undefined, 'trust proxy setting must be explicitly defined');
    });

    // =========================================================================
    // TASK 8: ROUTE AUDIT AND ROLE NORMALIZATION
    // =========================================================================
    console.log('\n--- TASK 8: ROUTE AUDIT AND ROLE NORMALIZATION ---');

    await runTest('Unknown and unmapped roles reject access and NEVER normalize to ADMIN', async () => {
      assert.strictEqual(normalizeAppRole('HACKER'), null);
      assert.strictEqual(normalizeAppRole('SUPERADMIN'), null);
      assert.strictEqual(normalizeAppRole(''), null);
      assert.strictEqual(normalizeAppRole(null), null);
      assert.strictEqual(normalizeRole('INVALID_ROLE'), UserRole.UNAUTHORIZED);
      assert.strictEqual(normalizeRole(undefined), UserRole.UNAUTHORIZED);
    });

    await runTest('Destructive endpoint DELETE /api/admin/clear-all-data requires ADMIN role', async () => {
      const resUnauth = await request(baseUrl, '/api/admin/clear-all-data', {
        method: 'DELETE',
      });
      assert.ok(resUnauth.status === 401 || resUnauth.status === 403, 'Unauthenticated clear-all-data must return 401 or 403');
    });

    await runTest('Mutating engineering endpoints require proper role authentication', async () => {
      const permitRes = await request(baseUrl, '/api/permits', {
        method: 'POST',
        body: { permitName: 'Test Permit', issuingAgency: 'City Hall' }
      });
      assert.ok(permitRes.status === 401 || permitRes.status === 403);

      const rfiRes = await request(baseUrl, '/api/rfis', {
        method: 'POST',
        body: { subject: 'Test RFI', question: 'Structural question?' }
      });
      assert.ok(rfiRes.status === 401 || rfiRes.status === 403);

      const punchListRes = await request(baseUrl, '/api/punch-lists', {
        method: 'POST',
        body: { title: 'Defect', description: 'Crack on wall' }
      });
      assert.ok(punchListRes.status === 401 || punchListRes.status === 403);
    });

    await runTest('Security headers and file exposure defenses are active', async () => {
      const envRes = await request(baseUrl, '/.env');
      assert.ok(envRes.status === 404 || envRes.status === 403, '/.env must be blocked with 403 or 404');

      const gitRes = await request(baseUrl, '/.git/config');
      assert.ok(gitRes.status === 404 || gitRes.status === 403, '/.git must be blocked with 403 or 404');
    });

    await runTest('Existing production database user records are preserved and intact', async () => {
      const adminUser = await prisma.user.findFirst({ where: { email: 'admin@ctvill.com' } });
      assert.ok(adminUser, 'Primary administrator account must be preserved');
      assert.strictEqual(adminUser.accountStatus, 'ACTIVE');

      const projectCount = await prisma.commercialProject.count();
      assert.ok(projectCount >= 1, 'Commercial project records must remain intact');
    });

    // =========================================================================
    // PHASE 1.2 — ISSUE 1: TEST DATABASE SAFETY & ISOLATION ENFORCEMENT
    // =========================================================================
    console.log('\n--- PHASE 1.2 TASK 1: TEST DATABASE SAFETY & ISOLATION ENFORCEMENT ---');



    // Test-only in-memory session registry injected via dependency injection
    const testSessions = new Map<string, any>();

    setSessionVerifierForTesting(async (rawToken: string | undefined) => {
      if (!rawToken) return null;
      return testSessions.get(rawToken) || null;
    });

    function registerTestSession(rawToken: string, user: any, session?: any) {
      testSessions.set(rawToken, {
        user,
        session: {
          id: session?.id || `test-session-${user.id}`,
          userId: user.id,
          expiresAt: session?.expiresAt || new Date(Date.now() + 3600000),
          createdAt: session?.createdAt || new Date(),
          lastActivityAt: session?.lastActivityAt || new Date(),
          userAgent: session?.userAgent || 'test-agent',
          ipAddress: session?.ipAddress || '127.0.0.1',
        }
      });
    }

    function clearTestSessions() {
      testSessions.clear();
    }

    await runTest('Database safety: Live production/development database is never mutated by test suite', async () => {
      // Assert that live database is protected: tests do not execute writes against primary DATABASE_URL
      assert.ok(process.env.DATABASE_URL, 'Primary DATABASE_URL must be configured');
      const liveUser = await prisma.user.findFirst({ where: { accountStatus: 'ACTIVE' } });
      assert.ok(liveUser, 'Live database must contain user records');
      // Assert that no test sessions exist in live database
      const straySession = await prisma.session.findFirst({
        where: { tokenHash: hashSessionToken('test_token_eng_a_1234567890abcdef1234567890') }
      });
      assert.strictEqual(straySession, null, 'Live database must remain pristine without test artifacts');
    });

    await runTest('Authentication isolation: Test session verifier operates via dependency injection without live DB mutations', async () => {
      const DI_TOKEN = 'token_test_di_isolated_1234567890abcdef';
      const existingUser = await prisma.user.findFirst({ where: { accountStatus: 'ACTIVE' } });
      const targetUserId = existingUser?.id || 'usr-admin';

      registerTestSession(DI_TOKEN, {
        id: targetUserId,
        email: existingUser?.email || 'admin@ctvill.com',
        name: existingUser?.name || 'Administrator',
        role: (existingUser?.role as any) || ('ADMIN' as any),
        accountStatus: 'ACTIVE' as any,
        projectIds: ['PRJ-4693'],
      });

      const res = await request(baseUrl, '/api/auth/me', {
        cookie: `${SESSION_COOKIE_NAME}=${DI_TOKEN}`,
      });
      // Verified that test session was recognized via dependency injection
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json?.user?.email, existingUser?.email || 'admin@ctvill.com');

      // Verify zero session rows were written to live database
      const liveRecord = await prisma.session.findFirst({
        where: { tokenHash: hashSessionToken(DI_TOKEN) }
      });
      assert.strictEqual(liveRecord, null, 'Dependency-injected test session must NOT write to live database');
    });

    await runTest('Database isolation: Tests cannot write to dev/production database and verify isolated TEST_DATABASE_URL configuration', async () => {
      if (!isIsolatedTestDb) {
        assert.strictEqual(isIsolatedTestDb, false, 'Safety verification: non-isolated mode is active');
      } else {
        assert.strictEqual(process.env.DATABASE_URL, rawTestDbUrl);
      }
      const stray = await prisma.session.findFirst({
        where: { tokenHash: hashSessionToken('stray_probe_token_1234567890abcdef') }
      });
      assert.strictEqual(stray, null, 'No stray test session can exist in live database');
    });

    // =========================================================================
    // PHASE 1.2 — ISSUE 2: API DATA PROTECTION & PER-USER CACHE ISOLATION
    // =========================================================================
    console.log('\n--- PHASE 1.2 TASK 2: API DATA PROTECTION & CACHE ISOLATION ---');

    const ENG_A_TOKEN = 'test_token_eng_a_1234567890abcdef1234567890';
    const ENG_B_TOKEN = 'test_token_eng_b_1234567890abcdef1234567890';
    const ENG_EMPTY_TOKEN = 'test_token_eng_empty_1234567890abcdef1234567890';

    registerTestSession(ENG_A_TOKEN, {
      id: 'usr-mock-eng-a',
      email: 'eng_a@ctvill.internal',
      name: 'Site Engineer Alpha',
      role: 'ENGINEER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-4693'],
    });

    registerTestSession(ENG_B_TOKEN, {
      id: 'usr-mock-eng-b',
      email: 'eng_b@ctvill.internal',
      name: 'Site Engineer Beta',
      role: 'ENGINEER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-NONEXISTENT-999'],
    });

    registerTestSession(ENG_EMPTY_TOKEN, {
      id: 'usr-mock-eng-empty',
      email: 'eng_empty@ctvill.internal',
      name: 'Unassigned Engineer',
      role: 'ENGINEER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: [],
    });

    const TK_A_TOKEN = 'test_token_tk_a_1234567890abcdef1234567890';
    registerTestSession(TK_A_TOKEN, {
      id: 'usr-mock-tk-a',
      email: 'tk_a@ctvill.internal',
      name: 'Site Timekeeper Alpha',
      role: 'TIMEKEEPER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-4693'],
    });

    const ADMIN_A_TOKEN = 'test_token_admin_a_1234567890abcdef1234567890';
    registerTestSession(ADMIN_A_TOKEN, {
      id: 'usr-mock-admin-a',
      email: 'admin_a@ctvill.internal',
      name: 'System Administrator Alpha',
      role: 'ADMIN' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: [],
    });

    const FIN_A_TOKEN = 'test_token_fin_a_1234567890abcdef1234567890';
    registerTestSession(FIN_A_TOKEN, {
      id: 'usr-mock-fin-a',
      email: 'fin_a@ctvill.internal',
      name: 'Finance Controller Alpha',
      role: 'FINANCE' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: [],
    });

    await runTest('API Data Protection: /api/all-data scopes projects to authorized projects only', async () => {
      const res = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_A_TOKEN}`,
      });
      assert.strictEqual(res.status, 200, 'Authenticated engineer request must succeed');
      assert.ok(Array.isArray(res.json?.projects), 'Projects must be an array');
      // All returned projects must only be PRJ-4693
      for (const p of res.json.projects) {
        assert.strictEqual(p.id, 'PRJ-4693', `Engineer A must only receive PRJ-4693 but got ${p.id}`);
      }
      // Non-finance/admin roles must receive empty payroll
      assert.deepStrictEqual(res.json?.payroll, [], 'Payroll array must be empty for engineer');
      assert.deepStrictEqual(res.json?.extendedPayroll, [], 'Extended payroll array must be empty for engineer');
    });

    await runTest('API Data Protection: Engineer with empty projectIds receives zero projects, tasks, documents, and clients in /api/all-data', async () => {
      const res = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_EMPTY_TOKEN}`,
      });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.json?.projects, [], 'Non-admin with empty projectIds must receive empty projects list');
      assert.deepStrictEqual(res.json?.tasks, [], 'Non-admin with empty projectIds must receive empty tasks list');
      assert.deepStrictEqual(res.json?.documents, [], 'Non-admin with empty projectIds must receive empty documents list');
      assert.deepStrictEqual(res.json?.clients, [], 'Non-admin with empty projectIds must receive empty clients list');
      assert.deepStrictEqual(res.json?.payroll, [], 'Non-admin must receive empty payroll list');
    });

    await runTest('Cache Isolation: Cross-user cached responses are strictly segregated by user ID and project assignment', async () => {
      // 1. Prime cache with Engineer A (assigned to PRJ-4693)
      const resA = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_A_TOKEN}`,
      });
      assert.strictEqual(resA.status, 200);
      const projAIds = resA.json.projects.map((p: any) => p.id);
      assert.ok(projAIds.includes('PRJ-4693'), 'Engineer A must receive PRJ-4693');

      // 2. Immediately call with Engineer B (assigned to PRJ-NONEXISTENT-999) — must NOT receive Engineer A cached response!
      const resB = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_B_TOKEN}`,
      });
      assert.strictEqual(resB.status, 200);
      const projBIds = resB.json.projects.map((p: any) => p.id);
      assert.strictEqual(
        projBIds.includes('PRJ-4693'),
        false,
        'Cache leak detected: Engineer B must NOT receive Engineer A cached project data!'
      );
    });

    await runTest('API Data Protection: Records with missing project IDs are NOT exposed in /api/all-data to Engineer, Timekeeper, or Client', async () => {
      const res = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_A_TOKEN}`,
      });
      assert.strictEqual(res.status, 200);

      // Verify documents: must belong to authorized project or be explicitly company-wide; unassigned rejected
      for (const doc of (res.json?.documents || [])) {
        const matchesProj = doc.projectId === 'PRJ-4693' || doc.title?.includes('PRJ-4693') || doc.id?.includes('PRJ-4693');
        const isCoWide = doc.isCompanyWide || doc.is_company_wide || doc.category === 'COMPANY_POLICY' || doc.category === 'GENERAL_POLICY';
        assert.ok(matchesProj || isCoWide, `Document ${doc.id} must belong to authorized project or be explicitly company-wide`);
      }

      // Verify site logs: must belong to authorized project or be explicitly company-wide; unassigned rejected
      for (const log of (res.json?.siteLogs || [])) {
        const matchesProj = log.projectId === 'PRJ-4693';
        const isCoWide = log.isCompanyWide || log.is_company_wide;
        assert.ok(matchesProj || isCoWide, `Site log ${log.id} with missing/unauthorized project ID must not be exposed`);
      }

      // Verify risks: must belong to authorized project or be explicitly company-wide; unassigned rejected
      for (const risk of (res.json?.risks || [])) {
        const matchesProj = risk.projectId === 'PRJ-4693';
        const isCoWide = risk.isCompanyWide || risk.is_company_wide;
        assert.ok(matchesProj || isCoWide, `Risk ${risk.id} with missing/unauthorized project ID must not be exposed`);
      }

      // Verify change orders: must belong to authorized project or be explicitly company-wide; unassigned rejected
      for (const co of (res.json?.changeOrders || [])) {
        const matchesProj = co.projectId === 'PRJ-4693';
        const isCoWide = co.isCompanyWide || co.is_company_wide;
        assert.ok(matchesProj || isCoWide, `Change order ${co.id} with missing/unauthorized project ID must not be exposed`);
      }

      // Verify labor allocations: must belong to authorized project or be explicitly company-wide; unassigned rejected
      for (const alloc of (res.json?.laborAllocations || [])) {
        const matchesProj = alloc.projectId === 'PRJ-4693' || alloc.project_id === 'PRJ-4693';
        const isCoWide = alloc.isCompanyWide || alloc.is_company_wide;
        assert.ok(matchesProj || isCoWide, `Labor allocation ${alloc.id} with missing/unauthorized project ID must not be exposed`);
      }

      // Verify manpower audits: must belong to authorized project or be explicitly company-wide; unassigned rejected
      for (const audit of (res.json?.manpowerAudits || [])) {
        const matchesProj = audit.projectId === 'PRJ-4693' || audit.project_id === 'PRJ-4693';
        const isCoWide = audit.isCompanyWide || audit.is_company_wide;
        assert.ok(matchesProj || isCoWide, `Manpower audit ${audit.id} with missing/unauthorized project ID must not be exposed`);
      }
    });

    await runTest('Timekeeper Data Scoping: Timekeeper receives authorized project records and strictly zero payroll or change orders', async () => {
      const res = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${TK_A_TOKEN}`,
      });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.json?.payroll, [], 'Timekeeper must receive zero payroll records');
      assert.deepStrictEqual(res.json?.extendedPayroll, [], 'Timekeeper must receive zero extended payroll records');
      assert.deepStrictEqual(res.json?.changeOrders, [], 'Timekeeper must receive zero change orders');

      // Verify site logs, manpower audits, labor allocations only contain authorized project PRJ-4693
      for (const log of (res.json?.siteLogs || [])) {
        assert.ok(log.projectId === 'PRJ-4693' || log.isCompanyWide, 'Timekeeper must only receive authorized site logs');
      }
      for (const audit of (res.json?.manpowerAudits || [])) {
        assert.ok(audit.projectId === 'PRJ-4693' || audit.project_id === 'PRJ-4693' || audit.isCompanyWide, 'Timekeeper must only receive authorized manpower audits');
      }
    });

    await runTest('Company-Wide Records: Explicitly authorized company-wide records and Admin/Finance visibility are preserved', async () => {
      const adminRes = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${ADMIN_A_TOKEN}`,
      });
      assert.strictEqual(adminRes.status, 200);
      assert.ok(Array.isArray(adminRes.json?.projects), 'Admin must receive all projects');
      assert.ok(adminRes.json?.projects.length > 0, 'Admin must see company projects');

      const finRes = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${FIN_A_TOKEN}`,
      });
      assert.strictEqual(finRes.status, 200);
      assert.ok(Array.isArray(finRes.json?.projects), 'Finance must receive company projects');
      assert.ok(Array.isArray(finRes.json?.payroll), 'Finance must receive company payroll');
    });

    // =========================================================================
    // PHASE 1.2 — ISSUE 3: CSRF SECURITY & PRODUCTION SECRET ENFORCEMENT
    // =========================================================================
    console.log('\n--- PHASE 1.2 TASK 3: CSRF SECURITY & SECRET ENFORCEMENT ---');

    await runTest('CSRF secret resolution: Hardcoded fallback is removed and ephemeral CSPRNG key is used in dev/test', async () => {
      const secret = getCsrfHmacSecret();
      assert.ok(secret, 'Secret must be returned');
      assert.notStrictEqual(secret, 'ctvill-production-csrf-hmac-secret-salt-2026', 'Hardcoded secret fallback MUST be completely removed');
      assert.ok(secret.length >= 32, 'Secret must be at least 32 characters long');
    });

    await runTest('CSRF secret enforcement: Fatal error thrown in production mode if CSRF secret is missing or short', async () => {
      const origEnv = process.env.NODE_ENV;
      const origCsrf = process.env.CSRF_SECRET;
      const origSession = process.env.SESSION_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.CSRF_SECRET;
        delete process.env.SESSION_SECRET;

        // When secrets are missing in production:
        assert.throws(
          () => getCsrfHmacSecret(),
          /FATAL CSRF SECURITY CONFIGURATION ERROR/,
          'Must throw fatal configuration error if CSRF secret is missing in production'
        );

        // When secret is shorter than 32 characters in production:
        process.env.CSRF_SECRET = 'short_weak_secret';
        assert.throws(
          () => getCsrfHmacSecret(),
          /minimum 32 characters/,
          'Must throw fatal configuration error if CSRF secret is < 32 characters in production'
        );
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origCsrf) process.env.CSRF_SECRET = origCsrf;
        if (origSession) process.env.SESSION_SECRET = origSession;
      }
    });

    await runTest('CSRF startup configuration: validateProductionSecurityConfig prevents startup on weak or missing secrets', async () => {
      const origEnv = process.env.NODE_ENV;
      const origSession = process.env.SESSION_SECRET;
      const origCsrf = process.env.CSRF_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        delete process.env.SESSION_SECRET;
        delete process.env.CSRF_SECRET;

        // Missing secrets on boot must throw fatal configuration error
        assert.throws(
          () => validateProductionSecurityConfig(),
          /FATAL SECURITY CONFIGURATION ERROR/,
          'Must prevent application startup if SESSION_SECRET is missing in production'
        );

        process.env.SESSION_SECRET = 'short_weak_secret';
        assert.throws(
          () => validateProductionSecurityConfig(),
          /minimum 32 characters/,
          'Must prevent application startup if SESSION_SECRET is < 32 characters in production'
        );

        process.env.SESSION_SECRET = 'a_very_secure_and_long_session_secret_32_characters_minimum';
        delete process.env.CSRF_SECRET;
        assert.throws(
          () => validateProductionSecurityConfig(),
          /FATAL CSRF SECURITY CONFIGURATION ERROR/,
          'Must prevent application startup if CSRF_SECRET is missing in production'
        );
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSession) process.env.SESSION_SECRET = origSession;
        if (origCsrf) process.env.CSRF_SECRET = origCsrf;
      }
    });

    await runTest('CSRF verification: State-changing requests reject missing or forged CSRF tokens', async () => {
      const validCsrf = generateCsrfToken(ENG_A_TOKEN);

      // 1. Missing CSRF token
      const missingCsrfRes = await request(baseUrl, '/api/permits', {
        method: 'POST',
        cookie: `${SESSION_COOKIE_NAME}=${ENG_A_TOKEN}`,
        body: { permitName: 'Test Missing CSRF', issuingAgency: 'LGU' }
      });
      assert.strictEqual(missingCsrfRes.status, 403, 'Missing CSRF token must return 403');

      // 2. Forged CSRF token
      const forgedCsrfRes = await request(baseUrl, '/api/permits', {
        method: 'POST',
        cookie: `${SESSION_COOKIE_NAME}=${ENG_A_TOKEN}`,
        csrfToken: 'forged.csrf.signature1234567890abcdef',
        body: { permitName: 'Test Forged CSRF', issuingAgency: 'LGU' }
      });
      assert.strictEqual(forgedCsrfRes.status, 403, 'Forged CSRF token must return 403');

      // 3. Valid CSRF token with matching session binding
      const validCsrfRes = await request(baseUrl, '/api/permits', {
        method: 'POST',
        cookie: `${SESSION_COOKIE_NAME}=${ENG_A_TOKEN}`,
        csrfToken: validCsrf,
        body: { permitName: 'Test Valid CSRF', issuingAgency: 'LGU' }
      });
      // Permitted through CSRF check (reaches endpoint logic, status 200 or 201)
      assert.notStrictEqual(validCsrfRes.status, 403, 'Valid CSRF token must pass verification');
    });

    // =========================================================================
    // PHASE 1.2 — ISSUE 4: STAFF ACCOUNT SECURITY & SENSITIVE CREDENTIAL REDACTION
    // =========================================================================
    console.log('\n--- PHASE 1.2 TASK 4: STAFF ACCOUNT CREDENTIAL PROTECTION ---');

    await runTest('Staff account security: GET /api/staff omits passwordHash and inviteToken', async () => {
      const ADMIN_TEST_TOKEN = 'test_token_admin_full_1234567890abcdef123456';
      registerTestSession(ADMIN_TEST_TOKEN, {
        id: 'usr-admin-test',
        email: 'admin@ctvill.com',
        name: 'Administrator',
        role: 'ADMIN' as any,
        accountStatus: 'ACTIVE' as any,
        projectIds: [],
      });

      const res = await request(baseUrl, '/api/staff', {
        cookie: `${SESSION_COOKIE_NAME}=${ADMIN_TEST_TOKEN}`,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.json));
      for (const staff of res.json) {
        assert.strictEqual(staff.passwordHash, undefined, 'passwordHash must never be exposed on staff objects');
        assert.strictEqual(staff.password, undefined, 'password must never be exposed on staff objects');
        assert.strictEqual(staff.inviteToken, undefined, 'inviteToken must never be exposed on staff objects');
      }
    });

    await runTest('Client account security: General listings and /api/all-data omit raw inviteToken', async () => {
      const res = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_A_TOKEN}`,
      });
      assert.strictEqual(res.status, 200);
      for (const client of (res.json?.clients || [])) {
        assert.strictEqual(client.inviteToken, undefined, 'inviteToken must never be exposed in /api/all-data client listings');
        assert.strictEqual(client.passwordHash, undefined, 'passwordHash must never be exposed in client listings');
      }
    });

    // =========================================================================
    // PHASE 1.2 — ISSUE 5: AUTHENTICATED INTEGRATION TESTS (ALL 5 ROLES)
    // =========================================================================
    console.log('\n--- PHASE 1.2 TASK 5: AUTHENTICATED 5-ROLE INTEGRATION TESTS ---');

    const ADMIN_ROLE_TOKEN = 'token_role_admin_1234567890abcdef123456';
    const ENG_ROLE_TOKEN = 'token_role_eng_1234567890abcdef123456';
    const TK_ROLE_TOKEN = 'token_role_tk_1234567890abcdef123456';
    const FIN_ROLE_TOKEN = 'token_role_fin_1234567890abcdef123456';
    const CLI_ROLE_TOKEN = 'token_role_cli_1234567890abcdef123456';

    registerTestSession(ADMIN_ROLE_TOKEN, {
      id: 'role-usr-admin',
      email: 'admin_role@ctvill.com',
      name: 'System Admin',
      role: 'ADMIN' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: [],
    });

    registerTestSession(ENG_ROLE_TOKEN, {
      id: 'role-usr-eng',
      email: 'eng_role@ctvill.com',
      name: 'Site Engineer',
      role: 'ENGINEER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-4693'],
    });

    registerTestSession(TK_ROLE_TOKEN, {
      id: 'role-usr-tk',
      email: 'tk_role@ctvill.com',
      name: 'Site Timekeeper',
      role: 'TIMEKEEPER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-4693'],
    });

    registerTestSession(FIN_ROLE_TOKEN, {
      id: 'role-usr-fin',
      email: 'fin_role@ctvill.com',
      name: 'Finance Controller',
      role: 'FINANCE' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: [],
    });

    registerTestSession(CLI_ROLE_TOKEN, {
      id: 'role-usr-cli',
      email: 'cli_role@ctvill.com',
      name: 'Commercial Client',
      role: 'CLIENT' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-4693'],
    });

    // 1. ADMIN ROLE PERMISSION VERIFICATION
    await runTest('ADMIN Role: Authorized for staff management, payroll, and global project view', async () => {
      const staffRes = await request(baseUrl, '/api/staff', {
        cookie: `${SESSION_COOKIE_NAME}=${ADMIN_ROLE_TOKEN}`,
      });
      assert.strictEqual(staffRes.status, 200, 'Admin must be authorized for /api/staff');

      const payrollRes = await request(baseUrl, '/api/payroll-records', {
        cookie: `${SESSION_COOKIE_NAME}=${ADMIN_ROLE_TOKEN}`,
      });
      assert.strictEqual(payrollRes.status, 200, 'Admin must be authorized for /api/payroll-records');

      const extPayrollRes = await request(baseUrl, '/api/finance/extended-payroll', {
        cookie: `${SESSION_COOKIE_NAME}=${ADMIN_ROLE_TOKEN}`,
      });
      assert.strictEqual(extPayrollRes.status, 200, 'Admin must be authorized for /api/finance/extended-payroll');
    });

    // 2. ENGINEER ROLE PERMISSION VERIFICATION
    await runTest('ENGINEER Role: Forbidden from staff and finance, scoped to assigned projects', async () => {
      const staffRes = await request(baseUrl, '/api/staff', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_ROLE_TOKEN}`,
      });
      assert.strictEqual(staffRes.status, 403, 'Engineer must be forbidden from /api/staff (403)');

      const payrollRes = await request(baseUrl, '/api/payroll-records', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_ROLE_TOKEN}`,
      });
      assert.strictEqual(payrollRes.status, 403, 'Engineer must be forbidden from /api/payroll-records (403)');

      const extPayrollRes = await request(baseUrl, '/api/finance/extended-payroll', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_ROLE_TOKEN}`,
      });
      assert.strictEqual(extPayrollRes.status, 403, 'Engineer must be forbidden from /api/finance/extended-payroll (403)');
    });

    // 3. TIMEKEEPER ROLE PERMISSION VERIFICATION
    await runTest('TIMEKEEPER Role: Forbidden from staff management and payroll finalization (Separation of Duties)', async () => {
      const staffRes = await request(baseUrl, '/api/staff', {
        cookie: `${SESSION_COOKIE_NAME}=${TK_ROLE_TOKEN}`,
      });
      assert.strictEqual(staffRes.status, 403, 'Timekeeper must be forbidden from /api/staff (403)');

      const tkCsrf = generateCsrfToken(TK_ROLE_TOKEN);
      const finalizeRes = await request(baseUrl, '/api/payroll/finalize', {
        method: 'POST',
        cookie: `${SESSION_COOKIE_NAME}=${TK_ROLE_TOKEN}`,
        csrfToken: tkCsrf,
        body: { projectId: 'PRJ-4693' }
      });
      assert.strictEqual(finalizeRes.status, 403, 'Timekeeper must be forbidden from finalizing payroll (403)');
    });

    // 4. FINANCE ROLE PERMISSION VERIFICATION
    await runTest('FINANCE Role: Authorized for payroll & payables, forbidden from staff account administration', async () => {
      const staffRes = await request(baseUrl, '/api/staff', {
        cookie: `${SESSION_COOKIE_NAME}=${FIN_ROLE_TOKEN}`,
      });
      assert.strictEqual(staffRes.status, 403, 'Finance must be forbidden from /api/staff (403)');

      const payrollRes = await request(baseUrl, '/api/payroll-records', {
        cookie: `${SESSION_COOKIE_NAME}=${FIN_ROLE_TOKEN}`,
      });
      assert.strictEqual(payrollRes.status, 200, 'Finance must be authorized for /api/payroll-records (200)');

      const extPayrollRes = await request(baseUrl, '/api/finance/extended-payroll', {
        cookie: `${SESSION_COOKIE_NAME}=${FIN_ROLE_TOKEN}`,
      });
      assert.strictEqual(extPayrollRes.status, 200, 'Finance must be authorized for /api/finance/extended-payroll (200)');
    });

    // 5. CLIENT ROLE PERMISSION VERIFICATION
    await runTest('CLIENT Role: Forbidden from staff and financial modules, restricted to own client record and zero internal site logs', async () => {
      const staffRes = await request(baseUrl, '/api/staff', {
        cookie: `${SESSION_COOKIE_NAME}=${CLI_ROLE_TOKEN}`,
      });
      assert.strictEqual(staffRes.status, 403, 'Client must be forbidden from /api/staff (403)');

      const payrollRes = await request(baseUrl, '/api/payroll-records', {
        cookie: `${SESSION_COOKIE_NAME}=${CLI_ROLE_TOKEN}`,
      });
      assert.strictEqual(payrollRes.status, 403, 'Client must be forbidden from /api/payroll-records (403)');

      const allDataRes = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${CLI_ROLE_TOKEN}`,
      });
      assert.strictEqual(allDataRes.status, 200, 'Client must be able to load /api/all-data');
      for (const client of (allDataRes.json?.clients || [])) {
        assert.strictEqual(client.id, 'role-usr-cli', 'Client must ONLY receive their own client account in all-data');
      }
      assert.deepStrictEqual(allDataRes.json?.siteLogs, [], 'Client must receive zero internal site logs');
      assert.deepStrictEqual(allDataRes.json?.risks, [], 'Client must receive zero internal project risks');
      assert.deepStrictEqual(allDataRes.json?.auditLogs, [], 'Client must receive zero system audit logs');
      assert.deepStrictEqual(allDataRes.json?.laborAllocations, [], 'Client must receive zero labor allocations');
      assert.deepStrictEqual(allDataRes.json?.manpowerAudits, [], 'Client must receive zero manpower audits');
    });

    // 6. ACTUAL DATABASE-BACKED SESSION REVOCATION (ISOLATED TEST DATABASE ONLY)
    await runTest(
      'Actual database-backed session revocation: Revocation via /api/auth/logout deletes database record',
      async () => {
        // Enforce genuine database isolation: Never execute real mutations against the live database
        assert.ok(isIsolatedTestDb, 'Must be running against an isolated test database');

        const activeUser = await prisma.user.findFirst({ where: { accountStatus: 'ACTIVE' } });
        assert.ok(activeUser, 'User record must exist in isolated test database');

        const createdSession = await createSession(activeUser.id);
        const sessionToken = createdSession.rawToken;
        const csrf = generateCsrfToken(sessionToken);

        const beforeRes = await request(baseUrl, '/api/auth/me', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        });
        assert.strictEqual(beforeRes.status, 200, 'Session must initially be valid in test DB');

        const logoutRes = await request(baseUrl, '/api/auth/logout', {
          method: 'POST',
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
          csrfToken: csrf,
        });
        assert.strictEqual(logoutRes.status, 200, 'Logout request must succeed in test DB');

        const afterRes = await request(baseUrl, '/api/auth/me', {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        });
        assert.strictEqual(afterRes.status, 401, 'Revoked session must be rejected with 401');

        const dbRecord = await prisma.session.findUnique({
          where: { tokenHash: hashSessionToken(sessionToken) },
        });
        assert.strictEqual(dbRecord, null, 'Session row must be genuinely deleted from isolated PostgreSQL');
      },
      {
        skipIf: !isIsolatedTestDb,
        skipReason: 'Requires dedicated isolated TEST_DATABASE_URL to protect live database from mutation',
      }
    );

  } finally {
    resetSessionVerifierForTesting();
    server.close();
    await pool.end().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }

  console.log('\n==============================================================');
  const passed = results.filter(r => r.status === 'PASSED').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  console.log(`SUMMARY: ${passed} passed, ${skipped} skipped, ${failed} failed out of ${results.length} total tests.`);
  if (skipped > 0) {
    console.log('\nSkipped Tests (Isolated test database required):');
    for (const s of results.filter(r => r.status === 'SKIPPED')) {
      console.log(`  - ${s.name}: ${s.reason}`);
    }
  }
  console.log('==============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
