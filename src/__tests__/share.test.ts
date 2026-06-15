import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';

// Mock i18n — __() returns key (matching setup-i18n.ts mock)
vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) => {
    let val = key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, arg);
    });
    return val;
  },
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

import { buildShareText } from '../share.js';
import { copyToClipboard } from '../utils.js';

const sampleAyahs = [
  { numberInSurah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
  { numberInSurah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
];

const sampleSurah = {
  number: 1,
  name: 'سُورَةُ الفَاتِحَةِ',
  englishName: 'Al-Faatiha',
  ayahs: sampleAyahs,
};

beforeEach(() => {
  state.surahData = null;
  state.currentAyahIndex = 0;
});

describe('buildShareText', () => {
  it('should return empty string if no surahData', () => {
    expect(buildShareText()).toBe('');
  });

  it('should format share text correctly', () => {
    state.surahData = sampleSurah as typeof state.surahData;
    state.currentAyahIndex = 1;
    const text = buildShareText();
    expect(text).toContain('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ');
    expect(text).toContain('سُورَةُ الفَاتِحَةِ');
    // Mock __() returns key 'ayah', not Arabic 'آية'
    expect(text).toContain('ayah 2');
  });

  it('should use current ayah', () => {
    state.surahData = sampleSurah as typeof state.surahData;
    state.currentAyahIndex = 0;
    const text = buildShareText();
    expect(text).toContain('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
    expect(text).toContain('ayah 1');
  });
});

describe('copyToClipboard', () => {
  it('should be a function', () => {
    expect(typeof copyToClipboard).toBe('function');
  });
});
