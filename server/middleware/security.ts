/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';

// List of allowed frontend origins for CORS with credentials
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

/**
 * Configure secure CORS with credentials support and explicit origin whitelisting.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestOrigin = req.headers.origin;
  const envOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
    : [];
  const allowedOrigins = [...DEFAULT_ALLOWED_ORIGINS, ...envOrigins];

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!requestOrigin) {
    // Non-browser or same-origin direct requests
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-csrf-token'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

/**
 * Standard OWASP security response headers
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/**
 * Prevent access to sensitive dotfiles, source files, and configuration files.
 */
export function preventSensitiveFileExposure(req: Request, res: Response, next: NextFunction) {
  const normalized = req.path.toLowerCase();
  if (
    normalized.includes('/.env') ||
    normalized.includes('/.git') ||
    normalized.endsWith('.env') ||
    normalized.endsWith('.prisma') ||
    normalized.endsWith('.ts') ||
    normalized.includes('/node_modules') ||
    normalized.includes('/prisma/')
  ) {
    return res.status(404).send('Not Found');
  }
  next();
}

/**
 * Lightweight, zero-dependency in-memory rate limiter.
 *
 * NOTE FOR MULTI-INSTANCE CLUSTER DEPLOYMENTS:
 * This limiter maintains an in-memory sliding window bucket per Node.js process.
 * In a multi-instance or horizontal autoscaling environment (e.g. multiple Kubernetes pods
 * or serverless instances), each instance maintains its own memory bucket. For high-availability
 * clustering, an external distributed store like Redis (or a PostgreSQL rate-limit table)
 * is recommended. For single-instance or vertical deployments, this provides low-latency,
 * zero-dependency DDoS and brute-force mitigation without external infrastructure.
 */
interface RateLimitBucket {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  skip?: (req: Request) => boolean;
}) {
  const { windowMs, max, message, skip } = options;
  const store = new Map<string, RateLimitBucket>();

  // Cleanup every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store.entries()) {
      if (bucket.resetTime <= now) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip && skip(req)) {
      return next();
    }

    // Use Express's properly resolved client IP (computed based on app.set('trust proxy'))
    // rather than blindly trusting the raw X-Forwarded-For header which can be spoofed by public clients.
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = store.get(ip);

    if (!bucket || bucket.resetTime <= now) {
      bucket = { count: 1, resetTime: now + windowMs };
      store.set(ip, bucket);
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetTime - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: message || 'Too many requests. Please try again later.',
        retryAfterSeconds: retryAfter,
      });
    }

    next();
  };
}

// 10 login attempts per 5 minutes
export const loginRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please wait 5 minutes before trying again.',
});

// 20 password/activation requests per 5 minutes
export const sensitiveActionRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many requests for this operation. Please wait a few minutes.',
});
