'use strict';

/* ============================================================
   تطبيق القرآن الكريم — عائلة السليماني
   ملف JavaScript الرئيسي (app.js) — النسخة المُصححة والمحسّنة
============================================================ */

/* ============================================================
   1) الإعدادات والثوابت العامة
============================================================ */
const CONFIG = {
  API_BASE: 'https://api.alquran.cloud/v1',
  TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
  PRAYER_API: 'https://api.aladhan.com/v1/timingsByCity',
  AZAN_FILE: 'azan.mp3',
  SURAH_COUNT: 114,
  STORAGE_PREFIX: 'quran_app_',
  DEFAULT_RECITER: 'ar.alafasy',
  DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
  DEFAULT_METHOD: '4',
  DEFAULT_CITY: 'مكة',
  DEFAULT_COUNTRY: 'SA',
  CACHE_LIMIT: 20
};

/* ============================================================
   2) الحالة العامة (State)
============================================================ */
let state = {
  currentSurah: 1,
  currentAyahIndex: 0,
  currentReciter: CONFIG.DEFAULT_RECITER,
  currentTafsirEdition: CONFIG.DEFAULT_TAFSIR,
  surahData: null,
  surahList: [],
  surahCache: new Map(),
  ayahsAudios: [],
  isPlaying: false,
  hifdhMode: false,
  repeatMode: false,
  repeatFrom: 1,
  repeatTo: 1,
  repeatTimes: 3,
  repeatCounter: 0,
  fontSize: 28,
  nightMode: false,
  autoSave: true,
  azanEnabled: true,
  azanFajrEnabled: true,
  city: CONFIG.DEFAULT_CITY,
  country: CONFIG.DEFAULT_COUNTRY,
  method: CONFIG.DEFAULT_METHOD,
  prayerTimes: null,
  lastAzanFired: null,
  favorites: [],
  bookmark: null,
  pendingTafsirAfterLoad: null,
  playerCollapsed: false,
  fullQuranText: null,
  fullQuranLoaded: false,
  barCollapsed: false,
  azanPlaying: false,
  loadingSurah: null,
  mushafMode: false,
  currentPage: 1,
  _smartTvState: 0,
  _smartTvAudioSrc: ''
};

/* ============================================================
   3) مرجع لعناصر DOM
============================================================ */
const dom = {};
function cacheDom() {
  const ids = [
    'cityName','nextPrayerName','nextPrayerTime','countdownDisplay','hijriDateDisplay','weekdayDisplay','gregorianDateDisplay',
    'prayerTimesRows','prayerCountdown','bigClockTime','bigClockDate','bigClockHijri','settingsPanel','settingsCloseBtn','settingsToggleBtn',
    'themeToggle','surahSelect','reciterSelect','searchInput','searchBtn','clearSearchBtn','searchResults','surahContent',
    'cityInput','countryInput','methodSelect','cityQuickSelect','saveLocationBtn','azanToggle','azanFajrToggle','testAzanBtn',
    'fontSizeSelect','autoSaveToggle','resetSettingsBtn','favoritesPanel','favoritesCloseBtn','favoritesList','favoritesOpenBtn',
    'player','collapsePlayerBtn','collapsedExpandBtn','playPauseBtn','collapsedPlayBtn','playerSurahName','playerReciterName','playerCurrentAyah','collapsedInfo',
    'audioPlayer','speedSelect','prevAyahBtn','nextAyahBtn','prevSurahBtn','nextSurahBtn','hifdhBtn','repeatBtn','bookmarkBtn','favoriteBtn','shareBtn',
    'repeatControls','repeatFrom','repeatTo','repeatTimes','shareMenu','azanPlayer','toast','collapseBarBtn','expandBarBtn','prayerBar',
    'tafsirCurtainHandle','tafsirCurtain','tafsirCurtainHeader','tafsirCurtainBody','tafsirSelect','bgSelect','loadingProgress',
    'modeToggleBtn','pageSelect','prevPageBtn','nextPageBtn','mushafControls','surahModeControls',
    'azanNotification','azanNotifStopBtn',
    'mushafSurahListBtn','mushafSurahOverlay','mushafSurahOverlayClose','mushafSurahOverlayList','pageSlider'
  ];
  for (const id of ids) {
    dom[id] = document.getElementById(id);
  }
}

/* ============================================================
   4) كشف الشاشات الذكية (Smart TV / Google TV / Android TV)
============================================================ */
function isSmartTv() {
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /smart.?tv|googletv|android.?tv|tcl|bravia|web0s|netcast|viera|roku|apple.?tv|samsung.?tv/i.test(ua);
  } catch(e) { return false; }
}

/* ============================================================
   5) أدوات التخزين المحلي
============================================================ */
const storage = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem(CONFIG.STORAGE_PREFIX + key);
      return v === null ? def : JSON.parse(v);
    } catch(e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(CONFIG.STORAGE_PREFIX + key, JSON.stringify(val)); } catch(e) {}
  },
  remove(key) {
    try { localStorage.removeItem(CONFIG.STORAGE_PREFIX + key); } catch(e) {}
  }
};

