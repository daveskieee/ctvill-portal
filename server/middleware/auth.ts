/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { Role } from '@prisma/client';

export type AllowedAppRole = 'ADMIN' | 'ENGINEER' | 'TIMEKEEPER' | 'FINANCE' | 'PROJECT_MANAGER';

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
    }
  }
}

/**
 * Normalizes any legacy or case-variant role into the canonical 4-role system:
 * ADMIN, ENGINEER, TIMEKEEPER, FINANCE
 */
export function normalizeAppRole(rawRole: string | undefined | null): AllowedAppRole {
  if (!rawRole) return 'ADMIN';
  const upper = rawRole.toUpperCase().trim();
  if (upper.includes('TIME')) return 'TIMEKEEPER';
  if (upper.includes('FINANCE') || upper.includes('TREASURY') || upper === 'ACCOUNTANT') return 'FINANCE';
  if (upper.includes('ENG') || upper.includes('PROJECT') || upper.includes('PM')) return 'ENGINEER';
  if (upper === 'ADMIN' || upper.includes('OPERAT') || upper.includes('DIRECTOR') || upper === 'SUPERADMIN') return 'ADMIN';
  return (upper as AllowedAppRole);
}

/**
 * Authenticate incoming request and attach user profile
 */
export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Check headers for user ID or Authorization bearer
    const headerUserId = (req.headers['x-user-id'] || req.headers['user-id']) as string | undefined;
    const headerRole = (req.headers['x-user-role'] || req.headers['user-role']) as string | undefined;
    const authHeader = req.headers['authorization'];
    
    let resolvedUserId: string | null = null;
    if (headerUserId) {
      resolvedUserId = headerUserId;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      resolvedUserId = authHeader.substring(7).trim();
    } else if (req.query.userId && typeof req.query.userId === 'string') {
      resolvedUserId = req.query.userId;
    } else if (req.body?.logged_by_user_id || req.body?.approved_by_user_id || req.body?.userId) {
      resolvedUserId = req.body.logged_by_user_id || req.body.approved_by_user_id || req.body.userId;
    }

    if (resolvedUserId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: resolvedUserId },
        select: { id: true, email: true, name: true, role: true, projectIds: true }
      });

      if (dbUser) {
        req.user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: normalizeAppRole(dbUser.role),
          projectIds: dbUser.projectIds || []
        };
        return next();
      }
    }

    // Fallback: If header role is provided directly (e.g. from frontend dev session)
    if (headerRole) {
      const normRole = normalizeAppRole(headerRole);
      // Attempt to find any active user with that role
      const roleMatch = await prisma.user.findFirst({
        where: { role: (normRole as Role) },
        select: { id: true, email: true, name: true, role: true, projectIds: true }
      });

      req.user = {
        id: roleMatch?.id || `session-${normRole.toLowerCase()}`,
        email: roleMatch?.email || `${normRole.toLowerCase()}@ctvill.com`,
        name: roleMatch?.name || `${normRole} Officer`,
        role: normRole,
        projectIds: roleMatch?.projectIds || []
      };
      return next();
    }

    // Default to ADMIN for open internal requests if no auth provided
    const defaultAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN },
      select: { id: true, email: true, name: true, role: true, projectIds: true }
    });

    req.user = {
      id: defaultAdmin?.id || 'admin-system-default',
      email: defaultAdmin?.email || 'admin@ctvill.com',
      name: defaultAdmin?.name || 'Operations Manager',
      role: 'ADMIN',
      projectIds: defaultAdmin?.projectIds || []
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    next();
  }
}

/**
 * Strict Role-Based Access Control Middleware
 * @param allowedRoles Array of roles permitted to access this endpoint
 */
export function requireRole(allowedRoles: (AllowedAppRole | Role)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication credentials required.'
      });
    }

    const currentRole = req.user.role;
    const normalizedAllowed = allowedRoles.map(r => normalizeAppRole(String(r)));

    // ADMIN has full system access across all endpoints
    if (currentRole === 'ADMIN' || normalizedAllowed.includes(currentRole)) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Access restricted. Required role(s): [${normalizedAllowed.join(', ')}]. Your current role is [${currentRole}].`
    });
  };
}

/**
 * Strict Role-Based Access Control Middleware enforcing Separation of Duties (SoD).
 * Does NOT permit ADMIN or any other unlisted role to bypass operational restrictions.
 */
export function requireExactRole(allowedRoles: (AllowedAppRole | Role)[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication credentials required.'
      });
    }

    const currentRole = req.user.role;
    const normalizedAllowed = allowedRoles.map(r => normalizeAppRole(String(r)));

    if (normalizedAllowed.includes(currentRole)) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Separation of Duties (SoD) violation. This operational action is strictly restricted to [${normalizedAllowed.join(', ')}]. Your current role is [${currentRole}].`
    });
  };
}

