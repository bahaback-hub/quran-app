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
  getCanvas,
  releaseCanvas,
  clearCanvasPool,
  computeMushafLineLayout,
} from '../mushaf-renderer.js';
import type { PageLayoutData, PageWord } from '../mushaf-renderer.js';

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

describe('computeMushafLineLayout', () => {
  const fakeCtx = {
    measureText: (s: string) => ({ width: Array.from(s).length * 10 }),
  } as unknown as CanvasRenderingContext2D;

  const mkData = (lines: PageLayoutData['lines'], font = 'QCF4_Hafs_01'): PageLayoutData => ({ font, lines });
  const w = (char: string, verseKey = '1:1', type = 'word'): PageWord => ({ char, verse_key: verseKey, type });

  it('fills the available width on a standard page with justified gaps', () => {
    const layout = computeMushafLineLayout(
      fakeCtx,
      mkData([{ words: [w('aaaa'), w('bb', '1:2'), w('c', '1:3')] }]),
      10,
      'QCF4_Hafs_01',
    );
    const line = layout.lines[0]!;
    // widths: 40, 20, 10 → totalW 70; availableW = 1080 - 60 = 1020; gap = (1020-70)/2 = 475
    expect(line.gap).toBeCloseTo(475, 3);
    expect(line.totalWidth).toBeCloseTo(1020, 3);
    // first word right edge at textRight = (1080 + 1020) / 2 = 1050
    expect(line.words[0]!.x).toBeCloseTo(1050, 3);
    // last word left edge lands at textRight - totalWidth = 30
    const last = line.words[2]!;
    expect(last.x - last.width).toBeCloseTo(30, 3);
    expect(layout.isOpeningPage).toBe(false);
  });

  it('matches getLineY vertical positions on short pages', () => {
    const count = 5;
    const data = mkData(
      Array.from({ length: count }, (_, i) => ({ words: [w('aa', `1:${i + 1}`)] })),
    );
    const layout = computeMushafLineLayout(fakeCtx, data, 42, 'QCF4_Hafs_01');
    expect(layout.isShortPage).toBe(true);
    // getLineY(0) is a special case returning 0; the painted first line sits at TOP_OFFSET
    expect(layout.lines[0]!.y).toBeCloseTo(TOP_OFFSET, 3);
    for (let i = 1; i < count; i++) {
      expect(layout.lines[i]!.y).toBeCloseTo(getLineY(i, count, CANVAS_H), 3);
    }
  });

  it('centers lines on opening pages and keeps empty-line placeholders', () => {
    const layout = computeMushafLineLayout(
      fakeCtx,
      mkData([
        { words: [w('aaaa'), w('bb')] },
        { words: [] },
        { words: [w('c', '1:3')] },
      ]),
      1,
      'QCF4_Hafs_01',
    );
    expect(layout.isOpeningPage).toBe(true);
    const first = layout.lines[0]!;
    // centered: startX = CANVAS_W/2 + totalWidth/2
    expect(first.words[0]!.x).toBeCloseTo(CANVAS_W / 2 + first.totalWidth / 2, 3);
    // placeholder line kept so indices align with data.lines
    expect(layout.lines[1]!.words).toHaveLength(0);
    expect(layout.lines).toHaveLength(3);
  });

  it('returns an empty layout for a page with no lines', () => {
    const layout = computeMushafLineLayout(fakeCtx, mkData([]), 10, 'QCF4_Hafs_01');
    expect(layout.lines).toHaveLength(0);
    expect(layout.stdLineHeight).toBe(0);
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

describe('Canvas Pool (getCanvas / releaseCanvas)', () => {
  beforeEach(() => {
    clearCanvasPool();
  });

  it('should reuse a released canvas instead of allocating a new one', () => {
    const first = getCanvas();
    expect(first).toBeInstanceOf(HTMLCanvasElement);
    expect(first.width).toBe(CANVAS_W);
    expect(first.height).toBe(CANVAS_H);

    // Return it to the pool (this is what mushaf.ts does when navigating away)
    releaseCanvas(first);

    // Next acquisition should hand back the SAME instance (no new allocation)
    const second = getCanvas();
    expect(second).toBe(first);
  });

  it('should not grow the pool beyond MAX_POOL_SIZE (desktop = 3)', () => {
    const canvases = [getCanvas(), getCanvas(), getCanvas(), getCanvas(), getCanvas()];
    canvases.forEach((c) => releaseCanvas(c));

    // Only up to 3 should be retained; the rest are left for GC.
    // Acquiring 3 returns distinct pooled instances, the 4th is a fresh alloc.
    const a = getCanvas();
    const b = getCanvas();
    const c = getCanvas();
    const d = getCanvas();
    expect(new Set([a, b, c]).size).toBe(3);
    // d is a fresh allocation not among the first three
    expect([a, b, c]).not.toContain(d);
  });
});
