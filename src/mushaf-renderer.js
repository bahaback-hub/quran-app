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
const PADDING_H = 36;
const PADDING_V = 40;
const TEXT_COLOR = '#1a1a1a';
const BG_COLOR = '#f5f0e8';
const AYAH_CIRCLE_COLOR = '#8b6f5a';
const BASMALA_COLOR = '#a0846c';

function arabicCharCount(str) {
  return (str.match(/[\u0621-\u064A\u0660-\u0669]/g) || []).length;
}

export function renderPageToCanvas(pageNum, canvas, layout) {
  if (!layout) return false;

  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  let juz = 1;
  for (let i = JUZ_PAGES.length - 1; i >= 0; i--) {
    if (pageNum >= JUZ_PAGES[i]) { juz = i + 1; break; }
  }
  renderPageDecorations(ctx, pageNum, juz);

  renderPageContent(ctx, layout);

  renderPageFooter(ctx, pageNum);

  return true;
}

function renderPageDecorations(ctx, pageNum, juz) {
  ctx.fillStyle = '#d4c5a9';
  ctx.fillRect(0, 0, CANVAS_W, 3);
  ctx.fillRect(0, CANVAS_H - 30, CANVAS_W, 1);

  ctx.font = 'bold 18px "Amiri", "Traditional Arabic", serif';
  ctx.fillStyle = '#8b6f5a';
  ctx.textAlign = 'center';
  ctx.fillText(`الجزء ${toArabicNumeral(juz)}`, CANVAS_W / 2, 28);
}

function renderPageFooter(ctx, pageNum) {
  ctx.font = 'bold 20px "Amiri", "Traditional Arabic", serif';
  ctx.fillStyle = '#8b6f5a';
  ctx.textAlign = 'center';
  ctx.fillText(toArabicNumeral(pageNum), CANVAS_W / 2, CANVAS_H - 6);
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

function renderPageContent(ctx, layout) {
  const lines = layout.lines;
  if (!lines || lines.length === 0) return;

  const usableHeight = CANVAS_H - PADDING_V * 2 - 40;
  const lineHeight = usableHeight / lines.length;
  const fontSize = Math.max(18, Math.min(36, lineHeight * 0.65));

  ctx.textAlign = 'right';
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.words || line.words.length === 0) continue;

    const y = PADDING_V + 30 + i * lineHeight + lineHeight / 2;

    if (line.type === 'basmalah') {
      ctx.font = `bold ${fontSize + 2}px "Amiri", "Traditional Arabic", serif`;
      ctx.fillStyle = BASMALA_COLOR;
      ctx.textAlign = 'center';
      const text = line.words.map(w => w.word).join(' ');
      ctx.fillText(text, CANVAS_W / 2, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = TEXT_COLOR;
      continue;
    }

    ctx.font = `500 ${fontSize}px "Scheherazade New", "Amiri", "Traditional Arabic", serif`;
    ctx.fillStyle = TEXT_COLOR;

    const words = line.words;
    const wordWidths = words.map(w => ctx.measureText(w.word).width);
    const totalContentWidth = wordWidths.reduce((a, b) => a + b, 0);
    const availableWidth = CANVAS_W - PADDING_H * 2;

    const ayahGroups = groupWordsByAyah(words);

    let totalWidth = 0;
    const ayahMarkers = [];
    for (const group of ayahGroups) {
      const groupWidth = group.words.reduce((sum, w) => sum + ctx.measureText(w.word).width, 0);
      ayahMarkers.push({ number: group.number, width: groupWidth });
      totalWidth += groupWidth + (ayahMarkers.length > 1 ? 40 : 0);
    }

    const gap = (ayahMarkers.length > 1 && totalWidth < availableWidth)
      ? (availableWidth - totalWidth) / (ayahMarkers.length - 1)
      : 0;

    let x = CANVAS_W - PADDING_H;

    for (let g = 0; g < ayahGroups.length; g++) {
      const group = ayahGroups[g];
      const ayahWidth = ayahMarkers[g].width;

      const words = group.words;
      const widths = words.map(w => ctx.measureText(w.word).width);
      const totalWordsWidth = widths.reduce((a, b) => a + b, 0);

      const wordGap = words.length > 1
        ? (ayahWidth - totalWordsWidth) / (words.length - 1)
        : 0;

      for (let j = words.length - 1; j >= 0; j--) {
        x -= widths[j];
        ctx.fillText(words[j].word, x, y);
        if (j > 0) x -= wordGap;
      }

      x -= 20;

      drawAyahNumber(ctx, x - 14, y, ayahMarkers[g].number, fontSize);

      x -= 34;

      if (g < ayahGroups.length - 1) {
        x -= gap;
      }
    }
  }
}

function drawAyahNumber(ctx, x, y, number, fontSize) {
  const r = fontSize * 0.55;
  ctx.beginPath();
  ctx.arc(x + r, y - 2, r, 0, Math.PI * 2);
  ctx.fillStyle = AYAH_CIRCLE_COLOR;
  ctx.fill();
  ctx.strokeStyle = '#f5f0e8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const numStr = toArabicNumeral(number);
  const numFontSize = Math.max(10, fontSize * 0.4);
  ctx.font = `bold ${numFontSize}px "Amiri", "Traditional Arabic", serif`;
  ctx.fillStyle = '#f5f0e8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numStr, x + r, y - 2);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
}

export function getPageImageDataUrl(pageNum) {
  const layout = layoutCache.get(pageNum);
  if (!layout) return null;

  const canvas = document.createElement('canvas');
  const ok = renderPageToCanvas(pageNum, canvas, layout);
  if (!ok) return null;
  return canvas.toDataURL('image/png');
}
