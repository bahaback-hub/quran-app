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
  toggleNightMode,
  applyTheme,
  applyFontType,
  applyLineSpacing,
  openSettings,
  closeSettings,
  saveLocationSettings,
  resetSettings,
  exportSettings,
  importSettings,
  initSettingsTabs,
} from './settings.js';
import { togglePrayerBar, testAzan, stopAzan, hideQiblaCompass, hideAzanNotification } from './prayer.js';
import {
  loadFavorites,
  toggleFavorite,
  openFavorites,
  closeFavorites,
  setBookmark,
  gotoBookmark,
} from './favorites.js';
import { closeAdhkarPanel, toggleAdhkarPanel, wireAdhkarEvents } from './adhkar.js';
import { loadSurah } from './surah-loader.js';
import { performExactSearch, initKeyboard, initSearchAutocomplete, startVoiceSearch } from './search-ui.js';
import { showSleepTimerModal } from './sleep-timer-modal.js';
import { loadTajweedAnnotations } from './tajweed-data.js';
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
    if (!dom.surahSelect!.value) return;
    const surahNum = parseInt(dom.surahSelect!.value, 10);
    if (state.mushafMode) {
      state.currentSurah = surahNum;
      fetch(`${CONFIG.API_BASE}/ayah/${surahNum}:1`)
        .then((res) => res.json())
        .then((data: AyahPageResponse) => {
          const page = data?.data?.page || 1;
          if (dom.pageSelect) dom.pageSelect.value = String(page);
          if (dom.pageSlider) dom.pageSlider.value = String(page);
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
    if (state.currentSurah) loadSurah(state.currentSurah);
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
    if (btn?.dataset.theme) {
      e.preventDefault();
      applyTheme(btn.dataset.theme as 'light' | 'sepia' | 'night');
    }
  });
  dom.themeToggle?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleNightMode();
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
  initSettingsTabs();
}

/**
 * Bind azan notification and player events.
 */
export function bindAzanEvents(): void {
  dom.azanNotification?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.azanNotification) stopAzan();
  });
  dom.azanPlayer?.addEventListener('ended', () => {
    state.azanPlaying = false;
    if (dom.testAzanBtn) dom.testAzanBtn.textContent = __('test_azan');
    hideAzanNotification();
  });
}

/**
 * Bind tafsir curtain and translation select.
 */
export function bindTafsirEvents(): void {
  dom.tafsirCurtainHandle?.addEventListener('click', () => toggleTafsir());
  dom.tafsirSelect?.addEventListener('change', () => {
    state.currentTafsirEdition = dom.tafsirSelect!.value;
    storage.set('tafsir_edition', state.currentTafsirEdition);
    if (dom.tafsirCurtain?.classList.contains('open')) loadTafsirForCurrentAyah();
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
    if (state.currentSurah) loadSurah(state.currentSurah);
  });
}

/**
 * Bind display settings: font size, type, spacing, sepia, tajweed, toggles.
 */
export function bindDisplaySettingsEvents(): void {
  dom.fontSizeSelect?.addEventListener('change', (e: Event) =>
    applyFontSize(parseInt((e.target as HTMLSelectElement).value, 10))
  );
  dom.fontTypeSelect?.addEventListener('change', (e: Event) => applyFontType((e.target as HTMLSelectElement).value));
  dom.lineSpacingSelect?.addEventListener('change', (e: Event) =>
    applyLineSpacing((e.target as HTMLSelectElement).value)
  );
  dom.tajweedToggle?.addEventListener('click', () => {
    state.tajweedEnabled = dom.tajweedToggle!.classList.toggle('on');
    storage.set('tajweed_enabled', state.tajweedEnabled);
    const reload = () => {
      if (state.currentSurah) loadSurah(state.currentSurah);
    };
    if (state.tajweedEnabled) {
      loadTajweedAnnotations().then(reload);
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
          'success'
        );
      });
    }
  });

  dom.cityQuickSelect?.addEventListener('change', () => {
    const v = dom.cityQuickSelect!.value;
    if (v) {
      const [city, country] = v.split('|');
      if (dom.cityInput) dom.cityInput.value = city;
      if (dom.countryInput) dom.countryInput.value = country;
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
    })
  );
  document.querySelectorAll('[data-share="copy"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      shareCopy();
      toggleShareMenu();
    })
  );
  document.querySelectorAll('[data-share="copy-simple"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      shareCopySimple();
      toggleShareMenu();
    })
  );
  document.querySelectorAll('[data-share="whatsapp"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      shareWhatsApp();
      toggleShareMenu();
    })
  );
  document.querySelectorAll('[data-share="telegram"]').forEach((btn) =>
    btn.addEventListener('click', () => {
      shareTelegram();
      toggleShareMenu();
    })
  );
}

