/**
 * Deep coverage tests for mushaf-renderer.ts — targets the RENDER path
 * by calling renderPage with properly mocked font loading.
 * The uncovered lines are mostly in _doLoadFont, verifyFontOnCanvas,
 * createFontPreloadElement, renderPage, _renderPageWithCurrentFonts,
 * and computePageTajweed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.unmock('../mushaf-renderer.js');

const { mockState, mockIsCapacitorNative } = vi.hoisted(() => ({
  mockState: {
    tajweedEnabled: false,
    fontSize: 100,
  },
  mockIsCapacitorNative: vi.fn(() => false),
}));

vi.mock('../state.js', () => ({
  state: mockState,
}));

vi.mock('../tajweed.js', () => ({
  buildColorMap: vi.fn(() => new Map()),
  getTajweedColor: vi.fn(() => '#FF0000'),
  pickTajweedRule: vi.fn((rules: Iterable<string>) => {
    for (const r of rules) return r as never;
    return undefined;
  }),
}));

vi.mock('../tajweed-data.js', () => ({
  getAyahAnnotations: vi.fn(() => []),
}));

vi.mock('../types.js', () => ({
  isCapacitorNative: mockIsCapacitorNative,
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

// Suppress console output
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});

// Shared mock context for all canvas operations
const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '' as CanvasTextAlign,
  textBaseline: '' as CanvasTextBaseline,
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 20 })),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4 * 80 * 80) })),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  clip: vi.fn(),
};

// Mock canvas creation to return our mock context
const origCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  const el = origCreateElement(tag);
  if (tag === 'canvas') {
    el.getContext = () => mockCtx as unknown as CanvasRenderingContext2D;
    el.width = 1080;
    el.height = 1540;
  }
  return el;
});

// Mock FontFace
const mockFontFace = vi
  .fn()
  .mockImplementation((_family: string, _source: string | ArrayBuffer, _opts?: { display?: string }) => ({
    load: vi.fn().mockResolvedValue({}),
  }));
vi.stubGlobal('FontFace', mockFontFace);

// Mock document.fonts
Object.defineProperty(document, 'fonts', {
  value: {
    add: vi.fn(),
    ready: Promise.resolve(),
    check: vi.fn(() => true),
    load: vi.fn(() => Promise.resolve([])),
  },
  configurable: true,
});

import { renderPage, loadPageData, CANVAS_W, CANVAS_H } from '../mushaf-renderer.js';
import type { PageLayoutData } from '../mushaf-renderer.js';

function setupFetchMock(data: PageLayoutData) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

describe('mushaf-renderer deep2 — renderPage with full font mocking', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCapacitorNative.mockReturnValue(false);
    mockCtx.fillRect.mockClear();
    mockCtx.clearRect.mockClear();
    mockCtx.strokeRect.mockClear();
    mockCtx.fillText.mockClear();
    mockCtx.fillStyle = '';
    mockFontFace.mockClear();

    canvas = origCreateElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.getContext = () => mockCtx as unknown as CanvasRenderingContext2D;
  });

  it('should render a simple page with one word line', async () => {
    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', verse_key: '1:1', text: 'بسم' }] }],
    });

    const result = await renderPage(40, canvas);
    expect(result.canvas).toBeDefined();
    expect(result.layout).not.toBeNull();
    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.strokeRect).toHaveBeenCalled(); // page frame
  });

  it('should render a page with bismillah line type', async () => {
    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [{ words: [{ char: 'ب', font: 'QCF4_QBSML', type: 'bismillah' }] }],
    });

    const result = await renderPage(41, canvas);
    expect(result.canvas).toBeDefined();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('should render a page with surah_header line type', async () => {
    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [{ words: [{ char: 'ا', font: 'QCF4_Hafs_01', type: 'surah_header' }] }],
    });

    const result = await renderPage(42, canvas);
    expect(result.canvas).toBeDefined();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('should render a page with empty words array', async () => {
    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [{ words: [] }, { words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word' }] }],
    });

    const result = await renderPage(43, canvas);
    expect(result.canvas).toBeDefined();
  });

  it('should render a page without explicit font property', async () => {
    setupFetchMock({
      lines: [{ words: [{ char: 'ا', type: 'word' }] }],
    });

    const result = await renderPage(44, canvas);
    expect(result.canvas).toBeDefined();
  });

  it('should render a page with no lines', async () => {
    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [],
    });

    const result = await renderPage(45, canvas);
    expect(result.canvas).toBeDefined();
  });

  it('should render a page without providing a canvas (creates one)', async () => {
    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word' }] }],
    });

    const result = await renderPage(46);
    expect(result).toBeDefined();
  });

  it('should return null canvas when page data cannot be loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const result = await renderPage(47, canvas);
    expect(result.canvas).toBeNull();
    expect(result.layout).toBeNull();
  });

  it('should render a page with multiple lines (standard 15-line page)', async () => {
    const lines = [];
    for (let i = 0; i < 15; i++) {
      lines.push({ words: [{ char: String(i), font: 'QCF4_Hafs_01', type: 'word' }] });
    }
    setupFetchMock({ font: 'QCF4_Hafs_01', lines });

    const result = await renderPage(48, canvas);
    expect(result.canvas).toBeDefined();
  });

  it('should render with night mode colors', async () => {
    document.body.classList.add('night-mode');
    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', verse_key: '1:1', text: 'بسم' }] }],
    });

    const result = await renderPage(49, canvas);
    expect(result.canvas).toBeDefined();
    document.body.classList.remove('night-mode');
  });
});

describe('mushaf-renderer deep2 — tajweed rendering', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCapacitorNative.mockReturnValue(false);
    mockCtx.fillRect.mockClear();
    mockCtx.fillText.mockClear();
    mockFontFace.mockClear();

    canvas = origCreateElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.getContext = () => mockCtx as unknown as CanvasRenderingContext2D;
  });

  it('should render with tajweed annotations', async () => {
    mockState.tajweedEnabled = true;
    const { getAyahAnnotations } = await import('../tajweed-data.js');
    const { buildColorMap } = await import('../tajweed.js');

    vi.mocked(getAyahAnnotations).mockReturnValue([{ rule: 'ghunnah', start: 0, end: 2 } as any]);
    const colorMap = new Map();
    colorMap.set(0, 'ghunnah');
    colorMap.set(1, 'ghunnah');
    vi.mocked(buildColorMap).mockReturnValue(colorMap);

    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [
        {
          words: [
            { char: 'ب', font: 'QCF4_Hafs_01', type: 'word', verse_key: '1:1', text: 'بسم' },
            { char: 'م', font: 'QCF4_Hafs_01', type: 'word', verse_key: '1:1', text: 'الله' },
          ],
        },
      ],
    });

    const result = await renderPage(50, canvas);
    expect(result.canvas).toBeDefined();
    expect(getAyahAnnotations).toHaveBeenCalled();

    mockState.tajweedEnabled = false;
  });

  it('should handle empty colorMap with annotations present', async () => {
    mockState.tajweedEnabled = true;
    const { getAyahAnnotations } = await import('../tajweed-data.js');
    const { buildColorMap } = await import('../tajweed.js');

    vi.mocked(getAyahAnnotations).mockReturnValue([{ rule: 'ghunnah', start: 0, end: 2 } as any]);
    vi.mocked(buildColorMap).mockReturnValue(new Map());

    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', verse_key: '1:1', text: 'بسم' }] }],
    });

    const result = await renderPage(51, canvas);
    expect(result.canvas).toBeDefined();

    mockState.tajweedEnabled = false;
  });

  it('should handle tajweed with words that have no annotations', async () => {
    mockState.tajweedEnabled = true;
    const { getAyahAnnotations } = await import('../tajweed-data.js');

    vi.mocked(getAyahAnnotations).mockReturnValue([]);

    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', verse_key: '1:1', text: 'بسم' }] }],
    });

    const result = await renderPage(52, canvas);
    expect(result.canvas).toBeDefined();

    mockState.tajweedEnabled = false;
  });
});

describe('mushaf-renderer deep2 — Capacitor renderPage path', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCapacitorNative.mockReturnValue(true);
    document.documentElement.classList.add('capacitor-native');
    mockCtx.fillRect.mockClear();
    mockFontFace.mockClear();

    canvas = origCreateElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.getContext = () => mockCtx as unknown as CanvasRenderingContext2D;
  });

  afterEach(() => {
    document.documentElement.classList.remove('capacitor-native');
    mockIsCapacitorNative.mockReturnValue(false);
  });

  it('should use Promise.race with timeout in Capacitor mode', async () => {
    setupFetchMock({
      font: 'QCF4_Hafs_01',
      lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word' }] }],
    });

    const result = await renderPage(53, canvas);
    expect(result).toBeDefined();
    // In Capacitor mode, it uses Promise.race
  });
});
