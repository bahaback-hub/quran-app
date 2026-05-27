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
/* modules */
import { initPrayerState, loadPrayerTimes, startClock, stopAzan, testAzan, scheduleNextAzanCheck, checkAzanTime, togglePrayerBar } from './prayer.js';
import { initTafsirState, loadTafsirForCurrentAyah, loadTafsirForSurahAyah, toggleTafsir } from './tafsir.js';
import { initFavState, toggleFavorite, openFavorites, closeFavorites, setBookmark, gotoBookmark, loadFavorites, renderFavorites, setLoadSurahCallback } from './favorites.js';
import { initShareState, buildShareText, toggleShareMenu, shareNative, shareCopy, shareCopySimple, shareWhatsApp, shareTelegram } from './share.js';
import { initSettingsState, applyFontSize, applyNightMode, toggleNightMode, openSettings, closeSettings, saveLocationSettings, resetSettings, applyBackground, loadBackgrounds, restoreSettings } from './settings.js';
import { initAdhkarState, loadAdhkarSettings, checkAdhkarNotifications, wireAdhkarEvents } from './adhkar.js';

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
    if (e.target === closeBtn || closeBtn.contains(e.target)) {
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

export let state = {};

function initState() {
  state = {
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
    adhkarSettings: null, adhkarPanelOpen: false, adhkarActiveTab: null, lastAdhkarFired: null
  };
}

let surahOffsets = null;

/* ===================== SURAH LIST ===================== */

export async function loadSurahList() {
  const cached = storage.get('surah_list');
  if (cached && cached.length === CONFIG.SURAH_COUNT) {
    state.surahList = cached;
    surahOffsets = null;
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
      surahOffsets = null;
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
    opt.value = s.number;
    opt.textContent = `${s.number}. ${s.name} (${s.englishName})`;
    dom.surahSelect.appendChild(opt);
  }
  dom.surahSelect.value = state.currentSurah;
}

export function buildSurahOffsets() {
  if (surahOffsets || !state.surahList.length) return;
  surahOffsets = [];
  let cum = 1;
  for (const s of state.surahList) {
    surahOffsets.push({ surahNum: s.number, startAbs: cum, count: s.numberOfAyahs, name: s.name });
    cum += s.numberOfAyahs;
  }
}

function absToSurahAyah(absNum) {
  if (!surahOffsets) buildSurahOffsets();
  if (!surahOffsets) return null;
  for (const o of surahOffsets) {
    if (absNum >= o.startAbs && absNum < o.startAbs + o.count) {
      return { surahNum: o.surahNum, surahName: o.name, ayahNumInSurah: absNum - o.startAbs + 1 };
    }
  }
  return null;
}

function getAbsNumber(surah, ayah) {
  if (!surahOffsets) buildSurahOffsets();
  if (!surahOffsets) return null;
  for (const o of surahOffsets) {
    if (o.surahNum === surah) return o.startAbs + ayah - 1;
  }
  return null;
}

/* ===================== LOAD & RENDER SURAH ===================== */

export async function loadSurah(surahNum, opts = {}) {
  if (!surahNum) return;
  if (state.loadingSurah === surahNum) return;
  state.loadingSurah = surahNum;

  if (state.isPlaying) prepareAudioForNewSurah();

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
  if (state.surahCache.has(cacheKey)) {
    const cached = state.surahCache.get(cacheKey);
    state.surahData = cached.text;
    state.ayahsAudios = cached.audio?.ayahs?.map(a => a.audio) || [];
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
      fetch(`${CONFIG.API_BASE}/surah/${surahNum}/quran-uthmani`),
      fetch(`${CONFIG.API_BASE}/surah/${surahNum}/${state.currentReciter}`)
    ];
    if (state.translationEnabled && state.currentTranslation) {
      fetches.push(fetch(`${CONFIG.API_BASE}/surah/${surahNum}/${state.currentTranslation}`));
    }
    const [textRes, audioRes, transRes] = await Promise.all(fetches);
    const textJson = await textRes.json();
    const audioJson = await audioRes.json();
    const textData = textJson?.data;
    const audioData = audioJson?.data;
    if (!textData?.ayahs?.length || !audioData?.ayahs?.length) {
      throw new Error('بيانات السورة غير صالحة');
    }
    state.surahData = textData;
    state.ayahsAudios = audioData.ayahs.map(a => a.audio);

    if (transRes) {
      const transJson = await transRes.json();
      state.translationData = transJson?.data || null;
    } else {
      state.translationData = null;
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

function prepareAudioForNewSurah() {
  if (dom.audioPlayer) {
    dom.audioPlayer.pause();
    dom.audioPlayer.removeAttribute('src');
    dom.audioPlayer.load();
  }
  if (dom.audioPlayer2) {
    dom.audioPlayer2.pause();
    dom.audioPlayer2.removeAttribute('src');
    dom.audioPlayer2.load();
  }
}

export function renderSurah(textData) {
  if (!dom.surahContent) return;

  let html = `<h2 class="surah-title">${escapeHtml(textData.name)} — ${escapeHtml(textData.englishName)}`;
  if (SURAH_SECRETS[textData.number]) {
    html += ` <button class="surah-secret-title-btn" data-surah="${textData.number}" data-surahname="${escapeHtml(textData.name)}" title="سرّ السورة" aria-label="سرّ السورة">🌟</button>`;
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
      showSurahSecret(parseInt(secretBtn.dataset.surah, 10), secretBtn.dataset.surahname);
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
  state.currentAyahIndex = idx;
  highlightCurrentAyah();
  playCurrentAyah();
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
  if (opts.autoPlay) setTimeout(() => playCurrentAyah(), 200);
  if (state.autoSave) saveCurrentPosition();
}

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
}

function updatePlayerInfo() {
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

/* ===================== PLAYER ===================== */

export function playCurrentAyah() {
  if (!state.surahData || !state.ayahsAudios?.length) {
    showToast('لا توجد روابط صوت لهذه السورة', 'error');
    return;
  }
  const url = state.ayahsAudios[state.currentAyahIndex];
  if (!url) {
    showToast('لا يوجد صوت لهذه الآية', 'error');
    return;
  }
  if (!dom.audioPlayer) return;
  dom.audioPlayer.src = url;
  dom.audioPlayer.play().catch(e => console.warn(e));
  state.isPlaying = true;
  startWordTracking();
  preloadNextAyah();
}

function preloadNextAyah() {
  if (!state.ayahsAudios) return;
  const nextIdx = state.currentAyahIndex + 1;
  if (nextIdx < state.ayahsAudios.length) {
    const nextUrl = state.ayahsAudios[nextIdx];
    if (nextUrl) {
      if (!dom.audioPlayer2) {
        const a2 = document.createElement('audio');
        a2.id = 'audioPlayer2';
        a2.preload = 'auto';
        a2.style.display = 'none';
        document.body.appendChild(a2);
        dom.audioPlayer2 = a2;
      }
      dom.audioPlayer2.src = nextUrl;
      dom.audioPlayer2.load();
    }
  }
}

/* ===================== WORD-BY-WORD TRACKING ===================== */

let wordTrackingActive = false;

function startWordTracking() {
  wordTrackingActive = true;
}

function stopWordTracking() {
  wordTrackingActive = false;
  document.querySelectorAll('.word.current-word').forEach(el => el.classList.remove('current-word'));
}

function onTimeUpdate() {
  if (!wordTrackingActive || !dom.audioPlayer || !state.surahData) return;
  const duration = dom.audioPlayer.duration;
  if (!duration || !isFinite(duration)) return;
  const currentTime = dom.audioPlayer.currentTime;

  const ayahEl = document.querySelector(`.ayah[data-index="${state.currentAyahIndex}"]`);
  if (!ayahEl) return;

  const words = ayahEl.querySelectorAll('.word');
  if (words.length === 0) return;

  const wordDuration = duration / words.length;
  const wordIndex = Math.min(Math.floor(currentTime / wordDuration), words.length - 1);

  words.forEach((w, i) => {
    w.classList.toggle('current-word', i <= wordIndex);
  });
}

function onSeeking() {
  if (!wordTrackingActive) return;
  document.querySelectorAll('.word.current-word').forEach(el => el.classList.remove('current-word'));
}

/* ===================== AUDIO EVENTS ===================== */

function expandPlayer() {
  dom.player?.classList.remove('collapsed');
  storage.set('player_collapsed', false);
}

export function togglePlayPause() {
  if (!state.surahData || !dom.audioPlayer) return;
  if (dom.audioPlayer.paused) {
    if (!dom.audioPlayer.src) playCurrentAyah();
    else dom.audioPlayer.play().catch(e => console.warn(e));
  } else {
    dom.audioPlayer.pause();
  }
}

export function bindAudioEvents() {
  if (dom.audioPlayer) {
    dom.audioPlayer.removeEventListener('ended', onAudioEnded);
    dom.audioPlayer.addEventListener('ended', onAudioEnded);
    dom.audioPlayer.removeEventListener('play', onAudioPlay);
    dom.audioPlayer.addEventListener('play', onAudioPlay);
    dom.audioPlayer.removeEventListener('pause', onAudioPause);
    dom.audioPlayer.addEventListener('pause', onAudioPause);
    dom.audioPlayer.removeEventListener('error', onAudioError);
    dom.audioPlayer.addEventListener('error', onAudioError);
    dom.audioPlayer.removeEventListener('timeupdate', onTimeUpdate);
    dom.audioPlayer.addEventListener('timeupdate', onTimeUpdate);
    dom.audioPlayer.removeEventListener('seeking', onSeeking);
    dom.audioPlayer.addEventListener('seeking', onSeeking);
  }
}

function onAudioPlay() { state.isPlaying = true; updatePlayPauseBtn(); }
function onAudioPause() { state.isPlaying = false; updatePlayPauseBtn(); }
function onAudioError() {
  state.isPlaying = false;
  updatePlayPauseBtn();
  showToast('⚠️ تعذّر تشغيل الصوت، حاول آية أخرى', 'error');
}

function updatePlayPauseBtn() {
  if (dom.playPauseBtn) {
    dom.playPauseBtn.textContent = state.isPlaying ? '⏸ إيقاف' : '⏯ تشغيل';
  }
}

function onAudioEnded() {
  if (!state.surahData || !state.ayahsAudios) return;
  stopWordTracking();

  if (state.repeatMode) {
    const currentNum = state.surahData.ayahs[state.currentAyahIndex].numberInSurah;
    if (currentNum === state.repeatTo) {
      state.repeatCounter++;
      if (state.repeatCounter >= state.repeatTimes) {
        state.repeatMode = false;
        state.repeatCounter = 0;
        dom.repeatBtn?.classList.remove('active');
        if (dom.repeatControls) dom.repeatControls.style.display = 'none';
        showToast('✅ انتهى التكرار', 'success');
        return;
      }
      const startIdx = state.surahData.ayahs.findIndex(a => a.numberInSurah === state.repeatFrom);
      if (startIdx !== -1) {
        state.currentAyahIndex = startIdx;
        highlightCurrentAyah();
        setTimeout(playCurrentAyah, 0);
        return;
      }
    }
    nextAyah(true);
    return;
  }

  if (state.currentAyahIndex === state.ayahsAudios.length - 1) {
    showToast(`✅ انتهت سورة ${state.surahData.name}`, 'success');
  }
  nextAyah(true);
}

export function nextAyah(autoFromRepeat) {
  if (!state.surahData || !state.ayahsAudios) return;
  if (state.currentAyahIndex < state.ayahsAudios.length - 1) {
    state.currentAyahIndex++;
    highlightCurrentAyah();
    if (autoFromRepeat || state.isPlaying) setTimeout(playCurrentAyah, 0);
  } else if (state.currentSurah < CONFIG.SURAH_COUNT) {
    nextSurah();
  }
}

export function prevAyah() {
  if (!state.surahData) return;
  if (state.currentAyahIndex > 0) {
    state.currentAyahIndex--;
    highlightCurrentAyah();
    if (state.isPlaying) setTimeout(playCurrentAyah, 0);
  } else if (state.currentSurah > 1) {
    prevSurah();
  }
}

function nextSurah() { if (state.currentSurah < CONFIG.SURAH_COUNT) loadSurah(state.currentSurah + 1, { autoPlay: state.isPlaying }); }
function prevSurah() { if (state.currentSurah > 1) loadSurah(state.currentSurah - 1, { autoPlay: state.isPlaying }); }

/* ===================== HIFDH & REPEAT ===================== */

export function toggleHifdh() {
  state.hifdhMode = !state.hifdhMode;
  dom.hifdhBtn?.classList.toggle('active', state.hifdhMode);
  document.querySelectorAll('.ayah').forEach(el => {
    if (state.hifdhMode) el.classList.add('hifdh-mode');
    else el.classList.remove('hifdh-mode', 'revealed');
  });
  if (state.hifdhMode) highlightCurrentAyah();
  showToast(state.hifdhMode ? '🧠 وضع الحفظ مفعّل' : 'وضع الحفظ مغلق', state.hifdhMode ? 'success' : '');
}

export function toggleRepeat() {
  state.repeatMode = !state.repeatMode;
  state.repeatCounter = 0;
  dom.repeatBtn?.classList.toggle('active', state.repeatMode);
  if (dom.repeatControls) dom.repeatControls.style.display = state.repeatMode ? 'flex' : 'none';
  if (state.repeatMode && state.surahData) {
    state.repeatFrom = 1;
    state.repeatTo = state.surahData.ayahs.length;
    state.repeatTimes = 3;
    if (dom.repeatFrom && dom.repeatTo && dom.repeatTimes) {
      dom.repeatFrom.innerHTML = '';
      dom.repeatTo.innerHTML = '';
      for (let i = 1; i <= state.surahData.ayahs.length; i++) {
        dom.repeatFrom.innerHTML += `<option value="${i}">${i}</option>`;
        dom.repeatTo.innerHTML += `<option value="${i}">${i}</option>`;
      }
      dom.repeatFrom.value = state.repeatFrom;
      dom.repeatTo.value = state.repeatTo;
      dom.repeatTimes.value = state.repeatTimes;
      dom.repeatFrom.onchange = () => {
        state.repeatFrom = parseInt(dom.repeatFrom.value, 10);
        if (state.repeatFrom > state.repeatTo) { state.repeatTo = state.repeatFrom; dom.repeatTo.value = state.repeatTo; }
        state.repeatCounter = 0;
      };
      dom.repeatTo.onchange = () => {
        state.repeatTo = parseInt(dom.repeatTo.value, 10);
        if (state.repeatTo < state.repeatFrom) { state.repeatFrom = state.repeatTo; dom.repeatFrom.value = state.repeatFrom; }
        state.repeatCounter = 0;
      };
      dom.repeatTimes.onchange = () => { state.repeatTimes = parseInt(dom.repeatTimes.value, 10); state.repeatCounter = 0; };
    }
    showToast('🔁 وضع التكرار مفعّل', 'success');
  } else {
    showToast('التكرار مغلق', '');
  }
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

/* ===================== SEARCH ===================== */

async function loadFullQuranText() {
  if (state.fullQuranLoaded) return;
  return new Promise((resolve) => {
    const request = indexedDB.open('QuranAppDB', 1);
    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('fullText')) db.createObjectStore('fullText', { keyPath: 'id' });
    };
    request.onsuccess = async (e) => {
      const db = e.target.result;
      try {
        const tx = db.transaction('fullText', 'readonly');
        const store = tx.objectStore('fullText');
        const getReq = store.get('fullQuran');
        getReq.onsuccess = async () => {
          if (getReq.result && getReq.result.data) {
            state.fullQuranText = getReq.result.data;
            state.fullQuranText.forEach(a => { a.normalized = normalizeExactText(a.text); });
            state.fullQuranLoaded = true;
            resolve();
          } else {
            showToast('جاري تحميل قاعدة القرآن (مرة واحدة فقط)...', 'success');
            try {
              const res = await fetch(`${CONFIG.API_BASE}/quran/quran-uthmani`);
              const data = await res.json();
              if (!data?.data?.surahs) throw new Error('بيانات غير صالحة');
               const ayahs = [];
               for (const surah of data.data.surahs) {
                 for (const ayah of surah.ayahs) {
                   let ayahText = ayah.text;
                   if (surah.number !== 1 && surah.number !== 9 && ayah.numberInSurah === 1) {
                     ayahText = ayahText.replace(/^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u, '');
                   }
                   ayahs.push({
                     surah: surah.number, surahName: surah.name,
                     ayah: ayah.numberInSurah, text: ayahText,
                     normalized: normalizeExactText(ayahText)
                   });
                 }
               }
              state.fullQuranText = ayahs;
              state.fullQuranLoaded = true;
              try {
                const tx2 = db.transaction('fullText', 'readwrite');
                tx2.objectStore('fullText').put({ id: 'fullQuran', data: ayahs });
              } catch (_) { }
              showToast('✅ قاعدة القرآن جاهزة', 'success');
              resolve();
            } catch (err) { console.error(err); resolve(); }
          }
        };
        getReq.onerror = () => resolve();
      } catch (err) { resolve(); }
    };
    request.onerror = () => resolve();
  });
}

function performExactSearch(query) {
  if (!query.trim() || query.length < 2) { showToast('أدخل حرفين على الأقل', 'error'); return; }
  if (!state.fullQuranLoaded) { showToast('⚠️ قاعدة القرآن تُحمَّل، انتظر قليلاً', 'error'); return; }
  const normQuery = normalizeExactText(query.trim());
  const matches = state.fullQuranText.filter(ayah => ayah.normalized.includes(normQuery)).slice(0, 100);
  renderSearchResults(matches, query);
}

/* ===================== VOICE SEARCH ===================== */

function startVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('البحث الصوتي غير مدعوم في هذا المتصفح', 'error');
    return;
  }
  if (state._voiceListening) return;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  state._voiceListening = true;
  dom.voiceSearchBtn?.classList.add('listening');
  showToast('🎤 تحدّث الآن...', 'success');
  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    if (dom.searchInput) dom.searchInput.value = transcript;
    dom.searchBtn?.click();
    stopVoiceSearch();
  };
  recognition.onerror = () => {
    showToast('🎤 لم يتم التعرف على الصوت، حاول مرة أخرى', 'error');
    stopVoiceSearch();
  };
  recognition.onend = () => {
    stopVoiceSearch();
  };
  recognition.start();
  state._voiceRecognition = recognition;
}

