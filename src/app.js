import { CONFIG, JUZ_PAGES } from './config.js';
import { storage } from './storage.js';
import { dom, cacheDom } from './dom.js';
import { showToast, loadingBar } from './ui.js';
import {
  escapeHtml, escapeRegExp, pad2, toArabicNumeral,
  normalizeExactText
} from './utils.js';
import { __, getLang, setLang } from './i18n.js';
import { SURAH_SECRETS, SURAH_SECRETS_AUTH_KEYS } from './surahs-data.js';
import { state } from './state.js';
import { startClock, stopClock, loadPrayerTimes, stopAzan, testAzan, scheduleNextAzanCheck, checkAzanTime, togglePrayerBar, hideAzanNotification } from './prayer.js';
import { RECITERS, getReciterById, buildAudioUrl } from './reciters.js';
import { loadFavorites, toggleFavorite, openFavorites, closeFavorites, setBookmark, gotoBookmark } from './favorites.js';
import { loadTafsirForCurrentAyah, loadTafsirForSurahAyah, toggleTafsir, closeTafsir } from './tafsir.js';
import { buildShareText, toggleShareMenu, shareNative, shareCopy, shareCopySimple, shareWhatsApp, shareTelegram } from './share.js';
import { applyFontSize, applyNightMode, toggleNightMode, openSettings, closeSettings, saveLocationSettings, resetSettings, applyBackground, loadBackgrounds, restoreSettings } from './settings.js';
import { initAdhkarState, loadAdhkarSettings, checkAdhkarNotifications, wireAdhkarEvents } from './adhkar.js';
import { prepareAudioForNewSurah, playCurrentAyah, togglePlayPause, nextAyah, prevAyah, nextSurah, prevSurah, toggleHifdh, toggleRepeat, bindAudioEvents, setLoadSurah, expandPlayer, updatePlayPauseBtn } from './audio.js';
import { loadFullQuranText, performExactSearch, startVoiceSearch, initKeyboard, initSearchAutocomplete } from './search.js';

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
  text.innerHTML = `📖 <strong>${info.surahName}</strong> — آية ${info.ayahNumberInSurah}<br><small style="opacity:0.7;">آخر زيارة: ${dateStr}</small>`;

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
    playerCollapsed: false, barCollapsed: false,
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
    ayahTimings: []
  });
}

/* ===================== SURAH LIST ===================== */

/** Load surah list from API or cache, then populate dropdown. */
export async function loadSurahList() {
  const cached = storage.get('surah_list');
  if (cached && cached.length === CONFIG.SURAH_COUNT) {
    state.surahList = cached;
    state.surahOffsets = null;
    buildSurahOffsets();
    populateSurahSelect();
    return;
  }
  if (dom.surahSelect) dom.surahSelect.innerHTML = '<option value="">⏳ جاري تحميل قائمة السور...</option>';
  try {
    const res = await fetch(`${CONFIG.API_BASE}/surah`);
    const data = await res.json();
    if (data?.data) {
      state.surahList = data.data;
      state.surahOffsets = null;
      storage.set('surah_list', data.data);
      populateSurahSelect();
    }
  } catch (e) {
    if (dom.surahSelect) dom.surahSelect.innerHTML = '<option value="">⚠️ تعذّر التحميل</option>';
    showToast('تعذّر تحميل قائمة السور', 'error');
  }
}

function populateSurahSelect() {
  if (!dom.surahSelect) return;
  dom.surahSelect.innerHTML = '<option value="">اختر السورة</option>';
  for (const s of state.surahList) {
    const opt = document.createElement('option');
    opt.value = String(s.number);
    opt.textContent = `${s.number}. ${s.name} (${s.englishName})`;
    dom.surahSelect.appendChild(opt);
  }
  dom.surahSelect.value = state.currentSurah;
}

function populateReciterSelect() {
  if (!dom.reciterSelect) return;
  dom.reciterSelect.innerHTML = RECITERS.map(r =>
    `<option value="${r.id}">${r.name}</option>`
  ).join('');
  dom.reciterSelect.value = state.currentReciter || CONFIG.DEFAULT_RECITER;
}

