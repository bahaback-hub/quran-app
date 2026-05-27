import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { renderSurah } from '../app.js';
import { buildShareText } from '../share.js';

const sampleAyahs = [
  { numberInSurah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
  { numberInSurah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
  { numberInSurah: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ' },
];

const sampleSurah = {
  number: 1,
  name: 'سُورَةُ الفَاتِحَةِ',
  englishName: 'Al-Faatiha',
  ayahs: sampleAyahs,
};

beforeEach(() => {
  dom.surahContent = document.createElement('div');
  state.fontSize = 28;
  state.surahData = null;
  state.currentAyahIndex = 0;
});

describe('renderSurah', () => {
  it('should render surah title and ayahs', () => {
    renderSurah(sampleSurah);
    expect(dom.surahContent.innerHTML).toContain('سُورَةُ الفَاتِحَةِ');
    expect(dom.surahContent.innerHTML).toContain('Al-Faatiha');
  });

  it('should not render bismillah for surah 1', () => {
    renderSurah(sampleSurah);
    expect(dom.surahContent.innerHTML).not.toContain('بِسْمِ اللَّهِ');
  });

  it('should render bismillah for surah 2', () => {
    const surah2 = { ...sampleSurah, number: 2 };
    renderSurah(surah2);
    expect(dom.surahContent.innerHTML).toContain('بِسْمِ اللَّهِ');
  });

  it('should not render bismillah for surah 9', () => {
    const surah9 = { ...sampleSurah, number: 9 };
    renderSurah(surah9);
    expect(dom.surahContent.innerHTML).not.toContain('بِسْمِ اللَّهِ');
  });

  it('should include ayah numbers', () => {
    renderSurah(sampleSurah);
    sampleAyahs.forEach(a => {
      expect(dom.surahContent.innerHTML).toContain(`>${a.numberInSurah}<`);
    });
  });

  it('should set font size from state', () => {
    state.fontSize = 36;
    renderSurah(sampleSurah);
    expect(dom.surahContent.innerHTML).toContain('font-size:36px');
  });

  it('should return early if surahContent is falsy', () => {
    dom.surahContent = null;
    expect(() => renderSurah(sampleSurah)).not.toThrow();
  });
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
    expect(text).toContain('آية 2');
  });

  it('should use current ayah', () => {
    state.surahData = sampleSurah;
    state.currentAyahIndex = 0;
    const text = buildShareText();
    expect(text).toContain('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
    expect(text).toContain('آية 1');
  });
});
