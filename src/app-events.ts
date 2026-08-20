/**
 * Event bindings extracted from app.js for maintainability.
 * All DOM event listeners are registered here, grouped by feature.
 */

import { CONFIG } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { state } from './state.js';
import { showToast } from './ui.js';
import { __, AVAILABLE_LANGUAGES, getLang, setLang } from './i18n.js';
import {
  applyFontSize,
  changeReaderZoom,
  updateReaderZoomControl,
  toggleNightMode,
  applyTheme,
  applyFontType,
  applyLineSpacing,
  applyPresBgMode,
  applyPresBgScene,
  applyPresBgNature,
  openSettings,
  closeSettings,
  saveLocationSettings,
  resetSettings,
  exportSettings,
  importSettings,
  initSettingsTabs,
} from './settings.js';
import { cacheSurahAudio, isSurahCached, deleteSurahCache } from './audio-cache.js';
import {
  deleteMushafDataPack,
  downloadMushafDataPack,
  formatMushafDataBytes,
  getMushafDataPackStatus,
  verifyMushafDataPack,
} from './mushaf-data-pack.js';
import {
  togglePrayerBar,
  testAzan,
  stopAzan,
  hideQiblaCompass,
  hideAzanNotification,
  showQiblaCompass,
} from './prayer.js';
import { toggleFavorite, openFavorites, closeFavorites, setBookmark, gotoBookmark } from './favorites.js';
import { closeAdhkarPanel, wireAdhkarEvents } from './adhkar.js';
import { loadSurah, toggleTranslation } from './surah-loader.js';
import {
  performExactSearch,
  initKeyboard,
  initSearchAutocomplete,
  loadFullQuranText,
  startVoiceSearch,
} from './search-ui.js';
import { showSleepTimerModal } from './sleep-timer-modal.js';
import { loadTajweedAnnotationsForSurah } from './tajweed-data.js';
import { toggleShareMenu, shareNative, shareCopy, shareCopySimple, shareWhatsApp, shareTelegram } from './share.js';
import { toggleTafsir, loadTafsirForCurrentAyah } from './tafsir.js';
import * as audioModule from './audio.js';

/** API response shape for ayah page lookup. */
interface AyahPageResponse {
  data?: {
    page?: number;
  };
}

/**
 * Bind surah/reciter selection and navigation controls.
 */
export function bindNavigationEvents(): void {
  dom.surahSelect?.addEventListener('change', () => {
    if (!dom.surahSelect!.value) {
      return;
    }
    const surahNum = parseInt(dom.surahSelect!.value, 10);
    if (state.mushafMode) {
      state.currentSurah = surahNum;
      fetch(`${CONFIG.API_BASE}/ayah/${surahNum}:1`)
        .then((res) => res.json())
        .then((data: AyahPageResponse) => {
          const page = data?.data?.page || 1;
          if (dom.pageSelect) {
            dom.pageSelect.value = String(page);
          }
          if (dom.pageSlider) {
            dom.pageSlider.value = String(page);
          }
          import('./mushaf.js').then((m) => m.loadPage(page, true)); // lazy: mushaf not in main chunk
        })
        .catch(() => showToast(__('mushaf_page_not_found'), 'error'));
    } else {
      loadSurah(surahNum);
    }
  });

  dom.reciterSelect?.addEventListener('change', () => {
    state.currentReciter = dom.reciterSelect!.value;
    storage.set('reciter', state.currentReciter);
    if (state.currentSurah) {
      loadSurah(state.currentSurah);
    }
  });
}

/**
 * Bind bookmark, favorite, theme, and settings buttons.
 */
