/**
 * Mushaf page renderer using QCF4 fonts from King Fahd Complex.
 * Renders exact Madinah Mushaf calligraphy on Canvas.
 *
 * Data source: https://github.com/MohamadHajjRabee/quran-qcf4
 * Font CDN:  https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/fonts-woff2/
 */
import { JUZ_PAGES } from './config.js';
import { state } from './state.js';
import { buildColorMap } from './tajweed.js';
import { getAyahAnnotations } from './tajweed-data.js';
import type { TajweedAnnotation } from './tajweed-data.js';

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
const FONT_BASE = 'https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/fonts-woff2/';
const BSML_FONT = 'QCF4_QBSML';

export const CANVAS_W = 1080;
export const CANVAS_H = 1540;
export const PAD_H = 30;
export const PAD_V = 30;
export const TOP_OFFSET = 30;
export const BOTTOM_OFFSET = 50;
export const STD_LINES = 15;

const LAYOUT_CACHE_MAX = 50; // LRU cache limit to prevent unbounded memory growth
const layoutCache = new Map<string, PageLayoutData>();

/** Tracks fonts that have been verified as loaded and usable on Canvas. */
const loadedFonts = new Set<string>();

/** Tracks fonts currently being loaded (prevents duplicate loads). */
const loadingFonts = new Map<string, Promise<boolean>>();

/* ===================== HELPERS ===================== */

function getPageFont(pageNum: number, fontMap: Record<string, string> | null | undefined): string {
  return fontMap?.[String(pageNum)] || `QCF4_Hafs_${String(Math.min(47, Math.ceil(pageNum / 13))).padStart(2, '0')}`;
}

