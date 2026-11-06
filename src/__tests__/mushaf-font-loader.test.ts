/**
 * Behavioral tests for mushaf-font-loader.ts — QCF4 font acquisition:
 * strategy escalation (Capacitor XHR → FontFace URL → static @font-face
 * sheet), canvas pixel verification, Capacitor trust fallbacks, and
 * load deduplication/caching.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const { mockIsCapacitorNative } = vi.hoisted(() => ({
  mockIsCapacitorNative: vi.fn((): boolean => false),
}));

vi.mock('../types.js', () => ({
  isCapacitorNative: mockIsCapacitorNative,
}));

// The loader logs every escalation step; silence it to keep output readable.
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

/* ------------------------------------------------------------------ */
/* Shared fake world: FontFace, document.fonts, XHR, canvas 2d         */
/* ------------------------------------------------------------------ */

interface FontFaceInstance {
  family: string;
  source: unknown;
  load: Mock;
}

const fontFaces: FontFaceInstance[] = [];
let fontFaceLoadImpl: (ff: FontFaceInstance) => Promise<unknown> = (ff) => Promise.resolve(ff);

const FontFaceCtor = vi.fn(function FontFaceCtor(this: unknown, family: string, source: string | ArrayBuffer) {
  const ff: FontFaceInstance = {
    family,
    source,
    load: vi.fn((): Promise<unknown> => fontFaceLoadImpl(ff)),
  };
  fontFaces.push(ff);
  return ff;
});
vi.stubGlobal('FontFace', FontFaceCtor);

const fontsMock = {
  add: vi.fn(),
  check: vi.fn((): boolean => true),
  load: vi.fn((): Promise<unknown[]> => Promise.resolve([])),
  ready: Promise.resolve(),
};
function defineDocumentFonts(): void {
  Object.defineProperty(document, 'fonts', { configurable: true, value: fontsMock });
}
Object.defineProperty(document, 'fonts', { configurable: true, value: fontsMock });

type XhrMode = 'ok' | 'network-error' | 'http-error';
let xhrMode: XhrMode = 'ok';
let xhrBuffer: ArrayBuffer = new ArrayBuffer(0);
const xhrStats = { openedUrl: '', sendCalls: 0 };

class MockXmlHttpRequest {
  status = 0;
  response: unknown = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  timeout = 0;

  open(_method: string, url: string): void {
    xhrStats.openedUrl = url;
  }

  send(): void {
    xhrStats.sendCalls++;
    if (xhrMode === 'network-error') {
      this.onerror?.();
      return;
    }
    this.status = xhrMode === 'http-error' ? 500 : 200;
    this.response = xhrBuffer;
    this.onload?.();
  }
}
vi.stubGlobal('XMLHttpRequest', MockXmlHttpRequest);

// Canvas probe data: dark pixel ⇒ font rendered ⇒ verifyFontOnCanvas true.
const probeWidth = 80;
const probeHeight = 80;
const whiteData = new Uint8ClampedArray(4 * probeWidth * probeHeight).fill(255);
const darkData = whiteData.slice();
darkData[4] = 0;
darkData[5] = 0;
darkData[6] = 0;

let probeDark = true;

const canvasCtxMock = {
  fillStyle: '',
  font: '',
  textAlign: '' as CanvasTextAlign,
  textBaseline: '' as CanvasTextBaseline,
  fillRect: vi.fn(),
  fillText: vi.fn(),
  getImageData: vi.fn(() => ({ data: probeDark ? darkData : whiteData })),
};
let canvasCtx: unknown = canvasCtxMock;

const origCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  const el = origCreateElement(tag);
  if (tag === 'canvas') {
    (el as HTMLCanvasElement).getContext = (() => canvasCtx) as unknown as HTMLCanvasElement['getContext'];
  }
  return el;
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return await p;
}

function setCapacitorMode(on: boolean): void {
  document.documentElement.classList.toggle('capacitor-native', on);
}