export function bindHeaderAndSettingsEvents(): void {
  dom.bookmarkBtn?.addEventListener('click', setBookmark);
  dom.bookmarkBtn?.addEventListener('dblclick', gotoBookmark);
  dom.favoriteBtn?.addEventListener('click', toggleFavorite);
  dom.shareBtn?.addEventListener('click', () => toggleShareMenu());
  dom.themeToggle?.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('.theme-btn') as HTMLElement | null;
    if (btn?.dataset['theme']) {
      e.preventDefault();
      applyTheme(btn.dataset['theme'] as 'light' | 'sepia' | 'night');
    }
  });
  dom.themeToggle?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const btn = (e.target as HTMLElement).closest('.theme-btn') as HTMLElement | null;
      if (btn?.dataset['theme']) {
        applyTheme(btn.dataset['theme'] as 'light' | 'sepia' | 'night');
      } else {
        toggleNightMode();
      }
    }
  });
  dom.settingsToggleBtn?.addEventListener('click', openSettings);
  dom.settingsCloseBtn?.addEventListener('click', closeSettings);
  dom.saveLocationBtn?.addEventListener('click', saveLocationSettings);
  dom.testAzanBtn?.addEventListener('click', testAzan);
  dom.azanNotifStopBtn?.addEventListener('click', stopAzan);
  // welcome screen removed
  dom.resetSettingsBtn?.addEventListener('click', resetSettings);
  document.getElementById('exportSettingsBtn')?.addEventListener('click', () => exportSettings());
  document.getElementById('importSettingsBtn')?.addEventListener('click', () => importSettings());
  bindMushafDataPackEvents();
  initSettingsTabs();
}

function bindMushafDataPackEvents(): void {
  const status = document.getElementById('mushafDataPackStatus');
  const downloadButton = document.getElementById('downloadMushafDataPackBtn') as HTMLButtonElement | null;
  const verifyButton = document.getElementById('verifyMushafDataPackBtn') as HTMLButtonElement | null;
  const deleteButton = document.getElementById('deleteMushafDataPackBtn') as HTMLButtonElement | null;
  if (!status || !downloadButton || !verifyButton || !deleteButton) {
    return;
  }

  const setBusy = (busy: boolean) => {
    downloadButton.disabled = busy;
    verifyButton.disabled = busy;
    deleteButton.disabled = busy;
  };
  const refresh = async () => {
    const pack = await getMushafDataPackStatus();
    status.textContent = pack.installed
      ? `${__('mushaf_data_pack_installed')} (${formatMushafDataBytes(pack.totalBytes)})`
      : __('mushaf_data_pack_not_installed');
    verifyButton.disabled = !pack.installed;
    deleteButton.disabled = !pack.installed;
  };
  void refresh();

  downloadButton.addEventListener('click', async () => {
    setBusy(true);
    try {
      await downloadMushafDataPack((progress) => {
        status.textContent = `${__('mushaf_data_pack_downloading')} ${progress.completed}/${progress.total}`;
      });
      status.textContent = __('mushaf_data_pack_verified');
      showToast(__('mushaf_data_pack_verified'), 'success');
    } catch {
      status.textContent = __('mushaf_data_pack_failed');
      showToast(__('mushaf_data_pack_failed'), 'error');
    } finally {
      setBusy(false);
      await refresh();
    }
  });

  verifyButton.addEventListener('click', async () => {
    setBusy(true);
    try {
      const valid = await verifyMushafDataPack((progress) => {
        status.textContent = `${__('mushaf_data_pack_verify')} ${progress.completed}/${progress.total}`;
      });
      status.textContent = valid ? __('mushaf_data_pack_verified') : __('mushaf_data_pack_failed');
      showToast(valid ? __('mushaf_data_pack_verified') : __('mushaf_data_pack_failed'), valid ? 'success' : 'error');
    } finally {
      setBusy(false);
      await refresh();
    }
  });

  deleteButton.addEventListener('click', async () => {
    setBusy(true);
    try {
      await deleteMushafDataPack();
      showToast(__('mushaf_data_pack_deleted'), 'success');
    } finally {
      setBusy(false);
      await refresh();
    }
  });
}

/**
 * Bind azan notification and player events.
 */
