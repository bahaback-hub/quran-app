/**
 * Tests that the mushaf renderer chooses the most salient tajweed rule per word
 * (instead of the first one), so its coloring matches the per-letter coloring
 * shown in the surah reading view as closely as a single-glyph canvas allows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.unmock('../mushaf-renderer.js');
vi.unmock('../tajweed.js');

const { mockState } = vi.hoisted(() => ({
  mockState: { tajweedEnabled: true, fontSize: 100 },
}));

vi.mock('../state.js', () => ({ state: mockState }));

// Minimal tajweed-data stub: one ayah with two rules on the same word.
vi.mock('../tajweed-data.js', () => ({
  getAyahAnnotations: vi.fn(() => [
    // silent (low priority) on the first letter, madd_6 (high priority) on the rest
    { rule: 'silent', start: 0, end: 1 },
    { rule: 'madd_6', start: 1, end: 4 },
  ]),
}));

vi.mock('../types.js', () => ({ isCapacitorNative: vi.fn(() => false) }));
vi.mock('../storage.js', () => ({
  storage: { get: vi.fn(() => null), set: vi.fn(), remove: vi.fn() },
}));

import { pickTajweedRule } from '../tajweed.js';
import { renderPage } from '../mushaf-renderer.js';

describe('pickTajweedRule priority', () => {
  it('chooses the highest-priority rule from a mixed set', () => {
    expect(pickTajweedRule(['silent', 'madd_6'])).toBe('madd_6');
  });

  it('prefers a long madd over a ghunnah-family rule', () => {
    expect(pickTajweedRule(['ghunnah', 'madd_246'])).toBe('madd_246');
  });

  it('returns undefined for an empty set', () => {
    expect(pickTajweedRule([])).toBeUndefined();
  });

  it('returns the only rule when just one is present', () => {
    expect(pickTajweedRule(['qalqalah'])).toBe('qalqalah');
  });
});

/* ===================== MUSHAF RENDER COLOR TEST ===================== */

let mockCtx: { fillStyle: string; [k: string]: unknown } | null = null;
const capturedColors: string[] = [];

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
      const data = new Uint8ClampedArray(4 * 80 * 80);
      data[0] = 0;
      data[1] = 0;
      data[2] = 0;
      data[3] = 255;
      return { data };
    }),
  };
}

beforeEach(() => {
  mockCtx = createMockCtx();
  capturedColors.length = 0;
  // Intercept fillStyle assignments to record tajweed colors.
  Object.defineProperty(mockCtx, 'fillStyle', {
    get() {
      return (mockCtx as { _v?: string })._v ?? '';
    },
    set(v: string) {
      (mockCtx as { _v?: string })._v = v;
      capturedColors.push(v);
    },
    configurable: true,
  });

  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement, contextId: string) {
    if (contextId === '2d') return mockCtx;
    return originalGetContext.call(this, contextId);
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        font: 'QCF4_Hafs_01',
        lines: [
          {
            words: [
              {
                char: 'بسم',
                text: 'بسم',
                font: 'QCF4_Hafs_01',
                type: 'word',
                verse_key: '1:1',
                location: '1:1:1',
              },
            ],
          },
        ],
      }),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mushaf per-word tajweed coloring', () => {
  it('paints a two-rule word with the higher-priority rule color, not the first', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1540;

    await renderPage(1, canvas);

    // madd_6 → #b50000 (day). silent → #a5a5a5. The word must use madd_6's color.
    expect(capturedColors).toContain('#b50000');
    expect(capturedColors).not.toContain('#a5a5a5');
  });
});
