/**
 * Additional tests for offline-pack module to improve coverage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  downloadOfflinePack,
  getOfflinePackStatus,
  clearOfflinePackStatus,
  formatBytes,
  estimateOfflinePackSize,
} from '../offline-pack.js';
import { clearExternalDataCache, getCachedExternalData } from '../external-data-cache.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const memoryCaches = new Map<string, Map<string, Response>>();
const cacheStorage = {
  open: vi.fn(async (name: string) => {
    const entries = memoryCaches.get(name) || new Map<string, Response>();
    memoryCaches.set(name, entries);
    return {
      put: async (request: RequestInfo | URL, response: Response) => {
        entries.set(String(request), response.clone());
      },
      match: async (request: RequestInfo | URL) => entries.get(String(request))?.clone(),
    };
  }),
  match: vi.fn(async (request: RequestInfo | URL) => {
    for (const entries of memoryCaches.values()) {
      const response = entries.get(String(request));
      if (response) {
        return response.clone();
      }
    }
    return undefined;
  }),
};
Object.defineProperty(globalThis, 'caches', { configurable: true, value: cacheStorage });

describe('offline-pack — additional coverage', () => {
  beforeEach(async () => {
    localStorage.clear();
    mockFetch.mockReset();
    memoryCaches.clear();
    cacheStorage.open.mockClear();
    cacheStorage.match.mockClear();
    await clearExternalDataCache();
  });

  describe('downloadOfflinePack', () => {
    it('completes successfully when all fetches succeed', async () => {
      // Mock successful responses
      mockFetch.mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'mock-' + url }),
          blob: () => Promise.resolve(new Blob(['audio'])),
        });
      });

      const result = await downloadOfflinePack({});

      expect(result.success).toBe(true);
      expect(result.failed).toBe(0);
      expect(result.succeeded).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('persists Quran text, translations, and tajweed files for offline readers', async () => {
      mockFetch.mockImplementation((url: string) => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(
          url.includes('manifest')
            ? { files: ['001.json'] }
            : url.includes('tajweed')
              ? [[1, []]]
              : { data: `stored-${url}` },
        ),
      }));

      const result = await downloadOfflinePack({ translationEditions: ['en.sahih'] });

      expect(result.success).toBe(true);
      await expect(
        getCachedExternalData('https://api.alquran.cloud/v1/quran/quran-uthmani'),
      ).resolves.toEqual({ data: 'stored-https://api.alquran.cloud/v1/quran/quran-uthmani' });
      await expect(
        getCachedExternalData('https://api.alquran.cloud/v1/quran/en.sahih'),
      ).resolves.toEqual({ data: 'stored-https://api.alquran.cloud/v1/quran/en.sahih' });
      const tajweedCache = await cacheStorage.open('app-data-v2');
      await expect(tajweedCache.match('/data/tajweed/manifest.json')).resolves.toBeInstanceOf(Response);
      await expect(tajweedCache.match('/data/tajweed/001.json')).resolves.toBeInstanceOf(Response);
    });

    it('persists full-Quran downloads under the per-surah keys consumed by the reader', async () => {
      const quranSurah = { number: 50, name: 'ق', englishName: 'Qaf', ayahs: [{ numberInSurah: 1, text: 'ق' }] };
      const translationSurah = { number: 50, name: 'Qaf', englishName: 'Qaf', ayahs: [{ numberInSurah: 1, text: 'Qaf' }] };
      mockFetch.mockImplementation((url: string) => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(
          url.includes('manifest') ? { files: [] }
            : url.includes('en.sahih') ? { data: { surahs: [translationSurah] } }
              : { data: { surahs: [quranSurah] } },
        ),
      }));

      await downloadOfflinePack({ translationEditions: ['en.sahih'] });

      await expect(
        getCachedExternalData('https://api.alquran.cloud/v1/surah/50/quran-uthmani'),
      ).resolves.toEqual({ data: quranSurah });
      await expect(
        getCachedExternalData('https://api.alquran.cloud/v1/surah/50/en.sahih'),
      ).resolves.toEqual({ data: translationSurah });
    });

    it('records errors when fetch fails', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
          blob: () => Promise.resolve(new Blob()),
        });
      });

      const result = await downloadOfflinePack({});

      expect(result.success).toBe(false);
      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.reject(new Error('Network error'));
      });

      const result = await downloadOfflinePack({});

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Network error');
    });

    it('calls onProgress callback with phases', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'mock' }),
          blob: () => Promise.resolve(new Blob(['audio'])),
        });
      });

      const progressCalls: string[] = [];
      const result = await downloadOfflinePack({
        onProgress: (p) => progressCalls.push(p.phase),
      });

      expect(progressCalls).toContain('quran');
      expect(progressCalls).toContain('translations');
      expect(progressCalls).toContain('tajweed');
      expect(progressCalls).toContain('done');
      expect(result.success).toBe(true);
    });

    it('respects custom translationEditions', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'mock' }),
          blob: () => Promise.resolve(new Blob()),
        });
      });

      const result = await downloadOfflinePack({
        translationEditions: ['en.sahih', 'fr.hamidullah'],
      });

      expect(result.success).toBe(true);
      // Should have fetched: 1 quran + 2 translations + 1 tajweed = 4
      expect(result.succeeded).toBe(4);
    });

    it('downloads audio when reciterId and audioSurahCount provided', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/surah/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { ayahs: [{ audio: 'https://audio.example/001.mp3' }] } }),
          });
        }
        if (url.includes('.mp3')) {
          return Promise.resolve({
            ok: true,
            blob: () => Promise.resolve(new Blob(['audio-data'])),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'mock' }),
          blob: () => Promise.resolve(new Blob()),
        });
      });

      // Mock audio-cache module
      vi.doMock('../audio-cache.js', () => ({
        cacheSurahAudio: vi.fn().mockResolvedValue(undefined),
        isSurahCached: vi.fn().mockResolvedValue(true),
      }));

      const result = await downloadOfflinePack({
        reciterId: 'ar.alafasy',
        audioSurahCount: 3,
      });

      expect(result.success).toBe(true);
      expect(result.succeeded).toBeGreaterThan(4); // 4 data + 3 audio
    });

    it('handles audio fetch failure gracefully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('.mp3')) {
          return Promise.resolve({
            ok: false,
            status: 404,
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'mock' }),
          blob: () => Promise.resolve(new Blob()),
        });
      });

      vi.doMock('../audio-cache.js', () => ({
        cacheSurahAudio: vi.fn().mockResolvedValue(undefined),
        isSurahCached: vi.fn().mockResolvedValue(true),
      }));

      const result = await downloadOfflinePack({
        reciterId: 'ar.alafasy',
        audioSurahCount: 2,
      });

      expect(result.failed).toBe(2); // 2 audio failures
      expect(result.errors.some((e) => e.includes('Audio surah'))).toBe(true);
    });

    it('skips audio when reciterId not provided', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'mock' }),
          blob: () => Promise.resolve(new Blob()),
        });
      });

      const result = await downloadOfflinePack({
        audioSurahCount: 5,
        // no reciterId
      });

      expect(result.success).toBe(true);
      // Only data: 1 quran + 5 translations + 1 tajweed = 7
      expect(result.succeeded).toBe(7);
    });

    it('saves status to localStorage on completion', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'mock' }),
          blob: () => Promise.resolve(new Blob()),
        });
      });

      await downloadOfflinePack({});

      const status = getOfflinePackStatus();
      expect(status.installed).toBe(true);
      expect(status.installedAt).not.toBeNull();
      expect(status.itemCount).toBeGreaterThan(0);
    });
  });

  describe('formatBytes edge cases', () => {
    it('handles 1 byte', () => {
      expect(formatBytes(1)).toBe('1 B');
    });

    it('handles 1023 bytes', () => {
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('handles 1024 bytes exactly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    it('handles 1 MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
    });

    it('handles large values', () => {
      expect(formatBytes(500 * 1024 * 1024)).toBe('500 MB');
    });
  });

  describe('estimateOfflinePackSize', () => {
    it('returns base size without audio', () => {
      const size = estimateOfflinePackSize(false, 0);
      expect(size).toBe(1_700_000 + 3_000_000 + 500_000);
    });

    it('includes audio when requested', () => {
      const size = estimateOfflinePackSize(true, 10);
      expect(size).toBe(1_700_000 + 3_000_000 + 500_000 + 10 * 8_000_000);
    });

    it('handles 0 audio surahs', () => {
      const size = estimateOfflinePackSize(true, 0);
      expect(size).toBe(1_700_000 + 3_000_000 + 500_000);
    });
  });
});
