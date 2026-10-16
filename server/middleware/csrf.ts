/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { CSRF_COOKIE_NAME, generateCsrfToken } from '../services/sessionService';
import { setCsrfCookie } from './cookies';

// Public endpoints that do not require CSRF token validation
const PUBLIC_CSRF_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/verify-invite',
  '/api/auth/activate',
  '/api/quotations/submit',
  '/api/health',
];

/**
 * Ensures a CSRF cookie exists on every incoming request.
 */
export function ensureCsrfCookieMiddleware(req: Request, res: Response, next: NextFunction) {
  const currentToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!currentToken) {
    const newToken = generateCsrfToken();
    setCsrfCookie(res, newToken);
    if (!req.cookies) req.cookies = {};
    req.cookies[CSRF_COOKIE_NAME] = newToken;
  }
  next();
}

/**
 * Enforces CSRF token check on state-changing operations (POST, PUT, PATCH, DELETE)
 */
export function verifyCsrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // Safe HTTP methods do not alter state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Exempt public onboarding and unauthenticated submission routes
  const normalizedPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
  const isExempt = PUBLIC_CSRF_EXEMPT_PATHS.some(exemptPath => 
    normalizedPath === exemptPath || req.path === exemptPath || req.originalUrl?.split('?')[0] === exemptPath
  );

  if (isExempt) {
    return next();
  }

  // Header or body submitted token
  const submittedToken = (
    req.headers['x-csrf-token'] || 
    req.headers['csrf-token'] || 
    (req.body && typeof req.body === 'object' && req.body._csrf)
  ) as string | undefined;

  const expectedToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!submittedToken || !expectedToken) {
    return res.status(403).json({
      error: 'Forbidden: Missing CSRF security token. Please refresh the page and try again.',
      code: 'CSRF_MISSING'
    });
  }

  // Timing safe comparison
  const submittedBuf = Buffer.from(String(submittedToken).trim());
  const expectedBuf = Buffer.from(String(expectedToken).trim());

  if (submittedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(submittedBuf, expectedBuf)) {
    return res.status(403).json({
      error: 'Forbidden: Invalid CSRF security token mismatch.',
      code: 'CSRF_INVALID'
    });
  }

  next();
}