function stopVoiceSearch() {
  state._voiceListening = false;
  dom.voiceSearchBtn?.classList.remove('listening');
  if (state._voiceRecognition) {
    try { state._voiceRecognition.stop(); } catch (e) { }
    state._voiceRecognition = null;
  }
}

/* ===================== ARABIC KEYBOARD ===================== */

let _shiftActive = false;

function toggleKeyboard() {
  const kbd = document.getElementById('arabicKeyboard');
  if (!kbd) return;
  kbd.classList.toggle('open');
  dom.kbdToggleBtn?.classList.toggle('active');
}

function handleKeyClick(e) {
  const key = e.currentTarget.dataset.key;
  const input = dom.searchInput;
  if (!input) return;
  const start = input.selectionStart || input.value.length;
  const end = input.selectionEnd || input.value.length;

  if (key === 'space') {
    input.value = input.value.slice(0, start) + ' ' + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + 1;
  } else if (key === 'backspace') {
    if (start > 0 && start === end) {
      input.value = input.value.slice(0, start - 1) + input.value.slice(start);
      input.selectionStart = input.selectionEnd = start - 1;
    } else if (start !== end) {
      input.value = input.value.slice(0, start) + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start;
    }
  } else if (key === 'clear') {
    input.value = '';
  } else if (key === 'shift') {
    _shiftActive = !_shiftActive;
    const shiftMap = {
      'ذ':'ّ', '١':'!', '٢':'@', '٣':'#', '٤':'$', '٥':'%', '٦':'^', '٧':'&', '٨':'*', '٩':'(', '٠':')',
      '-':'_', '=':'+'
    };
    const reverseMap = {};
    for (const [k2, v] of Object.entries(shiftMap)) reverseMap[v] = k2;
    document.querySelectorAll('.kbd-key[data-key]').forEach(k => {
      const val = k.dataset.key;
      if (!val || val === 'space' || val === 'backspace' || val === 'clear' || val === 'shift') return;
      if (_shiftActive) {
        const shifted = shiftMap[val];
        if (shifted) { k.textContent = shifted; k.dataset.key = shifted; }
      } else {
        const unshifted = reverseMap[val];
        if (unshifted) { k.textContent = unshifted; k.dataset.key = unshifted; }
      }
    });
    return;
  } else {
    input.value = input.value.slice(0, start) + key + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + key.length;
  }
  input.focus();
}

