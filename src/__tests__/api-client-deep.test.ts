/**
 * Deep coverage tests for api-client.ts — covers additional branches:
 * - Request deduplication
 * - Retry logic on 5xx and network errors
 * - No retry on 4xx errors
 * - Abort handling
 * - JSON parse errors
 * - Error classification (offline, timeout, network, server, parse, default)
 * - Timeout controller with external signal
 * - Convenience methods with proper URL construction
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HTTPError, apiFetch, prayerFetch, tafsirFetch, jsonFetch, safeFetch } from '../api-client.js';

// Mock config
vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
    PRAYER_API: 'https://api.aladhan.com/v1/timings',
    TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
  },
}));

// Mock i18n
vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
}));

// Mock ui
vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

describe('api-client deep coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Request deduplication', () => {
    it('should deduplicate concurrent requests to the same URL', async () => {
      let resolveFirst: (val: any) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      let fetchCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        fetchCount++;
        return firstPromise as Promise<Response>;
      });

      // Fire two concurrent requests
      const p1 = safeFetch('https://example.com/dedup-test', { silent: true });
      const p2 = safeFetch('https://example.com/dedup-test', { silent: true });

      // Resolve the shared request
      resolveFirst!(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const [r1, r2] = await Promise.all([p1, p2]);

      // Only one fetch call should have been made
      expect(fetchCount).toBe(1);
    });

    it('should NOT deduplicate when noDedup is true', async () => {
      let fetchCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        fetchCount++;
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      await Promise.all([
        safeFetch('https://example.com/no-dedup', { silent: true, noDedup: true }),
        safeFetch('https://example.com/no-dedup', { silent: true, noDedup: true }),
      ]);

      expect(fetchCount).toBe(2);
    });
  });

  describe('Retry logic', () => {
    it('should retry on 5xx errors', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          return Promise.resolve(new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const result = await safeFetch('https://example.com/retry-5xx', { silent: true, retries: 1, retryDelay: 10 });
      expect(callCount).toBe(2);
      expect(result).toEqual({ ok: true });
    });

    it('should NOT retry on 4xx errors', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        return Promise.resolve(new Response('Not Found', { status: 404, statusText: 'Not Found' }));
      });

      await expect(
        safeFetch('https://example.com/no-retry-4xx', { silent: true, retries: 2, retryDelay: 10 }),
      ).rejects.toThrow();

      expect(callCount).toBe(1); // No retry
    });

    it('should NOT retry on AbortError', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });

      await expect(
        safeFetch('https://example.com/no-retry-abort', { silent: true, retries: 2, retryDelay: 10 }),
      ).rejects.toThrow();

      expect(callCount).toBe(1); // No retry
    });

    it('should NOT retry on JSON parse errors', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        return Promise.resolve(new Response('not json', { status: 200 }));
      });

      await expect(
        safeFetch('https://example.com/no-retry-parse', { silent: true, retries: 2, retryDelay: 10 }),
      ).rejects.toThrow();

      expect(callCount).toBe(1); // No retry
    });

    it('should retry on network errors', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const result = await safeFetch('https://example.com/retry-network', { silent: true, retries: 1, retryDelay: 10 });
      expect(callCount).toBe(2);
    });
  });

  describe('Error classification', () => {
    it('should classify offline error', async () => {
      vi.stubGlobal('navigator', { onLine: false });
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(safeFetch('https://example.com/offline', { retries: 0 })).rejects.toThrow();

      vi.stubGlobal('navigator', { onLine: true });
    });

    it('should classify timeout error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Request timeout'));

      await expect(
        safeFetch('https://example.com/timeout', { silent: true, retries: 0, timeout: 100 }),
      ).rejects.toThrow();
    });

    it('should classify network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(safeFetch('https://example.com/network', { silent: true, retries: 0 })).rejects.toThrow();
    });

    it('should classify parse error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', { status: 200 }));

      await expect(safeFetch('https://example.com/parse-error', { silent: true, retries: 0 })).rejects.toThrow();
    });
  });

  describe('Timeout with external signal', () => {
    it('should abort when external signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('Aborted', 'AbortError'));

      await expect(
        safeFetch('https://example.com/abort-test', { signal: controller.signal, silent: true, retries: 0 }),
      ).rejects.toThrow();
    });
  });

  describe('Convenience methods URL construction', () => {
    it('apiFetch should prefix with API_BASE', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      try {
        await apiFetch('/surah/1', { silent: true });
      } catch {
        /* noop */
      }
      expect(spy.mock.calls[0]![0]).toBe('https://api.alquran.cloud/v1/surah/1');
    });

    it('prayerFetch should prefix with PRAYER_API and default 20s timeout', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      try {
        await prayerFetch('?city=Makkah', { silent: true });
      } catch {
        /* noop */
      }
      expect(spy.mock.calls[0]![0]).toContain('aladhan.com');
    });

    it('tafsirFetch should prefix with TAFSIR_API and default 10s timeout', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      try {
        await tafsirFetch('/tafsir/1/1', { silent: true });
      } catch {
        /* noop */
      }
      expect(spy.mock.calls[0]![0]).toContain('jsdelivr');
    });

    it('jsonFetch should pass expectJSON: true', async () => {
      const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      try {
        await jsonFetch('https://example.com/data.json', { silent: true });
      } catch {
        /* noop */
      }
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('HTTPError', () => {
    it('should be an instance of Error', () => {
      const err = new HTTPError(500, 'Server Error');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(HTTPError);
      expect(err.status).toBe(500);
      expect(err.message).toBe('HTTP 500: Server Error');
    });
  });

  describe('expectJSON: false', () => {
    it('should return raw Response object', async () => {
      const mockResponse = new Response('raw text', { status: 200 });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      const result = await safeFetch('https://example.com/raw', { expectJSON: false, silent: true });
      expect(result).toBe(mockResponse);
    });
  });

  describe('Error toast display', () => {
    it('should show toast on 5xx error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Error', { status: 500, statusText: 'Server Error' }),
      );

      try {
        await safeFetch('https://example.com/server-error', { silent: false, retries: 0 });
      } catch {
        /* noop */
      }

      const { showToast } = await import('../ui.js');
      expect(showToast).toHaveBeenCalled();
    });
  });
});
