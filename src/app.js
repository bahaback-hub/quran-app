import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom, cacheDom } from './dom.js';
import { showToast, loadingBar } from './ui.js';
import { __, getLang, setLang } from './i18n.js';
import { state } from './state.js';
import { startClock, stopClock, loadPrayerTimes, stopAzan, testAzan, scheduleNextAzanCheck, checkAzanTime, togglePrayerBar, hideAzanNotification, showQiblaCompass, hideQiblaCompass } from './prayer.js';
import { loadFavorites, toggleFavorite, openFavorites, closeFavorites, setBookmark, gotoBookmark } from './favorites.js';
import { toggleTafsir, closeTafsir, loadTafsirForCurrentAyah } from './tafsir.js';
import { toggleShareMenu, shareNative, shareCopy, shareCopySimple, shareWhatsApp, shareTelegram } from './share.js';
import { applyFontSize, toggleNightMode, openSettings, closeSettings, saveLocationSettings, resetSettings, applyBackground, loadBackgrounds, restoreSettings } from './settings.js';
import { initAdhkarState, loadAdhkarSettings, checkAdhkarNotifications, wireAdhkarEvents, toggleAdhkarPanel } from './adhkar.js';
import { togglePlayPause, nextAyah, prevAyah, nextSurah, prevSurah, toggleHifdh, toggleRepeat, bindAudioEvents, setLoadSurah, expandPlayer, updatePlayPauseBtn } from './audio.js';
import { loadFullQuranText, performExactSearch, startVoiceSearch, initKeyboard, initSearchAutocomplete } from './search.js';
import { openPresentation, closePresentation, initPresentation } from './presentation.js';
import { recordReadingSession, renderReadingStats } from './reading-stats.js';
import {
  loadSurah, loadSurahList, buildSurahOffsets, populateReciterSelect, toggleTranslation
} from './surah-loader.js';

export { loadSurah, renderSurah, highlightCurrentAyah, updatePlayerInfo, buildSurahOffsets, loadSurahList } from './surah-loader.js';

/* Continue Reading Widget Styles - injected once */
const CONTINUE_WIDGET_STYLES_ID = 'continue-widget-styles';
function injectContinueWidgetStyles() {
  if (document.getElementById(CONTINUE_WIDGET_STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = CONTINUE_WIDGET_STYLES_ID;
  style.textContent = `
    .continue-widget {
      position: fixed; bottom: 110px; left: 50%; transform: translateX(-50%);
      background: linear-gradient(135deg, #8b6f5a, #a0846c);
      color: #fff; padding: 12px 24px; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 3000;
      display: flex; align-items: center; gap: 12px;
      font-family: 'Amiri', 'Traditional Arabic', serif;
      direction: rtl; cursor: pointer;
      animation: slideUp 0.4s ease;
      border: 1px solid rgba(255,255,255,0.2);
      max-width: 90vw;
    }
    .continue-widget:hover { transform: translateX(-50%) translateY(-2px); }
    .continue-widget-close {
      background: rgba(255,255,255,0.2); border: none; color: #fff;
      width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
      font-size: 14px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background 0.2s;
    }
    .continue-widget-close:hover { background: rgba(255,255,255,0.4); }
    .continue-widget-text { font-size: 15px; line-height: 1.5; }
    .continue-widget-text strong { color: #ffe066; }
    .continue-widget-icon { font-size: 24px; flex-shrink: 0; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(30px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    body.night-mode .continue-widget {
      background: linear-gradient(135deg, #1a1f2e, #232838);
      border-color: #5a4a3a;
    }
  `;
  document.head.appendChild(style);
}

function showContinueWidget(info) {
  injectContinueWidgetStyles();
  const existing = document.getElementById('continueWidget');
  if (existing) existing.remove();

  const widget = document.createElement('div');
  widget.id = 'continueWidget';
  widget.className = 'continue-widget';

  const icon = document.createElement('span');
  icon.className = 'continue-widget-icon';
  icon.textContent = '📖';

  const text = document.createElement('span');
  text.className = 'continue-widget-text';
  const dateStr = info.timestamp ? new Date(info.timestamp).toLocaleDateString('ar-SA') : '';
  const strong = document.createElement('strong');
  strong.textContent = info.surahName;
  const small = document.createElement('small');
  small.style.opacity = '0.7';
  small.textContent = `آخر زيارة: ${dateStr}`;
  text.append('📖 ', strong, ` — آية ${info.ayahNumberInSurah}`, document.createElement('br'), small);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'continue-widget-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'إغلاق');

  widget.appendChild(icon);
  widget.appendChild(text);
  widget.appendChild(closeBtn);

  widget.addEventListener('click', (e) => {
    if (e.target === closeBtn || closeBtn.contains(/** @type {Node} */ (e.target))) {
      widget.remove();
      return;
    }
    widget.remove();
    if (dom.surahSelect) dom.surahSelect.value = info.surah;
    loadSurah(info.surah, { startAyah: info.ayahNumberInSurah || 1 });
  });

  document.body.appendChild(widget);

  setTimeout(() => {
    const w = document.getElementById('continueWidget');
    if (w) w.remove();
  }, 8000);
}

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
    adhkarSettings: null, adhkarPanelOpen: false, adhkarActiveTab: null, lastAdhkarFired: null,
    surahOffsets: null,
    backgroundsList: null,
    ayahTimings: [],
    presentationMode: false
  });
}

