import { JUZ_PAGES } from './config.js';
import { toArabicNumeral } from './utils.js';

const LAYOUT_BASE = 'https://raw.githubusercontent.com/zonetecde/mushaf-layout/refs/heads/main/mushaf/page-';
const layoutCache = new Map();
const dbName = 'mushaf-renderer-cache';
const STORE_NAME = 'page-layouts';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
  });
  return dbPromise;
}

async function getCachedLayout(pageNum) {
  if (layoutCache.has(pageNum)) return layoutCache.get(pageNum);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const req = store.get(pageNum);
      req.onsuccess = () => {
        if (req.result) layoutCache.set(pageNum, req.result);
        resolve(req.result || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function setCachedLayout(pageNum, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, pageNum);
  } catch { /* silent */ }
}

export async function ensurePageLayout(pageNum) {
  let cached = layoutCache.get(pageNum);
  if (cached) return cached;
  cached = await getCachedLayout(pageNum);
  if (cached) {
    layoutCache.set(pageNum, cached);
    return cached;
  }
  const padded = String(pageNum).padStart(3, '0');
  try {
    const res = await fetch(`${LAYOUT_BASE}${padded}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    layoutCache.set(pageNum, data);
    setCachedLayout(pageNum, data);
    return data;
  } catch { return null; }
}

export function setPageLayout(pageNum, data) {
  layoutCache.set(pageNum, data);
}

export async function cacheAllPageLayouts(onProgress) {
  const total = 604;
  for (let i = 1; i <= total; i++) {
    const exists = layoutCache.has(i) || await getCachedLayout(i);
    if (!exists) await ensurePageLayout(i);
    if (onProgress) onProgress(i, total);
  }
}

const CANVAS_W = 1080;
const CANVAS_H = 1540;
const PAD_H = 45;
const PAD_V = 50;
const TOP_BORDER_H = 44;
const BOTTOM_BAR_H = 36;

const BG = '#f5f0e8';
const TEXT_CLR = '#1a1a1a';
const GOLD = '#c9a96e';
const GOLD_DARK = '#b8924e';
const GOLD_LIGHT = '#e0c994';
const AYAH_CIRCLE = '#8b6f5a';
const AYAH_CIRCLE_TEXT = '#f5f0e8';
const HEADER_BG = '#c9a96e';
const HEADER_TEXT = '#ffffff';
const BASMALA_CLR = '#a0846c';
const JUZ_CLR = '#8b6f5a';
const LINE_NORMAL = 'Scheherazade New';
const LINE_DECOR = 'Amiri';

function getWordText(word) {
  if (word.qpcV2) {
    let t = word.qpcV2;
    const m = t.match(/([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s]+|\d+)$/);
    if (m && m[1]) {
      const numStr = m[1].replace(/\s/g, '');
      if (/^\d+$/.test(numStr)) {
        t = t.slice(0, -m[1].length).trim();
      }
    }
    return t.trim();
  }
  return word.word || '';
}

function getWordAyahNum(word) {
  if (!word.qpcV2) {
    const m = word.word.match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  }
  const m = word.qpcV2.match(/(\d+)$/);
  if (m) return parseInt(m[1], 10);
  const m2 = word.word.match(/(\d+)$/);
  return m2 ? parseInt(m2[1], 10) : null;
}

function groupWordsByAyah(words) {
  const ayahs = [];
  let currentAyah = [];
  let currentAyahNum = null;

  for (const word of words) {
    const parts = word.location.split(':');
    const ayahNum = parts.length >= 2 ? parseInt(parts[1], 10) : null;
    if (ayahNum !== null && ayahNum !== currentAyahNum && currentAyahNum !== null) {
      ayahs.push({ number: currentAyahNum, words: currentAyah });
      currentAyah = [];
    }
    currentAyah.push(word);
    if (ayahNum !== null) currentAyahNum = ayahNum;
  }
  if (currentAyah.length > 0 && currentAyahNum !== null) {
    ayahs.push({ number: currentAyahNum, words: currentAyah });
  }
  return ayahs;
}

function drawTopBorder(ctx, hasSurahHeader) {
  const y = 0;
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, y, CANVAS_W, 3);
  ctx.fillRect(0, y + 5, CANVAS_W, 1);

  if (!hasSurahHeader) {
    const diamondY = y + 8;
    for (let x = 60; x < CANVAS_W - 60; x += 320) {
      ctx.fillStyle = GOLD_LIGHT;
      ctx.beginPath();
      ctx.moveTo(x, diamondY + 6);
      ctx.lineTo(x + 6, diamondY + 12);
      ctx.lineTo(x, diamondY + 18);
      ctx.lineTo(x - 6, diamondY + 12);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawSurahHeader(ctx, layout) {
  const headerLine = layout.lines.find(l => l.type === 'surah-header');
  if (!headerLine) return false;

  const boxY = 8;
  const boxH = 36;
  const boxW = 340;
  const boxX = (CANVAS_W - boxW) / 2;

  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = GOLD;
  roundRect(ctx, boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = GOLD_DARK;
  ctx.fillRect(boxX + 4, boxY + 4, boxW - 8, boxH - 8);

  ctx.fillStyle = HEADER_TEXT;
  ctx.font = 'bold 20px "Amiri", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let surahName = headerLine.text || '';
  if (headerLine.surah) {
    const sNum = parseInt(headerLine.surah, 10);
    surahName = `سُورَةُ ${surahName.replace(/^سُورَةُ\s*/, '')}`;
  }
  ctx.fillText(surahName, CANVAS_W / 2, boxY + boxH / 2);

  return true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getJuzForPage(pageNum) {
  for (let i = JUZ_PAGES.length - 1; i >= 0; i--) {
    if (pageNum >= JUZ_PAGES[i]) return i + 1;
  }
  return 1;
}

function drawJuzMarker(ctx, pageNum) {
  const juz = getJuzForPage(pageNum);
  const juzStartPage = JUZ_PAGES[juz - 1];
  if (pageNum !== juzStartPage) return;

  const mx = 22;
  const my = 200;

  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(mx, my);
  ctx.quadraticCurveTo(2, my + 40, mx, my + 80);
  ctx.lineTo(mx - 12, my + 80);
  ctx.lineTo(mx - 12, my);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = JUZ_CLR;
  ctx.font = 'bold 11px "Amiri", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(mx - 6, my + 40);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`الجزء ${toArabicNumeral(juz)}`, 0, 0);
  ctx.restore();
}

function drawPageFooter(ctx, pageNum) {
  const fy = CANVAS_H - BOTTOM_BAR_H;

  ctx.fillStyle = GOLD;
  ctx.fillRect(0, fy, CANVAS_W, 1);

  const cx = CANVAS_W / 2;
  const cy = fy + (BOTTOM_BAR_H - 1) / 2;
  const rad = 13;

  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = HEADER_TEXT;
  ctx.font = 'bold 13px "Amiri", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(toArabicNumeral(pageNum), cx, cy);
}

function drawAyahNumber(ctx, centerX, y, number, fontSize) {
  const r = fontSize * 0.52;
  const cy = y - 1;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 2;

  ctx.beginPath();
  ctx.arc(centerX, cy, r + 1, 0, Math.PI * 2);
  ctx.fillStyle = AYAH_CIRCLE;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(centerX, cy, r - 2, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();

  ctx.strokeStyle = AYAH_CIRCLE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const numStr = toArabicNumeral(number);
  const numFs = Math.max(10, fontSize * 0.38);
  ctx.font = `bold ${numFs}px "${LINE_DECOR}", serif`;
  ctx.fillStyle = AYAH_CIRCLE_TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numStr, centerX, cy);

  ctx.restore();
}

export function renderPageToCanvas(pageNum, canvas, layout) {
  if (!layout) return false;

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const hasSurahHeader = !!layout.lines.find(l => l.type === 'surah-header');

  drawTopBorder(ctx, hasSurahHeader);

  drawJuzMarker(ctx, pageNum);

  const hasHeader = drawSurahHeader(ctx, layout);

  renderPageContent(ctx, layout, hasHeader);

  drawPageFooter(ctx, pageNum);

  return true;
}

function renderPageContent(ctx, layout, hasHeader) {
  const lines = layout.lines;
  if (!lines || lines.length === 0) return;

  const topOffset = PAD_V + TOP_BORDER_H + (hasHeader ? 44 : 18);
  const usableHeight = CANVAS_H - topOffset - BOTTOM_BAR_H - PAD_V;
  const textLines = lines.filter(l => l.type === 'text' || l.type === 'basmalah' || l.type === 'surah-type');
  const lineCount = textLines.length;
  if (lineCount === 0) return;

  const lineHeight = usableHeight / lineCount;
  const fontSize = Math.max(20, Math.min(38, lineHeight * 0.65));

  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  let lineIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.words || line.words.length === 0) continue;

    if (line.type === 'surah-header') continue;

    const y = topOffset + lineIdx * lineHeight + lineHeight / 2;

    if (line.type === 'basmalah') {
      ctx.font = `bold ${fontSize + 1}px "${LINE_NORMAL}", "${LINE_DECOR}", serif`;
      ctx.fillStyle = BASMALA_CLR;
      ctx.textAlign = 'center';
      const basmalaWord = line.words.find(w => getWordText(w).length > 0);
      const text = line.words.map(w => getWordText(w)).join(' ');
      ctx.fillText(text.trim(), CANVAS_W / 2, y);
      lineIdx++;
      continue;
    }

    renderLine(ctx, line, y, fontSize);
    lineIdx++;
  }
}

function renderLine(ctx, line, y, fontSize) {
  const ayahGroups = groupWordsByAyah(line.words);
  if (ayahGroups.length === 0) {
    renderWordsInline(ctx, line.words, y, fontSize, 0);
    return;
  }

  const totalGroups = ayahGroups.length;
  const groupInfo = ayahGroups.map(g => ({
    number: g.number,
    words: g.words,
    w: g.words.reduce((sum, w) => sum + ctx.measureText(getWordText(w)).width, 0),
  }));

  const totalContentW = groupInfo.reduce((sum, g) => sum + g.w, 0);
  const ayahMarkersW = totalGroups * 34;
  const availableW = CANVAS_W - PAD_H * 2 - ayahMarkersW;
  const gapsTotal = Math.max(0, availableW - totalContentW);
  const gap = (totalGroups > 1) ? gapsTotal / (totalGroups - 1) : 0;

  ctx.font = `500 ${fontSize}px "${LINE_NORMAL}", "${LINE_DECOR}", serif`;
  ctx.fillStyle = TEXT_CLR;
  ctx.textAlign = 'right';

  let x = CANVAS_W - PAD_H;

  for (let g = 0; g < totalGroups; g++) {
    const { words, number } = ayahGroups[g];
    const wordTexts = words.map(w => getWordText(w));
    const widths = wordTexts.map(t => ctx.measureText(t).width);
    const totalW = widths.reduce((a, b) => a + b, 0);
    const wordGap = words.length > 1 ? (groupInfo[g].w - totalW) / (words.length - 1) : 0;

    for (let j = words.length - 1; j >= 0; j--) {
      x -= widths[j];
      ctx.fillText(wordTexts[j], x, y);
      if (j > 0) x -= wordGap;
    }

    x -= 17;
    drawAyahNumber(ctx, x - 14, y, number, fontSize);
    x -= 34;

    if (g < totalGroups - 1) {
      x -= gap;
    }
  }
}

function renderWordsInline(ctx, words, y, fontSize, startX) {
  ctx.font = `500 ${fontSize}px "${LINE_NORMAL}", "${LINE_DECOR}", serif`;
  ctx.fillStyle = TEXT_CLR;
  ctx.textAlign = 'right';
  let x = CANVAS_W - PAD_H - startX;
  for (let j = words.length - 1; j >= 0; j--) {
    const text = getWordText(words[j]);
    const w = ctx.measureText(text).width;
    x -= w;
    ctx.fillText(text, x, y);
    if (j > 0) x -= 2;
  }
}

export function getPageImageDataUrl(pageNum) {
  const layout = layoutCache.get(pageNum);
  if (!layout) return null;

  const canvas = document.createElement('canvas');
  const ok = renderPageToCanvas(pageNum, canvas, layout);
  if (!ok) return null;
  return canvas.toDataURL('image/png');
}
