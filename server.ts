/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma, initializeDatabaseTables } from './server/db';
import { cleanupExpiredSessions, validateProductionSecurityConfig } from './server/services/sessionService';
import { cookieParserMiddleware } from './server/middleware/cookies';
import { 
  corsMiddleware, 
  securityHeadersMiddleware, 
  preventSensitiveFileExposure 
} from './server/middleware/security';
import { ensureCsrfCookieMiddleware, verifyCsrfMiddleware } from './server/middleware/csrf';
import { authenticateRequest } from './server/middleware/auth';

import { createEventsRouter } from './server/events';
import { createGanttRouter } from './server/routes/gantt';
import { authRouter } from './server/routes/auth';
import { projectsRouter } from './server/routes/projects';
import { engineeringRouter } from './server/routes/engineering';
import { siteDiaryRouter } from './server/routes/siteDiary';
import { financeRouter } from './server/routes/finance';
import { workforceRouter } from './server/routes/workforce';
import { legacyParcelsRouter } from './server/routes/legacyParcels';
import { attendanceRouter } from './server/routes/attendance';
import { payrollRouter } from './server/routes/payroll';
import { workersRouter } from './server/routes/workers';
import { documentsRouter } from './server/routes/documents';

dotenv.config();

// Strict production security configuration validation: halts startup if secrets are missing or weak
validateProductionSecurityConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configure explicit trusted proxy resolution to prevent X-Forwarded-For spoofing
const trustProxySetting = process.env.TRUST_PROXY 
  ? (process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY === 'false' ? false : process.env.TRUST_PROXY)
  : (process.env.NODE_ENV === 'production' ? 'loopback' : false);
app.set('trust proxy', trustProxySetting);

// 1. Security Headers (OWASP recommendations)
app.use(securityHeadersMiddleware);

// 2. Controlled Cross-Origin Resource Sharing (CORS) with Credentials
app.use(corsMiddleware);

// 3. Block unauthorized access to sensitive internal files (.env, .git, etc.)
app.use(preventSensitiveFileExposure);

// 4. Zero-dependency Cookie Parser
app.use(cookieParserMiddleware);

// 5. Body Parsers with Appropriate Limits
// Large payloads (50mb) specifically for CAD drawings & site photos
app.use('/api/engineering', express.json({ limit: '50mb' }));
app.use('/api/engineering', express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api/documents', express.json({ limit: '50mb' }));
app.use('/api/documents', express.urlencoded({ limit: '50mb', extended: true }));

// Standard payload limit for all other API endpoints
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// 6. Ensure CSRF Cookie on all incoming requests
app.use(ensureCsrfCookieMiddleware);

// 7. Base Session Authentication: Resolves and verifies PostgreSQL session
app.use(authenticateRequest);

// 8. Cross-Site Request Forgery (CSRF) protection for state-changing API operations
app.use('/api', verifyCsrfMiddleware);

// Minimal public health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', server: 'CTVill ERP', time: new Date().toISOString() });
});

// Initialize critical database tables on boot
initializeDatabaseTables().catch(err => {
  console.error('Database initialization warning:', err);
});

// Periodic session cleanup (every 1 hour)
const sessionCleanupTimer = setInterval(() => {
  cleanupExpiredSessions().catch(() => {});
}, 60 * 60 * 1000);
sessionCleanupTimer.unref();

// ============================================================================
// MOUNT MODULAR DOMAIN ROUTERS
// ============================================================================

// Real-time Server-Sent Events (SSE) stream (Authenticated)
app.use('/api', createEventsRouter());

// Enterprise Interactive Gantt Engine (Protected)
app.use('/api/projects', createGanttRouter(prisma));

// Core Domain Routers
app.use('/api', authRouter);
app.use('/api', projectsRouter);
app.use('/api', engineeringRouter);
app.use('/api', documentsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api', siteDiaryRouter);
app.use('/api', financeRouter);
app.use('/api/finance', financeRouter);
app.use('/api/workers', workersRouter);
app.use('/api', workforceRouter);
app.use('/api', legacyParcelsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/payroll', payrollRouter);

// Serve static frontend build in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/events')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

// Generic centralized error handler (prevents leaking internal stack traces)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      error: 'Upload payload exceeds the maximum database limit of 50 MB. Please reduce file size before uploading.'
    });
  }
  console.error('Unhandled server error:', err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal Server Error' });
});

const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('server.ts') || 
  process.argv[1].endsWith('server.js')
);

if (process.env.NODE_ENV !== 'test' && isDirectExecution) {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[CTVill ERP Server] Running on http://0.0.0.0:${PORT}`);
  });
}

export { app };
export function createApp() {
  return app;
}