/**
 * Bind search controls.
 */
export function bindSearchEvents(): void {
  dom.searchBtn?.addEventListener('click', () => {
    const q = dom.searchInput?.value.trim();
    if (!q) return;
    performExactSearch(q);
  });
  dom.searchInput?.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') dom.searchBtn?.click();
  });
  dom.voiceSearchBtn?.addEventListener('click', startVoiceSearch);
  dom.installBtn?.addEventListener('click', () => {
    if (typeof (window as unknown as { installPWA?: () => void }).installPWA === 'function')
      (window as unknown as { installPWA: () => void }).installPWA();
  });
  dom.sleepTimerBtn?.addEventListener('click', () => {
    showSleepTimerModal(audioModule);
  });
  initKeyboard();
  initSearchAutocomplete();
}

/**
 * Bind global document click handler for auto-closing overlays.
 */
export function bindGlobalClickHandler(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    if (!dom.shareMenu?.contains(e.target as Node) && e.target !== dom.shareBtn)
      dom.shareMenu?.classList.remove('show');
    const settingsTarget = e.target as HTMLElement;
    const isSettingsTrigger =
      settingsTarget === dom.settingsToggleBtn ||
      settingsTarget.closest?.('#settingsToggleBtn') !== null ||
      settingsTarget.closest?.('[data-tab="more"]');
    if (
      dom.settingsPanel?.classList.contains('open') &&
      !dom.settingsPanel.contains(e.target as Node) &&
      !isSettingsTrigger
    )
      closeSettings();
    if (
      dom.favoritesPanel?.classList.contains('open') &&
      !dom.favoritesPanel.contains(e.target as Node) &&
      e.target !== dom.favoritesOpenBtn
    )
      closeFavorites();
    if (
      dom.adhkarPanel?.classList.contains('open') &&
      !dom.adhkarPanel.contains(e.target as Node) &&
      e.target !== dom.adhkarBtn
    )
      closeAdhkarPanel();
  });
}

/** No-op: header menu dropdown removed. */
export function bindHeaderMenuEvents(): void {
  // dropdown removed
}

/**
 * Bind search toggle, mushaf overlay, adhkar, qibla, reading stats.
 */
export function bindMiscEvents(): void {
  dom.searchToggleBtn?.addEventListener('click', () => {
    if (dom.searchInputGroup) {
      dom.searchInputGroup.classList.toggle('hidden');
    }
    if (dom.searchToggleBtn) dom.searchToggleBtn.classList.toggle('active');
    if (dom.searchInputGroup?.classList.contains('hidden') === false) dom.searchInput?.focus();
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

  dom.qiblaCloseBtn?.addEventListener('click', hideQiblaCompass);
  dom.qiblaOverlay?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.qiblaOverlay) hideQiblaCompass();
  });

  dom.readingStatsCloseBtn?.addEventListener('click', () => {
    if (dom.readingStatsPanel) {
      dom.readingStatsPanel.classList.add('hidden');
      dom.readingStatsPanel.style.display = 'none';
    }
  });
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
}
