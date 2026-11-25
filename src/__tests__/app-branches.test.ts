import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  storageGet: vi.fn((..._args: any[]) => null as any),
  storageSet: vi.fn(),
  dom: { langSelect: null as any, player: null as any, surahSelect: null as any, surahContent: null as any },
  cacheDom: vi.fn(),
  loadingBar: { init: vi.fn(), hide: vi.fn(), show: vi.fn() },
  getLang: vi.fn(() => 'ar'),
  applyTranslations: vi.fn(),
  state: { currentSurah: 1, currentPage: 1, surahData: null as any, currentAyahIndex: 0 },
  resetState: vi.fn(),
  setUpdateReadingProgress: vi.fn(),
  loadFavorites: vi.fn(),
  bindAudioEvents: vi.fn(),
  setLoadSurah: vi.fn(),
  setReloadAudio: vi.fn(),
  setHighlightAyah: vi.fn(),
  initKeyboardShortcuts: vi.fn(),
  initCapacitorBackButton: vi.fn(),
  initNavigation: vi.fn(),
  initToggleSwitchAccessibility: vi.fn(),
  initReducedMotionDetection: vi.fn(),
  loadSurah: vi.fn(async () => {}),
  reloadCurrentSurahAudio: vi.fn(),
  loadSurahList: vi.fn(async () => {}),
  buildSurahOffsets: vi.fn(),
  populateReciterSelect: vi.fn(),
  updateCurrentSurahLocale: vi.fn(),
  highlightCurrentAyah: vi.fn(),
  parseDeepLink: vi.fn((..._args: any[]) => null as any),
  clearDeepLinkHash: vi.fn(),
  refreshHomeGrid: vi.fn(),
  showHome: vi.fn(),
  handleVisibilityChange: vi.fn(),
  showContinueWidget: vi.fn(),
  updateNetworkBanner: vi.fn(),
  updateReadingProgress: vi.fn(),
  restoreSettings: vi.fn(),
  initSystemThemeDetection: vi.fn(),
  bindCriticalEvents: vi.fn(),
  bindDeferredEvents: vi.fn(),
  initAutoPlayNextButton: vi.fn(),
  injectOverlays: vi.fn(),
  preloadTajweedIfNeeded: vi.fn(),
  refreshRecentExternalData: vi.fn(),
  deleteLegacyCaches: vi.fn(),
  deleteLegacyQcf4FontEntries: vi.fn(),
  initLangSwitcher: vi.fn(),
  initCspReporting: vi.fn(),
  scheduleAfterPaint: vi.fn((fn: any) => fn()),
}));

vi.mock('../storage.js', () => ({ storage: { get: h.storageGet, set: h.storageSet, remove: vi.fn() } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }));
vi.mock('../dom.js', () => ({ dom: h.dom, cacheDom: h.cacheDom }));
vi.mock('../ui.js', () => ({ loadingBar: h.loadingBar }));
vi.mock('../i18n.js', () => ({ getLang: h.getLang, applyTranslations: h.applyTranslations }));
vi.mock('../state.js', () => ({ state: h.state, resetState: h.resetState, subscribe: vi.fn() }));
vi.mock('../internal-state.js', () => ({ setUpdateReadingProgress: h.setUpdateReadingProgress }));
vi.mock('../favorites.js', () => ({ loadFavorites: h.loadFavorites }));
vi.mock('../features/audio/audio.js', () => ({ bindAudioEvents: h.bindAudioEvents, setLoadSurah: h.setLoadSurah, setReloadAudio: h.setReloadAudio, setHighlightAyah: h.setHighlightAyah }));
vi.mock('../keyboard.js', () => ({ initKeyboardShortcuts: h.initKeyboardShortcuts }));
vi.mock('../capacitor-back.js', () => ({ initCapacitorBackButton: h.initCapacitorBackButton }));
vi.mock('../navigation.js', () => ({ initNavigation: h.initNavigation }));
vi.mock('../a11y.js', () => ({ initToggleSwitchAccessibility: h.initToggleSwitchAccessibility, initReducedMotionDetection: h.initReducedMotionDetection }));
vi.mock('../surah-loader.js', () => ({
  loadSurah: h.loadSurah, reloadCurrentSurahAudio: h.reloadCurrentSurahAudio, loadSurahList: h.loadSurahList,
  buildSurahOffsets: h.buildSurahOffsets, populateReciterSelect: h.populateReciterSelect, updateCurrentSurahLocale: h.updateCurrentSurahLocale,
  highlightCurrentAyah: h.highlightCurrentAyah, renderSurah: vi.fn(), updatePlayerInfo: vi.fn(),
}));
vi.mock('../deep-link.js', () => ({ parseDeepLink: h.parseDeepLink, clearDeepLinkHash: h.clearDeepLinkHash }));
vi.mock('../home.js', () => ({ refreshHomeGrid: h.refreshHomeGrid, showHome: h.showHome }));
vi.mock('../ui-extras.js', () => ({ handleVisibilityChange: h.handleVisibilityChange, showContinueWidget: h.showContinueWidget, updateNetworkBanner: h.updateNetworkBanner, updateReadingProgress: h.updateReadingProgress }));
vi.mock('../settings.js', () => ({ restoreSettings: h.restoreSettings, initSystemThemeDetection: h.initSystemThemeDetection }));
vi.mock('../app-events.js', () => ({ bindCriticalEvents: h.bindCriticalEvents, bindDeferredEvents: h.bindDeferredEvents, initAutoPlayNextButton: h.initAutoPlayNextButton }));
vi.mock('../overlays.js', () => ({ injectOverlays: h.injectOverlays }));
vi.mock('../tajweed-data.js', () => ({ preloadTajweedIfNeeded: h.preloadTajweedIfNeeded }));
vi.mock('../external-data-cache.js', () => ({ refreshRecentExternalData: h.refreshRecentExternalData }));
vi.mock('../cache-names.js', () => ({ deleteLegacyCaches: h.deleteLegacyCaches, deleteLegacyQcf4FontEntries: h.deleteLegacyQcf4FontEntries }));
vi.mock('../lang-switcher.js', () => ({ initLangSwitcher: h.initLangSwitcher }));
vi.mock('../csp-report.js', () => ({ initCspReporting: h.initCspReporting }));
vi.mock('../scheduler.js', () => ({ scheduleAfterPaint: h.scheduleAfterPaint }));
vi.mock('../session-guards.js', () => ({ initSessionGuards: vi.fn() }));
vi.mock('../features/search/search-ui.js', () => ({ loadFullQuranText: vi.fn(async () => {}) }));
vi.mock('../hifz-room.js', () => ({ initHifzRoom: vi.fn(async () => {}) }));
vi.mock('../adhkar.js', () => ({ initAdhkarState: vi.fn(), loadAdhkarSettings: vi.fn(), wireAdhkarEvents: vi.fn(), startAdhkarNotificationScheduler: vi.fn() }));
vi.mock('../features/prayer/prayer.js', () => ({ startClock: vi.fn(), scheduleNextAzanCheck: vi.fn(), loadUnderwrittenPrayerTable: vi.fn(async () => {}), loadPrayerTimes: vi.fn(async () => {}) }));
vi.mock('../error-boundary.js', () => ({ safeLoad: vi.fn(async () => ({ success: false })) }));

