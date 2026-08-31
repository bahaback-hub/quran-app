/**
 * Mushaf page renderer using locally hosted QCF4 fonts from King Fahd Complex.
 * Renders exact Madinah Mushaf calligraphy on Canvas.
 *
 * Data source: https://github.com/MohamadHajjRabee/quran-qcf4
 *
 * CRITICAL for Android/Capacitor:
 * - CapacitorHttp plugin intercepts fetch() and CORRUPTS binary data (woff2 fonts).
 *   We disable CapacitorHttp and use native fetch() / XMLHttpRequest instead.
 * - Canvas pixel verification is unreliable in Android WebView;
 *   we use document.fonts API for verification.
 * - A re-render is scheduled 2.5s after first render to handle WebView
 *   font processing delays.
 */
import { state } from './state.js';
import { buildColorMap, getTajweedColor, pickTajweedRule } from './tajweed.js';
import { getAyahAnnotations } from './tajweed-data.js';
import type { TajweedAnnotation } from './tajweed-data.js';
import { isCapacitorNative } from './types.js';
import { getMushafPageLayout } from './mushaf-data-pack.js';
import { qcf4FontUrl } from './qcf4-font-pack.js';

/* ===================== INTERFACES ===================== */

/** A single word in a mushaf page line. */
export interface PageWord {
  char: string;
  font?: string;
  type?: string;
  verse_key?: string;
  location?: string;
  word?: string;
  text?: string;
}

/** A single line in a mushaf page layout. */
export interface PageLine {
  words: PageWord[];
}

/** Full layout data for a mushaf page (from QCF4 JSON). */
export interface PageLayoutData {
  font?: string;
  lines: PageLine[];
}

/** Result of rendering a mushaf page. */
export interface RenderPageResult {
  canvas: HTMLCanvasElement | null;
  layout: PageLayoutData | null;
}

/** Color set used for rendering mushaf pages. */
interface PageColors {
  bg: string;
  txt: string;
  frame: string;
  frameInner: string;
}

/** Measured widths for a single line's words. */
interface LineWidths {
  widths: number[];
  gap: number;
}

/* ===================== CONSTANTS ===================== */

const PAGE_BASE = 'https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main/pages/';
const BSML_FONT = 'QCF4_QBSML';

// Canvas dimensions — scaled based on device capabilities to reduce memory usage
// Full HD (1080×1540) uses 6.6MB per canvas — too much for low-end mobile
// We scale down on mobile devices to save memory while keeping quality acceptable
const MOBILE_CANVAS_W = 720;
const MOBILE_CANVAS_H = 1028; // Maintains 7:10 aspect ratio
const DESKTOP_CANVAS_W = 1080;
const DESKTOP_CANVAS_H = 1540;

/** Detect if device is mobile (low memory) */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    window.innerWidth <= 600 ||
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth <= 900)
  );
}

/** Get optimal canvas dimensions based on device */
function getCanvasDimensions(): { width: number; height: number } {
  return isMobileDevice()
    ? { width: MOBILE_CANVAS_W, height: MOBILE_CANVAS_H }
    : { width: DESKTOP_CANVAS_W, height: DESKTOP_CANVAS_H };
}

export const CANVAS_W = getCanvasDimensions().width;
export const CANVAS_H = getCanvasDimensions().height;
export const PAD_H = 30;
export const PAD_V = 30;
export const TOP_OFFSET = 30;
export const BOTTOM_OFFSET = 50;

/** Canvas pool — reuse canvases to avoid GC pressure and memory allocation.
 * On mobile, keep pool size small (1) to save memory.
 * On desktop, keep 3 for smoother page navigation. */
const MAX_POOL_SIZE = isMobileDevice() ? 1 : 3;
const canvasPool: HTMLCanvasElement[] = [];

/** Get a canvas from pool or create new one (sized to CANVAS_W × CANVAS_H). */
export function getCanvas(): HTMLCanvasElement {
  const cached = canvasPool.pop();
  if (cached) {
    return cached;
  }
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  return canvas;
}

/** Release canvas back to pool for reuse */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  if (canvasPool.length < MAX_POOL_SIZE) {
    // Clear the canvas before returning to pool
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    canvasPool.push(canvas);
  }
  // If pool is full, let GC handle it
}