export function buildSurahOffsets() {
  if (state.surahOffsets || !state.surahList.length) return;
  state.surahOffsets = [];
  let cum = 1;
  for (const s of state.surahList) {
    state.surahOffsets.push({ surahNum: s.number, startAbs: cum, count: s.numberOfAyahs, name: s.name });
    cum += s.numberOfAyahs;
  }
}

function countArabicChars(text) {
  return (text.match(/[\u0621-\u064A\u0660-\u0669]/g) || []).length;
}

function calculateAyahTimings(ayahs, surahNumber) {
  const timings = [];
  let basmalahChars = 0;
  const charCounts = ayahs.map((a, i) => {
    const n = countArabicChars(a.text);
    if (i === 0 && surahNumber !== 1 && surahNumber !== 9) {
      const without = a.text.replace(/^بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ\s*/u, '');
      basmalahChars = n - countArabicChars(without);
      return countArabicChars(without);
    }
    return n;
  });
  const totalChars = charCounts.reduce((a, b) => a + b, 0) + basmalahChars;
  if (!totalChars) return ayahs.map(() => 0);
  let cum = basmalahChars / totalChars;
  for (let i = 0; i < ayahs.length; i++) {
    timings.push(cum);
    cum += charCounts[i] / totalChars;
  }
  return timings;
}

function absToSurahAyah(absNum) {
  if (!state.surahOffsets) buildSurahOffsets();
  if (!state.surahOffsets) return null;
  for (const o of state.surahOffsets) {
    if (absNum >= o.startAbs && absNum < o.startAbs + o.count) {
      return { surahNum: o.surahNum, surahName: o.name, ayahNumInSurah: absNum - o.startAbs + 1 };
    }
  }
  return null;
}

function getAbsNumber(surah, ayah) {
  if (!state.surahOffsets) buildSurahOffsets();
  if (!state.surahOffsets) return null;
  for (const o of state.surahOffsets) {
    if (o.surahNum === surah) return o.startAbs + ayah - 1;
  }
  return null;
}

/* ===================== LOAD & RENDER SURAH ===================== */

/**
 * Load a surah (text + audio + translation), render it, finalize.
 * @param {number} surahNum
 * @param {{ startAyah?: number, autoPlay?: boolean }} [opts]
 */
