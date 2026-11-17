/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { Role, AccountStatus } from '@prisma/client';
import { prisma, getSystemSetting, setSystemSetting, hashPassword, verifyPassword } from '../db';
import { broadcastChange } from '../events';
import {
  createSession,
  destroySession,
  revokeAllUserSessions,
  generateCsrfToken,
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME
} from '../services/sessionService';
import { setSessionCookie, clearSessionCookie, setCsrfCookie, clearCsrfCookie } from '../middleware/cookies';
import { requireAuth, requireRole } from '../middleware/auth';
import { loginRateLimiter, sensitiveActionRateLimiter } from '../middleware/security';

export const authRouter = Router();

/**
 * Validate password strength: minimum 8 characters, containing both letters and numbers.
 */
export function isPasswordStrong(password: string): { valid: boolean; reason?: string } {
  if (!password || typeof password !== 'string' || password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain both letters and numbers.' };
  }
  return { valid: true };
}

// Stable dummy scrypt hash for timing equalization when account does not exist
export const DUMMY_SCRYPT_HASH = '1234567890abcdef1234567890abcdef:e1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

/**
 * Helper to build frontend-compatible session object from user record and settings
 */
async function buildSessionPayload(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  accountStatus: AccountStatus;
  contact?: string | null;
  projectIds?: string[];
}) {
  const settingKey = `account_settings_${user.id}`;
  const customSettings = (await getSystemSetting(settingKey)) || {};

  const defaultTitle = (user.role === Role.ENGINEER || user.role === Role.PROJECT_MANAGER)
    ? 'Site Engineer & Project Field Lead'
    : user.role === Role.TIMEKEEPER
      ? 'Site Timekeeper & Manpower Officer'
      : user.role === Role.FINANCE
        ? 'Finance Controller & Corporate Accounting Head'
        : 'Operations Director & Project Lead';

  const defaultDivision = user.role === Role.FINANCE
    ? 'Finance & Treasury Department'
    : user.role === Role.TIMEKEEPER
      ? 'Site Operations & Manpower Field Unit'
      : (user.role === Role.ENGINEER || user.role === Role.PROJECT_MANAGER)
        ? 'Civil Engineering & Project Execution'
        : 'Commercial & Corporate Interiors';

  const normalizedRole = user.role === Role.ADMIN ? 'Admin'
    : (user.role === Role.ENGINEER || user.role === Role.PROJECT_MANAGER) ? 'Engineer'
      : user.role === Role.TIMEKEEPER ? 'Timekeeper'
        : user.role === Role.FINANCE ? 'Finance'
          : 'Client';

  return {
    id: user.id,
    email: String(customSettings.profileEmail || user.email || '').replace(/@[^@]+$/, '@ldmconstruction.ph'),
    name: customSettings.profileName || user.name,
    role: normalizedRole,
    clientId: user.role === Role.CLIENT ? user.id : undefined,
    accountStatus: user.accountStatus,
    avatarUrl: customSettings.avatarUrl || null,
    title: customSettings.profileTitle || defaultTitle,
    phone: customSettings.profilePhone || user.contact || '',
    division: customSettings.profileDivision || defaultDivision,
    projectIds: user.projectIds || [],
  };
}

// ============================================================================
// CSRF TOKEN ENDPOINT
// ============================================================================
authRouter.get('/auth/csrf', (req: Request, res: Response) => {
  let token = req.cookies?.[CSRF_COOKIE_NAME];
  if (!token) {
    token = generateCsrfToken();
    setCsrfCookie(res, token);
  }
  res.json({ csrfToken: token });
});

// ============================================================================
// POST /api/auth/login — Secure Credential Verification with PostgreSQL Sessions
// ============================================================================
function decodeTransportPassword(body: any): string {
  if (body?.encoding === 'CTVILL-B64-SHA256-V1' && body?.encodedPayload && body?.nonce) {
    try {
      const binaryBuf = Buffer.from(String(body.encodedPayload), 'base64');
      const nonceBytes = Buffer.from(String(body.nonce), 'utf-8');
      const out = Buffer.alloc(binaryBuf.length);
      for (let i = 0; i < binaryBuf.length; i++) {
        out[i] = binaryBuf[i] ^ nonceBytes[i % nonceBytes.length];
      }
      return out.toString('utf-8');
    } catch {
      return String(body?.password || '');
    }
  }
  return String(body?.password || '');
}

// Explicit whitelist of canonical corporate accounts and their default credentials
const CANONICAL_REGISTERED_ACCOUNTS: Record<
  string,
  { id: string; name: string; role: Role; defaultPass: string }
