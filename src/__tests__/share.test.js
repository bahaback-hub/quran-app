import { describe, it, expect, beforeEach } from 'vitest';
import { copyToClipboard } from '../utils.js';
import { buildShareText } from '../share.js';
import { state } from '../state.js';

const sampleAyahs = [
  { numberInSurah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
  { numberInSurah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
];

const sampleSurah = {
  number: 1,
  name: 'سُورَةُ الفَاتِحَةِ',
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
    state.surahData = sampleSurah;
    state.currentAyahIndex = 1;
    const text = buildShareText();
    expect(text).toContain('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ');
    expect(text).toContain('سُورَةُ الفَاتِحَةِ');
    expect(text).toContain('ayah 2');
  });

  it('should use current ayah', () => {
    state.surahData = sampleSurah;
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
