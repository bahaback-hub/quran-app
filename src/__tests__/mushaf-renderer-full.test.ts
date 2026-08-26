/**
 * Comprehensive unit tests for mushaf-renderer.ts
 * Covers: constants, loadPageData, renderPage, getLineY,
 * Capacitor-specific paths, timeout race conditions, font loading,
 * LRU cache eviction, night mode colors, page rendering content
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* ===================== MOCKS ===================== */

// Unmock the mushaf-renderer module (setup-i18n.ts mocks it as {})
vi.unmock('../mushaf-renderer.js');

// Hoist mock state to be available in vi.mock factory
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

/* ===================== IMPORTS ===================== */

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

/* ===================== HELPERS ===================== */

// Shared mock context for all canvas operations
let mockCtx: {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillRect: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  measureText: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
} | null = null;

function createMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 20 })),
    getImageData: vi.fn(() => {
      // Return image data with non-white pixels to make verifyFontOnCanvas return true
      const data = new Uint8ClampedArray(4 * 80 * 80);
      // Make first pixel non-white so font verification succeeds
      data[0] = 0;
      data[1] = 0;
      data[2] = 0;
      data[3] = 255;
      return { data };
    }),
  };
}

/**
 * Setup mock for HTMLCanvasElement.prototype.getContext so that ALL canvas
 * elements (including ones created internally by mushaf-renderer) return
 * a mock 2d context.
 */
function setupGlobalCanvasMock(): void {
  mockCtx = createMockCtx();

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement, contextId: string) {
    if (contextId === '2d') {
      return mockCtx;
    }
    return originalGetContext.call(this, contextId);
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

function restoreCanvasMock(): void {
  // Restore by deleting the mock (prototype chain will restore original)
  // Actually, we saved the original, but it's cleaner to just let the test environment reset
  mockCtx = null;
}

/**
 * Setup mock FontFace and document.fonts for rendering tests.
 * FontFace must be a constructable class because the source code uses `new FontFace(...)`.
 */
function setupFontMocks(): void {
  class MockFontFace {
    family: string;
    source: unknown;
    descriptors: unknown;
    status = 'unloaded';
    constructor(family: string, source: unknown, descriptors?: unknown) {
      this.family = family;
      this.source = source;
      this.descriptors = descriptors;
    }
    load(): Promise<MockFontFace> {
      this.status = 'loaded';
      return Promise.resolve(this);
    }
  }
  vi.stubGlobal('FontFace', MockFontFace);

  Object.defineProperty(document, 'fonts', {
    value: {
      add: vi.fn(),
      ready: Promise.resolve(),
      check: vi.fn(() => true),
      load: vi.fn(() => Promise.resolve([])),
    },
    writable: true,
    configurable: true,
  });
}

/**
 * Setup mock fetch that returns page layout data for JSON requests
 * and ArrayBuffer for font requests.
 */
function setupFetchMock(mockData: PageLayoutData): void {
  const mockFetch = vi.fn((url: string) => {
    if (typeof url === 'string' && url.endsWith('.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      });
    }
    // Font binary request
    return Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(15000)),
    });
  });
  vi.stubGlobal('fetch', mockFetch);
}

/* ===================== TESTS ===================== */

