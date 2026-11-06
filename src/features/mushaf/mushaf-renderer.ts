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
import {
  BOTTOM_OFFSET,
  CANVAS_H,
  CANVAS_W,
  PAD_H,
  PAD_V,
  STD_LINES,
  TOP_OFFSET,
  isMobileDevice,
  type MushafLineLayout,
  type PageLineBox,
  type PageWordBox,
} from './mushaf-geometry.js';
export type { MushafLineLayout, PageLineBox, PageWordBox } from './mushaf-geometry.js';
export { BOTTOM_OFFSET, CANVAS_H, CANVAS_W, PAD_H, PAD_V, STD_LINES, TOP_OFFSET, getLineY } from './mushaf-geometry.js';

import { state } from '../../state.js';
import { buildColorMap, getTajweedColor, pickTajweedRule } from '../../tajweed.js';
import { getAyahAnnotations } from '../../tajweed-data.js';
import type { TajweedAnnotation } from '../../tajweed-data.js';
import { loadPageData } from './mushaf-page-data.js';
import { ensureFontLoaded, ensureVerifiedFont, isCapacitor } from './mushaf-font-loader.js';
import type { PageLayoutData, PageWord } from './mushaf-layout-data.js';
export type { PageLayoutData, PageLine, PageWord } from './mushaf-layout-data.js';

/* ===================== INTERFACES ===================== */

/** A single word laid out on a mushaf line with its measured geometry (canvas px). */
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

/* ===================== CONSTANTS ===================== */
const BSML_FONT = 'QCF4_QBSML';

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

/** The Fatiha page and opening of Al-Baqarah use the compact Madinah Mushaf text block. */
const OPENING_PAGE_TEXT_SCALE = 0.82;
const OPENING_PAGE_WORD_GAP_SCALE = 0.2;

/* ===================== HELPERS ===================== */

