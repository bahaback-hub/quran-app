/**
 * Behavioral coverage for the lazy per-surah tajweed loader.
 * Verifies compact chunk decoding, cache boundaries, legacy compatibility,
 * and the reader-specific preload path used to avoid loading all 114 surahs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  tajweedEnabled: true,
  currentSurah: undefined as number | undefined,
}));

vi.mock('../state.js', () => ({ state: mockState }));

function jsonResponse(data: unknown): Response {
  return { json: () => Promise.resolve(data) } as Response;
}

describe('lazy per-surah tajweed loader', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mockState.tajweedEnabled = true;
    mockState.currentSurah = undefined;
  });

  it('loads and decodes only the requested compact surah chunk', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (input === 'data/tajweed/manifest.json') {
        return Promise.resolve(
          jsonResponse({
            version: 1,
            rules: ['ghunnah', 'madd_2'],
            files: ['001.json', '002.json'],
          }),
        );
      }
      if (input === 'data/tajweed/002.json') {
        return Promise.resolve(
          jsonResponse([
            [
              1,
              [
                [0, 2, 5],
                [1, 8, 10],
              ],
            ],
          ]),
        );
      }
      return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
    });

    const { getAyahAnnotations, loadTajweedAnnotationsForSurah } = await import('../tajweed-data.js');
    const result = await loadTajweedAnnotationsForSurah(2);

    expect(result.get('2:1')).toEqual([
      { rule: 'ghunnah', start: 2, end: 5 },
      { rule: 'madd_2', start: 8, end: 10 },
    ]);
    expect(getAyahAnnotations(2, 1)).toEqual(result.get('2:1'));
    expect(fetchSpy).toHaveBeenCalledWith('data/tajweed/manifest.json');
    expect(fetchSpy).toHaveBeenCalledWith('data/tajweed/002.json');
    expect(fetchSpy).not.toHaveBeenCalledWith('data/tajweed/001.json');
  });

  it('caches a compact surah map after its first request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const data =
        input === 'data/tajweed/manifest.json'
          ? { version: 1, rules: ['qalqalah'], files: ['036.json'] }
          : [[1, [[0, 1, 3]]]];
      return Promise.resolve(jsonResponse(data));
    });

    const { loadTajweedAnnotationsForSurah } = await import('../tajweed-data.js');
    const first = await loadTajweedAnnotationsForSurah(36);
    const second = await loadTajweedAnnotationsForSurah(36);

    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns an empty map when the manifest contains no matching chunk', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        version: 1,
        rules: [],
        files: ['001.json'],
      }),
    );

    const { loadTajweedAnnotationsForSurah } = await import('../tajweed-data.js');
    const result = await loadTajweedAnnotationsForSurah(2);

    expect(result).toEqual(new Map());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('supports the legacy full-data manifest shape for a selected surah', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([
        { surah: 1, ayah: 1, annotations: [{ rule: 'ghunnah', start: 0, end: 1 }] },
        { surah: 2, ayah: 1, annotations: [{ rule: 'qalqalah', start: 3, end: 4 }] },
      ]),
    );

    const { loadTajweedAnnotationsForSurah } = await import('../tajweed-data.js');
    const result = await loadTajweedAnnotationsForSurah(2);

    expect(result.size).toBe(1);
    expect(result.get('2:1')).toEqual([{ rule: 'qalqalah', start: 3, end: 4 }]);
  });

  it('derives a selected surah map from a previously loaded offline corpus', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const data =
        input === 'data/tajweed/manifest.json'
          ? { version: 1, rules: ['ghunnah'], files: ['001.json', '002.json'] }
          : [[1, [[0, 0, 2]]]];
      return Promise.resolve(jsonResponse(data));
    });

    const { getAyahAnnotations, loadTajweedAnnotations, loadTajweedAnnotationsForSurah } =
      await import('../tajweed-data.js');
    await loadTajweedAnnotations();
    const surahMap = await loadTajweedAnnotationsForSurah(2);

    expect(surahMap.get('2:1')).toEqual([{ rule: 'ghunnah', start: 0, end: 2 }]);
    expect(getAyahAnnotations(2, 1)).toEqual([{ rule: 'ghunnah', start: 0, end: 2 }]);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('caches an empty map when the requested chunk cannot be loaded', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { isTajweedDataLoaded, loadTajweedAnnotationsForSurah } = await import('../tajweed-data.js');
    const first = await loadTajweedAnnotationsForSurah(10);
    const second = await loadTajweedAnnotationsForSurah(10);

    expect(first).toEqual(new Map());
    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(isTajweedDataLoaded()).toBe(true);
  });

  it('preloads only the active reader surah when tajweed is enabled', async () => {
    mockState.currentSurah = 36;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const data =
        input === 'data/tajweed/manifest.json'
          ? { version: 1, rules: ['ghunnah'], files: ['036.json'] }
          : [[1, [[0, 0, 1]]]];
      return Promise.resolve(jsonResponse(data));
    });

    const { getAyahAnnotations, preloadTajweedIfNeeded } = await import('../tajweed-data.js');
    await preloadTajweedIfNeeded();

    expect(getAyahAnnotations(36, 1)).toEqual([{ rule: 'ghunnah', start: 0, end: 1 }]);
    expect(fetchSpy).toHaveBeenCalledWith('data/tajweed/036.json');
  });
});
