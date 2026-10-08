/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { AllowedAppRole } from './auth';

export enum UserRole {
  OM = 'OPERATIONS_MANAGER',      // Top-tier: Operations Manager / Admin (100)
  FINANCE = 'FINANCE',            // Financial tier (70)
  PM = 'PROJECT_MANAGER',          // Mid-tier: Project Manager / Site Engineer (50)
  TIMEKEEPER = 'TIMEKEEPER',      // Leaf-tier: Site Timekeeper (10)
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.OM]: 100,
  [UserRole.FINANCE]: 70,
  [UserRole.PM]: 50,
  [UserRole.TIMEKEEPER]: 10,
};

export function normalizeRole(rawRole: string | undefined | null): UserRole {
  if (!rawRole) return UserRole.OM;
  const upper = String(rawRole).toUpperCase().trim();
  if (upper.includes('TIME')) return UserRole.TIMEKEEPER;
  if (upper.includes('FINANCE') || upper.includes('TREASURY') || upper.includes('ACCOUNT')) return UserRole.FINANCE;
  if (upper.includes('ENG') || upper.includes('PROJECT') || upper.includes('PM') || upper.includes('SITE_ENG')) return UserRole.PM;
  if (upper === 'ADMIN' || upper.includes('OPERAT') || upper.includes('DIRECTOR') || upper === 'SUPERADMIN' || upper.includes('OM')) return UserRole.OM;
  return UserRole.OM;
}

export const hasRoleOrHigher = (userRole: UserRole | AllowedAppRole | string, targetRole: UserRole): boolean => {
  const normalized = typeof userRole === 'string' && Object.values(UserRole).includes(userRole as UserRole)
    ? (userRole as UserRole)
    : normalizeRole(userRole);
  return ROLE_HIERARCHY[normalized] >= ROLE_HIERARCHY[targetRole];
};

/**
 * Express middleware enforcing a minimum hierarchical role tier
 */
export function requireRoleOrHigher(targetRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized: Authentication credentials required.'
      });
    }

    const currentRole = normalizeRole(req.user.role);
    if (ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[targetRole]) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Hierarchical access restriction. Required minimum tier: ${targetRole} (${ROLE_HIERARCHY[targetRole]}). Your tier: ${currentRole} (${ROLE_HIERARCHY[currentRole]}).`
    });
  };
}
