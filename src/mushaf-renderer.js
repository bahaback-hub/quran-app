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
const TOP_OFFSET = 30;
const BOTTOM_OFFSET = 50;
const STD_LINES = 15;

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

function isNightMode() {
  return document.body.classList.contains('night-mode');
}

function getColors() {
  if (isNightMode()) {
    return { bg: '#1a1e2b', txt: '#d4c4a8', frame: '#4a4e5e', frameInner: '#3a3e4e' };
  }
  return { bg: '#f5f0e8', txt: '#1a1a1a', frame: '#c4a87c', frameInner: '#b8956a' };
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

  const colors = getColors();

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  renderPageContent(ctx, data, pageFont, colors);

  drawPageFrame(ctx, colors);

  drawPageNumber(ctx, pageNum, colors);

  return { canvas, layout: data };
}

function measureLine(ctx, words, pageFont, fontSize) {
  return words.map(w => {
    const fn = w.font || pageFont;
    ctx.font = `${fontSize}px "${fn}", "Scheherazade New", serif`;
    return ctx.measureText(w.char).width;
  });
}

function renderPageContent(ctx, data, pageFont, colors) {
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

  const lineWidths = [];
  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (!line?.words || line.words.length === 0) { lineWidths.push(null); continue; }
    const widths = measureLine(ctx, line.words, pageFont, pageFontSize);
    const totalW = widths.reduce((a, b) => a + b, 0);
    const gap = line.words.length > 1 ? (availableW - totalW) / (line.words.length - 1) : 0;
    lineWidths.push({ widths, gap: Math.max(0, gap) });
  }

  ctx.textBaseline = 'middle';

  for (let i = 0; i < lineCount; i++) {
    const line = lines[i];
    if (!line?.words || line.words.length === 0) continue;

    const y = TOP_OFFSET + i * lineSpacing + (isShortPage ? 0 : stdLineHeight / 2);
    const words = line.words;
    const { widths, gap } = lineWidths[i];

    let x = CANVAS_W - PAD_H;

    for (let j = 0; j < words.length; j++) {
      const w = words[j];
      const fn = w.font || pageFont;
      ctx.font = `${pageFontSize}px "${fn}", "Scheherazade New", serif`;
      ctx.fillStyle = colors.txt;
      ctx.textAlign = 'right';
      ctx.fillText(w.char, x, y);
      x -= widths[j] + gap;
    }
  }
}

function drawPageNumber(ctx, pageNum, colors) {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H - 18;
  const numStr = pageNum.toLocaleString('ar-SA');
  ctx.font = 'bold 16px "Amiri", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isNightMode() ? '#6a6e7e' : '#8b6f5a';
  ctx.fillText(numStr, cx, cy);
}

function drawPageFrame(ctx, colors) {
  const m = 8;
  ctx.strokeStyle = colors.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(m, m, CANVAS_W - m * 2, CANVAS_H - m * 2);

  ctx.strokeStyle = colors.frameInner;
  ctx.lineWidth = 1;
  const gap = 6;
  ctx.strokeRect(m + gap, m + gap, CANVAS_W - (m + gap) * 2, CANVAS_H - (m + gap) * 2);
}
