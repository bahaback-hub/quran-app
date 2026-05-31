import { state } from "./state.js";

function arabicCharCount(str) {
  return (str.match(/[\u0621-\u064A\u0660-\u0669]/g) || []).length;
}

function getAyahFromWord(word) {
  if (word.verse_key) {
    const parts = word.verse_key.split(':');
    if (parts.length >= 2) {
      return { surah: parseInt(parts[0], 10), ayah: parseInt(parts[1], 10) };
    }
  }
  if (word.location) {
    const parts = word.location.split(':');
    if (parts.length >= 2) {
      return { surah: parseInt(parts[0], 10), ayah: parseInt(parts[1], 10) };
    }
  }
  return null;
}

export async function handlePageClick(pageNum, clickX, clickY, imgWidth, imgHeight, layout) {
  if (!layout) return null;

  const totalLines = layout.lines.length;
  if (totalLines === 0) return null;

  const lineHeight = imgHeight / totalLines;
  const lineIndex = Math.floor(clickY / lineHeight);
  if (lineIndex < 0 || lineIndex >= totalLines) return null;

  const line = layout.lines[lineIndex];
  if (!line || !line.words || line.words.length === 0) return null;

  const words = line.words.filter(w => w.type !== 'end');
  if (words.length === 0) return null;

  const charCounts = words.map(w => Math.max(1, arabicCharCount(w.char || w.word || '')));
  const totalChars = charCounts.reduce((a, b) => a + b, 0);

  const rtlX = imgWidth - clickX;

  let cumWidth = 0;
  for (let i = 0; i < words.length; i++) {
    const wordWidth = (charCounts[i] / totalChars) * imgWidth;
    const wordStart = cumWidth;
    const wordEnd = cumWidth + wordWidth;
    if (rtlX >= wordStart && rtlX <= wordEnd) {
      const info = getAyahFromWord(words[i]);
      if (info) return info;
    }
    cumWidth += wordWidth;
  }

  return null;
}

export async function getAyahHighlightRects(pageNum, surah, ayah, imgWidth, imgHeight, layout) {
  if (!layout) return [];

  const totalLines = layout.lines.length;
  if (totalLines === 0) return [];
  const lineHeight = imgHeight / totalLines;

  const rects = [];

  for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
    const line = layout.lines[lineIndex];
    if (!line || !line.words || line.words.length === 0) continue;

    const words = line.words.filter(w => w.type !== 'end');
    if (words.length === 0) continue;

    const ayahWordIndices = [];
    for (let i = 0; i < words.length; i++) {
      const info = getAyahFromWord(words[i]);
      if (info && info.surah === surah && info.ayah === ayah) {
        ayahWordIndices.push(i);
      }
    }
    if (ayahWordIndices.length === 0) continue;

    const charCounts = words.map(w => Math.max(1, arabicCharCount(w.char || w.word || '')));
    const totalChars = charCounts.reduce((a, b) => a + b, 0);

    let minRtl = Infinity;
    let maxRtl = -Infinity;
    let cumWidth = 0;
    for (let i = 0; i < words.length; i++) {
      const wordWidth = (charCounts[i] / totalChars) * imgWidth;
      const wordStart = cumWidth;
      const wordEnd = cumWidth + wordWidth;
      if (ayahWordIndices.includes(i)) {
        if (wordStart < minRtl) minRtl = wordStart;
        if (wordEnd > maxRtl) maxRtl = wordEnd;
      }
      cumWidth += wordWidth;
    }

    if (maxRtl <= minRtl) continue;

    rects.push({
      left: imgWidth - maxRtl,
      top: lineIndex * lineHeight,
      width: maxRtl - minRtl,
      height: lineHeight,
    });
  }

  return rects;
}
