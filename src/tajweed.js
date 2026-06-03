/**
 * Tajweed coloring for Quran text (Mushaf Mujawwad style).
 * Wraps each diacritic mark in a colored <span>.
 */

const DIACRITIC_MAP = {
  '\u064B': 'tw-fathatan',
  '\u064C': 'tw-dammatan',
  '\u064D': 'tw-kasratan',
  '\u064E': 'tw-fatha',
  '\u064F': 'tw-damma',
  '\u0650': 'tw-kasra',
  '\u0651': 'tw-shadda',
  '\u0652': 'tw-sukun',
  '\u0653': 'tw-madd',
  '\u0670': 'tw-madd',
};

/**
 * Return HTML for a word with tajweed-colored diacritics.
 * @param {string} word - A single word of Arabic text.
 * @returns {string} HTML string with colored spans for diacritics.
 */
export function tajweedColor(word) {
  let result = '';
  for (const ch of word) {
    const cls = DIACRITIC_MAP[ch];
    if (cls) {
      result += `<span class="${cls}">${ch}</span>`;
    } else {
      result += ch;
    }
  }
  return result;
}
