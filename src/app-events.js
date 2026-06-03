/**
 * Event bindings extracted from app.js for maintainability.
 * All DOM event listeners are registered here, grouped by feature.
 */

import { CONFIG } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { state } from './state.js';
import { showToast } from './ui.js';
import { __, getLang, setLang, applyTranslations } from './i18n.js';
import {
  applyFontSize, toggleNightMode, toggleSepiaMode, applyFontType,
  applyLineSpacing, openSettings, closeSettings, saveLocationSettings,
  resetSettings, exportSettings, importSettings, applyBackground,
  initSettingsTabs
} from './settings.js';
import {
  togglePrayerBar, testAzan, stopAzan, hideQiblaCompass, hideAzanNotification
} from './prayer.js';
import {
  loadFavorites, toggleFavorite, openFavorites, closeFavorites,
  setBookmark, gotoBookmark
} from './favorites.js';
import { closeAdhkarPanel, toggleAdhkarPanel, wireAdhkarEvents } from './adhkar.js';
import { loadSurah } from './surah-loader.js';
import { performExactSearch, initKeyboard, initSearchAutocomplete, startVoiceSearch } from './search-ui.js';
import { updateReadingProgress, handleVisibilityChange, updateNetworkBanner, showWelcomeScreen, dismissWelcomeScreen } from './ui-extras.js';
import { showSleepTimerModal } from './sleep-timer-modal.js';
import { loadTajweedAnnotations } from './tajweed-data.js';
import { toggleShareMenu, shareNative, shareCopy, shareCopySimple, shareWhatsApp, shareTelegram } from './share.js';
import { toggleTafsir, loadTafsirForCurrentAyah } from './tafsir.js';
import * as audioModule from './audio.js';

/**
 * Bind surah/reciter selection and navigation controls.
 */
export function bindNavigationEvents() {
  dom.surahSelect?.addEventListener('change', () => {
    if (!dom.surahSelect.value) return;
    const surahNum = parseInt(dom.surahSelect.value, 10);
    if (state.mushafMode) {
      state.currentSurah = surahNum;
      fetch(`${CONFIG.API_BASE}/ayah/${surahNum}:1`)
        .then(res => res.json())
        .then(data => {
          const page = data?.data?.page || 1;
          if (dom.pageSelect) dom.pageSelect.value = page;
          if (dom.pageSlider) dom.pageSlider.value = page;
          import('./mushaf.js').then(m => m.loadPage(page, true)); // lazy: mushaf not in main chunk
        })
        .catch(() => showToast('تعذّر العثور على الصفحة', 'error'));
    } else {
      loadSurah(surahNum);
    }
  });

  dom.reciterSelect?.addEventListener('change', () => {
    state.currentReciter = dom.reciterSelect.value;
    storage.set('reciter', state.currentReciter);
    if (state.currentSurah) loadSurah(state.currentSurah);
  });
}

/**
 * Bind bookmark, favorite, theme, and settings buttons.
 */
export function bindHeaderAndSettingsEvents() {
  dom.bookmarkBtn?.addEventListener('click', setBookmark);
  dom.bookmarkBtn?.addEventListener('dblclick', gotoBookmark);
  dom.favoriteBtn?.addEventListener('click', toggleFavorite);
  dom.shareBtn?.addEventListener('click', () => toggleShareMenu());
  dom.themeToggle?.addEventListener('click', toggleNightMode);
  dom.settingsThemeToggle?.addEventListener('click', toggleNightMode);
  dom.settingsToggleBtn?.addEventListener('click', openSettings);
  dom.settingsCloseBtn?.addEventListener('click', closeSettings);
  dom.saveLocationBtn?.addEventListener('click', saveLocationSettings);
  dom.testAzanBtn?.addEventListener('click', testAzan);
  dom.azanNotifStopBtn?.addEventListener('click', stopAzan);
  dom.welcomeDismissBtn?.addEventListener('click', dismissWelcomeScreen);
  dom.resetSettingsBtn?.addEventListener('click', resetSettings);
  document.getElementById('exportSettingsBtn')?.addEventListener('click', () => exportSettings());
  document.getElementById('importSettingsBtn')?.addEventListener('click', () => importSettings());
  dom.bgSelect?.addEventListener('change', () => { applyBackground(dom.bgSelect.value); });
  initSettingsTabs();
}

/**
 * Bind azan notification and player events.
 */