function initKeyboard() {
  dom.kbdToggleBtn = document.getElementById('kbdToggleBtn');
  dom.kbdToggleBtn?.addEventListener('click', toggleKeyboard);
  document.querySelectorAll('.kbd-key').forEach(btn => {
    btn.addEventListener('click', handleKeyClick);
  });
  document.addEventListener('click', (e) => {
    const kbd = document.getElementById('arabicKeyboard');
    const toggle = dom.kbdToggleBtn;
    if (!kbd || !toggle) return;
    if (!kbd.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
      kbd.classList.remove('open');
      toggle.classList.remove('active');
    }
  });
}

function renderSearchResults(matches, query) {
  if (!dom.searchResults) return;
  dom.searchResults.innerHTML = '';
  if (!matches.length) {
    dom.searchResults.innerHTML = `<div class="search-empty">❌ لا توجد نتائج لـ "${escapeHtml(query)}"</div>`;
    dom.searchResults.style.display = 'block';
    return;
  }
  let html = `<div class="search-results-header">
    <span>✅ عدد النتائج: ${matches.length}</span>
    <button class="search-results-close" id="closeSearchResultsBtn" aria-label="إغلاق">✖</button>
  </div>`;
  for (const m of matches) {
    const safeText = escapeHtml(m.text);
    const safeQuery = escapeRegExp(query);
    const highlighted = safeText.replace(new RegExp(safeQuery, 'gi'), '<mark class="search-highlight">$&</mark>');
    html += `<div class="search-result-item">
      <div class="search-result-title">${escapeHtml(m.surahName || '')} — آية ${m.ayah}</div>
      <div class="search-result-text">${highlighted}</div>
      <div class="search-result-actions">
        <button class="search-play" data-surah="${m.surah}" data-ayah="${m.ayah}">▶️ تشغيل</button>
        <button class="search-copy" data-surah="${m.surah}" data-ayah="${m.ayah}">📋 نسخ</button>
        <button class="search-share" data-surah="${m.surah}" data-ayah="${m.ayah}">📤 مشاركة</button>
        <button class="search-goto" data-surah="${m.surah}" data-ayah="${m.ayah}">📍 الذهاب</button>
      </div>
    </div>`;
  }
  dom.searchResults.innerHTML = html;
  dom.searchResults.style.display = 'block';

  const closeBtn = document.getElementById('closeSearchResultsBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => { dom.searchResults.style.display = 'none'; });

  document.querySelectorAll('.search-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playSpecificAyah(parseInt(btn.dataset.surah, 10), parseInt(btn.dataset.ayah, 10));
    });
  });
  document.querySelectorAll('.search-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copySpecificAyah(parseInt(btn.dataset.surah, 10), parseInt(btn.dataset.ayah, 10));
    });
  });
  document.querySelectorAll('.search-share').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      shareSpecificAyah(parseInt(btn.dataset.surah, 10), parseInt(btn.dataset.ayah, 10));
    });
  });
  document.querySelectorAll('.search-goto').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = parseInt(btn.dataset.surah, 10);
      const a = parseInt(btn.dataset.ayah, 10);
      if (dom.surahSelect) dom.surahSelect.value = s;
      loadSurah(s, { startAyah: a });
    });
  });

}

