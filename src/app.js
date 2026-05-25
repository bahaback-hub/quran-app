import { CONFIG, PRAYER_NAMES_AR, PRAYER_ORDER, ARABIC_WEEKDAYS, JUZ_PAGES } from './config.js';
import { storage } from './storage.js';
import { dom, cacheDom } from './dom.js';
import { showToast, loadingBar } from './ui.js';
import {
  escapeHtml, escapeRegExp, pad2, toArabicNumeral,
  formatTime12, timeStrToMinutes, normalizeExactText,
  stripTashkeel
} from './utils.js';
import { __, getLang, setLang } from './i18n.js';

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
    adhkarSettings: null, adhkarPanelOpen: false, adhkarActiveTab: null, lastAdhkarFired: null,
    adhkarNotifCategory: null, adhkarNotifItemIndex: 0, adhkarNotifPersonalId: null
  };
}

let surahOffsets = null;

/* ===================== PRAYER TIMES ===================== */

export async function loadPrayerTimes() {
  const city = dom.cityInput?.value.trim() || state.city;
  const country = dom.countryInput?.value.trim() || state.country;
  const method = dom.methodSelect?.value || state.method;
  const url = `${CONFIG.PRAYER_API}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${encodeURIComponent(method)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data?.data?.timings) {
      state.prayerTimes = data.data.timings;
      storage.set('cached_prayer_times', { date: new Date().toDateString(), timings: state.prayerTimes, city, country });
      renderPrayerTimes();
      scheduleNextAzanCheck();
      return;
    }
    throw new Error('Invalid response');
  } catch {
    const cached = storage.get('cached_prayer_times');
    if (cached && cached.date === new Date().toDateString() && cached.city === city && cached.country === country) {
      state.prayerTimes = cached.timings;
      renderPrayerTimes();
      scheduleNextAzanCheck();
      showToast('عرض المواقيت من الكاش المحلي', 'success');
    } else {
      showToast('تعذّر تحميل مواقيت الصلاة', 'error');
    }
  }
}

function getNextPrayerKey() {
  if (!state.prayerTimes) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const key of PRAYER_ORDER) {
    const raw = state.prayerTimes[key];
    if (!raw) continue;
    if (timeStrToMinutes(raw.split(' ')[0]) > nowMin) return key;
  }
  return 'Fajr';
}

function renderPrayerTimes() {
  if (!state.prayerTimes) return;
  const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const next = getNextPrayerKey();
  let html = '';
  for (const key of order) {
    const raw = state.prayerTimes[key] || '';
    const time24 = raw.split(' ')[0];
    const isNext = (key === next);
    html += `<div class="prayer-row ${isNext ? 'next-prayer' : ''}">
      <span class="prayer-name">${PRAYER_NAMES_AR[key] || key}</span>
      <span class="prayer-time">${formatTime12(time24)}</span>
    </div>`;
  }
  if (dom.prayerTimesRows) dom.prayerTimesRows.innerHTML = html;
  updateCountdowns();
}

let countdownInterval = null;

export function startClock() {
  updateDates();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    updateDates();
    if (state.prayerTimes) updateCountdowns();
  }, 1000);
}

function updateDates() {
  const now = new Date();
  try {
    const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    if (dom.hijriDateDisplay) dom.hijriDateDisplay.textContent = hijri;
    if (dom.bigClockHijri) dom.bigClockHijri.textContent = '📅 ' + hijri;
  } catch (e) { }
  if (dom.weekdayDisplay) dom.weekdayDisplay.textContent = ARABIC_WEEKDAYS[now.getDay()];
  const greg = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  if (dom.gregorianDateDisplay) dom.gregorianDateDisplay.textContent = greg;
  if (dom.bigClockDate) dom.bigClockDate.textContent = greg;
  const timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
  if (dom.bigClockTime) dom.bigClockTime.textContent = timeStr;
  const collapsedClock = document.getElementById('collapsedClock');
  if (collapsedClock) collapsedClock.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
}

function updateCountdowns() {
  if (!state.prayerTimes) return;
  const nextKey = getNextPrayerKey();
  if (!nextKey) return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const raw = state.prayerTimes[nextKey] || '';
  let nextMin = timeStrToMinutes(raw.split(' ')[0]);
  if (nextMin <= nowMin) nextMin += 24 * 60;
  const diff = nextMin - nowMin;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  const s = (60 - now.getSeconds()) % 60;
  const countdownText = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  if (dom.countdownDisplay) dom.countdownDisplay.textContent = countdownText;
  if (dom.prayerCountdown) dom.prayerCountdown.textContent = `${PRAYER_NAMES_AR[nextKey]} — بعد ${countdownText}`;
  const time24 = (state.prayerTimes[nextKey] || '').split(' ')[0];
  if (dom.nextPrayerName) dom.nextPrayerName.textContent = PRAYER_NAMES_AR[nextKey];
  if (dom.nextPrayerTime) dom.nextPrayerTime.textContent = formatTime12(time24);
}

/* ===================== AZAN ===================== */

function hideAzanNotification() {
  if (dom.azanNotification) dom.azanNotification.style.display = 'none';
}

function stopAzan() {
  if (!dom.azanPlayer) return;
  dom.azanPlayer.pause();
  dom.azanPlayer.currentTime = 0;
  dom.azanPlayer.removeAttribute('src');
  dom.azanPlayer.load();
  state.azanPlaying = false;
  if (dom.testAzanBtn) dom.testAzanBtn.textContent = '▶️ اختبار الأذان';
  hideAzanNotification();
}

export function testAzan() {
  if (!dom.azanPlayer) return;
  if (state.azanPlaying) {
    stopAzan();
    showToast('تم إيقاف الأذان', '');
  } else {
    dom.azanPlayer.src = CONFIG.AZAN_FILE;
    dom.azanPlayer.load();
    dom.azanPlayer.play()
      .then(() => {
        state.azanPlaying = true;
        if (dom.testAzanBtn) dom.testAzanBtn.textContent = '⏹️ إيقاف الأذان';
        if (dom.azanNotification && dom.azanNotifPrayer) {
          dom.azanNotifPrayer.textContent = '🕋 اختبار الأذان';
          dom.azanNotification.style.display = 'flex';
        }
      })
      .catch(() => showToast('تعذّر تشغيل الأذان', 'error'));
  }
}

function showAzanNotification(prayerKey) {
  if (!dom.azanNotification || !dom.azanNotifPrayer) return;
  dom.azanNotifPrayer.textContent = `🕋 صلاة ${PRAYER_NAMES_AR[prayerKey]}`;
  dom.azanNotification.style.display = 'flex';
}

function checkAzanTime() {
  if (!state.prayerTimes || !state.azanEnabled) return;
  const now = new Date();
  const cur = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  for (const key of PRAYER_ORDER) {
    if (key === 'Fajr' && !state.azanFajrEnabled) continue;
    const raw = (state.prayerTimes[key] || '').split(' ')[0];
    if (raw === cur) {
      const stamp = key + '_' + now.toDateString() + '_' + cur;
      if (state.lastAzanFired === stamp) return;
      state.lastAzanFired = stamp;
      if (dom.azanPlayer) {
        dom.azanPlayer.src = CONFIG.AZAN_FILE;
        dom.azanPlayer.currentTime = 0;
        dom.azanPlayer.play()
          .then(() => {
            state.azanPlaying = true;
            if (dom.testAzanBtn) dom.testAzanBtn.textContent = '⏹️ إيقاف الأذان';
            showAzanNotification(key);
          })
          .catch(e => console.warn(e));
      }
      return;
    }
  }
}

let azanTimer = null;

function scheduleNextAzanCheck() {
  if (azanTimer) clearTimeout(azanTimer);
  if (!state.prayerTimes || !state.azanEnabled) {
    azanTimer = setTimeout(scheduleNextAzanCheck, 60000);
    return;
  }
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  let nextSec = null;
  for (const key of PRAYER_ORDER) {
    if (key === 'Fajr' && !state.azanFajrEnabled) continue;
    const raw = (state.prayerTimes[key] || '').split(' ')[0];
    if (!raw) continue;
    const [h, m] = raw.split(':');
    const prayerSec = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60;
    if (prayerSec > nowSec) { nextSec = prayerSec; break; }
  }
  if (nextSec === null) return;
  const delayMs = (nextSec - nowSec) * 1000;
  azanTimer = setTimeout(() => { checkAzanTime(); scheduleNextAzanCheck(); }, delayMs);
}

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

  let html = `<h2 class="surah-title">${escapeHtml(textData.name)} — ${escapeHtml(textData.englishName)}</h2>`;
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
  if (dom.playerSurahName) dom.playerSurahName.textContent = `سورة ${state.surahData.name}`;
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

/* ===================== INDEXEDDB FOR TAFSIR ===================== */

function openTafsirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QuranTafsirDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tafsir')) {
        db.createObjectStore('tafsir', { keyPath: 'key' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getTafsirCacheKey(edition, surahNum, ayahNum) {
  return `tafsir_${edition}_${surahNum}_${ayahNum}`;
}

async function getTafsirFromDB(key) {
  try {
    const db = await openTafsirDB();
    return new Promise((resolve) => {
      const tx = db.transaction('tafsir', 'readonly');
      const store = tx.objectStore('tafsir');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.text : null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function saveTafsirToDB(key, text) {
  try {
    const db = await openTafsirDB();
    const tx = db.transaction('tafsir', 'readwrite');
    tx.objectStore('tafsir').put({ key, text });
  } catch (e) { }
}

async function fetchTafsirFromAPI(edition, surahNum, ayahNum) {
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  const url = `${CONFIG.TAFSIR_API}/${edition}/${surahNum}/${ayahNum}.json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const text = data?.tafsir?.text || data?.text || 'لا يوجد تفسير متاح';
    await saveTafsirToDB(cacheKey, text);
    return text;
  } catch {
    return null;
  }
}

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

