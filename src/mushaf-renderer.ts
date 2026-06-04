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
let loadedFonts = new Set<string>();

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
  } catch (e: unknown) { console.warn('Failed to load mushaf page data:', e); return null; }
}

async function ensureFontLoaded(fontName: string): Promise<void> {
  if (loadedFonts.has(fontName)) return;
  if (fontName === BSML_FONT) {
    const existing = document.getElementById('qcf-basml');
    if (existing) { loadedFonts.add(fontName); return; }
    const style = document.createElement('style');
    style.id = 'qcf-basml';
    style.textContent = `
      @font-face {
        font-family: '${BSML_FONT}';
        src: url('${FONT_BASE}${BSML_FONT}.woff2') format('woff2');
        font-display: block;
      }`;
    document.head.appendChild(style);
  } else {
    const existing = document.getElementById(`qcf-${fontName}`);
    if (existing) { loadedFonts.add(fontName); return; }
    const style = document.createElement('style');
    style.id = `qcf-${fontName}`;
    style.textContent = `
      @font-face {
        font-family: '${fontName}';
        src: url('${FONT_BASE}${fontName}_W.woff2') format('woff2');
        font-display: block;
      }`;
    document.head.appendChild(style);
  }
  try {
    await document.fonts.load(`1px "${fontName}"`);
  } catch { /* font may already be available */ }
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

  const hasBasml = data.lines?.some(l => l.words?.some(w => w.font === BSML_FONT));
  const hasSurahHeader = data.lines?.[0]?.words?.[0]?.type === 'surah_header';
  if (hasBasml || hasSurahHeader) await ensureFontLoaded(BSML_FONT);

  const fontReady = document.fonts?.check?.(`1px "${pageFont}"`);
  if (!fontReady && typeof document.fonts?.ready?.then === 'function') {
    await document.fonts.ready.catch(() => {});
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
  return words.map(w => {
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

function renderPageContent(ctx: CanvasRenderingContext2D, data: PageLayoutData, pageFont: string, colors: PageColors): void {
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
    if (!line?.words || line.words.length === 0) { lineWidths.push(null); continue; }
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