function playSpecificAyah(surah, ayah) {
  if (state.currentSurah !== surah || !state.surahData) {
    loadSurah(surah, { startAyah: ayah, autoPlay: true });
  } else {
    const idx = state.surahData.ayahs.findIndex(a => a.numberInSurah === ayah);
    if (idx !== -1) {
      state.currentAyahIndex = idx;
      highlightCurrentAyah();
      playCurrentAyah();
    }
  }
}

async function copySpecificAyah(surah, ayah) {
  let text = '';
  if (state.fullQuranLoaded) {
    const ayahObj = state.fullQuranText.find(a => a.surah === surah && a.ayah === ayah);
    if (ayahObj) text = ayahObj.text;
  }
  if (!text) {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/ayah/${surah}:${ayah}/quran-uthmani`);
      const data = await res.json();
      text = data?.data?.text || '';
    } catch (e) { }
  }
  if (text) {
    copyToClipboard(text);
    showToast('📋 تم نسخ الآية', 'success');
  } else {
    showToast('فشل في الحصول على الآية', 'error');
  }
}

async function shareSpecificAyah(surah, ayah) {
  const surahObj = state.surahList.find(s => s.number === Number(surah));
  const surahName = surahObj ? surahObj.name : `سورة `;
  let text = '';
  if (state.fullQuranLoaded) {
    const ayahObj = state.fullQuranText.find(a => a.surah === surah && a.ayah === ayah);
    if (ayahObj) text = ayahObj.text;
  }
  if (!text) {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/ayah/${surah}:${ayah}/quran-uthmani`);
      const data = await res.json();
      text = data?.data?.text || '';
    } catch (e) { }
  }
  const shareMsg = text ? `﴿${text}﴾\n— ${surahName.trim()} — آية ${ayah}` : `الآية ${ayah} من سورة ${surahName.trim()}`;
  if (navigator.share) {
    navigator.share({ title: 'القرآن الكريم', text: shareMsg }).catch(() => { });
  } else {
    copyToClipboard(shareMsg);
    showToast('📋 تم نسخ الآية للمشاركة', 'success');
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) { }
  document.body.removeChild(ta);
}