export async function loadSurah(surahNum, opts = {}) {
  if (!surahNum) return;
  if (state.loadingSurah === surahNum) return;
  state.loadingSurah = surahNum;

  prepareAudioForNewSurah();

  if (state.hifdhMode) {
    state.hifdhMode = false;
    dom.hifdhBtn?.classList.remove('active');
    document.querySelectorAll('.ayah').forEach(el => el.classList.remove('hifdh-mode', 'revealed'));
  }
  if (state.repeatMode) {
    state.repeatMode = false;
    state.repeatCounter = 0;
    dom.repeatBtn?.classList.remove('active');
    if (dom.repeatControls) dom.repeatControls.style.display = 'none';
  }
  state.currentSurah = surahNum;

  const cacheKey = `${surahNum}_${state.currentReciter}_${state.currentTranslation || 'notr'}`;
  const reciterInfo = getReciterById(state.currentReciter);
  const isMp3quran = reciterInfo.source === 'mp3quran';
  if (state.surahCache.has(cacheKey)) {
    const cached = state.surahCache.get(cacheKey);
    state.surahData = cached.text;
    if (isMp3quran) {
      state.ayahsAudios = cached.text.ayahs.map(() => buildAudioUrl(reciterInfo, surahNum));
      state.ayahTimings = calculateAyahTimings(cached.text.ayahs, surahNum);
    } else {
      state.ayahsAudios = cached.audio?.ayahs?.map(a => a.audio) || [];
      state.ayahTimings = [];
    }
    state.translationData = cached.translation || null;
    renderSurah(cached.text);
    finalizeSurahLoad(opts);
    state.loadingSurah = null;
    return;
  }

  loadingBar.show(`⏳ جاري تحميل سورة ${state.surahList.find(s => s.number === surahNum)?.name || surahNum}...`);
  if (dom.surahContent) dom.surahContent.innerHTML = '<div class="skeleton-loading"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';

  try {
    const fetches = [
      fetch(`${CONFIG.API_BASE}/surah/${surahNum}/quran-uthmani`)
    ];
    if (!isMp3quran) {
      fetches.push(fetch(`${CONFIG.API_BASE}/surah/${surahNum}/${state.currentReciter}`));
    }
    if (state.translationEnabled && state.currentTranslation) {
      fetches.push(fetch(`${CONFIG.API_BASE}/surah/${surahNum}/${state.currentTranslation}`));
    }

    const results = await Promise.all(fetches);
    const textRes = results[0];
    const textJson = await textRes.json();
    const textData = textJson?.data;
    if (!textData?.ayahs?.length) {
      throw new Error('بيانات السورة غير صالحة');
    }
    state.surahData = textData;
    /** @type {Object|null} */
    let audioData = null;

    if (isMp3quran) {
      state.ayahsAudios = textData.ayahs.map(() => buildAudioUrl(reciterInfo, surahNum));
      state.ayahTimings = calculateAyahTimings(textData.ayahs, surahNum);
      state.translationData = results[1] ? (await results[1].json())?.data || null : null;
    } else {
      const audioRes = results[1];
      const audioJson = await audioRes.json();
      audioData = audioJson?.data;
      if (!audioData?.ayahs?.length) throw new Error('بيانات الصوت غير صالحة');
      state.ayahsAudios = audioData.ayahs.map(a => a.audio);
      state.ayahTimings = [];
      state.translationData = results[2] ? (await results[2].json())?.data || null : null;
    }

    if (state.surahCache.size >= CONFIG.CACHE_LIMIT) {
      const firstKey = state.surahCache.keys().next().value;
      state.surahCache.delete(firstKey);
    }
    state.surahCache.set(cacheKey, { text: textData, audio: audioData, translation: state.translationData });

    renderSurah(textData);
    finalizeSurahLoad(opts);
    loadingBar.hide();
  } catch (e) {
    if (state.fullQuranLoaded && state.fullQuranText) {
      const ayahs = state.fullQuranText.filter(a => a.surah === surahNum);
      if (ayahs.length) {
        state.surahData = {
          number: surahNum,
          name: ayahs[0].surahName,
          englishName: state.surahList.find(s => s.number === surahNum)?.englishName || '',
          ayahs: ayahs.map(a => ({ numberInSurah: a.ayah, text: a.text }))
        };
        state.ayahsAudios = [];
        renderSurah(state.surahData);
        finalizeSurahLoad(opts);
        loadingBar.hide();
        showToast('📖 وضع عدم الاتصال — الصوت غير متاح', '');
        state.loadingSurah = null;
        return;
      }
    }
    if (dom.surahContent) dom.surahContent.innerHTML = '<p class="error-msg">⚠️ تعذّر تحميل السورة</p>';
    showToast('فشل تحميل السورة', 'error');
    loadingBar.hide();
  } finally {
    state.loadingSurah = null;
  }
}

/* ===================== LOAD & RENDER SURAH ===================== */

/** Render surah content into dom.surahContent. */
export function renderSurah(textData) {
  if (!dom.surahContent) return;

  let html = `<h2 class="surah-title">${escapeHtml(textData.name)} — ${escapeHtml(textData.englishName)}`;
  if (SURAH_SECRETS[textData.number]) {
    html += ` <button class="surah-secret-title-btn" data-surah="${textData.number}" data-surahname="${escapeHtml(textData.name)}" title="معلومات عن السورة" aria-label="معلومات عن السورة">ℹ️</button>`;
  }
  html += `</h2>`;
  if (textData.number !== 1 && textData.number !== 9) {
    html += '<p class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>';
  }
  html += `<div class="ayahs-container" style="font-size:${state.fontSize}px">`;

  const isRtlTranslation = state.currentTranslation && (state.currentTranslation.startsWith('ur.'));
  for (let i = 0; i < textData.ayahs.length; i++) {
    const a = textData.ayahs[i];
    let txt = a.text;
    if (textData.number !== 1 && a.numberInSurah === 1) {
      txt = txt.replace(/^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u, '');
    }
    html += `<span class="ayah" data-index="${i}" data-surah="${textData.number}" data-ayah="${a.numberInSurah}">`;
    html += buildAyahWordsHtml(txt, i);
    html += ` <span class="ayah-number">${a.numberInSurah}</span>`;
    if (state.translationEnabled && state.translationData?.ayahs?.[i]) {
      const transText = escapeHtml(state.translationData.ayahs[i].text);
      const rtlClass = isRtlTranslation ? ' rtl-lang' : '';
      html += `<span class="translation-text${rtlClass}">${transText}</span>`;
    }
    html += `</span> `;
  }
  html += '</div>';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const fragment = document.createDocumentFragment();
  while (temp.firstChild) fragment.appendChild(temp.firstChild);
  dom.surahContent.replaceChildren(fragment);
  attachAyahEvents();
  const secretBtn = dom.surahContent.querySelector('.surah-secret-title-btn');
  if (secretBtn) {
    secretBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      import('./mushaf.js').then(m => m.showSurahSecret(parseInt(secretBtn.dataset.surah, 10), secretBtn.dataset.surahname));
    });
  }
}

