/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserSession } from '../types';

export const SESSION_STORAGE_KEY = 'xyz_pm_user_session';
export const CTWLL_USER_SESSION_KEY = 'ctwll_user_session';
export const LEGACY_SESSION_STORAGE_KEY = 'xyz_erp_user_session';

// Security Timers
export const SESSION_INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes idle timeout
export const TAB_SESSION_TTL_MS = 4 * 60 * 60 * 1000;       // 4 hours max active tab TTL
export const REMEMBER_ME_TTL_MS = 24 * 60 * 60 * 1000;     // 24 hours max if Remember Me opted-in

export interface StoredSessionEnvelope {
  session: UserSession;
  expiresAt: number;
  lastActivity: number;
  rememberMe: boolean;
  version: number;
}

const CURRENT_ENVELOPE_VERSION = 2;

/**
 * Retrieve validated session from sessionStorage or localStorage.
 * Synchronously restores session on initial mount to prevent guest flashing.
 */
export function getStoredSession(): UserSession | null {
  if (typeof window === 'undefined') return null;

  const now = Date.now();

  // Always scrub legacy keys
  try {
    localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
  } catch { /* silent */ }

  // 1. Check primary tab session storage (sessionStorage)
  try {
    const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (isValidEnvelope(parsed)) {
        if (!isExpired(parsed, now)) {
          touchSessionActivity(parsed, false);
          return parsed.session;
        }
      } else if (parsed && typeof parsed === 'object') {
        const sessionObj = parsed.session || parsed;
        if (sessionObj.id || sessionObj.role) return sessionObj;
      }
    }
  } catch {
    /* silent */
  }

  // 2. Check ctwll_user_session in localStorage for instant sync hydration
  try {
    const rawCtwll = localStorage.getItem(CTWLL_USER_SESSION_KEY);
    if (rawCtwll) {
      const parsed = JSON.parse(rawCtwll);
      const sessionObj = parsed?.session || parsed;
      if (sessionObj && (sessionObj.id || sessionObj.role || sessionObj.username)) {
        return sessionObj;
      }
    }
  } catch {
    /* silent */
  }

  // 3. Check persistent storage (localStorage)
  try {
    const rawLocal = localStorage.getItem(SESSION_STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (isValidEnvelope(parsed)) {
        if (!isExpired(parsed, now)) {
          touchSessionActivity(parsed, true);
          return parsed.session;
        }
      } else if (parsed && typeof parsed === 'object') {
        const sessionObj = parsed.session || parsed;
        if (sessionObj.id || sessionObj.role) return sessionObj;
      }
    }
  } catch {
    /* silent */
  }

  return null;
}

/**
 * Persist user session with cryptographic-like envelope metadata (TTL + Inactivity pulse).
 * Persists to both localStorage and sessionStorage to eliminate refresh race conditions.
 */
export function saveStoredSession(session: UserSession): void {
  if (typeof window === 'undefined') return;

  const rememberMe = Boolean(session.rememberMe);
  const envelope = wrapSession(session, rememberMe);
  const serialized = JSON.stringify(envelope);
  const rawSessionJson = JSON.stringify(session);

  try {
    localStorage.setItem(CTWLL_USER_SESSION_KEY, rawSessionJson);
    localStorage.setItem(SESSION_STORAGE_KEY, serialized);
    sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
  } catch { /* silent */ }
}

/**
 * Update an existing session payload without resetting TTLs.
 */
export function updateStoredSession(partial: Partial<UserSession>): UserSession | null {
  if (typeof window === 'undefined') return null;

  // Check sessionStorage first
  const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession);
      if (isValidEnvelope(parsed)) {
        parsed.session = { ...parsed.session, ...partial };
        parsed.lastActivity = Date.now();
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
        return parsed.session;
      }
    } catch { /* silent */ }
  }

  // Check localStorage
  const rawLocal = localStorage.getItem(SESSION_STORAGE_KEY);
  if (rawLocal) {
    try {
      const parsed = JSON.parse(rawLocal);
      if (isValidEnvelope(parsed)) {
        parsed.session = { ...parsed.session, ...partial };
        parsed.lastActivity = Date.now();
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
        return parsed.session;
      }
    } catch { /* silent */ }
  }

  return null;
}

/**
 * Fully clear all session traces across both storages.
 */
export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem('ctvill_active_tab');
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
  } catch { /* silent */ }
}

let lastTouchTime = 0;
/**
 * Update last activity timestamp to prevent idle logout while user is interacting.
 * Throttled to at most once every 30 seconds.
 */
export function touchSessionActivity(envelope?: StoredSessionEnvelope, isLocal = false): void {
  const now = Date.now();
  if (now - lastTouchTime < 30_000) return; // throttle 30s
  lastTouchTime = now;

  try {
    if (envelope) {
      envelope.lastActivity = now;
      const targetStorage = isLocal ? localStorage : sessionStorage;
      targetStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
    } else {
      // Auto-detect which storage holds the session
      const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (isValidEnvelope(parsed)) {
          parsed.lastActivity = now;
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
          return;
        }
      }
      const rawLocal = localStorage.getItem(SESSION_STORAGE_KEY);
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (isValidEnvelope(parsed)) {
          parsed.lastActivity = now;
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    }
  } catch { /* silent */ }
}

// Internal Helpers
function wrapSession(session: UserSession, rememberMe: boolean): StoredSessionEnvelope {
  const now = Date.now();
  const ttl = rememberMe ? REMEMBER_ME_TTL_MS : TAB_SESSION_TTL_MS;
  return {
    session,
    expiresAt: now + ttl,
    lastActivity: now,
    rememberMe,
    version: CURRENT_ENVELOPE_VERSION,
  };
}

function isValidEnvelope(item: any): item is StoredSessionEnvelope {
  return (
    item &&
    typeof item === 'object' &&
    item.session &&
    typeof item.expiresAt === 'number' &&
    typeof item.lastActivity === 'number'
  );
}

function isExpired(envelope: StoredSessionEnvelope, now: number): boolean {
  // Absolute expiration
  if (now > envelope.expiresAt) return true;
  // Idle inactivity expiration (30 mins without activity)
  if (now - envelope.lastActivity > SESSION_INACTIVITY_LIMIT_MS) return true;
  return false;
}
