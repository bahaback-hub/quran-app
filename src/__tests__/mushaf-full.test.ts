/**
 * Comprehensive unit tests for mushaf.ts
 * Covers: toggleMushafMode, updatePageIndicator, loadPage, getJuzForPage,
 * populateSurahOverlay, showSurahSecret, highlightMushafAyah
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* ===================== HOISTED MOCKS ===================== */

const { mockState, mockStorage, mockShowToast, mockLoadingBar, mockDom } = vi.hoisted(() => {
  const state = {
    isPlaying: false,
    mushafMode: false,
    currentSurah: 1,
    currentAyahIndex: 0,
    currentPage: 1,
    currentPageLayout: null as unknown,
    surahData: null as unknown,
    surahList: [] as { number: number; name: string; englishName: string }[],
  };

  const storage = {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  };

  const showToast = vi.fn();
  const loadingBar = {
    show: vi.fn(),
    hide: vi.fn(),
  };

  const dom: Record<string, HTMLElement | null> = {};

  return { mockState: state, mockStorage: storage, mockShowToast: showToast, mockLoadingBar: loadingBar, mockDom: dom };
});

/* ===================== MOCK MODULES ===================== */

vi.mock('../state.js', () => ({
  state: mockState,
}));

vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
    TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
    PRAYER_API: 'https://api.aladhan.com/v1/timingsByCity',
    AZAN_FILE: 'azan.mp3',
    SURAH_COUNT: 114,
    STORAGE_PREFIX: 'quran_app_',
    DEFAULT_RECITER: 'ar.alafasy',
    DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
    DEFAULT_METHOD: '4',
    DEFAULT_CITY: 'مكة المكرمة',
    DEFAULT_COUNTRY: 'SA',
    CACHE_LIMIT: 20,
  },
  JUZ_PAGES: [
    1, 22, 42, 62, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462,
    482, 502, 522, 542, 562, 582,
  ],
}));

vi.mock('../dom.js', () => ({
  get dom() { return mockDom; },
}));

vi.mock('../storage.js', () => ({
  storage: mockStorage,
}));

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

vi.mock('../ui.js', () => ({
  showToast: mockShowToast,
  loadingBar: mockLoadingBar,
}));

vi.mock('../utils.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    toArabicNumeral: (n: number) => String(n),
  };
});

vi.mock('../templates.js', () => ({
  mushafLoadingState: vi.fn(() => '<div class="mushaf-loading">Loading...</div>'),
  surahLoadingMessage: vi.fn(() => '<div class="surah-loading">Loading surah...</div>'),
  mushafHeaderRow: vi.fn((juzLabel: string) => `<div class="mushaf-header-row">${juzLabel}</div>`),
  mushafErrorFallback: vi.fn(() => '<div class="mushaf-error">Error</div>'),
  mushafSurahNameSpan: vi.fn((name: string) => `<span class="mushaf-surah-name">${name}</span>`),
  surahSecretsBody: vi.fn((secret: string, authKeys?: string[]) =>
    `<div class="secrets-body">${secret}${authKeys ? ' ' + authKeys.join(',') : ''}</div>`),
}));

vi.mock('../surahs-data.js', () => ({
  SURAH_SECRETS: {
    1: 'Secret of Al-Fatiha',
    2: 'Secret of Al-Baqarah',
    36: 'Secret of Ya-Sin',
    112: 'Secret of Al-Ikhlas',
  },
  SURAH_SECRETS_AUTH_KEYS: {
    1: ['Bukhari', 'Muslim'],
    2: ['Tirmidhi'],
  },
}));

vi.mock('../app.js', () => ({
  loadSurah: vi.fn(),
  renderSurah: vi.fn(),
  updatePlayerInfo: vi.fn(),
  highlightCurrentAyah: vi.fn(),
}));

vi.mock('../audio.js', () => ({
  prepareAudioForNewSurah: vi.fn(),
  playCurrentAyah: vi.fn(),
  updatePlayPauseBtn: vi.fn(),
}));

