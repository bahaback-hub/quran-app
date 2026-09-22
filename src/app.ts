/**
 * Application Initialization Module.
 *
 * Orchestrates the 3-phase bootstrap sequence:
 *   Phase 1 — Critical path: state, DOM cache, settings, surah list, first surah load.
 *             Toolbar/navigation/keyboard events bind before the first load so the
 *             reader is never blocked by (or racing) the initial network fetch.
 *   Phase 2 — Init helpers that depend on a rendered surah (tajweed preload, hash links).
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
import {
  startClock,
  loadPrayerTimes,
  loadUnderwrittenPrayerTable,
  scheduleNextAzanCheck,
} from './features/prayer/prayer.js';
import { loadFavorites } from './favorites.js';
import { initAdhkarState, loadAdhkarSettings, startAdhkarNotificationScheduler } from './adhkar.js';
import { bindAudioEvents, setLoadSurah, setReloadAudio } from './features/audio/audio.js';
import { initKeyboardShortcuts } from './keyboard.js';
import { initCapacitorBackButton } from './capacitor-back.js';
import { initNavigation } from './navigation.js';
import { initToggleSwitchAccessibility, initReducedMotionDetection } from './a11y.js';
import {
  loadSurah,
  reloadCurrentSurahAudio,
  loadSurahList,
  buildSurahOffsets,
  populateReciterSelect,
  updateCurrentSurahLocale,
  highlightCurrentAyah,
} from './surah-loader.js';
import { parseDeepLink, clearDeepLinkHash } from './deep-link.js';
import { showHome } from './home.js';
import { handleVisibilityChange, showContinueWidget, updateNetworkBanner, updateReadingProgress } from './ui-extras.js';
import { restoreSettings, initSystemThemeDetection } from './settings.js';
import { bindAllEvents, initAutoPlayNextButton } from './app-events.js';
import { injectOverlays } from './overlays.js';
import { loadFullQuranText } from './features/search/search-ui.js';
import { preloadTajweedIfNeeded } from './tajweed-data.js';
import { refreshRecentExternalData } from './external-data-cache.js';
import { initLangSwitcher } from './lang-switcher.js';
import { initCspReporting } from './csp-report.js';

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
  initCspReporting(); // CSP violation monitoring — before any dynamic content injects
  setLoadSurah(loadSurah);
  setReloadAudio(reloadCurrentSurahAudio);
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

  // Bind toolbar, navigation, and keyboard events BEFORE the first surah load
  // resolves so a reader can start navigating as soon as the surah selector is
  // populated — interaction is never blocked by the initial network fetch. This
  // also keeps E2E deterministic on slower engines: a surah change high in the
  // boot sequence is still handled instead of racing the initial load.
  bindAudioEvents();
  bindAllEvents();
  initAutoPlayNextButton();
  initNavigation();
  initKeyboardShortcuts();

  const deepLink = parseDeepLink(window.location.hash);
  let loadedSurah = false;
  if (deepLink) {
    // Deep link (#surah=N, #surah=N/A, #page=P) from a pre-rendered SEO page,
    // a share link, or a bookmark. Surah links take priority over the last
    // position; page links just remember the target page (Mushaf reads it on
    // open) while the reader still lands on a usable surah below.
    if (deepLink.kind === 'surah') {
      state.currentSurah = deepLink.number;
      if (dom.surahSelect) {
        dom.surahSelect.value = String(deepLink.number);
      }
      await loadSurah(deepLink.number, { startAyah: deepLink.startAyah });
      if (deepLink.startAyah) {
        // Highlight + scroll to the requested ayah once the chunk is rendered.
        window.setTimeout(() => {
          highlightCurrentAyah();
          clearDeepLinkHash();
        }, 80);
      } else {
        clearDeepLinkHash();
      }
      loadedSurah = true;
    } else {
      state.currentPage = deepLink.page;
      clearDeepLinkHash();
    }
  }
  if (!loadedSurah) {
    const last = storage.get<LastPosition>('last_position');
    if (last && last.surah) {
      state.currentSurah = last.surah;
      await loadSurah(last.surah, { startAyah: last.ayahNumberInSurah || 1 });
      // Confirm the restored reading position with a short, dismissible card.
      // The position itself remains local to the reader's device.
      window.setTimeout(() => {
        showContinueWidget({
          surah: last.surah!,
          surahName: state.surahData?.name || last.surahName || String(last.surah),
          englishSurahName: state.surahData?.englishName,
          ayahNumberInSurah: last.ayahNumberInSurah || 1,
          timestamp: last.timestamp,
          restored: true,
        });
      }, 420);
    } else if (!deepLink) {
      // First visit with no saved position and no deep link: welcome the
      // visitor with the launcher instead of dumping them into Al-Fatiha.
      showHome();
    } else {
      await loadSurah(1);
    }
  }

  // This now resolves to the active surah's small tajweed chunk, not the
  // full corpus, and is a no-op when tajweed is disabled.
  void preloadTajweedIfNeeded();

  // React to deep links arriving while the app is already open (e.g. clicking a
  // shared SEO URL or a bookmarked #surah=N link).
  window.addEventListener('hashchange', () => {
    const dl = parseDeepLink(window.location.hash);
    if (!dl) {
      return;
    }
    if (dl.kind === 'surah') {
      state.currentSurah = dl.number;
      if (dom.surahSelect) {
        dom.surahSelect.value = String(dl.number);
      }
      void loadSurah(dl.number, { startAyah: dl.startAyah }).then(() => {
        if (dl.startAyah) {
          window.setTimeout(highlightCurrentAyah, 0);
        }
      });
    } else {
      state.currentPage = dl.page;
    }
    clearDeepLinkHash();
  });
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
  initLangSwitcher();

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
  window.addEventListener('focus', updateNetworkBanner);
  window.addEventListener('pageshow', updateNetworkBanner);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateNetworkBanner();
    }
  });
  updateNetworkBanner();
  // Some browsers restore a cached page before their network state settles.
  window.setTimeout(updateNetworkBanner, 0);

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

  // Hifz Room is part of the reader on every platform (web and native).
  // Defer it until the browser is idle so the existing reader remains the
  // only work on the critical path.
  scheduleIdle(() => {
    void import('./hifz-room.js')
      .then(({ initHifzRoom }) => initHifzRoom())
      .catch((error: unknown) => {
        console.warn('[App] Hifz Room initialization skipped:', error);
      });
  });

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
      void loadUnderwrittenPrayerTable().then(() => loadPrayerTimes());
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

          const presentation = await safeLoad(() => import('./features/presentation/presentation.js'), {
            label: 'وضع العرض',
            maxRetries: 2,
            baseDelay: 800,
          });
          if (presentation.success && presentation.module) {
            presentation.module.initPresentation();
          }

          const mushaf = await safeLoad(() => import('./features/mushaf/mushaf.js'), {
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
