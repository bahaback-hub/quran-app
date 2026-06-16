/**
 * Coverage tests for tajweed-data.ts — annotation loading, caching, and preloading.
 * Covers: loadTajweedAnnotations, getAyahAnnotations, isTajweedDataLoaded, preloadTajweedIfNeeded
 *
 * IMPORTANT: The module has a module-level _annotations cache. We use vi.resetModules()
 * before each test to get a fresh module instance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock state module — must be at module level for vi.mock
const mockState = vi.hoisted(() => ({
  tajweedEnabled: true,
}));

vi.mock('../state.js', () => ({
  state: mockState,
}));

describe('tajweed-data', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('loadTajweedAnnotations', () => {
    it('should load and cache annotations from fetch', async () => {
      const mockData = [
        { surah: 1, ayah: 1, annotations: [{ rule: 'ghunnah', start: 0, end: 3 }] },
        { surah: 2, ayah: 1, annotations: [{ rule: 'qalqalah', start: 5, end: 7 }] },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const { loadTajweedAnnotations } = await import('../tajweed-data.js');
      const result = await loadTajweedAnnotations();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('1:1')).toEqual([{ rule: 'ghunnah', start: 0, end: 3 }]);
      expect(result.get('2:1')).toEqual([{ rule: 'qalqalah', start: 5, end: 7 }]);
    });

    it('should return cached annotations on subsequent calls', async () => {
      const mockData = [{ surah: 1, ayah: 1, annotations: [] }];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const { loadTajweedAnnotations } = await import('../tajweed-data.js');
      const first = await loadTajweedAnnotations();
      const second = await loadTajweedAnnotations();

      expect(first).toBe(second); // Same reference — cached
    });

    it('should handle fetch failure gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const { loadTajweedAnnotations } = await import('../tajweed-data.js');
      const result = await loadTajweedAnnotations();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle entries with null/undefined annotations as empty arrays', async () => {
      const mockData = [
        { surah: 1, ayah: 1, annotations: null },
        { surah: 1, ayah: 2 }, // No annotations property
      ] as any;

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const { loadTajweedAnnotations } = await import('../tajweed-data.js');
      const result = await loadTajweedAnnotations();

      expect(result.get('1:1')).toEqual([]);
      expect(result.get('1:2')).toEqual([]);
    });
  });

  describe('getAyahAnnotations', () => {
    it('should return empty array when annotations are not loaded', async () => {
      // Fresh module with _annotations = null
      const { getAyahAnnotations } = await import('../tajweed-data.js');
      const result = getAyahAnnotations(1, 1);
      expect(result).toEqual([]);
    });

    it('should return annotations for a specific ayah after loading', async () => {
      const mockData = [
        { surah: 1, ayah: 1, annotations: [{ rule: 'ghunnah', start: 0, end: 3 }] },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const { loadTajweedAnnotations, getAyahAnnotations } = await import('../tajweed-data.js');
      await loadTajweedAnnotations();
      const result = getAyahAnnotations(1, 1);

      expect(result).toEqual([{ rule: 'ghunnah', start: 0, end: 3 }]);
    });

    it('should return empty array for non-existent ayah', async () => {
      const mockData = [
        { surah: 1, ayah: 1, annotations: [{ rule: 'ghunnah', start: 0, end: 3 }] },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const { loadTajweedAnnotations, getAyahAnnotations } = await import('../tajweed-data.js');
      await loadTajweedAnnotations();
      const result = getAyahAnnotations(999, 999);

      expect(result).toEqual([]);
    });
  });

  describe('isTajweedDataLoaded', () => {
    it('should return false before loading', async () => {
      const { isTajweedDataLoaded } = await import('../tajweed-data.js');
      expect(isTajweedDataLoaded()).toBe(false);
    });

    it('should return true after successful loading', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const { loadTajweedAnnotations, isTajweedDataLoaded } = await import('../tajweed-data.js');
      await loadTajweedAnnotations();
      expect(isTajweedDataLoaded()).toBe(true);
    });
  });

  describe('preloadTajweedIfNeeded', () => {
    it('should load annotations when tajweedEnabled is true', async () => {
      mockState.tajweedEnabled = true;

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ surah: 1, ayah: 1, annotations: [] }]),
      } as Response);

      const { preloadTajweedIfNeeded, isTajweedDataLoaded } = await import('../tajweed-data.js');
      await preloadTajweedIfNeeded();
      expect(isTajweedDataLoaded()).toBe(true);
    });

    it('should NOT load annotations when tajweedEnabled is false', async () => {
      mockState.tajweedEnabled = false;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const { preloadTajweedIfNeeded, isTajweedDataLoaded } = await import('../tajweed-data.js');
      await preloadTajweedIfNeeded();
      // Should not have called fetch since tajweed is disabled
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(isTajweedDataLoaded()).toBe(false);
    });
  });

  describe('key function (indirectly via getAyahAnnotations)', () => {
    it('should use surah:ayah format for keys', async () => {
      const mockData = [
        { surah: 36, ayah: 1, annotations: [{ rule: 'iqlab', start: 10, end: 15 }] },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response);

      const { loadTajweedAnnotations, getAyahAnnotations } = await import('../tajweed-data.js');
      const map = await loadTajweedAnnotations();

      // Verify the key format
      expect(map.has('36:1')).toBe(true);
      expect(getAyahAnnotations(36, 1)).toEqual([{ rule: 'iqlab', start: 10, end: 15 }]);
    });
  });
});
