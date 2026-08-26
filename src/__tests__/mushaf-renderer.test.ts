/**
 * Tests for mushaf-renderer.ts — Mushaf page rendering with QCF4 fonts,
 * page data loading/caching, line position calculation, and canvas rendering.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Unmock the mushaf-renderer module (mocked as {} by setup-i18n.ts)
vi.unmock('../mushaf-renderer.js');

// Mock state module
vi.mock('../state.js', () => ({
  state: {
    tajweedEnabled: false,
    fontSize: 100,
  },
}));

// Mock tajweed module
vi.mock('../tajweed.js', () => ({
  buildColorMap: vi.fn(() => new Map()),
  getTajweedColor: vi.fn(() => null),
}));

// Mock tajweed-data module
vi.mock('../tajweed-data.js', () => ({
  getAyahAnnotations: vi.fn(() => []),
}));

// Mock types module (for isCapacitorNative)
vi.mock('../types.js', () => ({
  isCapacitorNative: vi.fn(() => false),
}));

// Must re-mushroom the storage module since setup-i18n.ts sets it up
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

import {
  CANVAS_W,
  CANVAS_H,
  PAD_H,
  PAD_V,
  TOP_OFFSET,
  BOTTOM_OFFSET,
  STD_LINES,
  loadPageData,
  renderPage,
  getLineY,
} from '../mushaf-renderer.js';
import type { PageLayoutData } from '../mushaf-renderer.js';

describe('Constants', () => {
  it('should have CANVAS_W = 1080', () => {
    expect(CANVAS_W).toBe(1080);
  });

  it('should have CANVAS_H = 1540', () => {
    expect(CANVAS_H).toBe(1540);
  });

  it('should have PAD_H = 30', () => {
    expect(PAD_H).toBe(30);
  });

  it('should have PAD_V = 30', () => {
    expect(PAD_V).toBe(30);
  });

  it('should have TOP_OFFSET = 30', () => {
    expect(TOP_OFFSET).toBe(30);
  });

  it('should have BOTTOM_OFFSET = 50', () => {
    expect(BOTTOM_OFFSET).toBe(50);
  });

  it('should have STD_LINES = 15', () => {
    expect(STD_LINES).toBe(15);
  });
});

describe('getLineY', () => {
  it('should return 0 for lineIndex 0', () => {
    expect(getLineY(0, 15, 1540)).toBe(0);
  });

  it('should return imgHeight for lineIndex equal to lineCount', () => {
    expect(getLineY(15, 15, 1540)).toBe(1540);
  });

  it('should return 0 for negative lineIndex', () => {
    expect(getLineY(-1, 15, 1540)).toBe(0);
  });

  it('should return increasing Y for increasing lineIndex', () => {
    const y0 = getLineY(1, 15, 1540);
    const y1 = getLineY(2, 15, 1540);
    const y2 = getLineY(7, 15, 1540);
    expect(y0).toBeLessThan(y1);
    expect(y1).toBeLessThan(y2);
  });

  it('should scale Y proportionally with imgHeight', () => {
    const y1 = getLineY(5, 15, 770);
    const y2 = getLineY(5, 15, 1540);
    // y2 should be approximately double y1 since imgHeight is double
    expect(y2).toBeCloseTo(y1 * 2, 0);
  });

  it('should handle short pages (lineCount < STD_LINES)', () => {
    const y = getLineY(3, 5, 1540);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(1540);
  });

  it('should handle single-line page', () => {
    const y = getLineY(1, 1, 1540);
    // For a single line page, lineIndex 1 equals lineCount so returns imgHeight
    expect(y).toBe(1540);
  });

  it('should return values within canvas bounds for standard pages', () => {
    for (let i = 1; i < 15; i++) {
      const y = getLineY(i, 15, 1540);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1540);
    }
  });

  it('should produce evenly spaced lines for standard page (15 lines)', () => {
    const y1 = getLineY(1, 15, 1540);
    const y2 = getLineY(2, 15, 1540);
    const y3 = getLineY(3, 15, 1540);
    const diff1 = y2 - y1;
    const diff2 = y3 - y2;
    // Should be approximately evenly spaced
    expect(Math.abs(diff1 - diff2)).toBeLessThan(1);
  });
});

describe('loadPageData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when fetch fails', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
    vi.stubGlobal('fetch', mockFetch);
    const result = await loadPageData(998);
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('should return null when response is not ok', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      }),
    );
    vi.stubGlobal('fetch', mockFetch);
    const result = await loadPageData(997);
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('should return page layout data on successful fetch', async () => {
    const mockData: PageLayoutData = {
      font: 'QCF4_Hafs_01',
      lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word' }] }],
    };
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      }),
    );
    vi.stubGlobal('fetch', mockFetch);
    const result = await loadPageData(996);
    expect(result).not.toBeNull();
    expect(result?.font).toBe('QCF4_Hafs_01');
    expect(result?.lines).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it('should cache page data and not re-fetch', async () => {
    const mockData: PageLayoutData = {
      font: 'QCF4_Hafs_01',
      lines: [],
    };
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    // Use a unique page number to avoid cache pollution from other tests
    const uniquePage = 995;
    const result1 = await loadPageData(uniquePage);
    const result2 = await loadPageData(uniquePage);

    expect(result1).toBe(result2); // Same reference from cache
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only fetched once
    vi.restoreAllMocks();
  });

  it('should request the correct URL with zero-padded page number', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ lines: [] }),
      }),
    );
    vi.stubGlobal('fetch', mockFetch);
    await loadPageData(994);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('994.json'));
    vi.restoreAllMocks();
  });
});

describe('renderPage', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
  });

  it('should return null layout when page data cannot be loaded', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
    vi.stubGlobal('fetch', mockFetch);

    const result = await renderPage(990, canvas);
    expect(result.layout).toBeNull();
    vi.restoreAllMocks();
  });

  it('should return null canvas when page data cannot be loaded', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
    vi.stubGlobal('fetch', mockFetch);

    const result = await renderPage(989, canvas);
    expect(result.canvas).toBeNull();
    vi.restoreAllMocks();
  });

  it('should not throw on page numbers outside valid range', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await renderPage(9999, canvas);
    expect(result.layout).toBeNull();
    vi.restoreAllMocks();
  });

  it('should return RenderPageResult structure', async () => {
    const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
    vi.stubGlobal('fetch', mockFetch);

    const result = await renderPage(988, canvas);
    expect(result).toHaveProperty('canvas');
    expect(result).toHaveProperty('layout');
    vi.restoreAllMocks();
  });
});
