import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../features/audio/audio-cache.js');

describe('audio-cache branches', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('caches audio, reports stats, and reads back blob/url', async () => {
    const blob = new Blob(['abc'], { type: 'audio/mpeg' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');

    const mod = await import('../features/audio/audio-cache.js');
    await mod.cacheSurahAudio(['https://x/1.mp3', null, 'https://x/2.mp3'], 1, 'ar.alafasy');

    expect(await mod.isAudioCached('https://x/1.mp3')).toBe(true);
    expect(await mod.isSurahCached(['https://x/1.mp3', 'https://x/2.mp3'])).toBe(true);
    expect(await mod.getCachedAudioBlob('https://x/1.mp3')).toBeTruthy();
    expect(await mod.getCachedAudioUrl('https://x/1.mp3')).toBe('blob:test');
    expect(await mod.getCachedAudioUrl('https://x/missing.mp3')).toBeNull();

    const stats = await mod.getCacheStats();
    expect(stats.fileCount).toBeGreaterThanOrEqual(2);
    expect(stats.cachedSurahs).toContain(1);
    createUrl.mockRestore();
  });

  it('handles fetch failure and non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const mod = await import('../features/audio/audio-cache.js');
    await expect(mod.cacheSurahAudio(['https://x/bad.mp3'], 2, 'r1')).resolves.toBeUndefined();
    expect(await mod.isAudioCached('https://x/bad.mp3')).toBe(false);
  });

  it('deduplicates concurrent cacheSurahAudio calls and supports delete/clear', async () => {
    let resolveFetch: any;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: any) => {
      if (init?.mode === 'no-cors') return Promise.resolve({ type: 'opaque', clone: () => ({}) } as any);
      return new Promise((resolve) => { resolveFetch = resolve; });
    });
    vi.stubGlobal('fetch', fetchMock);

    const mod = await import('../features/audio/audio-cache.js');
    const url = `https://x/dedup-${Date.now()}.mp3`;
    const p1 = mod.cacheSurahAudio([url], 3, 'r1');
    const p2 = mod.cacheSurahAudio([url], 3, 'r1');
    // allow microtasks for isAudioCached checks
    await new Promise((r) => setTimeout(r, 20));
    resolveFetch?.({ ok: true, blob: async () => new Blob(['a']) });
    await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalled();

    expect(await mod.deleteSurahCache(3, 'r1')).toBeGreaterThanOrEqual(0);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['b']) }));
    await mod.cacheSurahAudio(['https://x/clear.mp3'], 9, 'r9');
    expect(await mod.clearAudioCache()).toBe(true);
    const stats = await mod.getCacheStats();
    expect(stats.fileCount).toBe(0);
  });

  it('returns expected values for empty/invalid checks', async () => {
    const mod = await import('../features/audio/audio-cache.js');
    expect(await mod.isSurahCached([])).toBe(false);
    expect(await mod.isSurahCached([null, null])).toBe(false);
    expect(await mod.deleteSurahCache(99, 'none')).toBe(0);
  });
});