/* ============================================================
   5) شريط التحميل
============================================================ */
const loadingBar = {
  el: null,
  timer: null,
  init() {
    this.el = document.getElementById('loadingProgress');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'loadingProgress';
      this.el.className = 'loading-bar';
      document.body.prepend(this.el);
    }
  },
  show(msg) {
    if (!this.el) this.init();
    this.el.classList.add('active');
    this.el.textContent = msg || '';
    clearTimeout(this.timer);
  },
  hide() {
    if (!this.el) return;
    this.el.classList.remove('active');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (this.el) this.el.textContent = ''; }, 300);
  }
};

/* ============================================================
   6) أدوات مساعدة عامة
============================================================ */
function showToast(msg, type = '') {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.className = 'toast show ' + type;
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function toArabicNumeral(num) {
  const digits = '٠١٢٣٤٥٦٧٨٩';
  return String(num).replace(/\d/g, d => digits[d]);
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pad2(n) { return String(n).padStart(2, '0'); }

function formatTime12(time24) {
  if (!time24) return '—';
  const [h, m] = time24.split(':');
  let hour = parseInt(h, 10);
  const period = hour >= 12 ? 'م' : 'ص';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${period}`;
}

function timeStrToMinutes(t) {
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/* ============================================================
   6) الساعة والتواريخ (هجري وميلادي)
============================================================ */
function updateDates() {
  const now = new Date();
  try {
    const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    if (dom.hijriDateDisplay) dom.hijriDateDisplay.textContent = hijri;
    if (dom.bigClockHijri) dom.bigClockHijri.textContent = '📅 ' + hijri;
  } catch(e) {}
  const weekdays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  if (dom.weekdayDisplay) dom.weekdayDisplay.textContent = weekdays[now.getDay()];
  const greg = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  if (dom.gregorianDateDisplay) dom.gregorianDateDisplay.textContent = greg;
  if (dom.bigClockDate) dom.bigClockDate.textContent = greg;
  const timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
  if (dom.bigClockTime) dom.bigClockTime.textContent = timeStr;
  const collapsedClock = document.getElementById('collapsedClock');
  if (collapsedClock) collapsedClock.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
}

/* ============================================================
   7) مواقيت الصلاة والأذان
============================================================ */
const PRAYER_NAMES_AR = { Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };

async function loadPrayerTimes() {
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
      return;
    }
    throw new Error('Invalid response');
  } catch {
    const cached = storage.get('cached_prayer_times');
    if (cached && cached.date === new Date().toDateString() && cached.city === city && cached.country === country) {
      state.prayerTimes = cached.timings;
      renderPrayerTimes();
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
  const order = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  for (const key of order) {
    const raw = state.prayerTimes[key];
    if (!raw) continue;
    const t = timeStrToMinutes(raw.split(' ')[0]);
    if (t > nowMin) return key;
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

function testAzan() {
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
  const order = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  for (const key of order) {
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

/* ============================================================
   8) قائمة السور وتحويل الترقيم
============================================================ */
async function loadSurahList() {
  const cached = storage.get('surah_list');
  if (cached && cached.length === CONFIG.SURAH_COUNT) {
    state.surahList = cached;
    populateSurahSelect();
    return;
  }
  if (dom.surahSelect) dom.surahSelect.innerHTML = '<option value="">⏳ جاري تحميل قائمة السور...</option>';
  try {
    const res = await fetch(`${CONFIG.API_BASE}/surah`);
    const data = await res.json();
    if (data?.data) {
      state.surahList = data.data;
      storage.set('surah_list', data.data);
      populateSurahSelect();
    }
  } catch(e) {
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

let surahOffsets = null;
function buildSurahOffsets() {
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

/* ============================================================
   9) تحميل السورة وعرضها
============================================================ */
async function loadSurah(surahNum, opts = {}) {
  if (!surahNum) return;
  if (state.loadingSurah === surahNum) return;
  state.loadingSurah = surahNum;
  // إيقاف الصوت الحالي ومسح مصدره قبل تبديل السورة
  if (state.isPlaying) {
    prepareAudioForNewSurah();
  }
  // إيقاف وضع الحفظ والتكرار عند تغيير السورة
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
  const cacheKey = `${surahNum}_${state.currentReciter}`;
  if (state.surahCache.has(cacheKey)) {
    const cached = state.surahCache.get(cacheKey);
    state.surahData = cached.text;
    state.ayahsAudios = cached.audio?.ayahs?.map(a => a.audio) || [];
    renderSurah(cached.text);
    finalizeSurahLoad(opts);
    state.loadingSurah = null;
    return;
  }
  loadingBar.show(`⏳ جاري تحميل سورة ${state.surahList.find(s => s.number === surahNum)?.name || surahNum}...`);
  if (dom.surahContent) dom.surahContent.innerHTML = '<div class="skeleton-loading"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';
  try {
    const [textRes, audioRes] = await Promise.all([
      fetch(`${CONFIG.API_BASE}/surah/${surahNum}/quran-uthmani`),
      fetch(`${CONFIG.API_BASE}/surah/${surahNum}/${state.currentReciter}`)
    ]);
    const textJson = await textRes.json();
    const audioJson = await audioRes.json();
    const textData = textJson?.data;
    const audioData = audioJson?.data;
    if (!textData?.ayahs?.length || !audioData?.ayahs?.length) {
      throw new Error('بيانات السورة غير صالحة');
    }
    state.surahData = textData;
    state.ayahsAudios = audioData.ayahs.map(a => a.audio);
    if (state.surahCache.size >= CONFIG.CACHE_LIMIT) {
      const firstKey = state.surahCache.keys().next().value;
      state.surahCache.delete(firstKey);
    }
    state.surahCache.set(cacheKey, { text: textData, audio: audioData });
    renderSurah(textData);
    finalizeSurahLoad(opts);
    loadingBar.hide();
  } catch(e) {
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
}

function renderSurah(textData) {
  if (!dom.surahContent) return;
  let html = `<h2 class="surah-title">${escapeHtml(textData.name)} — ${escapeHtml(textData.englishName)}</h2>`;
  if (textData.number !== 1 && textData.number !== 9) {
    html += '<p class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>';
  }
  html += `<div class="ayahs-container" style="font-size:${state.fontSize}px">`;
  for (let i = 0; i < textData.ayahs.length; i++) {
    const a = textData.ayahs[i];
    let txt = a.text;
    if (textData.number !== 1 && a.numberInSurah === 1) {
      txt = txt.replace(/^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u, '');
    }
    html += `<span class="ayah" data-index="${i}" data-surah="${textData.number}" data-ayah="${a.numberInSurah}">${escapeHtml(txt)} <span class="ayah-number">${a.numberInSurah}</span></span> `;
  }
  html += '</div>';
  dom.surahContent.innerHTML = html;
  attachAyahEvents();
}

/* ============================================================
   9.5) وضع المصحف
============================================================ */
async function toggleMushafMode() {
  state.mushafMode = !state.mushafMode;
  if (state.mushafMode) {
    dom.modeToggleBtn.textContent = '📖 وضع السورة';
    dom.modeToggleBtn.classList.add('mushaf-active');
    dom.surahModeControls.style.display = 'none';
    dom.mushafControls.style.display = 'flex';
    populatePageSelect();
    
    if (state.currentSurah && state.surahData?.ayahs?.length) {
      const currentAyah = state.surahData.ayahs[state.currentAyahIndex]?.numberInSurah || 1;
      try {
        const res = await fetch(`${CONFIG.API_BASE}/ayah/${state.currentSurah}:${currentAyah}/quran-uthmani`);
        const data = await res.json();
        const page = data?.data?.page;
        if (page && page >= 1 && page <= 604) {
          state.currentPage = page;
          if (dom.pageSelect) dom.pageSelect.value = page;
          if (dom.pageSlider) dom.pageSlider.value = page;
        }
      } catch (e) {
        console.warn('Failed to get page for ayah:', e);
      }
    }
    
    loadPage(state.currentPage);
  } else {
    dom.modeToggleBtn.textContent = '📄 وضع المصحف';
    dom.modeToggleBtn.classList.remove('mushaf-active');
    dom.surahModeControls.style.display = '';
    dom.mushafControls.style.display = 'none';
    
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

async function loadPage(pageNum) {
  if (!pageNum) return;
  state.currentPage = pageNum;
  storage.set('current_page', pageNum);
  loadingBar.show(`⏳ جاري تحميل الصفحة ${pageNum}...`);
  renderMushafPageImage(pageNum);
}

function getJuzForPage(pageNum) {
  const juzPages = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30];
  const juzStarts = [1,22,42,62,82,102,122,142,162,182,202,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];
  let juz = 1;
  for (let i = juzStarts.length - 1; i >= 0; i--) {
    if (pageNum >= juzStarts[i]) { juz = juzPages[i]; break; }
  }
  return juz;
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

function renderMushafPageImage(pageNum) {
  if (!dom.surahContent) return;
  const juz = getJuzForPage(pageNum);
  const padded = String(pageNum).padStart(3, '0');

  const imgUrl = `https://cdn.jsdelivr.net/gh/GovarJabbar/Quran-PNG@master/${padded}.png`;
  const fallbackUrl = `https://cdn.jsdelivr.net/gh/Miftah-Fentaw/Quran_webp@main/${padded}.webp`;

  const html = `<div class="mushaf-container">
    <div class="mushaf-header">
      <div class="mushaf-page-num">صفحة ${toArabicNumeral(pageNum)}</div>
      <div class="mushaf-surah-names" id="mushafSurahNames"></div>
      <div class="mushaf-juz">الجزء ${toArabicNumeral(juz)}</div>
    </div>
    <div class="mushaf-image-wrapper">
      <img class="mushaf-page-img"
           src="${imgUrl}"
           alt="صفحة ${pageNum} من المصحف"
           loading="eager"
           onerror="this.onerror=null; this.src='${fallbackUrl}'; this.classList.add('loaded'); (function(){var e=document.getElementById('loadingProgress');if(e)e.classList.remove('active');})()"
           onload="this.classList.add('loaded'); (function(){var e=document.getElementById('loadingProgress');if(e)e.classList.remove('active');})()">
    </div>
    <div class="mushaf-footer"><span class="mushaf-footer-ornament">۞</span> صفحة ${toArabicNumeral(pageNum)} — القرآن الكريم <span class="mushaf-footer-ornament">۞</span></div>
  </div>
  <div class="mushaf-ayah-bar" id="mushafAyahBar"><div class="mushaf-ayah-bar-title">🎯 اختر آية للاستماع أو التفسير</div><div class="mushaf-ayah-bar-loading">جاري تحميل الآيات...</div></div>`;

  dom.surahContent.innerHTML = html;

  // التحميل المسبق للصفحة التالية
  const nextNum = pageNum + 1;
  if (nextNum <= 604) {
    const nextPadded = String(nextNum).padStart(3, '0');
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `https://cdn.jsdelivr.net/gh/GovarJabbar/Quran-PNG@master/${nextPadded}.png`;
    link.as = 'image';
    document.head.appendChild(link);
  }

  // جلب قائمة الآيات في هذه الصفحة من API
  fetch(`${CONFIG.API_BASE}/page/${pageNum}/quran-uthmani`)
    .then(res => res.json())
    .then(json => {
      const ayahs = json?.data?.ayahs;
      if (!ayahs?.length) return;

      // عرض أسماء السور في رأس الصفحة
      const surahNamesEl = document.getElementById('mushafSurahNames');
      if (surahNamesEl) {
        const seen = {};
        ayahs.forEach(a => { if (!seen[a.surah.number]) { seen[a.surah.number] = a.surah.name; } });
        const namesHtml = Object.values(seen).map(n => `<span class="mushaf-surah-name">📖 ${escapeHtml(n)}</span>`).join(' ');
        surahNamesEl.innerHTML = namesHtml;
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
        btn.addEventListener('click', function() {
          bar.querySelectorAll('.mushaf-ayah-btn').forEach(b => b.classList.remove('current'));
          this.classList.add('current');
          const surah = parseInt(this.dataset.surah, 10);
          const ayah = parseInt(this.dataset.ayah, 10);
          playMushafAyah(surah, ayah);
          loadTafsirForSurahAyah(surah, ayah);
        });
      });
    })
    .catch(() => {});
}

async function loadTafsirForSurahAyah(surahNum, ayahNum) {
  if (!dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition || CONFIG.DEFAULT_TAFSIR;
  const cacheKey = `tafsir_${edition}_${surahNum}_${ayahNum}`;
  const cached = storage.get(cacheKey);
  const surahInfo = state.surahList.find(s => s.number === surahNum);
  const surahName = surahInfo ? surahInfo.name : `سورة ${surahNum}`;
  dom.tafsirCurtainHeader.textContent = `تفسير: ${surahName} — آية ${toArabicNumeral(ayahNum)}`;
  if (cached) {
    dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(cached)}</p>`;
    dom.tafsirCurtain?.classList.add('open');
    return;
  }
  dom.tafsirCurtainBody.innerHTML = '<p class="tafsir-loading">⏳ جاري تحميل التفسير...</p>';
  dom.tafsirCurtain?.classList.add('open');
  try {
    const res = await fetch(`${CONFIG.TAFSIR_API}/${edition}/${surahNum}/${ayahNum}.json`);
    const data = await res.json();
    const text = data?.tafsir?.text || data?.text || 'لا يوجد تفسير متاح';
    storage.set(cacheKey, text);
    dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(text)}</p>`;
  } catch(e) {
    dom.tafsirCurtainBody.innerHTML = '<p class="tafsir-error">⚠️ تعذّر تحميل التفسير</p>';
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

function attachAyahEvents() {
  document.querySelectorAll('.ayah').forEach(el => {
    el.removeEventListener('click', ayahClickHandler);
    el.addEventListener('click', ayahClickHandler);
  });
}

function ayahClickHandler(e) {
  const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
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

function highlightCurrentAyah() {
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
    dom.collapsedInfo.textContent = `${state.surahData.name} (${a.numberInSurah}): ${short}`;
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

/* ============================================================
   10) تشغيل الصوت
============================================================ */
function playCurrentAyah() {
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
}

function togglePlayPause() {
  if (!state.surahData || !dom.audioPlayer) return;
  if (dom.audioPlayer.paused) {
    if (!dom.audioPlayer.src) playCurrentAyah();
    else dom.audioPlayer.play().catch(e => console.warn(e));
  } else {
    dom.audioPlayer.pause();
  }
}

function bindAudioEvents() {
  if (dom.audioPlayer) {
    dom.audioPlayer.removeEventListener('ended', onAudioEnded);
    dom.audioPlayer.addEventListener('ended', onAudioEnded);
    dom.audioPlayer.removeEventListener('play', onAudioPlay);
    dom.audioPlayer.addEventListener('play', onAudioPlay);
    dom.audioPlayer.removeEventListener('pause', onAudioPause);
    dom.audioPlayer.addEventListener('pause', onAudioPause);
    dom.audioPlayer.removeEventListener('error', onAudioError);
    dom.audioPlayer.addEventListener('error', onAudioError);
  }
  if (state._isSmartTv && dom.audioPlayer) {
    dom.audioPlayer.removeEventListener('timeupdate', onSmartTvTimeUpdate);
    dom.audioPlayer.addEventListener('timeupdate', onSmartTvTimeUpdate);
  }
}

function onAudioPlay() { state.isPlaying = true; updatePlayPauseBtn(); }
function onAudioPause() { state.isPlaying = false; updatePlayPauseBtn(); }
function onAudioError() {
  state.isPlaying = false;
  updatePlayPauseBtn();
  showToast('⚠️ تعذّر تشغيل الصوت، حاول آية أخرى', 'error');
}

function onSmartTvTimeUpdate() {
  const audio = dom.audioPlayer;
  if (!audio || !audio.duration || !isFinite(audio.duration) || !audio.src) return;
  if (state._smartTvAudioSrc !== audio.src) {
    state._smartTvAudioSrc = audio.src;
    state._smartTvState = 0;
  }
  if (state._smartTvState !== 0) return;
  if (audio.currentTime >= audio.duration - 0.3 && audio.currentTime > 0.5) {
    state._smartTvState = 1;
    onAudioEnded();
  }
}

function updatePlayPauseBtn() {
  if (dom.playPauseBtn) {
    dom.playPauseBtn.textContent = state.isPlaying ? '⏸ إيقاف' : '⏯ تشغيل';
  }
}

function onAudioEnded() {
  if (!state.surahData || !state.ayahsAudios) return;

  if (state._smartTvState === 1) {
    state._smartTvState = 2;
  } else if (state._smartTvState === 2) {
    state._smartTvState = 0;
    return;
  }

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
        setTimeout(playCurrentAyah, 300);
        return;
      }
    }
    nextAyah(true);
    return;
  }

  // إشعار عند انتهاء السورة كاملة
  if (state.currentAyahIndex === state.ayahsAudios.length - 1) {
    showToast(`✅ انتهت سورة ${state.surahData.name}`, 'success');
  }

  nextAyah(true);
}

function nextAyah(autoFromRepeat) {
  if (!state.surahData || !state.ayahsAudios) return;
  if (state.currentAyahIndex < state.ayahsAudios.length - 1) {
    state.currentAyahIndex++;
    highlightCurrentAyah();
    if (autoFromRepeat || state.isPlaying) setTimeout(playCurrentAyah, 150);
  } else if (state.currentSurah < CONFIG.SURAH_COUNT) {
    nextSurah();
  }
}

function prevAyah() {
  if (!state.surahData) return;
  if (state.currentAyahIndex > 0) {
    state.currentAyahIndex--;
    highlightCurrentAyah();
    if (state.isPlaying) setTimeout(playCurrentAyah, 150);
  } else if (state.currentSurah > 1) {
    prevSurah();
  }
}

function navigateToSurahPage(surahNum, opts = {}) {
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
    loadSurah(surahNum, opts);
  }
}

function nextSurah() { if (state.currentSurah < CONFIG.SURAH_COUNT) navigateToSurahPage(state.currentSurah + 1, { autoPlay: state.isPlaying }); }
function prevSurah() { if (state.currentSurah > 1) navigateToSurahPage(state.currentSurah - 1, { autoPlay: state.isPlaying }); }

/* ============================================================
   11) وضع الحفظ والتكرار
============================================================ */
function toggleHifdh() {
  state.hifdhMode = !state.hifdhMode;
  dom.hifdhBtn?.classList.toggle('active', state.hifdhMode);
  document.querySelectorAll('.ayah').forEach(el => {
    if (state.hifdhMode) el.classList.add('hifdh-mode');
    else el.classList.remove('hifdh-mode', 'revealed');
  });
  if (state.hifdhMode) highlightCurrentAyah();
  showToast(state.hifdhMode ? '🧠 وضع الحفظ مفعّل' : 'وضع الحفظ مغلق', state.hifdhMode ? 'success' : '');
}

function toggleRepeat() {
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
        if (state.repeatFrom > state.repeatTo) {
          state.repeatTo = state.repeatFrom;
          dom.repeatTo.value = state.repeatTo;
        }
        state.repeatCounter = 0;
      };
      dom.repeatTo.onchange = () => {
        state.repeatTo = parseInt(dom.repeatTo.value, 10);
        if (state.repeatTo < state.repeatFrom) {
          state.repeatFrom = state.repeatTo;
          dom.repeatFrom.value = state.repeatFrom;
        }
        state.repeatCounter = 0;
      };
      dom.repeatTimes.onchange = () => { state.repeatTimes = parseInt(dom.repeatTimes.value, 10); state.repeatCounter = 0; };
    }
    showToast('🔁 وضع التكرار مفعّل', 'success');
  } else {
    showToast('التكرار مغلق', '');
  }
}