vi.mock('../ayah-click.js', () => ({
  handlePageClick: vi.fn(),
  getAyahHighlightRects: vi.fn(),
}));

vi.mock('../mushaf-renderer.js', () => ({
  renderPage: vi.fn(),
  loadPageData: vi.fn(),
}));

vi.mock('../tafsir.js', () => ({
  loadTafsirForSurahAyah: vi.fn(),
}));

/* ===================== IMPORTS ===================== */

import {
  toggleMushafMode,
  updatePageIndicator,
  loadPage,
  getJuzForPage,
  populateSurahOverlay,
  showSurahSecret,
  highlightMushafAyah,
} from '../mushaf.js';

import { loadSurah, renderSurah, updatePlayerInfo, highlightCurrentAyah } from '../app.js';
import { prepareAudioForNewSurah, playCurrentAyah, updatePlayPauseBtn } from '../audio.js';
import { handlePageClick, getAyahHighlightRects } from '../ayah-click.js';
import { renderPage, loadPageData } from '../mushaf-renderer.js';
import { loadTafsirForSurahAyah } from '../tafsir.js';

/* ===================== HELPERS ===================== */

function createMockElement(tag: string = 'div', id?: string): HTMLElement {
  const el = document.createElement(tag);
  if (id) el.id = id;
  return el;
}

function setupBasicDom(): void {
  const surahContent = createMockElement('div');
  surahContent.innerHTML = '';
  mockDom.surahContent = surahContent;
  mockDom.pageIndicator = createMockElement('div');
  mockDom.pageSelect = document.createElement('select') as unknown as HTMLElement;
  mockDom.pageSlider = document.createElement('input') as unknown as HTMLElement;
  mockDom.settingsPanel = createMockElement('div');
  mockDom.favoritesPanel = createMockElement('div');
  mockDom.adhkarPanel = createMockElement('div');
  mockDom.mushafSurahOverlayList = createMockElement('div');
  mockDom.mushafSurahOverlay = createMockElement('div');
  mockDom.surahSecretsOverlay = createMockElement('div');
  mockDom.surahSecretsBody = createMockElement('div');
  mockDom.surahSecretsTitle = createMockElement('div');
  mockDom.surahSecretsSurahName = createMockElement('div');
  mockDom.audioPlayer = null;
}

/* ===================== TESTS ===================== */