function getPageFont(pageNum: number, fontMap: Record<string, string> | null | undefined): string {
  return fontMap?.[String(pageNum)] || `QCF4_Hafs_${String(Math.min(47, Math.ceil(pageNum / 13))).padStart(2, '0')}`;
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

export { loadPageData } from './mushaf-page-data.js';

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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<RenderPageResult>((resolve) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        console.error(`[Mushaf] renderPage(${pageNum}) timed out after ${timeoutMs}ms`);
        if (targetCanvas && !document.contains(targetCanvas)) {
          resolve({ canvas: null, layout: null });
          return;
        }
        _renderPageWithCurrentFonts(pageNum, targetCanvas).then(resolve);
      }, timeoutMs);
    });
    const result = await Promise.race([mainPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
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
    await ensureVerifiedFont(pageFont);
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

interface GlyphMeasure {
  width: number;
  ascent: number;
  descent: number;
}

function measureLine(
  ctx: CanvasRenderingContext2D,
  words: PageWord[],
  pageFont: string,
  fontSize: number,
): GlyphMeasure[] {
  return words.map((w) => {
    const fn = w.font || pageFont;
    ctx.font = `${fontSize}px "${fn}"`;
    const m = ctx.measureText(w.char);
    return {
      width: m.width,
      ascent: typeof m.actualBoundingBoxAscent === 'number' ? m.actualBoundingBoxAscent : 0,
      descent: typeof m.actualBoundingBoxDescent === 'number' ? m.actualBoundingBoxDescent : 0,
    };
  });
}

/**
 * Lay out every line/word of a page using the SAME geometry the painter uses
 * (real measured glyph widths, justified gaps, opening-page centering). This is
 * the single source of truth for coordinates, so the highlight overlay and
 * click hit-testing can never drift away from the painted pixels.
 *
 * The returned array keeps the same index order as `data.lines`.
 */
export function computeMushafLineLayout(
  ctx: CanvasRenderingContext2D,
  data: PageLayoutData,
  pageNum: number,
  pageFont: string,
): MushafLineLayout {
  const lines = data.lines;
  if (!lines || lines.length === 0) {
    return {
      lines: [],
      isOpeningPage: false,
      isShortPage: false,
      stdLineHeight: 0,
      pageFontSize: 0,
      availableW: 0,
      textRight: 0,
    };
  }

  const lineCount = lines.length;
  const usableHeight = CANVAS_H - TOP_OFFSET - BOTTOM_OFFSET - PAD_V;
  const isOpeningPage = pageNum === 1 || pageNum === 2;
  const availableW = (CANVAS_W - PAD_H * 2) * (isOpeningPage ? OPENING_PAGE_TEXT_SCALE : 1);
  const textRight = (CANVAS_W + availableW) / 2;

  const stdLineHeight = usableHeight / STD_LINES;
  const baseFontSize = Math.max(26, Math.min(55, stdLineHeight * 0.85));
  const pageFontSize = baseFontSize * (isOpeningPage ? OPENING_PAGE_TEXT_SCALE : 1);

  const isShortPage = lineCount < STD_LINES;
  const lineSpacing = isShortPage ? (usableHeight - stdLineHeight) / Math.max(1, lineCount - 1) : stdLineHeight;

  const layout: PageLineBox[] = [];

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (!line?.words || line.words.length === 0) {
      layout.push({
        y: TOP_OFFSET + i * lineSpacing + (isShortPage ? 0 : stdLineHeight / 2),
        lineHeight: lineSpacing,
        gap: 0,
        totalWidth: 0,
        words: [],
      });
      continue;
    }

    const measures = measureLine(ctx, line.words, pageFont, pageFontSize);
    const totalW = measures.reduce((a: number, x: GlyphMeasure) => a + x.width, 0);
    const widths = measures.map((m) => m.width);
    let maxAscent = 0;
    let maxDescent = 0;
    for (const m of measures) {
      if (m.ascent > maxAscent) {
        maxAscent = m.ascent;
      }
      if (m.descent > maxDescent) {
        maxDescent = m.descent;
      }
    }
    const gap = isOpeningPage
      ? pageFontSize * OPENING_PAGE_WORD_GAP_SCALE
      : line.words.length > 1
        ? (availableW - totalW) / (line.words.length - 1)
        : 0;
    const gapFinal = Math.max(0, gap);
    const totalWidth = totalW + gapFinal * Math.max(0, line.words.length - 1);
    const startX = isOpeningPage ? CANVAS_W / 2 + totalWidth / 2 : textRight;
    const y = TOP_OFFSET + i * lineSpacing + (isShortPage ? 0 : stdLineHeight / 2);

    const words: PageWordBox[] = [];
    let x = startX;
    for (let j = 0; j < line.words.length; j++) {
      const w = line.words[j]!;
      words.push({
        x,
        width: widths[j]!,
        char: w.char,
        font: w.font || pageFont,
        type: w.type,
        verse_key: w.verse_key,
        location: w.location,
        word: w.word,
      });
      x -= widths[j]! + gapFinal;
    }

    layout.push({
      y,
      lineHeight: lineSpacing,
      gap: gapFinal,
      totalWidth,
      words,
      inkAscent: maxAscent,
      inkDescent: maxDescent,
    });
  }

  return { lines: layout, isOpeningPage, isShortPage, stdLineHeight: lineSpacing, pageFontSize, availableW, textRight };
}

/** Compute the measured layout for a page with its actual page font. */
export function computeMushafPageGeometry(
  ctx: CanvasRenderingContext2D,
  data: PageLayoutData,
  pageNum: number,
): MushafLineLayout {
  const pageFont = data?.font || getPageFont(pageNum, null);
  return computeMushafLineLayout(ctx, data, pageNum, pageFont);
}

/** Pre-compute per-word tajweed coloring data for the entire page. */
const _pageTajweedCache = new Map<string, { wordIdx: number; lineIdx: number; color: string | null }[] | null>();

function computePageTajweed(
  data: PageLayoutData,
  pageNum: number,
): { wordIdx: number; lineIdx: number; color: string | null }[] | null {
  // The tajweed coloring for a page depends on its static layout, the
  // current theme (via getTajweedColor), and the tajweedEnabled state — the
  // state and theme are part of the cache key so toggling them invalidates the entry.
  const themeKey = document.body.classList.contains('deep-night-mode')
    ? 2
    : document.body.classList.contains('night-mode')
      ? 1
      : 0;
  const cacheKey = `${pageNum}:${state.tajweedEnabled ? 1 : 0}:${themeKey}`;
  const cached = _pageTajweedCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  if (!state.tajweedEnabled) {
    _pageTajweedCache.set(cacheKey, null);
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

  _pageTajweedCache.set(cacheKey, result);
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

  const layout = computeMushafLineLayout(ctx, data, pageNum, pageFont);
  const { pageFontSize, isOpeningPage } = layout;

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineBox = layout.lines[i];
    if (!line?.words || !lineBox || lineBox.words.length === 0) {
      continue;
    }

    const y = lineBox.y;
    const lineType = line.words[0]?.type;
    const isBismillahLine = lineType === 'bismillah';
    const isHeaderLine = lineType === 'surah_header';

    if (isBismillahLine) {
      const bsmlFontSize = Math.round(pageFontSize * 0.95);
      ctx.font = `500 ${bsmlFontSize}px "${bsmlFont}", "Mushaf Naskh", serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = bsmlColor;
      ctx.fillText(bsmlText, CANVAS_W / 2, y);
      continue;
    }

    for (let j = 0; j < lineBox.words.length; j++) {
      const box = lineBox.words[j]!;
      const w = line.words[j]!;
      ctx.font = `${pageFontSize}px "${box.font}"`;
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
        ctx.fillText(w.char, box.x, y);
      }
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
