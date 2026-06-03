import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { dom } from './dom.js';
import { showToast, loadingBar } from './ui.js';
import { __ } from './i18n.js';
import { escapeHtml } from './utils.js';
import { state } from './state.js';
import { RECITERS, getReciterById, buildAudioUrl, getTimingApiId } from './reciters.js';
import { SURAH_SECRETS } from './surahs-data.js';
import { prepareAudioForNewSurah, playCurrentAyah } from './audio.js';
import { recordReadingSession } from './reading-stats.js';


/* ===================== SURAH LIST ===================== */

/** Load surah list from cache, API, or local fallback, then populate dropdown. */
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
      return;
    }
  } catch (e) { /* fall through to local fallback */ }
  try {
    const localRes = await fetch('data/surah-list.json');
    const localData = await localRes.json();
    if (localData && localData.length === CONFIG.SURAH_COUNT) {
      state.surahList = localData;
      state.surahOffsets = null;
      storage.set('surah_list', localData);
      populateSurahSelect();
      return;
    }
  } catch (e) { /* no local fallback */ }
  if (dom.surahSelect) dom.surahSelect.innerHTML = '<option value="">⚠️ تعذّر التحميل</option>';
  showToast('تعذّر تحميل قائمة السور', 'error');
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

export function populateReciterSelect() {
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

/**
 * Fetch real ayah timings from quran.com API for supported reciters.
 * Returns fractions (0-1) matching the calculateAyahTimings() format,
 * or null if unavailable (triggers character-count fallback).
 * @param {string} reciterId
 * @param {number} surahNum
 * @param {Array<{text: string}>} ayahs
 * @returns {Promise<number[]|null>}
 */
async function fetchAyahTimings(reciterId, surahNum, ayahs) {
  const apiId = getTimingApiId(reciterId);
  if (!apiId) return null;
  try {
    const res = await fetch(`https://api.quran.com/api/v4/chapter_recitations/${apiId}/${surahNum}?segments=true`);
    if (!res.ok) return null;
    const data = await res.json();
    const timestamps = data?.audio_file?.timestamps;
    if (!timestamps?.length || timestamps.length !== ayahs.length) return null;
    const totalDuration = timestamps[timestamps.length - 1].timestamp_to;
    if (!totalDuration || totalDuration <= 0) return null;
    return timestamps.map(t => t.timestamp_from / totalDuration);
  } catch {
    return null;
  }
}

function calculateAyahTimings(ayahs, surahNumber) {
  const timings = [];
  const MIN_PER_AYAH = 5;
  const BASMALAH_MIN = 24;
  let basmalahChars = 0;
  const counts = ayahs.map((a, i) => {
    const n = countArabicChars(a.text);
    if (i === 0 && surahNumber !== 1 && surahNumber !== 9) {
      const without = a.text.replace(/^بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ\s*/u, '');
      basmalahChars = Math.max(BASMALAH_MIN, n - countArabicChars(without));
      return Math.max(MIN_PER_AYAH, countArabicChars(without));
    }
    return Math.max(MIN_PER_AYAH, n);
  });
  const total = counts.reduce((a, b) => a + b, 0) + basmalahChars;
  if (!total) return ayahs.map(() => 0);
  let cum = basmalahChars / total;
  for (let i = 0; i < ayahs.length; i++) {
    timings.push(cum);
    cum += counts[i] / total;
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

/* ===================== AUDIO HELPERS (independent from text) ===================== */

/** Load audio for mp3quran reciter source. */
async function loadMp3quranAudio(surahNum, textData, reciterInfo, currentLoad) {
  const audios = textData.ayahs.map(() => buildAudioUrl(reciterInfo, surahNum));
  const timings = await fetchAyahTimings(state.currentReciter, surahNum, textData.ayahs) ?? calculateAyahTimings(textData.ayahs, surahNum);
  if (_loadCounter !== currentLoad) return null;
  return { audios, timings };
}

/** Load audio for standard API reciter source. */
async function loadApiAudio(surahNum, reciterId, currentLoad, signal) {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/surah/${surahNum}/${reciterId}`, { signal });
    const json = await res.json();
    const data = json?.data;
    if (!data?.ayahs?.length) throw new Error('لا توجد بيانات صوت');
    const audios = data.ayahs.map(a => a.audio);
    if (_loadCounter !== currentLoad) return null;
    return { audios, timings: [] };
  } catch (e) {
    console.warn('Audio load failed (non-fatal):', e);
    return null;
  }
}

/* ===================== LOAD & RENDER SURAH ===================== */

let _loadCounter = 0;
let currentSurahController = null;

/**
 * Load a surah (text + audio + translation), render it, finalize.
 * @param {number} surahNum
 * @param {{ startAyah?: number, autoPlay?: boolean }} [opts]
 */
export async function loadSurah(surahNum, opts = {}) {
  if (!surahNum) return;
  _loadCounter++;
  const currentLoad = _loadCounter;
  state.loadingSurah = surahNum;

  // Clear stale audio/translation before new load
  state.ayahsAudios = [];
  state.ayahTimings = [];
  state.translationData = null;
  state.isPlaying = false;

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

  // Cancel previous in-flight request
  if (currentSurahController) currentSurahController.abort();
  currentSurahController = new AbortController();
  const signal = currentSurahController.signal;

  const cacheKey = `${surahNum}_${state.currentReciter}_${state.currentTranslation || 'notr'}`;
  const reciterInfo = getReciterById(state.currentReciter);
  const isMp3quran = reciterInfo.source === 'mp3quran';
  if (state.surahCache.has(cacheKey)) {
    const cached = state.surahCache.get(cacheKey);
    if (_loadCounter !== currentLoad) return;
    state.surahData = cached.text;
    if (isMp3quran) {
      state.ayahsAudios = cached.text.ayahs.map(() => buildAudioUrl(reciterInfo, surahNum));
      state.ayahTimings = cached.timings || calculateAyahTimings(cached.text.ayahs, surahNum);
    } else {
      state.ayahsAudios = Array.isArray(cached.audios) ? cached.audios : (cached.audio?.ayahs?.map(a => a.audio) || []);
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
    const textRes = await fetch(`${CONFIG.API_BASE}/surah/${surahNum}/quran-uthmani`, { signal });
    const textJson = await textRes.json();
    const textData = textJson?.data;
    if (!textData?.ayahs?.length) {
      throw new Error('بيانات السورة غير صالحة');
    }
    if (_loadCounter !== currentLoad) return;
    state.surahData = textData;

    renderSurah(textData);
    const autoPlay = opts.autoPlay;
    finalizeSurahLoad({ ...opts, autoPlay: false });
    recordReadingSession(surahNum, textData.ayahs.length);
    loadingBar.hide();

    // Load audio and translation independently (don't block render)
    const audioPromise = isMp3quran
      ? loadMp3quranAudio(surahNum, textData, reciterInfo, currentLoad)
      : loadApiAudio(surahNum, state.currentReciter, currentLoad, signal);
    const transPromise = (state.translationEnabled && state.currentTranslation)
      ? fetch(`${CONFIG.API_BASE}/surah/${surahNum}/${state.currentTranslation}`, { signal }).then(r => r.json()).then(d => d?.data || null).catch(() => null)
      : Promise.resolve(null);

    const [audioResult, transResult] = await Promise.all([audioPromise, transPromise]);
    if (_loadCounter !== currentLoad) return;
    if (audioResult) {
      state.ayahsAudios = audioResult.audios;
      state.ayahTimings = audioResult.timings;
    }
    state.translationData = transResult;
    if (transResult && state.surahData) {
      renderSurah(state.surahData);
      highlightCurrentAyah();
    }

    if (autoPlay && audioResult) {
      playCurrentAyah();
    }

    if (state.surahCache.size >= CONFIG.CACHE_LIMIT) {
      const firstKey = state.surahCache.keys().next().value;
      state.surahCache.delete(firstKey);
    }
    state.surahCache.set(cacheKey, { text: textData, audios: state.ayahsAudios, timings: state.ayahTimings, translation: state.translationData });
  } catch (e) {
    if (e.name === 'AbortError') return;
    if (state.fullQuranLoaded && state.fullQuranText) {
      if (_loadCounter !== currentLoad) return;
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

const VIRTUAL_CHUNK_SIZE = 20;
let _ayahsReadyCount = 0;
let _virtualObserver = null;

function buildAyahHtml(a, i, textData) {
  const isRtlTranslation = state.currentTranslation && (state.currentTranslation.startsWith('ur.'));
  let txt = a.text;
  if (textData.number !== 1 && a.numberInSurah === 1) {
    txt = txt.replace(/^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u, '');
  }
  let html = `<span class="ayah" data-index="${i}" data-surah="${textData.number}" data-ayah="${a.numberInSurah}">`;
  html += buildAyahWordsHtml(txt, i);
  html += ` <span class="ayah-number">${a.numberInSurah}</span>`;
  if (state.translationEnabled && state.translationData?.ayahs?.[i]) {
    const transText = escapeHtml(state.translationData.ayahs[i].text);
    html += `<span class="translation-text${isRtlTranslation ? ' rtl-lang' : ''}">${transText}</span>`;
  }
  html += `</span> `;
  return html;
}

function renderAyahChunk(textData, start, count) {
  if (!dom.surahContent) return;
  const ayahsContainer = dom.surahContent.querySelector('.ayahs-container');
  if (!ayahsContainer) return;
  const end = Math.min(start + count, textData.ayahs.length);
  let html = '';
  for (let i = start; i < end; i++) {
    html += buildAyahHtml(textData.ayahs[i], i, textData);
  }
  ayahsContainer.insertAdjacentHTML('beforeend', html);
  _ayahsReadyCount = end;
  if (_ayahsReadyCount < textData.ayahs.length) {
    ensureVirtualSentinel(textData);
  } else {
    cleanupVirtualObserver();
  }
}

function ensureVirtualSentinel(textData) {
  cleanupVirtualObserver();
  const existing = document.getElementById('virtualSentinel');
  if (existing) existing.remove();
  const sentinel = document.createElement('div');
  sentinel.id = 'virtualSentinel';
  sentinel.style.height = '1px';
  dom.surahContent?.appendChild(sentinel);
  _virtualObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && _ayahsReadyCount < textData.ayahs.length) {
      renderAyahChunk(textData, _ayahsReadyCount, VIRTUAL_CHUNK_SIZE);
    }
  }, { rootMargin: '200px' });
  _virtualObserver.observe(sentinel);
}

function cleanupVirtualObserver() {
  if (_virtualObserver) {
    _virtualObserver.disconnect();
    _virtualObserver = null;
  }
  const existing = document.getElementById('virtualSentinel');
  if (existing) existing.remove();
}

/** Render surah content into dom.surahContent. */
export function renderSurah(textData) {
  if (!dom.surahContent) return;
  cleanupVirtualObserver();
  _ayahsReadyCount = 0;

  // Update breadcrumbs
  const breadcrumbSurah = document.getElementById('breadcrumbSurah');
  if (breadcrumbSurah) {
    breadcrumbSurah.textContent = `${textData.name} (${textData.englishName})`;
    breadcrumbSurah.classList.add('breadcrumb-surah');
  }

  let html = `<h2 class="surah-title">${escapeHtml(textData.name)} — ${escapeHtml(textData.englishName)}`;
  if (SURAH_SECRETS[textData.number]) {
    html += ` <button class="surah-secret-title-btn" data-surah="${textData.number}" data-surahname="${escapeHtml(textData.name)}" title="معلومات عن السورة" aria-label="معلومات عن السورة">ℹ️</button>`;
  }
  html += `</h2>`;
  if (textData.number !== 1 && textData.number !== 9) {
    html += '<p class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>';
  }
  html += `<div class="ayahs-container" style="font-size:${state.fontSize}px"></div>`;
  dom.surahContent.innerHTML = html;
  initAyahDelegation();
  renderAyahChunk(textData, 0, VIRTUAL_CHUNK_SIZE);

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

let _ayahDelegationBound = false;
function initAyahDelegation() {
  if (!dom.surahContent || _ayahDelegationBound) return;
  _ayahDelegationBound = true;
  dom.surahContent.addEventListener('click', (e) => {
    const ayahEl = /** @type {HTMLElement} */ (e.target).closest('.ayah');
    if (!ayahEl) return;
    const idx = parseInt(ayahEl.getAttribute('data-index'), 10);
    const surah = parseInt(ayahEl.dataset.surah, 10);
    const ayah = parseInt(ayahEl.dataset.ayah, 10);
    if (!state.surahData || state.surahData.number !== surah) return;
    const a = state.surahData.ayahs[idx];
    if (!a) return;
    import('./ayah-modal.js').then(m => m.openAyahModal({ surah, ayah, text: a.text, surahName: state.surahData.name, index: -1 }));
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
  if (state._selectMode) {
    const isSelected = ayahEl.classList.toggle('selected');
    if (isSelected) {
      if (!state._selectedAyahs) state._selectedAyahs = [];
      state._selectedAyahs.push({ surah, ayah, text: a.text, surahName: state.surahData.name, index: idx });
    } else {
      state._selectedAyahs = state._selectedAyahs.filter(s => !(s.surah === surah && s.ayah === ayah));
    }
    const count = state._selectedAyahs.length;
    const countEl = document.getElementById('selectCount');
    if (countEl) countEl.textContent = String(count);
    const bar = document.getElementById('selectModeBar');
    if (bar) bar.classList.toggle('show', count > 0);
    return;
  }
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
  const container = dom.surahContent?.querySelector('.ayahs-container');
  const ayahs = container?.children;
  if (ayahs) {
    for (let i = 0; i < ayahs.length; i++) ayahs[i].classList.remove('current');
  }
  if (state.surahData && state.currentAyahIndex >= _ayahsReadyCount) {
    renderAyahChunk(state.surahData, _ayahsReadyCount, state.currentAyahIndex - _ayahsReadyCount + VIRTUAL_CHUNK_SIZE);
  }
  const cur = container?.querySelector(`.ayah[data-index="${state.currentAyahIndex}"]`);
  if (cur) {
    cur.classList.add('current');
    if (state.hifdhMode) {
      for (let i = 0; i < ayahs.length; i++) ayahs[i].classList.remove('revealed');
      for (let i = 0; i <= state.currentAyahIndex; i++) {
        const prev = container.querySelector(`.ayah[data-index="${i}"]`);
        if (prev) prev.classList.add('revealed');
      }
    }
    cur.scrollIntoView({ behavior: 'instant', block: 'center' });
  }
  updatePlayerInfo();
  import('./presentation.js').then(m => m.syncPresentation()).catch(() => {});
  if (dom.tafsirCurtain && dom.tafsirCurtain.classList.contains('open')) import('./tafsir.js').then(m => m.loadTafsirForCurrentAyah());
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
    dom.playerCurrentAyah.textContent = `﴿${preview}﴾ — ${__('ayah')} ${a.numberInSurah}`;
  }
  if (dom.collapsedInfo && a) {
    const short = a.text.length > 50 ? a.text.substring(0, 50) + '...' : a.text;
    dom.collapsedInfo.innerHTML = `<span class="fi-surah">${escapeHtml(state.surahData.name)} — ${__('ayah')} ${escapeHtml(String(a.numberInSurah))}</span><span>${escapeHtml(short)}</span>`;
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

export function toggleTranslation() {
  state.translationEnabled = !state.translationEnabled;
  storage.set('translation_enabled', state.translationEnabled);
  if (state.translationEnabled && !state.currentTranslation) {
    state.currentTranslation = dom.translationSelect?.value || 'en.sahih';
    storage.set('translation_edition', state.currentTranslation);
  }
  if (dom.translationSelect) dom.translationSelect.value = state.translationEnabled ? state.currentTranslation : '';
  showToast(state.translationEnabled ? '🌐 الترجمة مفعّلة' : 'الترجمة مغلقة', 'success');
  if (state.currentSurah) loadSurah(state.currentSurah);
}