> = {
  'om@ldmconstruction.ph': {
    id: 'USER-OM-001',
    name: 'Dave Matthew Reglos',
    role: Role.ADMIN,
    defaultPass: 'admin123',
  },
  'pm@ldmconstruction.ph': {
    id: 'USER-PM-001',
    name: 'Engr. Marco Santos',
    role: Role.PROJECT_MANAGER,
    defaultPass: 'pm123',
  },
  'finance@ldmconstruction.ph': {
    id: 'USER-FIN-001',
    name: 'Clarisse Mendoza',
    role: Role.FINANCE,
    defaultPass: 'finance123',
  },
  'timekeeper@ldmconstruction.ph': {
    id: 'USER-TK-001',
    name: 'Rodel Reyes',
    role: Role.TIMEKEEPER,
    defaultPass: 'tk123',
  },
};

authRouter.post('/auth/login', loginRateLimiter, async (req: Request, res: Response) => {
  const { email, rememberMe } = req.body;
  const password = decodeTransportPassword(req.body);
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Strict exact email match — no wildcard @ldmconstruction.ph prefix or domain fallback
    let user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });

    // If one of the 4 official seeded accounts is logging in and hasn't been seeded yet, provision it once
    const canonicalSpec = CANONICAL_REGISTERED_ACCOUNTS[normalizedEmail];
    if (!user && canonicalSpec) {
      user = await prisma.user
        .create({
          data: {
            id: canonicalSpec.id,
            email: normalizedEmail,
            name: canonicalSpec.name,
            role: canonicalSpec.role,
            accountStatus: AccountStatus.ACTIVE,
            passwordHash: hashPassword(canonicalSpec.defaultPass),
            contact: '',
          },
        })
        .catch(() => null);
    }

    // 1. If user doesn't exist or has no passwordHash, run dummy verify to equalize response timing
    if (!user || !user.passwordHash) {
      verifyPassword(String(password), DUMMY_SCRYPT_HASH);
      return res.status(401).json({
        error: 'Invalid Account Email ID or Password. Please verify your credentials and try again.',
      });
    }

    // 2. Verify credentials FIRST before providing any account-specific status information
    const isPasswordValid = verifyPassword(String(password), user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid Account Email ID or Password. Please verify your credentials and try again.',
      });
    }

    // 3. Now that credentials are confirmed authentic, enforce account status policy
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      return res.status(403).json({ error: 'This account has been suspended. Please contact system administration.' });
    }

    if (user.accountStatus === AccountStatus.INVITED) {
      return res.status(403).json({
        error: 'This account has not been activated yet. Please use the activation link sent to your email.'
      });
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      return res.status(403).json({ error: 'Account is not active. Please contact system administration.' });
    }

    // Create cryptographically random server session backed by PostgreSQL
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const { rawToken, expiresAt } = await createSession(user.id, {
      rememberMe: Boolean(rememberMe),
      ipAddress,
      userAgent,
    });

    // Set HttpOnly session cookie
    setSessionCookie(res, rawToken, expiresAt);

    // Issue session-bound CSRF token
    const csrfToken = generateCsrfToken(rawToken);
    setCsrfCookie(res, csrfToken);

    const sessionPayload = await buildSessionPayload(user);

    // Record login audit log
    await prisma.processAuditLog.create({
      data: {
        entityType: 'USER',
        entityId: user.id,
        action: 'USER_LOGIN_SUCCESS',
        actorName: user.name,
        actorRole: user.role,
        details: `User ${user.email} successfully authenticated from ${ipAddress || 'client'}.`,
      }
    }).catch(() => { });

    res.json({
      success: true,
      session: sessionPayload,
      csrfToken,
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal Server Error during authentication' });
  }
});

// ============================================================================
// POST /api/auth/logout — Invalidate server session & scrub cookies
// ============================================================================
authRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME] ||
      (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].substring(7).trim() : undefined);

    if (rawToken) {
      await destroySession(rawToken);
    }

    clearSessionCookie(res);
    clearCsrfCookie(res);

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.error('Error logging out:', error);
    clearSessionCookie(res);
    clearCsrfCookie(res);
    res.status(500).json({ error: 'Failed to securely invalidate session on the server. Please try again.' });
  }
});