export function bindAzanEvents(): void {
  dom.azanNotification?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.azanNotification) {
      stopAzan();
    }
  });
  dom.azanPlayer?.addEventListener('ended', () => {
    state.azanPlaying = false;
    if (dom.testAzanBtn) {
      dom.testAzanBtn.textContent = __('test_azan');
    }
    hideAzanNotification();
  });
}

/**
 * Bind tafsir curtain and translation select.
 */
export function bindTafsirEvents(): void {
  dom.tafsirCurtainHandle?.addEventListener('click', () => toggleTafsir());
  bindTafsirSheetGestures();
  dom.translationToggle?.addEventListener('click', toggleTranslation);
  dom.tafsirSelect?.addEventListener('change', () => {
    state.currentTafsirEdition = dom.tafsirSelect!.value;
    storage.set('tafsir_edition', state.currentTafsirEdition);
    if (dom.tafsirCurtain?.classList.contains('open')) {
      loadTafsirForCurrentAyah();
    }
  });

  dom.translationSelect?.addEventListener('change', () => {
    const val = dom.translationSelect!.value;
    if (val) {
      state.translationEnabled = true;
      state.currentTranslation = val;
    } else {
      state.translationEnabled = false;
      state.currentTranslation = '';
    }
    storage.set('translation_enabled', state.translationEnabled);
    storage.set('translation_edition', state.currentTranslation);
    if (state.currentSurah) {
      loadSurah(state.currentSurah);
    }
  });
}

/** Keep the mobile tafsir sheet resizable without allowing its scroll to move the reader behind it. */
function bindTafsirSheetGestures(): void {
  const curtain = dom.tafsirCurtain;
  const body = dom.tafsirCurtainBody;
  const grip = document.getElementById('tafsirCurtainGrip');
  if (!curtain || !body || !grip) {
    return;
  }

  const isMobileSheet = () => window.matchMedia('(max-width: 600px)').matches;
  const clampHeight = (height: number) => Math.min(window.innerHeight * 0.84, Math.max(window.innerHeight * 0.35, height));
  let startY = 0;
  let startHeight = 0;
  let pointerId: number | null = null;
  let lastTouchY: number | null = null;

  grip.addEventListener('pointerdown', (event: PointerEvent) => {
    if (!isMobileSheet() || !curtain.classList.contains('open')) {
      return;
    }
    event.preventDefault();
    pointerId = event.pointerId;
    startY = event.clientY;
    startHeight = curtain.getBoundingClientRect().height;
    curtain.classList.add('is-resizing');
    grip.setPointerCapture?.(event.pointerId);
  });

  grip.addEventListener('pointermove', (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    const nextHeight = clampHeight(startHeight + startY - event.clientY);
    document.documentElement.style.setProperty('--tafsir-sheet-height', `${Math.round(nextHeight)}px`);
  });

  const finishResize = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    grip.releasePointerCapture?.(event.pointerId);
    pointerId = null;
    curtain.classList.remove('is-resizing');
  };
  grip.addEventListener('pointerup', finishResize);
  grip.addEventListener('pointercancel', finishResize);

  body.addEventListener('wheel', (event: WheelEvent) => {
    const atTop = body.scrollTop <= 0;
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
    if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
      event.preventDefault();
    }
  }, { passive: false });

  body.addEventListener('touchstart', (event: TouchEvent) => {
    lastTouchY = event.touches[0]?.clientY ?? null;
  }, { passive: true });
  body.addEventListener('touchmove', (event: TouchEvent) => {
    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined || lastTouchY === null) {
      return;
    }
    const atTop = body.scrollTop <= 0;
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
    const movingDown = currentY > lastTouchY;
    const movingUp = currentY < lastTouchY;
    if ((movingDown && atTop) || (movingUp && atBottom)) {
      event.preventDefault();
    }
    lastTouchY = currentY;
  }, { passive: false });
  body.addEventListener('touchend', () => {
    lastTouchY = null;
  }, { passive: true });
}