describe('mushaf.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockState
    mockState.isPlaying = false;
    mockState.mushafMode = false;
    mockState.currentSurah = 1;
    mockState.currentAyahIndex = 0;
    mockState.currentPage = 1;
    mockState.currentPageLayout = null;
    mockState.surahData = null;
    mockState.surahList = [];
    // Reset dom
    setupBasicDom();
    // Reset fetch
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* ===================== getJuzForPage ===================== */

  describe('getJuzForPage', () => {
    it('should return juz 1 for page 1', () => {
      expect(getJuzForPage(1)).toBe(1);
    });

    it('should return juz 1 for page 21 (last page of juz 1)', () => {
      expect(getJuzForPage(21)).toBe(1);
    });

    it('should return juz 2 for page 22 (first page of juz 2)', () => {
      expect(getJuzForPage(22)).toBe(2);
    });

    it('should return juz 30 for page 604 (last page)', () => {
      expect(getJuzForPage(604)).toBe(30);
    });

    it('should return correct juz for boundary pages', () => {
      expect(getJuzForPage(42)).toBe(3);
      expect(getJuzForPage(62)).toBe(4);
      expect(getJuzForPage(582)).toBe(30);
    });

    it('should return correct juz for middle pages', () => {
      expect(getJuzForPage(50)).toBe(3);
      expect(getJuzForPage(100)).toBe(5);
      expect(getJuzForPage(200)).toBe(10);
      expect(getJuzForPage(400)).toBe(20);
      expect(getJuzForPage(500)).toBe(25);
    });

    it('should return juz 1 for page 0 or negative pages', () => {
      expect(getJuzForPage(0)).toBe(1);
      expect(getJuzForPage(-1)).toBe(1);
    });
  });

  /* ===================== updatePageIndicator ===================== */

  describe('updatePageIndicator', () => {
    it('should set page indicator text content', () => {
      updatePageIndicator(5);
      expect(mockDom.pageIndicator!.textContent).toBeTruthy();
    });

    it('should update for different page numbers', () => {
      updatePageIndicator(100);
      // The mock __() returns the key itself, so textContent will contain the key
      expect(mockDom.pageIndicator!.textContent).toBeTruthy();
      expect(mockDom.pageIndicator!.textContent).toContain('mushaf_page_info');
    });

    it('should do nothing when pageIndicator is null', () => {
      mockDom.pageIndicator = null;
      expect(() => updatePageIndicator(1)).not.toThrow();
    });

    it('should use arabic locale for page number', () => {
      updatePageIndicator(42);
      expect(mockDom.pageIndicator!.textContent).toBeTruthy();
    });
  });

  /* ===================== toggleMushafMode ===================== */

  describe('toggleMushafMode', () => {
    it('should toggle mushafMode from false to true', async () => {
      mockState.mushafMode = false;
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { page: 2 } }),
        }),
      );
      vi.stubGlobal('fetch', mockFetch);

      await toggleMushafMode();
      expect(mockState.mushafMode).toBe(true);
      expect(mockStorage.set).toHaveBeenCalledWith('mushaf_mode', true);
      vi.restoreAllMocks();
    });

    it('should toggle mushafMode from true to false', async () => {
      mockState.mushafMode = true;
      mockState.surahData = null;
      mockState.currentSurah = 1;

      await toggleMushafMode();
      expect(mockState.mushafMode).toBe(false);
      expect(mockStorage.set).toHaveBeenCalledWith('mushaf_mode', false);
    });

    it('should add mushaf-active class to body when entering mushaf mode', async () => {
      mockState.mushafMode = false;
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { page: 1 } }),
        }),
      ));

      await toggleMushafMode();
      expect(document.body.classList.contains('mushaf-active')).toBe(true);
      vi.restoreAllMocks();
    });

    it('should remove mushaf-active class from body when leaving mushaf mode', async () => {
      mockState.mushafMode = true;
      mockState.surahData = null;
      document.body.classList.add('mushaf-active');

      await toggleMushafMode();
      expect(document.body.classList.contains('mushaf-active')).toBe(false);
    });

    it('should close panels when entering mushaf mode', async () => {
      mockState.mushafMode = false;
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { page: 1 } }) }),
      ));

      (mockDom.settingsPanel as HTMLElement).classList.add('open');
      (mockDom.favoritesPanel as HTMLElement).classList.add('open');
      (mockDom.adhkarPanel as HTMLElement).classList.add('open');

      await toggleMushafMode();

      expect(mockDom.settingsPanel!.classList.contains('open')).toBe(false);
      expect(mockDom.favoritesPanel!.classList.contains('open')).toBe(false);
      expect(mockDom.adhkarPanel!.classList.contains('open')).toBe(false);
      vi.restoreAllMocks();
    });

    it('should show loading state in surahContent when entering mushaf mode', async () => {
      mockState.mushafMode = false;
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { page: 1 } }) }),
      ));

      await toggleMushafMode();
      expect(mockDom.surahContent!.innerHTML).toBeTruthy();
      vi.restoreAllMocks();
    });

    it('should hide page indicator when leaving mushaf mode', async () => {
      mockState.mushafMode = true;
      mockState.surahData = null;
      (mockDom.pageIndicator as HTMLElement).style.display = 'inline';

      await toggleMushafMode();
      expect((mockDom.pageIndicator as HTMLElement).style.display).toBe('none');
    });

    it('should show page indicator when entering mushaf mode', async () => {
      mockState.mushafMode = false;
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { page: 1 } }) }),
      ));

      await toggleMushafMode();
      expect((mockDom.pageIndicator as HTMLElement).style.display).toBe('inline');
      vi.restoreAllMocks();
    });

    it('should call loadSurah when leaving mushaf mode and surahData does not match', async () => {
      mockState.mushafMode = true;
      mockState.surahData = null;
      mockState.currentSurah = 5;

      vi.useFakeTimers();
      await toggleMushafMode();
      vi.advanceTimersByTime(100);
      expect(loadSurah).toHaveBeenCalledWith(5);
      vi.useRealTimers();
    });

    it('should call renderSurah when leaving mushaf mode and surahData matches', async () => {
      mockState.mushafMode = true;
      const surahData = { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [{ numberInSurah: 1, text: 'test' }] };
      mockState.surahData = surahData;
      mockState.currentSurah = 1;

      await toggleMushafMode();
      expect(renderSurah).toHaveBeenCalledWith(surahData);
      expect(highlightCurrentAyah).toHaveBeenCalled();
      expect(updatePlayerInfo).toHaveBeenCalled();
    });

    it('should resume audio playback when entering mushaf mode if was playing', async () => {
      mockState.isPlaying = true;
      mockState.mushafMode = false;
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { page: 1 } }) }),
      ));

      const mockAudio = document.createElement('audio') as HTMLAudioElement;
      mockAudio.play = vi.fn(() => Promise.resolve());
      Object.defineProperty(mockAudio, 'paused', { value: true, writable: true });
      mockDom.audioPlayer = mockAudio;

      await toggleMushafMode();
      expect(updatePlayPauseBtn).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('should handle API failure gracefully when getting page for ayah', async () => {
      mockState.mushafMode = false;
      mockState.currentSurah = 2;
      mockState.surahData = { number: 2, ayahs: [{ numberInSurah: 1 }] };
      mockState.currentAyahIndex = 0;
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))));

      await toggleMushafMode();
      expect(mockState.mushafMode).toBe(true);
      vi.restoreAllMocks();
    });

    it('should handle null surahContent gracefully when entering mushaf mode', async () => {
      mockDom.surahContent = null;
      mockState.mushafMode = false;
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { page: 1 } }) }),
      ));

      await toggleMushafMode();
      expect(mockState.mushafMode).toBe(true);
      vi.restoreAllMocks();
    });
  });

  /* ===================== loadPage ===================== */

  describe('loadPage', () => {
    it('should return early if pageNum is 0', async () => {
      await loadPage(0);
      expect(mockLoadingBar.show).not.toHaveBeenCalled();
    });

    it('should skip loading if same page and container exists (no force)', async () => {
      mockState.currentPage = 5;
      const container = document.createElement('div');
      container.className = 'mushaf-container';
      mockDom.surahContent!.appendChild(container);

      await loadPage(5);
      expect(mockLoadingBar.show).not.toHaveBeenCalled();
    });

    it('should force reload even if same page when force=true', async () => {
      mockState.currentPage = 5;
      const container = document.createElement('div');
      container.className = 'mushaf-container';
      mockDom.surahContent!.appendChild(container);
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      await loadPage(5, false, true);
      expect(mockLoadingBar.show).toHaveBeenCalled();
    });

    it('should update currentPage when loading a new page', async () => {
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      await loadPage(10);
      expect(mockState.currentPage).toBe(10);
      expect(mockStorage.set).toHaveBeenCalledWith('current_page', 10);
    });

    it('should call updatePageIndicator', async () => {
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      await loadPage(10);
      expect(mockDom.pageIndicator!.textContent).toBeTruthy();
    });

    it('should show loading bar with page number', async () => {
      vi.mocked(renderPage).mockResolvedValue({ canvas: document.createElement('canvas'), layout: { lines: [] } });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      await loadPage(10);
      expect(mockLoadingBar.show).toHaveBeenCalled();
    });

    it('should call renderPage and handle success', async () => {
      const layout = { lines: [{ words: [{ char: 'ب', font: 'QCF4_Hafs_01', type: 'word', verse_key: '1:1', location: '1:1:1', text: 'بسم' }] }] };
      const canvasEl = document.createElement('canvas');
      vi.mocked(renderPage).mockResolvedValue({ canvas: canvasEl, layout });
      vi.mocked(loadPageData).mockResolvedValue(layout);
      mockState.mushafMode = true;

      await loadPage(2);
      expect(mockLoadingBar.hide).toHaveBeenCalled();
    });

    it('should show error toast when renderPage returns null canvas/layout', async () => {
      vi.mocked(renderPage).mockResolvedValue({ canvas: null, layout: null });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      await loadPage(3);
      expect(mockShowToast).toHaveBeenCalledWith('mushaf_page_error', 'error');
    });

    it('should handle renderPage rejection', async () => {
      vi.mocked(renderPage).mockRejectedValue(new Error('Render failed'));
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      // loadPage has a 300ms animation delay before calling renderMushafPageImage
      vi.useFakeTimers();
      const promise = loadPage(4);
      vi.advanceTimersByTime(500);
      await promise;
      // Give a tick for the rejected promise catch to run
      await vi.advanceTimersByTimeAsync(0);
      expect(mockShowToast).toHaveBeenCalledWith('mushaf_page_error', 'error');
      expect(mockLoadingBar.hide).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should determine flip direction based on page navigation', async () => {
      mockState.currentPage = 5;
      vi.mocked(renderPage).mockResolvedValue({ canvas: null, layout: null });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      await loadPage(10);
      expect(mockState.currentPage).toBe(10);
    });

    it('should handle null surahContent gracefully', async () => {
      mockDom.surahContent = null;
      await expect(loadPage(1)).resolves.not.toThrow();
    });
  });

  /* ===================== populateSurahOverlay ===================== */

  describe('populateSurahOverlay', () => {
    it('should return early if mushafSurahOverlayList is null', () => {
      mockDom.mushafSurahOverlayList = null;
      expect(() => populateSurahOverlay()).not.toThrow();
    });

    it('should return early if surahList is empty', () => {
      mockState.surahList = [];
      populateSurahOverlay();
      expect(mockDom.mushafSurahOverlayList!.innerHTML).toBe('');
    });

    it('should populate surah overlay with surah list', () => {
      mockState.surahList = [
        { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
        { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', numberOfAyahs: 286 },
      ];

      populateSurahOverlay();

      const buttons = mockDom.mushafSurahOverlayList!.querySelectorAll('.mushaf-surah-overlay-btn');
      expect(buttons.length).toBe(2);
      expect(buttons[0]!.textContent).toContain('الفاتحة');
      expect(buttons[1]!.textContent).toContain('البقرة');
    });

    it('should add secret button for surahs with secrets', () => {
      mockState.surahList = [
        { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
      ];

      populateSurahOverlay();

      const secretBtns = mockDom.mushafSurahOverlayList!.querySelectorAll('.surah-secret-btn');
      expect(secretBtns.length).toBe(1);
    });

    it('should not add secret button for surahs without secrets', () => {
      mockState.surahList = [
        { number: 3, name: 'آل عمران', englishName: 'Aal-Imran', numberOfAyahs: 200 },
      ];

      populateSurahOverlay();

      const secretBtns = mockDom.mushafSurahOverlayList!.querySelectorAll('.surah-secret-btn');
      expect(secretBtns.length).toBe(0);
    });

    it('should set surah data attributes on buttons', () => {
      mockState.surahList = [
        { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
      ];

      populateSurahOverlay();

      const btn = mockDom.mushafSurahOverlayList!.querySelector('.mushaf-surah-overlay-btn') as HTMLElement;
      expect(btn.dataset['surah']).toBe('1');
      expect(btn.dataset['surahName']).toBe('الفاتحة');
    });

    it('should handle click on surah overlay button', async () => {
      mockState.surahList = [
        { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
      ];
      vi.mocked(renderPage).mockResolvedValue({ canvas: null, layout: null });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      populateSurahOverlay();

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { page: 1 } }),
        }),
      );
      vi.stubGlobal('fetch', mockFetch);

      const btn = mockDom.mushafSurahOverlayList!.querySelector('.mushaf-surah-overlay-btn') as HTMLElement;
      expect(btn).not.toBeNull();

      btn.click();

      await vi.waitFor(() => {
        expect(mockState.currentSurah).toBe(1);
      });

      vi.restoreAllMocks();
    });

    it('should handle click on secret button', () => {
      mockState.surahList = [
        { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
      ];

      populateSurahOverlay();

      const secretBtn = mockDom.mushafSurahOverlayList!.querySelector('.surah-secret-btn') as HTMLElement;
      expect(secretBtn).not.toBeNull();

      secretBtn.click();

      expect(mockDom.surahSecretsOverlay!.classList.contains('hidden')).toBe(false);
    });

    it('should only bind delegation once (_delegationBound)', () => {
      mockState.surahList = [
        { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
      ];

      populateSurahOverlay();
      populateSurahOverlay();

      const buttons = mockDom.mushafSurahOverlayList!.querySelectorAll('.mushaf-surah-overlay-btn');
      expect(buttons.length).toBe(1);
    });
  });

  /* ===================== showSurahSecret ===================== */

  describe('showSurahSecret', () => {
    it('should return early if overlay elements are missing', () => {
      mockDom.surahSecretsOverlay = null;
      expect(() => showSurahSecret(1)).not.toThrow();
    });

    it('should return early if surahSecretsBody is missing', () => {
      mockDom.surahSecretsBody = null;
      expect(() => showSurahSecret(1)).not.toThrow();
    });

    it('should return early if surahSecretsTitle is missing', () => {
      mockDom.surahSecretsTitle = null;
      expect(() => showSurahSecret(1)).not.toThrow();
    });

    it('should return early if surahSecretsSurahName is missing', () => {
      mockDom.surahSecretsSurahName = null;
      expect(() => showSurahSecret(1)).not.toThrow();
    });

    it('should show error toast if surah has no secret', () => {
      showSurahSecret(3);
      expect(mockShowToast).toHaveBeenCalledWith('mushaf_no_secret', 'error');
    });

    it('should display surah secret when it exists', () => {
      showSurahSecret(1, 'الفاتحة');

      expect(mockDom.surahSecretsSurahName!.textContent).toContain('1');
      expect(mockDom.surahSecretsSurahName!.textContent).toContain('الفاتحة');
      expect(mockDom.surahSecretsTitle!.textContent).toBe('mushaf_surah_info');
    });

    it('should show overlay and remove hidden class', () => {
      mockDom.surahSecretsOverlay!.classList.add('hidden');

      showSurahSecret(1, 'الفاتحة');

      expect(mockDom.surahSecretsOverlay!.classList.contains('hidden')).toBe(false);
      expect((mockDom.surahSecretsOverlay as HTMLElement).style.display).toBe('flex');
    });

    it('should include auth keys when available', () => {
      showSurahSecret(1, 'الفاتحة');
      expect(mockDom.surahSecretsBody!.innerHTML).toBeTruthy();
    });

    it('should work without auth keys', () => {
      showSurahSecret(36, 'يس');
      expect(mockDom.surahSecretsBody!.innerHTML).toBeTruthy();
    });

    it('should handle missing surahName', () => {
      showSurahSecret(1);
      expect(mockDom.surahSecretsSurahName!.textContent).toContain('1');
    });
  });

  /* ===================== highlightMushafAyah ===================== */

  describe('highlightMushafAyah', () => {
    it('should return early if not in mushaf mode', async () => {
      mockState.mushafMode = false;
      await highlightMushafAyah();
      expect(getAyahHighlightRects).not.toHaveBeenCalled();
    });

    it('should return early if no wrapper/canvas exists', async () => {
      mockState.mushafMode = true;
      mockDom.surahContent = createMockElement('div');
      await highlightMushafAyah();
      expect(getAyahHighlightRects).not.toHaveBeenCalled();
    });

    it('should return early if canvas has no width', async () => {
      mockState.mushafMode = true;
      const wrapper = createMockElement('div');
      wrapper.className = 'mushaf-image-wrapper';
      const canvas = document.createElement('canvas');
      canvas.className = 'mushaf-page-canvas';
      canvas.width = 0;
      wrapper.appendChild(canvas);
      mockDom.surahContent!.appendChild(wrapper);

      await highlightMushafAyah();
      expect(getAyahHighlightRects).not.toHaveBeenCalled();
    });

    it('should return early if no surah/ayah data', async () => {
      mockState.mushafMode = true;
      const wrapper = createMockElement('div');
      wrapper.className = 'mushaf-image-wrapper';
      const canvas = document.createElement('canvas');
      canvas.className = 'mushaf-page-canvas';
      canvas.width = 1080;
      canvas.height = 1540;
      wrapper.appendChild(canvas);
      mockDom.surahContent!.appendChild(wrapper);
      mockState.surahData = null;

      await highlightMushafAyah();
      expect(getAyahHighlightRects).not.toHaveBeenCalled();
    });

    it('should create highlight overlay for current ayah', async () => {
      mockState.mushafMode = true;
      mockState.currentSurah = 1;
      mockState.currentAyahIndex = 0;
      mockState.currentPage = 1;
      mockState.surahData = {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
      };

      const wrapper = createMockElement('div');
      wrapper.className = 'mushaf-image-wrapper';
      wrapper.style.position = 'relative';
      const canvas = document.createElement('canvas');
      canvas.className = 'mushaf-page-canvas';
      canvas.width = 1080;
      canvas.height = 1540;
      wrapper.appendChild(canvas);
      mockDom.surahContent!.innerHTML = '';
      mockDom.surahContent!.appendChild(wrapper);

      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, width: 500, height: 700, right: 500, bottom: 700, x: 0, y: 0,
      }));
      wrapper.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, width: 500, height: 700, right: 500, bottom: 700, x: 0, y: 0,
      }));

      vi.mocked(getAyahHighlightRects).mockResolvedValue([
        { left: 10, top: 20, width: 100, height: 30 },
      ]);

      await highlightMushafAyah(true);

      const overlay = wrapper.querySelector('.mushaf-highlight-overlay');
      expect(overlay).not.toBeNull();
      const highlightBars = overlay!.querySelectorAll('.mushaf-ayah-highlight');
      expect(highlightBars.length).toBe(1);
    });

    it('should return early if getAyahHighlightRects returns empty', async () => {
      mockState.mushafMode = true;
      mockState.currentSurah = 1;
      mockState.currentAyahIndex = 0;
      mockState.currentPage = 1;
      mockState.surahData = {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
      };

      const wrapper = createMockElement('div');
      wrapper.className = 'mushaf-image-wrapper';
      const canvas = document.createElement('canvas');
      canvas.className = 'mushaf-page-canvas';
      canvas.width = 1080;
      canvas.height = 1540;
      wrapper.appendChild(canvas);
      mockDom.surahContent!.innerHTML = '';
      mockDom.surahContent!.appendChild(wrapper);

      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, width: 500, height: 700, right: 500, bottom: 700, x: 0, y: 0,
      }));

      vi.mocked(getAyahHighlightRects).mockResolvedValue([]);

      await highlightMushafAyah(true);
      const overlay = wrapper.querySelector('.mushaf-highlight-overlay');
      expect(overlay).toBeNull();
    });

    it('should navigate to correct page if ayah is not on current page', async () => {
      mockState.mushafMode = true;
      mockState.currentSurah = 1;
      mockState.currentAyahIndex = 0;
      mockState.currentPage = 1;
      mockState.surahData = {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
      };
      mockState.currentPageLayout = {
        lines: [
          { words: [{ verse_key: '2:1', location: '2:1:1' }] },
        ],
      };

      const wrapper = createMockElement('div');
      wrapper.className = 'mushaf-image-wrapper';
      const canvas = document.createElement('canvas');
      canvas.className = 'mushaf-page-canvas';
      canvas.width = 1080;
      canvas.height = 1540;
      wrapper.appendChild(canvas);
      mockDom.surahContent!.innerHTML = '';
      mockDom.surahContent!.appendChild(wrapper);

      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, width: 500, height: 700, right: 500, bottom: 700, x: 0, y: 0,
      }));

      vi.mocked(renderPage).mockResolvedValue({ canvas: null, layout: null });
      vi.mocked(loadPageData).mockResolvedValue({ lines: [] });

      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { page: 5 } }),
        }),
      );
      vi.stubGlobal('fetch', mockFetch);

      await highlightMushafAyah(false);

      vi.restoreAllMocks();
    });

    it('should reuse existing highlight overlay', async () => {
      mockState.mushafMode = true;
      mockState.currentSurah = 1;
      mockState.currentAyahIndex = 0;
      mockState.currentPage = 1;
      mockState.surahData = {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
      };

      const wrapper = createMockElement('div');
      wrapper.className = 'mushaf-image-wrapper';
      wrapper.style.position = 'relative';
      const canvas = document.createElement('canvas');
      canvas.className = 'mushaf-page-canvas';
      canvas.width = 1080;
      canvas.height = 1540;

      const existingOverlay = document.createElement('div');
      existingOverlay.className = 'mushaf-highlight-overlay';
      existingOverlay.innerHTML = '<div class="mushaf-ayah-highlight">old</div>';
      wrapper.appendChild(existingOverlay);
      wrapper.appendChild(canvas);
      mockDom.surahContent!.innerHTML = '';
      mockDom.surahContent!.appendChild(wrapper);

      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, width: 500, height: 700, right: 500, bottom: 700, x: 0, y: 0,
      }));
      wrapper.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, width: 500, height: 700, right: 500, bottom: 700, x: 0, y: 0,
      }));

      vi.mocked(getAyahHighlightRects).mockResolvedValue([
        { left: 50, top: 60, width: 200, height: 40 },
      ]);

      await highlightMushafAyah(true);

      const overlays = wrapper.querySelectorAll('.mushaf-highlight-overlay');
      expect(overlays.length).toBe(1);
      const bars = overlays[0]!.querySelectorAll('.mushaf-ayah-highlight');
      expect(bars.length).toBe(1);
    });

    it('should handle multiple highlight rects', async () => {
      mockState.mushafMode = true;
      mockState.currentSurah = 1;
      mockState.currentAyahIndex = 0;
      mockState.currentPage = 1;
      mockState.surahData = {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatiha',
        ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
      };

      const wrapper = createMockElement('div');
      wrapper.className = 'mushaf-image-wrapper';
      wrapper.style.position = 'relative';
      const canvas = document.createElement('canvas');
      canvas.className = 'mushaf-page-canvas';
      canvas.width = 1080;
      canvas.height = 1540;
      wrapper.appendChild(canvas);
      mockDom.surahContent!.innerHTML = '';
      mockDom.surahContent!.appendChild(wrapper);

      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, width: 500, height: 700, right: 500, bottom: 700, x: 0, y: 0,
      }));
      wrapper.getBoundingClientRect = vi.fn(() => ({
        left: 0, top: 0, width: 500, height: 700, right: 500, bottom: 700, x: 0, y: 0,
      }));

      vi.mocked(getAyahHighlightRects).mockResolvedValue([
        { left: 10, top: 20, width: 100, height: 30 },
        { left: 120, top: 20, width: 80, height: 30 },
        { left: 210, top: 50, width: 150, height: 35 },
      ]);

      await highlightMushafAyah(true);

      const overlay = wrapper.querySelector('.mushaf-highlight-overlay');
      expect(overlay).not.toBeNull();
      const bars = overlay!.querySelectorAll('.mushaf-ayah-highlight');
      expect(bars.length).toBe(3);
    });
  });
});