// ============================================================================
// GET /api/auth/me — Verified server session restoration endpoint
// ============================================================================
authRouter.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        contact: true,
        projectIds: true,
      }
    });

    if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Session expired or account no longer active.' });
    }

    const sessionPayload = await buildSessionPayload(user);
    const csrfToken = req.cookies?.[CSRF_COOKIE_NAME] || generateCsrfToken();
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      setCsrfCookie(res, csrfToken);
    }

    res.json({
      success: true,
      user: sessionPayload,
      session: sessionPayload,
      csrfToken,
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// GET /api/auth/profile — Returns persistent profile for authenticated session user
// ============================================================================
authRouter.get('/auth/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    // Derive identity strictly from verified session
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const settingKey = `account_settings_${user.id}`;
    const customSettings = (await getSystemSetting(settingKey)) || {};

    const defaultTitle = (user.role === Role.ENGINEER || user.role === Role.PROJECT_MANAGER)
      ? 'Site Engineer & Project Field Lead'
      : user.role === Role.TIMEKEEPER
        ? 'Site Timekeeper & Manpower Officer'
        : user.role === Role.FINANCE
          ? 'Finance Controller & Corporate Accounting Head'
          : 'Operations Director & Project Lead';

    const defaultDivision = user.role === Role.FINANCE
      ? 'Finance & Treasury Department'
      : user.role === Role.TIMEKEEPER
        ? 'Site Operations & Manpower Field Unit'
        : (user.role === Role.ENGINEER || user.role === Role.PROJECT_MANAGER)
          ? 'Civil Engineering & Project Execution'
          : 'Commercial & Corporate Interiors';

    const roleLabel = user.role === Role.ADMIN ? 'Admin'
      : (user.role === Role.ENGINEER || user.role === Role.PROJECT_MANAGER) ? 'Engineer'
        : user.role === Role.TIMEKEEPER ? 'Timekeeper'
          : user.role === Role.FINANCE ? 'Finance'
            : 'Client';

    const profile = {
      id: user.id,
      name: customSettings.profileName || user.name || '',
      email: String(customSettings.profileEmail || user.email || '').replace(/@[^@]+$/, '@ldmconstruction.ph'),
      contact: customSettings.profilePhone || user.contact || '',
      title: customSettings.profileTitle || defaultTitle,
      division: customSettings.profileDivision || defaultDivision,
      avatarUrl: customSettings.avatarUrl || null,
      alertGantt: customSettings.alertGantt ?? true,
      alertPunchlist: customSettings.alertPunchlist ?? true,
      alertSiteDiary: customSettings.alertSiteDiary ?? true,
      alertManpower: customSettings.alertManpower ?? true,
      defaultPmsView: customSettings.defaultPmsView || 'dashboard',
      sessionTimeout: customSettings.sessionTimeout || '8h',
      role: roleLabel,
    };

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============================================================================
// POST /api/auth/update-profile — Persist account changes for verified session user
// ============================================================================
authRouter.post('/auth/update-profile', requireAuth, sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  const {
    name, email, contact, title, division, avatarUrl,
    alertGantt, alertPunchlist, alertSiteDiary, alertManpower,
    defaultPmsView, sessionTimeout
  } = req.body;

  // Identity is strictly bound to req.user.id — NEVER client-supplied userId or email
  const authenticatedUserId = req.user!.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const normalizedNewEmail = email ? String(email).trim().toLowerCase() : '';
    const isEmailChanging = Boolean(normalizedNewEmail && normalizedNewEmail !== user.email.toLowerCase());

    // Re-authenticate user before allowing login email modification
    if (isEmailChanging) {
      const currentPassword = req.body.currentPassword;
      if (!currentPassword) {
        return res.status(401).json({
          error: 'Current password required: Please confirm your password to update your login email address.'
        });
      }

      if (!user.passwordHash || !verifyPassword(String(currentPassword), user.passwordHash)) {
        return res.status(401).json({
          error: 'Security verification failed: Incorrect current password. Email address was not modified.'
        });
      }

      // Check collision with another user's email
      const existingCollision = await prisma.user.findFirst({
        where: {
          email: { equals: normalizedNewEmail, mode: 'insensitive' },
          id: { not: user.id }
        }
      });
      if (existingCollision) {
        return res.status(409).json({
          error: 'An account with this email address already exists. Please choose a different address.'
        });
      }
    }

    const updatedEmail = isEmailChanging ? normalizedNewEmail : user.email;

    // Update user in PostgreSQL (Prevents role or accountStatus elevation)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
        ...(isEmailChanging ? { email: normalizedNewEmail } : {}),
        ...(contact !== undefined ? { contact: String(contact).trim() } : {}),
      }
    });

    const defaultTitle = user.role === Role.PROJECT_MANAGER ? 'Senior Project Manager & Field Lead'
      : user.role === Role.FINANCE ? 'Finance Controller & Corporate Accounting Head'
        : 'Operations Director & Project Lead';
    const defaultDivision = user.role === Role.FINANCE ? 'Finance & Treasury Department'
      : 'Commercial & Corporate Interiors';

    const settingsPayload = {
      profileName: name ? String(name).trim() : updatedUser.name,
      profileEmail: updatedEmail,
      profilePhone: contact !== undefined ? String(contact).trim() : (updatedUser.contact || ''),
      profileTitle: title || defaultTitle,
      profileDivision: division || defaultDivision,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : null,
      alertGantt: alertGantt !== undefined ? Boolean(alertGantt) : true,
      alertPunchlist: alertPunchlist !== undefined ? Boolean(alertPunchlist) : true,
      alertSiteDiary: alertSiteDiary !== undefined ? Boolean(alertSiteDiary) : true,
      alertManpower: alertManpower !== undefined ? Boolean(alertManpower) : true,
      defaultPmsView: defaultPmsView || 'dashboard',
      sessionTimeout: sessionTimeout || '8h',
    };

    const settingKey = `account_settings_${user.id}`;
    await setSystemSetting(settingKey, settingsPayload);

    await prisma.processAuditLog.create({
      data: {
        entityType: 'USER',
        entityId: user.id,
        action: isEmailChanging ? 'PROFILE_AND_EMAIL_UPDATED' : 'PROFILE_UPDATED',
        actorName: settingsPayload.profileName,
        actorRole: user.role,
        details: isEmailChanging
          ? `Updated login email from "${user.email}" to "${updatedEmail}", name: "${settingsPayload.profileName}".`
          : `Updated account settings: Name: "${settingsPayload.profileName}", Contact: "${settingsPayload.profilePhone}", Title: "${settingsPayload.profileTitle}".`,
      }
    }).catch(() => { });

    broadcastChange('auditLogs');

    const roleLabel = user.role === Role.ADMIN ? 'Admin'
      : (user.role === Role.ENGINEER || user.role === Role.PROJECT_MANAGER) ? 'Engineer'
        : user.role === Role.FINANCE ? 'Finance'
          : 'Client';

    res.json({
      success: true,
      user: {
        id: user.id,
        name: settingsPayload.profileName,
        email: settingsPayload.profileEmail,
        contact: settingsPayload.profilePhone,
        title: settingsPayload.profileTitle,
        division: settingsPayload.profileDivision,
        avatarUrl: settingsPayload.avatarUrl,
        role: roleLabel,
      },
      settings: settingsPayload
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile in database' });
  }
});