/** Clear all canvases from pool (memory cleanup) */
export function clearCanvasPool(): void {
  canvasPool.length = 0;
}
export const STD_LINES = 15;

/** The Fatiha page and opening of Al-Baqarah use the compact Madinah Mushaf text block. */
const OPENING_PAGE_TEXT_SCALE = 0.82;
const OPENING_PAGE_WORD_GAP_SCALE = 0.2;

const LAYOUT_CACHE_MAX = 50; // LRU cache limit to prevent unbounded memory growth
const layoutCache = new Map<string, PageLayoutData>();

/** Tracks fonts that have been verified as loaded and usable on Canvas. */
const loadedFonts = new Set<string>();

/** Tracks fonts currently being loaded (prevents duplicate loads). */
const loadingFonts = new Map<string, Promise<boolean>>();

/** Detect if running in Capacitor/Android WebView environment. */
function isCapacitorEnv(): boolean {
  try {
    return !!(
      isCapacitorNative() ||
      (typeof navigator !== 'undefined' && /wv|Android.*Capacitor/i.test(navigator.userAgent)) ||
      (typeof document !== 'undefined' && document.documentElement.classList.contains('capacitor-native'))
    );
  } catch {
    return false;
  }
}

const _isCapacitor = isCapacitorEnv();

/** Double-check Capacitor status at runtime (class might be added after module load). */
function isCapacitor(): boolean {
  if (_isCapacitor) {
    return true;
  }
  // Re-check in case capacitor-native class was added after module load
  try {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('capacitor-native');
  } catch {
    return false;
  }
}

/* ===================== HELPERS ===================== */

function getPageFont(pageNum: number, fontMap: Record<string, string> | null | undefined): string {
  return fontMap?.[String(pageNum)] || `QCF4_Hafs_${String(Math.min(47, Math.ceil(pageNum / 13))).padStart(2, '0')}`;
}

export async function loadPageData(pageNum: number): Promise<PageLayoutData | null> {
  const key = `qcf4-${pageNum}`;
  if (layoutCache.has(key)) {
    return layoutCache.get(key)!;
  }
  const padded = String(pageNum).padStart(3, '0');
  try {
    // A verified, user-installed data pack has priority and supports offline
    // page rendering. The remote fixed source remains the fallback until the
    // optional MIT-licensed layout data pack is installed.
    const installedData = await getMushafPageLayout(pageNum);
    const data = installedData
      ? (installedData as PageLayoutData)
      : await (async (): Promise<PageLayoutData | null> => {
          const res = await fetch(`${PAGE_BASE}${padded}.json`);
          return res.ok ? ((await res.json()) as PageLayoutData) : null;
        })();
    if (!data) {
      return null;
    }
    // Evict oldest entry if cache is full (LRU policy)
    if (layoutCache.size >= LAYOUT_CACHE_MAX) {
      const firstKey = layoutCache.keys().next().value;
      if (firstKey !== undefined) {
        layoutCache.delete(firstKey);
      }
    }
    layoutCache.set(key, data);
    return data;
  } catch (e: unknown) {
    console.warn('[Mushaf] Failed to load page data:', e);
    return null;
  }
}

/**
 * Build the woff2 font URL for a given QCF4 font name.
 * BSML font uses a different naming convention than Hafs fonts.
 */
function getFontUrl(fontName: string): string {
  return qcf4FontUrl(fontName);
}

/**
 * Fetch font binary data using XMLHttpRequest instead of fetch().
 *
 * CRITICAL: In Capacitor with CapacitorHttp enabled, the native HTTP plugin
 * intercepts ALL fetch() calls and can corrupt binary data (woff2 fonts).
 * XMLHttpRequest is NOT intercepted by CapacitorHttp, so it returns
 * correct binary data. This is the key fix for mushaf mode in Android APK.
 */
