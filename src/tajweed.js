/**
 * Tajweed coloring for Quran text (Mushaf Mujawwad style).
 * Uses CSS classes + text-shadow since some fonts (Amiri) ignore
 * the `color` property on combining marks.
 */

const DIACRITIC_CLASS = {
  '\u064E': 'tw-fatha',
  '\u064F': 'tw-damma',
  '\u0650': 'tw-kasra',
  '\u064B': 'tw-fathatan',
  '\u064C': 'tw-dammatan',
  '\u064D': 'tw-kasratan',
  '\u0651': 'tw-shadda',
  '\u0652': 'tw-sukun',
  '\u0653': 'tw-madd',
  '\u0670': 'tw-madd',
};

function isDiacritic(ch) {
  const c = ch.charCodeAt(0);
  return (c >= 0x064B && c <= 0x0653) || c === 0x0670;
}

/**
 * Return HTML for a word with tajweed-colored diacritics.
 * @param {string} word - A single word of Arabic text.
 * @returns {string} HTML string with colored spans.
 */
export function tajweedColor(word) {
  let result = '';
  let i = 0;
  while (i < word.length) {
    result += word[i];
    i++;
    while (i < word.length && isDiacritic(word[i])) {
      const cls = DIACRITIC_CLASS[word[i]];
      result += cls ? `<span class="${cls}">${word[i]}</span>` : word[i];
      i++;
    }
  }
  return result;
}