/**
 * Bind display settings: font size, type, spacing, sepia, tajweed, toggles.
 */
export function bindDisplaySettingsEvents(): void {
  dom.fontSizeSelect?.addEventListener('change', (e: Event) =>
    applyFontSize(parseInt((e.target as HTMLSelectElement).value, 10)),
  );
  dom.readerZoomOutBtn?.addEventListener('click', () => changeReaderZoom(-1));
  dom.readerZoomInBtn?.addEventListener('click', () => changeReaderZoom(1));
  updateReaderZoomControl();
  dom.fontTypeSelect?.addEventListener('change', (e: Event) => applyFontType((e.target as HTMLSelectElement).value));
  dom.lineSpacingSelect?.addEventListener('change', (e: Event) =>
    applyLineSpacing((e.target as HTMLSelectElement).value),
  );
  dom.presBgSelect?.addEventListener('change', (e: Event) =>
    applyPresBgMode(
      (e.target as HTMLSelectElement).value as 'plain' | 'nature' | 'singleNature' | 'auto' | 'animated' | 'scene',
    ),
  );
  dom.presBgSceneSelect?.addEventListener('change', (e: Event) =>
    applyPresBgScene((e.target as HTMLSelectElement).value),
  );
  dom.presBgNatureSelect?.addEventListener('change', (e: Event) =>
    applyPresBgNature((e.target as HTMLSelectElement).value),
  );
  dom.tajweedToggle?.addEventListener('click', () => {
    state.tajweedEnabled = dom.tajweedToggle!.classList.toggle('on');
    storage.set('tajweed_enabled', state.tajweedEnabled);
    const reload = () => {
      if (state.currentSurah) {
        loadSurah(state.currentSurah);
      }
    };
    if (state.tajweedEnabled) {
      loadTajweedAnnotationsForSurah(state.currentSurah).then(reload);
    } else {
      reload();
    }
  });

  dom.azanToggle?.addEventListener('click', () => {
    state.azanEnabled = dom.azanToggle!.classList.toggle('on');
    storage.set('azan_enabled', state.azanEnabled);
  });
  dom.azanFajrToggle?.addEventListener('click', () => {
    state.azanFajrEnabled = dom.azanFajrToggle!.classList.toggle('on');
    storage.set('azan_fajr_enabled', state.azanFajrEnabled);
  });
  dom.autoSaveToggle?.addEventListener('click', () => {
    state.autoSave = dom.autoSaveToggle!.classList.toggle('on');
    storage.set('auto_save', state.autoSave);
  });

  dom.langSelect?.addEventListener('change', () => {
    const newLang = dom.langSelect!.value;
    if (newLang !== getLang()) {
      setLang(newLang as 'ar' | 'en' | 'tr' | 'ms' | 'id').then(() => {
        showToast(
          __('language') + ': ' + (AVAILABLE_LANGUAGES.find((l) => l.code === newLang)?.nativeName || newLang),
          'success',
        );
      });
    }
  });

  dom.cityQuickSelect?.addEventListener('change', () => {
    const v = dom.cityQuickSelect!.value;
    if (v) {
      const [city, country] = v.split('|') as [string, string];
      if (dom.cityInput) {
        dom.cityInput.value = city;
      }
      if (dom.countryInput) {
        dom.countryInput.value = country;
      }
    }
  });
}

/**
 * Bind favorites, prayer bar collapse, share menu items.
 */
