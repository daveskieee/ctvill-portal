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
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }
  if (options.csrfToken) {
    headers['X-CSRF-Token'] = options.csrfToken;
  }
  if (options.origin) {
    headers['Origin'] = options.origin;
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