/* ===================== TAFSIR ===================== */

function openTafsir() {
  if (!dom.tafsirCurtain) return;
  dom.tafsirCurtain.classList.add('open');
  dom.tafsirCurtainHandle?.classList.add('open');
  loadTafsirForCurrentAyah();
}

function closeTafsir() {
  dom.tafsirCurtain?.classList.remove('open');
  dom.tafsirCurtainHandle?.classList.remove('open');
}

export function toggleTafsir() {
  if (!dom.tafsirCurtain) return;
  dom.tafsirCurtain.classList.contains('open') ? closeTafsir() : openTafsir();
}

function renderTafsirContent(text, ayahText, surahName, ayahNum) {
  dom.tafsirCurtainHeader.textContent = `تفسير: ${surahName} — آية ${ayahNum}`;
  dom.tafsirCurtainBody.replaceChildren();
  dom.tafsirCurtainBody.scrollTop = 0;
  const titleEl = document.createElement('div');
  titleEl.className = 'tafsir-ayah-title';
  titleEl.textContent = `﴿${ayahText}﴾`;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'tafsir-text';
  bodyEl.textContent = text;
  dom.tafsirCurtainBody.appendChild(titleEl);
  dom.tafsirCurtainBody.appendChild(bodyEl);
}

function setTafsirHeader(surahName, ayahNum) {
  dom.tafsirCurtainHeader.textContent = `تفسير: ${surahName} — آية ${ayahNum}`;
}

function showTafsirLoading() {
  dom.tafsirCurtainBody.innerHTML = '<p class="tafsir-loading">⏳ جاري تحميل التفسير...</p>';
  dom.tafsirCurtainBody.scrollTop = 0;
}

function showTafsirError() {
  dom.tafsirCurtainBody.innerHTML = '<p class="tafsir-error">⚠️ تعذّر تحميل التفسير</p>';
  dom.tafsirCurtainBody.scrollTop = 0;
}