/* ===================== SHARE ===================== */

/* ===================== VISIBILITY ===================== */

function handleVisibilityChange() {
  if (document.hidden) {
    stopClock();
  } else {
    startClock();
  }
}

/* ===================== MUSHARAF MODE ===================== */

async function toggleMushafMode() {
  state.mushafMode = !state.mushafMode;
  if (state.mushafMode) {
    dom.modeToggleBtn.innerHTML = '📖 وضع السورة';
    dom.modeToggleBtn.classList.add('mushaf-active');
    if (dom.pageIndicator) dom.pageIndicator.style.display = 'inline';
    populatePageSelect();
    
    if (state.currentSurah) {
      const currentAyah = (state.surahData?.number === state.currentSurah && state.surahData?.ayahs?.[state.currentAyahIndex]?.numberInSurah) || 1;
      try {
        const res = await fetch(`${CONFIG.API_BASE}/ayah/${state.currentSurah}:${currentAyah}/quran-uthmani`);
        const data = await res.json();
        const page = data?.data?.page;
        if (page && page >= 1 && page <= 604) {
          state.currentPage = page;
        }
      } catch (e) {
        console.warn('Failed to get page for ayah:', e);
      }
    }
    
    updatePageIndicator(state.currentPage);
    loadPage(state.currentPage);
  } else {
    dom.modeToggleBtn.innerHTML = '<img src="mushaf-icon.png" alt="" class="mode-toggle-icon"> وضع المصحف';
    dom.modeToggleBtn.classList.remove('mushaf-active');
    if (dom.pageIndicator) dom.pageIndicator.style.display = 'none';
    
    let surahToLoad = 1;
    let ayahToStart = 1;
    
    try {
      const res = await fetch(`${CONFIG.API_BASE}/page/${state.currentPage}/quran-uthmani`);
      const data = await res.json();
      const ayahs = data?.data?.ayahs;
      if (ayahs?.length) {
        surahToLoad = ayahs[0].surah.number;
        ayahToStart = ayahs[0].numberInSurah;
      }
    } catch (e) {
      console.warn('Failed to get ayahs for page:', e);
      surahToLoad = state.currentSurah && state.currentSurah > 0 ? state.currentSurah : 1;
    }
    
    dom.surahContent.innerHTML = '<p class="loading">⏳ جاري تحميل السورة...</p>';
    setTimeout(() => loadSurah(surahToLoad, { startAyah: ayahToStart }), 50);
  }
  storage.set('mushaf_mode', state.mushafMode);
}