export function bindPanelsAndShareEvents(): void {
  dom.favoritesOpenBtn?.addEventListener('click', openFavorites);
  dom.favoritesCloseBtn?.addEventListener('click', closeFavorites);
  dom.collapseBarBtn?.addEventListener('click', togglePrayerBar);
  dom.expandBarBtn?.addEventListener('click', togglePrayerBar);

  document.querySelectorAll('[data-share="native"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      shareNative();
      toggleShareMenu();
    }),
  );
  document.querySelectorAll('[data-share="copy"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      shareCopy();
      toggleShareMenu();
    }),
  );
  document.querySelectorAll('[data-share="copy-simple"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      shareCopySimple();
      toggleShareMenu();
    }),
  );
  document.querySelectorAll('[data-share="whatsapp"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      shareWhatsApp();
      toggleShareMenu();
    }),
  );
  document.querySelectorAll('[data-share="telegram"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      shareTelegram();
      toggleShareMenu();
    }),
  );
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
    if (!dom.shareMenu?.contains(e.target as Node) && !dom.shareBtn?.contains(e.target as Node)) {
      dom.shareMenu?.classList.remove('show');
    }
    const settingsTarget = e.target as HTMLElement;
    const isSettingsTrigger =
      settingsTarget === dom.settingsToggleBtn ||
      settingsTarget.closest?.('#settingsToggleBtn') !== null ||
      settingsTarget.closest?.('[data-tab="more"]');
    const isAdhkarTrigger =
      settingsTarget === dom.adhkarBtn ||
      settingsTarget.closest?.('#adhkarBtn') !== null ||
      settingsTarget.closest?.('[data-tab="more"]');
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
    const query = dom.searchInput?.value.trim() ?? '';
    if (query) {
      dom.searchBtn?.click();
    } else {
      dom.searchInput?.focus();
    }
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

  dom.qiblaBtn?.addEventListener('click', showQiblaCompass);
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

/**
 * Open the help/guide panel.
 */
function openHelp(): void {
  if (dom.helpPanel) {
    dom.helpPanel.classList.add('open');
  }
}

/**
 * Close the help/guide panel.
 */
function closeHelp(): void {
  if (dom.helpPanel) {
    dom.helpPanel.classList.remove('open');
  }
}

/**
 * Bind help panel events: open/close toggle, accordion sections, first-use auto-open.
 */
export function bindHelpEvents(): void {
  dom.helpToggleBtn?.addEventListener('click', openHelp);
  dom.helpCloseBtn?.addEventListener('click', closeHelp);

  // Close help when clicking outside
  document.addEventListener('click', (e: MouseEvent) => {
    const helpTarget = e.target as HTMLElement;
    const isHelpTrigger = helpTarget === dom.helpToggleBtn || helpTarget.closest?.('#helpToggleBtn') !== null;
    if (dom.helpPanel?.classList.contains('open') && !dom.helpPanel.contains(e.target as Node) && !isHelpTrigger) {
      closeHelp();
    }
  });

  // Accordion toggle for help sections
  dom.helpPanel?.addEventListener('click', (e: MouseEvent) => {
    const toggle = (e.target as HTMLElement).closest('.help-section-toggle') as HTMLElement | null;
    if (!toggle) {
      return;
    }
    const section = toggle.dataset['section'];
    if (!section) {
      return;
    }
    const content = dom.helpPanel?.querySelector(`.help-section-content[data-section="${section}"]`);
    if (content) {
      content.classList.toggle('open');
    }
    const icon = toggle.querySelector('.help-toggle-icon');
    if (icon) {
      icon.textContent = content?.classList.contains('open') ? '▲' : '▼';
    }
  });

  // Auto-open help on first use
  const seen = storage.get<boolean>('help_seen', false);
  if (!seen) {
    storage.set('help_seen', true);
    openHelp();
  }
}

/**
 * Register all application event bindings at once.
 */
export function bindAllEvents(): void {
  bindNavigationEvents();
  bindHeaderAndSettingsEvents();
  bindAzanEvents();
  bindTafsirEvents();
  bindDisplaySettingsEvents();
  bindPanelsAndShareEvents();
  bindSearchEvents();
  bindGlobalClickHandler();
  bindHeaderMenuEvents();
  bindMiscEvents();
  bindHelpEvents();
}