async function loadTafsirForCurrentAyah() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a || !dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition;
  const cacheKey = getTafsirCacheKey(edition, state.currentSurah, a.numberInSurah);
  setTafsirHeader(state.surahData.name, a.numberInSurah);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) { renderTafsirContent(cached, a.text, state.surahData.name, a.numberInSurah); return; }
  showTafsirLoading();
  const text = await fetchTafsirFromAPI(edition, state.currentSurah, a.numberInSurah);
  if (text) renderTafsirContent(text, a.text, state.surahData.name, a.numberInSurah);
  else showTafsirError();
}

async function loadTafsirForSurahAyah(surahNum, ayahNum) {
  if (!dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition || CONFIG.DEFAULT_TAFSIR;
  const surahInfo = state.surahList.find(s => s.number === surahNum);
  const surahName = surahInfo ? surahInfo.name : `سورة ${surahNum}`;
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  setTafsirHeader(surahName, ayahNum);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) { dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(cached)}</p>`; dom.tafsirCurtain?.classList.add('open'); return; }
  showTafsirLoading();
  dom.tafsirCurtain?.classList.add('open');
  const text = await fetchTafsirFromAPI(edition, surahNum, ayahNum);
  if (text) dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(text)}</p>`;
  else showTafsirError();
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

/* ===================== FAVORITES & BOOKMARK ===================== */

function loadFavorites() {
  state.favorites = storage.get('favorites', []);
}

function saveFavorites() {
  storage.set('favorites', state.favorites);
}

function toggleFavorite() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  const key = `${state.currentSurah}:${a.numberInSurah}`;
  const idx = state.favorites.findIndex(f => f.key === key);
  if (idx !== -1) {
    state.favorites.splice(idx, 1);
    showToast('💔 تمت إزالة من المفضلة', '');
    dom.favoriteBtn?.classList.remove('active');
  } else {
    state.favorites.push({
      key, surah: state.currentSurah, surahName: state.surahData.name,
      ayah: a.numberInSurah, text: a.text, timestamp: Date.now()
    });
    showToast('❤️ أُضيفت إلى المفضلة', 'success');
    dom.favoriteBtn?.classList.add('active');
  }
  saveFavorites();
  renderFavorites();
}

function renderFavorites() {
  if (!dom.favoritesList) return;
  if (!state.favorites.length) {
    dom.favoritesList.innerHTML = '<p class="favorites-empty">لا توجد آيات مفضلة بعد</p>';
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const f of state.favorites.slice().reverse()) {
    const item = document.createElement('div');
    item.className = 'favorite-item';
    const meta = document.createElement('div');
    meta.className = 'favorite-meta';
    meta.innerHTML = `<strong>${escapeHtml(f.surahName || '')}</strong> — آية ${escapeHtml(String(f.ayah || ''))}`;
    const textDiv = document.createElement('div');
    textDiv.className = 'favorite-text';
    textDiv.textContent = f.text || '';
    const actions = document.createElement('div');
    actions.className = 'favorite-actions';
    const goBtn = document.createElement('button');
    goBtn.className = 'favorite-action-btn fav-go';
    goBtn.dataset.surah = String(f.surah || '');
    goBtn.dataset.ayah = String(f.ayah || '');
    goBtn.textContent = 'انتقال';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'favorite-action-btn favorite-remove-btn fav-remove';
    removeBtn.dataset.key = String(f.key || '');
    removeBtn.textContent = 'حذف';
    actions.appendChild(goBtn);
    actions.appendChild(removeBtn);
    item.appendChild(meta);
    item.appendChild(textDiv);
    item.appendChild(actions);
    fragment.appendChild(item);
  }
  dom.favoritesList.replaceChildren(fragment);
  document.querySelectorAll('.fav-go').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = parseInt(btn.dataset.surah, 10);
      const a = parseInt(btn.dataset.ayah, 10);
      if (isNaN(s) || isNaN(a)) return;
      if (dom.surahSelect) dom.surahSelect.value = s;
      loadSurah(s, { startAyah: a });
      closeFavorites();
    });
  });
  document.querySelectorAll('.fav-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (!key) return;
      state.favorites = state.favorites.filter(f => f.key !== key);
      saveFavorites();
      renderFavorites();
      showToast('تم الحذف', '');
    });
  });
}

function openFavorites() { renderFavorites(); dom.favoritesPanel?.classList.add('open'); }
function closeFavorites() { dom.favoritesPanel?.classList.remove('open'); }

function setBookmark() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  state.bookmark = {
    surah: state.currentSurah, surahName: state.surahData.name,
    ayah: a.numberInSurah, text: a.text, timestamp: Date.now()
  };
  storage.set('bookmark', state.bookmark);
  showToast('🔖 تم حفظ العلامة', 'success');
}

function gotoBookmark() {
  const bm = state.bookmark || storage.get('bookmark');
  if (!bm) { showToast('لا توجد علامة محفوظة', 'error'); return; }
  if (dom.surahSelect) dom.surahSelect.value = bm.surah;
  loadSurah(bm.surah, { startAyah: bm.ayah });
}

/* ===================== SHARE ===================== */

export function buildShareText() {
  if (!state.surahData) return '';
  const a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a) return '';
  return `${a.text} — ${state.surahData.name} — آية ${a.numberInSurah}`;
}

function toggleShareMenu() { dom.shareMenu?.classList.toggle('show'); }

function shareNative() {
  const text = buildShareText();
  if (!text) return;
  if (navigator.share) {
    navigator.share({ title: 'القرآن الكريم', text }).catch(() => { });
  } else {
    shareCopy();
  }
}

