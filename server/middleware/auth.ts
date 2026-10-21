/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { SESSION_COOKIE_NAME, verifySession } from '../services/sessionService';

export type AllowedAppRole = 'ADMIN' | 'ENGINEER' | 'TIMEKEEPER' | 'FINANCE' | 'PROJECT_MANAGER' | 'CLIENT';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: AllowedAppRole;
  projectIds: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionToken?: string;
    }
  }
}

/**
 * Normalizes any database or app role into the canonical role system.
 * Returns null for unknown, empty, or unmapped roles (NEVER defaults to ADMIN).
 */
export function normalizeAppRole(rawRole: string | undefined | null): AllowedAppRole | null {
  if (!rawRole || typeof rawRole !== 'string') return null;
  const upper = rawRole.toUpperCase().trim();
  if (upper === 'ADMIN' || upper === 'OM' || upper === 'OPERATIONS' || upper === 'OPERATIONS_MANAGER' || upper === 'OPERATIONS DIRECTOR' || upper === 'OPERATIONS_DIRECTOR') return 'ADMIN';
  if (upper === 'FINANCE') return 'FINANCE';
  if (upper === 'ENGINEER' || upper === 'PROJECT_MANAGER' || upper === 'PM') return 'ENGINEER';
  if (upper === 'TIMEKEEPER') return 'TIMEKEEPER';
  if (upper === 'CLIENT') return 'CLIENT';
  return null;
}

/**
 * Extracts session token strictly from HttpOnly cookie or Authorization Bearer header.
 * NEVER accepts user IDs, role headers, query parameters, or request body fields.
 */
export function extractSessionToken(req: Request): string | null {
  // 1. Primary: HttpOnly session cookie
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    const cookieToken = req.cookies[SESSION_COOKIE_NAME];
    if (typeof cookieToken === 'string' && cookieToken.trim().length >= 16) {
      return cookieToken.trim();
    }
  }

  // 2. Secondary: Authorization: Bearer <sessionToken>
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken.length >= 16) {
      return bearerToken;
    }
  }

  return null;
}

export type SessionVerifier = (rawToken: string | undefined) => Promise<{
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    accountStatus: any;
    projectIds: string[];
  };
  session: any;
} | null>;

let activeSessionVerifier: SessionVerifier = verifySession;

/**
 * Test-only dependency injection to provide isolated session verification during tests.
 * Strictly prohibited and blocked when running in production mode.
 */
export function setSessionVerifierForTesting(verifier: SessionVerifier | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY VIOLATION: Test session verifier injection is strictly prohibited in production.');
  }
  activeSessionVerifier = verifier || verifySession;
}

export function resetSessionVerifierForTesting(): void {
  activeSessionVerifier = verifySession;
}

/**
 * Authenticate incoming request by resolving and verifying the server-side session.
 * Does NOT accept forged headers (x-user-id, x-user-role) or query/body user IDs.
 * Does NOT automatically grant Administrator access when unauthenticated.
 */
export async function authenticateRequest(req: Request, _res: Response, next: NextFunction) {
  try {
    const rawToken = extractSessionToken(req);
    if (!rawToken) {
      req.user = undefined;
      return next();
    }

    const sessionResult = await activeSessionVerifier(rawToken);
    if (!sessionResult) {
      req.user = undefined;
      return next();
    }

    const normRole = normalizeAppRole(sessionResult.user.role);
    if (!normRole) {
      req.user = undefined;
      return next();
    }

    req.sessionToken = rawToken;
    req.user = {
      id: sessionResult.user.id,
      email: sessionResult.user.email,
      name: sessionResult.user.name,
      role: normRole,
      projectIds: sessionResult.user.projectIds || [],
    };

    next();
  } catch (error) {
    console.error('Authentication verification error:', error);
    req.user = undefined;
    next();
  }
}

