/**
 * Deep coverage tests for mushaf-renderer.ts — covers loadPageData with different scenarios.
 * Note: constants, renderPage, getLineY are already covered by mushaf-renderer-full.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Unmock the mushaf-renderer module
vi.unmock('../mushaf-renderer.js');

const { mockState } = vi.hoisted(() => ({
  mockState: {
    tajweedEnabled: false,
    fontSize: 100,
  },
}));

vi.mock('../state.js', () => ({
  state: mockState,
}));

vi.mock('../tajweed.js', () => ({
  buildColorMap: vi.fn(() => new Map()),
  getTajweedColor: vi.fn(() => null),
}));

vi.mock('../tajweed-data.js', () => ({
  getAyahAnnotations: vi.fn(() => []),
}));

vi.mock('../types.js', () => ({
  isCapacitorNative: vi.fn(() => false),
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

import { loadPageData } from '../mushaf-renderer.js';

describe('mushaf-renderer deep coverage', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          font: 'QCF4Page1',
          lines: [
            {
              words: [{ char: 'ب', font: 'QCF4Word1', type: 'word', verse_key: '1:1', location: '1:1:1' }],
            },
          ],
        }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadPageData', () => {
    it('should load page data from fetch', async () => {
      const data = await loadPageData(1);
      expect(data).not.toBeNull();
      expect(data!.lines).toBeDefined();
      expect(data!.font).toBe('QCF4Page1');
    });

    it('should handle fetch failure gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
      const data = await loadPageData(999);
      expect(data).toBeNull();
    });

    it('should handle non-ok fetch response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);
      const data = await loadPageData(999);
      expect(data).toBeNull();
    });

    it('should return cached data on second call', async () => {
      const first = await loadPageData(1);
      const second = await loadPageData(1);
      expect(first).toBe(second);
    });

    it('should handle page data with multiple lines', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            font: 'QCF4Page2',
            lines: [
              { words: [{ char: 'ا', font: 'QCF4Word1', type: 'word', verse_key: '2:1', location: '2:1:1' }] },
              { words: [{ char: 'ل', font: 'QCF4Word2', type: 'word', verse_key: '2:1', location: '2:1:2' }] },
              { words: [{ char: 'م', font: 'QCF4Word3', type: 'end', verse_key: '2:1', location: '2:1:3' }] },
            ],
          }),
      } as Response);

      const data = await loadPageData(2);
      expect(data).not.toBeNull();
      expect(data!.lines.length).toBe(3);
    });
  });
});
