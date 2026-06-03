import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom, cacheDom } from './dom.js';
import { loadingBar } from './ui.js';
import { getLang, applyTranslations } from './i18n.js';
import { state } from './state.js';
import { startClock, loadPrayerTimes, checkAzanTime, scheduleNextAzanCheck } from './prayer.js';
import { loadFavorites } from './favorites.js';
import { initAdhkarState, loadAdhkarSettings, checkAdhkarNotifications } from './adhkar.js';
import { bindAudioEvents, setLoadSurah } from './audio.js';
import { loadFullQuranText } from './search-ui.js';
import { renderReadingStats } from './reading-stats.js';
import { initKeyboardShortcuts } from './keyboard.js';
import { initCapacitorBackButton } from './capacitor-back.js';
import { initNavigation } from './navigation.js';
import { initToggleSwitchAccessibility } from './a11y.js';
import {
  loadSurah, loadSurahList, buildSurahOffsets, populateReciterSelect
} from './surah-loader.js';
import { preloadTajweedIfNeeded } from './tajweed-data.js';
import {
  showContinueWidget, showWelcomeScreen,
  handleVisibilityChange, updateNetworkBanner, updateReadingProgress
} from './ui-extras.js';
import { restoreSettings, initSystemThemeDetection } from './settings.js';
import { bindAllEvents } from './app-events.js';

export { loadSurah, renderSurah, highlightCurrentAyah, updatePlayerInfo, buildSurahOffsets, loadSurahList } from './surah-loader.js';

function initState() {
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
}

/* ===================== INIT ===================== */

/** Initialize the application: load state, data, bind events. */
export async function initApp() {
  // ========== PHASE 1: CRITICAL PATH ==========
  initState();
  setLoadSurah(loadSurah);
  cacheDom();
  restoreSettings();
  initSystemThemeDetection();
  preloadTajweedIfNeeded();
  populateReciterSelect();

  await loadSurahList();
  buildSurahOffsets();

  const fullQuranPromise = loadFullQuranText().catch(console.warn);
  if (!navigator.onLine) {
    await fullQuranPromise;
  }

  const last = storage.get('last_position');
  if (last && last.surah) {
    state.currentSurah = last.surah;
    await loadSurah(last.surah, { startAyah: last.ayahNumberInSurah || 1 });
    setTimeout(() => showContinueWidget(last), 1200);
  } else {
    await loadSurah(1);
  }

  bindAudioEvents();

  // ========== PHASE 2: EVENT BINDINGS ==========
  bindAllEvents();

  initNavigation();
  initKeyboardShortcuts();
  initCapacitorBackButton();
  initToggleSwitchAccessibility();

  // Set language selector to current language
  if (dom.langSelect) dom.langSelect.value = getLang();

  // Listen for language changes to update UI text
  window.addEventListener('languagechange', () => {
    applyTranslations();
    const hint = document.getElementById('keyboardHint');
    if (hint) hint.textContent = '';  // will be set by i18n
  });

  // Restore player state
  const savedPlayerCollapsed = storage.get('player_collapsed');
  if (savedPlayerCollapsed === false && dom.player) dom.player.classList.remove('collapsed');

  // Show welcome screen on first visit
  showWelcomeScreen();

  window.addEventListener('online', updateNetworkBanner);
  window.addEventListener('offline', updateNetworkBanner);
  updateNetworkBanner();

  document.addEventListener('visibilitychange', handleVisibilityChange);

  state._updateReadingProgress = updateReadingProgress;
  window.addEventListener('scroll', updateReadingProgress, { passive: true });
  updateReadingProgress();

  // ========== PHASE 3: DEFERRED NON-CRITICAL INIT ==========
  setTimeout(() => {
    loadingBar.init();
    loadingBar.hide();
    initAdhkarState();
    loadAdhkarSettings();
    loadFavorites();
    startClock();
    checkAzanTime();
    scheduleNextAzanCheck();
    loadPrayerTimes();
    checkAdhkarNotifications();
    if (!state.adhkarIntervalId) state.adhkarIntervalId = setInterval(checkAdhkarNotifications, 15000);
    import('./ayah-modal.js').then(m => m.initAyahModal()).catch(() => {});
    import('./presentation.js').then(m => m.initPresentation()).catch(() => {});
    import('./mushaf.js').then(m => m.populateSurahOverlay()).catch(() => {});
    // Ensure full Quran text is loaded when online (non-blocking)
    if (navigator.onLine) fullQuranPromise.catch(console.warn);
  }, 0);
}
