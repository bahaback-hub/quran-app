/**
 * Tajweed coloring for Quran text using cpfair's annotation offsets.
 * Each annotation specifies a character range and rule type within an ayah.
 */

import type { TajweedAnnotation } from './tajweed-data.js';
import { escapeHtml } from './utils.js';

export type TajweedRule =
  | 'hamzat_wasl'
  | 'lam_shamsiyyah'
  | 'madd_2'
  | 'madd_246'
  | 'madd_6'
  | 'madd_munfasil'
  | 'madd_muttasil'
  | 'ghunnah'
  | 'ikhfa'
  | 'ikhfa_shafawi'
  | 'iqlab'
  | 'idghaam_ghunnah'
  | 'idghaam_no_ghunnah'
  | 'idghaam_mutajanisayn'
  | 'idghaam_mutaqaribayn'
  | 'idghaam_shafawi'
  | 'qalqalah'
  | 'silent';

const RULE_COLORS: Record<TajweedRule, string> = {
  hamzat_wasl: '#a5a5a5',
  lam_shamsiyyah: '#2fadff',
  madd_2: '#ce9e00',
  madd_246: '#ff7b00',
  madd_6: '#b50000',
  madd_munfasil: '#ff7b00',
  madd_muttasil: '#f40000',
  ghunnah: '#09b000',
  ikhfa: '#09b000',
  ikhfa_shafawi: '#09b000',
  iqlab: '#09b000',
  idghaam_ghunnah: '#a5a5a5',
  idghaam_no_ghunnah: '#a5a5a5',
  idghaam_mutajanisayn: '#a5a5a5',
  idghaam_mutaqaribayn: '#a5a5a5',
  idghaam_shafawi: '#a5a5a5',
  qalqalah: '#2fadff',
  silent: '#8e44ad',
};

const NIGHT_COLORS: Record<TajweedRule, string> = {
  hamzat_wasl: '#999999',
  lam_shamsiyyah: '#00deff',
  madd_2: '#ffc1e0',
  madd_246: '#ff8e3b',
  madd_6: '#e30000',
  madd_munfasil: '#ff8e3b',
  madd_muttasil: '#ff5e8e',
  ghunnah: '#26b55d',
  ikhfa: '#26b55d',
  ikhfa_shafawi: '#26b55d',
  iqlab: '#26b55d',
  idghaam_ghunnah: '#999999',
  idghaam_no_ghunnah: '#999999',
  idghaam_mutajanisayn: '#999999',
  idghaam_mutaqaribayn: '#999999',
  idghaam_shafawi: '#999999',
  qalqalah: '#00deff',
  silent: '#af7ac5',
};

/**
 * Get the color for a tajweed rule based on current theme.
 */
function getColor(rule: string): string {
  const body = document.body;
  if (body && body.classList.contains('night-mode')) {
    return (NIGHT_COLORS as Record<string, string>)[rule] || (RULE_COLORS as Record<string, string>)[rule] || '#000';
  }
  return (RULE_COLORS as Record<string, string>)[rule] || '#000';
}

/**
 * Build a fast position→rule lookup for an entire ayah.
 * Returns a map of character positions to tajweed rule names,
 * which can be used with CSS classes (`.tajweed-<rule>`) for coloring.
 */
export function buildColorMap(annotations: TajweedAnnotation[]): Map<number, TajweedRule> {
  const map = new Map<number, TajweedRule>();
  for (const ann of annotations) {
    const rule = ann.rule as TajweedRule;
    for (let pos = ann.start; pos < ann.end; pos++) {
      map.set(pos, rule);
    }
  }
  return map;
}

/**
 * Get the CSS color for a tajweed rule based on current theme.
 * Used by the mushaf canvas renderer which cannot use CSS classes.
 */
export function getTajweedColor(rule: string): string {
  return getColor(rule);
}

/**
 * Convert a tajweed rule name to a CSS class name.
 * Rules use underscores (e.g. "madd_2") → CSS uses hyphens (e.g. "tajweed-madd-2").
 */
function ruleToClassName(rule: TajweedRule): string {
  return 'tajweed-' + rule.replace(/_/g, '-');
}

/**
 * Apply tajweed coloring to a single word using the ayah's rule map.
 * Uses CSS classes (`.tajweed-<rule>`) instead of inline styles for
 * better theme switching and maintainability.
 * @param word - A single word of Arabic text.
 * @param wordOffset - The character offset of this word within the full ayah text.
 * @param colorMap - Position→rule lookup for the ayah.
 * @returns HTML string with CSS-classed spans.
 */
export function tajweedColorWord(word: string, wordOffset: number, colorMap: Map<number, TajweedRule>): string {
  if (!colorMap || colorMap.size === 0) {
    return word;
  }

  let result = '';
  let i = 0;
  while (i < word.length) {
    const absPos = wordOffset + i;
    const rule = colorMap.get(absPos);
    if (rule) {
      const start = i;
      while (i < word.length && colorMap.get(wordOffset + i) === rule) {
        i++;
      }
      result += `<span class="${ruleToClassName(rule)}">${escapeHtml(word.substring(start, i))}</span>`;
    } else {
      result += escapeHtml(word[i]);
      i++;
    }
  }
  return result;
}