import { ensureFontLoaded, ensureVerifiedFont, isCapacitor } from '../features/mushaf/mushaf-font-loader.js';

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('mushaf-font-loader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockIsCapacitorNative.mockReturnValue(false);

    fontFaces.length = 0;
    fontFaceLoadImpl = (ff) => Promise.resolve(ff);
    FontFaceCtor.mockClear();

    fontsMock.add.mockClear();
    fontsMock.check.mockClear().mockReturnValue(true);
    fontsMock.load.mockClear().mockResolvedValue([]);
    fontsMock.ready = Promise.resolve();

    xhrMode = 'ok';
    xhrBuffer = new ArrayBuffer(20000);
    xhrStats.openedUrl = '';
    xhrStats.sendCalls = 0;

    probeDark = true;
    canvasCtx = canvasCtxMock;
    canvasCtxMock.getImageData.mockClear().mockImplementation(() => ({ data: probeDark ? darkData : whiteData }));

    defineDocumentFonts();
  });

  afterEach(() => {
    document.documentElement.classList.remove('capacitor-native');
    document.getElementById('qcf-font-face-sheet')?.remove();
    for (const el of document.querySelectorAll('[id^="qcf-preload-"]')) {
      el.remove();
    }
    vi.useRealTimers();
  });

  it('loads a font in the browser via FontFace URL and caches it for reuse', async () => {
    setCapacitorMode(false);

    await settle(ensureFontLoaded('QCF4_Hafs_12'));
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);
    expect(fontFaces[0]).toBeDefined();
    expect(String(fontFaces[0]!.source)).toContain('/fonts/qcf4/QCF4_Hafs_12_W.woff2');
    expect(fontsMock.add).toHaveBeenCalledTimes(1);

    // The hidden preload element the strategy injects into the DOM.
    const span = document.getElementById('qcf-preload-QCF4_Hafs_12');
    expect(span).not.toBeNull();
    expect(span?.getAttribute('aria-hidden')).toBe('true');
    expect(span?.textContent).toContain('\uF100');

    // Second call is served from the loaded-font cache: no new FontFace.
    await ensureFontLoaded('QCF4_Hafs_12');
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent loads of the same font', async () => {
    const p1 = ensureFontLoaded('QCF4_Hafs_33');
    const p2 = ensureFontLoaded('QCF4_Hafs_33');
    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);
    expect(fontsMock.add).toHaveBeenCalledTimes(1);
  });

  it('falls back to the static @font-face sheet when FontFace URL fails', async () => {
    fontFaceLoadImpl = () => Promise.reject(new Error('font download failed'));

    await settle(ensureFontLoaded('QCF4_Hafs_44'));

    const link = document.getElementById('qcf-font-face-sheet');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/fonts/qcf4/qcf4-font-face.css');
    expect(link?.getAttribute('rel')).toBe('stylesheet');

    // One failed FontFace URL attempt escalated to strategy 3; the sheet
    // succeeded immediately, so only one FontFace was ever constructed.
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);

    const span = document.getElementById('qcf-preload-QCF4_Hafs_44');
    expect(span).not.toBeNull();
  });

  it('retries three times and reports failure without caching the font', async () => {
    fontFaceLoadImpl = () => Promise.reject(new Error('font download failed'));
    probeDark = false; // sheet strategy can't verify either

    await settle(ensureFontLoaded('QCF4_Hafs_55'));
    expect(FontFaceCtor).toHaveBeenCalledTimes(3);

    // A failed load is not cached: the next call re-runs all 3 attempts.
    await settle(ensureFontLoaded('QCF4_Hafs_55'));
    expect(FontFaceCtor).toHaveBeenCalledTimes(6);
  });

  it('re-runs the whole load when ensureVerifiedFont sees a failed canvas probe', async () => {
    setCapacitorMode(false);
    await settle(ensureFontLoaded('QCF4_Hafs_77'));
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);

    // Font got evicted / never painted: probe now reads blank pixels.
    // ensureVerifiedFont re-runs the FULL load — 3 retried attempts since
    // verification keeps failing (1 fresh FontFace per attempt).
    probeDark = false;
    await settle(ensureVerifiedFont('QCF4_Hafs_77'));
    expect(FontFaceCtor).toHaveBeenCalledTimes(4);
  });

  it('skips a reload when the canvas probe still verifies the font', async () => {
    setCapacitorMode(false);
    await settle(ensureFontLoaded('QCF4_Hafs_88'));
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);

    // Font is loaded and the probe passes: nothing should happen at all.
    await ensureVerifiedFont('QCF4_Hafs_88');
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);
  });

  it('loads via XHR ArrayBuffer in Capacitor (strategy 1) and caches it', async () => {
    setCapacitorMode(true);

    await settle(ensureFontLoaded('QCF4_Hafs_01'));

    expect(xhrStats.sendCalls).toBe(1);
    expect(xhrStats.openedUrl).toContain('/fonts/qcf4/QCF4_Hafs_01_W.woff2');

    // Binary path: the FontFace received the downloaded ArrayBuffer itself.
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);
    expect(fontFaces[0]!.source).toBe(xhrBuffer);
    expect(fontsMock.add).toHaveBeenCalledTimes(1);
    expect(document.getElementById('qcf-preload-QCF4_Hafs_01')).not.toBeNull();

    // Cached afterwards: no second XHR.
    await ensureFontLoaded('QCF4_Hafs_01');
    expect(xhrStats.sendCalls).toBe(1);
  });

  it('rejects corrupt small buffers and escalates to the FontFace URL strategy', async () => {
    setCapacitorMode(true);
    xhrBuffer = new ArrayBuffer(100); // < 10KB ⇒ "likely corrupted"

    await settle(ensureFontLoaded('QCF4_Hafs_02'));

    expect(xhrStats.sendCalls).toBe(1);

    // Strategy 2 (URL source) succeeded after the ArrayBuffer was rejected.
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);
    expect(String(fontFaces[0]!.source)).toContain('url(');
  });

  it('trusts document.fonts in Capacitor even when verification fails', async () => {
    setCapacitorMode(true);
    fontsMock.check.mockReturnValue(false);

    await settle(ensureFontLoaded('QCF4_Hafs_03'));

    // Capacitor mode deliberately proceeds despite the failed check.
    expect(FontFaceCtor).toHaveBeenCalledTimes(1);
    expect(fontsMock.check).toHaveBeenCalledWith('40px "QCF4_Hafs_03"');
  });

  it('survives a total Capacitor failure by proceeding through the static sheet', async () => {
    setCapacitorMode(true);
    xhrMode = 'network-error';
    fontFaceLoadImpl = () => Promise.reject(new Error('no font network'));
    fontsMock.check.mockImplementation(() => {
      throw new Error('fonts API unavailable'); // verify catch → false
    });

    // Attempt 1: XHR network error (strategy 1 catch), FontFace load rejects
    // (strategy 2 catch), strategy 3 then trusts the Capacitor runtime and
    // returns success — Capacitor never reaches attempt 2.
    await settle(ensureFontLoaded('QCF4_Hafs_04'));

    expect(FontFaceCtor).toHaveBeenCalledTimes(1);
    expect(xhrStats.sendCalls).toBe(1);
    expect(document.getElementById('qcf-font-face-sheet')).not.toBeNull();

    const span = document.getElementById('qcf-preload-QCF4_Hafs_04');
    expect(span).not.toBeNull();
  });

  it('re-detects the Capacitor runtime class added after module load', () => {
    expect(isCapacitor()).toBe(false);
    setCapacitorMode(true);
    expect(isCapacitor()).toBe(true);
    setCapacitorMode(false);
    expect(isCapacitor()).toBe(false);
  });
});
