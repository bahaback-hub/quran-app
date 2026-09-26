/**
 * Mushaf — page geometry.
 *
 * Canvas dimensions and line positioning, kept apart from the renderer so
 * lightweight consumers (ayah hit-testing) can import the numbers without
 * pulling the whole Canvas renderer — and its 48 QCF4 font faces — into the
 * first-paint bundle.
 */

const MOBILE_CANVAS_W = 720;
const MOBILE_CANVAS_H = 1028; // Maintains 7:10 aspect ratio
const DESKTOP_CANVAS_W = 1080;
const DESKTOP_CANVAS_H = 1540;

/** A single word box in a mushaf line (canvas px coordinates). */
export interface PageWordBox {
  /** Right edge of the word box (text is right-aligned at this x). */
  x: number;
  /** Measured glyph width in canvas pixels. */
  width: number;
  char?: string;
  font: string;
  type?: string;
  verse_key?: string;
  location?: string;
  word?: string;
}

/** A single laid-out mushaf line (canvas px coordinates). */
export interface PageLineBox {
  y: number;
  lineHeight: number;
  gap: number;
  totalWidth: number;
  words: PageWordBox[];
  /** Glyph ink that rises ABOVE the line's vertical center (canvas px). Text is painted with textBaseline 'middle'. */
  inkAscent?: number;
  /** Glyph ink that hangs BELOW the line's vertical center (canvas px). */
  inkDescent?: number;
}

/** Full measured layout of a mushaf page — mirrors exactly how the page is painted. */
export interface MushafLineLayout {
  lines: PageLineBox[];
  isOpeningPage: boolean;
  isShortPage: boolean;
  stdLineHeight: number;
  pageFontSize: number;
  availableW: number;
  textRight: number;
}

export const PAD_H = 30;
export const PAD_V = 30;
export const TOP_OFFSET = 30;
export const BOTTOM_OFFSET = 50;
export const STD_LINES = 15;

/** Detect if device is mobile (low memory).
 *  Only genuinely phone-sized viewports get the reduced canvas. A large
 *  Android display (tablet / TV) must render at full resolution instead of
 *  being classified as mobile just because the user agent contains "Android". */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const width = window.innerWidth;
  return (
    width <= 600 ||
    (navigator.maxTouchPoints > 1 && width <= 900) ||
    (/Mobi|iPhone|iPod/i.test(navigator.userAgent) && width <= 700)
  );
}

/** Get optimal canvas dimensions based on device */
function getCanvasDimensions(): { width: number; height: number } {
  return isMobileDevice()
    ? { width: MOBILE_CANVAS_W, height: MOBILE_CANVAS_H }
    : { width: DESKTOP_CANVAS_W, height: DESKTOP_CANVAS_H };
}

export const CANVAS_W = getCanvasDimensions().width;
export const CANVAS_H = getCanvasDimensions().height;

export function getLineY(lineIndex: number, lineCount: number, imgHeight: number): number {
  if (lineIndex <= 0) {
    return 0;
  }
  if (lineIndex >= lineCount) {
    return imgHeight;
  }
  const usableHeight = CANVAS_H - TOP_OFFSET - BOTTOM_OFFSET - PAD_V;
  const stdLineHeight = usableHeight / STD_LINES;
  const isShortPage = lineCount < STD_LINES;
  const lineSpacing = isShortPage ? (usableHeight - stdLineHeight) / Math.max(1, lineCount - 1) : stdLineHeight;
  const y = TOP_OFFSET + lineIndex * lineSpacing + (isShortPage ? 0 : stdLineHeight / 2);
  return (y / CANVAS_H) * imgHeight;
}
