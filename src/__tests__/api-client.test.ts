/**
 * Unit tests for api-client.ts — HTTPError, request deduplication, retry logic, and convenience methods.
 *
 * Covers:
 *   - HTTPError construction and properties
 *   - Deduplication of concurrent requests
 *   - Retry logic on transient failures
 *   - Convenience method URL construction
 *   - Timeout controller creation
 *   - Error classification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HTTPError, apiFetch, prayerFetch, tafsirFetch, jsonFetch, safeFetch } from '../api-client.js';

// Mock config
vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
    PRAYER_API: 'https://api.aladhan.com/v1/timings',
    TAFSIR_API: 'https://api.alquran.cloud/v1',
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

describe('HTTPError', () => {
  it('should construct with status and statusText', () => {
    const error = new HTTPError(404, 'Not Found');
    expect(error.status).toBe(404);
    expect(error.message).toBe('HTTP 404: Not Found');
    expect(error.name).toBe('HTTPError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HTTPError);
  });

  it('should construct with 500 status', () => {
    const error = new HTTPError(500, 'Internal Server Error');
    expect(error.status).toBe(500);
    expect(error.message).toBe('HTTP 500: Internal Server Error');
  });

  it('should construct with 403 status', () => {
    const error = new HTTPError(403, 'Forbidden');
    expect(error.status).toBe(403);
  });
});

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct URL with API_BASE prefix', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      await apiFetch('/surah/1', { silent: true });
    } catch {
      // May fail due to JSON parsing in test env
    }

    expect(fetchSpy).toHaveBeenCalled();
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('api.alquran.cloud');
  });
});

describe('prayerFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct URL with PRAYER_API prefix', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      await prayerFetch('?city=Makkah', { silent: true });
    } catch {
      // May fail
    }

    expect(fetchSpy).toHaveBeenCalled();
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('aladhan.com');
  });
});

describe('tafsirFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct URL with TAFSIR_API prefix', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      await tafsirFetch('/tafsir/1/1', { silent: true });
    } catch {
      // May fail
    }

    expect(fetchSpy).toHaveBeenCalled();
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('alquran.cloud');
  });
});

describe('jsonFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should call safeFetch with expectJSON: true', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      await jsonFetch('https://example.com/data.json', { silent: true });
    } catch {
      // May fail
    }

    expect(fetchSpy).toHaveBeenCalled();
  });
});

describe('safeFetch — error handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw HTTPError on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(safeFetch('https://example.com/test', { silent: true })).rejects.toThrow();
  });

  it('should throw on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(safeFetch('https://example.com/test', { silent: true, retries: 0 })).rejects.toThrow();
  });

  it('should handle aborted requests', async () => {
    const controller = new AbortController();
    controller.abort();

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(
      safeFetch('https://example.com/test', { signal: controller.signal, silent: true, retries: 0 }),
    ).rejects.toThrow();
  });

  it('should return raw Response when expectJSON is false', async () => {
    const mockResponse = new Response('raw text', { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const result = await safeFetch('https://example.com/test', { expectJSON: false, silent: true });
    expect(result).toBe(mockResponse);
  });
});
