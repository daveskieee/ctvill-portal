/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { touchSessionActivity, SESSION_INACTIVITY_LIMIT_MS } from '../utils/session';

interface UseInactivityTimeoutOptions {
  isLoggedIn: boolean;
  onTimeout: () => void;
  timeoutMs?: number;
}

/**
 * Enterprise Inactivity Monitor
 * Detects idle user sessions and triggers auto-logout to enforce security compliance.
 */
export function useInactivityTimeout({
  isLoggedIn,
  onTimeout,
  timeoutMs = SESSION_INACTIVITY_LIMIT_MS,
}: UseInactivityTimeoutOptions) {
  const lastActiveRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!isLoggedIn) return;

    lastActiveRef.current = Date.now();

    const handleUserInteraction = () => {
      lastActiveRef.current = Date.now();
      touchSessionActivity();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleUserInteraction, { passive: true });
    });

    // Check every 15 seconds for idle expiration
    const intervalId = setInterval(() => {
      const idleTime = Date.now() - lastActiveRef.current;
      if (idleTime >= timeoutMs) {
        clearInterval(intervalId);
        onTimeoutRef.current();
      }
    }, 15_000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserInteraction);
      });
      clearInterval(intervalId);
    };
  }, [isLoggedIn, timeoutMs]);
}
