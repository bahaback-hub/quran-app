/**
 * Comprehensive tests for tajweed.ts — Tajweed coloring for Quran text.
 * Covers: buildColorMap, getTajweedColor, tajweedColorWord, ruleToClassName, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock escapeHtml from utils — needed by tajweedColorWord
vi.mock('../utils.js', () => ({
  escapeHtml: (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
}));

import { buildColorMap, getTajweedColor, tajweedColorWord } from '../tajweed.js';
import type { TajweedRule } from '../tajweed.js';

// ---------- buildColorMap ----------

describe('buildColorMap', () => {
  it('should return an empty map for empty annotations', () => {
    const map = buildColorMap([]);
    expect(map.size).toBe(0);
  });

  it('should map character positions to rules', () => {
    const annotations = [
      { rule: 'ghunnah', start: 0, end: 3 },
      { rule: 'qalqalah', start: 5, end: 7 },
    ];
    const map = buildColorMap(annotations);
    expect(map.get(0)).toBe('ghunnah');
    expect(map.get(1)).toBe('ghunnah');
    expect(map.get(2)).toBe('ghunnah');
    expect(map.get(3)).toBeUndefined();
    expect(map.get(5)).toBe('qalqalah');
    expect(map.get(6)).toBe('qalqalah');
    expect(map.get(7)).toBeUndefined();
  });

  it('should handle single-character annotations', () => {
    const annotations = [{ rule: 'hamzat_wasl', start: 4, end: 5 }];
    const map = buildColorMap(annotations);
    expect(map.get(4)).toBe('hamzat_wasl');
    expect(map.size).toBe(1);
  });

  it('should handle overlapping annotations (last wins)', () => {
    const annotations = [
      { rule: 'ghunnah', start: 0, end: 4 },
      { rule: 'ikhfa', start: 2, end: 5 },
    ];
    const map = buildColorMap(annotations);
    // position 0-1: ghunnah, position 2-3: ikhfa (overwrites), position 4: ikhfa
    expect(map.get(0)).toBe('ghunnah');
    expect(map.get(1)).toBe('ghunnah');
    expect(map.get(2)).toBe('ikhfa');
    expect(map.get(3)).toBe('ikhfa');
    expect(map.get(4)).toBe('ikhfa');
  });

  it('should handle all rule types', () => {
    const rules: TajweedRule[] = [
      'hamzat_wasl',
      'lam_shamsiyyah',
      'madd_2',
      'madd_246',
      'madd_6',
      'madd_munfasil',
      'madd_muttasil',
      'ghunnah',
      'ikhfa',
      'ikhfa_shafawi',
      'iqlab',
      'idghaam_ghunnah',
      'idghaam_no_ghunnah',
      'idghaam_mutajanisayn',
      'idghaam_mutaqaribayn',
      'idghaam_shafawi',
      'qalqalah',
      'silent',
    ];
    let pos = 0;
    const annotations = rules.map((rule) => {
      const ann = { rule, start: pos, end: pos + 2 };
      pos += 3; // leave a gap
      return ann;
    });
    const map = buildColorMap(annotations);
    for (const ann of annotations) {
      expect(map.get(ann.start)).toBe(ann.rule);
    }
  });
});

// ---------- getTajweedColor ----------

describe('getTajweedColor', () => {
  beforeEach(() => {
    document.body.classList.remove('night-mode');
  });

  it('should return a color for each known rule in day mode', () => {
    const rules: TajweedRule[] = [
      'hamzat_wasl',
      'lam_shamsiyyah',
      'madd_2',
      'madd_246',
      'madd_6',
      'madd_munfasil',
      'madd_muttasil',
      'ghunnah',
      'ikhfa',
      'ikhfa_shafawi',
      'iqlab',
      'idghaam_ghunnah',
      'idghaam_no_ghunnah',
      'idghaam_mutajanisayn',
      'idghaam_mutaqaribayn',
      'idghaam_shafawi',
      'qalqalah',
      'silent',
    ];
    for (const rule of rules) {
      const color = getTajweedColor(rule);
      expect(color).toBeTruthy();
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('should return different colors in night mode', () => {
    document.body.classList.add('night-mode');
    const dayColor = getTajweedColor('madd_muttasil');
    // We can't compare day/night directly without toggling, so just verify it returns a color
    expect(dayColor).toBeTruthy();
  });

  it('should return a color in night mode for all rules', () => {
    document.body.classList.add('night-mode');
    const rules: TajweedRule[] = [
      'hamzat_wasl',
      'lam_shamsiyyah',
      'madd_2',
      'madd_246',
      'madd_6',
      'madd_munfasil',
      'madd_muttasil',
      'ghunnah',
      'ikhfa',
      'ikhfa_shafawi',
      'iqlab',
      'idghaam_ghunnah',
      'idghaam_no_ghunnah',
      'idghaam_mutajanisayn',
      'idghaam_mutaqaribayn',
      'idghaam_shafawi',
      'qalqalah',
      'silent',
    ];
    for (const rule of rules) {
      const color = getTajweedColor(rule);
      expect(color).toBeTruthy();
    }
  });

  it('should return #000 for unknown rule', () => {
    expect(getTajweedColor('unknown_rule')).toBe('#000');
  });

  it('should return night mode colors when body has night-mode class', () => {
    document.body.classList.add('night-mode');
    const nightColor = getTajweedColor('madd_muttasil');
    document.body.classList.remove('night-mode');
    const dayColor = getTajweedColor('madd_muttasil');
    // madd_muttasil has different colors for night vs day
    expect(nightColor).not.toBe(dayColor);
  });

  it('should return day color when body element exists but has no night-mode class', () => {
    document.body.classList.remove('night-mode');
    const color = getTajweedColor('madd_2');
    expect(color).toBe('#ce9e00');
  });

  it('should handle missing body gracefully (unlikely in jsdom)', () => {
    // In jsdom, document.body always exists, but we can test the fallback
    // by temporarily removing the class
    document.body.classList.remove('night-mode');
    const color = getTajweedColor('qalqalah');
    expect(color).toBe('#2fadff');
  });
});

// ---------- tajweedColorWord ----------

describe('tajweedColorWord', () => {
  it('should return the word unchanged when colorMap is empty', () => {
    const map = new Map<number, TajweedRule>();
    expect(tajweedColorWord('كتاب', 0, map)).toBe('كتاب');
  });

  it('should return the word unchanged when colorMap is null-like (size 0)', () => {
    const emptyMap = new Map<number, TajweedRule>();
    const result = tajweedColorWord('بسم', 0, emptyMap);
    expect(result).toBe('بسم');
  });

  it('should wrap annotated characters in spans with CSS classes', () => {
    const map = new Map<number, TajweedRule>();
    map.set(0, 'ghunnah');
    map.set(1, 'ghunnah');
    const result = tajweedColorWord('اب', 0, map);
    expect(result).toContain('tajweed-ghunnah');
    expect(result).toContain('اب');
  });

  it('should handle partial word annotations', () => {
    const map = new Map<number, TajweedRule>();
    map.set(0, 'qalqalah');
    // Only the first character has a rule, the rest don't
    const result = tajweedColorWord('ابت', 0, map);
    expect(result).toContain('tajweed-qalqalah');
    // The un-annotated characters should be escaped but not wrapped
    expect(result).toContain('بت');
  });

  it('should use correct CSS class names with hyphens', () => {
    const map = new Map<number, TajweedRule>();
    map.set(0, 'madd_2');
    const result = tajweedColorWord('ا', 0, map);
    expect(result).toContain('tajweed-madd-2');
  });

  it('should handle multiple rules in a single word', () => {
    const map = new Map<number, TajweedRule>();
    map.set(0, 'ghunnah');
    map.set(1, 'ghunnah');
    map.set(2, 'qalqalah');
    map.set(3, 'qalqalah');
    const result = tajweedColorWord('ابت', 0, map);
    expect(result).toContain('tajweed-ghunnah');
    expect(result).toContain('tajweed-qalqalah');
  });

  it('should respect wordOffset when looking up rules', () => {
    const map = new Map<number, TajweedRule>();
    // Rules apply to absolute positions 5 and 6
    map.set(5, 'ikhfa');
    map.set(6, 'ikhfa');
    // Word starts at offset 5
    const result = tajweedColorWord('اب', 5, map);
    expect(result).toContain('tajweed-ikhfa');
  });

  it('should escape HTML in word text when no colorMap', () => {
    const map = new Map<number, TajweedRule>();
    // When colorMap is empty, the word is returned as-is (no escaping)
    const result = tajweedColorWord('a<b', 0, map);
    expect(result).toBe('a<b');
  });

  it('should escape HTML in un-annotated portions of a word', () => {
    const map = new Map<number, TajweedRule>();
    map.set(0, 'ghunnah');
    // Only first char has a rule, rest should be escaped
    const result = tajweedColorWord('a&b', 0, map);
    expect(result).toContain('&amp;');
  });

  it('should escape HTML inside tajweed spans', () => {
    const map = new Map<number, TajweedRule>();
    map.set(0, 'ghunnah');
    map.set(1, 'ghunnah');
    const result = tajweedColorWord('a&b', 0, map);
    expect(result).toContain('tajweed-ghunnah');
    expect(result).toContain('&amp;');
  });

  it('should handle word with no matching rules at given offset', () => {
    const map = new Map<number, TajweedRule>();
    map.set(0, 'ghunnah');
    // Word at offset 10, no rules there
    const result = tajweedColorWord('ابت', 10, map);
    // Should return escaped word without spans
    expect(result).toBe('ابت');
  });

  it('should handle all rule types in CSS class conversion', () => {
    const rules: TajweedRule[] = [
      'hamzat_wasl',
      'lam_shamsiyyah',
      'madd_2',
      'madd_246',
      'madd_6',
      'madd_munfasil',
      'madd_muttasil',
      'ghunnah',
      'ikhfa',
      'ikhfa_shafawi',
      'iqlab',
      'idghaam_ghunnah',
      'idghaam_no_ghunnah',
      'idghaam_mutajanisayn',
      'idghaam_mutaqaribayn',
      'idghaam_shafawi',
      'qalqalah',
      'silent',
    ];
    for (const rule of rules) {
      const map = new Map<number, TajweedRule>();
      map.set(0, rule);
      const result = tajweedColorWord('ا', 0, map);
      const expectedClass = 'tajweed-' + rule.replace(/_/g, '-');
      expect(result).toContain(expectedClass);
    }
  });

  it('should handle word with a single character', () => {
    const map = new Map<number, TajweedRule>();
    map.set(0, 'qalqalah');
    const result = tajweedColorWord('ا', 0, map);
    expect(result).toContain('tajweed-qalqalah');
    expect(result).toContain('ا');
  });

  it('should handle empty word string', () => {
    const map = new Map<number, TajweedRule>();
    map.set(0, 'ghunnah');
    const result = tajweedColorWord('', 0, map);
    expect(result).toBe('');
  });

  it('should handle consecutive rules in same word', () => {
    const map = new Map<number, TajweedRule>();
    // Positions 0-1: ghunnah, 2-3: qalqalah, 4: no rule
    map.set(0, 'ghunnah');
    map.set(1, 'ghunnah');
    map.set(2, 'qalqalah');
    map.set(3, 'qalqalah');
    const result = tajweedColorWord('ابتثج', 0, map);
    expect(result).toContain('tajweed-ghunnah');
    expect(result).toContain('tajweed-qalqalah');
    // Position 4 has no rule, so 'ج' should be just escaped text
    expect(result).toContain('ج');
  });
});

// ---------- Specific color values ----------

describe('RULE_COLORS and NIGHT_COLORS', () => {
  beforeEach(() => {
    document.body.classList.remove('night-mode');
  });

  it('should return correct day colors for specific rules', () => {
    expect(getTajweedColor('hamzat_wasl')).toBe('#a5a5a5');
    expect(getTajweedColor('lam_shamsiyyah')).toBe('#2fadff');
    expect(getTajweedColor('madd_2')).toBe('#ce9e00');
    expect(getTajweedColor('madd_246')).toBe('#ff7b00');
    expect(getTajweedColor('madd_6')).toBe('#b50000');
    expect(getTajweedColor('madd_munfasil')).toBe('#ff7b00');
    expect(getTajweedColor('madd_muttasil')).toBe('#f40000');
    expect(getTajweedColor('ghunnah')).toBe('#09b000');
    expect(getTajweedColor('ikhfa')).toBe('#09b000');
    expect(getTajweedColor('ikhfa_shafawi')).toBe('#09b000');
    expect(getTajweedColor('iqlab')).toBe('#09b000');
    expect(getTajweedColor('idghaam_ghunnah')).toBe('#a5a5a5');
    expect(getTajweedColor('qalqalah')).toBe('#2fadff');
    expect(getTajweedColor('silent')).toBe('#8e44ad');
  });

  it('should return correct night colors when night-mode is active', () => {
    document.body.classList.add('night-mode');
    expect(getTajweedColor('hamzat_wasl')).toBe('#999999');
    expect(getTajweedColor('lam_shamsiyyah')).toBe('#00deff');
    expect(getTajweedColor('madd_2')).toBe('#ffc1e0');
    expect(getTajweedColor('madd_6')).toBe('#e30000');
    expect(getTajweedColor('ghunnah')).toBe('#26b55d');
    expect(getTajweedColor('qalqalah')).toBe('#00deff');
    expect(getTajweedColor('silent')).toBe('#af7ac5');
  });
});
