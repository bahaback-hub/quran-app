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

function renderPageContent(ctx, data, pageFont) {
  const lines = data.lines;
  if (!lines || lines.length === 0) return;

  const isFirstSurahPage = lines[0]?.words?.[0]?.type === 'surah_header';
  const topMargin = TOP_OFFSET + (isFirstSurahPage ? 10 : 0);
  const usableHeight = CANVAS_H - topMargin - BOTTOM_OFFSET - PAD_V;
  const lineCount = lines.length;
  const lineHeight = usableHeight / lineCount;
  const fontSize = Math.max(22, Math.min(42, lineHeight * 0.78));

  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line?.words || line.words.length === 0) continue;

    const y = topMargin + i * lineHeight + lineHeight / 2;

    const ayahEndIdx = line.words.findIndex(w => w.type === 'end');
    const mainWords = ayahEndIdx >= 0 ? line.words.slice(0, ayahEndIdx) : line.words.filter(w => w.type !== 'end');
    const endMarkers = line.words.filter(w => w.type === 'end');

    if (mainWords.length === 0) {
      for (const m of endMarkers) {
        renderWord(ctx, m, pageFont, fontSize, CANVAS_W / 2, y);
      }
      continue;
    }

    const measureFont = pageFont;
    ctx.font = `${fontSize}px "${measureFont}", "Scheherazade New", serif`;
    const totalContentW = mainWords.reduce((sum, w) => {
      const fn = w.font || pageFont;
      ctx.font = `${fontSize}px "${fn}", "Scheherazade New", serif`;
      return sum + ctx.measureText(w.char).width;
    }, 0);

    const markersW = endMarkers.reduce((sum, m) => {
      ctx.font = `${fontSize}px "${m.font || pageFont}", "Scheherazade New", serif`;
      return sum + ctx.measureText(m.char).width + 10;
    }, 0);

    const availableW = CANVAS_W - PAD_H * 2 - markersW;
    const gapsTotal = Math.max(0, availableW - totalContentW);
    const wordGap = mainWords.length > 1 ? gapsTotal / (mainWords.length - 1) : 0;

    let x = CANVAS_W - PAD_H;

    for (let j = mainWords.length - 1; j >= 0; j--) {
      const w = mainWords[j];
      const fn = w.font || pageFont;
      ctx.font = `${fontSize}px "${fn}", "Scheherazade New", serif`;
      const charW = ctx.measureText(w.char).width;
      x -= charW;
      ctx.fillStyle = PAGE_TXT_COLOR;
      ctx.textAlign = 'right';
      ctx.fillText(w.char, x, y);
      if (j > 0) x -= wordGap;
    }

    x -= 8;
    for (const m of endMarkers) {
      const fn = m.font || pageFont;
      ctx.font = `${fontSize}px "${fn}", "Scheherazade New", serif`;
      const charW = ctx.measureText(m.char).width;
      x -= charW;
      ctx.fillStyle = PAGE_TXT_COLOR;
      ctx.fillText(m.char, x, y);
      x -= 6;
    }
  }
}

function renderWord(ctx, word, defaultFont, fontSize, x, y) {
  const fn = word.font || defaultFont;
  ctx.font = `${fontSize}px "${fn}", "Scheherazade New", serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = PAGE_TXT_COLOR;
  ctx.fillText(word.char, x, y);
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
