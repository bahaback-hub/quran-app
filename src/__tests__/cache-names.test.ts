/**
 * Tests for cache-names.ts — the single source of truth for Cache Storage
 * bucket names (ARC-03).
 *
 * The service worker (vite.config.js) and the runtime code must share buckets;
 * drift means double-stored audio/JSON plus orphaned buckets that survive
 * cleanup forever.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { CACHE_NAMES, LEGACY_CACHE_NAMES, deleteLegacyCaches } from '../cache-names.js';

describe('cache-names (ARC-03)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses versioned buckets shared with the service worker routes', () => {
    expect(CACHE_NAMES.quranAudio).toBe('quran-audio-v3');
    expect(CACHE_NAMES.islamicCdn).toBe('islamic-cdn-v3');
    expect(CACHE_NAMES.appData).toBe('app-data-v3');
  });

  it('tracks exactly the legacy buckets older releases wrote', () => {
    expect([...LEGACY_CACHE_NAMES].sort()).toEqual(['app-data-v2', 'islamic-cdn', 'quran-audio']);
  });

  it('deletes only legacy buckets, keeping current and foreign ones', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue([
        'islamic-cdn',
        'quran-audio',
        'app-data-v2',
        'quran-audio-v3',
        'some-other-app-bucket',
      ]),
      delete: vi.fn((name: string) => {
        deleted.push(name);
        return Promise.resolve(true);
      }),
    } as unknown as CacheStorage);

    deleteLegacyCaches();
    await vi.waitFor(() => expect(deleted.length).toBe(3));

    expect([...deleted].sort()).toEqual(['app-data-v2', 'islamic-cdn', 'quran-audio']);
  });

  it('does nothing when Cache Storage is unavailable', () => {
    vi.stubGlobal('caches', undefined as unknown as CacheStorage);
    expect(() => deleteLegacyCaches()).not.toThrow();
  });
});
