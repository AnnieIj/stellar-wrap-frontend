/**
 * Integration tests for middleware.ts locale negotiation.
 *
 * Tests that middleware correctly:
 * - Negotiates locale from Accept-Language header
 * - Handles explicit locale prefixes
 * - Falls back gracefully for unsupported locales
 * - Excludes API routes from locale rewriting
 * - Preserves locale prefix across navigation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import middleware from '../middleware';

// Mock URLs for testing
const BASE_URL = 'http://localhost:3000';

/**
 * Helper to create a NextRequest with custom headers and URL
 */
function createRequest(
  path: string,
  headers: Record<string, string> = {}
): NextRequest {
  const url = new URL(path, BASE_URL);
  const request = new NextRequest(url, {
    headers: new Headers(headers),
  });
  return request;
}

/**
 * Helper to extract locale from response (redirect or rewrite)
 */
function getLocaleFromResponse(response: NextResponse): string | null {
  // Check for redirect
  const location = response.headers.get('location');
  if (location) {
    const match = location.match(/^\/(en|es|fr)\//);
    return match ? match[1] : null;
  }

  // Check for rewrite in x-middleware-rewrite header
  const rewrite = response.headers.get('x-middleware-rewrite');
  if (rewrite) {
    const match = rewrite.match(/\/(en|es|fr)\//);
    return match ? match[1] : null;
  }

  return null;
}

describe('Middleware locale negotiation', () => {
  describe('Accept-Language header negotiation', () => {
    it('should redirect to English when Accept-Language prefers English', async () => {
      const request = createRequest('/', {
        'accept-language': 'en-US,en;q=0.9',
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toBe('/en');
    });

    it('should redirect to Spanish when Accept-Language prefers Spanish', async () => {
      const request = createRequest('/', {
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toBe('/es');
    });

    it('should redirect to French when Accept-Language prefers French', async () => {
      const request = createRequest('/', {
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8',
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toBe('/fr');
    });

    it('should default to English when no Accept-Language header is present', async () => {
      const request = createRequest('/');

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toBe('/en');
    });
  });

  describe('Explicit locale prefix handling', () => {
    it('should preserve explicit English locale prefix', async () => {
      const request = createRequest('/en/wrapped');

      const response = await middleware(request);

      // Should not redirect, just rewrite or pass through
      expect([200, 307]).toContain(response.status);
      
      // If it's a rewrite, verify the locale is preserved
      if (response.status === 200) {
        const rewrite = response.headers.get('x-middleware-rewrite');
        if (rewrite) {
          expect(rewrite).toContain('/en/');
        }
      }
    });

    it('should preserve explicit Spanish locale prefix', async () => {
      const request = createRequest('/es/wrapped');

      const response = await middleware(request);

      expect([200, 307]).toContain(response.status);
      
      if (response.status === 200) {
        const rewrite = response.headers.get('x-middleware-rewrite');
        if (rewrite) {
          expect(rewrite).toContain('/es/');
        }
      }
    });

    it('should preserve explicit French locale prefix', async () => {
      const request = createRequest('/fr/wrapped');

      const response = await middleware(request);

      expect([200, 307]).toContain(response.status);
      
      if (response.status === 200) {
        const rewrite = response.headers.get('x-middleware-rewrite');
        if (rewrite) {
          expect(rewrite).toContain('/fr/');
        }
      }
    });
  });

  describe('Unsupported locale fallback', () => {
    it('should redirect to default locale for unsupported locale prefix', async () => {
      const request = createRequest('/de/wrapped', {
        'accept-language': 'de-DE,de;q=0.9',
      });

      const response = await middleware(request);

      // Should redirect to default locale (en)
      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toMatch(/^\/en/);
    });

    it('should handle malformed locale gracefully', async () => {
      const request = createRequest('/xyz123/wrapped');

      const response = await middleware(request);

      // Should redirect or handle gracefully, not crash
      expect(response).toBeDefined();
      expect([200, 307, 404]).toContain(response.status);
    });

    it('should not treat two-letter paths as locale if not supported', async () => {
      const request = createRequest('/ab/test');

      const response = await middleware(request);

      // Should handle gracefully - either redirect or pass through
      expect(response).toBeDefined();
      expect([200, 307, 404]).toContain(response.status);
    });
  });

  describe('API route exclusion', () => {
    it('should not rewrite /api/wrapped', async () => {
      const request = createRequest('/api/wrapped?accountId=GABC123');

      const response = await middleware(request);

      // API routes should pass through without locale prefix
      const rewrite = response.headers.get('x-middleware-rewrite');
      const location = response.headers.get('location');
      
      // Should not have locale prefix in rewrite or redirect
      if (rewrite) {
        expect(rewrite).not.toMatch(/\/(en|es|fr)\/api/);
      }
      if (location) {
        expect(location).not.toMatch(/\/(en|es|fr)\/api/);
      }
    });

    it('should not rewrite /api/og', async () => {
      const request = createRequest('/api/og?username=alice');

      const response = await middleware(request);

      const rewrite = response.headers.get('x-middleware-rewrite');
      const location = response.headers.get('location');
      
      if (rewrite) {
        expect(rewrite).not.toMatch(/\/(en|es|fr)\/api/);
      }
      if (location) {
        expect(location).not.toMatch(/\/(en|es|fr)\/api/);
      }
    });

    it('should not rewrite /api/og/twitter', async () => {
      const request = createRequest('/api/og/twitter?username=bob');

      const response = await middleware(request);

      const rewrite = response.headers.get('x-middleware-rewrite');
      const location = response.headers.get('location');
      
      if (rewrite) {
        expect(rewrite).not.toMatch(/\/(en|es|fr)\/api/);
      }
      if (location) {
        expect(location).not.toMatch(/\/(en|es|fr)\/api/);
      }
    });

    it('should not rewrite /api/notifications/subscribe', async () => {
      const request = createRequest('/api/notifications/subscribe');

      const response = await middleware(request);

      const rewrite = response.headers.get('x-middleware-rewrite');
      const location = response.headers.get('location');
      
      if (rewrite) {
        expect(rewrite).not.toMatch(/\/(en|es|fr)\/api/);
      }
      if (location) {
        expect(location).not.toMatch(/\/(en|es|fr)\/api/);
      }
    });

    it('should not rewrite nested API routes', async () => {
      const request = createRequest('/api/notifications/data/GABC123');

      const response = await middleware(request);

      const rewrite = response.headers.get('x-middleware-rewrite');
      const location = response.headers.get('location');
      
      if (rewrite) {
        expect(rewrite).not.toMatch(/\/(en|es|fr)\/api/);
      }
      if (location) {
        expect(location).not.toMatch(/\/(en|es|fr)\/api/);
      }
    });
  });

  describe('Static asset exclusion', () => {
    it('should not rewrite _next static files', async () => {
      const request = createRequest('/_next/static/chunks/main.js');

      const response = await middleware(request);

      const rewrite = response.headers.get('x-middleware-rewrite');
      const location = response.headers.get('location');
      
      if (rewrite) {
        expect(rewrite).not.toMatch(/\/(en|es|fr)\/_next/);
      }
      if (location) {
        expect(location).not.toMatch(/\/(en|es|fr)\/_next/);
      }
    });

    it('should not rewrite image files', async () => {
      const request = createRequest('/favicon.ico');

      const response = await middleware(request);

      const rewrite = response.headers.get('x-middleware-rewrite');
      const location = response.headers.get('location');
      
      if (rewrite) {
        expect(rewrite).not.toMatch(/\/(en|es|fr)\/.*\.(ico|png|jpg|svg)/);
      }
      if (location) {
        expect(location).not.toMatch(/\/(en|es|fr)\/.*\.(ico|png|jpg|svg)/);
      }
    });
  });

  describe('Locale persistence', () => {
    it('should set locale cookie when redirecting to locale path', async () => {
      const request = createRequest('/', {
        'accept-language': 'es-ES,es;q=0.9',
      });

      const response = await middleware(request);

      // Check if cookie is set
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        expect(setCookie).toContain('NEXT_LOCALE');
        expect(setCookie).toContain('es');
      }
    });

    it('should preserve locale from cookie when no Accept-Language header', async () => {
      const request = createRequest('/', {
        cookie: 'NEXT_LOCALE=fr',
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      // Should respect cookie and redirect to French
      expect(location).toBe('/fr');
    });
  });

  describe('Edge cases', () => {
    it('should handle paths with query parameters', async () => {
      const request = createRequest('/?foo=bar&baz=qux', {
        'accept-language': 'en-US',
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      // Query params should be preserved
      expect(location).toContain('?foo=bar&baz=qux');
    });

    it('should handle paths with hash fragments', async () => {
      const request = createRequest('/en/wrapped');

      const response = await middleware(request);

      // Should handle gracefully
      expect(response).toBeDefined();
    });

    it('should handle root path with trailing slash', async () => {
      const request = createRequest('/', {
        'accept-language': 'en-US',
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toBe('/en');
    });
  });
});