function populatePageSelect() {
  if (!dom.pageSelect) return;
  dom.pageSelect.innerHTML = '';
  for (let i = 1; i <= 604; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `صفحة ${i}`;
    dom.pageSelect.appendChild(opt);
  }
  dom.pageSelect.value = state.currentPage;
  if (dom.pageSlider) dom.pageSlider.value = state.currentPage;
}

function updatePageIndicator(pageNum) {
  if (dom.pageIndicator) {
    const arabic = pageNum.toLocaleString('ar-SA');
    dom.pageIndicator.textContent = `صفحة ${arabic} من ٦٠٤`;
  }
}

async function loadPage(pageNum) {
  if (!pageNum) return;
  state.currentPage = pageNum;
  storage.set('current_page', pageNum);
  updatePageIndicator(pageNum);
  loadingBar.show(`⏳ جاري تحميل الصفحة ${pageNum}...`);
  renderMushafPageImage(pageNum);
}

function getJuzForPage(pageNum) {
  let juz = 1;
  for (let i = JUZ_PAGES.length - 1; i >= 0; i--) {
    if (pageNum >= JUZ_PAGES[i]) { juz = i + 1; break; }
  }
  return juz;
}

function renderMushafPageImage(pageNum) {
  if (!dom.surahContent) return;
  const juz = getJuzForPage(pageNum);
  const padded = String(pageNum).padStart(3, '0');
  const imgUrl = `./public/pages/page${padded}.png`;

  const container = document.createElement('div');
  container.className = 'mushaf-container';

  const header = document.createElement('div');
  header.className = 'mushaf-header';
  header.innerHTML = `
    <div class="mushaf-page-num">صفحة ${toArabicNumeral(pageNum)}</div>
    <div class="mushaf-surah-names" id="mushafSurahNames"></div>
    <div class="mushaf-juz">الجزء ${toArabicNumeral(juz)}</div>
  `;

  const imgWrapper = document.createElement('div');
  imgWrapper.className = 'mushaf-image-wrapper';

  const skeleton = document.createElement('div');
  skeleton.className = 'mushaf-image-skeleton';

  const img = new Image();
  img.className = 'mushaf-page-img';
  img.alt = `صفحة ${pageNum} من المصحف`;
  img.loading = 'eager';

  img.onerror = () => {
    img.classList.add('loaded');
    skeleton.remove();
    loadingBar.hide();
  };
  img.onload = () => {
    img.classList.add('loaded');
    skeleton.remove();
    loadingBar.hide();
  };
  img.src = imgUrl;

  const navRight = document.createElement('div');
  navRight.className = 'mushaf-page-nav mushaf-page-nav-right';
  navRight.setAttribute('aria-label', 'الصفحة السابقة');
  navRight.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentPage > 1) loadPage(state.currentPage - 1);
  });

  const navLeft = document.createElement('div');
  navLeft.className = 'mushaf-page-nav mushaf-page-nav-left';
  navLeft.setAttribute('aria-label', 'الصفحة التالية');
  navLeft.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.currentPage < 604) loadPage(state.currentPage + 1);
  });

  imgWrapper.appendChild(skeleton);
  imgWrapper.appendChild(img);
  imgWrapper.appendChild(navRight);
  imgWrapper.appendChild(navLeft);

  const footer = document.createElement('div');
  footer.className = 'mushaf-footer';
  footer.innerHTML = `<span class="mushaf-footer-ornament">۞</span> صفحة ${toArabicNumeral(pageNum)} — القرآن الكريم <span class="mushaf-footer-ornament">۞</span>`;

  container.appendChild(header);
  container.appendChild(imgWrapper);
  container.appendChild(footer);

  const ayahBar = document.createElement('div');
  ayahBar.className = 'mushaf-ayah-bar';
  ayahBar.id = 'mushafAyahBar';
  ayahBar.innerHTML = '<div class="mushaf-ayah-bar-title">🎯 اختر آية للاستماع أو التفسير</div><div class="mushaf-ayah-bar-loading">جاري تحميل الآيات...</div>';

  dom.surahContent.innerHTML = '';
  dom.surahContent.appendChild(container);
  dom.surahContent.appendChild(ayahBar);

  preloadAdjacentPages(pageNum);

  fetch(`${CONFIG.API_BASE}/page/${pageNum}/quran-uthmani`)
    .then(res => res.json())
    .then(json => {
      const ayahs = json?.data?.ayahs;
      if (!ayahs?.length) return;

      const surahNamesEl = document.getElementById('mushafSurahNames');
      if (surahNamesEl) {
        const seen = {};
        ayahs.forEach(a => { if (!seen[a.surah.number]) seen[a.surah.number] = a.surah.name; });
        surahNamesEl.innerHTML = Object.values(seen).map(n => `<span class="mushaf-surah-name">📖 ${escapeHtml(n)}</span>`).join(' ');
      }

      const bar = document.getElementById('mushafAyahBar');
      if (!bar) return;
      let itemsHtml = '<div class="mushaf-ayah-bar-title">🎯 اختر آية للاستماع أو التفسير</div><div class="mushaf-ayah-bar-grid">';
      for (const ayah of ayahs) {
        const sn = ayah.surah.number;
        const an = ayah.numberInSurah;
        const surahInfo = state.surahList.find(s => s.number === sn);
        const surahName = surahInfo ? surahInfo.name : `سورة ${sn}`;
        itemsHtml += `<button class="mushaf-ayah-btn" data-surah="${sn}" data-ayah="${an}">
          <span class="mushaf-ayah-btn-surah">${escapeHtml(surahName)}</span>
          <span class="mushaf-ayah-btn-num">${toArabicNumeral(an)}</span>
        </button>`;
      }
      itemsHtml += '</div>';
      bar.innerHTML = itemsHtml;

      bar.querySelectorAll('.mushaf-ayah-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          bar.querySelectorAll('.mushaf-ayah-btn').forEach(b => b.classList.remove('current'));
          this.classList.add('current');
          playMushafAyah(parseInt(this.dataset.surah, 10), parseInt(this.dataset.ayah, 10));
          loadTafsirForSurahAyah(parseInt(this.dataset.surah, 10), parseInt(this.dataset.ayah, 10));
        });
      });
    })
    .catch(() => { });
}

