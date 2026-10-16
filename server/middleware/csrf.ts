import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { 
  CSRF_COOKIE_NAME, 
  SESSION_COOKIE_NAME, 
  generateCsrfToken, 
  verifyCsrfTokenSignature 
} from '../services/sessionService';
import { setCsrfCookie } from './cookies';

/**
 * Public endpoints that do not require authenticated CSRF token validation:
 * - /api/auth/login: Pre-authentication credential endpoint protected by strict loginRateLimiter
 * - /api/auth/verify-invite: Client activation token verification (unauthenticated token bearer)
 * - /api/auth/activate: Client onboarding credential setup (unauthenticated token bearer)
 * - /api/quotations/submit: Public marketing landing page inquiry form (rate limited & schema validated)
 * - /api/health: Stateless container health probe
 */
const PUBLIC_CSRF_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/verify-invite',
  '/api/auth/activate',
  '/api/quotations/submit',
  '/api/health',
];

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
];

/**
 * Validate request Origin or Referer against trusted application origins.
 */
function isOriginAuthorized(req: Request): boolean {
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  const host = req.headers['host'];

  const envOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
    : [];
  const allowed = [...DEFAULT_ALLOWED_ORIGINS, ...envOrigins];

  if (origin) {
    if (allowed.includes(origin)) return true;
    if (host && (origin === `http://${host}` || origin === `https://${host}`)) return true;
    return false;
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (allowed.includes(refOrigin)) return true;
      if (host && (refOrigin === `http://${host}` || refOrigin === `https://${host}`)) return true;
      return false;
    } catch {
      return false;
    }
  }

  // If both origin and referer are absent, check Sec-Fetch-Site to block cross-site browser requests
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite && secFetchSite === 'cross-site') {
    return false;
  }

  return true;
}

/**
 * Ensures a CSRF cookie exists on incoming requests.
 * Cryptographically binds the CSRF token to the active session if one exists.
 */
export function ensureCsrfCookieMiddleware(req: Request, res: Response, next: NextFunction) {
  const rawSession = req.cookies?.[SESSION_COOKIE_NAME] || 
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].substring(7).trim() : undefined);
  const currentToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!currentToken || !verifyCsrfTokenSignature(currentToken, rawSession)) {
    const newToken = generateCsrfToken(rawSession);
    setCsrfCookie(res, newToken);
    if (!req.cookies) req.cookies = {};
    req.cookies[CSRF_COOKIE_NAME] = newToken;
  }
  next();
}

/**
 * Enforces Origin validation and session-bound CSRF token checks on state-changing operations (POST, PUT, PATCH, DELETE)
 */
export function verifyCsrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // Safe HTTP methods do not alter state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Exempt documented public onboarding and unauthenticated submission routes
  const normalizedPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
  const isExempt = PUBLIC_CSRF_EXEMPT_PATHS.some(exemptPath => 
    normalizedPath === exemptPath || req.path === exemptPath || req.originalUrl?.split('?')[0] === exemptPath
  );

  if (isExempt) {
    return next();
  }

  // 1. Origin verification on state-changing requests
  if (!isOriginAuthorized(req)) {
    return res.status(403).json({
      error: 'Forbidden: Request origin is not authorized.',
      code: 'CSRF_ORIGIN_INVALID'
    });
  }

  // 2. Extract submitted and expected tokens
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

  // 3. Timing-safe comparison of submitted token against cookie
  const submittedBuf = Buffer.from(String(submittedToken).trim());
  const expectedBuf = Buffer.from(String(expectedToken).trim());

  if (submittedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(submittedBuf, expectedBuf)) {
    return res.status(403).json({
      error: 'Forbidden: Invalid CSRF security token mismatch.',
      code: 'CSRF_INVALID'
    });
  }

  // 4. Verify cryptographic signature and session-binding
  const rawSession = req.cookies?.[SESSION_COOKIE_NAME] || 
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].substring(7).trim() : undefined);

  if (!verifyCsrfTokenSignature(submittedToken, rawSession)) {
    return res.status(403).json({
      error: 'Forbidden: CSRF token is not valid for this active session.',
      code: 'CSRF_SESSION_MISMATCH'
    });
  }

  next();
}