function fetchFontViaXHR(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error(`XHR HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('XHR network error'));
    xhr.ontimeout = () => reject(new Error('XHR timeout'));
    xhr.timeout = 15000; // 15 second timeout
    xhr.send();
  });
}

/**
 * Fetch font binary data. In Capacitor, uses XHR to avoid CapacitorHttp
 * interception. In browsers, uses standard fetch().
 */
async function fetchFontBinary(url: string): Promise<ArrayBuffer> {
  if (isCapacitor()) {
    // Use XHR in Capacitor to avoid CapacitorHttp interception
    console.warn(`[Mushaf] Using XHR for font binary (bypassing CapacitorHttp): ${url}`);
    return fetchFontViaXHR(url);
  }
  // Use standard fetch in browser
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.arrayBuffer();
}

/**
 * Verify a font is truly usable on Canvas by drawing a PUA character
 * and checking if the pixels are non-blank.
 *
 * IMPORTANT: In Android WebView (Capacitor), Canvas pixel verification is unreliable
 * because WebView processes fonts differently. We use document.fonts.check()
 * as a fallback verification method in that case.
 */
function verifyFontOnCanvas(fontName: string): boolean {
  try {
    // In Capacitor/Android WebView, skip pixel-level Canvas verification
    // because it's unreliable — trust document.fonts API instead
    if (isCapacitor()) {
      const fontsCheck = document.fonts.check(`40px "${fontName}"`);
      console.warn(`[Mushaf] Capacitor: document.fonts.check for "${fontName}": ${fontsCheck}`);
      return fontsCheck;
    }

    const testSize = 40;
    const canvas = document.createElement('canvas');
    canvas.width = testSize * 2;
    canvas.height = testSize * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return false;
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${testSize}px "${fontName}"`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uF100', canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! < 250 || data[i + 1]! < 250 || data[i + 2]! < 250) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Create a hidden DOM element that uses the font. This forces the browser
 * to download and parse the font binary, making it available for Canvas.
 * Some browsers (especially Android WebView) won't make fonts available
 * to Canvas unless they're used in the DOM first.
 */
function createFontPreloadElement(fontName: string): void {
  const id = `qcf-preload-${fontName}`;
  if (document.getElementById(id)) {
    return;
  }

  const span = document.createElement('span');
  span.id = id;
  span.setAttribute('aria-hidden', 'true');
  span.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    font-family: "${fontName}";
    font-size: 40px;
    pointer-events: none;
  `;
  // Use multiple PUA characters to ensure the browser loads the font
  span.textContent = '\uF100\uF101\uF102\uF103\uF104\uF105';
  document.body.appendChild(span);
}

/**
 * Load a QCF4 font using the most reliable method available.
 *
 * Strategy order (most to least reliable):
 * 1. XHR fetch as ArrayBuffer → FontFace from binary data
 *    (Bypasses CapacitorHttp which corrupts binary data)
 * 2. FontFace API with URL (browser handles download)
 * 3. CSS @font-face injection with DOM preload element
 *
 * In Capacitor: We skip pixel-level Canvas verification and trust
 * document.fonts API instead.
 */
async function ensureFontLoaded(fontName: string): Promise<void> {
  if (loadedFonts.has(fontName)) {
    return;
  }

  // Deduplicate concurrent loads
  if (loadingFonts.has(fontName)) {
    const result = await loadingFonts.get(fontName);
    if (result) {
      return;
    }
    loadingFonts.delete(fontName);
  }

  const loadPromise = _doLoadFont(fontName);
  loadingFonts.set(fontName, loadPromise);

  try {
    const success = await loadPromise;
    if (success) {
      loadedFonts.add(fontName);
    }
  } finally {
    loadingFonts.delete(fontName);
  }
}

/**
 * Internal font loading implementation.
 * Returns true if the font was loaded and verified.
 */
async function _doLoadFont(fontName: string): Promise<boolean> {
  const fontUrl = getFontUrl(fontName);
  const capMode = isCapacitor();
  const waitMs = capMode ? 1200 : 200;

  for (let attempt = 1; attempt <= (capMode ? 2 : 3); attempt++) {
    console.warn(`[Mushaf] Loading font "${fontName}" (attempt ${attempt})...`);

    // --- Strategy 1: XHR/Fetch ArrayBuffer → FontFace (most reliable) ---
    try {
      console.warn(`[Mushaf] Strategy 1: ArrayBuffer for "${fontName}" from ${fontUrl}`);
      const buffer = await fetchFontBinary(fontUrl);
      console.warn(`[Mushaf] Font "${fontName}" downloaded: ${buffer.byteLength} bytes`);

      // Validate: woff2 files should be at least 10KB
      if (buffer.byteLength < 10000) {
        console.warn(`[Mushaf] Font "${fontName}" too small (${buffer.byteLength} bytes), likely corrupted`);
        throw new Error(`Font data too small: ${buffer.byteLength} bytes`);
      }

      const fontFace = new FontFace(fontName, buffer, { display: 'block' });
      const loaded = await fontFace.load();
      document.fonts.add(loaded);

      await document.fonts.ready;
      createFontPreloadElement(fontName);
      await new Promise<void>((r) => setTimeout(r, waitMs));

      const verified = verifyFontOnCanvas(fontName);
      console.warn(`[Mushaf] Strategy 1 verify for "${fontName}": ${verified}`);
      if (verified) {
        console.warn(`[Mushaf] Font "${fontName}" loaded successfully via ArrayBuffer`);
        return true;
      }

      // In Capacitor: trust document.fonts and proceed even if Canvas verify fails
      if (capMode) {
        const fontsCheck = document.fonts.check(`40px "${fontName}"`);
        if (fontsCheck) {
          console.warn(`[Mushaf] Capacitor: Trusting document.fonts.check for "${fontName}"`);
          return true;
        }
        // Even if fonts.check fails, if we added the font, proceed anyway
        console.warn(`[Mushaf] Capacitor: Proceeding with font "${fontName}" despite verification failure`);
        return true;
      }
    } catch (e) {
      console.warn(`[Mushaf] ArrayBuffer strategy failed for "${fontName}":`, e);
    }

    // --- Strategy 2: FontFace with URL (browser handles download) ---
    try {
      console.warn(`[Mushaf] Strategy 2: FontFace URL for "${fontName}"`);
      const fontFace = new FontFace(fontName, `url('${fontUrl}')`, { display: 'block' });
      const loaded = await fontFace.load();
      document.fonts.add(loaded);

      await document.fonts.ready;
      createFontPreloadElement(fontName);
      await new Promise<void>((r) => setTimeout(r, waitMs));

      const verified = verifyFontOnCanvas(fontName);
      console.warn(`[Mushaf] Strategy 2 verify for "${fontName}": ${verified}`);
      if (verified) {
        console.warn(`[Mushaf] Font "${fontName}" loaded successfully via FontFace URL`);
        return true;
      }

      if (capMode) {
        console.warn(
          `[Mushaf] Capacitor: Proceeding with font "${fontName}" (strategy 2) despite verification failure`,
        );
        return true;
      }
    } catch (e) {
      console.warn(`[Mushaf] FontFace URL strategy failed for "${fontName}":`, e);
    }

    // --- Strategy 3: CSS @font-face + DOM preload ---
    try {
      console.warn(`[Mushaf] Strategy 3: CSS @font-face for "${fontName}"`);
      const styleId = fontName === BSML_FONT ? 'qcf-basml' : `qcf-${fontName}`;
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @font-face {
            font-family: '${fontName}';
            src: url('${fontUrl}') format('woff2');
            font-display: block;
          }`;
        document.head.appendChild(style);
      }

      createFontPreloadElement(fontName);

      try {
        await document.fonts.load(`40px "${fontName}"`, '\uF100');
      } catch {
        /* some browsers don't support the text param */
      }

      await document.fonts.ready;
      const cssWaitMs = capMode ? 1500 : 500;
      await new Promise<void>((r) => setTimeout(r, cssWaitMs));

      const verified = verifyFontOnCanvas(fontName);
      console.warn(`[Mushaf] Strategy 3 verify for "${fontName}": ${verified}`);
      if (verified) {
        console.warn(`[Mushaf] Font "${fontName}" loaded successfully via CSS @font-face`);
        return true;
      }

      if (capMode) {
        console.warn(
          `[Mushaf] Capacitor: Proceeding with font "${fontName}" (strategy 3) despite verification failure`,
        );
        return true;
      }
    } catch (e) {
      console.warn(`[Mushaf] CSS @font-face strategy failed for "${fontName}":`, e);
    }

    if (attempt < (capMode ? 2 : 3)) {
      const delay = capMode ? 1000 : 500 * attempt;
      console.warn(`[Mushaf] All strategies failed for "${fontName}" (attempt ${attempt}), retrying in ${delay}ms...`);
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }

  // In Capacitor: proceed anyway — better to show something than blank
  if (capMode) {
    console.warn(`[Mushaf] Capacitor: Proceeding despite font "${fontName}" loading failure — will retry render later`);
    return true;
  }

  console.error(`[Mushaf] FAILED to load font "${fontName}" after all attempts.`);
  return false;
}