function preloadAdjacentPages(pageNum) {
  const toPreload = [];
  if (pageNum > 1) toPreload.push(pageNum - 1);
  if (pageNum < 604) toPreload.push(pageNum + 1);

  for (const p of toPreload) {
    const padded = String(p).padStart(3, '0');
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `./public/pages/page${padded}.png`;
    link.as = 'image';
    document.head.appendChild(link);
  }
}

function populateSurahOverlay() {
  if (!dom.mushafSurahOverlayList || !state.surahList.length) return;
  dom.mushafSurahOverlayList.innerHTML = '';
  for (const s of state.surahList) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const btn = document.createElement('button');
    btn.className = 'mushaf-surah-overlay-btn';
    btn.textContent = `${s.number}. ${s.name} (${s.englishName})`;
    btn.style.flex = '1';
    btn.dataset.surah = s.number;
    btn.addEventListener('click', async () => {
      dom.mushafSurahOverlay.style.display = 'none';
      loadingBar.show(`⏳ البحث عن أول صفحة لسورة ${s.name}...`);
      try {
        const res = await fetch(`${CONFIG.API_BASE}/ayah/${s.number}:1`);
        const data = await res.json();
        const page = data?.data?.page || 1;
        if (dom.pageSelect) dom.pageSelect.value = page;
        if (dom.pageSlider) dom.pageSlider.value = page;
        state.currentPage = page;
        loadPage(page);
      } catch {
        showToast('تعذّر العثور على الصفحة', 'error');
      } finally {
        loadingBar.hide();
      }
    });
    row.appendChild(btn);
    if (SURAH_SECRETS[s.number]) {
      const secretBtn = document.createElement('button');
      secretBtn.className = 'surah-secret-btn';
      secretBtn.textContent = '🌟';
      secretBtn.title = 'سرّ السورة';
      secretBtn.setAttribute('aria-label', `سرّ سورة ${s.name}`);
      secretBtn.dataset.surah = s.number;
      secretBtn.dataset.surahName = s.name;
      secretBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSurahSecret(parseInt(secretBtn.dataset.surah, 10), secretBtn.dataset.surahName);
      });
      row.appendChild(secretBtn);
    }
    dom.mushafSurahOverlayList.appendChild(row);
  }
}