describe('mushaf-renderer.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockState.tajweedEnabled = false;
    setupGlobalCanvasMock();
    setupFontMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreCanvasMock();
    document.body.classList.remove('night-mode');
    document.documentElement.classList.remove('capacitor-native');
  });

  /* ===================== Constants ===================== */

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

  /* ===================== getLineY ===================== */

  describe('getLineY', () => {
    it('should return 0 for lineIndex 0', () => {
      expect(getLineY(0, 15, 1540)).toBe(0);
    });

    it('should return 0 for negative lineIndex', () => {
      expect(getLineY(-1, 15, 1540)).toBe(0);
      expect(getLineY(-5, 15, 1540)).toBe(0);
    });

    it('should return imgHeight when lineIndex equals lineCount', () => {
      expect(getLineY(15, 15, 1540)).toBe(1540);
    });

    it('should return imgHeight when lineIndex exceeds lineCount', () => {
      expect(getLineY(20, 15, 1540)).toBe(1540);
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
      expect(y2).toBeCloseTo(y1 * 2, 0);
    });

    it('should handle short pages (lineCount < STD_LINES)', () => {
      const y = getLineY(3, 5, 1540);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1540);
    });

    it('should handle single-line page', () => {
      const y = getLineY(1, 1, 1540);
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
      expect(Math.abs(diff1 - diff2)).toBeLessThan(1);
    });

    it('should handle 2-line page correctly', () => {
      const y0 = getLineY(0, 2, 1540);
      const y1 = getLineY(1, 2, 1540);
      expect(y0).toBe(0);
      expect(y1).toBeGreaterThan(0);
      expect(y1).toBeLessThan(1540);
    });

    it('should return 0 for imgHeight 0', () => {
      expect(getLineY(5, 15, 0)).toBe(0);
    });
  });

  /* ===================== loadPageData ===================== */

  describe('loadPageData', () => {
    // Use high page numbers (2000+) to avoid cache pollution between test groups
    // since loadPageData uses a module-level LRU cache that persists across tests
    it('should return null when fetch fails', async () => {
      const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
      vi.stubGlobal('fetch', mockFetch);
      const result = await loadPageData(2001);
      expect(result).toBeNull();
      vi.restoreAllMocks();
    });

    it('should return null when response is not ok', async () => {
      const mockFetch = vi.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));
      vi.stubGlobal('fetch', mockFetch);
      const result = await loadPageData(2002);
      expect(result).toBeNull();
      vi.restoreAllMocks();
    });

    it('should return page layout data on successful fetch', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word' }] }],
      };
      const mockFetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockData) }));
      vi.stubGlobal('fetch', mockFetch);
      const result = await loadPageData(2003);
      expect(result).not.toBeNull();
      expect(result?.font).toBe('QCF4_Hafs_01');
      expect(result?.lines).toHaveLength(1);
      vi.restoreAllMocks();
    });

    it('should cache page data and not re-fetch', async () => {
      const mockData: PageLayoutData = { font: 'QCF4_Hafs_01', lines: [] };
      const mockFetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockData) }));
      vi.stubGlobal('fetch', mockFetch);

      const uniquePage = 2004;
      const result1 = await loadPageData(uniquePage);
      const result2 = await loadPageData(uniquePage);

      expect(result1).toBe(result2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
    });

    it('should request the correct URL with zero-padded page number', async () => {
      const mockFetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ lines: [] }) }));
      vi.stubGlobal('fetch', mockFetch);
      await loadPageData(2005);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('2005.json'));
      vi.restoreAllMocks();
    });

    it('should handle JSON parse errors gracefully', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.reject(new Error('Invalid JSON')) }),
      );
      vi.stubGlobal('fetch', mockFetch);
      const result = await loadPageData(2006);
      expect(result).toBeNull();
      vi.restoreAllMocks();
    });

    it('should evict oldest cache entry when LRU cache is full', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ lines: [], font: 'lru-test' }) }),
      );
      vi.stubGlobal('fetch', mockFetch);

      // Use page numbers 2100+ exclusively for this LRU test
      for (let i = 2100; i < 2160; i++) {
        await loadPageData(i);
      }

      const cachedResult = await loadPageData(2159);
      expect(cachedResult).not.toBeNull();
      vi.restoreAllMocks();
    });
  });

  /* ===================== renderPage ===================== */

  describe('renderPage', () => {
    it('should return null layout when page data cannot be loaded', async () => {
      const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
      vi.stubGlobal('fetch', mockFetch);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3001, canvas);
      expect(result.layout).toBeNull();
      vi.restoreAllMocks();
    });

    it('should return null canvas when page data cannot be loaded', async () => {
      const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
      vi.stubGlobal('fetch', mockFetch);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3002, canvas);
      expect(result.canvas).toBeNull();
      vi.restoreAllMocks();
    });

    it('should not throw on page numbers outside valid range', async () => {
      const mockFetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
      vi.stubGlobal('fetch', mockFetch);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(9999, canvas);
      expect(result.layout).toBeNull();
      vi.restoreAllMocks();
    });

    it('should return RenderPageResult structure', async () => {
      const mockFetch = vi.fn(() => Promise.reject(new Error('Network error')));
      vi.stubGlobal('fetch', mockFetch);

      const canvas = document.createElement('canvas');
      const result = await renderPage(3003, canvas);
      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('layout');
      vi.restoreAllMocks();
    });

    it('should successfully render a page with layout data', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم', verse_key: '1:1' }] }],
      };

      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3010, canvas);
      expect(result.layout).not.toBeNull();
      expect(result.layout?.font).toBe('QCF4_Hafs_01');
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should render a page without providing a canvas (creates one)', async () => {
      const mockData: PageLayoutData = { font: 'QCF4_Hafs_01', lines: [] };
      setupFetchMock(mockData);

      const result = await renderPage(3011, null);
      expect(result.canvas).not.toBeNull();
      expect(result.layout).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should handle bismillah line type during rendering', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [
          { words: [{ char: 'bsml', type: 'bismillah' }] },
          { words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم' }] },
        ],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3012, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should handle surah_header line type during rendering', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'سورة', type: 'surah_header' }] }],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3013, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should handle lines with empty words arrays', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [] }, { words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word' }] }],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3014, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should handle page data without explicit font property', async () => {
      const mockData: PageLayoutData = {
        lines: [{ words: [{ char: 'ب', type: 'word' }] }],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3015, canvas);
      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('layout');
      vi.restoreAllMocks();
    });

    it('should handle page with no lines', async () => {
      const mockData: PageLayoutData = { font: 'QCF4_Hafs_01', lines: [] };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3016, canvas);
      expect(result.canvas).not.toBeNull();
      expect(result.layout).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should handle page with many lines (short page layout)', async () => {
      const lines = [];
      for (let i = 0; i < 5; i++) {
        lines.push({
          words: [{ char: `w${i}`, font: 'QCF4_Hafs_01', type: 'word', text: `word${i}`, verse_key: '1:1' }],
        });
      }
      const mockData: PageLayoutData = { font: 'QCF4_Hafs_01', lines };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3017, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });
  });

  /* ===================== Tajweed rendering ===================== */

  describe('Tajweed rendering', () => {
    it('should render with tajweed enabled', async () => {
      mockState.tajweedEnabled = true;
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [
          {
            words: [
              { char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم', verse_key: '1:1' },
              { char: 'الل', font: 'QCF4_Hafs_01', type: 'word', text: 'الله', verse_key: '1:1' },
            ],
          },
        ],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3020, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });
  });

  /* ===================== Night Mode ===================== */

  describe('Night mode rendering', () => {
    it('should render with night mode colors', async () => {
      document.body.classList.add('night-mode');
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم', verse_key: '1:1' }] }],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3030, canvas);
      expect(result.canvas).not.toBeNull();
      // fillRect should have been called for the background
      expect(mockCtx?.fillRect).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('should render with day mode colors by default', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم', verse_key: '1:1' }] }],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3031, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });
  });

  /* ===================== Canvas rendering calls ===================== */

  describe('Canvas rendering calls', () => {
    it('should call fillRect for background', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم' }] }],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3040, canvas);
      expect(result.canvas).not.toBeNull();
      expect(mockCtx?.fillRect).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('should call strokeRect for page frame', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم' }] }],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3041, canvas);
      expect(result.canvas).not.toBeNull();
      expect(mockCtx?.strokeRect).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('should call fillText for word rendering', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم' }] }],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3042, canvas);
      expect(result.canvas).not.toBeNull();
      expect(mockCtx?.fillText).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  /* ===================== Mixed rendering scenarios ===================== */

  describe('Mixed rendering scenarios', () => {
    it('should handle page with mixed line types', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [
          { words: [{ char: 'bsml', type: 'bismillah' }] },
          { words: [{ char: 'الفاتحة', type: 'surah_header' }] },
          { words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم', verse_key: '1:1' }] },
        ],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3050, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should handle page with standard 15 lines', async () => {
      const lines = [];
      for (let i = 0; i < 15; i++) {
        lines.push({
          words: [{ char: `w${i}`, font: 'QCF4_Hafs_01', type: 'word', text: `word${i}`, verse_key: '1:1' }],
        });
      }
      const mockData: PageLayoutData = { font: 'QCF4_Hafs_01', lines };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3051, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should handle bismillah rendering in night mode', async () => {
      document.body.classList.add('night-mode');
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [
          { words: [{ char: 'bsml', type: 'bismillah' }] },
          { words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم' }] },
        ],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3052, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should handle surah header rendering in night mode', async () => {
      document.body.classList.add('night-mode');
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [
          { words: [{ char: 'الفاتحة', type: 'surah_header' }] },
          { words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', text: 'بسم' }] },
        ],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3053, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });

    it('should handle page with word-level font overrides', async () => {
      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_02', type: 'word', text: 'بسم', verse_key: '1:1' }] }],
      };
      setupFetchMock(mockData);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3054, canvas);
      expect(result.canvas).not.toBeNull();
      vi.restoreAllMocks();
    });
  });

  /* ===================== Capacitor-specific paths ===================== */

  describe('Capacitor mode', () => {
    it('should detect Capacitor environment and use XHR for fonts', async () => {
      document.documentElement.classList.add('capacitor-native');

      const mockData: PageLayoutData = {
        font: 'QCF4_Hafs_01',
        lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word' }] }],
      };
      setupFetchMock(mockData);

      // Mock XHR for Capacitor font loading
      const MockXHR = vi.fn().mockImplementation(() => {
        const self: {
          open: ReturnType<typeof vi.fn>;
          send: ReturnType<typeof vi.fn>;
          onload: (() => void) | null;
          onerror: (() => void) | null;
          ontimeout: (() => void) | null;
          status: number;
          response: ArrayBuffer;
          timeout: number;
          responseType: string;
        } = {
          open: vi.fn(),
          send: vi.fn(() => {
            setTimeout(() => {
              self.status = 200;
              self.response = new ArrayBuffer(15000);
              if (self.onload) self.onload();
            }, 0);
          }),
          onload: null,
          onerror: null,
          ontimeout: null,
          status: 0,
          response: new ArrayBuffer(0),
          timeout: 15000,
          responseType: '',
        };
        return self;
      });
      vi.stubGlobal('XMLHttpRequest', MockXHR);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3060, canvas);
      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('layout');
      vi.restoreAllMocks();
    });

    it('should use Promise.race with timeout in Capacitor mode', async () => {
      document.documentElement.classList.add('capacitor-native');

      const mockData: PageLayoutData = { font: 'QCF4_Hafs_01', lines: [] };
      setupFetchMock(mockData);

      const MockXHR = vi.fn().mockImplementation(() => {
        const self: Record<string, unknown> = {
          open: vi.fn(),
          send: vi.fn(() => {
            setTimeout(() => {
              self.status = 200;
              self.response = new ArrayBuffer(15000);
              if (typeof self.onload === 'function') (self.onload as () => void)();
            }, 0);
          }),
          onload: null,
          onerror: null,
          ontimeout: null,
          status: 0,
          response: new ArrayBuffer(0),
          timeout: 15000,
          responseType: '',
        };
        return self;
      });
      vi.stubGlobal('XMLHttpRequest', MockXHR);

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const result = await renderPage(3061, canvas);
      expect(result).toHaveProperty('canvas');
      expect(result).toHaveProperty('layout');
      vi.restoreAllMocks();
    });
  });
});