function isNightMode(): boolean {
  return document.body.classList.contains('night-mode');
}

function isDeepNightMode(): boolean {
  return document.body.classList.contains('night-mode') && document.body.classList.contains('deep-night-mode');
}

function getColors(): PageColors {
  if (isDeepNightMode()) {
    return {
      bg: 'transparent',
      txt: '#f7f3e8',
      frame: 'rgba(194, 158, 82, 0.22)',
      frameInner: 'rgba(194, 158, 82, 0.12)',
    };
  }
  if (isNightMode()) {
    return { bg: '#1a1e2b', txt: '#d4c4a8', frame: '#4a4e5e', frameInner: '#3a3e4e' };
  }
  return { bg: '#f5f0e8', txt: '#1a1a1a', frame: '#c4a87c', frameInner: '#b8956a' };
}

function paintPageBackground(ctx: CanvasRenderingContext2D, colors: PageColors): void {
  // Canvas is reset by width/height assignment before normal renders. The guard
  // keeps lightweight test canvas mocks compatible while real canvases are
  // cleared for Capacitor's delayed re-render.
  ctx.clearRect?.(0, 0, CANVAS_W, CANVAS_H);
  if (colors.bg !== 'transparent') {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

/* ===================== RENDERING ===================== */

/**
 * Render a mushaf page onto a canvas element.
 *
 * For Capacitor/Android WebView, includes special handling:
 * - Uses XHR for font binary data (bypasses CapacitorHttp)
 * - Skips strict Canvas pixel verification
 * - Schedules a re-render after a delay for WebView font processing
 * - Adds an overall timeout to prevent hanging
 */
export async function renderPage(pageNum: number, targetCanvas?: HTMLCanvasElement | null): Promise<RenderPageResult> {
  const capMode = isCapacitor();
  console.warn(`[Mushaf] renderPage(${pageNum}) starting... Capacitor=${capMode}`);

  // Add overall timeout for Capacitor to prevent hanging
  if (capMode) {
    const timeoutMs = 30000;
    let timedOut = false;
    const mainPromise = _renderPageInternal(pageNum, targetCanvas).then((result) => {
      // If timeout already fired, discard the late result to avoid overwriting the fallback render
      if (timedOut) {
        return { canvas: null, layout: null };
      }
      return result;
    });
    const timeoutPromise = new Promise<RenderPageResult>((resolve) =>
      setTimeout(() => {
        timedOut = true;
        console.error(`[Mushaf] renderPage(${pageNum}) timed out after ${timeoutMs}ms`);
        _renderPageWithCurrentFonts(pageNum, targetCanvas).then(resolve);
      }, timeoutMs),
    );
    return Promise.race([mainPromise, timeoutPromise]);
  }

  return _renderPageInternal(pageNum, targetCanvas);
}

/**
 * Attempt to render a page using whatever fonts are currently available,
 * even if font loading failed. Better to show partial text than blank.
 */
async function _renderPageWithCurrentFonts(
  pageNum: number,
  targetCanvas?: HTMLCanvasElement | null,
): Promise<RenderPageResult> {
  try {
    const data = await loadPageData(pageNum);
    if (!data) {
      return { canvas: null, layout: null };
    }

    const pageFont = data.font || getPageFont(pageNum, null);
    const canvas = targetCanvas || getCanvas();
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { canvas: null, layout: data };
    }

    const colors = getColors();
    paintPageBackground(ctx, colors);
    renderPageContent(ctx, data, pageFont, colors, pageNum);
    drawPageFrame(ctx, colors);
    drawPageNumber(ctx, pageNum, colors);
    return { canvas, layout: data };
  } catch {
    return { canvas: null, layout: null };
  }
}

async function _renderPageInternal(
  pageNum: number,
  targetCanvas?: HTMLCanvasElement | null,
): Promise<RenderPageResult> {
  const capMode = isCapacitor();
  const data = await loadPageData(pageNum);
  if (!data) {
    console.error(`[Mushaf] Failed to load page data for page ${pageNum}`);
    return { canvas: null, layout: null };
  }
  console.warn(`[Mushaf] Page ${pageNum} data loaded: ${data.lines?.length || 0} lines`);

  const pageFont = data.font || getPageFont(pageNum, null);

  // Collect ALL unique font names used on this page
  const pageFonts = new Set<string>();
  pageFonts.add(pageFont);
  pageFonts.add(BSML_FONT);
  for (const line of data.lines ?? []) {
    for (const w of line.words ?? []) {
      if (w.font) {
        pageFonts.add(w.font);
      }
    }
  }

  console.warn(`[Mushaf] Page ${pageNum} needs fonts: ${[...pageFonts].join(', ')}`);

  // Load all fonts in parallel with individual timeouts
  const fontPromises = [...pageFonts].map((fn) =>
    Promise.race([ensureFontLoaded(fn), new Promise<void>((resolve) => setTimeout(resolve, capMode ? 8000 : 5000))]),
  );
  await Promise.all(fontPromises);

  // Ensure Reem Kufi is loaded for bismillah rendering
  try {
    await document.fonts.load('500 40px "Reem Kufi"');
  } catch {
    /* ignore */
  }

  // Wait for all fonts to be ready
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }

  // In Capacitor: extra wait for WebView font processing
  if (capMode) {
    await new Promise<void>((r) => setTimeout(r, 1000));
    await document.fonts.ready;
  } else {
    // Non-Capacitor: verify font on Canvas
    if (!loadedFonts.has(pageFont) || !verifyFontOnCanvas(pageFont)) {
      console.warn(`[Mushaf] Font "${pageFont}" not verified on Canvas, attempting final reload...`);
      loadedFonts.delete(pageFont);
      await ensureFontLoaded(pageFont);
    }
  }

  const canvas = targetCanvas || getCanvas();
  if (!canvas) {
    return { canvas: null, layout: data };
  }
  const renderToken = (Number(canvas.dataset['renderToken'] || '0') + 1).toString();
  canvas.dataset['renderToken'] = renderToken;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  const colors = getColors();

  paintPageBackground(ctx!, colors);

  renderPageContent(ctx!, data, pageFont, colors, pageNum);

  drawPageFrame(ctx!, colors);

  drawPageNumber(ctx!, pageNum, colors);

  console.warn(`[Mushaf] Page ${pageNum} rendered successfully`);

  // In Capacitor: schedule a single well-timed re-render because Android WebView
  // sometimes needs an extra render pass for fonts to take effect on Canvas.
  // We do ONE re-render at 3 seconds (not 3 separate ones which cause flicker).
  if (capMode) {
    const renderData = { data, pageFont, colors, pageNum };
    setTimeout(() => {
      console.warn(`[Mushaf] Capacitor: Re-rendering page ${renderData.pageNum} after 3s delay`);
      try {
        const c = targetCanvas || (document.querySelector('.mushaf-page-canvas') as HTMLCanvasElement);
        if (c && c.width === CANVAS_W && c.dataset['renderToken'] === renderToken) {
          const ctx2 = c.getContext('2d');
          if (ctx2) {
            paintPageBackground(ctx2, renderData.colors);
            renderPageContent(ctx2, renderData.data, renderData.pageFont, renderData.colors, renderData.pageNum);
            drawPageFrame(ctx2, renderData.colors);
            drawPageNumber(ctx2, renderData.pageNum, renderData.colors);
            console.warn(`[Mushaf] Capacitor: Re-render of page ${renderData.pageNum} complete`);
          }
        }
      } catch (e) {
        console.warn('[Mushaf] Capacitor re-render failed:', e);
      }
    }, 3000);
  }

  return { canvas, layout: data };
}