export function bindAzanEvents() {
  dom.azanNotification?.addEventListener('click', (e) => {
    if (e.target === dom.azanNotification) stopAzan();
  });
  dom.azanPlayer?.addEventListener('ended', () => {
    state.azanPlaying = false;
    if (dom.testAzanBtn) dom.testAzanBtn.textContent = '\u25B6\uFE0F اختبار الأذان';
    hideAzanNotification();
  });
}

/**
 * Bind tafsir curtain and translation select.
 */
export function bindTafsirEvents() {
  dom.tafsirCurtainHandle?.addEventListener('click', () => toggleTafsir());
  dom.tafsirSelect?.addEventListener('change', () => {
    state.currentTafsirEdition = dom.tafsirSelect.value;
    storage.set('tafsir_edition', state.currentTafsirEdition);
    if (dom.tafsirCurtain?.classList.contains('open')) loadTafsirForCurrentAyah();
  });

  dom.translationSelect?.addEventListener('change', () => {
    const val = dom.translationSelect.value;
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
export function bindDisplaySettingsEvents() {
  dom.fontSizeSelect?.addEventListener('change', (e) => applyFontSize(parseInt(e.target.value, 10)));
  dom.fontTypeSelect?.addEventListener('change', (e) => applyFontType(e.target.value));
  dom.lineSpacingSelect?.addEventListener('change', (e) => applyLineSpacing(e.target.value));
  dom.sepiaToggle?.addEventListener('click', toggleSepiaMode);
  dom.tajweedToggle?.addEventListener('click', () => {
    state.tajweedEnabled = dom.tajweedToggle.classList.toggle('on');
    storage.set('tajweed_enabled', state.tajweedEnabled);
    const reload = () => { if (state.currentSurah) loadSurah(state.currentSurah); };
    if (state.tajweedEnabled) {
      loadTajweedAnnotations().then(reload);
    } else {
      reload();
    }
  });

  dom.azanToggle?.addEventListener('click', () => {
    state.azanEnabled = dom.azanToggle.classList.toggle('on');
    storage.set('azan_enabled', state.azanEnabled);
  });
  dom.azanFajrToggle?.addEventListener('click', () => {
    state.azanFajrEnabled = dom.azanFajrToggle.classList.toggle('on');
    storage.set('azan_fajr_enabled', state.azanFajrEnabled);
  });
  dom.autoSaveToggle?.addEventListener('click', () => {
    state.autoSave = dom.autoSaveToggle.classList.toggle('on');
    storage.set('auto_save', state.autoSave);
  });

  dom.langSelect?.addEventListener('change', () => {
    const newLang = dom.langSelect.value;
    if (newLang !== getLang()) {
      setLang(newLang);
      showToast(__('language') + ': ' + (newLang === 'ar' ? 'العربية' : 'English'), 'success');
    }
  });

  dom.cityQuickSelect?.addEventListener('change', () => {
    const v = dom.cityQuickSelect.value;
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
export function bindPanelsAndShareEvents() {
  dom.favoritesOpenBtn?.addEventListener('click', openFavorites);
  dom.favoritesCloseBtn?.addEventListener('click', closeFavorites);
  dom.collapseBarBtn?.addEventListener('click', togglePrayerBar);
  dom.expandBarBtn?.addEventListener('click', togglePrayerBar);

  document.querySelectorAll('[data-share="native"]').forEach(btn =>
    btn.addEventListener('click', () => { shareNative(); toggleShareMenu(); }));
  document.querySelectorAll('[data-share="copy"]').forEach(btn =>
    btn.addEventListener('click', () => { shareCopy(); toggleShareMenu(); }));
  document.querySelectorAll('[data-share="copy-simple"]').forEach(btn =>
    btn.addEventListener('click', () => { shareCopySimple(); toggleShareMenu(); }));
  document.querySelectorAll('[data-share="whatsapp"]').forEach(btn =>
    btn.addEventListener('click', () => { shareWhatsApp(); toggleShareMenu(); }));
  document.querySelectorAll('[data-share="telegram"]').forEach(btn =>
    btn.addEventListener('click', () => { shareTelegram(); toggleShareMenu(); }));
}

/**
 * Bind search controls.
 */
export function bindSearchEvents() {
  dom.searchBtn?.addEventListener('click', () => {
    const q = dom.searchInput?.value.trim();
    if (!q) return;
    performExactSearch(q);
  });
  dom.clearSearchBtn?.addEventListener('click', () => {
    if (dom.searchResults) dom.searchResults.style.display = 'none';
    if (dom.searchInput) dom.searchInput.value = '';
  });
  dom.searchInput?.addEventListener('keypress', e => { if (e.key === 'Enter') dom.searchBtn?.click(); });
  dom.voiceSearchBtn?.addEventListener('click', startVoiceSearch);
  dom.installBtn?.addEventListener('click', () => {
    if (typeof (/** @type {any} */ (window).installPWA) === 'function') (/** @type {any} */ (window)).installPWA();
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
export function bindGlobalClickHandler() {
  document.addEventListener('click', (e) => {
    if (!dom.shareMenu?.contains(e.target) && e.target !== dom.shareBtn) dom.shareMenu?.classList.remove('show');
    if (dom.headerDropdown && dom.headerMenuBtn && !dom.headerMenuBtn.contains(e.target) && !dom.headerDropdown.contains(e.target)) {
      dom.headerDropdown.style.display = 'none';
    }
    const settingsTarget = /** @type {HTMLElement} */ (e.target);
    const isSettingsTrigger = settingsTarget === dom.settingsToggleBtn || settingsTarget === document.getElementById('headerSettingsBtn') || settingsTarget.closest?.('[data-tab="more"]');
    if (dom.settingsPanel?.classList.contains('open') && !dom.settingsPanel.contains(e.target) && !isSettingsTrigger) closeSettings();
    if (dom.favoritesPanel?.classList.contains('open') && !dom.favoritesPanel.contains(e.target) && e.target !== dom.favoritesOpenBtn) closeFavorites();
    if (dom.adhkarPanel?.classList.contains('open') && !dom.adhkarPanel.contains(e.target) && e.target !== dom.adhkarBtn) closeAdhkarPanel();
  });
}

/**
 * Bind header menu dropdown buttons.
 */
export function bindHeaderMenuEvents() {
  dom.headerMenuBtn?.addEventListener('click', () => {
    if (dom.headerDropdown) dom.headerDropdown.style.display = dom.headerDropdown.style.display === 'none' ? '' : 'none';
  });
  document.getElementById('headerFavBtn')?.addEventListener('click', () => {
    openFavorites();
    if (dom.headerDropdown) dom.headerDropdown.style.display = 'none';
  });
  document.getElementById('headerAdhkarBtn')?.addEventListener('click', () => {
    toggleAdhkarPanel();
    if (dom.headerDropdown) dom.headerDropdown.style.display = 'none';
  });
  document.getElementById('headerSettingsBtn')?.addEventListener('click', () => {
    openSettings();
    if (dom.headerDropdown) dom.headerDropdown.style.display = 'none';
  });
}

/**
 * Bind search toggle, mushaf overlay, adhkar, qibla, reading stats.
 */
export function bindMiscEvents() {
  dom.searchToggleBtn?.addEventListener('click', () => {
    if (dom.searchInputGroup) {
      dom.searchInputGroup.style.display = dom.searchInputGroup.style.display === 'none' ? '' : 'none';
    }
    if (dom.searchToggleBtn) dom.searchToggleBtn.classList.toggle('active');
    if (dom.searchInputGroup?.style.display !== 'none') dom.searchInput?.focus();
  });

  dom.mushafSurahOverlayClose?.addEventListener('click', () => { if (dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.mushafSurahOverlay?.addEventListener('click', (e) => { if (e.target === dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.surahSecretsCloseBtn?.addEventListener('click', () => { if (dom.surahSecretsOverlay) dom.surahSecretsOverlay.style.display = 'none'; });
  dom.surahSecretsOverlay?.addEventListener('click', (e) => { if (e.target === dom.surahSecretsOverlay) dom.surahSecretsOverlay.style.display = 'none'; });

  wireAdhkarEvents();

  dom.qiblaCloseBtn?.addEventListener('click', hideQiblaCompass);
  dom.qiblaOverlay?.addEventListener('click', (e) => { if (e.target === dom.qiblaOverlay) hideQiblaCompass(); });

  dom.readingStatsCloseBtn?.addEventListener('click', () => {
    if (dom.readingStatsPanel) dom.readingStatsPanel.style.display = 'none';
  });
}

/**
 * Register all application event bindings at once.
 */
export function bindAllEvents() {
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