/**
 * Strict requirement that a valid, active authenticated session exists.
 * Returns HTTP 401 if unauthenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized: Valid authenticated session required.',
      code: 'UNAUTHORIZED'
    });
  }
  next();
}

/**
 * Strict Role-Based Access Control Middleware.
 * Allows specified roles plus ADMIN for general administration.
 */
export function requireRole(allowedRoles: (AllowedAppRole | Role | string)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication required.',
        code: 'UNAUTHORIZED'
      });
    }

    const currentRole = req.user.role;
    const normalizedAllowed = allowedRoles
      .map(r => normalizeAppRole(String(r)))
      .filter((r): r is AllowedAppRole => r !== null);

    // ADMIN has authorized administrative oversight
    if (currentRole === 'ADMIN' || normalizedAllowed.includes(currentRole)) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Access restricted. Required role: [${normalizedAllowed.join(', ')}]. Your role: [${currentRole}].`,
      code: 'FORBIDDEN'
    });
  };
}

/**
 * Strict Role-Based Access Control Middleware enforcing Separation of Duties (SoD).
 * Does NOT permit ADMIN or any other unlisted role to bypass operational restrictions.
 */
export function requireExactRole(allowedRoles: (AllowedAppRole | Role | string)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication required.',
        code: 'UNAUTHORIZED'
      });
    }

    const currentRole = req.user.role;
    const normalizedAllowed = allowedRoles
      .map(r => normalizeAppRole(String(r)))
      .filter((r): r is AllowedAppRole => r !== null);

    if (normalizedAllowed.includes(currentRole)) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Separation of Duties (SoD) violation. This operational action is strictly restricted to [${normalizedAllowed.join(', ')}]. Your current role is [${currentRole}].`,
      code: 'FORBIDDEN_SOD'
    });
  };
}

/**
 * Checks whether the authenticated user has access to a specific project ID.
 * - DENY BY DEFAULT policy: Non-administrative users with empty projectIds are denied.
 * - ADMIN has global access for system administration.
 * - FINANCE has access for financial auditing and payroll. If assigned specific projectIds, restricted to them.
 * - ENGINEER, PROJECT_MANAGER, TIMEKEEPER, and CLIENT must have the projectId explicitly in their projectIds array.
 */
export function checkUserProjectAccess(
  user: AuthenticatedUser | undefined, 
  projectId: string | undefined
): boolean {
  if (!user || !projectId || typeof projectId !== 'string') return false;
  const cleanProjectId = projectId.trim();
  if (!cleanProjectId) return false;

  // ADMIN and FINANCE have global access for system administration, corporate treasury, and site payroll
  if (user.role === 'ADMIN' || user.role === 'FINANCE') return true;

  // All other roles (ENGINEER, PROJECT_MANAGER, TIMEKEEPER, CLIENT):
  // DENY BY DEFAULT if projectIds list is missing, empty, or doesn't include the target project
  if (!user.projectIds || !Array.isArray(user.projectIds) || user.projectIds.length === 0) {
    return false;
  }

  return user.projectIds.includes(cleanProjectId);
}

/**
 * Middleware ensuring the authenticated user has access to the requested project.
 * Rejects missing or unauthorized project identifiers with appropriate status codes.
 */
export function requireProjectAccess(projectIdExtractor?: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    const projectId = projectIdExtractor 
      ? projectIdExtractor(req)
      : (req.params.projectId || req.params.id || (req.query.projectId as string) || (req.query.project_id as string) || req.body?.projectId || req.body?.project_id);

    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return res.status(400).json({
        error: 'Bad Request: Valid project identifier is required for this operation.',
        code: 'MISSING_PROJECT_ID'
      });
    }

    if (!checkUserProjectAccess(req.user, projectId)) {
      return res.status(403).json({
        error: `Forbidden: You do not have assigned access to project [${projectId}].`,
        code: 'FORBIDDEN_PROJECT_ACCESS'
      });
    }

    next();
  };
}
