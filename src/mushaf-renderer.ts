/**
 * Mushaf page renderer using QCF4 fonts from King Fahd Complex.
 * Renders exact Madinah Mushaf calligraphy on Canvas.
 *
 * Data source: https://github.com/MohamadHajjRabee/quran-qcf4
 * Font CDN:  https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/fonts-woff2/
 */
import { JUZ_PAGES } from './config.js';

/* ===================== INTERFACES ===================== */

/** A single word in a mushaf page line. */
export interface PageWord {
  char: string;
  font?: string;
  type?: string;
  verse_key?: string;
  location?: string;
  word?: string;
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

const layoutCache = new Map<string, PageLayoutData>();

/** Tracks fonts that have been verified as loaded and usable on Canvas. */
const loadedFonts = new Set<string>();

/** Tracks fonts currently being loaded (prevents duplicate loads). */
const loadingFonts = new Map<string, Promise<void>>();

/** PUA test character used to verify font glyphs are actually available. */
const PUA_TEST_CHAR = '\uF100';

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
 * Check if a font is truly available for Canvas rendering by testing
 * with a PUA character. Standard fonts don't have glyphs for PUA
 * code points, so a positive match means our QCF4 font is loaded.
 */
function isFontReadyForCanvas(fontName: string): boolean {
  try {
    return document.fonts.check(`16px "${fontName}"`, PUA_TEST_CHAR);
  } catch {
    return false;
  }
}

/**
 * Wait for a font to become available, polling with exponential backoff.
 * Returns true if the font became available, false if timed out.
 */
async function waitForFont(fontName: string, maxWaitMs = 10000): Promise<boolean> {
  if (isFontReadyForCanvas(fontName)) return true;

  const startTime = Date.now();
  let delay = 50;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise<void>((r) => setTimeout(r, delay));
    if (isFontReadyForCanvas(fontName)) return true;
    delay = Math.min(delay * 1.5, 500);
  }

  console.warn(`Font "${fontName}" did not become available within ${maxWaitMs}ms`);
  return false;
}

/**
 * Load a QCF4 font using the FontFace API with retry logic.
 *
 * The FontFace API is more reliable than @font-face CSS injection because:
 * 1. It gives us explicit control over the load lifecycle
 * 2. We get proper error handling when the font fails to download
 * 3. We can use a PUA test character to verify glyph availability
 * 4. It works consistently across browsers and WebView environments
 */
async function ensureFontLoaded(fontName: string): Promise<void> {
  // Already verified as loaded
  if (loadedFonts.has(fontName)) return;

  // Deduplicate concurrent loads for the same font
  if (loadingFonts.has(fontName)) {
    await loadingFonts.get(fontName);
    return;
  }

  const loadPromise = _doLoadFont(fontName);
  loadingFonts.set(fontName, loadPromise);

  try {
    await loadPromise;
  } finally {
    loadingFonts.delete(fontName);
  }
}

/**
 * Internal font loading implementation with up to 3 retry attempts.
 * Uses the FontFace API and verifies with PUA test characters.
 */
async function _doLoadFont(fontName: string, maxRetries = 3): Promise<void> {
  const fontUrl = getFontUrl(fontName);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // --- Strategy 1: FontFace API (preferred) ---
      const fontFace = new FontFace(fontName, `url('${fontUrl}')`, {
        display: 'block',
      });

      const loaded = await fontFace.load();
      document.fonts.add(loaded);

      // Verify the font actually works with PUA characters on Canvas
      const ready = await waitForFont(fontName, 5000);
      if (ready) {
        loadedFonts.add(fontName);
        console.log(`[Mushaf] Font "${fontName}" loaded successfully (attempt ${attempt})`);
        return;
      }

      // Font loaded via FontFace API but not verified on Canvas —
      // fall through to CSS @font-face approach
      console.warn(`[Mushaf] FontFace loaded "${fontName}" but Canvas verification failed, trying @font-face fallback`);
    } catch (e) {
      console.warn(`[Mushaf] FontFace API failed for "${fontName}" (attempt ${attempt}):`, e);
    }

    // --- Strategy 2: CSS @font-face injection as fallback ---
    try {
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

      // Use PUA test character to force the browser to actually download
      // and parse the font binary (not just register the @font-face rule)
      await document.fonts.load(`16px "${fontName}"`, PUA_TEST_CHAR);

      const ready = await waitForFont(fontName, 5000);
      if (ready) {
        loadedFonts.add(fontName);
        console.log(`[Mushaf] Font "${fontName}" loaded via @font-face (attempt ${attempt})`);
        return;
      }
    } catch (e) {
      console.warn(`[Mushaf] @font-face fallback also failed for "${fontName}" (attempt ${attempt}):`, e);
    }

    if (attempt < maxRetries) {
      // Brief pause before retrying
      await new Promise<void>((r) => setTimeout(r, 300 * attempt));
    }
  }

  // All retries failed — mark as loaded anyway to avoid infinite loops,
  // but log the error clearly. Canvas will show fallback text.
  console.error(`[Mushaf] FAILED to load font "${fontName}" after ${maxRetries} attempts. Quran text may appear as squares.`);
  loadedFonts.add(fontName);
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
  await ensureFontLoaded(pageFont);

  const hasBasml = data.lines?.some((l) => l.words?.some((w) => w.font === BSML_FONT));
  const hasSurahHeader = data.lines?.[0]?.words?.[0]?.type === 'surah_header';
  if (hasBasml || hasSurahHeader) await ensureFontLoaded(BSML_FONT);

  // Extra safety: wait for the global fonts.ready promise and then
  // verify our specific fonts are available with PUA test characters.
  // This handles edge cases in Android WebView where font loading
  // may be delayed even after the FontFace API reports success.
  try {
    await document.fonts.ready;
  } catch { /* ignore */ }

  // Final verification — if the font still isn't ready, poll for it.
  // This is the last line of defense against race conditions.
  if (!isFontReadyForCanvas(pageFont)) {
    const ready = await waitForFont(pageFont, 3000);
    if (!ready) {
      console.warn(`[Mushaf] Font "${pageFont}" not ready for Canvas after all loading attempts. Page ${pageNum} may render incorrectly.`);
    }
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
    ctx.font = `${fontSize}px "${fn}", "Scheherazade New", "Traditional Arabic", "Amiri", serif`;
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
  const lineSpacing = isShortPage ? (usableHeight - stdLineHeight) / (lineCount - 1) : stdLineHeight;

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

  ctx.textBaseline = 'middle';

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (!line?.words || line.words.length === 0) continue;

    const y = TOP_OFFSET + i * lineSpacing + (isShortPage ? 0 : stdLineHeight / 2);
    const words = line.words;
    const lw = lineWidths[i];
    if (!lw) continue;
    const { widths, gap } = lw;

    let x = CANVAS_W - PAD_H;

    for (let j = 0; j < words.length; j++) {
      const w = words[j];
      const fn = w.font || pageFont;
      ctx.font = `${pageFontSize}px "${fn}", "Scheherazade New", "Traditional Arabic", "Amiri", serif`;
      ctx.fillStyle = colors.txt;
      ctx.textAlign = 'right';
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