function showSurahSecret(surahNum, surahName) {
  if (!dom.surahSecretsOverlay || !dom.surahSecretsBody || !dom.surahSecretsTitle || !dom.surahSecretsSurahName) return;
  const secret = SURAH_SECRETS[surahNum];
  if (!secret) {
    showToast('لا يوجد سر مسجل لهذه السورة', 'error');
    return;
  }
  dom.surahSecretsSurahName.textContent = `🌟 ${surahNum}. ${surahName}`;
  dom.surahSecretsTitle.textContent = `🌟 سرّ السورة`;
  let html = `<p>${secret}</p>`;
  const authKeys = SURAH_SECRETS_AUTH_KEYS[surahNum];
  if (authKeys && authKeys.length) {
    html += `<div class="secret-source">📚 المصادر: ${authKeys.map(k => `<span>${k}</span>`).join(' ')}</div>`;
  }
  dom.surahSecretsBody.innerHTML = html;
  dom.surahSecretsOverlay.style.display = 'flex';
}

function playMushafAyah(surahNum, ayahNum) {
  if (state.isPlaying) prepareAudioForNewSurah();
  const loadAndPlay = () => {
    const idx = state.surahData.ayahs.findIndex(a => a.numberInSurah === ayahNum);
    if (idx !== -1) {
      state.currentAyahIndex = idx;
      updatePlayerInfo();
      playCurrentAyah();
    }
  };
  if (state.currentSurah !== surahNum || !state.surahData) {
    const tempSurahList = state.surahList;
    fetch(`${CONFIG.API_BASE}/surah/${surahNum}/${state.currentReciter}`)
      .then(res => res.json())
      .then(json => {
        if (json?.data?.ayahs) {
          state.ayahsAudios = json.data.ayahs.map(a => a.audio);
          if (tempSurahList.length) {
            const s = tempSurahList.find(s => s.number === surahNum);
            if (s) state.surahData = { name: s.name, englishName: s.englishName, number: surahNum, ayahs: json.data.ayahs };
          }
          loadAndPlay();
        }
      })
      .catch(() => showToast('تعذّر تحميل الصوت', 'error'));
  } else {
    loadAndPlay();
  }
}

/* ===================== INIT ===================== */

export async function initApp() {
  initState();
  loadingBar.init();
  loadingBar.hide();
  cacheDom();
  initAdhkarState(state);
  loadAdhkarSettings();
  restoreSettings();
  loadFavorites();
  startClock();

  checkAzanTime();
  scheduleNextAzanCheck();

  await loadSurahList();
  buildSurahOffsets();

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
  setInterval(checkAdhkarNotifications, 15000);

  /* ========== EVENT BINDINGS ========== */

  dom.surahSelect?.addEventListener('change', () => {
    if (!dom.surahSelect.value) return;
    const surahNum = parseInt(dom.surahSelect.value, 10);
    if (state.mushafMode) {
      fetch(`${CONFIG.API_BASE}/ayah/${surahNum}:1`)
        .then(res => res.json())
        .then(data => {
          const page = data?.data?.page || 1;
          if (dom.pageSelect) dom.pageSelect.value = page;
          if (dom.pageSlider) dom.pageSlider.value = page;
          state.currentPage = page;
          loadPage(page);
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

  document.addEventListener('click', (e) => {
    if (!dom.shareMenu?.contains(e.target) && e.target !== dom.shareBtn) dom.shareMenu?.classList.remove('show');
  });

  /* ========== MUSHAF MODE ========== */
  dom.modeToggleBtn?.addEventListener('click', toggleMushafMode);
  dom.pageSelect?.addEventListener('change', () => {
    if (dom.pageSelect.value) { const p = parseInt(dom.pageSelect.value, 10); if (dom.pageSlider) dom.pageSlider.value = p; loadPage(p); }
  });
  dom.mushafSurahOverlayClose?.addEventListener('click', () => { if (dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.mushafSurahOverlay?.addEventListener('click', (e) => { if (e.target === dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.surahSecretsCloseBtn?.addEventListener('click', () => { if (dom.surahSecretsOverlay) dom.surahSecretsOverlay.style.display = 'none'; });
  dom.surahSecretsOverlay?.addEventListener('click', (e) => { if (e.target === dom.surahSecretsOverlay) dom.surahSecretsOverlay.style.display = 'none'; });

  dom.pageSlider?.addEventListener('input', () => {
    const p = parseInt(dom.pageSlider.value, 10);
    if (dom.pageSelect) dom.pageSelect.value = p;
    state.currentPage = p;
    loadPage(p);
  });

  // Restore mushaf mode
  const savedMushaf = storage.get('mushaf_mode');
  const savedPage = storage.get('current_page');
  if (savedPage) state.currentPage = savedPage;
  if (savedMushaf && dom.modeToggleBtn) toggleMushafMode();

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
      case 'm': case 'M': toggleMushafMode(); break;
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

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('SW registration failed:', err));
    });
  }
}
