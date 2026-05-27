import { describe, it, expect, beforeEach } from 'vitest';

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ARABIC_KEYBOARD_LAYOUT = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ']
];

describe('escapeRegExp', () => {
  it('should escape regex special chars', () => {
    expect(escapeRegExp('test.')).toBe('test\\.');
    expect(escapeRegExp('(hello)')).toBe('\\(hello\\)');
    expect(escapeRegExp('a+b*c')).toBe('a\\+b\\*c');
  });

  it('should return plain string as-is', () => {
    expect(escapeRegExp('السلام')).toBe('السلام');
  });
});

describe('Arabic keyboard layout', () => {
  it('should have 3 rows', () => {
    expect(ARABIC_KEYBOARD_LAYOUT.length).toBe(3);
  });

  it('should contain common Arabic letters', () => {
    const all = ARABIC_KEYBOARD_LAYOUT.flat();
    expect(all).toContain('ا');
    expect(all).toContain('ب');
    expect(all).toContain('ل');
    expect(all).toContain('م');
  });

  it('first row should have 12 keys', () => {
    expect(ARABIC_KEYBOARD_LAYOUT[0].length).toBe(12);
  });
});
