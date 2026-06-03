import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom, cacheDom } from './dom.js';
import { showToast, loadingBar } from './ui.js';
import { __, getLang, setLang, applyTranslations } from './i18n.js';
import { state } from './state.js';
import { startClock, stopClock, loadPrayerTimes, stopAzan, testAzan, scheduleNextAzanCheck, checkAzanTime, togglePrayerBar, hideAzanNotification, showQiblaCompass, hideQiblaCompass } from './prayer.js';
import { loadFavorites, toggleFavorite, openFavorites, closeFavorites, setBookmark, gotoBookmark } from './favorites.js';
import { toggleSelectMode, clearSelection, shareSelected, handleAyahSelect } from './select-mode.js';
import { toggleTafsir, closeTafsir, loadTafsirForCurrentAyah } from './tafsir.js';
import { toggleShareMenu, shareNative, shareCopy, shareCopySimple, shareWhatsApp, shareTelegram } from './share.js';
import { applyFontSize, toggleNightMode, applySepiaMode, toggleSepiaMode, applyFontType, applyLineSpacing, openSettings, closeSettings, saveLocationSettings, resetSettings, applyBackground, loadBackgrounds, restoreSettings, initSettingsTabs } from './settings.js';
import { initAdhkarState, loadAdhkarSettings, checkAdhkarNotifications, wireAdhkarEvents, toggleAdhkarPanel, closeAdhkarPanel } from './adhkar.js';
import { bindAudioEvents, setLoadSurah, nextAyah, prevAyah } from './audio.js';
import { loadFullQuranText, performExactSearch, startVoiceSearch, initKeyboard, initSearchAutocomplete } from './search-ui.js';
import { recordReadingSession, renderReadingStats } from './reading-stats.js';
import { initKeyboardShortcuts } from './keyboard.js';
import { initCapacitorBackButton } from './capacitor-back.js';
import { initNavigation } from './navigation.js';
import {
  loadSurah, loadSurahList, buildSurahOffsets, populateReciterSelect, toggleTranslation
} from './surah-loader.js';
import {
  showContinueWidget, showWelcomeScreen, dismissWelcomeScreen,
  handleVisibilityChange, updateNetworkBanner, updateReadingProgress
} from './ui-extras.js';

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

  /* ========== EVENT BINDINGS ========== */

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
          import('./mushaf.js').then(m => m.loadPage(page, true));
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

  dom.bookmarkBtn?.addEventListener('click', setBookmark);
  dom.bookmarkBtn?.addEventListener('dblclick', gotoBookmark);
  dom.favoriteBtn?.addEventListener('click', toggleFavorite);
  dom.shareBtn?.addEventListener('click', () => import('./share.js').then(m => m.toggleShareMenu()));
  dom.themeToggle?.addEventListener('click', toggleNightMode);
  dom.settingsThemeToggle?.addEventListener('click', toggleNightMode);
  dom.settingsToggleBtn?.addEventListener('click', openSettings);
  dom.settingsCloseBtn?.addEventListener('click', closeSettings);
  dom.saveLocationBtn?.addEventListener('click', saveLocationSettings);
  dom.testAzanBtn?.addEventListener('click', testAzan);
  dom.azanNotifStopBtn?.addEventListener('click', stopAzan);
  dom.welcomeDismissBtn?.addEventListener('click', dismissWelcomeScreen);
  dom.azanNotification?.addEventListener('click', (e) => {
    if (e.target === dom.azanNotification) stopAzan();
  });
  dom.azanPlayer?.addEventListener('ended', () => {
    state.azanPlaying = false;
    if (dom.testAzanBtn) dom.testAzanBtn.textContent = '▶️ اختبار الأذان';
    hideAzanNotification();
  });
  dom.resetSettingsBtn?.addEventListener('click', resetSettings);
  dom.bgSelect?.addEventListener('change', () => { applyBackground(dom.bgSelect.value); });
  initSettingsTabs();

  dom.tafsirCurtainHandle?.addEventListener('click', () => import('./tafsir.js').then(m => m.toggleTafsir()));
  dom.tafsirSelect?.addEventListener('change', () => {
    state.currentTafsirEdition = dom.tafsirSelect.value;
    storage.set('tafsir_edition', state.currentTafsirEdition);
    if (dom.tafsirCurtain?.classList.contains('open')) import('./tafsir.js').then(m => m.loadTafsirForCurrentAyah());
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

  dom.fontSizeSelect?.addEventListener('change', (e) => applyFontSize(parseInt(e.target.value, 10)));
  dom.fontTypeSelect?.addEventListener('change', (e) => applyFontType(e.target.value));
  dom.lineSpacingSelect?.addEventListener('change', (e) => applyLineSpacing(e.target.value));
  dom.sepiaToggle?.addEventListener('click', toggleSepiaMode);
  dom.tajweedToggle?.addEventListener('click', () => {
    state.tajweedEnabled = dom.tajweedToggle.classList.toggle('on');
    storage.set('tajweed_enabled', state.tajweedEnabled);
    if (state.currentSurah) import('./surah-loader.js').then(m => m.loadSurah(state.currentSurah));
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

  dom.favoritesOpenBtn?.addEventListener('click', openFavorites);
  dom.favoritesCloseBtn?.addEventListener('click', closeFavorites);
  dom.collapseBarBtn?.addEventListener('click', togglePrayerBar);
  dom.expandBarBtn?.addEventListener('click', togglePrayerBar);

  document.querySelectorAll('[data-share="native"]').forEach(btn => btn.addEventListener('click', () => { import('./share.js').then(m => { m.shareNative(); m.toggleShareMenu(); }); }));
  document.querySelectorAll('[data-share="copy"]').forEach(btn => btn.addEventListener('click', () => { import('./share.js').then(m => { m.shareCopy(); m.toggleShareMenu(); }); }));
  document.querySelectorAll('[data-share="copy-simple"]').forEach(btn => btn.addEventListener('click', () => { import('./share.js').then(m => { m.shareCopySimple(); m.toggleShareMenu(); }); }));
  document.querySelectorAll('[data-share="whatsapp"]').forEach(btn => btn.addEventListener('click', () => { import('./share.js').then(m => { m.shareWhatsApp(); m.toggleShareMenu(); }); }));
  document.querySelectorAll('[data-share="telegram"]').forEach(btn => btn.addEventListener('click', () => { import('./share.js').then(m => { m.shareTelegram(); m.toggleShareMenu(); }); }));

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
  dom.installBtn?.addEventListener('click', () => {     if (typeof (/** @type {any} */ (window).installPWA) === 'function') (/** @type {any} */ (window)).installPWA(); });
  dom.sleepTimerBtn?.addEventListener('click', () => {
    import('./audio.js').then(m => {
      const mins = parseInt(prompt('⏰ مؤقت النوم — كم دقيقة؟', '15'), 10);
      if (mins > 0) m.setSleepTimer(mins);
    });
  });
  initKeyboard();
  initSearchAutocomplete();

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

  /* ========== HEADER MENU ========== */
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

  /* ========== SEARCH TOGGLE ========== */
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

  /* ========== ADHKAR ========== */
  wireAdhkarEvents();

  /* ========== QIBLA COMPASS ========== */
  dom.qiblaCloseBtn?.addEventListener('click', hideQiblaCompass);
  dom.qiblaOverlay?.addEventListener('click', (e) => { if (e.target === dom.qiblaOverlay) hideQiblaCompass(); });

  /* ========== READING STATS ========== */
  dom.readingStatsCloseBtn?.addEventListener('click', () => {
    if (dom.readingStatsPanel) dom.readingStatsPanel.style.display = 'none';
  });
  renderReadingStats(dom.readingStatsContent);

  initNavigation();
  initKeyboardShortcuts();
  initCapacitorBackButton();

  // Set language selector to current language
  if (dom.langSelect) dom.langSelect.value = getLang();

  // Listen for language changes to update UI text
  window.addEventListener('languagechange', () => {
    applyTranslations();
    const hint = document.getElementById('keyboardHint');
    if (hint) hint.textContent = __('keyboard_hint');
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
    loadBackgrounds().catch(console.warn);
    checkAdhkarNotifications();
    if (!state.adhkarIntervalId) state.adhkarIntervalId = setInterval(checkAdhkarNotifications, 15000);
    import('./ayah-modal.js').then(m => m.initAyahModal()).catch(() => {});
    import('./presentation.js').then(m => m.initPresentation()).catch(() => {});
    import('./mushaf.js').then(m => m.populateSurahOverlay()).catch(() => {});
    if (navigator.onLine) fullQuranPromise;
  }, 0);
}
