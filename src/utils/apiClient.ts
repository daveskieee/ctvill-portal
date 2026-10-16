/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const CSRF_COOKIE_NAME = 'ctvill_csrf';

/**
 * Read the CSRF token from browser cookies
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${CSRF_COOKIE_NAME})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : null;
}

// Global authorization failure callback
let authExpiredHandler: (() => void) | null = null;

export function setAuthExpiredHandler(handler: () => void) {
  authExpiredHandler = handler;
}

/**
 * Intercepts global window.fetch to ensure:
 * 1. Credentials (HttpOnly session cookies) are always included with /api requests
 * 2. CSRF tokens are automatically added to state-changing operations (POST, PUT, PATCH, DELETE)
 * 3. 401 Unauthorized responses trigger session cleanup and redirect to login
 */
let isFetchInitialized = false;

export function setupSecureFetch(onUnauthorized?: () => void) {
  if (typeof window === 'undefined' || isFetchInitialized) return;
  isFetchInitialized = true;

  if (onUnauthorized) {
    authExpiredHandler = onUnauthorized;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const rawUrl = typeof input === 'string' 
      ? input 
      : input instanceof Request 
      ? input.url 
      : input.toString();

    const isApiRequest = rawUrl.startsWith('/api') || rawUrl.includes('/api/');

    if (isApiRequest) {
      init = init ? { ...init } : {};
      
      // Always include session cookie credentials with API requests
      if (!init.credentials) {
        init.credentials = 'include';
      }

      // Check method
      const method = (
        init.method || 
        (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();

      // Attach CSRF token on state-changing requests
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
          if (!headers.has('x-csrf-token') && !headers.has('X-CSRF-Token')) {
            headers.set('x-csrf-token', csrfToken);
          }
          init.headers = headers;
        }
      }
    }

    try {
      const response = await originalFetch(input, init);

      // Handle session expiration on protected endpoints
      if (
        response.status === 401 && 
        isApiRequest && 
        !rawUrl.includes('/api/auth/login') &&
        !rawUrl.includes('/api/auth/verify-invite') &&
        !rawUrl.includes('/api/auth/activate')
      ) {
        if (authExpiredHandler) {
          authExpiredHandler();
        }
      }

      return response;
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Standalone secure fetch helper
 */
export async function secureFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return window.fetch(input, init);
}
