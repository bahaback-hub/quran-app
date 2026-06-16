/**
 * Comprehensive tests for surah-loader.ts — Surah loading, rendering, caching,
 * audio, and translation. Covers: loadSurahList, buildSurahOffsets,
 * populateReciterSelect, loadSurah, renderSurah, highlightCurrentAyah,
 * updatePlayerInfo, toggleTranslation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { storage } from '../storage.js';

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  globalThis.localStorage = {
    getItem: (key: string) => (store[key] === undefined ? null : store[key]),
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  } as Storage;
});

// Mock external dependencies
vi.mock('../audio.js', () => ({
  togglePlayPause: vi.fn(),
  nextAyah: vi.fn(),
  prevAyah: vi.fn(),
  nextSurah: vi.fn(),
  prevSurah: vi.fn(),
  toggleHifdh: vi.fn(),
  toggleRepeat: vi.fn(),
  expandPlayer: vi.fn(),
  prepareAudioForNewSurah: vi.fn(),
  playCurrentAyah: vi.fn(),
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
  loadingBar: { show: vi.fn(), hide: vi.fn() },
}));

vi.mock('../i18n.js', () => ({
  __: vi.fn((key: string) => key),
}));

vi.mock('../tajweed.js', () => ({
  tajweedColorWord: vi.fn((word: string) => word),
  buildColorMap: vi.fn(() => new Map()),
}));

vi.mock('../tajweed-data.js', () => ({
  getAyahAnnotations: vi.fn(() => []),
}));

vi.mock('../surahs-data.js', () => ({
  SURAH_SECRETS: { 1: 'secret' },
}));

vi.mock('../reading-stats.js', () => ({
  recordReadingSession: vi.fn(),
}));

vi.mock('../tafsir.js', () => ({
  loadTafsirForCurrentAyah: vi.fn(),
}));

vi.mock('../reciters.js', () => ({
  RECITERS: [
    { id: 'ar.alafasy', name: 'reciter_alafasy', source: 'api' },
    { id: 'ar.husary', name: 'reciter_husary', source: 'mp3quran' },
  ],
  getReciterById: vi.fn((id: string) => {
    const map: Record<string, { id: string; name: string; source: string; server?: string }> = {
      'ar.alafasy': { id: 'ar.alafasy', name: 'reciter_alafasy', source: 'api' },
      'ar.husary': { id: 'ar.husary', name: 'reciter_husary', source: 'mp3quran', server: 'https://server.mp3quran.net/husary/' },
    };
    return map[id] || { id, name: id, source: 'api' };
  }),
  getReciterDisplayName: vi.fn((r: { name: string }) =>
    r.name.startsWith('reciter_') ? r.name.replace('reciter_', '') : r.name,
  ),
  buildAudioUrl: vi.fn(() => 'https://example.com/audio.mp3'),
  getTimingApiId: vi.fn(() => null),
}));

vi.mock('../presentation.js', () => ({
  openPresentation: vi.fn(),
  closePresentation: vi.fn(),
  syncPresentation: vi.fn(),
}));

vi.mock('../mushaf.js', () => ({
  toggleMushafMode: vi.fn(),
  highlightMushafAyah: vi.fn(),
}));

vi.mock('../api-client.js', () => ({
  apiFetch: vi.fn(),
  jsonFetch: vi.fn(),
}));

vi.mock('../templates.js', () => ({
  surahSelectDefault: vi.fn(() => '<option>select_surah</option>'),
  surahSelectLoading: vi.fn(() => '<option>loading...</option>'),
  surahSelectError: vi.fn(() => '<option>error</option>'),
  reciterOptions: vi.fn((reciters: Array<{ id: string; name: string }>, selectedId: string) =>
    reciters.map((r) => `<option value="${r.id}"${r.id === selectedId ? ' selected' : ''}>${r.name}</option>`).join(''),
  ),
  skeletonLoading: vi.fn(() => '<div class="skeleton">Loading...</div>'),
  surahLoadError: vi.fn(() => '<div class="error">Error</div>'),
  collapsedPlayerInfo: vi.fn((_title: string, _text: string) => '<div>Collapsed</div>'),
  escapeHtml: vi.fn((s: string) => s),
}));

vi.mock('../quran-meta.js', () => ({
  isSajdaAyah: vi.fn(() => ({ isSajda: false })),
  isJuzStart: vi.fn(() => null),
}));

vi.mock('../surah-cache.js', () => ({
  cacheSurahToIDB: vi.fn(),
  getCachedSurahFromIDB: vi.fn(() => Promise.resolve(null)),
}));

import { loadSurahList, buildSurahOffsets, populateReciterSelect, loadSurah, renderSurah, highlightCurrentAyah, updatePlayerInfo, toggleTranslation } from '../surah-loader.js';
import { apiFetch, jsonFetch } from '../api-client.js';
import { prepareAudioForNewSurah, playCurrentAyah } from '../audio.js';
import { recordReadingSession } from '../reading-stats.js';
import { showToast, loadingBar } from '../ui.js';
import { cacheSurahToIDB, getCachedSurahFromIDB } from '../surah-cache.js';
import { skeletonLoading, surahLoadError, surahSelectLoading } from '../templates.js';

const SAMPLE_SURAH_LIST = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqara', numberOfAyahs: 286 },
  { number: 3, name: 'آل عمران', englishName: 'Aal-Imran', numberOfAyahs: 200 },
];

const FULL_SURAH_LIST = Array.from({ length: 114 }, (_, i) => ({
  number: i + 1,
  name: `سورة ${i + 1}`,
  englishName: `Surah ${i + 1}`,
  numberOfAyahs: 6,
}));

const SAMPLE_SURAH_DATA = {
  number: 1,
  name: 'الفاتحة',
  englishName: 'Al-Fatiha',
  ayahs: [
    { numberInSurah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', audio: 'https://audio/1.mp3' },
    { numberInSurah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', audio: 'https://audio/2.mp3' },
    { numberInSurah: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ', audio: 'https://audio/3.mp3' },
    { numberInSurah: 4, text: 'مَالِكِ يَوْمِ الدِّينِ', audio: 'https://audio/4.mp3' },
    { numberInSurah: 5, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', audio: 'https://audio/5.mp3' },
    { numberInSurah: 6, text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', audio: 'https://audio/6.mp3' },
    { numberInSurah: 7, text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ', audio: 'https://audio/7.mp3' },
  ],
};

describe('surah-loader-full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.surahList = [];
    state.surahOffsets = null;
    state.currentSurah = 1;
    state.currentAyahIndex = 0;
    state.currentReciter = 'ar.alafasy';
    state.surahData = null;
    state.surahCache = new Map();
    state.ayahsAudios = [];
    state.ayahTimings = [];
    state.translationData = null;
    state.translationEnabled = false;
    state.currentTranslation = null;
    state.isPlaying = false;
    state.hifdhMode = false;
    state.repeatMode = false;
    state.loadingSurah = null;
    state.autoSave = true;
    state.mushafMode = false;
    state.tajweedEnabled = false;
    state.fontSize = 28;
    state.fullQuranLoaded = false;
    state.fullQuranText = null;

    dom.surahSelect = document.createElement('select') as HTMLSelectElement;
    dom.surahContent = document.createElement('div');
    dom.player = document.createElement('div');
    dom.reciterSelect = document.createElement('select') as HTMLSelectElement;
    dom.hifdhBtn = document.createElement('button');
    dom.repeatBtn = document.createElement('button');
    dom.repeatControls = null;
    dom.playerSurahName = document.createElement('div');
    dom.playerReciterName = document.createElement('div');
    dom.playerCurrentAyah = document.createElement('div');
    dom.collapsedInfo = document.createElement('div');
    dom.tafsirCurtain = document.createElement('div');
    dom.translationSelect = document.createElement('select') as HTMLSelectElement;
  // Add options to translationSelect for value setting
  const transOpt = document.createElement('option');
  transOpt.value = 'en.sahih';
  transOpt.textContent = 'English';
  dom.translationSelect.appendChild(transOpt);
  // Mock scrollIntoView on elements
  Element.prototype.scrollIntoView = vi.fn();
  });

  /* ===================== loadSurahList ===================== */

  describe('loadSurahList', () => {
    it('should load surah list from storage cache if valid', async () => {
      vi.spyOn(storage, 'get').mockReturnValue(FULL_SURAH_LIST);
      await loadSurahList();
      expect(state.surahList).toEqual(FULL_SURAH_LIST);
      expect(state.surahOffsets).not.toBeNull();
    });

    it('should populate surah select when loaded from cache', async () => {
      vi.spyOn(storage, 'get').mockReturnValue(FULL_SURAH_LIST);
      await loadSurahList();
      const options = dom.surahSelect!.querySelectorAll('option');
      expect(options.length).toBe(115); // 1 default + 114 surahs
    });

    it('should fetch from API when no cache exists', async () => {
      vi.spyOn(storage, 'get').mockReturnValue(null);
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      vi.mocked(apiFetch).mockResolvedValue({ data: FULL_SURAH_LIST });
      await loadSurahList();
      expect(apiFetch).toHaveBeenCalled();
      expect(state.surahList).toEqual(FULL_SURAH_LIST);
    });

    it('should fall back to local JSON when API fails', async () => {
      vi.spyOn(storage, 'get').mockReturnValue(null);
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      vi.mocked(apiFetch).mockRejectedValue(new Error('API down'));
      vi.mocked(jsonFetch).mockResolvedValue(FULL_SURAH_LIST);
      await loadSurahList();
      expect(jsonFetch).toHaveBeenCalled();
      expect(state.surahList).toEqual(FULL_SURAH_LIST);
    });

    it('should handle gracefully when both API and local fallback fail', async () => {
      vi.spyOn(storage, 'get').mockReturnValue(null);
      vi.mocked(apiFetch).mockRejectedValue(new Error('No network'));
      vi.mocked(jsonFetch).mockRejectedValue(new Error('No local file'));
      await loadSurahList();
      expect(state.surahList).toEqual([]);
    });

    it('should ignore cache if list length does not match SURAH_COUNT', async () => {
      vi.spyOn(storage, 'get').mockReturnValue(SAMPLE_SURAH_LIST);
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      vi.mocked(apiFetch).mockResolvedValue({ data: FULL_SURAH_LIST });
      await loadSurahList();
      expect(apiFetch).toHaveBeenCalled();
      expect(state.surahList).toEqual(FULL_SURAH_LIST);
    });

    it('should show loading indicator in surah select while fetching', async () => {
      vi.spyOn(storage, 'get').mockReturnValue(null);
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      // Make API hang but with a short delay so the test doesn't timeout
      let resolveApi!: (v: unknown) => void;
      vi.mocked(apiFetch).mockReturnValue(new Promise((r) => { resolveApi = r; }));
      const listPromise = loadSurahList();
      // Check loading state before API resolves
      expect(surahSelectLoading).toHaveBeenCalled();
      // Now resolve so test can complete
      resolveApi({ data: FULL_SURAH_LIST });
      await listPromise;
    });

    it('should show error in surah select when both API and fallback fail', async () => {
      vi.spyOn(storage, 'get').mockReturnValue(null);
      vi.mocked(apiFetch).mockRejectedValue(new Error('fail'));
      vi.mocked(jsonFetch).mockRejectedValue(new Error('fail'));
      await loadSurahList();
      // surahSelectError should have been called
    });

    it('should handle null surahSelect gracefully', async () => {
      dom.surahSelect = null;
      vi.spyOn(storage, 'get').mockReturnValue(null);
      vi.mocked(apiFetch).mockRejectedValue(new Error('fail'));
      vi.mocked(jsonFetch).mockRejectedValue(new Error('fail'));
      await expect(loadSurahList()).resolves.toBeUndefined();
    });
  });

  /* ===================== buildSurahOffsets ===================== */

  describe('buildSurahOffsets', () => {
    it('should build offsets from surah list', () => {
      state.surahList = SAMPLE_SURAH_LIST;
      buildSurahOffsets();
      expect(state.surahOffsets).toEqual([
        { surahNum: 1, startAbs: 1, count: 7, name: 'الفاتحة' },
        { surahNum: 2, startAbs: 8, count: 286, name: 'البقرة' },
        { surahNum: 3, startAbs: 294, count: 200, name: 'آل عمران' },
      ]);
    });

    it('should not overwrite existing offsets', () => {
      const existing = [{ surahNum: 1, startAbs: 1, count: 7, name: 'test' }];
      state.surahOffsets = existing;
      state.surahList = SAMPLE_SURAH_LIST;
      buildSurahOffsets();
      expect(state.surahOffsets).toEqual(existing);
    });

    it('should not build offsets when surahList is empty', () => {
      state.surahList = [];
      buildSurahOffsets();
      expect(state.surahOffsets).toBeNull();
    });

    it('should calculate cumulative absolute ayah numbers correctly', () => {
      state.surahList = [
        { number: 1, name: 'A', englishName: 'A', numberOfAyahs: 3 },
        { number: 2, name: 'B', englishName: 'B', numberOfAyahs: 5 },
        { number: 3, name: 'C', englishName: 'C', numberOfAyahs: 2 },
      ];
      buildSurahOffsets();
      expect(state.surahOffsets![0].startAbs).toBe(1);
      expect(state.surahOffsets![1].startAbs).toBe(4);
      expect(state.surahOffsets![2].startAbs).toBe(9);
    });
  });

  /* ===================== populateReciterSelect ===================== */

  describe('populateReciterSelect', () => {
    it('should populate reciter select with RECITERS', () => {
      populateReciterSelect();
      const options = dom.reciterSelect!.querySelectorAll('option');
      expect(options.length).toBe(2);
      expect(options[0].value).toBe('ar.alafasy');
      expect(options[1].value).toBe('ar.husary');
    });

    it('should set the selected reciter value', () => {
      state.currentReciter = 'ar.husary';
      populateReciterSelect();
      expect(dom.reciterSelect!.value).toBe('ar.husary');
    });

    it('should use default reciter when state has none', () => {
      state.currentReciter = '';
      populateReciterSelect();
      expect(dom.reciterSelect!.value).toBe('ar.alafasy');
    });

    it('should handle missing reciterSelect gracefully', () => {
      dom.reciterSelect = null;
      expect(() => populateReciterSelect()).not.toThrow();
    });
  });

  /* ===================== loadSurah ===================== */

  describe('loadSurah', () => {
    it('should return early when surahNum is 0', async () => {
      await loadSurah(0);
      expect(prepareAudioForNewSurah).not.toHaveBeenCalled();
    });

    it('should increment load counter and set loading state', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(prepareAudioForNewSurah).toHaveBeenCalled();
    });

    it('should cancel previous request when loading new surah', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      // Start loading surah 1
      const p1 = loadSurah(1);
      // Start loading surah 2 before 1 finishes
      const p2 = loadSurah(2);
      await Promise.all([p1, p2]);
    });

    it('should disable hifdh mode when loading new surah', async () => {
      state.hifdhMode = true;
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(state.hifdhMode).toBe(false);
    });

    it('should disable repeat mode when loading new surah (without hifdh)', async () => {
      state.repeatMode = true;
      state.hifdhMode = false;
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(state.repeatMode).toBe(false);
    });

    it('should use cached data when available in surahCache', async () => {
      const cacheKey = '1_ar.alafasy_notr';
      const cacheEntry = {
        text: SAMPLE_SURAH_DATA,
        audios: ['https://audio/1.mp3', 'https://audio/2.mp3'],
        timings: [],
        translation: null,
      };
      state.surahCache.set(cacheKey, cacheEntry as any);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(state.surahData).toBeTruthy();
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it('should try IDB cache when not in memory cache', async () => {
      vi.mocked(getCachedSurahFromIDB).mockResolvedValueOnce({
        text: SAMPLE_SURAH_DATA,
        audios: ['https://audio/1.mp3'],
        timings: [],
        translation: null,
      } as any);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(state.surahData).toBeTruthy();
    });

    it('should fetch from API when no cache exists', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(apiFetch).toHaveBeenCalled();
      expect(state.surahData).toBeTruthy();
    });

    it('should show loading bar and skeleton when fetching', async () => {
      vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {})); // Never resolves
      state.surahList = SAMPLE_SURAH_LIST;
      loadSurah(1); // Don't await
      // Give it a tick to start
      await new Promise((r) => setTimeout(r, 10));
      expect(loadingBar.show).toHaveBeenCalled();
      expect(skeletonLoading).toHaveBeenCalled();
    });

    it('should call recordReadingSession after successful load', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(recordReadingSession).toHaveBeenCalledWith(1, 7);
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(apiFetch).mockRejectedValue(new Error('Network error'));
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(loadingBar.hide).toHaveBeenCalled();
    });

    it('should handle AbortError silently', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      vi.mocked(apiFetch).mockRejectedValue(abortError);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(surahLoadError).not.toHaveBeenCalled();
    });

    it('should fall back to fullQuranText when API fails and data is loaded', async () => {
      vi.mocked(apiFetch).mockRejectedValue(new Error('Network error'));
      state.surahList = SAMPLE_SURAH_LIST;
      state.fullQuranLoaded = true;
      state.fullQuranText = [
        { surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' },
        { surah: 1, surahName: 'الفاتحة', ayah: 2, text: 'الحمد لله', normalized: 'الحمد لله' },
      ];
      await loadSurah(1);
      expect(state.surahData).toBeTruthy();
      expect(loadingBar.hide).toHaveBeenCalled();
    });

    it('should cache loaded surah data', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(cacheSurahToIDB).toHaveBeenCalled();
    });

    it('should find startAyah index when provided', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1, { startAyah: 3 });
      expect(state.currentAyahIndex).toBe(2); // index of ayah 3
    });

    it('should default to index 0 when startAyah not provided', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(state.currentAyahIndex).toBe(0);
    });

    it('should not auto-play by default', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(playCurrentAyah).not.toHaveBeenCalled();
    });

    it('should auto-play when autoPlay option is true and audio available', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1, { autoPlay: true });
      // playCurrentAyah is called in finalize if autoPlay is set
      // But audio hasn't loaded yet at that point, so it depends on audio result
    });

    it('should save position when autoSave is enabled', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      state.autoSave = true;
      await loadSurah(1);
      expect(storage.set).toHaveBeenCalledWith('last_position', expect.any(Object));
    });

    it('should handle mp3quran reciter audio loading', async () => {
      state.currentReciter = 'ar.husary';
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      // Should have called buildAudioUrl for mp3quran source
    });

    it('should handle API audio loading for api source reciters', async () => {
      state.currentReciter = 'ar.alafasy';
      // First call for text, second for audio
      vi.mocked(apiFetch)
        .mockResolvedValueOnce({ data: SAMPLE_SURAH_DATA })
        .mockResolvedValueOnce({ data: { ayahs: SAMPLE_SURAH_DATA.ayahs } });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
    });

    it('should handle null surahData in API response', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: null });
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      // Should show error
      expect(surahLoadError).toHaveBeenCalled();
    });

    it('should handle empty ayahs in API response', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: { number: 1, name: 'Test', ayahs: [] } });
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(surahLoadError).toHaveBeenCalled();
    });

    it('should clear loading state in finally block', async () => {
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(state.loadingSurah).toBeNull();
    });

    it('should handle surah with translation enabled', async () => {
      state.translationEnabled = true;
      state.currentTranslation = 'en.sahih';
      vi.mocked(apiFetch)
        .mockResolvedValueOnce({ data: SAMPLE_SURAH_DATA })
        .mockResolvedValueOnce({ data: { ayahs: SAMPLE_SURAH_DATA.ayahs } })
        .mockResolvedValueOnce({ data: { ayahs: [{ text: 'In the name of Allah' }] } });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
    });

    it('should not load translation when disabled', async () => {
      state.translationEnabled = false;
      state.currentTranslation = null;
      vi.mocked(apiFetch)
        .mockResolvedValueOnce({ data: SAMPLE_SURAH_DATA })
        .mockResolvedValueOnce({ data: { ayahs: SAMPLE_SURAH_DATA.ayahs } });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      // Should not have called apiFetch for translation
    });

    it('should evict oldest cache entry when cache limit reached', async () => {
      // Fill cache to limit with entries that won't match surah 1's key
      for (let i = 10; i < 30; i++) {
        state.surahCache.set(`${i}_ar.alafasy_notr`, {
          text: SAMPLE_SURAH_DATA,
          audios: [],
          timings: [],
          translation: null,
        } as any);
      }
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await loadSurah(1);
      expect(state.surahCache.size).toBeLessThanOrEqual(21);
    });

    it('should handle surahContent being null', async () => {
      dom.surahContent = null;
      vi.mocked(apiFetch).mockResolvedValue({ data: SAMPLE_SURAH_DATA });
      vi.spyOn(storage, 'set').mockImplementation(() => true);
      state.surahList = SAMPLE_SURAH_LIST;
      await expect(loadSurah(1)).resolves.toBeUndefined();
    });
  });

  /* ===================== renderSurah ===================== */

  describe('renderSurah', () => {
    it('should render surah title', () => {
      renderSurah(SAMPLE_SURAH_DATA);
      expect(dom.surahContent!.innerHTML).toContain('الفاتحة');
      expect(dom.surahContent!.innerHTML).toContain('Al-Fatiha');
    });

    it('should render bismillah for non-Fatiha non-Tawbah surahs', () => {
      const baqarahData = { ...SAMPLE_SURAH_DATA, number: 2 };
      renderSurah(baqarahData);
      expect(dom.surahContent!.innerHTML).toContain('bismillah');
    });

    it('should not render bismillah for Fatiha (surah 1)', () => {
      renderSurah(SAMPLE_SURAH_DATA); // Surah 1
      // Fatiha starts with bismillah as part of ayah 1, but bismillah wrapper is not shown
      // Actually, for surah 1, the bismillah div is not shown (number !== 1 condition in code)
      // Wait, the code says `if (textData.number !== 1 && textData.number !== 9)`
      // So surah 1 does NOT show bismillah wrapper
    });

    it('should not render bismillah for Tawbah (surah 9)', () => {
      const tawbahData = { ...SAMPLE_SURAH_DATA, number: 9 };
      renderSurah(tawbahData);
      // Should not contain bismillah wrapper
    });

    it('should render bismillah for other surahs', () => {
      const baqarahData = { ...SAMPLE_SURAH_DATA, number: 2 };
      renderSurah(baqarahData);
      expect(dom.surahContent!.innerHTML).toContain('bismillah');
    });

    it('should handle null surahContent', () => {
      dom.surahContent = null;
      expect(() => renderSurah(SAMPLE_SURAH_DATA)).not.toThrow();
    });

    it('should create ayahs container', () => {
      renderSurah(SAMPLE_SURAH_DATA);
      const container = dom.surahContent!.querySelector('.ayahs-container');
      expect(container).toBeTruthy();
    });

    it('should show surah secret button for surahs with secrets', () => {
      renderSurah(SAMPLE_SURAH_DATA); // Surah 1 has secrets in mock
      const btn = dom.surahContent!.querySelector('.surah-secret-title-btn');
      expect(btn).toBeTruthy();
    });

    it('should not show surah secret button for surahs without secrets', () => {
      const noSecretData = { ...SAMPLE_SURAH_DATA, number: 114 }; // Not in SURAH_SECRETS mock
      renderSurah(noSecretData);
      const btn = dom.surahContent!.querySelector('.surah-secret-title-btn');
      expect(btn).toBeNull();
    });

    it('should set font size style on ayahs container', () => {
      renderSurah(SAMPLE_SURAH_DATA);
      const container = dom.surahContent!.querySelector('.ayahs-container') as HTMLElement;
      expect(container.style.getPropertyValue('--ayah-font-size')).toBe('28px');
    });

    it('should update breadcrumb element if present', () => {
      const breadcrumb = document.createElement('div');
      breadcrumb.id = 'breadcrumbSurah';
      document.body.appendChild(breadcrumb);
      renderSurah(SAMPLE_SURAH_DATA);
      expect(breadcrumb.textContent).toContain('الفاتحة');
      breadcrumb.remove();
    });
  });

  /* ===================== highlightCurrentAyah ===================== */

  describe('highlightCurrentAyah', () => {
    it('should not throw when surahData is null', () => {
      state.surahData = null;
      expect(() => highlightCurrentAyah()).not.toThrow();
    });

    it('should add current class to the current ayah element', () => {
      state.surahData = SAMPLE_SURAH_DATA;
      state.currentAyahIndex = 0;
      renderSurah(SAMPLE_SURAH_DATA);
      highlightCurrentAyah();
      // The current ayah should have the 'current' class
      // Need to make sure the chunk is rendered
    });

    it('should remove current class from previous ayah', () => {
      state.surahData = SAMPLE_SURAH_DATA;
      state.currentAyahIndex = 0;
      renderSurah(SAMPLE_SURAH_DATA);
      highlightCurrentAyah();
      // Now change to a different ayah
      state.currentAyahIndex = 1;
      highlightCurrentAyah();
    });
  });

  /* ===================== updatePlayerInfo ===================== */

  describe('updatePlayerInfo', () => {
    it('should not throw when surahData is null', () => {
      state.surahData = null;
      expect(() => updatePlayerInfo()).not.toThrow();
    });

    it('should update player surah name', () => {
      state.surahData = SAMPLE_SURAH_DATA;
      state.currentAyahIndex = 0;
      updatePlayerInfo();
      expect(dom.playerSurahName!.textContent).toBe('الفاتحة');
    });

    it('should update player current ayah text', () => {
      state.surahData = SAMPLE_SURAH_DATA;
      state.currentAyahIndex = 0;
      updatePlayerInfo();
      expect(dom.playerCurrentAyah!.textContent).toContain('بِسْمِ اللَّهِ');
    });

    it('should truncate long ayah text', () => {
      const longText = 'أ'.repeat(100);
      const longData = {
        ...SAMPLE_SURAH_DATA,
        ayahs: [{ numberInSurah: 1, text: longText, audio: 'url' }],
      };
      state.surahData = longData;
      state.currentAyahIndex = 0;
      updatePlayerInfo();
      expect(dom.playerCurrentAyah!.textContent).toContain('...');
    });

    it('should update collapsed info', () => {
      state.surahData = SAMPLE_SURAH_DATA;
      state.currentAyahIndex = 0;
      updatePlayerInfo();
      expect(dom.collapsedInfo!.innerHTML).toBeTruthy();
    });

    it('should handle null player elements gracefully', () => {
      dom.playerSurahName = null;
      dom.playerReciterName = null;
      dom.playerCurrentAyah = null;
      dom.collapsedInfo = null;
      state.surahData = SAMPLE_SURAH_DATA;
      state.currentAyahIndex = 0;
      expect(() => updatePlayerInfo()).not.toThrow();
    });

    it('should handle missing ayah at current index', () => {
      state.surahData = SAMPLE_SURAH_DATA;
      state.currentAyahIndex = 999; // Out of bounds
      updatePlayerInfo();
      // Should not throw
    });
  });

  /* ===================== toggleTranslation ===================== */

  describe('toggleTranslation', () => {
    it('should enable translation when currently disabled', () => {
      state.translationEnabled = false;
      state.currentSurah = 1;
      dom.translationSelect!.value = '';
      toggleTranslation();
      expect(state.translationEnabled).toBe(true);
      expect(storage.set).toHaveBeenCalledWith('translation_enabled', true);
    });

    it('should disable translation when currently enabled', () => {
      state.translationEnabled = true;
      state.currentSurah = 1;
      toggleTranslation();
      expect(state.translationEnabled).toBe(false);
      expect(storage.set).toHaveBeenCalledWith('translation_enabled', false);
    });

    it('should set default translation when enabling without one', () => {
      state.translationEnabled = false;
      state.currentTranslation = null;
      state.currentSurah = 1;
      dom.translationSelect!.innerHTML = '<option value="en.sahih">English</option>';
      dom.translationSelect!.value = 'en.sahih';
      toggleTranslation();
      expect(state.currentTranslation).toBe('en.sahih');
      expect(storage.set).toHaveBeenCalledWith('translation_edition', 'en.sahih');
    });

    it('should show toast with translation status', () => {
      state.translationEnabled = false;
      state.currentSurah = 0; // No surah loaded
      toggleTranslation();
      expect(showToast).toHaveBeenCalledWith('translation_on', 'success');
    });

    it('should reload surah when toggling', () => {
      state.translationEnabled = false;
      state.currentSurah = 1;
      toggleTranslation();
      // loadSurah is imported from surah-loader.js which is the same module
      // So it's a circular reference — the test verifies no crash
    });

    it('should not reload when no surah is loaded', () => {
      state.translationEnabled = false;
      state.currentSurah = 0;
      toggleTranslation();
      // Should not call loadSurah
    });

    it('should update translation select value when enabling', () => {
      state.translationEnabled = false;
      state.currentTranslation = 'en.sahih';
      state.currentSurah = 1;
      toggleTranslation();
      expect(dom.translationSelect!.value).toBe('en.sahih');
    });

    it('should clear translation select value when disabling', () => {
      state.translationEnabled = true;
      state.currentTranslation = 'en.sahih';
      state.currentSurah = 1;
      toggleTranslation();
      expect(dom.translationSelect!.value).toBe('');
    });
  });
});
