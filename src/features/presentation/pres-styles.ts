import { buildColorMap, tajweedColorWord } from '../../tajweed.js';
import { getAyahAnnotations } from '../../tajweed-data.js';
import type { TajweedAnnotation } from '../../tajweed-data.js';
import { escapeHtml } from '../../utils.js';

/** Build the HTML string for an ayah, optionally applying tajweed coloring.
 *  @param tajweedEnabled — whether tajweed coloring is active (presentation-local toggle). */
export function buildAyahHtml(text: string, surahNum: number, ayahNum: number, tajweedEnabled: boolean): string {
  let txt = text;
  let offsetAdj = 0;
  if (surahNum !== 1 && ayahNum === 1) {
    const stripped = txt.replace(
      /^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u,
      '',
    );
    offsetAdj = txt.length - stripped.length;
    txt = stripped;
  }
  if (!tajweedEnabled) {
    return escapeHtml(txt);
  }
  const annotations = getAyahAnnotations(surahNum, ayahNum);
  if (annotations.length === 0) {
    return escapeHtml(txt);
  }
  const adjusted =
    offsetAdj > 0
      ? annotations.map((ann: TajweedAnnotation) => ({
          rule: ann.rule,
          start: ann.start - offsetAdj,
          end: ann.end - offsetAdj,
        }))
      : annotations;
  const colorMap = buildColorMap(adjusted);
  const words = txt.split(/\s+/).filter((w) => w.length > 0);
  let outputPos = 0;
  return words
    .map((word: string, idx: number) => {
      const wordHtml = tajweedColorWord(word, outputPos, colorMap);
      outputPos += word.length + (idx < words.length - 1 ? 1 : 0); // +1 for space between words
      return wordHtml;
    })
    .join(' ');
}
