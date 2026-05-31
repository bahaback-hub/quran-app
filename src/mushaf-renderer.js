/**
 * Mushaf page renderer using QCF4 fonts from King Fahd Complex.
 * Renders exact Madinah Mushaf calligraphy on Canvas.
 *
 * Data source: https://github.com/MohamadHajjRabee/quran-qcf4
 * Font CDN:  https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/fonts-woff2/
 */
import { JUZ_PAGES } from './config.js';

const PAGE_BASE = 'https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main/pages/';
const FONT_BASE = 'https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/fonts-woff2/';
const BSML_FONT = 'QCF4_QBSML';

const CANVAS_W = 1080;
const CANVAS_H = 1540;
const PAD_H = 30;
const PAD_V = 30;
const TOP_OFFSET = 40;
const BOTTOM_OFFSET = 46;
const STD_LINES = 15;

const BG_COLOR = '#f5f0e8';
const PAGE_TXT_COLOR = '#1a1a1a';

const layoutCache = new Map();
let loadedFonts = new Set();

function getPageFont(pageNum, fontMap) {
  return fontMap?.[String(pageNum)] || `QCF4_Hafs_${String(Math.min(47, Math.ceil(pageNum / 13))).padStart(2, '0')}`;
}

export async function loadPageData(pageNum) {
  const key = `qcf4-${pageNum}`;
  if (layoutCache.has(key)) return layoutCache.get(key);
  const padded = String(pageNum).padStart(3, '0');
  try {
    const res = await fetch(`${PAGE_BASE}${padded}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    layoutCache.set(key, data);
    return data;
  } catch { return null; }
}

async function ensureFontLoaded(fontName) {
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
    const num = fontName.replace('QCF4_Hafs_', '');
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

export async function renderPage(pageNum, targetCanvas) {
  const data = await loadPageData(pageNum);
  if (!data) return { canvas: null, layout: null };

  const pageFont = data.font || getPageFont(pageNum, null);
  await ensureFontLoaded(pageFont);

  const hasBasml = data.lines?.some(l => l.words?.some(w => w.font === BSML_FONT));
  const hasSurahHeader = data.lines?.[0]?.words?.[0]?.type === 'surah_header';
  if (hasBasml || hasSurahHeader) await ensureFontLoaded(BSML_FONT);

  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  renderPageContent(ctx, data, pageFont);

  drawPageNumber(ctx, pageNum);

  return { canvas, layout: data };
}

function measureLine(ctx, words, pageFont, fontSize) {
  return words.map(w => {
    const fn = w.font || pageFont;
    ctx.font = `${fontSize}px "${fn}", "Scheherazade New", serif`;
    return ctx.measureText(w.char).width;
  });
}

function computeFontSize(lineWords, pageFont, baseFontSize, availableW, ctx) {
  const gapCount = lineWords.length - 1;
  if (gapCount <= 0) return { fontSize: baseFontSize, widths: [], gap: 0 };

  let widths = measureLine(ctx, lineWords, pageFont, baseFontSize);
  let totalW = widths.reduce((a, b) => a + b, 0);
  if (totalW <= 0) return { fontSize: baseFontSize, widths, gap: 0 };

  let optimalFs = Math.round(baseFontSize * availableW / totalW);
  optimalFs = Math.max(20, Math.min(100, optimalFs));

  widths = measureLine(ctx, lineWords, pageFont, optimalFs);
  totalW = widths.reduce((a, b) => a + b, 0);

  return { fontSize: optimalFs, widths, gap: 0 };
}

function renderPageContent(ctx, data, pageFont) {
  const lines = data.lines;
  if (!lines || lines.length === 0) return;

  const lineCount = lines.length;
  const stdLineHeight = (CANVAS_H - TOP_OFFSET - BOTTOM_OFFSET - PAD_V) / STD_LINES;
  const baseFontSize = Math.max(26, Math.min(55, stdLineHeight * 0.85));
  const availableW = CANVAS_W - PAD_H * 2;

  const contentH = (CANVAS_H - TOP_OFFSET - BOTTOM_OFFSET - PAD_V);
  const lineHeight = contentH / lineCount;
  const extraV = contentH - lineCount * stdLineHeight;
  const topMargin = TOP_OFFSET + Math.max(0, extraV / 2);

  ctx.textBaseline = 'middle';

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (!line?.words || line.words.length === 0) continue;

    const y = topMargin + i * lineHeight + lineHeight / 2;
    const words = line.words;

    const first = words[0];
    const isCentered = words.length === 1 || first.type === 'surah_header' || first.type === 'bismillah';

    if (isCentered) {
      const fn = first.font || pageFont;
      ctx.font = `${baseFontSize}px "${fn}", "Scheherazade New", serif`;
      ctx.fillStyle = PAGE_TXT_COLOR;
      ctx.textAlign = 'center';
      if (words.length === 1) {
        ctx.fillText(first.char, CANVAS_W / 2, y);
      } else {
        let totalW = 0;
        for (const w of words) {
          const wfn = w.font || pageFont;
          ctx.font = `${baseFontSize}px "${wfn}", "Scheherazade New", serif`;
          totalW += ctx.measureText(w.char).width;
        }
        let cx = CANVAS_W / 2 - totalW / 2;
        for (const w of words) {
          const wfn = w.font || pageFont;
          ctx.font = `${baseFontSize}px "${wfn}", "Scheherazade New", serif`;
          ctx.textAlign = 'left';
          ctx.fillText(w.char, cx, y);
          cx += ctx.measureText(w.char).width;
        }
      }
      continue;
    }

    const { fontSize, widths, gap } = computeFontSize(words, pageFont, baseFontSize, availableW, ctx);

    let x = CANVAS_W - PAD_H;

    for (let j = 0; j < words.length; j++) {
      const w = words[j];
      const fn = w.font || pageFont;
      ctx.font = `${fontSize}px "${fn}", "Scheherazade New", serif`;
      ctx.fillStyle = PAGE_TXT_COLOR;
      ctx.textAlign = 'right';
      ctx.fillText(w.char, x, y);
      x -= widths[j] + gap;
    }
  }
}

function drawPageNumber(ctx, pageNum) {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H - 18;
  const numStr = pageNum.toLocaleString('ar-SA');
  ctx.font = 'bold 16px "Amiri", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8b6f5a';
  ctx.fillText(numStr, cx, cy);
}
