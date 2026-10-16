/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as crypto from 'crypto';
import { prisma, pool } from '../db';
import { Role, AccountStatus } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'ctvill_session';
export const CSRF_COOKIE_NAME = 'ctvill_csrf';

// Default session lifetimes
export const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;    // 8 hours standard
export const REMEMBER_ME_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours Remember Me

export interface SessionData {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface VerifiedSessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  accountStatus: AccountStatus;
  projectIds: string[];
}

/**
 * Hash opaque raw session token using SHA-256 before storing or looking up in PostgreSQL.
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

const CSRF_HMAC_SECRET = process.env.CSRF_SECRET || process.env.SESSION_SECRET || 'ctvill-production-csrf-hmac-secret-salt-2026';

/**
 * Custom error class for security-critical session revocation failures.
 */
export class SessionRevocationError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'SessionRevocationError';
  }
}

/**
 * Generate a cryptographically secure random session token.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a cryptographically secure random session-bound or anonymous CSRF token.
 * Token format: <nonce>.<sessionSnippet>.<hmacSignature>
 */
export function generateCsrfToken(rawSessionToken?: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const sessionSnippet = rawSessionToken ? hashSessionToken(rawSessionToken).slice(0, 16) : 'anon';
  const payload = `${nonce}.${sessionSnippet}`;
  const hmac = crypto.createHmac('sha256', CSRF_HMAC_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

/**
 * Verify a CSRF token: verifies HMAC signature and (if session exists) binds to session.
 */
export function verifyCsrfTokenSignature(csrfToken: string | undefined, rawSessionToken?: string): boolean {
  if (!csrfToken || typeof csrfToken !== 'string') return false;
  const parts = csrfToken.trim().split('.');
  if (parts.length !== 3) {
    // Fallback: If legacy raw hex token without dot, permit if no session binding required
    if (/^[a-f0-9]{32,64}$/i.test(csrfToken) && !rawSessionToken) {
      return true;
    }
    return false;
  }
  const [nonce, sessionSnippet, signature] = parts;
  const payload = `${nonce}.${sessionSnippet}`;
  const expectedHmac = crypto.createHmac('sha256', CSRF_HMAC_SECRET).update(payload).digest('hex');

  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expectedHmac, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  // If the request has an active session token, verify that the token was issued for this session
  if (rawSessionToken) {
    const currentSessionSnippet = hashSessionToken(rawSessionToken).slice(0, 16);
    const snipBuf = Buffer.from(sessionSnippet);
    const curBuf = Buffer.from(currentSessionSnippet);
    if (snipBuf.length !== curBuf.length || !crypto.timingSafeEqual(snipBuf, curBuf)) {
      return false;
    }
  }

  return true;
}

/**
 * Create a new server-side session backed by PostgreSQL.
 */
export async function createSession(
  userId: string,
  options: {
    rememberMe?: boolean;
    userAgent?: string;
    ipAddress?: string;
  } = {}
): Promise<{ rawToken: string; expiresAt: Date; session: SessionData }> {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const ttl = options.rememberMe ? REMEMBER_ME_SESSION_TTL_MS : DEFAULT_SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);

  const session = await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
      userAgent: options.userAgent || null,
      ipAddress: options.ipAddress || null,
    },
  });

  return {
    rawToken,
    expiresAt,
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
    },
  };
}

/**
 * Verify a session by its raw token and load the active user.
 * Returns null if token is missing, expired, not found, or user is not ACTIVE.
 */
export async function verifySession(rawToken: string | undefined): Promise<{
  user: VerifiedSessionUser;
  session: SessionData;
} | null> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 16) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken.trim());
  const now = new Date();

  // Find session with associated user
  const record = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          accountStatus: true,
          projectIds: true,
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  // Check expiration
  if (record.expiresAt <= now) {
    // Purge expired session asynchronously
    prisma.session.delete({ where: { id: record.id } }).catch(() => {});
    return null;
  }

  // Check user status: do not allow suspended or invited accounts
  if (!record.user || record.user.accountStatus !== AccountStatus.ACTIVE) {
    return null;
  }

  // Touch last activity pulse if it has been more than 60 seconds
  const lastActive = record.lastActivityAt.getTime();
  if (now.getTime() - lastActive > 60000) {
    prisma.session.update({
      where: { id: record.id },
      data: { lastActivityAt: now },
    }).catch(() => {});
  }

  return {
    user: {
      id: record.user.id,
      email: record.user.email,
      name: record.user.name,
      role: record.user.role,
      accountStatus: record.user.accountStatus,
      projectIds: record.user.projectIds || [],
    },
    session: {
      id: record.id,
      userId: record.userId,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      lastActivityAt: record.lastActivityAt,
      userAgent: record.userAgent,
      ipAddress: record.ipAddress,
    },
  };
}

/**
 * Invalidate a single active session (e.g. upon logout).
 * Throws SessionRevocationError on database failure to prevent false success reports.
 */
export async function destroySession(rawToken: string | undefined): Promise<boolean> {
  if (!rawToken || typeof rawToken !== 'string') return false;
  try {
    const tokenHash = hashSessionToken(rawToken.trim());
    await prisma.session.deleteMany({
      where: { tokenHash },
    });
    return true;
  } catch (err: any) {
    console.error('Session destruction database error:', err?.message || err);
    throw new SessionRevocationError('Failed to revoke session from database', err);
  }
}

/**
 * Revoke all sessions for a specific user (e.g. upon password reset, role change, or account suspension).
 * Throws SessionRevocationError on database failure to prevent security regressions.
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const result = await prisma.session.deleteMany({
      where: { userId },
    });
    return result.count;
  } catch (err: any) {
    console.error(`Session revocation database error for user ${userId}:`, err?.message || err);
    throw new SessionRevocationError(`Failed to revoke sessions for user ${userId}`, err);
  }
}

/**
 * Periodic clean-up of expired sessions from PostgreSQL.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const res = await pool.query('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP');
    return res.rowCount || 0;
  } catch {
    return 0;
  }
}