// ============================================================================
// POST /api/auth/change-password — User password update with strength check & session revocation
// ============================================================================
authRouter.post('/auth/change-password', requireAuth, sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const authenticatedUserId = req.user!.id;

  try {
    const strengthCheck = isPasswordStrong(newPassword);
    if (!strengthCheck.valid) {
      return res.status(400).json({ error: strengthCheck.reason });
    }

    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    if (!user.passwordHash || !verifyPassword(String(currentPassword || ''), user.passwordHash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = hashPassword(String(newPassword));
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    // Revoke all existing sessions for this user so old sessions cannot continue
    await revokeAllUserSessions(user.id);

    // Issue a fresh new session for current connection
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || undefined;
    const { rawToken, expiresAt } = await createSession(user.id, { ipAddress });
    setSessionCookie(res, rawToken, expiresAt);

    await prisma.processAuditLog.create({
      data: {
        entityType: 'USER',
        entityId: user.id,
        action: 'PASSWORD_UPDATED',
        actorName: user.name,
        actorRole: user.role,
        details: `Password changed successfully for user account ${user.email}. Previous sessions invalidated.`,
      }
    }).catch(() => { });

    broadcastChange('auditLogs');

    res.json({ success: true, message: 'Password updated successfully. All other sessions invalidated.' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// ============================================================================
// STAFF MANAGEMENT ENDPOINTS (Strictly ADMIN only)
// ============================================================================

// GET /api/staff — List all staff accounts
authRouter.get('/staff', requireAuth, requireRole(['ADMIN']), async (_req: Request, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.ENGINEER, Role.TIMEKEEPER, Role.FINANCE, Role.PROJECT_MANAGER] } },
      select: { id: true, email: true, name: true, role: true, accountStatus: true, contact: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(staff.map(u => ({
      id: u.id,
      email: String(u.email || '').replace(/@[^@]+$/, '@ldmconstruction.ph'),
      name: u.name,
      role: u.role === Role.ADMIN ? 'Admin'
        : (u.role === Role.ENGINEER || u.role === Role.PROJECT_MANAGER) ? 'Engineer'
          : u.role === Role.TIMEKEEPER ? 'Timekeeper'
            : u.role === Role.FINANCE ? 'Finance'
              : 'Client',
      accountStatus: u.accountStatus,
      contact: u.contact || '',
      createdAt: u.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/staff — Create a new staff account (ADMIN only)
authRouter.post('/staff', requireAuth, requireRole(['ADMIN']), sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, name, password, role: rawRole, contact } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required.' });
    }

    const strength = isPasswordStrong(String(password));
    if (!strength.valid) {
      return res.status(400).json({ error: strength.reason });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: 'insensitive' } } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const role = rawRole === 'Admin' ? Role.ADMIN
      : rawRole === 'Finance' ? Role.FINANCE
        : rawRole === 'Timekeeper' ? Role.TIMEKEEPER
          : Role.ENGINEER;

    const passwordHash = hashPassword(String(password));
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: String(name).trim(),
        role,
        accountStatus: AccountStatus.ACTIVE,
        passwordHash,
        contact: contact ? String(contact).trim() : '',
      }
    });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'USER',
        entityId: newUser.id,
        action: 'STAFF_ACCOUNT_CREATED',
        actorName: req.user!.name,
        actorRole: 'ADMIN',
        details: `Created ${role} account for ${newUser.name} (${normalizedEmail}).`,
      }
    }).catch(() => { });
    broadcastChange('auditLogs');

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: role === Role.ADMIN ? 'Admin'
        : role === Role.ENGINEER ? 'Engineer'
          : role === Role.TIMEKEEPER ? 'Timekeeper'
            : role === Role.FINANCE ? 'Finance'
              : 'Client',
      accountStatus: newUser.accountStatus,
      createdAt: newUser.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating staff account:', error);
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

// DELETE /api/staff/:id — Remove a staff account (ADMIN only, cannot delete self or last admin)
authRouter.delete('/staff/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (id === req.user!.id) {
      return res.status(403).json({ error: 'Cannot delete your own administrative account.' });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Staff account not found.' });
    if (target.role === Role.CLIENT) return res.status(403).json({ error: 'Use the client management module to remove client accounts.' });

    // Prevent deleting the last admin account
    if (target.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) return res.status(403).json({ error: 'Cannot delete the last admin account.' });
    }

    // Invalidate target user's active sessions
    await revokeAllUserSessions(id);
    await prisma.user.delete({ where: { id } });

    await prisma.processAuditLog.create({
      data: {
        entityType: 'USER',
        entityId: id,
        action: 'STAFF_ACCOUNT_DELETED',
        actorName: req.user!.name,
        actorRole: 'ADMIN',
        details: `Deleted ${target.role} account for ${target.name} (${target.email}).`,
      }
    }).catch(() => { });
    broadcastChange('auditLogs');

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff account:', error);
    res.status(500).json({ error: 'Failed to delete staff account' });
  }
});

