import { describe, it, expect } from 'vitest';
import {
  escapeHtml, escapeRegExp, pad2, toArabicNumeral,
  formatTime12, timeStrToMinutes, normalizeExactText, normalizeRelaxed, getArabicNumeral
} from '../utils.js';

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  it('should handle null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('should return empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });
});

describe('escapeRegExp', () => {
  it('should escape regex special characters', () => {
    expect(escapeRegExp('hello.world')).toBe('hello\\.world');
    expect(escapeRegExp('(test)')).toBe('\\(test\\)');
    expect(escapeRegExp('a+b*c?')).toBe('a\\+b\\*c\\?');
  });
});

describe('pad2', () => {
  it('should pad single digit numbers', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(9)).toBe('09');
  });

  it('should not pad double digit numbers', () => {
    expect(pad2(10)).toBe('10');
    expect(pad2(59)).toBe('59');
  });
});

describe('toArabicNumeral', () => {
  it('should convert Western digits to Arabic digits', () => {
    expect(toArabicNumeral(123)).toBe('١٢٣');
    expect(toArabicNumeral(0)).toBe('٠');
    expect(toArabicNumeral(2024)).toBe('٢٠٢٤');
  });
});

describe('formatTime12', () => {
  it('should format 24h time to 12h format', () => {
    expect(formatTime12('13:30')).toBe('1:30 م');
    expect(formatTime12('09:00')).toBe('9:00 ص');
    expect(formatTime12('00:00')).toBe('12:00 ص');
    expect(formatTime12('12:00')).toBe('12:00 م');
  });

  it('should return em dash for invalid input', () => {
    expect(formatTime12('')).toBe('—');
    expect(formatTime12(null)).toBe('—');
  });
});

describe('timeStrToMinutes', () => {
  it('should convert time string to minutes', () => {
    expect(timeStrToMinutes('01:30')).toBe(90);
    expect(timeStrToMinutes('24:00')).toBe(1440);
    expect(timeStrToMinutes('00:00')).toBe(0);
  });
});

describe('normalizeExactText', () => {
  it('should remove diacritics', () => {
    const withTashkeel = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    const normalized = normalizeExactText(withTashkeel);
    expect(normalized).not.toContain('\u0651'); // shadda
    expect(normalized).not.toContain('\u064E'); // fatha
  });

  it('should unify alef variants', () => {
    expect(normalizeExactText('إسلام')).toContain('اسلام');
    expect(normalizeExactText('آدم')).toContain('ادم');
  });

  it('should normalize ya and taa marbuta', () => {
    expect(normalizeExactText('على')).toContain('علي');
    expect(normalizeExactText('رحمة')).toContain('رحمه');
  });

  it('should match standard spelling for common Uthmani words', () => {
    // الرَّحْمَٰنِ → same normal form as الرحمن
    expect(normalizeExactText('الرَّحْمَٰنِ').includes('الرحمن')).toBe(true);
    // هَٰذَا → هذا
    expect(normalizeExactText('هَٰذَا').includes('هذا')).toBe(true);
    // ذَٰلِكَ → ذلك
    expect(normalizeExactText('ذَٰلِكَ').includes('ذلك')).toBe(true);
  });

  it('should normalize the waw-dagger-alif pattern (صلاة)', () => {
    // الصَّلَوٰة → الصلاة → matches user query الصلاة
    const normalized = normalizeExactText('الصَّلَوٰة');
    expect(normalized.includes('الصلاه')).toBe(true);

    // الزَّكَوٰة → الزكاة
    const normalized2 = normalizeExactText('الزَّكَوٰة');
    expect(normalized2.includes('الزكاه')).toBe(true);

    // الْحَيَوٰة → الحياة
    const normalized3 = normalizeExactText('الْحَيَوٰة');
    expect(normalized3.includes('الحياه')).toBe(true);
  });
});

describe('normalizeRelaxed', () => {
  it('should convert dagger alif to regular alif for words like السماوات', () => {
    expect(normalizeRelaxed('الرَّحْمَٰنِ').includes('الرحمان')).toBe(true);
    expect(normalizeRelaxed('هَٰذَا').includes('هاذا')).toBe(true);
    expect(normalizeRelaxed('إِنسَٰن').includes('انسان')).toBe(true);
  });

  it('should remove extra waw in الصلاة pattern', () => {
    expect(normalizeRelaxed('الصَّلَوٰة').includes('الصلاه')).toBe(true);
  });
});

describe('getArabicNumeral', () => {
  it('should return Arabic digit for index', () => {
    expect(getArabicNumeral(0)).toBe('٠');
    expect(getArabicNumeral(5)).toBe('٥');
    expect(getArabicNumeral(9)).toBe('٩');
  });

  it('should return input if out of range', () => {
    expect(getArabicNumeral(10)).toBe(10);
  });
});
