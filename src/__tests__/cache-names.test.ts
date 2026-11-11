/**
 * Tests for cache-names.ts — the single source of truth for Cache Storage
 * bucket names (ARC-03, NEW-03).
 *
 * The service worker (vite.config.js) and the runtime code must share buckets;
 * drift means double-stored audio/JSON plus orphaned buckets that survive
 * cleanup forever. NEW-03 extended the single source to the Mushaf font and
 * page-layout buckets.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { CACHE_NAMES, LEGACY_CACHE_NAMES, deleteLegacyCaches, deleteLegacyQcf4FontEntries } from '../cache-names.js';

describe('cache-names (ARC-03, NEW-03)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses versioned buckets shared with the service worker routes', () => {
    expect(CACHE_NAMES.quranAudio).toBe('quran-audio-v3');
    expect(CACHE_NAMES.islamicCdn).toBe('islamic-cdn-v3');
    expect(CACHE_NAMES.appData).toBe('app-data-v3');
  });

  it('shares the Mushaf font and layout buckets between SW and runtime', () => {
    // NEW-03: the SW qcf4 font route and qcf4-font-pack.ts must resolve to the
    // same name, and the SW mirror routes and mushaf-page-data.ts likewise.
    expect(CACHE_NAMES.mushafFonts).toBe('mushaf-fonts');
    expect(CACHE_NAMES.mushafLayouts).toBe('qcf4-page-layouts');
  });

  it('tracks exactly the legacy buckets older releases wrote', () => {
    expect([...LEGACY_CACHE_NAMES].sort()).toEqual([
      'app-data-v2',
      'islamic-cdn',
      'mushaf-fonts-v3',
      'mushaf-layout-v3',
      'quran-audio',
    ]);
  });

  it('deletes only legacy buckets, keeping current and foreign ones', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('caches', {
      keys: vi
        .fn()
        .mockResolvedValue([
          'islamic-cdn',
          'quran-audio',
          'app-data-v2',
          'mushaf-layout-v3',
          'mushaf-fonts-v3',
          'quran-audio-v3',
          'some-other-app-bucket',
        ]),
      delete: vi.fn((name: string) => {
        deleted.push(name);
        return Promise.resolve(true);
      }),
    } as unknown as CacheStorage);

    deleteLegacyCaches();
    await vi.waitFor(() => expect(deleted.length).toBe(5));

    expect([...deleted].sort()).toEqual([
      'app-data-v2',
      'islamic-cdn',
      'mushaf-fonts-v3',
      'mushaf-layout-v3',
      'quran-audio',
    ]);
  });

  it('sweeps only the QCF4 entries out of the generic app-fonts bucket', async () => {
    const deletedUrls: string[] = [];
    const requests = [
      'https://example.com/quran-app/fonts/qcf4/QCF4_Hafs_01_W.woff2',
      'https://example.com/quran-app/fonts/qcf4/QCF4_QBSML.woff2',
      'https://example.com/quran-app/fonts/Amiri-Regular.woff2',
      'https://example.com/quran-app/fonts/fonts.css',
    ].map((url) => ({ url }) as Request);
    vi.stubGlobal('caches', {
      open: vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue(requests),
        delete: vi.fn((req: Request) => {
          deletedUrls.push(req.url);
          return Promise.resolve(true);
        }),
      }),
    } as unknown as CacheStorage);

    deleteLegacyQcf4FontEntries();
    await vi.waitFor(() => expect(deletedUrls.length).toBe(2));

    expect(deletedUrls.every((url) => url.includes('/fonts/qcf4/'))).toBe(true);
  });

  it('does nothing when Cache Storage is unavailable', () => {
    vi.stubGlobal('caches', undefined as unknown as CacheStorage);
    expect(() => deleteLegacyCaches()).not.toThrow();
    expect(() => deleteLegacyQcf4FontEntries()).not.toThrow();
  });
});
