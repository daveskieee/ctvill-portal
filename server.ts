/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma, initializeDatabaseTables } from './server/db';
import { createEventsRouter } from './server/events';
import { createGanttRouter } from './server/routes/gantt';
import { authRouter } from './server/routes/auth';
import { projectsRouter } from './server/routes/projects';
import { engineeringRouter } from './server/routes/engineering';
import { siteDiaryRouter } from './server/routes/siteDiary';
import { financeRouter } from './server/routes/finance';
import { workforceRouter } from './server/routes/workforce';
import { legacyParcelsRouter } from './server/routes/legacyParcels';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend development servers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Support up to 50MB payloads for base64 encoded photo uploads and CAD document assets
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize critical database tables on boot
initializeDatabaseTables().catch(err => {
  console.error('Database initialization warning:', err);
});

// ============================================================================
// MOUNT MODULAR DOMAIN ROUTERS
// ============================================================================

// Real-time Server-Sent Events (SSE) stream
app.use('/api', createEventsRouter());

// Enterprise Interactive Gantt Engine
app.use('/api/projects', createGanttRouter(prisma));

// Core Domain Routers
app.use('/api', authRouter);
app.use('/api', projectsRouter);
app.use('/api', engineeringRouter);
app.use('/api', siteDiaryRouter);
app.use('/api', financeRouter);
app.use('/api', workforceRouter);
app.use('/api', legacyParcelsRouter);

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

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[CTVill ERP Server] Running on http://0.0.0.0:${PORT}`);
});
