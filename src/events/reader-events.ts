/**
 * Reader-surface event bindings (favorites, prayer bar, audio download,
 * autoplay, search, global overlay closer, misc overlays).
 *
 * Split from app-events.ts for maintainability; re-exported through its barrel.
 */
import { CONFIG } from '../config.js';
import { dom } from '../dom.js';
import { storage } from '../storage.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { __ } from '../i18n.js';
import { openFavorites, closeFavorites } from '../favorites.js';
import { closeAdhkarPanel, wireAdhkarEvents } from '../adhkar.js';
import { closeSettings } from '../settings.js';
import {
  togglePrayerBar,
  initPrayerBarQuickSelect,
  hideQiblaCompass,
  showQiblaCompass,
} from '../features/prayer/prayer.js';
import {
  cacheSurahAudio,
  isSurahCached,
  deleteSurahCache,
} from '../features/audio/audio-cache.js';
import {
  performExactSearch,
  initKeyboard,
  initSearchAutocomplete,
  loadFullQuranText,
  startVoiceSearch,
} from '../features/search/search-ui.js';
import { showSleepTimerModal } from '../sleep-timer-modal.js';
import * as audioModule from '../features/audio/audio.js';

/**
 * Bind favorites and prayer bar collapse events.
 */
export function bindPanelsAndShareEvents(): void {
  dom.favoritesOpenBtn?.addEventListener('click', () => {
    if (dom.favoritesPanel?.classList.contains('open')) {
      closeFavorites();
      return;
    }
    openFavorites();
  });
  dom.favoritesCloseBtn?.addEventListener('click', closeFavorites);
  dom.collapseBarBtn?.addEventListener('click', togglePrayerBar);
  dom.expandBarBtn?.addEventListener('click', togglePrayerBar);
  initPrayerBarQuickSelect();
}

/**
 * Handle the download audio button click.
 * If the surah audio is already cached, offer to delete it.
 * Otherwise, start downloading the audio for offline use.
 */
async function handleDownloadAudio(): Promise<void> {
  if (!state.surahData || !state.ayahsAudios?.length) {
    showToast(__('download_audio_no_data'), 'error');
    return;
  }

  const surah = state.currentSurah;
  const reciter = state.currentReciter || CONFIG.DEFAULT_RECITER;
  const audioUrls = state.ayahsAudios;

  // Check if already cached
  const cached = await isSurahCached(audioUrls);

  if (cached) {
    // Already cached — offer to delete
    const deleted = await deleteSurahCache(surah, reciter);
    if (deleted > 0) {
      showToast(__('download_audio_deleted'), 'success');
      if (dom.downloadAudioBtn) {
        dom.downloadAudioBtn.textContent = __('download_audio');
        dom.downloadAudioBtn.classList.remove('active');
      }
    }
    return;
  }

  // Not cached — start download
  showToast(__('download_audio_start'), 'success');
  if (dom.downloadAudioBtn) {
    dom.downloadAudioBtn.textContent = '⏳...';
    dom.downloadAudioBtn.classList.add('downloading');
  }

  try {
    await cacheSurahAudio(
      audioUrls,
      surah,
      reciter,
      (_surah: number, _reciter: string, current: number, total: number) => {
        // Update button text with progress
        if (dom.downloadAudioBtn) {
          dom.downloadAudioBtn.textContent = `${current}/${total}`;
        }
      },
    );

    // Download complete
    showToast(__('download_audio_done'), 'success');
    if (dom.downloadAudioBtn) {
      dom.downloadAudioBtn.textContent = '✅';
      dom.downloadAudioBtn.classList.remove('downloading');
      dom.downloadAudioBtn.classList.add('active');
      // Reset to cached state after a brief moment
      setTimeout(() => {
        if (dom.downloadAudioBtn) {
          dom.downloadAudioBtn.textContent = __('download_audio');
        }
      }, 2000);
    }
  } catch {
    showToast(__('download_audio_error'), 'error');
    if (dom.downloadAudioBtn) {
      dom.downloadAudioBtn.textContent = __('download_audio');
      dom.downloadAudioBtn.classList.remove('downloading');
    }
  }
}

/**
 * Toggle auto-play next surah mode.
 * When enabled, playback continues to the next surah automatically.
 * When disabled, playback stops at the end of each surah.
 * State is persisted to localStorage.
 */
function handleAutoPlayNextToggle(): void {
  state.autoPlayNext = !state.autoPlayNext;
  storage.set('auto_play_next', state.autoPlayNext);
  if (dom.autoPlayNextBtn) {
    dom.autoPlayNextBtn.classList.toggle('active', state.autoPlayNext);
  }
  showToast(state.autoPlayNext ? __('autoplay_next_enabled') : __('autoplay_next_disabled'), 'success');
}

/**
 * Initialize the auto-play next surah button state from localStorage.
 * Restores the toggle state and updates the button appearance.
 */
export function initAutoPlayNextButton(): void {
  const saved = storage.get<boolean>('auto_play_next', false);
  state.autoPlayNext = saved === true;
  if (dom.autoPlayNextBtn) {
    dom.autoPlayNextBtn.classList.toggle('active', state.autoPlayNext);
  }
}

/**
 * Bind search controls.
 */