export async function loadPageData(pageNum: number): Promise<PageLayoutData | null> {
  const key = `qcf4-${pageNum}`;
  if (layoutCache.has(key)) return layoutCache.get(key)!;
  const padded = String(pageNum).padStart(3, '0');
  try {
    const res = await fetch(`${PAGE_BASE}${padded}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as PageLayoutData;
    // Evict oldest entry if cache is full (LRU policy)
    if (layoutCache.size >= LAYOUT_CACHE_MAX) {
      const firstKey = layoutCache.keys().next().value;
      if (firstKey !== undefined) layoutCache.delete(firstKey);
    }
    layoutCache.set(key, data);
    return data;
  } catch (e: unknown) {
    console.warn('Failed to load mushaf page data:', e);
    return null;
  }
}

/**
 * Build the woff2 font URL for a given QCF4 font name.
 * BSML font uses a different naming convention than Hafs fonts.
 */
function getFontUrl(fontName: string): string {
  if (fontName === BSML_FONT) {
    return `${FONT_BASE}${BSML_FONT}.woff2`;
  }
  return `${FONT_BASE}${fontName}_W.woff2`;
}

/**
 * Verify a font is truly usable on Canvas by drawing a PUA character
 * and checking if the pixels are non-blank. This is the ONLY reliable
 * way to confirm the font works for Canvas rendering —
 * document.fonts.check() can return true even when Canvas can't use it.
 */
function verifyFontOnCanvas(fontName: string): boolean {
  try {
    const testSize = 40;
    const canvas = document.createElement('canvas');
    canvas.width = testSize * 2;
    canvas.height = testSize * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Clear with known background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the PUA test character with ONLY our font (no fallback)
    ctx.font = `${testSize}px "${fontName}"`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uF100', canvas.width / 2, canvas.height / 2);

    // Check if any non-white pixels exist
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // If any pixel is not white (R=255, G=255, B=255), the font rendered
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
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
  if (document.getElementById(id)) return;

  const span = document.createElement('span');
  span.id = id;
  span.setAttribute('aria-hidden', 'true');
  span.style.cssText = `
    position: absolute;
    left: -9999px;
    top: -9999px;
    visibility: hidden;
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
 * 1. Fetch font as ArrayBuffer → FontFace from binary data
 *    (Bypasses CORS issues with URL-based FontFace loading)
 * 2. FontFace API with URL
 * 3. CSS @font-face injection with DOM preload element
 *
 * All strategies include Canvas pixel verification.
 */
async function ensureFontLoaded(fontName: string): Promise<void> {
  if (loadedFonts.has(fontName)) return;

  // Deduplicate concurrent loads
  if (loadingFonts.has(fontName)) {
    const result = await loadingFonts.get(fontName);
    if (result) return;
    // If previous load failed, remove it so we can retry
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
 * Internal font loading implementation with 3 strategies and retry logic.
 * Returns true if the font was loaded and verified on Canvas.
 */
async function _doLoadFont(fontName: string): Promise<boolean> {
  const fontUrl = getFontUrl(fontName);

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[Mushaf] Loading font "${fontName}" (attempt ${attempt})`);

    // --- Strategy 1: Fetch as ArrayBuffer → FontFace (most reliable) ---
    try {
      console.log(`[Mushaf] Strategy 1: Fetching "${fontName}" as ArrayBuffer...`);
      const res = await fetch(fontUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();

      const fontFace = new FontFace(fontName, buffer, { display: 'block' });
      const loaded = await fontFace.load();
      document.fonts.add(loaded);

      // Wait for the font to be fully processed
      await document.fonts.ready;

      // Force browser to recognize the font via DOM
      createFontPreloadElement(fontName);

      // Small delay to let the browser process the font
      await new Promise<void>((r) => setTimeout(r, 200));

      // Verify on Canvas
      if (verifyFontOnCanvas(fontName)) {
        console.log(`[Mushaf] Font "${fontName}" loaded via ArrayBuffer (attempt ${attempt}) ✅`);
        return true;
      }
      console.warn(`[Mushaf] ArrayBuffer loaded but Canvas verification failed for "${fontName}"`);
    } catch (e) {
      console.warn(`[Mushaf] ArrayBuffer strategy failed for "${fontName}":`, e);
    }

    // --- Strategy 2: FontFace with URL ---
    try {
      console.log(`[Mushaf] Strategy 2: FontFace URL for "${fontName}"...`);
      const fontFace = new FontFace(fontName, `url('${fontUrl}')`, { display: 'block' });
      const loaded = await fontFace.load();
      document.fonts.add(loaded);

      await document.fonts.ready;
      createFontPreloadElement(fontName);
      await new Promise<void>((r) => setTimeout(r, 200));

      if (verifyFontOnCanvas(fontName)) {
        console.log(`[Mushaf] Font "${fontName}" loaded via FontFace URL (attempt ${attempt}) ✅`);
        return true;
      }
    } catch (e) {
      console.warn(`[Mushaf] FontFace URL strategy failed for "${fontName}":`, e);
    }

    // --- Strategy 3: CSS @font-face + DOM preload ---
    try {
      console.log(`[Mushaf] Strategy 3: CSS @font-face for "${fontName}"...`);
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

      // Force font download via DOM element
      createFontPreloadElement(fontName);

      // Try to load via document.fonts API with PUA char
      try {
        await document.fonts.load(`40px "${fontName}"`, '\uF100');
      } catch {
        /* some browsers don't support the text param */
      }

      // Wait and poll
      await document.fonts.ready;
      await new Promise<void>((r) => setTimeout(r, 500));

      if (verifyFontOnCanvas(fontName)) {
        console.log(`[Mushaf] Font "${fontName}" loaded via CSS @font-face (attempt ${attempt}) ✅`);
        return true;
      }
    } catch (e) {
      console.warn(`[Mushaf] CSS @font-face strategy failed for "${fontName}":`, e);
    }

    if (attempt < 3) {
      const delay = 500 * attempt;
      console.warn(`[Mushaf] All strategies failed for "${fontName}" (attempt ${attempt}), retrying in ${delay}ms...`);
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }

  console.error(`[Mushaf] ❌ FAILED to load font "${fontName}" after 3 attempts. Quran text will appear as squares.`);
  return false;
}

function isNightMode(): boolean {
  return document.body.classList.contains('night-mode');
}

function getColors(): PageColors {
  if (isNightMode()) {
    return { bg: '#1a1e2b', txt: '#d4c4a8', frame: '#4a4e5e', frameInner: '#3a3e4e' };
  }
  return { bg: '#f5f0e8', txt: '#1a1a1a', frame: '#c4a87c', frameInner: '#b8956a' };
}

/* ===================== RENDERING ===================== */

export async function renderPage(pageNum: number, targetCanvas?: HTMLCanvasElement | null): Promise<RenderPageResult> {
  const data = await loadPageData(pageNum);
  if (!data) return { canvas: null, layout: null };

  const pageFont = data.font || getPageFont(pageNum, null);

  // Collect ALL unique font names used on this page (bismillah, header, etc.)
  const pageFonts = new Set<string>();
  pageFonts.add(pageFont);
  pageFonts.add(BSML_FONT);
  for (const line of data.lines ?? []) {
    for (const w of line.words ?? []) {
      if (w.font) pageFonts.add(w.font);
    }
  }

  // Load all fonts in parallel
  await Promise.all([...pageFonts].map((fn) => ensureFontLoaded(fn)));

  // Wait for all fonts to be ready
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }

  // Final Canvas verification — if the page font still doesn't work,
  // try one more time with a longer wait
  if (!loadedFonts.has(pageFont) || !verifyFontOnCanvas(pageFont)) {
    console.warn(`[Mushaf] Font "${pageFont}" not verified on Canvas, attempting final reload...`);
    loadedFonts.delete(pageFont);
    await ensureFontLoaded(pageFont);
  }

  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  const colors = getColors();

  ctx!.fillStyle = colors.bg;
  ctx!.fillRect(0, 0, CANVAS_W, CANVAS_H);

  renderPageContent(ctx!, data, pageFont, colors);

  drawPageFrame(ctx!, colors);

  drawPageNumber(ctx!, pageNum, colors);

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
  if (lineIndex <= 0) return 0;
  if (lineIndex >= lineCount) return imgHeight;
  const usableHeight = CANVAS_H - TOP_OFFSET - BOTTOM_OFFSET - PAD_V;
  const stdLineHeight = usableHeight / STD_LINES;
  const isShortPage = lineCount < STD_LINES;
  const lineSpacing = isShortPage ? (usableHeight - stdLineHeight) / Math.max(1, lineCount - 1) : stdLineHeight;
  const y = TOP_OFFSET + lineIndex * lineSpacing + (isShortPage ? 0 : stdLineHeight / 2);
  return (y / CANVAS_H) * imgHeight;
}

/** Pre‑compute per‑word tajweed coloring data for the entire page. */
function computePageTajweed(data: PageLayoutData): { wordIdx: number; lineIdx: number; color: string | null }[] | null {
  if (!state.tajweedEnabled) return null;

  // Collect all words with verse_key and text, in page order
  const verseKeyWords = new Map<string, { text: string; lineIdx: number; wordIdx: number }[]>();
  for (let li = 0; li < data.lines.length; li++) {
    const line = data.lines[li];
    if (!line?.words) continue;
    for (let wi = 0; wi < line.words.length; wi++) {
      const w = line.words[wi];
      if (w.verse_key && w.text && w.type === 'word') {
        if (!verseKeyWords.has(w.verse_key)) verseKeyWords.set(w.verse_key, []);
        verseKeyWords.get(w.verse_key)!.push({ text: w.text, lineIdx: li, wordIdx: wi });
      }
    }
  }

  // Build ayah text and color map per verse_key, then assign colors to each word
  const result: { wordIdx: number; lineIdx: number; color: string | null }[] = [];

  for (const [vk, words] of verseKeyWords) {
    const parts = vk.split(':');
    const surah = parseInt(parts[0], 10);
    const ayah = parseInt(parts[1], 10);

    const annotations: TajweedAnnotation[] = getAyahAnnotations(surah, ayah);
    if (annotations.length === 0) {
      for (const w of words) result.push({ wordIdx: w.wordIdx, lineIdx: w.lineIdx, color: null });
      continue;
    }

    // Build color map using the full ayah text (with basmalah if present)
    // — QCF4 layout always includes basmalah words, and annotations are for the full ayah
    const ayahText = words.map((w) => w.text).join(' ');
    const colorMap = buildColorMap(annotations);
    if (!colorMap || colorMap.size === 0) {
      for (const w of words) result.push({ wordIdx: w.wordIdx, lineIdx: w.lineIdx, color: null });
      continue;
    }

    // Use the full QCF4 word list as-is (no basmalah stripping)
    let outputPos = 0;
    for (let wi = 0; wi < words.length; wi++) {
      const wordText = words[wi].text;
      let wordColor: string | null = null;
      for (let ci = 0; ci < wordText.length; ci++) {
        const c = colorMap.get(outputPos + ci);
        if (c) {
          wordColor = c;
          break;
        }
      }
      result.push({ wordIdx: words[wi].wordIdx, lineIdx: words[wi].lineIdx, color: wordColor });
      outputPos += wordText.length + 1;
    }
  }

  return result;
}

function renderPageContent(
  ctx: CanvasRenderingContext2D,
  data: PageLayoutData,
  pageFont: string,
  colors: PageColors
): void {
  const lines = data.lines;
  if (!lines || lines.length === 0) return;

  const lineCount = lines.length;
  const usableHeight = CANVAS_H - TOP_OFFSET - BOTTOM_OFFSET - PAD_V;
  const availableW = CANVAS_W - PAD_H * 2;

  const stdLineHeight = usableHeight / STD_LINES;
  const baseFontSize = Math.max(26, Math.min(55, stdLineHeight * 0.85));
  const pageFontSize = baseFontSize;

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
    const gap = line.words.length > 1 ? (availableW - totalW) / (line.words.length - 1) : 0;
    lineWidths.push({ widths, gap: Math.max(0, gap) });
  }

  // Pre‑compute tajweed coloring for each word on the page
  const tajweedColors = computePageTajweed(data);
  const tajweedLookup = new Map<string, string | null>();
  if (tajweedColors) {
    for (const entry of tajweedColors) {
      tajweedLookup.set(`${entry.lineIdx}:${entry.wordIdx}`, entry.color);
    }
  }

  // Special colors for bismillah and surah header
  const bsmlColor = isNightMode() ? '#d4af37' : '#8b6914';
  const headerColor = isNightMode() ? '#c4a87c' : '#7a5c3a';

  ctx.textBaseline = 'middle';

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (!line?.words || line.words.length === 0) continue;

    const y = TOP_OFFSET + i * lineSpacing + (isShortPage ? 0 : stdLineHeight / 2);
    const words = line.words;
    const lw = lineWidths[i];
    if (!lw) continue;
    const { widths, gap } = lw;

    // Check if this line is a bismillah or surah_header line
    const lineType = words[0]?.type;
    const isBismillahLine = lineType === 'bismillah';
    const isHeaderLine = lineType === 'surah_header';

    let x = CANVAS_W - PAD_H;

    for (let j = 0; j < words.length; j++) {
      const w = words[j];
      const fn = w.font || pageFont;
      ctx.font = `${pageFontSize}px "${fn}"`;
      ctx.textAlign = 'right';

      // Use special color for bismillah and surah headers
      if (isBismillahLine) {
        ctx.fillStyle = bsmlColor;
      } else if (isHeaderLine) {
        ctx.fillStyle = headerColor;
      } else {
        // Use tajweed color if available, otherwise default text color
        const wordColor = tajweedLookup ? tajweedLookup.get(`${i}:${j}`) : null;
        ctx.fillStyle = wordColor || colors.txt;
      }

      ctx.fillText(w.char, x, y);
      x -= widths[j] + gap;
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
