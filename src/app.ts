import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom, cacheDom } from './dom.js';
import { loadingBar } from './ui.js';
import { getLang, applyTranslations } from './i18n.js';
import { state, setState, resetState, batch, type AppState } from './state.js';
import { setUpdateReadingProgress } from './internal-state.js';
import { startClock, loadPrayerTimes, scheduleNextAzanCheck } from './prayer.js';
import { loadFavorites } from './favorites.js';
import { initAdhkarState, loadAdhkarSettings, startAdhkarNotificationScheduler } from './adhkar.js';
import { bindAudioEvents, setLoadSurah } from './audio.js';
import { loadFullQuranText } from './search-ui.js';
import { initKeyboardShortcuts } from './keyboard.js';
import { initCapacitorBackButton } from './capacitor-back.js';
import { initNavigation } from './navigation.js';
import { initToggleSwitchAccessibility } from './a11y.js';
import { loadSurah, loadSurahList, buildSurahOffsets, populateReciterSelect } from './surah-loader.js';
import { preloadTajweedIfNeeded } from './tajweed-data.js';
import { showContinueWidget, handleVisibilityChange, updateNetworkBanner, updateReadingProgress } from './ui-extras.js';
import { restoreSettings, initSystemThemeDetection } from './settings.js';
import { bindAllEvents } from './app-events.js';
import { injectOverlays } from './overlays.js';

export {
  loadSurah,
  renderSurah,
  highlightCurrentAyah,
  updatePlayerInfo,
  buildSurahOffsets,
  loadSurahList,
} from './surah-loader.js';

/** Shape of the last_position entry stored in localStorage. */
interface LastPosition {
  surah?: number;
  surahName?: string;
  ayahNumberInSurah?: number;
  timestamp?: number;
}

function initState(): void {
  // Reset to defaults first (using resetState which goes through the Proxy)
  resetState();
}

/* ===================== INIT ===================== */

/** Initialize the application: load state, data, bind events. */
export async function initApp(): Promise<void> {
  // ========== PHASE 1: CRITICAL PATH ==========
  initState();
  setLoadSurah(loadSurah);
  injectOverlays(); // Must run before cacheDom — injects overlay HTML into DOM
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

  const last = storage.get<LastPosition>('last_position');
  if (last && last.surah) {
    state.currentSurah = last.surah;
    await loadSurah(last.surah, { startAyah: last.ayahNumberInSurah || 1 });
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

  // Listen for language changes to update UI text (custom event from i18n module)
  window.addEventListener('app:langchange', () => {
    applyTranslations();
    const hint = document.getElementById('keyboardHint');
    if (hint) hint.textContent = ''; // will be set by i18n
  });

  // Restore player state
  const savedPlayerCollapsed = storage.get<boolean>('player_collapsed');
  if (savedPlayerCollapsed === false && dom.player) dom.player.classList.remove('collapsed');

  window.addEventListener('online', updateNetworkBanner);
  window.addEventListener('offline', updateNetworkBanner);
  updateNetworkBanner();

  document.addEventListener('visibilitychange', handleVisibilityChange);

  setUpdateReadingProgress(updateReadingProgress);
  window.addEventListener('scroll', updateReadingProgress, { passive: true });
  updateReadingProgress();

  // ========== PHASE 3: DEFERRED NON-CRITICAL INIT ==========
  setTimeout(() => {
    loadingBar.init();
    loadingBar.hide();
    initAdhkarState();
    loadAdhkarSettings();
    startAdhkarNotificationScheduler();
    loadFavorites();
    startClock();
    scheduleNextAzanCheck();
    loadPrayerTimes();
    import('./ayah-modal.js').then((m) => m.initAyahModal()).catch((e) => console.error('[App] Failed to init ayah modal:', e));
    import('./presentation.js').then((m) => m.initPresentation()).catch((e) => console.error('[App] Failed to init presentation:', e));
    import('./mushaf.js').then((m) => m.populateSurahOverlay()).catch((e) => console.error('[App] Failed to init mushaf overlay:', e));
    // Ensure full Quran text is loaded when online (non-blocking)
    if (navigator.onLine) fullQuranPromise.catch(console.warn);
  }, 0);
}
