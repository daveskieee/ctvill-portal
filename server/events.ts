/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, Router } from 'express';

// Active SSE client connections registry
const sseClients = new Set<Response>();

// Invalidation callback hook
let onInvalidateCache: (() => void) | null = null;

export function setCacheInvalidator(fn: () => void) {
  onInvalidateCache = fn;
}

export function invalidateAllDataCache() {
  if (onInvalidateCache) {
    onInvalidateCache();
  }
}

/**
 * Broadcast a real-time data-change event to all connected browser tabs
 */
export function broadcastChange(entity: string, payload?: Record<string, unknown>) {
  if (onInvalidateCache) {
    onInvalidateCache();
  }
  const message = `data: ${JSON.stringify({ type: 'data_changed', entity, ...payload })}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(message);
    } catch {
      // Client disconnected
      sseClients.delete(client);
    }
  });
}

export function createEventsRouter(): Router {
  const router = Router();

  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send initial connection heartbeat
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    sseClients.add(res);

    // Keep-alive ping every 25 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients.delete(res);
    });
  });

  return router;
}
