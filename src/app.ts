/**
 * Application Initialization Module.
 *
 * Orchestrates the 3-phase bootstrap sequence:
 *   Phase 1 — Critical path: state, DOM cache, settings, surah list, first surah load
 *   Phase 2 — Event bindings: navigation, keyboard, accessibility, language, visibility
 *   Phase 3 — Deferred: clock, prayer, adhkar, favorites, modals, search index
 *
 * Re-exports core surah-loader functions for use by other modules.
 */

import { storage } from './storage.js';
import { App as CapacitorApp } from '@capacitor/app';
import { dom, cacheDom } from './dom.js';
import { loadingBar } from './ui.js';
import { getLang, applyTranslations } from './i18n.js';
import { state, resetState } from './state.js';
import { setUpdateReadingProgress } from './internal-state.js';
import { startClock, loadPrayerTimes, scheduleNextAzanCheck } from './prayer.js';
import { loadFavorites } from './favorites.js';
import { initAdhkarState, loadAdhkarSettings, startAdhkarNotificationScheduler } from './adhkar.js';
import { bindAudioEvents, setLoadSurah } from './audio.js';
import { initKeyboardShortcuts } from './keyboard.js';
import { initCapacitorBackButton } from './capacitor-back.js';
import { initNavigation } from './navigation.js';
import { initToggleSwitchAccessibility, initReducedMotionDetection } from './a11y.js';
import {
  loadSurah,
  loadSurahList,
  buildSurahOffsets,
  populateReciterSelect,
  updateCurrentSurahLocale,
} from './surah-loader.js';
import { handleVisibilityChange, updateNetworkBanner, updateReadingProgress } from './ui-extras.js';
import { restoreSettings, initSystemThemeDetection } from './settings.js';
import { bindAllEvents, initAutoPlayNextButton } from './app-events.js';
import { injectOverlays } from './overlays.js';
import { loadFullQuranText } from './search-ui.js';
import { preloadTajweedIfNeeded } from './tajweed-data.js';
import { refreshRecentExternalData } from './external-data-cache.js';

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

/**
 * Reset application state to defaults.
 * Called at the beginning of initApp to ensure a clean state.
 */
function initState(): void {
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
  // initI18n runs before panel injection; apply once more so newly injected
  // settings, player, and help menus immediately use the selected language.
  applyTranslations();
  restoreSettings();
  initSystemThemeDetection();
  populateReciterSelect();

  await loadSurahList();
  buildSurahOffsets();

  // Keep search ready when offline, where an on-demand fetch may not be
  // possible. Connected readers load the index only when opening search.
  if (!navigator.onLine) {
    await loadFullQuranText();
  }

  const last = storage.get<LastPosition>('last_position');
  if (last && last.surah) {
    state.currentSurah = last.surah;
    await loadSurah(last.surah, { startAyah: last.ayahNumberInSurah || 1 });
  } else {
    await loadSurah(1);
  }

  // This now resolves to the active surah's small tajweed chunk, not the
  // full corpus, and is a no-op when tajweed is disabled.
  void preloadTajweedIfNeeded();

  bindAudioEvents();

  // ========== PHASE 2: EVENT BINDINGS ==========
  bindAllEvents();
  initAutoPlayNextButton();

  initNavigation();
  initKeyboardShortcuts();
  initCapacitorBackButton({
    App: {
      addListener: (event, callback) => {
        if (event === 'backButton') {
          void CapacitorApp.addListener('backButton', callback);
        }
      },
      exitApp: () => {
        void CapacitorApp.exitApp();
      },
    },
  });
  initToggleSwitchAccessibility();
  initReducedMotionDetection();

  // Set language selector to current language
  if (dom.langSelect) {
    dom.langSelect.value = getLang();
  }

  // Listen for language changes to update UI text (custom event from i18n module)
  window.addEventListener('app:langchange', () => {
    applyTranslations();
    updateCurrentSurahLocale();
    const hint = document.getElementById('keyboardHint');
    if (hint) {
      hint.textContent = '';
    } // will be set by i18n
  });

  // Restore player state
  const savedPlayerCollapsed = storage.get<boolean>('player_collapsed');
  if (savedPlayerCollapsed === false && dom.player) {
    dom.player.classList.remove('collapsed');
    document.body.classList.add('player-expanded');
  }

  window.addEventListener('online', () => {
    updateNetworkBanner();
    // Refresh only recently used remote JSON responses after reconnecting.
    // This is silent and bounded so it does not disturb reading or playback.
    void refreshRecentExternalData();
  });
  window.addEventListener('offline', updateNetworkBanner);
  updateNetworkBanner();

  document.addEventListener('visibilitychange', handleVisibilityChange);

  setUpdateReadingProgress(updateReadingProgress);
  window.addEventListener('scroll', updateReadingProgress, { passive: true });
  updateReadingProgress();

  // ========== PHASE 3: DEFERRED NON-CRITICAL INIT ==========
  // Use requestIdleCallback when available to avoid blocking user interaction.
  // Falls back to setTimeout for browsers without rIC support.
  // This improves INP (Interaction to Next Paint) by yielding to the main thread.
  const scheduleIdle =
    typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 1);

  // Web-only visual extension. Defer it until the browser is idle so the
  // existing reader remains the only work on the critical path. Capacitor
  // retains its current UI because the module is never imported there.
  const isCapNative = document.documentElement.classList.contains('capacitor-native') || document.body.classList.contains('capacitor-native');
  if (!isCapNative) {
    scheduleIdle(() => {
      void import('./hifz-room.js')
        .then(({ initHifzRoom }) => initHifzRoom())
        .catch((error: unknown) => {
          console.warn('[App] Hifz Room initialization skipped:', error);
        });
    });
  }

  scheduleIdle(() => {
    loadingBar.init();
    loadingBar.hide();

    // Group 1: Lightweight state init (no network, no DOM mutation)
    initAdhkarState();
    loadAdhkarSettings();
    loadFavorites();

    // Group 2: Clock & prayer (lightweight, starts intervals)
    startClock();
    scheduleNextAzanCheck();

    // Group 3: Network-dependent (non-blocking) — defer to next idle period
    scheduleIdle(() => {
      startAdhkarNotificationScheduler();
      loadPrayerTimes();
    });

    // Group 4: Heavy feature modules — lazy-import, lowest priority
    // Uses safeLoad() for retry + user-visible error UI (instead of silent console.error)
    scheduleIdle(() => {
      void (async () => {
        try {
          const { safeLoad } = await import('./error-boundary.js');

          const ayahModal = await safeLoad(() => import('./ayah-modal.js'), {
            label: 'نافذة الآية',
            maxRetries: 2,
            baseDelay: 800,
          });
          if (ayahModal.success && ayahModal.module) {
            ayahModal.module.initAyahModal();
          }

          const presentation = await safeLoad(() => import('./presentation.js'), {
            label: 'وضع العرض',
            maxRetries: 2,
            baseDelay: 800,
          });
          if (presentation.success && presentation.module) {
            presentation.module.initPresentation();
          }

          const mushaf = await safeLoad(() => import('./mushaf.js'), {
            label: 'وضع المصحف',
            maxRetries: 2,
            baseDelay: 800,
          });
          if (mushaf.success && mushaf.module) {
            mushaf.module.populateSurahOverlay();
          }
        } catch (error) {
          console.warn('[App] Deferred feature initialization skipped:', error);
        }
      })();
    });
  });
}
