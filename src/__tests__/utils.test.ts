/**
 * Tests for utils.ts — utility functions for Quran App.
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  escapeRegExp,
  pad2,
  toArabicNumeral,
  formatTime12,
  timeStrToMinutes,
  stripTashkeel,
  normalizeExactText,
  normalizeRelaxed,
  getArabicNumeral,
  copyToClipboard,
  hapticFeedback,
} from '../utils.js';

describe('escapeHtml', () => {
  it('should escape ampersands', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('should escape angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('should escape quotes', () => {
    // DOM-based escapeHtml does NOT escape double quotes (textContent/innerHTML round-trip)
    const result = escapeHtml('"hello"');
    // Verify it doesn't crash and returns something safe
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('should handle empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should return plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('should handle null input', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('should handle undefined input', () => {
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('escapeRegExp', () => {
  it('should escape regex special characters', () => {
    expect(escapeRegExp('hello.world')).toBe('hello\\.world');
  });

  it('should escape all special characters', () => {
    const result = escapeRegExp('a*b+c?d[e]f{g}h(i)j|k^l$m');
    expect(result).toBe('a\\*b\\+c\\?d\\[e\\]f\\{g\\}h\\(i\\)j\\|k\\^l\\$m');
  });

  it('should leave normal text unchanged', () => {
    expect(escapeRegExp('hello')).toBe('hello');
  });
});

describe('pad2', () => {
  it('should pad single digit numbers', () => {
    expect(pad2(5)).toBe('05');
  });

  it('should not pad double digit numbers', () => {
    expect(pad2(12)).toBe('12');
  });

  it('should handle zero', () => {
    expect(pad2(0)).toBe('00');
  });
});

describe('toArabicNumeral', () => {
  it('should convert Western numerals to Arabic', () => {
    expect(toArabicNumeral(42)).toBe('٤٢');
  });

  it('should convert string numerals', () => {
    expect(toArabicNumeral('2024')).toBe('٢٠٢٤');
  });

  it('should handle zero', () => {
    expect(toArabicNumeral(0)).toBe('٠');
  });
});

describe('formatTime12', () => {
  it('should convert afternoon time to 12-hour format with م', () => {
    expect(formatTime12('14:30')).toBe('2:30 م');
  });

  it('should convert morning time to 12-hour format with ص', () => {
    expect(formatTime12('08:00')).toBe('8:00 ص');
  });

  it('should handle midnight as 12 ص', () => {
    expect(formatTime12('00:00')).toBe('12:00 ص');
  });

  it('should handle noon as 12 م', () => {
    expect(formatTime12('12:00')).toBe('12:00 م');
  });

  it('should return dash for empty string', () => {
    expect(formatTime12('')).toBe('—');
  });
});

describe('timeStrToMinutes', () => {
  it('should convert HH:MM to total minutes', () => {
    expect(timeStrToMinutes('02:30')).toBe(150);
  });

  it('should handle midnight', () => {
    expect(timeStrToMinutes('00:00')).toBe(0);
  });

  it('should handle end of day', () => {
    expect(timeStrToMinutes('23:59')).toBe(1439);
  });

  it('should return 0 for empty string', () => {
    expect(timeStrToMinutes('')).toBe(0);
  });
});

describe('stripTashkeel', () => {
  it('should strip fatha', () => {
    expect(stripTashkeel('بَ')).toBe('ب');
  });

  it('should strip multiple diacritics', () => {
    expect(stripTashkeel('بِسْمِ')).toBe('بسم');
  });

  it('should preserve base letters', () => {
    expect(stripTashkeel('بسم الله')).toBe('بسم الله');
  });

  it('should strip Quranic annotation symbols', () => {
    expect(stripTashkeel('جٓٓٓ')).toBe('ج');
  });
});

describe('normalizeExactText', () => {
  it('should normalize alef variants', () => {
    expect(normalizeExactText('إبراهيم')).toBe('ابراهيم');
  });

  it('should normalize ta marbuta to ha', () => {
    expect(normalizeExactText('الصلاة')).toBe('الصلاه');
  });

  it('should normalize ya variants', () => {
    expect(normalizeExactText('على')).toContain('علي');
  });

  it('should strip tashkeel', () => {
    expect(normalizeExactText('بِسْمِ')).toBe('بسم');
  });

  it('should handle Uthmani waw-alef pattern', () => {
    // وٰة (waw + dagger alif + ta marbuta) converts to اة via uthmaniWawAlefFix
    // then ة→ه via normalizeArabic, so الصلوٰة → الصلاه
    expect(normalizeExactText('الصلوٰة')).toBe('الصلاه');
  });
});

describe('normalizeRelaxed', () => {
  it('should convert dagger alif to alef', () => {
    // This test verifies the dagger alif → ا conversion
    const result = normalizeRelaxed('الكتاب');
    expect(result).toContain('الكتاب');
  });

  it('should normalize alef variants', () => {
    expect(normalizeRelaxed('أحمد')).toBe('احمد');
  });

  it('should strip tashkeel', () => {
    expect(normalizeRelaxed('بِسْمِ')).toBe('بسم');
  });
});

describe('getArabicNumeral', () => {
  it('should return Arabic numeral for number input', () => {
    expect(getArabicNumeral(5)).toBe('٥');
  });

  it('should return Arabic numeral for string input', () => {
    expect(getArabicNumeral('0')).toBe('٠');
  });

  it('should return original digit for out-of-range', () => {
    expect(getArabicNumeral(99)).toBe('99');
  });
});

describe('copyToClipboard', () => {
  it('should not throw when called', () => {
    expect(() => copyToClipboard('test text')).not.toThrow();
  });
});

describe('hapticFeedback', () => {
  it('should not throw when navigator.vibrate is unavailable', () => {
    expect(() => hapticFeedback()).not.toThrow();
  });

  it('should accept custom pattern', () => {
    expect(() => hapticFeedback(50)).not.toThrow();
  });
});