function measureLine(ctx: CanvasRenderingContext2D, words: PageWord[], pageFont: string, fontSize: number): number[] {
  return words.map((w) => {
    const fn = w.font || pageFont;
    ctx.font = `${fontSize}px "${fn}"`;
    return ctx.measureText(w.char).width;
  });
}

export function getLineY(lineIndex: number, lineCount: number, imgHeight: number): number {
  if (lineIndex <= 0) {
    return 0;
  }
  if (lineIndex >= lineCount) {
    return imgHeight;
  }
  const usableHeight = CANVAS_H - TOP_OFFSET - BOTTOM_OFFSET - PAD_V;
  const stdLineHeight = usableHeight / STD_LINES;
  const isShortPage = lineCount < STD_LINES;
  const lineSpacing = isShortPage ? (usableHeight - stdLineHeight) / Math.max(1, lineCount - 1) : stdLineHeight;
  const y = TOP_OFFSET + lineIndex * lineSpacing + (isShortPage ? 0 : stdLineHeight / 2);
  return (y / CANVAS_H) * imgHeight;
}

/** Pre-compute per-word tajweed coloring data for the entire page. */
const _pageTajweedCache = new Map<number, { wordIdx: number; lineIdx: number; color: string | null }[] | null>();

function computePageTajweed(data: PageLayoutData, pageNum: number): { wordIdx: number; lineIdx: number; color: string | null }[] | null {
  // The tajweed coloring for a page depends only on its static layout + the
  // current theme (via getTajweedColor). Cache the result so repeated renders
  // of the same page (e.g. the WebView font-delay re-render) skip recomputation.
  const cached = _pageTajweedCache.get(pageNum);
  if (cached !== undefined) {
    return cached;
  }

  if (!state.tajweedEnabled) {
    _pageTajweedCache.set(pageNum, null);
    return null;
  }

  const verseKeyWords = new Map<string, { text: string; lineIdx: number; wordIdx: number }[]>();
  for (let li = 0; li < data.lines.length; li++) {
    const line = data.lines[li];
    if (!line?.words) {
      continue;
    }
    for (let wi = 0; wi < line.words.length; wi++) {
      const w = line.words[wi]!;
      if (w.verse_key && w.text && w.type === 'word') {
        if (!verseKeyWords.has(w.verse_key)) {
          verseKeyWords.set(w.verse_key, []);
        }
        verseKeyWords.get(w.verse_key)!.push({ text: w.text, lineIdx: li, wordIdx: wi });
      }
    }
  }

  const result: { wordIdx: number; lineIdx: number; color: string | null }[] = [];

  for (const [vk, words] of verseKeyWords) {
    const parts = vk.split(':');
    const surah = parseInt(parts[0]!, 10);
    const ayah = parseInt(parts[1]!, 10);

    const annotations: TajweedAnnotation[] = getAyahAnnotations(surah, ayah);
    if (annotations.length === 0) {
      for (const w of words) {
        result.push({ wordIdx: w.wordIdx, lineIdx: w.lineIdx, color: null });
      }
      continue;
    }

    const _ayahText = words.map((w) => w.text).join(' ');
    const colorMap = buildColorMap(annotations);
    if (!colorMap || colorMap.size === 0) {
      for (const w of words) {
        result.push({ wordIdx: w.wordIdx, lineIdx: w.lineIdx, color: null });
      }
      continue;
    }

    let outputPos = 0;
    for (let wi = 0; wi < words.length; wi++) {
      const wordText = words[wi]!.text;
      const wordRules: Set<string> = new Set();
      for (let ci = 0; ci < wordText.length; ci++) {
        const rule = colorMap.get(outputPos + ci);
        if (rule) {
          wordRules.add(rule);
        }
      }
      // The mushaf canvas paints a word as a single glyph, so only one color is
      // possible. Choose the most salient rule present (long madd, ghunnah family,
      // qalqalah…) rather than the first one, which better matches the per-letter
      // coloring shown in the surah reading view.
      const chosen = pickTajweedRule(wordRules);
      const wordColor = chosen ? getTajweedColor(chosen) : null;
      result.push({ wordIdx: words[wi]!.wordIdx, lineIdx: words[wi]!.lineIdx, color: wordColor });
      outputPos += wordText.length + 1;
    }
  }

  _pageTajweedCache.set(pageNum, result);
  return result;
}