export function bindSearchEvents(): void {
  dom.searchBtn?.addEventListener('click', async () => {
    const q = dom.searchInput?.value.trim();
    if (!q) {
      return;
    }
    if (!state.fullQuranLoaded) {
      showToast(__('quran_db_loading'));
      await loadFullQuranText();
    }
    performExactSearch(q);
  });
  dom.searchInput?.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      dom.searchBtn?.click();
    }
  });
  dom.voiceSearchBtn?.addEventListener('click', startVoiceSearch);
  dom.installBtn?.addEventListener('click', () => {
    if (typeof (window as Window & { installPWA?: () => void }).installPWA === 'function') {
      (window as Window & { installPWA: () => void }).installPWA();
    }
  });
  dom.sleepTimerBtn?.addEventListener('click', () => {
    showSleepTimerModal(audioModule);
  });
  dom.downloadAudioBtn?.addEventListener('click', handleDownloadAudio);

  // Auto-play next surah toggle
  dom.autoPlayNextBtn?.addEventListener('click', handleAutoPlayNextToggle);

  initKeyboard();
  initSearchAutocomplete();
}

/**
 * Bind global document click handler for auto-closing overlays.
 */
export function bindGlobalClickHandler(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    const settingsTarget = e.target as HTMLElement;
    if (!dom.themeToggle?.contains(settingsTarget)) {
      dom.themeToggle?.classList.remove('open');
      dom.themeMenuBtn?.setAttribute('aria-expanded', 'false');
    }
    const isSettingsTrigger =
      settingsTarget === dom.settingsToggleBtn || settingsTarget.closest?.('#settingsToggleBtn') !== null;
    const isAdhkarTrigger = settingsTarget === dom.adhkarBtn || settingsTarget.closest?.('#adhkarBtn') !== null;
    if (
      dom.settingsPanel?.classList.contains('open') &&
      !dom.settingsPanel.contains(e.target as Node) &&
      !isSettingsTrigger
    ) {
      closeSettings();
    }
    if (
      dom.favoritesPanel?.classList.contains('open') &&
      !dom.favoritesPanel.contains(e.target as Node) &&
      !dom.favoritesOpenBtn?.contains(e.target as Node)
    ) {
      closeFavorites();
    }
    if (
      dom.adhkarPanel?.classList.contains('open') &&
      !dom.adhkarPanel.contains(e.target as Node) &&
      !isAdhkarTrigger
    ) {
      closeAdhkarPanel();
    }
  });
}

/** No-op: header menu dropdown removed. */
export function bindHeaderMenuEvents(): void {
  // dropdown removed
}

/**
 * Bind search submit shortcut, mushaf overlay, adhkar, qibla, reading stats.
 */
export function bindMiscEvents(): void {
  dom.searchToggleBtn?.addEventListener('click', () => {
    const headerSearch = document.getElementById('headerSearch');
    headerSearch?.classList.add('is-expanded');
    dom.searchToggleBtn?.setAttribute('aria-expanded', 'true');
    dom.searchInputGroup?.classList.remove('hidden');
    dom.searchInput?.focus();
    dom.searchInput?.select();
    if (window.innerWidth > 600 && !document.getElementById('arabicKeyboard')?.classList.contains('open')) {
      dom.kbdToggleBtn?.click();
    }
  });
  document.getElementById('headerSearchCloseBtn')?.addEventListener('click', () => {
    document.getElementById('headerSearch')?.classList.remove('is-expanded');
    dom.searchToggleBtn?.setAttribute('aria-expanded', 'false');
    dom.searchInput?.blur?.();
    document.getElementById('arabicKeyboard')?.classList.remove('open');
    dom.kbdToggleBtn?.classList.remove('active');
  });

  dom.mushafSurahOverlayClose?.addEventListener('click', () => {
    if (dom.mushafSurahOverlay) {
      dom.mushafSurahOverlay.classList.add('hidden');
      dom.mushafSurahOverlay.style.display = 'none';
    }
  });
  dom.mushafSurahOverlay?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.mushafSurahOverlay && dom.mushafSurahOverlay) {
      dom.mushafSurahOverlay.classList.add('hidden');
      dom.mushafSurahOverlay.style.display = 'none';
    }
  });
  dom.surahSecretsCloseBtn?.addEventListener('click', () => {
    if (dom.surahSecretsOverlay) {
      dom.surahSecretsOverlay.classList.add('hidden');
      dom.surahSecretsOverlay.style.display = 'none';
    }
  });
  dom.surahSecretsOverlay?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.surahSecretsOverlay && dom.surahSecretsOverlay) {
      dom.surahSecretsOverlay.classList.add('hidden');
      dom.surahSecretsOverlay.style.display = 'none';
    }
  });

  wireAdhkarEvents();

  dom.qiblaBtn?.addEventListener('click', () => {
    const qiblaOpen = Boolean(dom.qiblaOverlay && !dom.qiblaOverlay.classList.contains('hidden'));
    if (qiblaOpen) {
      hideQiblaCompass();
      return;
    }
    showQiblaCompass();
  });
  dom.qiblaCloseBtn?.addEventListener('click', hideQiblaCompass);
  dom.qiblaOverlay?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.qiblaOverlay) {
      hideQiblaCompass();
    }
  });

  dom.readingStatsCloseBtn?.addEventListener('click', () => {
    if (dom.readingStatsPanel) {
      dom.readingStatsPanel.classList.add('hidden');
      dom.readingStatsPanel.style.display = 'none';
    }
  });
}