function buildAyahWordsHtml(text, ayahIdx) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.map((word, wIdx) =>
    `<span class="word" data-ayah-index="${ayahIdx}" data-word-index="${wIdx}">${escapeHtml(word)}</span>`
  ).join(' ');
}

function attachAyahEvents() {
  document.querySelectorAll('.ayah').forEach(el => {
    el.removeEventListener('click', ayahClickHandler);
    el.addEventListener('click', ayahClickHandler);
  });
}

function ayahClickHandler(e) {
  const ayahEl = e.currentTarget;
  const idx = parseInt(ayahEl.getAttribute('data-index'), 10);
  const surah = parseInt(ayahEl.dataset.surah, 10);
  const ayah = parseInt(ayahEl.dataset.ayah, 10);
  if (!state.surahData || state.surahData.number !== surah) return;
  const a = state.surahData.ayahs[idx];
  if (!a) return;
  import('./ayah-modal.js').then(m => m.openAyahModal({ surah, ayah, text: a.text, surahName: state.surahData.name, index: -1 }));
}

function finalizeSurahLoad(opts) {
  if (opts.startAyah && state.surahData) {
    const idx = state.surahData.ayahs.findIndex(a => a.numberInSurah === opts.startAyah);
    if (idx !== -1) state.currentAyahIndex = idx;
  } else {
    state.currentAyahIndex = 0;
  }
  highlightCurrentAyah();
  updatePlayerInfo();
  if (opts.autoPlay) playCurrentAyah();
  if (state.autoSave) saveCurrentPosition();
}

/** Scroll to and highlight the current ayah. */
export function highlightCurrentAyah() {
  document.querySelectorAll('.ayah').forEach(el => el.classList.remove('current'));
  const cur = document.querySelector(`.ayah[data-index="${state.currentAyahIndex}"]`);
  if (cur) {
    cur.classList.add('current');
    if (state.hifdhMode) {
      document.querySelectorAll('.ayah').forEach(el => el.classList.remove('revealed'));
      for (let i = 0; i <= state.currentAyahIndex; i++) {
        const prev = document.querySelector(`.ayah[data-index="${i}"]`);
        if (prev) prev.classList.add('revealed');
      }
    }
    cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  updatePlayerInfo();
  if (dom.tafsirCurtain && dom.tafsirCurtain.classList.contains('open')) loadTafsirForCurrentAyah();
  if (state.mushafMode) import('./mushaf.js').then(m => m.highlightMushafAyah());
}

export function updatePlayerInfo() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  const reciterText = dom.reciterSelect?.options[dom.reciterSelect.selectedIndex]?.text || '';
  if (dom.playerSurahName) dom.playerSurahName.textContent = state.surahData.name;
  if (dom.playerReciterName) dom.playerReciterName.textContent = reciterText;
  if (dom.playerCurrentAyah && a) {
    const preview = a.text.length > 80 ? a.text.substring(0, 80) + '...' : a.text;
    dom.playerCurrentAyah.textContent = `﴿${preview}﴾ — آية ${a.numberInSurah}`;
  }
  if (dom.collapsedInfo && a) {
    const short = a.text.length > 50 ? a.text.substring(0, 50) + '...' : a.text;
    dom.collapsedInfo.innerHTML = `<span class="fi-surah">${state.surahData.name} — آية ${a.numberInSurah}</span><span>${short}</span>`;
  }
}