function renderPageContent(
  ctx: CanvasRenderingContext2D,
  data: PageLayoutData,
  pageFont: string,
  colors: PageColors,
  pageNum: number,
): void {
  const lines = data.lines;
  if (!lines || lines.length === 0) {
    return;
  }

  const lineCount = lines.length;
  const usableHeight = CANVAS_H - TOP_OFFSET - BOTTOM_OFFSET - PAD_V;
  const isOpeningPage = pageNum === 1 || pageNum === 2;
  const availableW = (CANVAS_W - PAD_H * 2) * (isOpeningPage ? OPENING_PAGE_TEXT_SCALE : 1);
  const textRight = (CANVAS_W + availableW) / 2;

  const stdLineHeight = usableHeight / STD_LINES;
  const baseFontSize = Math.max(26, Math.min(55, stdLineHeight * 0.85));
  const pageFontSize = baseFontSize * (isOpeningPage ? OPENING_PAGE_TEXT_SCALE : 1);

  const isShortPage = lineCount < 15;
  const lineSpacing = isShortPage ? (usableHeight - stdLineHeight) / Math.max(1, lineCount - 1) : stdLineHeight;

  const lineWidths: (LineWidths | null)[] = [];
  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (!line?.words || line.words.length === 0) {
      lineWidths.push(null);
      continue;
    }
    const widths = measureLine(ctx, line.words, pageFont, pageFontSize);
    const totalW = widths.reduce((a: number, b: number) => a + b, 0);
    // The opening pages use centered, naturally spaced lines like the Madinah Mushaf.
    // Justifying their short lines would spread the words too far apart.
    const gap = isOpeningPage
      ? pageFontSize * OPENING_PAGE_WORD_GAP_SCALE
      : line.words.length > 1
        ? (availableW - totalW) / (line.words.length - 1)
        : 0;
    lineWidths.push({ widths, gap: Math.max(0, gap) });
  }

  const tajweedColors = computePageTajweed(data, pageNum);
  const tajweedLookup = new Map<string, string | null>();
  if (tajweedColors) {
    for (const entry of tajweedColors) {
      tajweedLookup.set(`${entry.lineIdx}:${entry.wordIdx}`, entry.color);
    }
  }

  const bsmlColor = isNightMode() ? '#d4af37' : '#8b6914';
  const headerColor = isNightMode() ? '#c4a87c' : '#7a5c3a';
  const bsmlFont = 'Reem Kufi';
  const bsmlText = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

  ctx.textBaseline = 'middle';

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (!line?.words || line.words.length === 0) {
      continue;
    }

    const y = TOP_OFFSET + i * lineSpacing + (isShortPage ? 0 : stdLineHeight / 2);
    const words = line.words;
    const lw = lineWidths[i];
    if (!lw) {
      continue;
    }
    const { widths, gap } = lw;

    const lineType = words[0]?.type;
    const isBismillahLine = lineType === 'bismillah';
    const isHeaderLine = lineType === 'surah_header';

    if (isBismillahLine) {
      const bsmlFontSize = Math.round(pageFontSize * 0.95);
      ctx.font = `500 ${bsmlFontSize}px "${bsmlFont}", "Scheherazade New", serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = bsmlColor;
      ctx.fillText(bsmlText, CANVAS_W / 2, y);
      continue;
    }

    const lineWidth = widths.reduce((total, width) => total + width, 0) + gap * Math.max(0, words.length - 1);
    let x = isOpeningPage ? CANVAS_W / 2 + lineWidth / 2 : textRight;

    for (let j = 0; j < words.length; j++) {
      const w = words[j]!;
      const fn = w.font || pageFont;
      ctx.font = `${pageFontSize}px "${fn}"`;
      ctx.textAlign = 'right';

      if (isHeaderLine) {
        ctx.fillStyle = headerColor;
      } else {
        const wordColor = tajweedLookup ? tajweedLookup.get(`${i}:${j}`) : null;
        ctx.fillStyle = wordColor || colors.txt;
      }

      if (isOpeningPage && isHeaderLine) {
        ctx.textAlign = 'center';
        ctx.fillText(w.char, CANVAS_W / 2, y);
      } else {
        ctx.fillText(w.char, x, y);
      }
      x -= widths[j]! + gap;
    }
  }
}

function drawPageNumber(ctx: CanvasRenderingContext2D, pageNum: number, _colors: PageColors): void {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H - 18;
  const numStr = pageNum.toLocaleString('ar-SA');
  ctx.font = 'bold 16px "Amiri", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isNightMode() ? '#6a6e7e' : '#8b6f5a';
  ctx.fillText(numStr, cx, cy);
}

function drawPageFrame(ctx: CanvasRenderingContext2D, colors: PageColors): void {
  const m = 8;
  ctx.strokeStyle = colors.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(m, m, CANVAS_W - m * 2, CANVAS_H - m * 2);

  ctx.strokeStyle = colors.frameInner;
  ctx.lineWidth = 1;
  const gap = 6;
  ctx.strokeRect(m + gap, m + gap, CANVAS_W - (m + gap) * 2, CANVAS_H - (m + gap) * 2);
}
