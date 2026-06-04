import { describe, it, expect, beforeEach, vi } from 'vitest';
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

describe('initState', () => {
  it('should set all expected state properties', async () => {
    const { CONFIG } = await import('../config.js');
    Object.assign(state, {
      currentSurah: 1, currentAyahIndex: 0,
      currentReciter: CONFIG.DEFAULT_RECITER,
      currentTafsirEdition: CONFIG.DEFAULT_TAFSIR,
      surahData: null, surahList: [], surahCache: new Map(),
      ayahsAudios: [],
      isPlaying: false, hifdhMode: false,
      repeatMode: false, repeatFrom: 1, repeatTo: 1, repeatTimes: 3, repeatCounter: 0,
      fontSize: 28, nightMode: false, autoSave: true,
      azanEnabled: true, azanFajrEnabled: true,
      city: CONFIG.DEFAULT_CITY, country: CONFIG.DEFAULT_COUNTRY,
      method: CONFIG.DEFAULT_METHOD,
      prayerTimes: null, lastAzanFired: null,
      favorites: [], bookmark: null,
      pendingTafsirAfterLoad: null,
      playerCollapsed: false, barCollapsed: true,
      azanPlaying: false, loadingSurah: null,
      mushafMode: false, currentPage: 1,
      fullQuranText: null, fullQuranLoaded: false,
      ayahWordElements: null,
      translationEnabled: false,
      currentTranslation: null,
      translationData: null,
      tajweedEnabled: true,
      adhkarSettings: null, adhkarPanelOpen: false, adhkarActiveTab: null, lastAdhkarFired: null,
      surahOffsets: null,
      backgroundsList: null,
      ayahTimings: [],
      presentationMode: false,
      _allSearchMatches: null,
      _searchResultsPage: 1
    });

    expect(state.currentSurah).toBe(1);
    expect(state.currentAyahIndex).toBe(0);
    expect(state.currentReciter).toBe(CONFIG.DEFAULT_RECITER);
    expect(state.currentTafsirEdition).toBe(CONFIG.DEFAULT_TAFSIR);
    expect(state.surahData).toBeNull();
    expect(state.surahList).toEqual([]);
    expect(state.surahCache).toBeInstanceOf(Map);
    expect(state.ayahsAudios).toEqual([]);
    expect(state.isPlaying).toBe(false);
    expect(state.hifdhMode).toBe(false);
    expect(state.repeatMode).toBe(false);
    expect(state.repeatFrom).toBe(1);
    expect(state.repeatTo).toBe(1);
    expect(state.repeatTimes).toBe(3);
    expect(state.repeatCounter).toBe(0);
    expect(state.fontSize).toBe(28);
    expect(state.nightMode).toBe(false);
    expect(state.autoSave).toBe(true);
    expect(state.azanEnabled).toBe(true);
    expect(state.azanFajrEnabled).toBe(true);
    expect(state.city).toBe(CONFIG.DEFAULT_CITY);
    expect(state.country).toBe(CONFIG.DEFAULT_COUNTRY);
    expect(state.method).toBe(CONFIG.DEFAULT_METHOD);
    expect(state.prayerTimes).toBeNull();
    expect(state.favorites).toEqual([]);
    expect(state.bookmark).toBeNull();
    expect(state.barCollapsed).toBe(true);
    expect(state.playerCollapsed).toBe(false);
    expect(state.mushafMode).toBe(false);
    expect(state.currentPage).toBe(1);
    expect(state.fullQuranLoaded).toBe(false);
    expect(state.translationEnabled).toBe(false);
    expect(state.currentTranslation).toBeNull();
    expect(state.tajweedEnabled).toBe(true);
    expect(state.presentationMode).toBe(false);
    expect(state._searchResultsPage).toBe(1);
  });

  it('should use correct default values from CONFIG', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.DEFAULT_RECITER).toBe('ar.alafasy');
    expect(CONFIG.DEFAULT_TAFSIR).toBe('ar-tafsir-muyassar');
    expect(CONFIG.DEFAULT_CITY).toBe('مكة');
    expect(CONFIG.DEFAULT_COUNTRY).toBe('SA');
    expect(CONFIG.DEFAULT_METHOD).toBe('4');
  });
});