/* ============================================================
   12) ستارة التفسير
============================================================ */
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
function toggleTafsir() {
  if (!dom.tafsirCurtain) return;
  dom.tafsirCurtain.classList.contains('open') ? closeTafsir() : openTafsir();
}

function renderTafsirContent(text, ayahText, surahName, ayahNum) {
  dom.tafsirCurtainHeader.textContent = `تفسير: ${surahName} — آية ${ayahNum}`;
  dom.tafsirCurtainBody.replaceChildren();
  const titleEl = document.createElement('div');
  titleEl.className = 'tafsir-ayah-title';
  titleEl.textContent = `﴿${ayahText}﴾`;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'tafsir-text';
  bodyEl.textContent = text;
  dom.tafsirCurtainBody.appendChild(titleEl);
  dom.tafsirCurtainBody.appendChild(bodyEl);
}

async function loadTafsirForCurrentAyah() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a || !dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition;
  const cacheKey = `tafsir_${edition}_${state.currentSurah}_${a.numberInSurah}`;
  const cached = storage.get(cacheKey);
  if (cached) {
    renderTafsirContent(cached, a.text, state.surahData.name, a.numberInSurah);
    return;
  }
  const url = `${CONFIG.TAFSIR_API}/${edition}/${state.currentSurah}/${a.numberInSurah}.json`;
  dom.tafsirCurtainHeader.textContent = `تفسير: ${state.surahData.name} — آية ${a.numberInSurah}`;
  dom.tafsirCurtainBody.innerHTML = '<p class="tafsir-loading">⏳ جاري تحميل التفسير...</p>';
  try {
    const res = await fetch(url);
    const data = await res.json();
    const text = data?.text || 'لا يوجد تفسير متاح';
    storage.set(cacheKey, text);
    renderTafsirContent(text, a.text, state.surahData.name, a.numberInSurah);
  } catch(e) {
    dom.tafsirCurtainBody.innerHTML = '<p class="tafsir-error">⚠️ تعذّر تحميل التفسير</p>';
  }
}

