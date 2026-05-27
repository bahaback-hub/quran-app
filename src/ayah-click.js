import { state } from "./state.js";

const LAYOUT_BASE = 'https://raw.githubusercontent.com/zonetecde/mushaf-layout/refs/heads/main/mushaf/page-';
const layoutCache = new Map();

async function getPageLayout(pageNum) {
  if (layoutCache.has(pageNum)) return layoutCache.get(pageNum);
  const padded = String(pageNum).padStart(3, '0');
  try {
    const res = await fetch(`${LAYOUT_BASE}${padded}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    layoutCache.set(pageNum, data);
    return data;
  } catch {
    return null;
  }
}

function arabicCharCount(str) {
  return (str.match(/[\u0621-\u064A\u0660-\u0669]/g) || []).length;
}

/**
 * Handle a click on a mushaf page image.
 * @param {number} pageNum - Mushaf page number (1-604)
 * @param {number} clickX - X coordinate relative to image left edge (px)
 * @param {number} clickY - Y coordinate relative to image top edge (px)
 * @param {number} imgWidth - Displayed image width (px)
 * @param {number} imgHeight - Displayed image height (px)
 * @returns {Promise<{surah: number, ayah: number}|null>}
 */
export async function handlePageClick(pageNum, clickX, clickY, imgWidth, imgHeight) {
  const layout = await getPageLayout(pageNum);
  if (!layout) return null;

  const totalLines = layout.lines.length;
  if (totalLines === 0) return null;

  const lineHeight = imgHeight / totalLines;
  const lineIndex = Math.floor(clickY / lineHeight);
  if (lineIndex < 0 || lineIndex >= totalLines) return null;

  const line = layout.lines[lineIndex];
  if (!line || line.type !== 'text') return null;

  const words = line.words || [];
  if (words.length === 0) return null;

  const charCounts = words.map(w => Math.max(1, arabicCharCount(w.word)));
  const totalChars = charCounts.reduce((a, b) => a + b, 0);

  // RTL: word[0] is rightmost. Flip clickX so 0 = right edge.
  const rtlX = imgWidth - clickX;

  let cumWidth = 0;
  for (let i = 0; i < words.length; i++) {
    const wordWidth = (charCounts[i] / totalChars) * imgWidth;
    const wordStart = cumWidth;
    const wordEnd = cumWidth + wordWidth;
    if (rtlX >= wordStart && rtlX <= wordEnd) {
      const parts = words[i].location.split(':');
      if (parts.length >= 2) {
        return { surah: parseInt(parts[0], 10), ayah: parseInt(parts[1], 10) };
      }
    }
    cumWidth += wordWidth;
  }

  return null;
}