/* ===================== WELCOME SCREEN ===================== */

function showWelcomeScreen() {
  if (!dom.welcomeScreen) return;
  const dismissed = storage.get('welcome_dismissed');
  if (dismissed) return;
  dom.welcomeScreen.style.display = 'flex';
}

function dismissWelcomeScreen() {
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
  storage.set('welcome_dismissed', true);
}

/* ===================== VISIBILITY ===================== */

function handleVisibilityChange() {
  if (document.hidden) {
    stopClock();
    clearInterval(state.adhkarIntervalId);
  } else {
    startClock();
    state.adhkarIntervalId = setInterval(checkAdhkarNotifications, 15000);
  }
}

/* ===================== INIT ===================== */

/** Initialize the application: load state, data, bind events. */
export async function initApp() {
  initState();
  setLoadSurah(loadSurah);
  loadingBar.init();
  loadingBar.hide();
  cacheDom();
  initAdhkarState();
  loadAdhkarSettings();
  restoreSettings();
  populateReciterSelect();
  loadFavorites();
  startClock();
  import('./ayah-modal.js').then(m => m.initAyahModal()).catch(() => {});
  initPresentation();

  checkAzanTime();
  scheduleNextAzanCheck();

  await loadSurahList();
  buildSurahOffsets();
  import('./mushaf.js').then(m => m.populateSurahOverlay()).catch(() => {});

  // Load full Quran text into IndexedDB FIRST for offline fallback
  await loadFullQuranText().catch(console.warn);

  const last = storage.get('last_position');
  if (last && last.surah) {
    state.currentSurah = last.surah;
    await loadSurah(last.surah, { startAyah: last.ayahNumberInSurah || 1 });
    setTimeout(() => showContinueWidget(last), 1200);
  } else {
    await loadSurah(1);
  }

  loadPrayerTimes();
  loadBackgrounds().catch(console.warn);

  bindAudioEvents();

  checkAdhkarNotifications();
  state.adhkarIntervalId = setInterval(checkAdhkarNotifications, 15000);

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

  dom.prevAyahBtn?.addEventListener('click', prevAyah);
  dom.nextAyahBtn?.addEventListener('click', () => nextAyah());
  dom.prevSurahBtn?.addEventListener('click', prevSurah);
  dom.nextSurahBtn?.addEventListener('click', nextSurah);
  dom.hifdhBtn?.addEventListener('click', toggleHifdh);
  dom.repeatBtn?.addEventListener('click', toggleRepeat);
  dom.bookmarkBtn?.addEventListener('click', setBookmark);
  dom.bookmarkBtn?.addEventListener('dblclick', gotoBookmark);
  dom.favoriteBtn?.addEventListener('click', toggleFavorite);
  dom.shareBtn?.addEventListener('click', toggleShareMenu);
  dom.themeToggle?.addEventListener('click', toggleNightMode);
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

  dom.collapsePlayerBtn?.addEventListener('click', () => {
    dom.player?.classList.add('collapsed');
    storage.set('player_collapsed', true);
  });
  dom.collapsedExpandBtn?.addEventListener('click', () => expandPlayer());
  dom.collapsedContent?.addEventListener('click', (e) => {
     if (/** @type {HTMLElement} */ (e.target).closest('#collapsedPlayBtn')) return;
    expandPlayer();
  });
  dom.playPauseBtn?.addEventListener('click', () => { togglePlayPause(); updatePlayPauseBtn(); });
  dom.collapsedPlayBtn?.addEventListener('click', () => { togglePlayPause(); updatePlayPauseBtn(); });

  dom.playerMoreBtn?.addEventListener('click', () => {
    if (dom.playerMoreRow) dom.playerMoreRow.style.display = dom.playerMoreRow.style.display === 'none' ? '' : 'none';
  });

  dom.speedSelect?.addEventListener('change', () => {
    const rate = parseFloat(dom.speedSelect.value);
    if (dom.audioPlayer) dom.audioPlayer.playbackRate = rate;
    storage.set('playback_speed', rate);
  });

  dom.tafsirCurtainHandle?.addEventListener('click', toggleTafsir);
  dom.tafsirSelect?.addEventListener('change', () => {
    state.currentTafsirEdition = dom.tafsirSelect.value;
    storage.set('tafsir_edition', state.currentTafsirEdition);
    if (dom.tafsirCurtain?.classList.contains('open')) loadTafsirForCurrentAyah();
  });

  dom.translationToggle?.addEventListener('click', toggleTranslation);
  dom.translationSelect?.addEventListener('change', () => {
    state.currentTranslation = dom.translationSelect.value;
    storage.set('translation_edition', state.currentTranslation);
    if (state.currentSurah) loadSurah(state.currentSurah);
  });

  dom.fontSizeSelect?.addEventListener('change', (e) => applyFontSize(parseInt(e.target.value, 10)));

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

  document.querySelectorAll('[data-share="native"]').forEach(btn => btn.addEventListener('click', () => { shareNative(); toggleShareMenu(); }));
  document.querySelectorAll('[data-share="copy"]').forEach(btn => btn.addEventListener('click', () => { shareCopy(); toggleShareMenu(); }));
  document.querySelectorAll('[data-share="copy-simple"]').forEach(btn => btn.addEventListener('click', () => { shareCopySimple(); toggleShareMenu(); }));
  document.querySelectorAll('[data-share="whatsapp"]').forEach(btn => btn.addEventListener('click', () => { shareWhatsApp(); toggleShareMenu(); }));
  document.querySelectorAll('[data-share="telegram"]').forEach(btn => btn.addEventListener('click', () => { shareTelegram(); toggleShareMenu(); }));

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
  initKeyboard();
  initSearchAutocomplete();

  document.addEventListener('click', (e) => {
    if (!dom.shareMenu?.contains(e.target) && e.target !== dom.shareBtn) dom.shareMenu?.classList.remove('show');
    if (dom.headerDropdown && dom.headerMenuBtn && !dom.headerMenuBtn.contains(e.target) && !dom.headerDropdown.contains(e.target)) {
      dom.headerDropdown.style.display = 'none';
    }
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

  /* ========== VIEW MODE TOGGLE ========== */
  dom.viewSurahBtn?.addEventListener('click', () => {
    closePresentation();
    if (state.mushafMode) import('./mushaf.js').then(m => m.toggleMushafMode());
    document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'surah'));
    if (dom.surahModeControls) dom.surahModeControls.style.display = '';
    if (dom.pageSelect) dom.pageSelect.style.display = 'none';
    if (dom.pageSlider) dom.pageSlider.style.display = 'none';
    if (dom.pageIndicator) dom.pageIndicator.style.display = 'none';
  });
  dom.viewMushafBtn?.addEventListener('click', () => {
    closePresentation();
    import('./mushaf.js').then(m => m.toggleMushafMode());
  });
  dom.viewPresBtn?.addEventListener('click', () => {
    if (state.mushafMode) import('./mushaf.js').then(m => m.toggleMushafMode());
    openPresentation();
  });

  dom.pageSelect?.addEventListener('change', () => {
    if (dom.pageSelect.value) { const p = parseInt(dom.pageSelect.value, 10); if (dom.pageSlider) dom.pageSlider.value = p; import('./mushaf.js').then(m => m.loadPage(p, true)); }
  });
  dom.mushafSurahOverlayClose?.addEventListener('click', () => { if (dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.mushafSurahOverlay?.addEventListener('click', (e) => { if (e.target === dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.surahSecretsCloseBtn?.addEventListener('click', () => { if (dom.surahSecretsOverlay) dom.surahSecretsOverlay.style.display = 'none'; });
  dom.surahSecretsOverlay?.addEventListener('click', (e) => { if (e.target === dom.surahSecretsOverlay) dom.surahSecretsOverlay.style.display = 'none'; });

  /* ========== BOTTOM NAV (جوال/تابلت) ========== */
  const bottomNav = document.getElementById('bottomNav');
  let activeTab = 'quran';

  function activateTab(tab) {
    if (!bottomNav) return;
    activeTab = tab;
    bottomNav.querySelectorAll('.bottom-nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
  }

  bottomNav?.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement} */ (e.target).closest('.bottom-nav-btn');
    if (!btn) return;
    const tab = btn.dataset.tab;
    if (tab === activeTab && tab !== 'player') { activateTab(tab); return; }
    activateTab(tab);

    switch (tab) {
      case 'quran':
        dom.surahContent?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        dom.controls?.classList.remove('mobile-show');
        break;
      case 'player':
        expandPlayer();
        dom.player?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        dom.controls?.classList.remove('mobile-show');
        break;
      case 'controls':
        dom.controls?.classList.toggle('mobile-show');
        break;
      case 'search':
        dom.searchInput?.focus();
        dom.searchInput?.select();
        if (dom.controls) {
          dom.controls.style.display = '';
          dom.controls.classList.add('mobile-show');
        }
        break;
      case 'more':
        openSettings();
        dom.controls?.classList.remove('mobile-show');
        break;
    }
  });

  dom.pageSlider?.addEventListener('input', () => {
    const p = parseInt(dom.pageSlider.value, 10);
    if (dom.pageSelect) dom.pageSelect.value = p;
    import('./mushaf.js').then(m => m.loadPage(p, true));
  });

  // Restore mushaf mode
  const savedMushaf = storage.get('mushaf_mode');
  const savedPage = storage.get('current_page');
  if (savedPage) state.currentPage = savedPage;
  if (savedMushaf) import('./mushaf.js').then(m => m.toggleMushafMode());

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

  /* ========== KEYBOARD SHORTCUTS ========== */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.azanPlaying) { stopAzan(); return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        e.target.blur();
        dom.searchResults ? dom.searchResults.style.display = 'none' : null;
      }
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        dom.searchInput?.focus();
        dom.searchInput?.select();
      }
      return;
    }
    switch (e.key) {
      case ' ': e.preventDefault(); togglePlayPause(); break;
      case 'ArrowLeft': prevAyah(); break;
      case 'ArrowRight': nextAyah(false); break;
      case 's': case 'S': prevSurah(); break;
      case 'd': case 'D': nextSurah(); break;
      case 'h': case 'H': toggleHifdh(); break;
      case 'r': case 'R': toggleRepeat(); break;
      case 'b': case 'B': setBookmark(); break;
      case 'f': case 'F': toggleFavorite(); break;
      case 't': case 'T': toggleTafsir(); break;
      case 'n': case 'N': toggleNightMode(); break;
      case 'm': case 'M': import('./mushaf.js').then(m => m.toggleMushafMode()); break;
      case 'p': case 'P':
        if (state.presentationMode) { closePresentation(); } else { openPresentation(); }
        break;
      case 'g': case 'G': gotoBookmark(); break;
      case '+': case '=': applyFontSize(Math.min(45, state.fontSize + 2)); break;
      case '-': applyFontSize(Math.max(16, state.fontSize - 2)); break;
      case '0': applyFontSize(28); break;
      case 'Escape':
        closeSettings(); closeFavorites();
        if (dom.surahSecretsOverlay) dom.surahSecretsOverlay.style.display = 'none';
        if (dom.searchResults) dom.searchResults.style.display = 'none';
        if (dom.shareMenu) dom.shareMenu.classList.remove('show');
        closeTafsir();
        if (dom.player && !dom.player.classList.contains('collapsed')) {
          dom.player.classList.add('collapsed');
          storage.set('player_collapsed', true);
        }
        break;
    }
  });

  // Set language selector to current language
  if (dom.langSelect) dom.langSelect.value = getLang();

  // Listen for language changes to update UI text
  window.addEventListener('languagechange', () => {
    const hint = document.getElementById('keyboardHint');
    if (hint) hint.textContent = __('keyboard_hint');
    const loadHint = document.getElementById('surahSelectHint');
    if (loadHint) loadHint.textContent = __('select_hint');
  });

  // Restore player state
  const savedPlayerCollapsed = storage.get('player_collapsed');
  if (savedPlayerCollapsed === false && dom.player) dom.player.classList.remove('collapsed');

  // Show welcome screen on first visit
  showWelcomeScreen();

  // Network state banner
  function updateNetworkBanner() {
    if (!dom.networkBanner) return;
    if (!navigator.onLine) {
      dom.networkBanner.classList.add('show');
      dom.networkBanner.classList.remove('online');
    } else {
      dom.networkBanner.classList.remove('show');
    }
  }
  window.addEventListener('online', updateNetworkBanner);
  window.addEventListener('offline', updateNetworkBanner);
  updateNetworkBanner();

  // Pause clock when tab hidden (save battery)
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Reading progress bar
  function updateReadingProgress() {
    const progressBar = document.getElementById('readingProgress');
    if (!progressBar) return;
    if (state.mushafMode) {
      progressBar.style.transform = `scaleX(${state.currentPage / 604})`;
      return;
    }
    const container = dom.surahContent;
    if (!container || !state.surahData) return;
    const total = state.surahData.ayahs?.length || 1;
    const progress = Math.min(1, (state.currentAyahIndex + 1) / total);
    progressBar.style.transform = `scaleX(${progress})`;
  }
  state._updateReadingProgress = updateReadingProgress;
  window.addEventListener('scroll', updateReadingProgress, { passive: true });
  updateReadingProgress();
}