/* ============================================================
   13) البحث المحلي
============================================================ */
function normalizeExactText(str) {
  return String(str).replace(/[\u064B-\u065F\u0670]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
}

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
            state.fullQuranLoaded = true;
            console.log('✅ تم تحميل القرآن من IndexedDB');
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
                     surah: surah.number,
                     surahName: surah.name,
                     ayah: ayah.numberInSurah,
                     text: ayahText,
                     normalized: normalizeExactText(ayahText)
                   });
                 }
               }
              state.fullQuranText = ayahs;
              state.fullQuranLoaded = true;
              try {
                const tx2 = db.transaction('fullText', 'readwrite');
                tx2.objectStore('fullText').put({ id: 'fullQuran', data: ayahs });
              } catch(_) {}
              showToast('✅ قاعدة القرآن جاهزة', 'success');
              resolve();
            } catch(err) { console.error(err); resolve(); }
          }
        };
        getReq.onerror = () => resolve();
      } catch(err) { resolve(); }
    };
     request.onerror = () => resolve();
     }
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

let lastSearchCloseHandler = null;

function renderSearchResults(matches, query) {
  if (!dom.searchResults) return;

  // إزالة المستمع السابق لتجنب التراكم
  if (lastSearchCloseHandler) {
    document.removeEventListener('click', lastSearchCloseHandler);
    lastSearchCloseHandler = null;
  }

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
      const s = parseInt(btn.dataset.surah, 10);
      const a = parseInt(btn.dataset.ayah, 10);
      playSpecificAyah(s, a);
    });
  });
  document.querySelectorAll('.search-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = parseInt(btn.dataset.surah, 10);
      const a = parseInt(btn.dataset.ayah, 10);
      copySpecificAyah(s, a);
    });
  });
  document.querySelectorAll('.search-share').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = parseInt(btn.dataset.surah, 10);
      const a = parseInt(btn.dataset.ayah, 10);
      shareSpecificAyah(s, a);
    });
  });
  document.querySelectorAll('.search-goto').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = parseInt(btn.dataset.surah, 10);
      const a = parseInt(btn.dataset.ayah, 10);
      if (dom.surahSelect) dom.surahSelect.value = s;
      loadSurah(s, { startAyah: a });
      dom.searchResults.style.display = 'none';
    });
  });

  lastSearchCloseHandler = (e) => {
    if (!dom.searchResults.contains(e.target) && e.target !== dom.searchBtn && e.target !== dom.searchInput) {
      dom.searchResults.style.display = 'none';
      document.removeEventListener('click', lastSearchCloseHandler);
      lastSearchCloseHandler = null;
    }
  };
  setTimeout(() => document.addEventListener('click', lastSearchCloseHandler), 100);
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
    } catch(e) {}
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
    } catch(e) {}
  }
  const shareMsg = text ? `﴿${text}﴾\n— ${surahName.trim()} — آية ${ayah}` : `الآية ${ayah} من سورة ${surahName.trim()}`;
  if (navigator.share) {
    navigator.share({ title: 'القرآن الكريم', text: shareMsg }).catch(() => {});
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
  try { document.execCommand('copy'); } catch(_) {}
  document.body.removeChild(ta);
}

