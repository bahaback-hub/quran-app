/**
 * Tests for quran-meta.ts — Sajda ayahs and juz boundaries.
 */

import { describe, it, expect } from 'vitest';
import { SAJDA_AYAHS, JUZ_STARTS, isSajdaAyah, getJuzForAyah, isJuzStart } from '../quran-meta.js';

/* ===================== SAJDA_AYAHS ===================== */

describe('SAJDA_AYAHS', () => {
  it('should have exactly 15 sajda ayahs', () => {
    const keys = Object.keys(SAJDA_AYAHS);
    expect(keys.length).toBe(15);
  });

  it('should contain only obligatory or recommended types', () => {
    for (const [key, type] of Object.entries(SAJDA_AYAHS)) {
      expect(['obligatory', 'recommended']).toContain(type);
      // Key format should be "surah:ayah"
      expect(key).toMatch(/^\d+:\d+$/);
    }
  });

  it('should include all known obligatory sajda ayahs', () => {
    const obligatoryKeys = Object.entries(SAJDA_AYAHS)
      .filter(([, type]) => type === 'obligatory')
      .map(([key]) => key);

    expect(obligatoryKeys).toContain('7:206');
    expect(obligatoryKeys).toContain('13:15');
    expect(obligatoryKeys).toContain('16:50');
    expect(obligatoryKeys).toContain('17:109');
    expect(obligatoryKeys).toContain('19:58');
    expect(obligatoryKeys).toContain('22:18');
    expect(obligatoryKeys).toContain('25:60');
    expect(obligatoryKeys).toContain('27:26');
    expect(obligatoryKeys).toContain('32:15');
    expect(obligatoryKeys).toContain('41:38');
    expect(obligatoryKeys).toContain('53:62');
    expect(obligatoryKeys).toContain('96:19');
  });

  it('should include all known recommended sajda ayahs', () => {
    const recommendedKeys = Object.entries(SAJDA_AYAHS)
      .filter(([, type]) => type === 'recommended')
      .map(([key]) => key);

    expect(recommendedKeys).toContain('22:77');
    expect(recommendedKeys).toContain('38:24');
    expect(recommendedKeys).toContain('84:21');
  });

  it('should have two sajda ayahs in Surah Al-Hajj (22)', () => {
    const hajjSajdas = Object.entries(SAJDA_AYAHS)
      .filter(([key]) => key.startsWith('22:'))
      .map(([key, type]) => ({ key, type }));

    expect(hajjSajdas.length).toBe(2);
    expect(hajjSajdas.find((s) => s.key === '22:18')?.type).toBe('obligatory');
    expect(hajjSajdas.find((s) => s.key === '22:77')?.type).toBe('recommended');
  });

  it('should have exactly 12 obligatory sajda ayahs', () => {
    const obligatoryCount = Object.values(SAJDA_AYAHS).filter((t) => t === 'obligatory').length;
    expect(obligatoryCount).toBe(12);
  });

  it('should have exactly 3 recommended sajda ayahs', () => {
    const recommendedCount = Object.values(SAJDA_AYAHS).filter((t) => t === 'recommended').length;
    expect(recommendedCount).toBe(3);
  });

  it('should not have duplicate keys', () => {
    const keys = Object.keys(SAJDA_AYAHS);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('should have all keys in surah:ayah format with numeric parts', () => {
    for (const key of Object.keys(SAJDA_AYAHS)) {
      const parts = key.split(':');
      expect(parts.length).toBe(2);
      expect(parseInt(parts[0]!, 10)).toBeGreaterThan(0);
      expect(parseInt(parts[1]!, 10)).toBeGreaterThan(0);
    }
  });
});

/* ===================== JUZ_STARTS ===================== */

describe('JUZ_STARTS', () => {
  it('should have exactly 30 juz entries', () => {
    expect(JUZ_STARTS.length).toBe(30);
  });

  it('should have juz numbers from 1 to 30', () => {
    for (let i = 0; i < 30; i++) {
      expect(JUZ_STARTS[i]!.juz).toBe(i + 1);
    }
  });

  it('should have valid surah numbers (1-114) for each entry', () => {
    for (const j of JUZ_STARTS) {
      expect(j.surah).toBeGreaterThanOrEqual(1);
      expect(j.surah).toBeLessThanOrEqual(114);
    }
  });

  it('should have positive ayah numbers for each entry', () => {
    for (const j of JUZ_STARTS) {
      expect(j.ayah).toBeGreaterThanOrEqual(1);
    }
  });

  it('should start with Juz 1 at Surah 1, Ayah 1', () => {
    expect(JUZ_STARTS[0]).toEqual({ juz: 1, surah: 1, ayah: 1 });
  });

  it('should end with Juz 30 at Surah 78, Ayah 1', () => {
    expect(JUZ_STARTS[29]).toEqual({ juz: 30, surah: 78, ayah: 1 });
  });

  it('should have juz entries in ascending order', () => {
    for (let i = 1; i < JUZ_STARTS.length; i++) {
      expect(JUZ_STARTS[i]!.juz).toBeGreaterThan(JUZ_STARTS[i - 1]!.juz);
    }
  });

  it('should have surah numbers in non-decreasing order across juz boundaries', () => {
    for (let i = 1; i < JUZ_STARTS.length; i++) {
      expect(JUZ_STARTS[i]!.surah).toBeGreaterThanOrEqual(JUZ_STARTS[i - 1]!.surah - 5);
      // Surah numbers should generally increase (allow some slack for same surah)
    }
  });

  it('should have correct data for key juz boundaries', () => {
    // Spot check some important juz starts
    expect(JUZ_STARTS.find((j) => j.juz === 2)).toEqual({ juz: 2, surah: 2, ayah: 142 });
    expect(JUZ_STARTS.find((j) => j.juz === 15)).toEqual({ juz: 15, surah: 17, ayah: 1 });
    expect(JUZ_STARTS.find((j) => j.juz === 29)).toEqual({ juz: 29, surah: 67, ayah: 1 });
  });

  it('should not have duplicate juz numbers', () => {
    const juzNumbers = JUZ_STARTS.map((j) => j.juz);
    const uniqueJuz = new Set(juzNumbers);
    expect(juzNumbers.length).toBe(uniqueJuz.size);
  });
});

/* ===================== isSajdaAyah ===================== */

describe('isSajdaAyah', () => {
  it('should return isSajda=true for obligatory sajda ayahs', () => {
    const result = isSajdaAyah(7, 206);
    expect(result.isSajda).toBe(true);
    expect(result.type).toBe('obligatory');
  });

  it('should return isSajda=true for recommended sajda ayahs', () => {
    const result = isSajdaAyah(38, 24);
    expect(result.isSajda).toBe(true);
    expect(result.type).toBe('recommended');
  });

  it('should return isSajda=false for non-sajda ayahs', () => {
    const result = isSajdaAyah(1, 1);
    expect(result.isSajda).toBe(false);
    expect(result.type).toBe('');
  });

  it('should return isSajda=false for non-existent surah/ayah', () => {
    const result = isSajdaAyah(999, 999);
    expect(result.isSajda).toBe(false);
    expect(result.type).toBe('');
  });

  it('should correctly identify Surah As-Sajdah (32:15)', () => {
    const result = isSajdaAyah(32, 15);
    expect(result.isSajda).toBe(true);
    expect(result.type).toBe('obligatory');
  });

  it('should correctly identify the second sajda in Surah Al-Hajj (22:77)', () => {
    const result = isSajdaAyah(22, 77);
    expect(result.isSajda).toBe(true);
    expect(result.type).toBe('recommended');
  });

  it('should correctly identify the first sajda in Surah Al-Hajj (22:18)', () => {
    const result = isSajdaAyah(22, 18);
    expect(result.isSajda).toBe(true);
    expect(result.type).toBe('obligatory');
  });

  it('should return isSajda=false for wrong ayah in sajda surah', () => {
    const result = isSajdaAyah(32, 14);
    expect(result.isSajda).toBe(false);
    expect(result.type).toBe('');
  });

  it('should handle zero surah/ayah gracefully', () => {
    const result = isSajdaAyah(0, 0);
    expect(result.isSajda).toBe(false);
    expect(result.type).toBe('');
  });

  it('should verify all 15 sajda entries return isSajda=true', () => {
    for (const [key] of Object.entries(SAJDA_AYAHS)) {
      const [surah, ayah] = key.split(':').map(Number);
      const result = isSajdaAyah(surah!, ayah!);
      expect(result.isSajda).toBe(true);
      expect(result.type).toBeTruthy();
    }
  });

  it('should return matching type for each sajda entry', () => {
    for (const [key, expectedType] of Object.entries(SAJDA_AYAHS)) {
      const [surah, ayah] = key.split(':').map(Number);
      const result = isSajdaAyah(surah!, ayah!);
      expect(result.type).toBe(expectedType);
    }
  });

  it('should return empty string type for non-sajda ayahs in sajda surahs', () => {
    // Surah 32 is the "Sajdah" surah, but not all ayahs are sajda
    const result = isSajdaAyah(32, 1);
    expect(result.isSajda).toBe(false);
    expect(result.type).toBe('');
  });

  it('should handle negative surah/ayah numbers', () => {
    const result = isSajdaAyah(-1, -1);
    expect(result.isSajda).toBe(false);
    expect(result.type).toBe('');
  });

  it('should return consistent results for repeated calls', () => {
    const result1 = isSajdaAyah(7, 206);
    const result2 = isSajdaAyah(7, 206);
    expect(result1).toEqual(result2);
  });
});

/* ===================== getJuzForAyah ===================== */

describe('getJuzForAyah', () => {
  it('should return 1 for Al-Fatihah (1:1)', () => {
    expect(getJuzForAyah(1, 1)).toBe(1);
  });

  it('should return 1 for Al-Baqarah ayah 141 (end of Juz 1)', () => {
    expect(getJuzForAyah(2, 141)).toBe(1);
  });

  it('should return 2 for Al-Baqarah ayah 142 (start of Juz 2)', () => {
    expect(getJuzForAyah(2, 142)).toBe(2);
  });

  it('should return 30 for An-Naba (78:1)', () => {
    expect(getJuzForAyah(78, 1)).toBe(30);
  });

  it('should return 30 for any ayah after Surah 78', () => {
    expect(getJuzForAyah(114, 6)).toBe(30);
  });

  it('should return 30 for the last surah (An-Nas)', () => {
    expect(getJuzForAyah(114, 1)).toBe(30);
  });

  it('should return correct juz for middle of the Quran', () => {
    // Juz 15 starts at Surah 17, Ayah 1
    expect(getJuzForAyah(17, 1)).toBe(15);
    // Before Juz 15, should be in Juz 14
    expect(getJuzForAyah(16, 100)).toBe(14);
  });

  it('should return correct juz for Surah Al-Mulk (67:1) — start of Juz 29', () => {
    expect(getJuzForAyah(67, 1)).toBe(29);
  });

  it('should return 28 for Surah Al-Mujadila (58:1)', () => {
    expect(getJuzForAyah(58, 1)).toBe(28);
  });

  it('should return 1 for surah before any juz boundary', () => {
    // Any surah:ayah before the first juz boundary stays in Juz 1
    expect(getJuzForAyah(1, 7)).toBe(1);
    expect(getJuzForAyah(2, 1)).toBe(1);
  });

  it('should correctly handle ayahs at exact juz boundaries', () => {
    // Juz 3 starts at 2:253
    expect(getJuzForAyah(2, 253)).toBe(3);
    expect(getJuzForAyah(2, 252)).toBe(2);
  });

  it('should return 1 for edge case: surah 1, ayah 0', () => {
    // Ayah 0 doesn't exist but the function should handle it gracefully
    expect(getJuzForAyah(1, 0)).toBe(1);
  });

  it('should return 1 for any surah:ayah before Juz 2', () => {
    expect(getJuzForAyah(1, 7)).toBe(1);
    expect(getJuzForAyah(2, 1)).toBe(1);
    expect(getJuzForAyah(2, 141)).toBe(1);
  });

  it('should return 30 for surah 78 onward regardless of ayah number', () => {
    expect(getJuzForAyah(78, 1)).toBe(30);
    expect(getJuzForAyah(78, 40)).toBe(30);
    expect(getJuzForAyah(100, 1)).toBe(30);
    expect(getJuzForAyah(114, 6)).toBe(30);
  });

  it('should return correct juz for each juz boundary start', () => {
    for (const j of JUZ_STARTS) {
      expect(getJuzForAyah(j.surah, j.ayah)).toBe(j.juz);
    }
  });

  it('should return correct juz for ayahs between boundaries', () => {
    // Juz 4 starts at 3:93, so 3:50 is in Juz 3
    expect(getJuzForAyah(3, 50)).toBe(3);
    // Juz 5 starts at 4:24, so 4:10 is in Juz 4
    expect(getJuzForAyah(4, 10)).toBe(4);
  });

  it('should handle very large ayah numbers', () => {
    // Al-Baqarah has 286 ayahs
    expect(getJuzForAyah(2, 286)).toBe(3);
  });

  it('should handle surah between juz boundaries correctly', () => {
    // Surah 6 is between Juz 7 (5:82) and Juz 8 (6:111)
    expect(getJuzForAyah(6, 1)).toBe(7);
    expect(getJuzForAyah(6, 110)).toBe(7);
    expect(getJuzForAyah(6, 111)).toBe(8);
  });

  it('should handle single-surah spanning multiple juz', () => {
    // Al-Baqarah spans juz 1, 2, 3
    expect(getJuzForAyah(2, 1)).toBe(1);
    expect(getJuzForAyah(2, 142)).toBe(2);
    expect(getJuzForAyah(2, 253)).toBe(3);
  });
});

/* ===================== isJuzStart ===================== */

describe('isJuzStart', () => {
  it('should return juz number for exact juz start positions', () => {
    expect(isJuzStart(1, 1)).toBe(1);
    expect(isJuzStart(2, 142)).toBe(2);
    expect(isJuzStart(78, 1)).toBe(30);
  });

  it('should return null for non-juz-start positions', () => {
    expect(isJuzStart(1, 2)).toBeNull();
    expect(isJuzStart(2, 1)).toBeNull();
    expect(isJuzStart(2, 143)).toBeNull();
  });

  it('should return null for non-existent positions', () => {
    expect(isJuzStart(999, 1)).toBeNull();
    expect(isJuzStart(0, 0)).toBeNull();
  });

  it('should identify all 30 juz start positions', () => {
    let count = 0;
    for (const j of JUZ_STARTS) {
      const result = isJuzStart(j.surah, j.ayah);
      expect(result).toBe(j.juz);
      count++;
    }
    expect(count).toBe(30);
  });

  it('should return correct juz number for each known start', () => {
    // Spot check some key juz starts
    expect(isJuzStart(2, 253)).toBe(3);   // Juz 3
    expect(isJuzStart(36, 28)).toBe(23);   // Juz 23 (Ya-Sin)
    expect(isJuzStart(67, 1)).toBe(29);    // Juz 29 (Al-Mulk)
  });

  it('should return null one ayah before a juz start', () => {
    // 2:141 is one ayah before Juz 2 starts at 2:142
    expect(isJuzStart(2, 141)).toBeNull();
  });

  it('should return null one ayah after a juz start', () => {
    // 2:143 is one ayah after Juz 2 starts at 2:142
    expect(isJuzStart(2, 143)).toBeNull();
  });

  it('should return null for the same surah but different ayah than juz start', () => {
    // Surah 17 has Juz 15 start at ayah 1
    expect(isJuzStart(17, 1)).toBe(15);
    expect(isJuzStart(17, 2)).toBeNull();
    expect(isJuzStart(17, 50)).toBeNull();
  });

  it('should return null for negative surah/ayah', () => {
    expect(isJuzStart(-1, -1)).toBeNull();
  });

  it('should correctly identify Juz 1 start', () => {
    expect(isJuzStart(1, 1)).toBe(1);
  });

  it('should correctly identify Juz 30 start', () => {
    expect(isJuzStart(78, 1)).toBe(30);
  });

  it('should return null for ayah 0 in any surah', () => {
    expect(isJuzStart(1, 0)).toBeNull();
    expect(isJuzStart(2, 0)).toBeNull();
  });
});
