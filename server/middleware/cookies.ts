/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME } from '../services/sessionService';

declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
    }
  }
}

/**
 * Robust zero-dependency cookie header parser
 */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header || typeof header !== 'string') return cookies;

  const pairs = header.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const rawKey = pair.substring(0, idx).trim();
    const rawVal = pair.substring(idx + 1).trim();
    if (!rawKey) continue;
    try {
      cookies[rawKey] = decodeURIComponent(rawVal);
    } catch {
      cookies[rawKey] = rawVal;
    }
  }
  return cookies;
}

/**
 * Express middleware to populate req.cookies
 */
export function cookieParserMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!req.cookies) {
    req.cookies = parseCookieHeader(req.headers.cookie);
  }
  next();
}

/**
 * Standard cookie configuration for authentication and CSRF
 */
export function getCookieOptions(options: {
  maxAgeMs?: number;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
} = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: options.httpOnly !== undefined ? options.httpOnly : true,
    secure: isProduction,
    sameSite: (options.sameSite || 'lax') as 'lax' | 'strict' | 'none',
    path: '/',
    maxAge: options.maxAgeMs !== undefined ? options.maxAgeMs : undefined,
  };
}

/**
 * Set the authentication session cookie
 */
export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  const maxAgeMs = Math.max(0, expiresAt.getTime() - Date.now());
  const options = getCookieOptions({
    maxAgeMs,
    httpOnly: true,
    sameSite: 'lax',
  });
  res.cookie(SESSION_COOKIE_NAME, token, options);
}

/**
 * Clear the authentication session cookie
 */
export function clearSessionCookie(res: Response) {
  const options = getCookieOptions({
    maxAgeMs: 0,
    httpOnly: true,
    sameSite: 'lax',
  });
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

/**
 * Set the CSRF token cookie (readable by frontend client)
 */
export function setCsrfCookie(res: Response, token: string) {
  const options = getCookieOptions({
    httpOnly: false, // Must be readable by client to send back in X-CSRF-Token header
    sameSite: 'lax',
    maxAgeMs: 24 * 60 * 60 * 1000,
  });
  res.cookie(CSRF_COOKIE_NAME, token, options);
}

/**
 * Clear the CSRF token cookie
 */
export function clearCsrfCookie(res: Response) {
  const options = getCookieOptions({
    httpOnly: false,
    sameSite: 'lax',
    maxAgeMs: 0,
  });
  res.clearCookie(CSRF_COOKIE_NAME, options);
}
