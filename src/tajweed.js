/**
 * Tajweed coloring for Quran text using cpfair's annotation offsets.
 * Each annotation specifies a character range and rule type within an ayah.
 */

const RULE_COLORS = {
  'hamzat_wasl':         '#a5a5a5',
  'lam_shamsiyyah':      '#2fadff',
  'madd_2':              '#ce9e00',
  'madd_246':            '#ff7b00',
  'madd_6':              '#b50000',
  'madd_munfasil':       '#ff7b00',
  'madd_muttasil':       '#f40000',
  'ghunnah':             '#09b000',
  'ikhfa':               '#09b000',
  'ikhfa_shafawi':       '#09b000',
  'iqlab':               '#09b000',
  'idghaam_ghunnah':     '#a5a5a5',
  'idghaam_no_ghunnah':  '#a5a5a5',
  'idghaam_mutajanisayn':'#a5a5a5',
  'idghaam_mutaqaribayn':'#a5a5a5',
  'idghaam_shafawi':     '#a5a5a5',
  'qalqalah':            '#2fadff',
  'silent':              '#8e44ad',
};

const NIGHT_COLORS = {
  'hamzat_wasl':         '#999999',
  'lam_shamsiyyah':      '#00deff',
  'madd_2':              '#ffc1e0',
  'madd_246':            '#ff8e3b',
  'madd_6':              '#e30000',
  'madd_munfasil':       '#ff8e3b',
  'madd_muttasil':       '#ff5e8e',
  'ghunnah':             '#26b55d',
  'ikhfa':               '#26b55d',
  'ikhfa_shafawi':       '#26b55d',
  'iqlab':               '#26b55d',
  'idghaam_ghunnah':     '#999999',
  'idghaam_no_ghunnah':  '#999999',
  'idghaam_mutajanisayn':'#999999',
  'idghaam_mutaqaribayn':'#999999',
  'idghaam_shafawi':     '#999999',
  'qalqalah':            '#00deff',
  'silent':              '#af7ac5',
};

const SEPIA_COLORS = {
  'madd_6':              '#b7001c',
};

/**
 * Get the color for a tajweed rule based on current theme.
 * @param {string} rule
 * @returns {string}
 */
function getColor(rule) {
  const body = document.body;
  if (body && body.classList.contains('night-mode')) {
    return NIGHT_COLORS[rule] || RULE_COLORS[rule] || '#000';
  }
  if (body && body.classList.contains('sepia-mode')) {
    return SEPIA_COLORS[rule] || RULE_COLORS[rule] || '#000';
  }
  return RULE_COLORS[rule] || '#000';
}

/**
 * Build a fast position→color lookup for an entire ayah.
 * @param {{rule:string, start:number, end:number}[]} annotations
 * @returns {Map<number, string>} position → color
 */
export function buildColorMap(annotations) {
  const map = new Map();
  for (const ann of annotations) {
    const color = getColor(ann.rule);
    for (let pos = ann.start; pos < ann.end; pos++) {
      map.set(pos, color);
    }
  }
  return map;
}

/**
 * Apply tajweed coloring to a single word using the ayah's color map.
 * @param {string} word - A single word of Arabic text.
 * @param {number} wordOffset - The character offset of this word within the full ayah text.
 * @param {Map<number, string>} colorMap - Position→color lookup for the ayah.
 * @returns {string} HTML string with colored spans.
 */
export function tajweedColorWord(word, wordOffset, colorMap) {
  if (!colorMap || colorMap.size === 0) return word;

  let result = '';
  let i = 0;
  while (i < word.length) {
    const absPos = wordOffset + i;
    const color = colorMap.get(absPos);
    if (color) {
      const start = i;
      while (i < word.length && colorMap.get(wordOffset + i) === color) {
        i++;
      }
      result += `<span style="color:${color}">${word.substring(start, i)}</span>`;
    } else {
      result += word[i];
      i++;
    }
  }
  return result;
}
