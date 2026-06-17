/**
 * Behavioral tests for surah-list.ts — absToSurahAyah & getAbsNumber.
 *
 * These functions convert between (surah, ayahInSurah) pairs and
 * absolute ayah numbers (1..6236). They were previously private
 * (_absToSurahAyah, _getAbsNumber) and not directly testable.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../surah-list.js');
vi.unmock('../dom.js');
vi.unmock('../storage.js');

// Mock i18n with getReciterName (which reciters.ts uses)
vi.mock('../i18n.js', () => ({
  __: (key: string, ..._args: string[]) => key,
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
  getReciterName: (key: string) => key,
}));

import { state, resetState } from '../state.js';

// Test fixture: 3 surahs with known ayah counts
// Surah 1: 7 ayahs (abs 1-7)
// Surah 2: 286 ayahs (abs 8-293)
// Surah 3: 200 ayahs (abs 294-493)
const TEST_SURAHS = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqara', numberOfAyahs: 286 },
  { number: 3, name: 'آل عمران', englishName: 'Aal-i-Imraan', numberOfAyahs: 200 },
];

function setupSurahList() {
  state.surahList = TEST_SURAHS.map((s) => ({ ...s }));
}

describe('surah-list — absToSurahAyah', () => {
  beforeEach(() => {
    resetState();
    setupSurahList();
  });

  it('returns surah 1, ayah 1 for absolute ayah 1', async () => {
    const { absToSurahAyah } = await import('../surah-list.js');
    const result = absToSurahAyah(1);
    expect(result).not.toBeNull();
    expect(result!.surahNum).toBe(1);
    expect(result!.surahName).toBe('الفاتحة');
    expect(result!.ayahNumInSurah).toBe(1);
  });

  it('returns surah 1, ayah 7 for absolute ayah 7 (last ayah of Al-Fatiha)', async () => {
    const { absToSurahAyah } = await import('../surah-list.js');
    const result = absToSurahAyah(7);
    expect(result).not.toBeNull();
    expect(result!.surahNum).toBe(1);
    expect(result!.ayahNumInSurah).toBe(7);
  });

  it('returns surah 2, ayah 1 for absolute ayah 8 (first ayah of Al-Baqara)', async () => {
    const { absToSurahAyah } = await import('../surah-list.js');
    const result = absToSurahAyah(8);
    expect(result).not.toBeNull();
    expect(result!.surahNum).toBe(2);
    expect(result!.surahName).toBe('البقرة');
    expect(result!.ayahNumInSurah).toBe(1);
  });

  it('returns surah 3, ayah 1 for absolute ayah 294 (first ayah of Aal-i-Imraan)', async () => {
    const { absToSurahAyah } = await import('../surah-list.js');
    const result = absToSurahAyah(294);
    expect(result).not.toBeNull();
    expect(result!.surahNum).toBe(3);
    expect(result!.ayahNumInSurah).toBe(1);
  });

  it('returns surah 3, ayah 200 for absolute ayah 493 (last ayah of Aal-i-Imraan)', async () => {
    const { absToSurahAyah } = await import('../surah-list.js');
    const result = absToSurahAyah(493);
    expect(result).not.toBeNull();
    expect(result!.surahNum).toBe(3);
    expect(result!.ayahNumInSurah).toBe(200);
  });

  it('returns null for absolute ayah 0 (out of range, below)', async () => {
    const { absToSurahAyah } = await import('../surah-list.js');
    const result = absToSurahAyah(0);
    expect(result).toBeNull();
  });

  it('returns null for absolute ayah 494 (out of range, above)', async () => {
    const { absToSurahAyah } = await import('../surah-list.js');
    const result = absToSurahAyah(494);
    expect(result).toBeNull();
  });

  it('auto-builds surahOffsets if not already built', async () => {
    const { absToSurahAyah } = await import('../surah-list.js');
    // Reset offsets to null to verify auto-build
    state.surahOffsets = null;
    const result = absToSurahAyah(1);
    expect(result).not.toBeNull();
    expect(state.surahOffsets).not.toBeNull();
  });
});

describe('surah-list — getAbsNumber', () => {
  beforeEach(() => {
    resetState();
    setupSurahList();
  });

  it('returns 1 for surah 1, ayah 1', async () => {
    const { getAbsNumber } = await import('../surah-list.js');
    expect(getAbsNumber(1, 1)).toBe(1);
  });

  it('returns 7 for surah 1, ayah 7 (last of Al-Fatiha)', async () => {
    const { getAbsNumber } = await import('../surah-list.js');
    expect(getAbsNumber(1, 7)).toBe(7);
  });

  it('returns 8 for surah 2, ayah 1 (first of Al-Baqara)', async () => {
    const { getAbsNumber } = await import('../surah-list.js');
    expect(getAbsNumber(2, 1)).toBe(8);
  });

  it('returns 293 for surah 2, ayah 286 (last of Al-Baqara)', async () => {
    const { getAbsNumber } = await import('../surah-list.js');
    expect(getAbsNumber(2, 286)).toBe(293);
  });

  it('returns 294 for surah 3, ayah 1 (first of Aal-i-Imraan)', async () => {
    const { getAbsNumber } = await import('../surah-list.js');
    expect(getAbsNumber(3, 1)).toBe(294);
  });

  it('returns null for non-existent surah', async () => {
    const { getAbsNumber } = await import('../surah-list.js');
    expect(getAbsNumber(999, 1)).toBeNull();
  });

  it('auto-builds surahOffsets if not already built', async () => {
    const { getAbsNumber } = await import('../surah-list.js');
    state.surahOffsets = null;
    expect(getAbsNumber(1, 1)).toBe(1);
    expect(state.surahOffsets).not.toBeNull();
  });
});

describe('surah-list — round-trip conversion', () => {
  beforeEach(() => {
    resetState();
    setupSurahList();
  });

  it('absToSurahAyah(getAbsNumber(s, a)) returns (s, a)', async () => {
    const { absToSurahAyah, getAbsNumber } = await import('../surah-list.js');
    // Test several (surah, ayah) pairs
    const testCases = [
      { surah: 1, ayah: 1 },
      { surah: 1, ayah: 7 },
      { surah: 2, ayah: 1 },
      { surah: 2, ayah: 150 },
      { surah: 2, ayah: 286 },
      { surah: 3, ayah: 1 },
      { surah: 3, ayah: 200 },
    ];
    for (const { surah, ayah } of testCases) {
      const abs = getAbsNumber(surah, ayah);
      expect(abs).not.toBeNull();
      const back = absToSurahAyah(abs!);
      expect(back).not.toBeNull();
      expect(back!.surahNum).toBe(surah);
      expect(back!.ayahNumInSurah).toBe(ayah);
    }
  });
});