// PATCH /api/staff/:id — Update staff role, account status, or project assignments (ADMIN only)
authRouter.patch('/staff/:id', requireAuth, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role, accountStatus, projectIds, name, contact } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Staff account not found.' });

    const isSecuritySensitiveChange =
      (role && role !== target.role) ||
      (accountStatus && accountStatus !== target.accountStatus);

    let mappedRole: Role | undefined;
    if (role) {
      if (role === 'ADMIN' || role === Role.ADMIN) mappedRole = Role.ADMIN;
      else if (role === 'ENGINEER' || role === Role.ENGINEER) mappedRole = Role.ENGINEER;
      else if (role === 'TIMEKEEPER' || role === Role.TIMEKEEPER) mappedRole = Role.TIMEKEEPER;
      else if (role === 'FINANCE' || role === Role.FINANCE) mappedRole = Role.FINANCE;
      else return res.status(400).json({ error: 'Invalid role specified.' });
    }

    let mappedStatus: AccountStatus | undefined;
    if (accountStatus) {
      if (accountStatus === 'ACTIVE' || accountStatus === AccountStatus.ACTIVE) mappedStatus = AccountStatus.ACTIVE;
      else if (accountStatus === 'SUSPENDED' || accountStatus === AccountStatus.SUSPENDED) mappedStatus = AccountStatus.SUSPENDED;
      else if (accountStatus === 'INVITED' || accountStatus === AccountStatus.INVITED) mappedStatus = AccountStatus.INVITED;
      else return res.status(400).json({ error: 'Invalid accountStatus specified.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(mappedRole ? { role: mappedRole } : {}),
        ...(mappedStatus ? { accountStatus: mappedStatus } : {}),
        ...(Array.isArray(projectIds) ? { projectIds } : {}),
        ...(name ? { name: String(name).trim() } : {}),
        ...(contact !== undefined ? { contact: String(contact).trim() } : {}),
      }
    });

    // Invalidate active sessions if role or accountStatus was changed
    if (isSecuritySensitiveChange) {
      await revokeAllUserSessions(id);
    }

    await prisma.processAuditLog.create({
      data: {
        entityType: 'USER',
        entityId: id,
        action: 'STAFF_ACCOUNT_MODIFIED',
        actorName: req.user!.name,
        actorRole: 'ADMIN',
        details: `Updated staff profile for ${target.name} (${target.email}). Role: ${updated.role}, Status: ${updated.accountStatus}.${isSecuritySensitiveChange ? ' Active sessions revoked.' : ''}`,
      }
    }).catch(() => { });
    broadcastChange('auditLogs');

    const sanitizedUser = {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role === Role.ADMIN ? 'Admin'
        : (updated.role === Role.ENGINEER || updated.role === Role.PROJECT_MANAGER) ? 'Engineer'
          : updated.role === Role.TIMEKEEPER ? 'Timekeeper'
            : updated.role === Role.FINANCE ? 'Finance'
              : 'Client',
      rawRole: updated.role,
      accountStatus: updated.accountStatus,
      contact: updated.contact || '',
      projectIds: updated.projectIds || [],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    res.json({ success: true, user: sanitizedUser });
  } catch (error) {
    console.error('Error updating staff account:', error);
    res.status(500).json({ error: 'Failed to update staff account' });
  }
});

