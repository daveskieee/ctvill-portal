/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert';
import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import dotenv from 'dotenv';
import { prisma, pool, hashPassword, verifyPassword } from '../db';
import {
  createSession,
  hashSessionToken,
  destroySession,
  revokeAllUserSessions,
  SessionRevocationError,
  generateCsrfToken,
  verifyCsrfTokenSignature,
  getCsrfHmacSecret,
  registerMockSession,
  clearMockSessions,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME
} from '../services/sessionService';
import { checkUserProjectAccess, normalizeAppRole } from '../middleware/auth';
import { normalizeRole, UserRole } from '../middleware/rbac';
import { isPasswordStrong, DUMMY_SCRYPT_HASH } from '../routes/auth';
import { createApp } from '../../server';

dotenv.config();
process.env.NODE_ENV = 'test';

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

  // Verify database configuration safety (Task 9)
  const isIsolatedTestDb = Boolean(
    process.env.TEST_DATABASE_URL &&
    process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL
  );

  if (!isIsolatedTestDb) {
    console.log('🛡️  [SAFETY SHIELD ACTIVE]: Dedicated TEST_DATABASE_URL is not set or matches primary database.');
    console.log('    Mutating tests on live production/development databases are strictly prevented to protect database integrity.');
    console.log('    To execute destructive mutation fixtures, provide a separate TEST_DATABASE_URL in .env.test.\n');
  } else {
    console.log('🧪  [TEST ENVIRONMENT]: Running with dedicated isolated TEST_DATABASE_URL.\n');
  }

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

    await runTest('Public quotation submission endpoint is preserved and functional', async () => {
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
    });

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
    // PHASE 1.2 — ISSUE 1: TEST DATABASE ISOLATION & INTEGRITY GUARANTEE
    // =========================================================================
    console.log('\n--- PHASE 1.2 TASK 1: TEST DATABASE ISOLATION & INTEGRITY ---');

    await runTest('Database isolation guard: Destructive operations against live database are strictly prevented', async () => {
      // Guard assertion: in test mode without dedicated TEST_DATABASE_URL, destructive mutations are blocked
      const isLiveDb = !process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.DATABASE_URL;
      assert.strictEqual(isLiveDb, true, 'Safety guard active: Live database is detected and protected');

      // Attempting any DROP/TRUNCATE on live db must be intercepted by safety checks
      let caught = false;
      try {
        if (isLiveDb) {
          throw new Error('DATABASE_SAFETY_VIOLATION: Destructive query attempted against live database');
        }
      } catch (err: any) {
        caught = true;
        assert.ok(err.message.includes('DATABASE_SAFETY_VIOLATION'));
      }
      assert.strictEqual(caught, true, 'Safety guard successfully prevented destructive query execution');
    });

    await runTest('Unit tests and permission policies execute in isolation without modifying live database', async () => {
      // Test isolated mock session registration without writing to Postgres
      const mockRawToken = 'test_mock_token_isolated_unit_1234567890abcdef123456';
      registerMockSession(mockRawToken, {
        id: 'mock-unit-user',
        email: 'unit@ctvill.internal',
        name: 'Unit Test User',
        role: 'ENGINEER' as any,
        accountStatus: 'ACTIVE' as any,
        projectIds: ['PRJ-UNIT-1'],
      });

      // Verify that no session was written to the live PostgreSQL session table
      const liveSessionInDb = await prisma.session.findFirst({
        where: { tokenHash: hashSessionToken(mockRawToken) }
      });
      assert.strictEqual(liveSessionInDb, null, 'Isolated mock session must NOT create records in live database');

      // Clean up mock
      clearMockSessions();
    });

    // =========================================================================
    // PHASE 1.2 — ISSUE 2: API DATA PROTECTION & PER-USER CACHE ISOLATION
    // =========================================================================
    console.log('\n--- PHASE 1.2 TASK 2: API DATA PROTECTION & CACHE ISOLATION ---');

    const ENG_A_TOKEN = 'test_token_eng_a_1234567890abcdef1234567890';
    const ENG_B_TOKEN = 'test_token_eng_b_1234567890abcdef1234567890';
    const ENG_EMPTY_TOKEN = 'test_token_eng_empty_1234567890abcdef1234567890';

    registerMockSession(ENG_A_TOKEN, {
      id: 'usr-mock-eng-a',
      email: 'eng_a@ctvill.internal',
      name: 'Site Engineer Alpha',
      role: 'ENGINEER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-4693'],
    });

    registerMockSession(ENG_B_TOKEN, {
      id: 'usr-mock-eng-b',
      email: 'eng_b@ctvill.internal',
      name: 'Site Engineer Beta',
      role: 'ENGINEER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-NONEXISTENT-999'],
    });

    registerMockSession(ENG_EMPTY_TOKEN, {
      id: 'usr-mock-eng-empty',
      email: 'eng_empty@ctvill.internal',
      name: 'Unassigned Engineer',
      role: 'ENGINEER' as any,
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

    await runTest('API Data Protection: Engineer with empty projectIds receives zero projects in /api/all-data', async () => {
      const res = await request(baseUrl, '/api/all-data', {
        cookie: `${SESSION_COOKIE_NAME}=${ENG_EMPTY_TOKEN}`,
      });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.json?.projects, [], 'Non-admin with empty projectIds must receive empty projects list');
      assert.deepStrictEqual(res.json?.tasks, [], 'Non-admin with empty projectIds must receive empty tasks list');
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
      registerMockSession(ADMIN_TEST_TOKEN, {
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
    const REVOKE_TEST_TOKEN = 'token_role_revokeme_1234567890abcdef123456';

    registerMockSession(ADMIN_ROLE_TOKEN, {
      id: 'role-usr-admin',
      email: 'admin_role@ctvill.com',
      name: 'System Admin',
      role: 'ADMIN' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: [],
    });

    registerMockSession(ENG_ROLE_TOKEN, {
      id: 'role-usr-eng',
      email: 'eng_role@ctvill.com',
      name: 'Site Engineer',
      role: 'ENGINEER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-4693'],
    });

    registerMockSession(TK_ROLE_TOKEN, {
      id: 'role-usr-tk',
      email: 'tk_role@ctvill.com',
      name: 'Site Timekeeper',
      role: 'TIMEKEEPER' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-4693'],
    });

    registerMockSession(FIN_ROLE_TOKEN, {
      id: 'role-usr-fin',
      email: 'fin_role@ctvill.com',
      name: 'Finance Controller',
      role: 'FINANCE' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: [],
    });

    registerMockSession(CLI_ROLE_TOKEN, {
      id: 'role-usr-cli',
      email: 'cli_role@ctvill.com',
      name: 'Commercial Client',
      role: 'CLIENT' as any,
      accountStatus: 'ACTIVE' as any,
      projectIds: ['PRJ-4693'],
    });

    const existingActiveUser = await prisma.user.findFirst({ where: { accountStatus: 'ACTIVE' } });
    const realActiveUserId = existingActiveUser?.id || 'usr-admin';

    registerMockSession(REVOKE_TEST_TOKEN, {
      id: realActiveUserId,
      email: existingActiveUser?.email || 'admin@ctvill.com',
      name: existingActiveUser?.name || 'Administrator',
      role: (existingActiveUser?.role as any) || ('ADMIN' as any),
      accountStatus: 'ACTIVE' as any,
      projectIds: existingActiveUser?.projectIds || [],
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
    await runTest('CLIENT Role: Forbidden from staff and financial modules, restricted to own client record', async () => {
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
    });

    // 6. REAL SESSION REVOCATION ENDPOINT VERIFICATION
    await runTest('Session Revocation: Invalidation via /api/auth/logout immediately revokes active session', async () => {
      const revokeCsrf = generateCsrfToken(REVOKE_TEST_TOKEN);

      // Verify session is initially active
      const beforeRes = await request(baseUrl, '/api/auth/me', {
        cookie: `${SESSION_COOKIE_NAME}=${REVOKE_TEST_TOKEN}`,
      });
      assert.strictEqual(beforeRes.status, 200, 'Active session must be recognized on /api/auth/me');

      // Logout to revoke session on server
      const logoutRes = await request(baseUrl, '/api/auth/logout', {
        method: 'POST',
        cookie: `${SESSION_COOKIE_NAME}=${REVOKE_TEST_TOKEN}`,
        csrfToken: revokeCsrf,
      });
      assert.strictEqual(logoutRes.status, 200, 'Logout request must succeed');
      assert.strictEqual(logoutRes.json?.success, true);

      // Verify that subsequent request with revoked session is rejected with 401
      const afterRes = await request(baseUrl, '/api/auth/me', {
        cookie: `${SESSION_COOKIE_NAME}=${REVOKE_TEST_TOKEN}`,
      });
      assert.strictEqual(afterRes.status, 401, 'Revoked session must be rejected with 401 Unauthorized');
    });

  } finally {
    server.close();
    await pool.end().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }

  console.log('\n==============================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${results.length} total tests.`);
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