/* ============================================================
   14) المفضلة والعلامات المرجعية
============================================================ */
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
    state.favorites.push({ key, surah: state.currentSurah, surahName: state.surahData.name, ayah: a.numberInSurah, text: a.text, timestamp: Date.now() });
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
  state.bookmark = { surah: state.currentSurah, surahName: state.surahData.name, ayah: a.numberInSurah, text: a.text, timestamp: Date.now() };
  storage.set('bookmark', state.bookmark);
  showToast('🔖 تم حفظ العلامة', 'success');
}
function gotoBookmark() {
  const bm = state.bookmark || storage.get('bookmark');
  if (!bm) { showToast('لا توجد علامة محفوظة', 'error'); return; }
  if (dom.surahSelect) dom.surahSelect.value = bm.surah;
  loadSurah(bm.surah, { startAyah: bm.ayah });
}

/* ============================================================
   15) المشاركة العامة
============================================================ */
function buildShareText() {
  if (!state.surahData) return '';
  const a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a) return '';
  const surahName = state.surahData.name || '';
  const ayahNum = a.numberInSurah || '';
  const text = a.text || '';
  return `﴿${text}﴾\n— ${surahName} — آية ${ayahNum}`;
}
function toggleShareMenu() { dom.shareMenu?.classList.toggle('show'); }
function shareNative() {
  const text = buildShareText();
  if (!text) return;
  if (navigator.share) {
    navigator.share({ title: 'القرآن الكريم', text }).catch(() => {});
  } else {
    shareCopy();
  }
}
function shareCopy() { copyToClipboard(buildShareText()); showToast('📋 تم نسخ الآية', 'success'); }
function shareWhatsApp() {
  const text = buildShareText();
  if (!text) return;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
function shareTelegram() {
  const text = buildShareText();
  if (!text) return;
  const url = `https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/* ============================================================
   16) حجم الخط
============================================================ */
function applyFontSize(size) {
  state.fontSize = size;
  const container = document.querySelector('.ayahs-container');
  if (container) container.style.fontSize = size + 'px';
  storage.set('font_size', size);
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = size;
}
function onFontSizeChange(e) {
  applyFontSize(parseInt(e.target.value, 10));
}

/* ============================================================
   17) الوضع الليلي والإعدادات
============================================================ */
function applyNightMode(enabled) {
  state.nightMode = enabled;
  if (enabled) document.body.classList.add('night-mode');
  else document.body.classList.remove('night-mode');
  storage.set('night_mode', enabled);
}
function toggleNightMode() { applyNightMode(!state.nightMode); }

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

/* ============================================================
   18) الخلفيات الزخرفية
============================================================ */
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
  } catch(e) { console.warn('فشل تحميل قائمة الخلفيات', e); }
}

function applyBackground(bgId) {
  if (!bgId || bgId === 'none') {
    document.body.style.backgroundImage = '';
    document.body.classList.remove('bg-css');
    let style = document.getElementById('dynamic-bg-style');
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
    // تطبيق الـ CSS كمتغير لتجنب مشاكل الخصوصية
    const style = document.createElement('style');
    style.id = 'dynamic-bg-style';
    style.textContent = `body[data-bg-css] { --bg-css-value: ${bg.css} !important; }`;
    let existing = document.getElementById('dynamic-bg-style');
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

  if (dom.cityInput) dom.cityInput.value = state.city;
  if (dom.countryInput) dom.countryInput.value = state.country;
  if (dom.methodSelect) dom.methodSelect.value = state.method;
  if (dom.azanToggle) dom.azanToggle.classList.toggle('on', state.azanEnabled);
  if (dom.azanFajrToggle) dom.azanFajrToggle.classList.toggle('on', state.azanFajrEnabled);
  if (dom.autoSaveToggle) dom.autoSaveToggle.classList.toggle('on', state.autoSave);
  if (dom.reciterSelect) dom.reciterSelect.value = state.currentReciter;
  if (dom.tafsirSelect) dom.tafsirSelect.value = state.currentTafsirEdition;
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = state.fontSize;
  const speed = storage.get('playback_speed'); if (speed && dom.speedSelect && dom.audioPlayer) { dom.speedSelect.value = speed; dom.audioPlayer.playbackRate = parseFloat(speed); }
  if (state.barCollapsed && dom.prayerBar) {
    dom.prayerBar.classList.add('collapsed');
    dom.prayerBar.classList.remove('expanded');
  }
}

/* ============================================================
   18) شريط علوي قابل للطي
============================================================ */
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

/* ============================================================
   19) تهيئة التطبيق وربط الأحداث
============================================================ */
async function initApp() {
  loadingBar.init();
  loadingBar.hide();
  cacheDom();
  restoreSettings();
  loadFavorites();
  updateDates();
  setInterval(() => { updateDates(); if (state.prayerTimes) updateCountdowns(); }, 1000);
  setInterval(checkAzanTime, 20000);

  await loadSurahList();
  buildSurahOffsets();
  const last = storage.get('last_position');
  if (last && last.surah) {
    state.currentSurah = last.surah;
    await loadSurah(last.surah, { startAyah: last.ayahNumberInSurah || 1 });
  } else {
    await loadSurah(1);
  }
  loadPrayerTimes();
  loadFullQuranText().catch(console.warn);
  loadBackgrounds().catch(console.warn);

  state._isSmartTv = isSmartTv();
  bindAudioEvents();

  dom.surahSelect?.addEventListener('change', () => {
    if (!dom.surahSelect.value) return;
    const surahNum = parseInt(dom.surahSelect.value, 10);
    if (state.mushafMode) {
      // في وضع المصحف: انتقل إلى أول صفحة لهذه السورة
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
      // في وضع السورة: تحميل السورة كالمعتاد
      loadSurah(surahNum);
    }
  });
  dom.reciterSelect?.addEventListener('change', () => {
    state.currentReciter = dom.reciterSelect.value;
    storage.set('reciter', state.currentReciter);
    if (state.currentSurah) loadSurah(state.currentSurah);
  });
  dom.prevAyahBtn?.addEventListener('click', prevAyah);
  dom.nextAyahBtn?.addEventListener('click', nextAyah);
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
  dom.azanNotification?.addEventListener('click', (e) => { if (e.target === dom.azanNotification) stopAzan(); });
  dom.azanPlayer?.addEventListener('ended', () => {
    state.azanPlaying = false;
    if (dom.testAzanBtn) dom.testAzanBtn.textContent = '▶️ اختبار الأذان';
    hideAzanNotification();
  });
  dom.resetSettingsBtn?.addEventListener('click', resetSettings);
  dom.bgSelect?.addEventListener('change', () => { applyBackground(dom.bgSelect.value); });
  dom.collapsePlayerBtn?.addEventListener('click', () => {
    dom.player?.classList.toggle('collapsed');
    storage.set('player_collapsed', dom.player?.classList.contains('collapsed'));
  });
  dom.collapsedExpandBtn?.addEventListener('click', () => dom.player?.classList.remove('collapsed'));
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
  dom.fontSizeSelect?.addEventListener('change', onFontSizeChange);
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

  document.addEventListener('click', (e) => {
    if (!dom.shareMenu?.contains(e.target) && e.target !== dom.shareBtn) dom.shareMenu?.classList.remove('show');
  });

  /* ========== وضع المصحف ========== */
  dom.modeToggleBtn?.addEventListener('click', toggleMushafMode);
  dom.pageSelect?.addEventListener('change', () => {
    if (dom.pageSelect.value) { const p = parseInt(dom.pageSelect.value, 10); if (dom.pageSlider) dom.pageSlider.value = p; loadPage(p); }
  });
  dom.prevPageBtn?.addEventListener('click', () => {
    const p = state.currentPage - 1;
    if (p >= 1) { dom.pageSelect.value = p; if (dom.pageSlider) dom.pageSlider.value = p; loadPage(p); }
  });
  dom.nextPageBtn?.addEventListener('click', () => {
    const p = state.currentPage + 1;
    if (p <= 604) { dom.pageSelect.value = p; if (dom.pageSlider) dom.pageSlider.value = p; loadPage(p); }
  });
  dom.mushafSurahListBtn?.addEventListener('click', () => {
    if (!state.surahList.length) { showToast('قائمة السور غير متاحة', 'error'); return; }
    populateSurahOverlay();
    if (dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'flex';
  });
  dom.mushafSurahOverlayClose?.addEventListener('click', () => { if (dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.mushafSurahOverlay?.addEventListener('click', (e) => { if (e.target === dom.mushafSurahOverlay) dom.mushafSurahOverlay.style.display = 'none'; });
  dom.pageSlider?.addEventListener('input', () => {
    const p = parseInt(dom.pageSlider.value, 10);
    if (dom.pageSelect) dom.pageSelect.value = p;
    state.currentPage = p;
    loadPage(p);
  });

  // استعادة وضع المصحف إن كان مفعّلاً سابقاً
  const savedMushaf = storage.get('mushaf_mode');
  const savedPage = storage.get('current_page');
  if (savedPage) state.currentPage = savedPage;
  if (savedMushaf && dom.modeToggleBtn) toggleMushafMode();

  // اختصارات لوحة المفاتيح (مُصححة لتطابق README)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.azanPlaying) { stopAzan(); return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
    else if (e.key === 'ArrowLeft') prevAyah();      // ← الآية السابقة
    else if (e.key === 'ArrowRight') nextAyah();     // → الآية التالية
    else if (e.key === 's' || e.key === 'S') prevSurah();
    else if (e.key === 'd' || e.key === 'D') nextSurah();
    else if (e.key === 'h' || e.key === 'H') toggleHifdh();
    else if (e.key === 'r' || e.key === 'R') toggleRepeat();
    else if (e.key === 'b' || e.key === 'B') setBookmark();
    else if (e.key === 'f' || e.key === 'F') toggleFavorite();
    else if (e.key === 't' || e.key === 'T') toggleTafsir();
    else if (e.key === 'n' || e.key === 'N') toggleNightMode();
    else if (e.key === 'm' || e.key === 'M') toggleMushafMode();
    else if (e.key === '+' || e.key === '=') { applyFontSize(Math.min(45, state.fontSize + 2)); }
    else if (e.key === '-') { applyFontSize(Math.max(16, state.fontSize - 2)); }
    else if (e.key === 'Escape') {
      closeSettings(); closeFavorites();
      if (dom.searchResults) dom.searchResults.style.display = 'none';
      if (dom.shareMenu) dom.shareMenu.classList.remove('show');
      closeTafsir();
    }
  });

  const savedPlayerCollapsed = storage.get('player_collapsed');
  if (savedPlayerCollapsed && dom.player) dom.player.classList.add('collapsed');

  // تسجيل Service Worker للعمل أوفلاين
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('SW registration failed:', err));
    });
  }
}

initApp();