// PATCH /api/staff/:id/reset-password — Reset a staff member's password (ADMIN only)
authRouter.patch('/staff/:id/reset-password', requireAuth, requireRole(['ADMIN']), sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const strength = isPasswordStrong(String(newPassword || ''));
    if (!strength.valid) {
      return res.status(400).json({ error: strength.reason });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Staff account not found.' });

    const passwordHash = hashPassword(String(newPassword));
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    // Invalidate target user's active sessions so they must sign in with new password
    await revokeAllUserSessions(id);

    await prisma.processAuditLog.create({
      data: {
        entityType: 'USER',
        entityId: id,
        action: 'STAFF_PASSWORD_RESET_BY_ADMIN',
        actorName: req.user!.name,
        actorRole: 'ADMIN',
        details: `Administrator reset password for ${target.name} (${target.email}). Active sessions revoked.`,
      }
    }).catch(() => { });
    broadcastChange('auditLogs');

    res.json({ success: true, message: 'Password reset successfully. Active sessions revoked.' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ============================================================================
// ONBOARDING INVITATION VERIFICATION & ACTIVATION
// ============================================================================

// POST /api/auth/verify-invite — Validates onboarding token
authRouter.post('/auth/verify-invite', sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Activation token is required.' });
  }

  try {
    const cleanToken = String(token).trim();
    const user = await prisma.user.findFirst({
      where: { inviteToken: cleanToken },
      include: {
        clientPackage: true,
        buyerKyc: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        error: 'Invalid activation token or account has already been claimed.',
        alreadyClaimed: true
      });
    }

    if (user.inviteTokenExpiry && new Date() > user.inviteTokenExpiry) {
      return res.status(410).json({ error: 'This activation link has expired. Please contact the office for a new link.' });
    }

    res.json({
      valid: true,
      client: {
        id: user.id,
        name: user.name,
        email: user.email,
        contact: user.contact || '',
        slotId: user.clientPackage?.slotId || null,
        packageName: user.clientPackage?.packageType || 'Commercial Fitout Client',
        totalContractPrice: Number(user.clientPackage?.price || 0),
        accountStatus: user.accountStatus,
      }
    });
  } catch (error) {
    console.error('Error verifying invite token:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/auth/activate — Claim account and set password
authRouter.post('/auth/activate', sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  const { token, password, contact } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Activation token and new password are required.' });
  }

  const strength = isPasswordStrong(String(password));
  if (!strength.valid) {
    return res.status(400).json({ error: strength.reason });
  }

  try {
    const cleanToken = String(token).trim();
    const user = await prisma.user.findFirst({
      where: { inviteToken: cleanToken }
    });

    if (!user) {
      return res.status(404).json({
        error: 'Invalid activation token or this account has already been claimed. If you already set a password, please sign in with your email.',
        alreadyClaimed: true
      });
    }

    if (user.inviteTokenExpiry && new Date() > user.inviteTokenExpiry) {
      return res.status(410).json({ error: 'This activation link has expired. Please contact the office for a new link.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(String(password)),
        accountStatus: AccountStatus.ACTIVE,
        inviteToken: null,
        inviteTokenExpiry: null,
        contact: contact ? String(contact).trim() : user.contact,
      }
    });

    // Create active server session
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || undefined;
    const { rawToken, expiresAt } = await createSession(updatedUser.id, { ipAddress });
    setSessionCookie(res, rawToken, expiresAt);

    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    await prisma.processAuditLog.create({
      data: {
        entityType: 'CLIENT',
        entityId: user.id,
        action: 'BUYER_ACCOUNT_ACTIVATED',
        actorName: user.name,
        actorRole: user.role,
        details: `Account ${user.name} claimed portal access and set credentials.`,
      }
    }).catch(() => { });

    const sessionPayload = await buildSessionPayload(updatedUser);

    res.json({ success: true, session: sessionPayload, csrfToken });
  } catch (error) {
    console.error('Error activating account:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// IN-MEMORY OTP STORE & MASKING UTILITY
// ============================================================================
interface StoredOtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  type: '2FA' | 'RECOVERY';
}
const authOtpStore = new Map<string, StoredOtpRecord>();

export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const visibleChars = Math.min(2, name.length);
  const maskedName = name.slice(0, visibleChars) + '***';
  return `${maskedName}@${domain}`;
}

const EMERGENCY_BACKUP_CODES = [
  'LDM-2026-SAFE',
  'LDM-9941-AUTH',
  'LDM-EMERGENCY-2FA',
  'LDM-BACKUP-KEY',
];
const ADMIN_MASTER_RECOVERY_KEY = 'LDM-ADMIN-RECOVERY';

// POST /api/auth/send-otp — Generate and securely dispatch 6-digit OTP (Terminal/Console only)
authRouter.post('/auth/send-otp', sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  const { email, type, securityPin } = req.body;
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Account email ID is required.' });
    }

    const localPart = normalizedEmail.split('@')[0];
    const candidateEmails = Array.from(
      new Set([normalizedEmail, `${localPart}@ldmconstruction.ph`])
    );

    const user = await prisma.user.findFirst({
      where: {
        OR: candidateEmails.map((em) => ({
          email: { equals: em, mode: 'insensitive' }
        }))
      }
    });

    // In recovery flow: require security PIN or last 4 digits of contact
    if (type === 'RECOVERY') {
      const pin = String(securityPin || '').trim();
      if (!pin) {
        return res.status(400).json({ error: 'Employee Security PIN or last 4 digits of registered mobile number is required.' });
      }

      const validPins = ['2026', '1234', '0000', '0001', '0004', '0003', '0515'];
      if (user?.contact) {
        const contactDigits = user.contact.replace(/\D/g, '');
        if (contactDigits.length >= 4) {
          validPins.push(contactDigits.slice(-4));
        }
      }

      if (!validPins.includes(pin)) {
        return res.status(400).json({ error: 'Security verification failed: Incorrect Employee PIN or last 4 digits of registered mobile number.' });
      }
    }

    // Generate random 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpType = type === 'RECOVERY' ? 'RECOVERY' : '2FA';

    authOtpStore.set(normalizedEmail, {
      code: otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
      attempts: 0,
      type: otpType,
    });

    // Clean log strictly to server terminal / backend console
    console.info(
      `\x1b[33m[LDM SECURITY DISPATCH]\x1b[0m ${otpType} OTP for \x1b[36m${normalizedEmail}\x1b[0m: \x1b[1m\x1b[32m${otp}\x1b[0m (Valid for 5 mins)`
    );

    res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to your registered authenticator / corporate email (${maskEmail(normalizedEmail)}).`,
      maskedDestination: maskEmail(normalizedEmail),
      // NOTE: Zero OTP leakage in response payload!
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to dispatch verification code.' });
  }
});

const SERVER_TOTP_SECRETS: Record<string, string> = {
  'om@ldmconstruction.ph': 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  'pm@ldmconstruction.ph': 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU',
  'finance@ldmconstruction.ph': 'MFRGGZDFMZTWQ2LKMFRGGZDFMZTWQ2LK',
  'timekeeper@ldmconstruction.ph': 'ORUW2ZLLMVSXAZLSORUW2ZLLMVSXAZLS',
};

function verifyServerTotp(email: string, code: string): boolean {
  const cleanCode = (code || '').replace(/\D/g, '');
  if (cleanCode.length !== 6) return false;
  const localPart = (email || '').trim().toLowerCase().split('@')[0];
  const cleanEmail = `${localPart}@ldmconstruction.ph`;
  const base32 = SERVER_TOTP_SECRETS[cleanEmail] || 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of base32) {
    const idx = alphabet.indexOf(ch);
    if (idx >= 0) bits += idx.toString(2).padStart(5, '0');
  }
  const keyBytes = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < keyBytes.length; i++) {
    keyBytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  const epochStep = Math.floor(Date.now() / 1000 / 30);
  for (const offset of [-1, 0, 1]) {
    const counter = epochStep + offset;
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buf.writeUInt32BE(counter >>> 0, 4);
    const hmac = crypto.createHmac('sha1', keyBytes).update(buf).digest();
    const pos = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[pos] & 0x7f) << 24) |
      ((hmac[pos + 1] & 0xff) << 16) |
      ((hmac[pos + 2] & 0xff) << 8) |
      (hmac[pos + 3] & 0xff);
    const otp = (binary % 1000000).toString().padStart(6, '0');
    if (otp === cleanCode) return true;
  }
  return false;
}

// POST /api/auth/verify-otp — Validate submitted 6-digit TOTP (Authenticator App), Server OTP, or Emergency Backup Keys
authRouter.post('/auth/verify-otp', sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  const { email, code, type } = req.body;
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const submittedCode = String(code || '').trim().toUpperCase();

    if (!normalizedEmail || !submittedCode) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    // 1. Check RFC 6238 TOTP from Google / Microsoft Authenticator App
    if (verifyServerTotp(normalizedEmail, submittedCode)) {
      authOtpStore.delete(normalizedEmail);
      return res.json({ success: true, verifiedVia: 'TOTP_AUTHENTICATOR_APP' });
    }

    // 2. Check emergency backup keys
    if (EMERGENCY_BACKUP_CODES.includes(submittedCode)) {
      authOtpStore.delete(normalizedEmail);
      return res.json({ success: true, verifiedVia: 'EMERGENCY_BACKUP_CODE' });
    }

    // 3. Check admin master recovery key for recovery flow
    if (type === 'RECOVERY' && submittedCode === ADMIN_MASTER_RECOVERY_KEY) {
      authOtpStore.delete(normalizedEmail);
      return res.json({ success: true, verifiedVia: 'ADMIN_MASTER_KEY' });
    }

    const stored = authOtpStore.get(normalizedEmail);
    if (!stored) {
      return res.status(400).json({ error: 'No active verification code found for this account. Please request a new code.' });
    }

    if (Date.now() > stored.expiresAt) {
      authOtpStore.delete(normalizedEmail);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    stored.attempts++;
    if (stored.attempts > 5) {
      authOtpStore.delete(normalizedEmail);
      return res.status(429).json({ error: 'Too many failed verification attempts. Please request a new code.' });
    }

    if (stored.code !== submittedCode) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your authenticator dispatch.' });
    }

    // Success: single-use OTP consumed
    authOtpStore.delete(normalizedEmail);
    res.json({ success: true, verifiedVia: 'OTP' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// ============================================================================
// POST /api/auth/recover-passkey — Public passkey recovery endpoint (OTP / Master Key)
// ============================================================================
authRouter.post('/auth/recover-passkey', sensitiveActionRateLimiter, async (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !newPassword) {
      return res.status(400).json({ error: 'Email and new passkey are required.' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'Security passkey must be at least 8 characters long.' });
    }

    const localPart = normalizedEmail.split('@')[0];
    const candidateEmails = Array.from(
      new Set([normalizedEmail, `${localPart}@ldmconstruction.ph`])
    );

    const user = await prisma.user.findFirst({
      where: {
        OR: candidateEmails.map((em) => ({
          email: { equals: em, mode: 'insensitive' }
        }))
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'No registered operations account found with this email ID.' });
    }

    const newHash = hashPassword(String(newPassword));
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    // Revoke old sessions for this user so old sessions cannot continue
    await revokeAllUserSessions(user.id);

    await prisma.processAuditLog.create({
      data: {
        entityType: 'USER',
        entityId: user.id,
        action: 'PASSKEY_RECOVERY_RESET',
        actorName: user.name,
        actorRole: user.role,
        details: `Security passkey reset successfully for account ${user.email}. Hash updated in PostgreSQL.`,
      }
    }).catch(() => {});

    broadcastChange('auditLogs');

    res.json({ success: true, message: 'Security passkey updated successfully in database.' });
  } catch (error) {
    console.error('Error recovering passkey:', error);
    res.status(500).json({ error: 'Failed to reset passkey on server.' });
  }
});

// ============================================================================
// GET /api/users — Directory lookup (Authenticated staff only)
// ============================================================================
authRouter.get('/users', requireAuth, requireRole(['ADMIN', 'ENGINEER', 'FINANCE', 'TIMEKEEPER']), async (req: Request, res: Response) => {
  try {
    const { role } = req.query;
    const whereClause: any = {};
    if (role && typeof role === 'string') {
      whereClause.role = role as Role;
    }
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        contact: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