function shareCopy() { copyToClipboard(buildShareText()); showToast('📋 تم نسخ الآية', 'success'); }
function shareCopySimple() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a) return;
  const text = `${stripTashkeel(a.text)} — ${state.surahData.name} — آية ${a.numberInSurah}`;
  copyToClipboard(text);
  showToast('📋 تم نسخ النص المبسط', 'success');
}
function shareWhatsApp() {
  const text = buildShareText();
  if (!text) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
function shareTelegram() {
  const text = buildShareText();
  if (!text) return;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(text)}`, '_blank');
}

/* ===================== FONT SIZE ===================== */

function applyFontSize(size) {
  state.fontSize = size;
  const container = document.querySelector('.ayahs-container');
  if (container) container.style.fontSize = size + 'px';
  storage.set('font_size', size);
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = size;
}

/* ===================== NIGHT MODE ===================== */

function applyNightMode(enabled) {
  state.nightMode = enabled;
  if (enabled) document.body.classList.add('night-mode');
  else document.body.classList.remove('night-mode');
  storage.set('night_mode', enabled);
}

function toggleNightMode() { applyNightMode(!state.nightMode); }

/* ===================== SETTINGS ===================== */

function openSettings() { dom.settingsPanel?.classList.add('open'); }

function closeSettings() {
  dom.settingsPanel?.classList.remove('open');
  if (state.azanPlaying) stopAzan();
}

function saveLocationSettings() {
  const city = dom.cityInput?.value.trim();
  const country = dom.countryInput?.value.trim();
  if (!city || !country) { showToast('أدخل المدينة والدولة', 'error'); return; }
  state.city = city;
  state.country = country;
  state.method = dom.methodSelect?.value || '4';
  storage.set('city', city);
  storage.set('country', country);
  storage.set('method', state.method);
  loadPrayerTimes();
  showToast('✅ تم حفظ الموقع وتحديث المواقيت', 'success');
}

function resetSettings() {
  if (!confirm('هل تريد إعادة ضبط جميع الإعدادات؟')) return;
  const keys = ['font_size', 'night_mode', 'city', 'country', 'method', 'azan_enabled', 'azan_fajr_enabled', 'auto_save', 'reciter', 'tafsir_edition', 'bar_collapsed', 'player_collapsed', 'bg_id', 'playback_speed'];
  keys.forEach(k => storage.remove(k));
  location.reload();
}

/* ===================== BACKGROUNDS ===================== */

let backgroundsList = [];

async function loadBackgrounds() {
  try {
    const res = await fetch('data/backgrounds.json');
    backgroundsList = await res.json();
    if (dom.bgSelect) {
      dom.bgSelect.innerHTML = '';
      backgroundsList.forEach(bg => {
        const opt = document.createElement('option');
        opt.value = bg.id;
        opt.textContent = bg.name;
        dom.bgSelect.appendChild(opt);
      });
      const savedBg = storage.get('bg_id');
      if (savedBg) applyBackground(savedBg);
    }
  } catch (e) { console.warn('فشل تحميل قائمة الخلفيات', e); }
}

function applyBackground(bgId) {
  if (!bgId || bgId === 'none') {
    document.body.style.backgroundImage = '';
    document.body.classList.remove('bg-css');
    const style = document.getElementById('dynamic-bg-style');
    if (style) style.remove();
    storage.remove('bg_id');
    if (dom.bgSelect) dom.bgSelect.value = 'none';
    return;
  }
  const bg = backgroundsList.find(b => b.id === bgId);
  if (!bg) return;
  if (bg.type === 'css' && bg.css) {
    document.body.style.backgroundImage = '';
    document.body.classList.add('bg-css');
    document.body.setAttribute('data-bg-css', bg.css);
    const style = document.createElement('style');
    style.id = 'dynamic-bg-style';
    style.textContent = `body[data-bg-css] { --bg-css-value: ${bg.css} !important; }`;
    const existing = document.getElementById('dynamic-bg-style');
    if (existing) existing.remove();
    document.head.appendChild(style);
  }
  storage.set('bg_id', bgId);
  if (dom.bgSelect) dom.bgSelect.value = bgId;
}

function restoreSettings() {
  const fs = storage.get('font_size'); if (fs) applyFontSize(fs);
  const nm = storage.get('night_mode'); if (nm === true) applyNightMode(true);
  const city = storage.get('city'); if (city) state.city = city;
  const country = storage.get('country'); if (country) state.country = country;
  const method = storage.get('method'); if (method) state.method = method;
  const azan = storage.get('azan_enabled'); if (azan === false) state.azanEnabled = false;
  const azanFajr = storage.get('azan_fajr_enabled'); if (azanFajr === false) state.azanFajrEnabled = false;
  const as = storage.get('auto_save'); if (as === false) state.autoSave = false;
  const rec = storage.get('reciter'); if (rec) state.currentReciter = rec;
  const taf = storage.get('tafsir_edition'); if (taf) state.currentTafsirEdition = taf;
  const bar = storage.get('bar_collapsed'); if (bar === true) state.barCollapsed = true;
  const transEnabled = storage.get('translation_enabled'); if (transEnabled) state.translationEnabled = true;
  const transEdition = storage.get('translation_edition'); if (transEdition) state.currentTranslation = transEdition;

  if (dom.cityInput) dom.cityInput.value = state.city;
  if (dom.countryInput) dom.countryInput.value = state.country;
  if (dom.methodSelect) dom.methodSelect.value = state.method;
  if (dom.azanToggle) dom.azanToggle.classList.toggle('on', state.azanEnabled);
  if (dom.azanFajrToggle) dom.azanFajrToggle.classList.toggle('on', state.azanFajrEnabled);
  if (dom.autoSaveToggle) dom.autoSaveToggle.classList.toggle('on', state.autoSave);
  if (dom.reciterSelect) dom.reciterSelect.value = state.currentReciter;
  if (dom.tafsirSelect) dom.tafsirSelect.value = state.currentTafsirEdition;
  if (dom.translationToggle) dom.translationToggle.classList.toggle('on', state.translationEnabled);
  if (dom.translationSelect) {
    dom.translationSelect.style.display = state.translationEnabled ? '' : 'none';
    if (state.currentTranslation) dom.translationSelect.value = state.currentTranslation;
  }
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = state.fontSize;
  const speed = storage.get('playback_speed');
  if (speed && dom.speedSelect && dom.audioPlayer) { dom.speedSelect.value = speed; dom.audioPlayer.playbackRate = parseFloat(speed); }
  if (state.barCollapsed && dom.prayerBar) {
    dom.prayerBar.classList.add('collapsed');
    dom.prayerBar.classList.remove('expanded');
  }

  /* Restore adhkar settings */
  if (state.adhkarSettings) {
    if (dom.adhkarEnabledToggle) dom.adhkarEnabledToggle.classList.toggle('on', !!state.adhkarSettings.adhkar_enabled);
    if (dom.adhkarSoundToggle) dom.adhkarSoundToggle.classList.toggle('on', !!state.adhkarSettings.adhkar_sound);
    renderAdhkarSettingsList();
  }
}

/* ===================== VISIBILITY ===================== */

function handleVisibilityChange() {
  if (document.hidden) {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  } else {
    startClock();
  }
}

/* ===================== PRAYER BAR TOGGLE ===================== */

function togglePrayerBar() {
  if (!dom.prayerBar) return;
  state.barCollapsed = !state.barCollapsed;
  if (state.barCollapsed) {
    dom.prayerBar.classList.add('collapsed');
    dom.prayerBar.classList.remove('expanded');
  } else {
    dom.prayerBar.classList.remove('collapsed');
    dom.prayerBar.classList.add('expanded');
  }
  storage.set('bar_collapsed', state.barCollapsed);
}

/* ===================== MUSHARAF MODE ===================== */

async function toggleMushafMode() {
  state.mushafMode = !state.mushafMode;
  if (state.mushafMode) {
    dom.modeToggleBtn.textContent = '📖 وضع السورة';
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
    dom.modeToggleBtn.textContent = '📄 وضع المصحف';
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
    const btn = document.createElement('button');
    btn.className = 'mushaf-surah-overlay-btn';
    btn.textContent = `${s.number}. ${s.name} (${s.englishName})`;
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
    dom.mushafSurahOverlayList.appendChild(btn);
  }
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

/* ===================== ADHKAR ===================== */

function loadAdhkarSettings() {
  state.adhkarSettings = storage.get('adhkar_settings') || getDefaultAdhkarSettings();
}

function saveAdhkarSettings() {
  storage.set('adhkar_settings', state.adhkarSettings);
}

function toggleAdhkarPanel() {
  state.adhkarPanelOpen = !state.adhkarPanelOpen;
  dom.adhkarPanel?.classList.toggle('open', state.adhkarPanelOpen);
  if (state.adhkarPanelOpen) {
    renderAdhkarTabs();
    if (!state.adhkarActiveTab) state.adhkarActiveTab = ADHKAR_DATA.categories[0].id;
    switchAdhkarTab(state.adhkarActiveTab);
  }
}

function closeAdhkarPanel() {
  state.adhkarPanelOpen = false;
  dom.adhkarPanel?.classList.remove('open');
}

function renderAdhkarTabs() {
  if (!dom.adhkarTabs) return;
  let html = '';
  for (const cat of ADHKAR_DATA.categories) {
    html += `<button class="adhkar-tab${state.adhkarActiveTab === cat.id ? ' active' : ''}" data-category="${cat.id}">${cat.icon} ${cat.name}</button>`;
  }
  const personalLabel = '📝 أذكاري';
  html += `<button class="adhkar-tab${state.adhkarActiveTab === 'personal' ? ' active' : ''}" data-category="personal">📝 أذكاري</button>`;
  dom.adhkarTabs.innerHTML = html;
  dom.adhkarTabs.querySelectorAll('.adhkar-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAdhkarTab(btn.dataset.category));
  });
}

function switchAdhkarTab(categoryId) {
  state.adhkarActiveTab = categoryId;
  document.querySelectorAll('.adhkar-tab').forEach(t => t.classList.toggle('active', t.dataset.category === categoryId));
  renderAdhkarCategory(categoryId);
}

function renderAdhkarCategory(categoryId) {
  if (!dom.adhkarContent) return;
  if (categoryId === 'personal') {
    renderPersonalAdhkar();
    return;
  }
  const cat = ADHKAR_DATA.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const settings = state.adhkarSettings;
  const catSettings = settings[cat.id] || {};
  const enabled = !!catSettings.enabled;
  const notifTime = catSettings.time || cat.defaultTime || '';
  const notifDur = catSettings.duration ?? cat.defaultDuration ?? 1;
  let html = `<div class="adhkar-category-title">${cat.icon} ${cat.name}</div>
    <div class="adhkar-category-options" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;padding:8px 12px;background:var(--controls-bg);border-radius:8px;">
      <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;">
        <div class="adhkar-cat-toggle toggle-switch${enabled ? ' on' : ''}" data-category="${cat.id}" role="switch" style="transform:scale(0.85);"></div>
        تذكير
      </label>
      <label style="display:flex;align-items:center;gap:4px;font-size:13px;">
        ⏰ <input type="time" class="adhkar-cat-time" data-category="${cat.id}" value="${notifTime}" style="border:1px solid var(--border-soft);border-radius:6px;padding:2px 6px;font-size:12px;font-family:inherit;background:var(--select-bg);color:var(--text-primary);width:80px;">
      </label>
      <label style="display:flex;align-items:center;gap:4px;font-size:13px;">
        🔔 <input type="number" class="adhkar-cat-duration" data-category="${cat.id}" value="${notifDur}" min="1" max="60" style="border:1px solid var(--border-soft);border-radius:6px;padding:2px 6px;font-size:12px;font-family:inherit;background:var(--select-bg);color:var(--text-primary);width:50px;"> دقيقة
      </label>
      <span style="font-size:11px;color:var(--text-muted);">${enabled ? '✅ التنبيه مفعّل' : '⏸ التنبيه متوقف'}</span>
    </div>`;
  for (const item of cat.items) {
    const counter = settings[`item_${item.id}`] || 0;
    const remaining = Math.max(0, item.count - counter);
    const completed = counter >= item.count;
    const pct = Math.min(100, (counter / item.count) * 100);
    html += `<div class="adhkar-item${completed ? ' completed' : ''}" data-item-id="${item.id}" data-category="${categoryId}">
      <div class="adhkar-item-text">${item.text}</div>
      <div class="adhkar-progress-bar"><div class="adhkar-progress-fill" style="width:${pct}%"></div></div>
      <div class="adhkar-item-meta">
        <span class="adhkar-item-count">🔄 ${item.count} مرة — متبقي ${remaining}</span>
        <span class="adhkar-item-reference">📚 ${item.reference}</span>
        <div class="adhkar-counter">
          <button class="adhkar-counter-btn${completed ? ' completed' : ''}" data-action="increment" data-item-id="${item.id}" data-category="${categoryId}">✓</button>
          <span class="adhkar-counter-text">${counter}</span>
        </div>
      </div>
    </div>`;
  }
  html += `<button class="adhkar-add-btn" data-action="reset" data-category="${categoryId}">🔄 إعادة تعيين الكل</button>`;
  dom.adhkarContent.innerHTML = html;

  dom.adhkarContent.querySelectorAll('[data-action="increment"]').forEach(btn => {
    btn.addEventListener('click', () => handleAdhkarCounter(btn.dataset.itemId, btn.dataset.category));
  });
  dom.adhkarContent.querySelectorAll('[data-action="reset"]').forEach(btn => {
    btn.addEventListener('click', () => resetAdhkarCounters(btn.dataset.category));
  });

  /* Category options (toggle, time, duration) */
  dom.adhkarContent.querySelectorAll('.adhkar-cat-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const catId = el.dataset.category;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].enabled = el.classList.toggle('on');
      saveAdhkarSettings();
      renderAdhkarCategory(catId);
    });
  });
  dom.adhkarContent.querySelectorAll('.adhkar-cat-time').forEach(el => {
    el.addEventListener('change', () => {
      const catId = el.dataset.category;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].time = el.value;
      saveAdhkarSettings();
    });
  });
  dom.adhkarContent.querySelectorAll('.adhkar-cat-duration').forEach(el => {
    el.addEventListener('change', () => {
      const catId = el.dataset.category;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].duration = parseInt(el.value, 10) || 1;
      saveAdhkarSettings();
    });
  });
}

function handleAdhkarCounter(itemId, categoryId) {
  const cat = ADHKAR_DATA.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const item = cat.items.find(i => i.id === itemId);
  if (!item) return;
  const key = `item_${item.id}`;
  const current = state.adhkarSettings[key] || 0;
  if (current >= item.count) {
    state.adhkarSettings[key] = 0;
  } else {
    state.adhkarSettings[key] = current + 1;
  }
  saveAdhkarSettings();
  renderAdhkarCategory(categoryId);
}

function resetAdhkarCounters(categoryId) {
  const cat = ADHKAR_DATA.categories.find(c => c.id === categoryId);
  if (!cat) return;
  for (const item of cat.items) {
    state.adhkarSettings[`item_${item.id}`] = 0;
  }
  saveAdhkarSettings();
  renderAdhkarCategory(categoryId);
  showToast('🔄 تم إعادة تعيين الأذكار', 'success');
}

/* ===== الأذكار الشخصية ===== */

function renderPersonalAdhkar() {
  if (!dom.adhkarContent) return;
  const personal = state.adhkarSettings.personal_adhkar || [];
  let html = '<div class="adhkar-category-title">📝 أذكاري</div>';
  html += '<button class="adhkar-add-btn" id="openAddAdhkarBtn">➕ إضافة ذكر جديد</button>';
  if (!personal.length) {
    html += '<p style="text-align:center;color:#888;padding:20px;">📝 لم تضف أي ذكر شخصي بعد</p>';
  } else {
    for (const p of personal) {
      const counter = state.adhkarSettings[`item_personal_${p.id}`] || 0;
      const remaining = Math.max(0, p.count - counter);
      const completed = counter >= p.count;
      const pct = Math.min(100, (counter / p.count) * 100);
      html += `<div class="adhkar-item${completed ? ' completed' : ''}" data-item-id="personal_${p.id}">
        <div class="adhkar-item-text">${escapeHtml(p.text)}</div>
        <div class="adhkar-progress-bar"><div class="adhkar-progress-fill" style="width:${pct}%"></div></div>
        <div class="adhkar-item-meta">
          <span class="adhkar-item-count">🔄 ${p.count} مرة — متبقي ${remaining}</span>
          <span class="adhkar-item-reference">${p.time ? '⏰ ' + p.time : ''}</span>
          <div class="adhkar-personal-actions">
            <button class="adhkar-personal-btn edit" data-action="edit-personal" data-id="${p.id}">✏️</button>
            <button class="adhkar-personal-btn delete" data-action="delete-personal" data-id="${p.id}">🗑️</button>
          </div>
          <div class="adhkar-counter">
            <button class="adhkar-counter-btn${completed ? ' completed' : ''}" data-action="increment-personal" data-id="${p.id}">✓</button>
            <span class="adhkar-counter-text">${counter}</span>
          </div>
        </div>
      </div>`;
    }
  }
  dom.adhkarContent.innerHTML = html;

  document.getElementById('openAddAdhkarBtn')?.addEventListener('click', openAdhkarAddDialog);
  dom.adhkarContent.querySelectorAll('[data-action="increment-personal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const personal = state.adhkarSettings.personal_adhkar || [];
      const p = personal.find(x => x.id === btn.dataset.id);
      if (!p) return;
      const key = `item_personal_${p.id}`;
      const current = state.adhkarSettings[key] || 0;
      if (current >= p.count) {
        state.adhkarSettings[key] = 0;
      } else {
        state.adhkarSettings[key] = current + 1;
      }
      saveAdhkarSettings();
      renderPersonalAdhkar();
    });
  });
  dom.adhkarContent.querySelectorAll('[data-action="edit-personal"]').forEach(btn => {
    btn.addEventListener('click', () => editPersonalAdhkar(btn.dataset.id));
  });
  dom.adhkarContent.querySelectorAll('[data-action="delete-personal"]').forEach(btn => {
    btn.addEventListener('click', () => deletePersonalAdhkar(btn.dataset.id));
  });
}

function openAdhkarAddDialog() {
  if (!dom.adhkarAddOverlay) return;
  dom.adhkarAddOverlay.style.display = 'flex';
  dom.adhkarAddText.value = '';
  dom.adhkarAddCount.value = 1;
  dom.adhkarAddTime.value = '';
  dom.adhkarAddDuration.value = 1;
  dom.adhkarAddOverlay.dataset.editId = '';
}

function closeAdhkarAddDialog() {
  if (dom.adhkarAddOverlay) dom.adhkarAddOverlay.style.display = 'none';
}

function savePersonalAdhkar() {
  const text = dom.adhkarAddText?.value.trim();
  if (!text) { showToast('📝 أدخل نص الذكر', 'error'); return; }
  const count = parseInt(dom.adhkarAddCount?.value, 10) || 1;
  const time = dom.adhkarAddTime?.value || null;
  const duration = parseInt(dom.adhkarAddDuration?.value, 10) || 1;
  const editId = dom.adhkarAddOverlay?.dataset.editId || '';
  if (!state.adhkarSettings.personal_adhkar) state.adhkarSettings.personal_adhkar = [];

  if (editId) {
    const p = state.adhkarSettings.personal_adhkar.find(x => x.id === editId);
    if (p) {
      p.text = text;
      p.count = count;
      p.time = time;
      p.duration = duration;
    }
  } else {
    const newItem = { id: 'pa_' + Date.now(), text, count, time, duration };
    state.adhkarSettings.personal_adhkar.push(newItem);
  }
  saveAdhkarSettings();
  closeAdhkarAddDialog();
  renderPersonalAdhkar();
  showToast(editId ? '✏️ تم تعديل الذكر' : '✅ تم إضافة الذكر', 'success');
}

function editPersonalAdhkar(id) {
  const p = state.adhkarSettings.personal_adhkar?.find(x => x.id === id);
  if (!p) return;
  if (!dom.adhkarAddOverlay) return;
  dom.adhkarAddOverlay.style.display = 'flex';
  dom.adhkarAddOverlay.dataset.editId = id;
  dom.adhkarAddText.value = p.text;
  dom.adhkarAddCount.value = p.count;
  dom.adhkarAddTime.value = p.time || '';
  dom.adhkarAddDuration.value = p.duration || 1;
}

function deletePersonalAdhkar(id) {
  if (!confirm('🗑️ هل تريد حذف هذا الذكر؟')) return;
  state.adhkarSettings.personal_adhkar = (state.adhkarSettings.personal_adhkar || []).filter(x => x.id !== id);
  delete state.adhkarSettings[`item_personal_${id}`];
  saveAdhkarSettings();
  renderPersonalAdhkar();
  showToast('🗑️ تم حذف الذكر', '');
}

/* ===== إشعارات الأذكار ===== */

function checkAdhkarNotifications() {
  if (!state.adhkarSettings?.adhkar_enabled) return;
  const now = new Date();
  const curMin = now.getHours() * 60 + now.getMinutes();
  const today = now.toDateString();

  for (const cat of ADHKAR_DATA.categories) {
    const catSettings = state.adhkarSettings[cat.id];
    if (!catSettings?.enabled) continue;
    const notifTime = catSettings.time || cat.defaultTime;
    if (!notifTime) continue;
    const [h, m] = notifTime.split(':').map(Number);
    const catMin = h * 60 + m;
    const fireKey = cat.id + '_' + today;
    if (curMin >= catMin && state.lastAdhkarFired !== fireKey) {
      state.lastAdhkarFired = fireKey;
      const notifDuration = catSettings.duration ?? cat.defaultDuration ?? 1;
      showAdhkarNotification(cat, notifDuration);
      return;
    }
  }

  for (const p of (state.adhkarSettings.personal_adhkar || [])) {
    if (!p.time) continue;
    const [h, m] = p.time.split(':').map(Number);
    const pMin = h * 60 + m;
    const fireKey = 'personal_' + p.id + '_' + today;
    if (curMin >= pMin && state.lastAdhkarFired !== fireKey) {
      state.lastAdhkarFired = fireKey;
      showAdhkarNotification({ id: 'personal', _personalId: p.id, icon: '📝', name: p.text, duration: p.duration || 1 });
      return;
    }
  }
}

function showAdhkarNotification(cat, notifDuration) {
  if (!dom.adhkarNotification) return;
  dom.adhkarNotifIcon.textContent = cat.icon || '🕌';
  dom.adhkarNotifTitle.textContent = `🕌 ${cat.name}`;
  dom.adhkarNotification.dataset.category = cat.id || 'personal';
  dom.adhkarNotification.style.display = 'flex';

  state.adhkarNotifCategory = cat.id;
  state.adhkarNotifItemIndex = 0;
  state.adhkarNotifPersonalId = cat.id === 'personal' ? (cat._personalId || null) : null;

  if (state.adhkarSettings.adhkar_sound) {
    try {
      const audio = new Audio('data/notification.mp3');
      audio.play().catch(() => {});
    } catch (e) {}
  }

  const duration = (notifDuration || cat.duration || 1) * 60 * 1000;
  if (state.adhkarNotificationTimer) clearTimeout(state.adhkarNotificationTimer);
  state.adhkarNotificationTimer = setTimeout(() => {
    dom.adhkarNotification.style.display = 'none';
  }, duration);

  renderNotifAdhkarItem();
}

function renderNotifAdhkarItem() {
  if (!dom.adhkarNotifText) return;
  const catId = state.adhkarNotifCategory;
  if (catId === 'personal') {
    const personal = state.adhkarSettings.personal_adhkar || [];
    const p = personal.find(x => x.id === state.adhkarNotifPersonalId);
    if (p) {
      dom.adhkarNotifText.textContent = p.text;
      dom.adhkarNotifProgress.textContent = `🔄 ${p.count} مرة`;
      dom.adhkarNotifCountBtn.style.display = 'inline-block';
      dom.adhkarNotifCountBtn.onclick = null;
      dom.adhkarNotifCountBtn.onclick = () => {
        const key = `item_personal_${p.id}`;
        const curr = state.adhkarSettings[key] || 0;
        if (curr < p.count) {
          state.adhkarSettings[key] = curr + 1;
        } else {
          state.adhkarSettings[key] = 0;
        }
        saveAdhkarSettings();
        const remaining = Math.max(0, p.count - (state.adhkarSettings[key] || 0));
        dom.adhkarNotifProgress.textContent = `🔄 ${p.count} مرة — متبقي ${remaining}`;
      };
    }
    return;
  }

  const cat = ADHKAR_DATA.categories.find(c => c.id === catId);
  if (!cat) return;
  const items = cat.items.filter(item => {
    const key = `item_${item.id}`;
    const counter = state.adhkarSettings[key] || 0;
    return counter < item.count;
  });

  if (items.length === 0) {
    dom.adhkarNotifText.textContent = '✅ تم إكمال جميع الأذكار لهذا الوقت';
    dom.adhkarNotifProgress.textContent = '';
    dom.adhkarNotifCountBtn.style.display = 'none';
    return;
  }

  const idx = Math.min(state.adhkarNotifItemIndex, items.length - 1);
  const item = items[idx];
  const key = `item_${item.id}`;
  const counter = state.adhkarSettings[key] || 0;
  const remaining = item.count - counter;

  dom.adhkarNotifText.textContent = item.text;
  dom.adhkarNotifProgress.textContent = `🔄 ${item.count} مرة — متبقي ${remaining} — 📚 ${item.reference}`;
  dom.adhkarNotifCountBtn.style.display = 'inline-block';
  dom.adhkarNotifCountBtn.onclick = null;
  dom.adhkarNotifCountBtn.onclick = () => {
    const cur = state.adhkarSettings[key] || 0;
    if (cur < item.count) {
      state.adhkarSettings[key] = cur + 1;
    } else {
      state.adhkarSettings[key] = 0;
    }
    saveAdhkarSettings();
    renderNotifAdhkarItem();
  };
}

function dismissAdhkarNotification() {
  if (dom.adhkarNotification) dom.adhkarNotification.style.display = 'none';
  if (state.adhkarNotificationTimer) {
    clearTimeout(state.adhkarNotificationTimer);
    state.adhkarNotificationTimer = null;
  }
  openAdhkarPanelFromNotif();
}

function openAdhkarPanelFromNotif() {
  const catId = dom.adhkarNotification?.dataset.category;
  if (!state.adhkarPanelOpen) toggleAdhkarPanel();
  if (catId) switchAdhkarTab(catId);
}

/* ===== إعدادات الأذكار في لوحة الإعدادات ===== */

function renderAdhkarSettingsList() {
  if (!dom.adhkarSettingsList) return;
  let html = '';
  for (const cat of ADHKAR_DATA.categories) {
    const s = state.adhkarSettings[cat.id] || {};
    html += `<div class="adhkar-setting-row">
      <div class="adhkar-setting-header">
        <span class="adhkar-setting-label">${cat.icon} ${cat.name}</span>
        <div class="adhkar-setting-toggle">
          <div class="toggle-switch${s.enabled ? ' on' : ''}" data-adhkar-toggle="${cat.id}" role="switch"></div>
        </div>
      </div>
      <div class="adhkar-setting-time">
        ⏰ <input type="time" data-adhkar-time="${cat.id}" value="${s.time || ''}">
        <span>🔔</span>
        <input type="number" data-adhkar-duration="${cat.id}" value="${s.duration ?? cat.defaultDuration ?? 1}" min="1" max="60" style="width:50px;"> دقيقة
      </div>
    </div>`;
  }
  dom.adhkarSettingsList.innerHTML = html;

  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      const catId = el.dataset.adhkarToggle;
      const on = el.classList.toggle('on');
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].enabled = on;
      saveAdhkarSettings();
    });
  });
  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-time]').forEach(el => {
    el.addEventListener('change', () => {
      const catId = el.dataset.adhkarTime;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].time = el.value;
      saveAdhkarSettings();
    });
  });
  dom.adhkarSettingsList.querySelectorAll('[data-adhkar-duration]').forEach(el => {
    el.addEventListener('change', () => {
      const catId = el.dataset.adhkarDuration;
      if (!state.adhkarSettings[catId]) state.adhkarSettings[catId] = {};
      state.adhkarSettings[catId].duration = parseInt(el.value, 10) || 1;
      saveAdhkarSettings();
    });
  });
}

/* ===================== INIT ===================== */

export async function initApp() {
  initState();
  loadingBar.init();
  loadingBar.hide();
  cacheDom();
  loadAdhkarSettings();
  restoreSettings();
  loadFavorites();
  startClock();

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
  dom.adhkarBtn?.addEventListener('click', toggleAdhkarPanel);
  dom.adhkarCloseBtn?.addEventListener('click', closeAdhkarPanel);
  dom.adhkarNotifOpenBtn?.addEventListener('click', () => {
    dismissAdhkarNotification();
    if (!state.adhkarPanelOpen) toggleAdhkarPanel();
    const catId = dom.adhkarNotification?.dataset.category;
    if (catId) switchAdhkarTab(catId);
  });
  dom.adhkarNotifDismissBtn?.addEventListener('click', dismissAdhkarNotification);
  dom.adhkarAddCloseBtn?.addEventListener('click', closeAdhkarAddDialog);
  dom.adhkarAddSaveBtn?.addEventListener('click', savePersonalAdhkar);
  dom.adhkarAddOverlay?.addEventListener('click', (e) => {
    if (e.target === dom.adhkarAddOverlay) closeAdhkarAddDialog();
  });
  dom.adhkarEnabledToggle?.addEventListener('click', () => {
    const on = dom.adhkarEnabledToggle.classList.toggle('on');
    state.adhkarSettings.adhkar_enabled = on;
    saveAdhkarSettings();
  });
  dom.adhkarSoundToggle?.addEventListener('click', () => {
    const on = dom.adhkarSoundToggle.classList.toggle('on');
    state.adhkarSettings.adhkar_sound = on;
    saveAdhkarSettings();
  });
  dom.adhkarPanel?.addEventListener('click', (e) => {
    if (e.target === dom.adhkarPanel) closeAdhkarPanel();
  });

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
