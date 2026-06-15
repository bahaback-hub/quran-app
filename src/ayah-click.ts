import { state } from './state.js';
import { getLineY, CANVAS_H } from './mushaf-renderer.js';

/** Result of an ayah lookup from a click. */
interface AyahInfo {
  surah: number;
  ayah: number;
}

/** A single word in a mushaf layout line. */
interface LayoutWord {
  char?: string;
  word?: string;
  type?: string;
  verse_key?: string;
  location?: string;
  font?: string;
}

/** A single line in a mushaf page layout. */
interface LayoutLine {
  words?: LayoutWord[];
}

/** A mushaf page layout. */
interface PageLayout {
  lines: LayoutLine[];
}

/** A rectangle for ayah highlighting. */
export interface HighlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function arabicCharCount(str: string): number {
  return (str.match(/[\u0621-\u064A\u0660-\u0669]/g) || []).length;
}

function getAyahFromWord(word: LayoutWord): AyahInfo | null {
  if (word.verse_key) {
    const parts = word.verse_key.split(':');
    if (parts.length >= 2) {
      return { surah: parseInt(parts[0]!, 10), ayah: parseInt(parts[1]!, 10) };
    }
  }
  if (word.location) {
    const parts = word.location.split(':');
    if (parts.length >= 2) {
      return { surah: parseInt(parts[0]!, 10), ayah: parseInt(parts[1]!, 10) };
    }
  }
  return null;
}

export async function handlePageClick(
  pageNum: number,
  clickX: number,
  clickY: number,
  imgWidth: number,
  imgHeight: number,
  layout: PageLayout | null,
): Promise<AyahInfo | null> {
  if (!layout) {
    return null;
  }

  const totalLines = layout.lines.length;
  if (totalLines === 0) {
    return null;
  }

  let lineIndex = -1;
  for (let i = 0; i < totalLines; i++) {
    const lineTop = getLineY(i, totalLines, imgHeight);
    const lineBottom = getLineY(i + 1, totalLines, imgHeight);
    if (clickY >= lineTop && clickY < lineBottom) {
      lineIndex = i;
      break;
    }
  }
  if (lineIndex < 0) {
    lineIndex = Math.min(totalLines - 1, Math.floor(clickY / (imgHeight / totalLines)));
  }
  if (lineIndex < 0 || lineIndex >= totalLines) {
    return null;
  }

  const line = layout.lines[lineIndex];
  if (!line || !line.words || line.words.length === 0) {
    return null;
  }

  const words = line.words.filter((w: LayoutWord) => w.type !== 'end');
  if (words.length === 0) {
    return null;
  }

  const charCounts = words.map((w: LayoutWord) => Math.max(1, arabicCharCount(w.char || w.word || '')));
  const totalChars = charCounts.reduce((a: number, b: number) => a + b, 0);

  const rtlX = imgWidth - clickX;

  let cumWidth = 0;
  for (let i = 0; i < words.length; i++) {
    const wordWidth = (charCounts[i]! / totalChars) * imgWidth;
    const wordStart = cumWidth;
    const wordEnd = cumWidth + wordWidth;
    if (rtlX >= wordStart && rtlX <= wordEnd) {
      const info = getAyahFromWord(words[i]!);
      if (info) {
        return info;
      }
    }
    cumWidth += wordWidth;
  }

  return null;
}

export async function getAyahHighlightRects(
  pageNum: number,
  surah: number,
  ayah: number,
  imgWidth: number,
  imgHeight: number,
  layout: PageLayout | null,
): Promise<HighlightRect[]> {
  if (!layout) {
    return [];
  }

  const totalLines = layout.lines.length;
  if (totalLines === 0) {
    return [];
  }
  const lineHeight = imgHeight / totalLines;

  const rects: HighlightRect[] = [];

  for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
    const line = layout.lines[lineIndex];
    if (!line || !line.words || line.words.length === 0) {
      continue;
    }

    const words = line.words.filter((w: LayoutWord) => w.type !== 'end');
    if (words.length === 0) {
      continue;
    }

    const ayahWordIndices: number[] = [];
    for (let i = 0; i < words.length; i++) {
      const info = getAyahFromWord(words[i]!);
      if (info && info.surah === surah && info.ayah === ayah) {
        ayahWordIndices.push(i);
      }
    }
    if (ayahWordIndices.length === 0) {
      continue;
    }

    const charCounts = words.map((w: LayoutWord) => Math.max(1, arabicCharCount(w.char || w.word || '')));
    const totalChars = charCounts.reduce((a: number, b: number) => a + b, 0);

    let minRtl = Infinity;
    let maxRtl = -Infinity;
    let cumWidth = 0;
    for (let i = 0; i < words.length; i++) {
      const wordWidth = (charCounts[i]! / totalChars) * imgWidth;
      const wordStart = cumWidth;
      const wordEnd = cumWidth + wordWidth;
      if (ayahWordIndices.includes(i)) {
        if (wordStart < minRtl) {
          minRtl = wordStart;
        }
        if (wordEnd > maxRtl) {
          maxRtl = wordEnd;
        }
      }
      cumWidth += wordWidth;
    }

    if (maxRtl <= minRtl) {
      continue;
    }

    const lineTop = getLineY(lineIndex, totalLines, imgHeight);
    const nextLineTop = getLineY(lineIndex + 1, totalLines, imgHeight);
    const actualLineHeight = nextLineTop - lineTop;

    rects.push({
      left: imgWidth - maxRtl,
      top: lineTop,
      width: maxRtl - minRtl,
      height: actualLineHeight || lineHeight,
    });
  }

  return rects;
}