function saveCurrentPosition() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  storage.set('last_position', {
    surah: state.currentSurah,
    ayah: state.currentAyahIndex,
    surahName: state.surahData.name,
    ayahNumberInSurah: a.numberInSurah,
    timestamp: Date.now()
  });
}

/* ===================== TRANSLATION ===================== */

function toggleTranslation() {
  state.translationEnabled = !state.translationEnabled;
  dom.translationToggle?.classList.toggle('on', state.translationEnabled);
  if (dom.translationSelect) dom.translationSelect.style.display = state.translationEnabled ? '' : 'none';
  storage.set('translation_enabled', state.translationEnabled);
  if (state.translationEnabled && !state.currentTranslation) {
    state.currentTranslation = dom.translationSelect?.value || 'en.sahih';
    storage.set('translation_edition', state.currentTranslation);
  }
  showToast(state.translationEnabled ? '🌐 الترجمة مفعّلة' : 'الترجمة مغلقة', 'success');
  if (state.currentSurah) loadSurah(state.currentSurah);
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

  checkAzanTime();
  scheduleNextAzanCheck();

  await loadSurahList();
  buildSurahOffsets();
  import('./mushaf.js').then(m => m.populateSurahOverlay()).catch(() => {});

  const last = storage.get('last_position');
  if (last && last.surah) {
    state.currentSurah = last.surah;
    await loadSurah(last.surah, { startAyah: last.ayahNumberInSurah || 1 });
    setTimeout(() => showContinueWidget(last), 1200);
  } else {
    await loadSurah(1);
  }

  loadPrayerTimes();
  loadFullQuranText().catch(console.warn);
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
    if (e.target.closest('#collapsedPlayBtn')) return;
    expandPlayer();
  });
  dom.playPauseBtn?.addEventListener('click', () => { togglePlayPause(); updatePlayPauseBtn(); });
  dom.collapsedPlayBtn?.addEventListener('click', () => { togglePlayPause(); updatePlayPauseBtn(); });

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
  });

  /* ========== MUSHAF MODE ========== */
  dom.modeToggleBtn?.addEventListener('click', () => import('./mushaf.js').then(m => m.toggleMushafMode()));
  dom.pageSelect?.addEventListener('change', () => {
    if (dom.pageSelect.value) { const p = parseInt(dom.pageSelect.value, 10); if (dom.pageSlider) dom.pageSlider.value = p; import('./mushaf.js').then(m => m.loadPage(p, true)); }
  });
  dom.mushafSurahOverlayClose?.addEventListener('click', () => { if (dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.mushafSurahOverlay?.addEventListener('click', (e) => { if (e.target === dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.surahSecretsCloseBtn?.addEventListener('click', () => { if (dom.surahSecretsOverlay) dom.surahSecretsOverlay.style.display = 'none'; });
  dom.surahSecretsOverlay?.addEventListener('click', (e) => { if (e.target === dom.surahSecretsOverlay) dom.surahSecretsOverlay.style.display = 'none'; });

  dom.pageSlider?.addEventListener('input', () => {
    const p = parseInt(dom.pageSlider.value, 10);
    if (dom.pageSelect) dom.pageSelect.value = p;
    import('./mushaf.js').then(m => m.loadPage(p, true));
  });

  // Restore mushaf mode
  const savedMushaf = storage.get('mushaf_mode');
  const savedPage = storage.get('current_page');
  if (savedPage) state.currentPage = savedPage;
  if (savedMushaf && dom.modeToggleBtn) import('./mushaf.js').then(m => m.toggleMushafMode());

  /* ========== ADHKAR ========== */
  wireAdhkarEvents();

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

  // Register service worker (only for raw source deployment;
  // Vite build uses vite-plugin-pwa auto-registration)
  if ('serviceWorker' in navigator && typeof import.meta.env === 'undefined') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}
