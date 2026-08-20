/**
 * Tests for app-events.ts — Event bindings for the Quran app.
 * Tests all exported bind functions and the initAutoPlayNextButton function.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dom } from '../dom.js';
import { state, resetState } from '../state.js';
import { storage } from '../storage.js';

// Mock settings module
vi.mock('../settings.js', () => ({
  applyFontSize: vi.fn(),
  changeReaderZoom: vi.fn(),
  updateReaderZoomControl: vi.fn(),
  toggleNightMode: vi.fn(),
  applyTheme: vi.fn(),
  applyFontType: vi.fn(),
  applyLineSpacing: vi.fn(),
  applyPresBgMode: vi.fn(),
  applyPresBgScene: vi.fn(),
  applyPresBgNature: vi.fn(),
  openSettings: vi.fn(),
  closeSettings: vi.fn(),
  saveLocationSettings: vi.fn(),
  resetSettings: vi.fn(),
  exportSettings: vi.fn(),
  importSettings: vi.fn(),
  initSettingsTabs: vi.fn(),
}));

// Mock audio-cache module
vi.mock('../audio-cache.js', () => ({
  cacheSurahAudio: vi.fn(),
  isSurahCached: vi.fn(() => Promise.resolve(false)),
  deleteSurahCache: vi.fn(() => Promise.resolve(0)),
}));

// Mock prayer module
vi.mock('../prayer.js', () => ({
  togglePrayerBar: vi.fn(),
  testAzan: vi.fn(),
  stopAzan: vi.fn(),
  hideQiblaCompass: vi.fn(),
  hideAzanNotification: vi.fn(),
}));

// Mock favorites module
vi.mock('../favorites.js', () => ({
  toggleFavorite: vi.fn(),
  openFavorites: vi.fn(),
  closeFavorites: vi.fn(),
  setBookmark: vi.fn(),
  gotoBookmark: vi.fn(),
}));

// Mock adhkar module
vi.mock('../adhkar.js', () => ({
  closeAdhkarPanel: vi.fn(),
  wireAdhkarEvents: vi.fn(),
}));

// Mock surah-loader
vi.mock('../surah-loader.js', () => ({
  loadSurah: vi.fn(),
}));

// Mock search-ui
vi.mock('../search-ui.js', () => ({
  performExactSearch: vi.fn(),
  loadFullQuranText: vi.fn(() => Promise.resolve()),
  initKeyboard: vi.fn(),
  initSearchAutocomplete: vi.fn(),
  startVoiceSearch: vi.fn(),
}));

// Mock sleep-timer-modal
vi.mock('../sleep-timer-modal.js', () => ({
  showSleepTimerModal: vi.fn(),
}));

// Mock tajweed-data
vi.mock('../tajweed-data.js', () => ({
  loadTajweedAnnotations: vi.fn(() => Promise.resolve()),
  loadTajweedAnnotationsForSurah: vi.fn(() => Promise.resolve()),
}));

// Mock share module
vi.mock('../share.js', () => ({
  toggleShareMenu: vi.fn(),
  shareNative: vi.fn(),
  shareCopy: vi.fn(),
  shareCopySimple: vi.fn(),
  shareWhatsApp: vi.fn(),
  shareTelegram: vi.fn(),
}));

// Mock tafsir module
vi.mock('../tafsir.js', () => ({
  toggleTafsir: vi.fn(),
  loadTafsirForCurrentAyah: vi.fn(),
}));

// Mock audio module
vi.mock('../audio.js', () => ({
  togglePlayPause: vi.fn(),
  updatePlayPauseBtn: vi.fn(),
  playCurrentAyah: vi.fn(),
  prevAyah: vi.fn(),
  nextAyah: vi.fn(),
  prevSurah: vi.fn(),
  nextSurah: vi.fn(),
  toggleHifdh: vi.fn(),
  toggleRepeat: vi.fn(),
  expandPlayer: vi.fn(),
}));

// Mock a11y
vi.mock('../a11y.js', () => ({
  syncAriaExpanded: vi.fn(),
}));

// Mock i18n additional exports
vi.mock('../i18n.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    AVAILABLE_LANGUAGES: [
      { code: 'ar', nativeName: 'العربية' },
      { code: 'en', nativeName: 'English' },
    ],
    getLang: vi.fn(() => 'ar'),
    setLang: vi.fn(() => Promise.resolve()),
  };
});

function createDomElements() {
  const el = (tag: string) => document.createElement(tag);
  dom.surahSelect = el('select') as HTMLSelectElement;
  dom.reciterSelect = el('select') as HTMLSelectElement;
  dom.bookmarkBtn = el('button');
  dom.favoriteBtn = el('button');
  dom.shareBtn = el('button');
  dom.shareMenu = el('div');
  dom.themeToggle = el('div');
  dom.settingsToggleBtn = el('button');
  dom.settingsCloseBtn = el('button');
  dom.saveLocationBtn = el('button');
  dom.testAzanBtn = el('button');
  dom.azanNotifStopBtn = el('button');
  dom.resetSettingsBtn = el('button');
  dom.azanNotification = el('div');
  dom.azanPlayer = el('audio') as HTMLAudioElement;
  dom.tafsirCurtainHandle = el('button');
  dom.tafsirSelect = el('select') as HTMLSelectElement;
  dom.tafsirCurtain = el('div');
  dom.translationSelect = el('select') as HTMLSelectElement;
  dom.fontSizeSelect = el('select') as HTMLSelectElement;
  dom.fontTypeSelect = el('select') as HTMLSelectElement;
  dom.lineSpacingSelect = el('select') as HTMLSelectElement;
  dom.presBgSelect = el('select') as HTMLSelectElement;
  dom.presBgSceneSelect = el('select') as HTMLSelectElement;
  dom.presBgNatureSelect = el('select') as HTMLSelectElement;
  dom.tajweedToggle = el('button');
  dom.azanToggle = el('button');
  dom.azanFajrToggle = el('button');
  dom.autoSaveToggle = el('button');
  dom.langSelect = el('select') as HTMLSelectElement;
  dom.cityQuickSelect = el('select') as HTMLSelectElement;
  dom.cityInput = el('input') as HTMLInputElement;
  dom.countryInput = el('input') as HTMLInputElement;
  dom.favoritesOpenBtn = el('button');
  dom.favoritesCloseBtn = el('button');
  dom.collapseBarBtn = el('button');
  dom.expandBarBtn = el('button');
  dom.favoritesPanel = el('div');
  dom.settingsPanel = el('div');
  dom.adhkarPanel = el('div');
  dom.adhkarBtn = el('button');
  dom.searchBtn = el('button');
  dom.searchInput = el('input') as HTMLInputElement;
  dom.voiceSearchBtn = el('button');
  dom.installBtn = el('button');
  dom.sleepTimerBtn = el('button');
  dom.downloadAudioBtn = el('button');
  dom.autoPlayNextBtn = el('button');
  dom.searchToggleBtn = el('button');
  dom.searchInputGroup = el('div');
  dom.mushafSurahOverlayClose = el('button');
  dom.mushafSurahOverlay = el('div');
  dom.surahSecretsCloseBtn = el('button');
  dom.surahSecretsOverlay = el('div');
  dom.qiblaCloseBtn = el('button');
  dom.qiblaOverlay = el('div');
  dom.readingStatsCloseBtn = el('button');
  dom.readingStatsPanel = el('div');
  dom.helpToggleBtn = el('button');
  dom.helpCloseBtn = el('button');
  dom.helpPanel = el('div');
  dom.pageSelect = el('select') as HTMLSelectElement;
  dom.pageSlider = el('input') as HTMLInputElement;
}

describe('app-events', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetState();
    createDomElements();
    vi.clearAllMocks();
  });

  /* ==================== bindNavigationEvents ==================== */

  describe('bindNavigationEvents', () => {
    it('should bind change event on surahSelect', async () => {
      const { bindNavigationEvents } = await import('../app-events.js');
      const spy = vi.spyOn(dom.surahSelect!, 'addEventListener');
      bindNavigationEvents();
      expect(spy).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should load surah on surahSelect change (non-mushaf mode)', async () => {
      state.mushafMode = false;
      const { bindNavigationEvents } = await import('../app-events.js');
      bindNavigationEvents();

      const opt = document.createElement('option');
      opt.value = '2';
      dom.surahSelect!.appendChild(opt);
      dom.surahSelect!.value = '2';
      dom.surahSelect!.dispatchEvent(new Event('change'));

      const { loadSurah } = await import('../surah-loader.js');
      expect(loadSurah).toHaveBeenCalledWith(2);
    });

    it('should not load surah when surahSelect value is empty', async () => {
      state.mushafMode = false;
      const { bindNavigationEvents } = await import('../app-events.js');
      bindNavigationEvents();

      dom.surahSelect!.value = '';
      dom.surahSelect!.dispatchEvent(new Event('change'));

      const { loadSurah } = await import('../surah-loader.js');
      expect(loadSurah).not.toHaveBeenCalled();
    });

    it('should bind change event on reciterSelect', async () => {
      const { bindNavigationEvents } = await import('../app-events.js');
      const spy = vi.spyOn(dom.reciterSelect!, 'addEventListener');
      bindNavigationEvents();
      expect(spy).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should update reciter and persist on reciterSelect change', async () => {
      const { bindNavigationEvents } = await import('../app-events.js');
      bindNavigationEvents();

      const opt = document.createElement('option');
      opt.value = 'ar.abdulbasit';
      dom.reciterSelect!.appendChild(opt);
      dom.reciterSelect!.value = 'ar.abdulbasit';
      dom.reciterSelect!.dispatchEvent(new Event('change'));

      expect(state.currentReciter).toBe('ar.abdulbasit');
      expect(storage.set).toHaveBeenCalledWith('reciter', 'ar.abdulbasit');
    });

    it('should reload surah on reciter change if a surah is loaded', async () => {
      state.currentSurah = 5;
      const { bindNavigationEvents } = await import('../app-events.js');
      bindNavigationEvents();

      dom.reciterSelect!.value = 'ar.abdulbasit';
      dom.reciterSelect!.dispatchEvent(new Event('change'));

      const { loadSurah } = await import('../surah-loader.js');
      expect(loadSurah).toHaveBeenCalledWith(5);
    });
  });

  /* ==================== bindHeaderAndSettingsEvents ==================== */

  describe('bindHeaderAndSettingsEvents', () => {
    it('should bind bookmark button click to setBookmark', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.bookmarkBtn!.click();
      const { setBookmark } = await import('../favorites.js');
      expect(setBookmark).toHaveBeenCalled();
    });

    it('should bind bookmark button dblclick to gotoBookmark', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.bookmarkBtn!.dispatchEvent(new MouseEvent('dblclick'));
      const { gotoBookmark } = await import('../favorites.js');
      expect(gotoBookmark).toHaveBeenCalled();
    });

    it('should bind favoriteBtn click to toggleFavorite', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.favoriteBtn!.click();
      const { toggleFavorite } = await import('../favorites.js');
      expect(toggleFavorite).toHaveBeenCalled();
    });

    it('should bind shareBtn click to toggleShareMenu', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.shareBtn!.click();
      const { toggleShareMenu } = await import('../share.js');
      expect(toggleShareMenu).toHaveBeenCalled();
    });

    it('should bind settingsToggleBtn click to openSettings', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.settingsToggleBtn!.click();
      const { openSettings } = await import('../settings.js');
      expect(openSettings).toHaveBeenCalled();
    });

    it('should bind settingsCloseBtn click to closeSettings', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.settingsCloseBtn!.click();
      const { closeSettings } = await import('../settings.js');
      expect(closeSettings).toHaveBeenCalled();
    });

    it('should bind saveLocationBtn click to saveLocationSettings', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.saveLocationBtn!.click();
      const { saveLocationSettings } = await import('../settings.js');
      expect(saveLocationSettings).toHaveBeenCalled();
    });

    it('should bind testAzanBtn click to testAzan', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.testAzanBtn!.click();
      const { testAzan } = await import('../prayer.js');
      expect(testAzan).toHaveBeenCalled();
    });

    it('should bind azanNotifStopBtn click to stopAzan', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.azanNotifStopBtn!.click();
      const { stopAzan } = await import('../prayer.js');
      expect(stopAzan).toHaveBeenCalled();
    });

    it('should bind resetSettingsBtn click to resetSettings', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.resetSettingsBtn!.click();
      const { resetSettings } = await import('../settings.js');
      expect(resetSettings).toHaveBeenCalled();
    });

    it('should call initSettingsTabs', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      const { initSettingsTabs } = await import('../settings.js');
      expect(initSettingsTabs).toHaveBeenCalled();
    });

    it('should apply theme when clicking a theme-btn inside themeToggle', async () => {
      const themeBtn = document.createElement('button');
      themeBtn.className = 'theme-btn';
      themeBtn.dataset.theme = 'night';
      dom.themeToggle!.appendChild(themeBtn);
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      themeBtn.click();
      const { applyTheme } = await import('../settings.js');
      expect(applyTheme).toHaveBeenCalledWith('night');
    });

    it('should toggle night mode on Enter/Space without a theme-btn', async () => {
      const { bindHeaderAndSettingsEvents } = await import('../app-events.js');
      bindHeaderAndSettingsEvents();
      dom.themeToggle!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const { toggleNightMode } = await import('../settings.js');
      expect(toggleNightMode).toHaveBeenCalled();
    });
  });

  /* ==================== bindAzanEvents ==================== */

  describe('bindAzanEvents', () => {
    it('should stop azan when clicking azanNotification directly', async () => {
      const { bindAzanEvents } = await import('../app-events.js');
      bindAzanEvents();
      // Simulate click where target === dom.azanNotification
      dom.azanNotification!.click();
      // Clicking the notification with target=notification should call stopAzan
      // But we need target === dom.azanNotification for the check
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: dom.azanNotification, writable: false });
      dom.azanNotification!.dispatchEvent(event);
      const { stopAzan } = await import('../prayer.js');
      expect(stopAzan).toHaveBeenCalled();
    });

    it('should reset azanPlaying when azan audio ends', async () => {
      state.azanPlaying = true;
      const { bindAzanEvents } = await import('../app-events.js');
      bindAzanEvents();
      dom.azanPlayer!.dispatchEvent(new Event('ended'));
      expect(state.azanPlaying).toBe(false);
    });

    it('should hide azan notification when azan audio ends', async () => {
      const { bindAzanEvents } = await import('../app-events.js');
      bindAzanEvents();
      dom.azanPlayer!.dispatchEvent(new Event('ended'));
      const { hideAzanNotification } = await import('../prayer.js');
      expect(hideAzanNotification).toHaveBeenCalled();
    });
  });

  /* ==================== bindTafsirEvents ==================== */

  describe('bindTafsirEvents', () => {
    it('should bind tafsirCurtainHandle click to toggleTafsir', async () => {
      const { bindTafsirEvents } = await import('../app-events.js');
      bindTafsirEvents();
      dom.tafsirCurtainHandle!.click();
      const { toggleTafsir } = await import('../tafsir.js');
      expect(toggleTafsir).toHaveBeenCalled();
    });

    it('should update tafsir edition on tafsirSelect change', async () => {
      const { bindTafsirEvents } = await import('../app-events.js');
      bindTafsirEvents();
      const opt = document.createElement('option');
      opt.value = 'ar-tafsir-ibnkathir';
      dom.tafsirSelect!.appendChild(opt);
      dom.tafsirSelect!.value = 'ar-tafsir-ibnkathir';
      dom.tafsirSelect!.dispatchEvent(new Event('change'));
      expect(state.currentTafsirEdition).toBe('ar-tafsir-ibnkathir');
      expect(storage.set).toHaveBeenCalledWith('tafsir_edition', 'ar-tafsir-ibnkathir');
    });

    it('should load tafsir when curtain is open and tafsir edition changes', async () => {
      dom.tafsirCurtain!.classList.add('open');
      const { bindTafsirEvents } = await import('../app-events.js');
      bindTafsirEvents();
      dom.tafsirSelect!.value = 'new-edition';
      dom.tafsirSelect!.dispatchEvent(new Event('change'));
      const { loadTafsirForCurrentAyah } = await import('../tafsir.js');
      expect(loadTafsirForCurrentAyah).toHaveBeenCalled();
    });

    it('should enable translation when translationSelect has a value', async () => {
      const { bindTafsirEvents } = await import('../app-events.js');
      bindTafsirEvents();
      const opt = document.createElement('option');
      opt.value = 'en.sahih';
      dom.translationSelect!.appendChild(opt);
      dom.translationSelect!.value = 'en.sahih';
      dom.translationSelect!.dispatchEvent(new Event('change'));
      expect(state.translationEnabled).toBe(true);
      expect(state.currentTranslation).toBe('en.sahih');
    });

    it('should disable translation when translationSelect value is empty', async () => {
      state.translationEnabled = true;
      state.currentTranslation = 'en.sahih';
      const { bindTafsirEvents } = await import('../app-events.js');
      bindTafsirEvents();
      dom.translationSelect!.value = '';
      dom.translationSelect!.dispatchEvent(new Event('change'));
      expect(state.translationEnabled).toBe(false);
      expect(state.currentTranslation).toBe('');
    });
  });

  /* ==================== bindDisplaySettingsEvents ==================== */

  describe('bindDisplaySettingsEvents', () => {
    it('should call applyFontSize on fontSizeSelect change', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      const opt = document.createElement('option');
      opt.value = '32';
      dom.fontSizeSelect!.appendChild(opt);
      dom.fontSizeSelect!.value = '32';
      dom.fontSizeSelect!.dispatchEvent(new Event('change'));
      const { applyFontSize } = await import('../settings.js');
      expect(applyFontSize).toHaveBeenCalledWith(32);
    });

    it('should call applyFontType on fontTypeSelect change', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      const opt = document.createElement('option');
      opt.value = 'uthman';
      dom.fontTypeSelect!.appendChild(opt);
      dom.fontTypeSelect!.value = 'uthman';
      dom.fontTypeSelect!.dispatchEvent(new Event('change'));
      const { applyFontType } = await import('../settings.js');
      expect(applyFontType).toHaveBeenCalledWith('uthman');
    });

    it('should call applyLineSpacing on lineSpacingSelect change', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      const opt = document.createElement('option');
      opt.value = '2.0';
      dom.lineSpacingSelect!.appendChild(opt);
      dom.lineSpacingSelect!.value = '2.0';
      dom.lineSpacingSelect!.dispatchEvent(new Event('change'));
      const { applyLineSpacing } = await import('../settings.js');
      expect(applyLineSpacing).toHaveBeenCalledWith('2.0');
    });

    it('should call applyPresBgMode on presBgSelect change', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      const opt = document.createElement('option');
      opt.value = 'nature';
      dom.presBgSelect!.appendChild(opt);
      dom.presBgSelect!.value = 'nature';
      dom.presBgSelect!.dispatchEvent(new Event('change'));
      const { applyPresBgMode } = await import('../settings.js');
      expect(applyPresBgMode).toHaveBeenCalledWith('nature');
    });

    it('should toggle tajweed on tajweedToggle click', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      dom.tajweedToggle!.click();
      expect(storage.set).toHaveBeenCalledWith('tajweed_enabled', expect.any(Boolean));
    });

    it('should toggle azan on azanToggle click', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      dom.azanToggle!.click();
      expect(storage.set).toHaveBeenCalledWith('azan_enabled', expect.any(Boolean));
    });

    it('should toggle azan fajr on azanFajrToggle click', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      dom.azanFajrToggle!.click();
      expect(storage.set).toHaveBeenCalledWith('azan_fajr_enabled', expect.any(Boolean));
    });

    it('should toggle autoSave on autoSaveToggle click', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      dom.autoSaveToggle!.click();
      expect(storage.set).toHaveBeenCalledWith('auto_save', expect.any(Boolean));
    });

    it('should change language on langSelect change', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      const opt = document.createElement('option');
      opt.value = 'en';
      dom.langSelect!.appendChild(opt);
      dom.langSelect!.value = 'en';
      dom.langSelect!.dispatchEvent(new Event('change'));
      const { setLang } = await import('../i18n.js');
      expect(setLang).toHaveBeenCalled();
    });

    it('should not call setLang if language is unchanged', async () => {
      const { getLang } = await import('../i18n.js');
      (getLang as ReturnType<typeof vi.fn>).mockReturnValue('ar');
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      const opt = document.createElement('option');
      opt.value = 'ar';
      dom.langSelect!.appendChild(opt);
      dom.langSelect!.value = 'ar';
      dom.langSelect!.dispatchEvent(new Event('change'));
      const { setLang } = await import('../i18n.js');
      expect(setLang).not.toHaveBeenCalled();
    });

    it('should fill city and country inputs on cityQuickSelect change', async () => {
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      const opt = document.createElement('option');
      opt.value = 'Makkah|SA';
      dom.cityQuickSelect!.appendChild(opt);
      dom.cityQuickSelect!.value = 'Makkah|SA';
      dom.cityQuickSelect!.dispatchEvent(new Event('change'));
      expect(dom.cityInput!.value).toBe('Makkah');
      expect(dom.countryInput!.value).toBe('SA');
    });

    it('should not fill inputs when cityQuickSelect value is empty', async () => {
      dom.cityInput!.value = '';
      dom.countryInput!.value = '';
      const { bindDisplaySettingsEvents } = await import('../app-events.js');
      bindDisplaySettingsEvents();
      dom.cityQuickSelect!.value = '';
      dom.cityQuickSelect!.dispatchEvent(new Event('change'));
      expect(dom.cityInput!.value).toBe('');
      expect(dom.countryInput!.value).toBe('');
    });
  });

  /* ==================== bindPanelsAndShareEvents ==================== */

  describe('bindPanelsAndShareEvents', () => {
    it('should bind favoritesOpenBtn to openFavorites', async () => {
      const { bindPanelsAndShareEvents } = await import('../app-events.js');
      bindPanelsAndShareEvents();
      dom.favoritesOpenBtn!.click();
      const { openFavorites } = await import('../favorites.js');
      expect(openFavorites).toHaveBeenCalled();
    });

    it('should bind favoritesCloseBtn to closeFavorites', async () => {
      const { bindPanelsAndShareEvents } = await import('../app-events.js');
      bindPanelsAndShareEvents();
      dom.favoritesCloseBtn!.click();
      const { closeFavorites } = await import('../favorites.js');
      expect(closeFavorites).toHaveBeenCalled();
    });

    it('should bind collapseBarBtn and expandBarBtn to togglePrayerBar', async () => {
      const { bindPanelsAndShareEvents } = await import('../app-events.js');
      bindPanelsAndShareEvents();
      dom.collapseBarBtn!.click();
      dom.expandBarBtn!.click();
      const { togglePrayerBar } = await import('../prayer.js');
      expect(togglePrayerBar).toHaveBeenCalledTimes(2);
    });

    it('should bind share buttons in the DOM', async () => {
      // Create share buttons in the DOM
      const nativeBtn = document.createElement('button');
      nativeBtn.dataset.share = 'native';
      document.body.appendChild(nativeBtn);

      const { bindPanelsAndShareEvents } = await import('../app-events.js');
      bindPanelsAndShareEvents();
      nativeBtn.click();
      const { shareNative, toggleShareMenu } = await import('../share.js');
      expect(shareNative).toHaveBeenCalled();
      expect(toggleShareMenu).toHaveBeenCalled();
    });
  });

  /* ==================== bindSearchEvents ==================== */

  describe('bindSearchEvents', () => {
    it('should call performExactSearch on searchBtn click when search input has value', async () => {
      dom.searchInput!.value = 'الله';
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.searchBtn!.click();
      const { performExactSearch } = await import('../search-ui.js');
      expect(performExactSearch).toHaveBeenCalledWith('الله');
    });

    it('should not call performExactSearch when search input is empty', async () => {
      dom.searchInput!.value = '';
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.searchBtn!.click();
      const { performExactSearch } = await import('../search-ui.js');
      expect(performExactSearch).not.toHaveBeenCalled();
    });

    it('should not call performExactSearch when search input is whitespace', async () => {
      dom.searchInput!.value = '   ';
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.searchBtn!.click();
      const { performExactSearch } = await import('../search-ui.js');
      expect(performExactSearch).not.toHaveBeenCalled();
    });

    it('should trigger search on Enter key in searchInput', async () => {
      dom.searchInput!.value = 'mercy';
      const { bindSearchEvents } = await import('../app-events.js');
      const spy = vi.spyOn(dom.searchBtn!, 'click');
      bindSearchEvents();
      dom.searchInput!.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter' }));
      expect(spy).toHaveBeenCalled();
    });

    it('should bind voiceSearchBtn to startVoiceSearch', async () => {
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.voiceSearchBtn!.click();
      const { startVoiceSearch } = await import('../search-ui.js');
      expect(startVoiceSearch).toHaveBeenCalled();
    });

    it('should call showSleepTimerModal on sleepTimerBtn click', async () => {
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.sleepTimerBtn!.click();
      const { showSleepTimerModal } = await import('../sleep-timer-modal.js');
      expect(showSleepTimerModal).toHaveBeenCalled();
    });

    it('should call initKeyboard and initSearchAutocomplete', async () => {
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      const { initKeyboard, initSearchAutocomplete } = await import('../search-ui.js');
      expect(initKeyboard).toHaveBeenCalled();
      expect(initSearchAutocomplete).toHaveBeenCalled();
    });
  });

  /* ==================== bindGlobalClickHandler ==================== */

  describe('bindGlobalClickHandler', () => {
    it('should close share menu when clicking outside', async () => {
      dom.shareMenu!.classList.add('show');
      const { bindGlobalClickHandler } = await import('../app-events.js');
      bindGlobalClickHandler();
      // Click on the body (outside share menu)
      document.body.click();
      expect(dom.shareMenu!.classList.contains('show')).toBe(false);
    });

    it('should close settings when clicking outside', async () => {
      dom.settingsPanel!.classList.add('open');
      const { bindGlobalClickHandler } = await import('../app-events.js');
      bindGlobalClickHandler();
      document.body.click();
      const { closeSettings } = await import('../settings.js');
      expect(closeSettings).toHaveBeenCalled();
    });

    it('should close favorites when clicking outside', async () => {
      dom.favoritesPanel!.classList.add('open');
      const { bindGlobalClickHandler } = await import('../app-events.js');
      bindGlobalClickHandler();
      document.body.click();
      const { closeFavorites } = await import('../favorites.js');
      expect(closeFavorites).toHaveBeenCalled();
    });

    it('should close adhkar panel when clicking outside', async () => {
      dom.adhkarPanel!.classList.add('open');
      const { bindGlobalClickHandler } = await import('../app-events.js');
      bindGlobalClickHandler();
      document.body.click();
      const { closeAdhkarPanel } = await import('../adhkar.js');
      expect(closeAdhkarPanel).toHaveBeenCalled();
    });

    it('should keep the adhkar panel open when the mobile adhkar tab is pressed', async () => {
      dom.adhkarPanel!.classList.add('open');
      const mobileAdhkarTab = document.createElement('button');
      mobileAdhkarTab.dataset['tab'] = 'more';
      document.body.appendChild(mobileAdhkarTab);
      const { bindGlobalClickHandler } = await import('../app-events.js');
      bindGlobalClickHandler();
      mobileAdhkarTab.click();
      const { closeAdhkarPanel } = await import('../adhkar.js');
      expect(closeAdhkarPanel).not.toHaveBeenCalled();
      mobileAdhkarTab.remove();
    });
  });

  /* ==================== bindHeaderMenuEvents ==================== */

  describe('bindHeaderMenuEvents', () => {
    it('should be a no-op (dropdown removed)', async () => {
      const { bindHeaderMenuEvents } = await import('../app-events.js');
      expect(() => bindHeaderMenuEvents()).not.toThrow();
    });
  });

  /* ==================== bindMiscEvents ==================== */

  describe('bindMiscEvents', () => {
    it('should start a populated search from the search shortcut', async () => {
      dom.searchInput!.value = 'الله';
      const searchSpy = vi.spyOn(dom.searchBtn!, 'click');
      const { bindMiscEvents } = await import('../app-events.js');
      bindMiscEvents();
      dom.searchToggleBtn!.click();
      expect(searchSpy).toHaveBeenCalled();
    });

    it('should focus the always-visible search field when the shortcut has no query', async () => {
      dom.searchInput!.value = '';
      const focusSpy = vi.spyOn(dom.searchInput!, 'focus');
      const { bindMiscEvents } = await import('../app-events.js');
      bindMiscEvents();
      dom.searchToggleBtn!.click();
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should call wireAdhkarEvents', async () => {
      const { bindMiscEvents } = await import('../app-events.js');
      bindMiscEvents();
      const { wireAdhkarEvents } = await import('../adhkar.js');
      expect(wireAdhkarEvents).toHaveBeenCalled();
    });

    it('should bind qiblaCloseBtn to hideQiblaCompass', async () => {
      const { bindMiscEvents } = await import('../app-events.js');
      bindMiscEvents();
      dom.qiblaCloseBtn!.click();
      const { hideQiblaCompass } = await import('../prayer.js');
      expect(hideQiblaCompass).toHaveBeenCalled();
    });

    it('should hide mushafSurahOverlay on close button click', async () => {
      dom.mushafSurahOverlay!.style.display = 'flex';
      dom.mushafSurahOverlay!.classList.remove('hidden');
      const { bindMiscEvents } = await import('../app-events.js');
      bindMiscEvents();
      dom.mushafSurahOverlayClose!.click();
      expect(dom.mushafSurahOverlay!.classList.contains('hidden')).toBe(true);
      expect(dom.mushafSurahOverlay!.style.display).toBe('none');
    });

    it('should hide surahSecretsOverlay on close button click', async () => {
      dom.surahSecretsOverlay!.style.display = 'flex';
      dom.surahSecretsOverlay!.classList.remove('hidden');
      const { bindMiscEvents } = await import('../app-events.js');
      bindMiscEvents();
      dom.surahSecretsCloseBtn!.click();
      expect(dom.surahSecretsOverlay!.classList.contains('hidden')).toBe(true);
      expect(dom.surahSecretsOverlay!.style.display).toBe('none');
    });

    it('should hide readingStatsPanel on close button click', async () => {
      dom.readingStatsPanel!.style.display = 'flex';
      dom.readingStatsPanel!.classList.remove('hidden');
      const { bindMiscEvents } = await import('../app-events.js');
      bindMiscEvents();
      dom.readingStatsCloseBtn!.click();
      expect(dom.readingStatsPanel!.classList.contains('hidden')).toBe(true);
      expect(dom.readingStatsPanel!.style.display).toBe('none');
    });
  });

  /* ==================== bindHelpEvents ==================== */

  describe('bindHelpEvents', () => {
    it('should open help panel on helpToggleBtn click', async () => {
      const { bindHelpEvents } = await import('../app-events.js');
      bindHelpEvents();
      dom.helpToggleBtn!.click();
      expect(dom.helpPanel!.classList.contains('open')).toBe(true);
    });

    it('should close help panel on helpCloseBtn click', async () => {
      dom.helpPanel!.classList.add('open');
      const { bindHelpEvents } = await import('../app-events.js');
      bindHelpEvents();
      dom.helpCloseBtn!.click();
      expect(dom.helpPanel!.classList.contains('open')).toBe(false);
    });

    it('should auto-open help on first use', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'help_seen') return false;
        return null;
      });
      const { bindHelpEvents } = await import('../app-events.js');
      bindHelpEvents();
      expect(dom.helpPanel!.classList.contains('open')).toBe(true);
      expect(storage.set).toHaveBeenCalledWith('help_seen', true);
    });

    it('should not auto-open help if already seen', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'help_seen') return true;
        return null;
      });
      dom.helpPanel!.classList.remove('open');
      const { bindHelpEvents } = await import('../app-events.js');
      bindHelpEvents();
      expect(dom.helpPanel!.classList.contains('open')).toBe(false);
    });

    it('should close help when clicking outside', async () => {
      dom.helpPanel!.classList.add('open');
      const { bindHelpEvents } = await import('../app-events.js');
      bindHelpEvents();
      // Simulate a click on an element outside help panel
      document.body.click();
      expect(dom.helpPanel!.classList.contains('open')).toBe(false);
    });
  });

  /* ==================== initAutoPlayNextButton ==================== */

  describe('initAutoPlayNextButton', () => {
    it('should enable autoPlayNext from saved state', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'auto_play_next') return true;
        return null;
      });
      const { initAutoPlayNextButton } = await import('../app-events.js');
      initAutoPlayNextButton();
      expect(state.autoPlayNext).toBe(true);
      expect(dom.autoPlayNextBtn!.classList.contains('active')).toBe(true);
    });

    it('should disable autoPlayNext when not saved', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'auto_play_next') return false;
        return null;
      });
      const { initAutoPlayNextButton } = await import('../app-events.js');
      initAutoPlayNextButton();
      expect(state.autoPlayNext).toBe(false);
      expect(dom.autoPlayNextBtn!.classList.contains('active')).toBe(false);
    });

    it('should handle null autoPlayNextBtn gracefully', async () => {
      dom.autoPlayNextBtn = null;
      const { initAutoPlayNextButton } = await import('../app-events.js');
      expect(() => initAutoPlayNextButton()).not.toThrow();
    });
  });

  /* ==================== bindAllEvents ==================== */

  describe('bindAllEvents', () => {
    it('should call all individual bind functions without error', async () => {
      const { bindAllEvents } = await import('../app-events.js');
      expect(() => bindAllEvents()).not.toThrow();
    });

    it('should wire adhkar events (called from bindMiscEvents)', async () => {
      const { bindAllEvents } = await import('../app-events.js');
      bindAllEvents();
      const { wireAdhkarEvents } = await import('../adhkar.js');
      expect(wireAdhkarEvents).toHaveBeenCalled();
    });

    it('should call initSettingsTabs (called from bindHeaderAndSettingsEvents)', async () => {
      const { bindAllEvents } = await import('../app-events.js');
      bindAllEvents();
      const { initSettingsTabs } = await import('../settings.js');
      expect(initSettingsTabs).toHaveBeenCalled();
    });
  });

  /* ==================== handleDownloadAudio (via bindSearchEvents) ==================== */

  describe('handleDownloadAudio', () => {
    it('should show error when no surah data is available', async () => {
      state.surahData = null;
      state.ayahsAudios = [];
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.downloadAudioBtn!.click();
      const { showToast } = await import('../ui.js');
      expect(showToast).toHaveBeenCalledWith('download_audio_no_data', 'error');
    });

    it('should show error when ayahsAudios is empty', async () => {
      state.surahData = { number: 1, name: 'test' } as any;
      state.ayahsAudios = [];
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.downloadAudioBtn!.click();
      const { showToast } = await import('../ui.js');
      expect(showToast).toHaveBeenCalledWith('download_audio_no_data', 'error');
    });

    it('should start download when surah is not cached', async () => {
      state.surahData = { number: 1, name: 'test' } as any;
      state.ayahsAudios = ['https://example.com/audio1.mp3'];
      state.currentSurah = 1;
      state.currentReciter = 'ar.alafasy';
      const { isSurahCached } = await import('../audio-cache.js');
      (isSurahCached as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const { cacheSurahAudio } = await import('../audio-cache.js');
      (cacheSurahAudio as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.downloadAudioBtn!.click();

      // Wait for async handler
      await vi.waitFor(() => {
        expect(cacheSurahAudio).toHaveBeenCalled();
      });
    });
  });

  /* ==================== handleAutoPlayNextToggle (via bindSearchEvents) ==================== */

  describe('handleAutoPlayNextToggle', () => {
    it('should toggle autoPlayNext state on button click', async () => {
      state.autoPlayNext = false;
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.autoPlayNextBtn!.click();
      expect(state.autoPlayNext).toBe(true);
      expect(storage.set).toHaveBeenCalledWith('auto_play_next', true);
    });

    it('should toggle autoPlayNext from true to false', async () => {
      state.autoPlayNext = true;
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.autoPlayNextBtn!.click();
      expect(state.autoPlayNext).toBe(false);
      expect(storage.set).toHaveBeenCalledWith('auto_play_next', false);
    });

    it('should update button active class on toggle', async () => {
      state.autoPlayNext = false;
      const { bindSearchEvents } = await import('../app-events.js');
      bindSearchEvents();
      dom.autoPlayNextBtn!.click();
      expect(dom.autoPlayNextBtn!.classList.contains('active')).toBe(true);
    });
  });

  /* ==================== Share button data attributes ==================== */

  describe('share data attribute bindings', () => {
    it('should bind data-share=copy button', async () => {
      const copyBtn = document.createElement('button');
      copyBtn.dataset.share = 'copy';
      document.body.appendChild(copyBtn);
      const { bindPanelsAndShareEvents } = await import('../app-events.js');
      bindPanelsAndShareEvents();
      copyBtn.click();
      const { shareCopy, toggleShareMenu } = await import('../share.js');
      expect(shareCopy).toHaveBeenCalled();
      expect(toggleShareMenu).toHaveBeenCalled();
    });

    it('should bind data-share=copy-simple button', async () => {
      const copySimpleBtn = document.createElement('button');
      copySimpleBtn.dataset.share = 'copy-simple';
      document.body.appendChild(copySimpleBtn);
      const { bindPanelsAndShareEvents } = await import('../app-events.js');
      bindPanelsAndShareEvents();
      copySimpleBtn.click();
      const { shareCopySimple, toggleShareMenu } = await import('../share.js');
      expect(shareCopySimple).toHaveBeenCalled();
      expect(toggleShareMenu).toHaveBeenCalled();
    });

    it('should bind data-share=whatsapp button', async () => {
      const whatsappBtn = document.createElement('button');
      whatsappBtn.dataset.share = 'whatsapp';
      document.body.appendChild(whatsappBtn);
      const { bindPanelsAndShareEvents } = await import('../app-events.js');
      bindPanelsAndShareEvents();
      whatsappBtn.click();
      const { shareWhatsApp, toggleShareMenu } = await import('../share.js');
      expect(shareWhatsApp).toHaveBeenCalled();
      expect(toggleShareMenu).toHaveBeenCalled();
    });

    it('should bind data-share=telegram button', async () => {
      const telegramBtn = document.createElement('button');
      telegramBtn.dataset.share = 'telegram';
      document.body.appendChild(telegramBtn);
      const { bindPanelsAndShareEvents } = await import('../app-events.js');
      bindPanelsAndShareEvents();
      telegramBtn.click();
      const { shareTelegram, toggleShareMenu } = await import('../share.js');
      expect(shareTelegram).toHaveBeenCalled();
      expect(toggleShareMenu).toHaveBeenCalled();
    });
  });
});