import { initApp } from '../app.js';

describe('app init branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.storageGet.mockReturnValue(null);
    h.parseDeepLink.mockReturnValue(null);
    h.loadSurah.mockResolvedValue(undefined);
    h.loadSurahList.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    document.body.innerHTML = '';
    h.dom.langSelect = document.createElement('select');
    h.dom.player = document.createElement('div');
    h.dom.surahSelect = document.createElement('select');
    // requestIdleCallback fallback
    (globalThis as any).requestIdleCallback = (cb: any) => { cb(); return 1; };
  });

  it('handles deep link surah with startAyah and hashchange', async () => {
    window.location.hash = '#surah=2/5';
    h.parseDeepLink.mockImplementation((hash: string) => hash.includes('2/5') ? { kind: 'surah', number: 2, startAyah: 5 } : null);
    await initApp();
    expect(h.loadSurah).toHaveBeenCalledWith(2, { startAyah: 5 });
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(h.clearDeepLinkHash).toHaveBeenCalled();
    window.location.hash = '';
  });

  it('handles deep link page and falls back to loadSurah(1)', async () => {
    h.parseDeepLink.mockReturnValue({ kind: 'page', page: 10 });
    await initApp();
    expect(h.state.currentPage).toBe(10);
    expect(h.loadSurah).toHaveBeenCalledWith(1);
  });

  it('restores last position and shows continue widget', async () => {
    vi.useFakeTimers();
    h.storageGet.mockImplementation((k: string) => k === 'last_position' ? { surah: 3, surahName: 'آل عمران', ayahNumberInSurah: 7, timestamp: 1 } : null);
    h.state.surahData = { name: 'آل عمران', englishName: 'Ali Imran' };
    await initApp();
    expect(h.loadSurah).toHaveBeenCalledWith(3, { startAyah: 7 });
    vi.advanceTimersByTime(500);
    expect(h.showContinueWidget).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('handles first visit, player collapsed restore, offline search, and network events', async () => {
    h.dom.player.classList.add('collapsed');
    h.storageGet.mockImplementation((k: string) => k === 'player_collapsed' ? false : null);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await initApp();
    expect(h.showHome).toHaveBeenCalled();
    expect(h.dom.player.classList.contains('collapsed')).toBe(false);
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('focus'));
    expect(h.updateNetworkBanner).toHaveBeenCalled();
    expect(h.refreshRecentExternalData).toHaveBeenCalled();
  });

  it('handles langchange hint, visibility banner refresh, and hashchange page link', async () => {
    document.body.innerHTML = '<span id="keyboardHint">old</span>';
    await initApp();

    window.dispatchEvent(new CustomEvent('app:langchange'));
    expect(document.getElementById('keyboardHint')?.textContent).toBe('');

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(h.updateNetworkBanner).toHaveBeenCalled();

    window.location.hash = '#page=10';
    h.parseDeepLink.mockReturnValue({ kind: 'page', page: 10 } as any);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(h.state.currentPage).toBe(10);
    window.location.hash = '';
  });

  it('handles deferred init success and safe-load failure paths', async () => {
    const { safeLoad } = await import('../error-boundary.js');
    const initAyahModal = vi.fn();
    const initPresentation = vi.fn();
    const populateSurahOverlay = vi.fn();
    (safeLoad as any)
      .mockResolvedValueOnce({ success: true, module: { initAyahModal } })
      .mockResolvedValueOnce({ success: true, module: { initPresentation } })
      .mockResolvedValueOnce({ success: true, module: { populateSurahOverlay } });

    await initApp();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(initAyahModal).toHaveBeenCalled();
    expect(initPresentation).toHaveBeenCalled();
    expect(populateSurahOverlay).toHaveBeenCalled();
  });
});
