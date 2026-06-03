/**
 * Tajweed coloring for Quran text (Mushaf Mujawwad style).
 * Wraps each base-letter + diacritic group in colored spans,
 * keeping each diacritic adjacent to its base character.
 */

const DIACRITIC_COLORS = {
  '\u064E': '#e74c3c', // fatha
  '\u064F': '#e74c3c', // damma
  '\u0650': '#e74c3c', // kasra
  '\u064B': '#27ae60', // fathatan
  '\u064C': '#27ae60', // dammatan
  '\u064D': '#27ae60', // kasratan
  '\u0651': '#2980b9', // shadda
  '\u0652': '#8e44ad', // sukun
  '\u0653': '#b7950b', // madd
  '\u0670': '#b7950b', // superscript alef (madd-like)
};

/** Check if a character is a combining diacritic mark. */
function isDiacritic(ch) {
  const c = ch.charCodeAt(0);
  return (c >= 0x064B && c <= 0x0653) || c === 0x0670;
}

/**
 * Return HTML for a word with tajweed-colored diacritics.
 * Groups each base letter with its following diacritics into one <span>
 * so the colored mark stays visually attached to its base.
 * @param {string} word - A single word of Arabic text.
 * @returns {string} HTML string with colored spans.
 */
export function tajweedColor(word) {
  let result = '';
  // Walk through the word grouping: base chars + their following diacritics
  let i = 0;
  while (i < word.length) {
    const base = word[i];
    result += base;
    i++;
    // Collect following diacritics
    while (i < word.length && isDiacritic(word[i])) {
      const ch = word[i];
      const color = DIACRITIC_COLORS[ch];
      if (color) {
        result += `<span style="color:${color}">${ch}</span>`;
      } else {
        result += ch;
      }
      i++;
    }
  }
  return result;
}
