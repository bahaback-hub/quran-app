'use strict';

/* ============================================================
   تطبيق القرآن الكريم — عائلة السليماني
   ملف JavaScript الرئيسي (app.js) — نسخة متكاملة مع دعم البحث الجذري
============================================================ */

/* ============================================================
   1) الإعدادات والثوابت العامة
============================================================ */
var CONFIG = {
  API_BASE: 'https://api.alquran.cloud/v1',
  TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
  PRAYER_API: 'https://api.aladhan.com/v1/timingsByCity',
  ROOTS_FILE: 'data/quranRoots.json',
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
var state = {
  currentSurah: 1,
  currentAyahIndex: 0,
  currentReciter: CONFIG.DEFAULT_RECITER,
  currentTafsirEdition: CONFIG.DEFAULT_TAFSIR,
  surahData: null,
  surahList: [],
  audioCache: new Map(),
  surahCache: new Map(),
  rootsData: null,
  rootsLoaded: false,
  isPlaying: false,
  hifdhMode: false,
  repeatMode: false,
  repeatFrom: 1,
  repeatTo: 1,
  repeatTimes: 3,
  repeatCounter: 0,
  fontSize: 26,
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
  searchType: 'exact',
  pendingTafsirAfterLoad: null,
  playerCollapsed: false,
  // متغيرات البحث المحلي
  fullQuranText: null,
  fullQuranLoaded: false,
  db: null
};

/* ============================================================
   3) مرجع لعناصر DOM
============================================================ */
var dom = {};
function cacheDom() {
  var ids = [
    'tafsirCurtainHandle','tafsirCurtain','tafsirCurtainHeader','tafsirCurtainBody','tafsirSelect',
    'prayerBarClock','prayerBarNext','prayerBarCity','prayerBarCityName','settingsToggleBtn',
    'themeToggle','surahSelect','reciterSelect','searchType','searchInput','searchBtn','clearSearchBtn',
    'searchResults','surahContent',
    'settingsPanel','settingsClose','bigClockTime','bigClockDate','bigClockHijri',
    'prayerTimesTitle','prayerTimesRows','prayerCountdown',
    'cityInput','countryInput','methodSelect','cityQuickSelect','saveLocationBtn',
    'azanToggle','azanFajrToggle','testAzanBtn',
    'fontSizeSelect','autoSaveToggle','favoritesOpenBtn','resetSettingsBtn',
    'favoritesPanel','favoritesClose','favoritesList',
    'player','collapseBtn','playerSurahName','playerReciterName','playerCurrentAyah',
    'audioPlayer','prevAyahBtn','nextAyahBtn','prevSurahBtn','nextSurahBtn',
    'hifdhBtn','repeatBtn','bookmarkBtn','favoriteBtn','shareBtn','fontBtn',
    'repeatControls','repeatFrom','repeatTo','repeatTimes',
    'collapsedExpandBtn','collapsedInfo','collapsedPlayBtn',
    'shareMenu','azanPlayer','toast'
  ];
  for (var i = 0; i < ids.length; i++) {
    dom[ids[i]] = document.getElementById(ids[i]);
  }
}

/* ============================================================
   4) أدوات localStorage الآمنة
============================================================ */
var storage = {
  get: function(key, def) {
    if (def === undefined) def = null;
    try {
      var v = localStorage.getItem(CONFIG.STORAGE_PREFIX + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set: function(key, val) {
    try { localStorage.setItem(CONFIG.STORAGE_PREFIX + key, JSON.stringify(val)); }
    catch (e) { console.warn('storage.set failed:', e); }
  },
  remove: function(key) {
    try { localStorage.removeItem(CONFIG.STORAGE_PREFIX + key); } catch (e) {}
  }
};

/* ============================================================
   5) أدوات مساعدة عامة
============================================================ */
function showToast(message, type) {
  if (!dom.toast) return;
  if (!type) type = '';
  dom.toast.textContent = message;
  dom.toast.className = 'toast show ' + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function() {
    dom.toast.classList.remove('show');
  }, 2400);
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function formatTime12(timeStr) {
  if (!timeStr || timeStr.indexOf(':') === -1) return '—';
  var parts = timeStr.split(':');
  var h = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var period = h >= 12 ? 'م' : 'ص';
  var h12 = (h % 12) || 12;
  return pad2(h12) + ':' + pad2(m) + ' ' + period;
}

function timeStrToMinutes(timeStr) {
  if (!timeStr || timeStr.indexOf(':') === -1) return -1;
  var parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function fetchJSON(url, opts) {
  if (!opts) opts = {};
  var ctrl = new AbortController();
  var timeout = opts.timeout || 15000;
  var timer = setTimeout(function() { ctrl.abort(); }, timeout);
  var fetchOpts = { signal: ctrl.signal };
  if (opts.method) fetchOpts.method = opts.method;
  if (opts.headers) fetchOpts.headers = opts.headers;
  return fetch(url, fetchOpts)
    .then(function(res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .catch(function(err) {
      clearTimeout(timer);
      throw err;
    });
}

/* ============================================================
   6) الساعة والتاريخ (ميلادي + هجري)
============================================================ */
function updateClocks() {
  var now = new Date();
  var timeStr = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());

  if (dom.prayerBarClock) dom.prayerBarClock.textContent = timeStr;
  if (dom.bigClockTime) dom.bigClockTime.textContent = timeStr;

  if (dom.bigClockDate) {
    try {
      dom.bigClockDate.textContent = now.toLocaleDateString('ar-EG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) { dom.bigClockDate.textContent = now.toDateString(); }
  }

  if (dom.bigClockHijri) {
    try {
      var hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(now);
      dom.bigClockHijri.textContent = '📅 ' + hijri;
    } catch (e) {
      dom.bigClockHijri.textContent = '';
    }
  }
}

/* ============================================================
   7) مواقيت الصلاة (مع كاش يومي)
============================================================ */
var PRAYER_NAMES_AR = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء'
};

function loadPrayerTimes() {
  var url = CONFIG.PRAYER_API
    + '?city=' + encodeURIComponent(state.city)
    + '&country=' + encodeURIComponent(state.country)
    + '&method=' + encodeURIComponent(state.method);

  return fetchJSON(url, { timeout: 12000 })
    .then(function(data) {
      if (data && data.code === 200 && data.data && data.data.timings) {
        state.prayerTimes = data.data.timings;
        storage.set('cached_prayer_times', {
          date: new Date().toDateString(),
          timings: state.prayerTimes,
          city: state.city,
          country: state.country
        });
        renderPrayerTimes();
        return true;
      }
      throw new Error('Invalid prayer API response');
    })
    .catch(function(err) {
      console.warn('فشل تحميل المواقيت، محاولة الكاش:', err);
      var cached = storage.get('cached_prayer_times');
      if (cached && cached.timings
          && cached.date === new Date().toDateString()
          && cached.city === state.city
          && cached.country === state.country) {
        state.prayerTimes = cached.timings;
        renderPrayerTimes();
        showToast('عرض المواقيت من الكاش المحلي', 'success');
        return true;
      }
      showToast('تعذّر تحميل مواقيت الصلاة', 'error');
      return false;
    });
}

function renderPrayerTimes() {
  if (!state.prayerTimes) return;

  if (dom.prayerTimesTitle) {
    dom.prayerTimesTitle.textContent = '🕌 مواقيت الصلاة — ' + state.city;
  }

  if (dom.prayerBarCityName) {
    dom.prayerBarCityName.textContent = state.city;
  }

  if (dom.prayerTimesRows) {
    var order = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
    var next = getNextPrayerKey();
    var html = '';
    for (var i = 0; i < order.length; i++) {
      var key = order[i];
      var raw = state.prayerTimes[key] || '';
      var time24 = raw.split(' ')[0];
      var nextClass = (key === next) ? ' next-prayer' : '';
      html += '<div class="prayer-row' + nextClass + '">'
            + '<span class="prayer-name">' + PRAYER_NAMES_AR[key] + '</span>'
            + '<span class="prayer-time">' + formatTime12(time24) + '</span>'
            + '</div>';
    }
    dom.prayerTimesRows.innerHTML = html;
  }

  updatePrayerCountdown();
}

function getNextPrayerKey() {
  if (!state.prayerTimes) return null;
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var order = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
  for (var i = 0; i < order.length; i++) {
    var key = order[i];
    var raw = state.prayerTimes[key];
    if (!raw) continue;
    var t = timeStrToMinutes(raw.split(' ')[0]);
    if (t > nowMin) return key;
  }
  return 'Fajr';
}

function updatePrayerCountdown() {
  if (!state.prayerTimes) return;
  var next = getNextPrayerKey();
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var raw = state.prayerTimes[next] || '';
  var nextMin = timeStrToMinutes(raw.split(' ')[0]);
  if (nextMin <= nowMin) nextMin += 24 * 60;
  var diff = nextMin - nowMin;
  var h = Math.floor(diff / 60);
  var m = diff % 60;
  var s = 60 - now.getSeconds();

  var txt = PRAYER_NAMES_AR[next] + ' — بعد ' + pad2(h) + ':' + pad2(m) + ':' + pad2(s);
  if (dom.prayerCountdown) dom.prayerCountdown.textContent = txt;
  if (dom.prayerBarNext) {
    var time24 = (state.prayerTimes[next] || '').split(' ')[0];
    dom.prayerBarNext.textContent = PRAYER_NAMES_AR[next] + ' ' + formatTime12(time24);
  }
}

/* ============================================================
   8) الأذان التلقائي
============================================================ */
function checkAzanTime() {
  if (!state.prayerTimes || !state.azanEnabled) return;
  var now = new Date();
  var cur = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  var order = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  for (var i = 0; i < order.length; i++) {
    var key = order[i];
    if (key === 'Fajr' && !state.azanFajrEnabled) continue;
    var raw = (state.prayerTimes[key] || '').split(' ')[0];
    if (raw === cur) {
      var stamp = key + '_' + now.toDateString() + '_' + cur;
      if (state.lastAzanFired === stamp) return;
      state.lastAzanFired = stamp;
      playAzan(key);
      return;
    }
  }
}

function playAzan(prayerKey) {
  if (!dom.azanPlayer) return;
  try {
    dom.azanPlayer.currentTime = 0;
    var promise = dom.azanPlayer.play();
    if (promise && promise.catch) {
      promise.catch(function(err) {
        console.warn('فشل تشغيل الأذان (يحتاج تفاعل مستخدم):', err);
      });
    }
    showToast('🕌 حان الآن وقت صلاة ' + PRAYER_NAMES_AR[prayerKey], 'success');
  } catch (e) {
    console.error('خطأ في تشغيل الأذان:', e);
  }
}

function testAzan() {
  if (!dom.azanPlayer) return;
  try {
    dom.azanPlayer.currentTime = 0;
    dom.azanPlayer.play()
      .then(function() {
        showToast('🔊 تشغيل الأذان للاختبار', 'success');
      })
      .catch(function(err) {
        showToast('تعذّر تشغيل الأذان: ' + err.message, 'error');
      });
  } catch (e) {
    showToast('خطأ: ' + e.message, 'error');
  }
}

/* ============================================================
   9) قائمة السور
============================================================ */
function loadSurahList() {
  var cached = storage.get('surah_list');
  if (cached && cached.length === CONFIG.SURAH_COUNT) {
    state.surahList = cached;
    populateSurahSelect();
    return Promise.resolve();
  }
  return fetchJSON(CONFIG.API_BASE + '/surah')
    .then(function(data) {
      if (data && data.data) {
        state.surahList = data.data;
        storage.set('surah_list', data.data);
        populateSurahSelect();
      }
    })
    .catch(function(err) {
      console.error('فشل تحميل قائمة السور:', err);
      showToast('تعذّر تحميل قائمة السور', 'error');
    });
}

function populateSurahSelect() {
  if (!dom.surahSelect) return;
  var html = '';
  for (var i = 0; i < state.surahList.length; i++) {
    var s = state.surahList[i];
    html += '<option value="' + s.number + '">'
          + s.number + '. ' + s.name
          + ' (' + s.englishName + ')'
          + '</option>';
  }
  dom.surahSelect.innerHTML = html;
  dom.surahSelect.value = state.currentSurah;
}

/* ============================================================
   10) تحويل الترقيم المطلق إلى (سورة، آية) والعكس
============================================================ */
var SURAH_OFFSETS = null;

function buildSurahOffsets() {
  if (SURAH_OFFSETS || !state.surahList || state.surahList.length === 0) return;
  SURAH_OFFSETS = [];
  var cum = 1;
  for (var i = 0; i < state.surahList.length; i++) {
    var s = state.surahList[i];
    SURAH_OFFSETS.push({
      surahNum: s.number,
      startAbs: cum,
      count: s.numberOfAyahs,
      name: s.name,
      englishName: s.englishName
    });
    cum += s.numberOfAyahs;
  }
}

function absToSurahAyah(absNum) {
  if (!SURAH_OFFSETS) buildSurahOffsets();
  if (!SURAH_OFFSETS) return null;
  for (var i = 0; i < SURAH_OFFSETS.length; i++) {
    var o = SURAH_OFFSETS[i];
    if (absNum >= o.startAbs && absNum < o.startAbs + o.count) {
      return {
        surahNum: o.surahNum,
        surahName: o.name,
        ayahNumInSurah: absNum - o.startAbs + 1
      };
    }
  }
  return null;
}

function getAbsNumber(surah, ayah) {
  if (!SURAH_OFFSETS) buildSurahOffsets();
  if (!SURAH_OFFSETS) return null;
  for (var i = 0; i < SURAH_OFFSETS.length; i++) {
    var o = SURAH_OFFSETS[i];
    if (o.surahNum === surah) {
      return o.startAbs + ayah - 1;
    }
  }
  return null;
}

/* ============================================================
   11) تحميل السورة وعرضها
============================================================ */
function loadSurah(surahNum, opts) {
  if (!opts) opts = {};
  state.currentSurah = surahNum;

  var cacheKey = surahNum + '_' + state.currentReciter;
  if (state.surahCache.has(cacheKey)) {
    var cached = state.surahCache.get(cacheKey);
    state.surahData = cached.text;
    renderSurah(cached.text, cached.audio);
    state.audioCache.set(cacheKey, cached.audio);
    finalizeSurahLoad(opts);
    return Promise.resolve();
  }

  dom.surahContent.innerHTML = '<div style="text-align:center; padding:40px;">'
    + '<span class="loading-indicator"></span> جاري تحميل السورة...'
    + '</div>';

  var textUrl = CONFIG.API_BASE + '/surah/' + surahNum + '/quran-uthmani';
  var audioUrl = CONFIG.API_BASE + '/surah/' + surahNum + '/' + state.currentReciter;

  return Promise.all([
    fetchJSON(textUrl),
    fetchJSON(audioUrl)
  ]).then(function(results) {
    var textData = results[0].data;
    var audioData = results[1].data;
    state.surahData = textData;

    if (state.surahCache.size >= CONFIG.CACHE_LIMIT) {
      var firstKey = state.surahCache.keys().next().value;
      state.surahCache.delete(firstKey);
    }
    state.surahCache.set(cacheKey, { text: textData, audio: audioData });
    state.audioCache.set(cacheKey, audioData);

    renderSurah(textData, audioData);
    finalizeSurahLoad(opts);
  }).catch(function(err) {
    console.error('فشل تحميل السورة:', err);
    dom.surahContent.innerHTML = '<div style="text-align:center; padding:30px; color:#c33;">'
      + '⚠️ تعذّر تحميل السورة. تحقّق من الاتصال.'
      + '</div>';
    showToast('فشل تحميل السورة', 'error');
  });
}

function finalizeSurahLoad(opts) {
  if (opts.startAyah) {
    var idx = -1;
    for (var i = 0; i < state.surahData.ayahs.length; i++) {
      if (state.surahData.ayahs[i].numberInSurah === opts.startAyah) { idx = i; break; }
    }
    if (idx >= 0) state.currentAyahIndex = idx;
  } else {
    state.currentAyahIndex = 0;
  }

  highlightCurrentAyah();
  updatePlayerInfo();

  if (state.repeatMode) {
    state.repeatFrom = 1;
    state.repeatTo = state.surahData.ayahs.length;
    if (dom.repeatFrom) dom.repeatFrom.value = state.repeatFrom;
    if (dom.repeatTo) dom.repeatTo.value = state.repeatTo;
  }

  if (state.autoSave) {
    var a = state.surahData.ayahs[state.currentAyahIndex];
    storage.set('last_position', {
      surah: state.currentSurah,
      ayah: state.currentAyahIndex,
      surahName: state.surahData.name,
      ayahNumberInSurah: a ? a.numberInSurah : 1,
      timestamp: Date.now()
    });
  }

  if (opts.autoPlay) {
    setTimeout(function() { playCurrentAyah(); }, 200);
  }

  if (state.pendingTafsirAfterLoad) {
    var pa = state.pendingTafsirAfterLoad;
    state.pendingTafsirAfterLoad = null;
    var idx2 = -1;
    for (var j = 0; j < state.surahData.ayahs.length; j++) {
      if (state.surahData.ayahs[j].numberInSurah === pa) { idx2 = j; break; }
    }
    if (idx2 >= 0) {
      state.currentAyahIndex = idx2;
      highlightCurrentAyah();
      openTafsirCurtain();
      loadTafsirForCurrentAyah();
    }
  }
}

function renderSurah(textData, audioData) {
  var html = '';
  html += '<div class="surah-title">' + escapeHtml(textData.name)
        + ' — ' + escapeHtml(textData.englishName) + '</div>';

  if (textData.number !== 1 && textData.number !== 9) {
    html += '<div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>';
  }

  html += '<div class="ayahs-container" style="font-size:' + state.fontSize + 'px;">';
  for (var i = 0; i < textData.ayahs.length; i++) {
    var a = textData.ayahs[i];
    var text = a.text;
    if (textData.number !== 1 && a.numberInSurah === 1) {
      text = text.replace(/^بِسْمِ\s+اللَّهِ\s+الرَّحْمَٰنِ\s+الرَّحِيمِ\s*/, '');
    }
    html += '<span class="ayah" data-index="' + i + '" data-number="' + a.numberInSurah + '">'
          + escapeHtml(text)
          + ' <span class="ayah-number">' + a.numberInSurah + '</span> '
          + '</span>';
  }
  html += '</div>';
  dom.surahContent.innerHTML = html;

  var ayahEls = dom.surahContent.querySelectorAll('.ayah');
  for (var k = 0; k < ayahEls.length; k++) {
    (function(el) {
      el.addEventListener('click', function() {
        var idx = parseInt(el.getAttribute('data-index'), 10);
        state.currentAyahIndex = idx;
        highlightCurrentAyah();
        playCurrentAyah();
      });
    })(ayahEls[k]);
  }
}

function highlightCurrentAyah() {
  if (!dom.surahContent) return;
  var all = dom.surahContent.querySelectorAll('.ayah');
  for (var i = 0; i < all.length; i++) {
    all[i].classList.remove('current');
  }
  var cur = dom.surahContent.querySelector('.ayah[data-index="' + state.currentAyahIndex + '"]');
  if (cur) {
    cur.classList.add('current');
    if (state.hifdhMode) {
      for (var j = 0; j < all.length; j++) {
        all[j].classList.remove('revealed');
      }
      cur.classList.add('revealed');
    }
    cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  updatePlayerInfo();

  if (dom.tafsirCurtain && dom.tafsirCurtain.classList.contains('open')) {
    loadTafsirForCurrentAyah();
  }
}

/* ============================================================
   12) معلومات المشغل (مع نص الآية الحالية)
============================================================ */
function updatePlayerInfo() {
  if (!state.surahData) return;
  var a = state.surahData.ayahs[state.currentAyahIndex];
  var reciterText = '';
  if (dom.reciterSelect && dom.reciterSelect.options[dom.reciterSelect.selectedIndex]) {
    reciterText = dom.reciterSelect.options[dom.reciterSelect.selectedIndex].text;
  }
  if (dom.playerSurahName) dom.playerSurahName.textContent = 'سورة ' + state.surahData.name;
  if (dom.playerReciterName) dom.playerReciterName.textContent = reciterText;

  if (dom.playerCurrentAyah && a) {
    var preview = a.text || '';
    if (preview.length > 80) {
      preview = preview.substring(0, 80) + '...';
    }
    dom.playerCurrentAyah.textContent = '﴿' + preview + '﴾ — آية ' + a.numberInSurah;
  }

  if (dom.collapsedInfo && a) {
    var shortPreview = a.text || '';
    if (shortPreview.length > 50) {
      shortPreview = shortPreview.substring(0, 50) + '...';
    }
    dom.collapsedInfo.textContent = state.surahData.name + ' (' + a.numberInSurah + '): ' + shortPreview;
  }
}

/* ============================================================
   13) تشغيل الصوت
============================================================ */
function playCurrentAyah() {
  if (!state.surahData) return;
  var a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a || !a.audio) {
    var cacheKey = state.currentSurah + '_' + state.currentReciter;
    var audioData = state.audioCache.get(cacheKey);
    if (audioData && audioData.ayahs[state.currentAyahIndex]) {
      a = audioData.ayahs[state.currentAyahIndex];
    }
  }
  if (!a || !a.audio) {
    showToast('لا يوجد صوت لهذه الآية', 'error');
    return;
  }
  dom.audioPlayer.src = a.audio;
  var p = dom.audioPlayer.play();
  if (p && p.catch) {
    p.catch(function(err) {
      console.warn('فشل التشغيل:', err);
    });
  }
  state.isPlaying = true;
}

function togglePlayPause() {
  if (!state.surahData) return;
  if (dom.audioPlayer.paused) {
    if (!dom.audioPlayer.src) {
      playCurrentAyah();
    } else {
      dom.audioPlayer.play();
    }
    state.isPlaying = true;
  } else {
    dom.audioPlayer.pause();
    state.isPlaying = false;
  }
}

function onAudioEnded() {
  if (!state.surahData) return;

  if (state.repeatMode) {
    var currentNum = state.surahData.ayahs[state.currentAyahIndex].numberInSurah;
    if (currentNum >= state.repeatFrom && currentNum <= state.repeatTo) {
      if (currentNum === state.repeatTo) {
        state.repeatCounter++;
        if (state.repeatCounter >= state.repeatTimes) {
          state.repeatCounter = 0;
          state.repeatMode = false;
          dom.repeatBtn.classList.remove('active');
          if (dom.repeatControls) dom.repeatControls.style.display = 'none';
          showToast('✅ انتهى التكرار', 'success');
          return;
        }
        var startIdx = -1;
        for (var i = 0; i < state.surahData.ayahs.length; i++) {
          if (state.surahData.ayahs[i].numberInSurah === state.repeatFrom) { startIdx = i; break; }
        }
        if (startIdx >= 0) {
          state.currentAyahIndex = startIdx;
          highlightCurrentAyah();
          setTimeout(playCurrentAyah, 300);
          return;
        }
      } else {
        nextAyah(true);
        return;
      }
    }
  }

  if (state.currentAyahIndex < state.surahData.ayahs.length - 1) {
    state.currentAyahIndex++;
    highlightCurrentAyah();
    setTimeout(playCurrentAyah, 200);
  } else {
    if (state.currentSurah < CONFIG.SURAH_COUNT) {
      var nextSurahNum = state.currentSurah + 1;
      dom.surahSelect.value = nextSurahNum;
      loadSurah(nextSurahNum, { autoPlay: true });
    } else {
      showToast('🎉 ختمتَ القرآن — تقبّل الله', 'success');
      state.isPlaying = false;
    }
  }
}

/* ============================================================
   14) التنقل بين الآيات والسور
============================================================ */
function nextAyah(autoFromRepeat) {
  if (!state.surahData) return;
  if (state.currentAyahIndex < state.surahData.ayahs.length - 1) {
    state.currentAyahIndex++;
    highlightCurrentAyah();
    if (autoFromRepeat || state.isPlaying) {
      setTimeout(playCurrentAyah, 150);
    }
  } else {
    if (state.currentSurah < CONFIG.SURAH_COUNT) {
      nextSurah();
    }
  }
}

function prevAyah() {
  if (!state.surahData) return;
  if (state.currentAyahIndex > 0) {
    state.currentAyahIndex--;
    highlightCurrentAyah();
    if (state.isPlaying) {
      setTimeout(playCurrentAyah, 150);
    }
  } else {
    if (state.currentSurah > 1) {
      prevSurah();
    }
  }
}

function nextSurah() {
  if (state.currentSurah < CONFIG.SURAH_COUNT) {
    var n = state.currentSurah + 1;
    dom.surahSelect.value = n;
    loadSurah(n, { autoPlay: state.isPlaying });
  }
}

function prevSurah() {
  if (state.currentSurah > 1) {
    var n = state.currentSurah - 1;
    dom.surahSelect.value = n;
    loadSurah(n, { autoPlay: state.isPlaying });
  }
}

/* ============================================================
   15) وضع الحفظ (الإخفاء)
============================================================ */
function toggleHifdhMode() {
  state.hifdhMode = !state.hifdhMode;
  dom.hifdhBtn.classList.toggle('active', state.hifdhMode);
  var ayahs = dom.surahContent.querySelectorAll('.ayah');
  for (var i = 0; i < ayahs.length; i++) {
    if (state.hifdhMode) {
      ayahs[i].classList.add('hifdh-mode');
      ayahs[i].classList.remove('revealed');
    } else {
      ayahs[i].classList.remove('hifdh-mode');
      ayahs[i].classList.remove('revealed');
    }
  }
  if (state.hifdhMode) {
    var cur = dom.surahContent.querySelector('.ayah[data-index="' + state.currentAyahIndex + '"]');
    if (cur) cur.classList.add('revealed');
    showToast('🧠 وضع الحفظ مفعّل — الآيات مخفية', 'success');
  } else {
    showToast('وضع الحفظ مغلق', '');
  }
}

/* ============================================================
   16) وضع التكرار
============================================================ */
function toggleRepeatMode() {
  state.repeatMode = !state.repeatMode;
  dom.repeatBtn.classList.toggle('active', state.repeatMode);
  if (dom.repeatControls) {
    dom.repeatControls.style.display = state.repeatMode ? 'flex' : 'none';
  }
  if (state.repeatMode && state.surahData) {
    state.repeatCounter = 0;
    state.repeatFrom = 1;
    state.repeatTo = state.surahData.ayahs.length;
    state.repeatTimes = 3;
    if (dom.repeatFrom) {
      dom.repeatFrom.innerHTML = '';
      for (var i = 1; i <= state.surahData.ayahs.length; i++) {
        dom.repeatFrom.innerHTML += '<option value="' + i + '">' + i + '</option>';
      }
      dom.repeatFrom.value = 1;
    }
    if (dom.repeatTo) {
      dom.repeatTo.innerHTML = '';
      for (var j = 1; j <= state.surahData.ayahs.length; j++) {
        dom.repeatTo.innerHTML += '<option value="' + j + '">' + j + '</option>';
      }
      dom.repeatTo.value = state.surahData.ayahs.length;
    }
    if (dom.repeatTimes) dom.repeatTimes.value = 3;
    showToast('🔁 وضع التكرار مفعّل', 'success');

    if (dom.repeatFrom) {
      dom.repeatFrom.onchange = function() { state.repeatFrom = parseInt(dom.repeatFrom.value, 10); };
    }
    if (dom.repeatTo) {
      dom.repeatTo.onchange = function() { state.repeatTo = parseInt(dom.repeatTo.value, 10); };
    }
    if (dom.repeatTimes) {
      dom.repeatTimes.onchange = function() { state.repeatTimes = parseInt(dom.repeatTimes.value, 10); };
    }
  } else {
    showToast('التكرار مغلق', '');
  }
}

/* ============================================================
   17) ستارة التفسير
============================================================ */
function openTafsirCurtain() {
  dom.tafsirCurtain.classList.add('open');
  dom.tafsirCurtainHandle.classList.add('open');
  dom.tafsirCurtainHandle.querySelector('.handle-icon').textContent = '◀';
  loadTafsirForCurrentAyah();
}

function closeTafsirCurtain() {
  dom.tafsirCurtain.classList.remove('open');
  dom.tafsirCurtainHandle.classList.remove('open');
  dom.tafsirCurtainHandle.querySelector('.handle-icon').textContent = '▶';
}

function toggleTafsirCurtain() {
  if (dom.tafsirCurtain.classList.contains('open')) {
    closeTafsirCurtain();
  } else {
    openTafsirCurtain();
  }
}

function loadTafsirForCurrentAyah() {
  if (!state.surahData) {
    dom.tafsirCurtainBody.innerHTML = '<div class="tafsir-no-ayah">لا توجد آية محددة</div>';
    return;
  }
  var a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a) return;

  var surahNum = state.currentSurah;
  var ayahNum = a.numberInSurah;
  var edition = state.currentTafsirEdition;

  dom.tafsirCurtainHeader.textContent = 'تفسير: ' + state.surahData.name + ' — آية ' + ayahNum;
  dom.tafsirCurtainBody.innerHTML = '<div class="tafsir-loading">'
    + '<span class="loading-indicator"></span> جاري تحميل التفسير...'
    + '</div>';

  var url = CONFIG.TAFSIR_API + '/' + edition + '/' + surahNum + '/' + ayahNum + '.json';

  fetchJSON(url, { timeout: 12000 })
    .then(function(data) {
      if (!data || !data.text) {
        dom.tafsirCurtainBody.innerHTML = '<div class="tafsir-error">⚠️ لا يوجد تفسير لهذه الآية</div>';
        return;
      }
      var html = '<div class="tafsir-ayah-title">﴿' + escapeHtml(a.text) + '﴾</div>'
        + '<div>' + escapeHtml(data.text) + '</div>';
      dom.tafsirCurtainBody.innerHTML = html;
    })
    .catch(function(err) {
      console.error('فشل تحميل التفسير:', err);
      dom.tafsirCurtainBody.innerHTML = '<div class="tafsir-error">⚠️ تعذّر تحميل التفسير</div>';
    });
}

/* ============================================================
   18) البحث المحلي (بدون API)
============================================================ */
function normalizeExactText(str) {
  if (!str) return '';
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '')       // إزالة الحركات
    .replace(/[إأآٱ]/g, 'ا')                     // توحيد الألف
    .replace(/ى/g, 'ي')                          // توحيد الألف المقصورة
    .replace(/ة/g, 'ه')                          // توحيد التاء المربوطة
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

function loadFullQuranText() {
  if (state.fullQuranLoaded) return Promise.resolve();

  return new Promise(function(resolve, reject) {
    var request = indexedDB.open('QuranAppDB', 1);
    request.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('fullText')) {
        db.createObjectStore('fullText', { keyPath: 'id' });
      }
    };
    request.onsuccess = function(e) {
      var db = e.target.result;
      var tx = db.transaction('fullText', 'readonly');
      var store = tx.objectStore('fullText');
      var getReq = store.get('fullQuran');
      getReq.onsuccess = function() {
        if (getReq.result && getReq.result.data && getReq.result.data.length > 6000) {
          state.fullQuranText = getReq.result.data;
          state.fullQuranLoaded = true;
          console.log('✅ تم تحميل القرآن من IndexedDB');
          resolve();
        } else {
          console.log('⏳ جاري تحميل القرآن من API...');
          showToast('جاري تحميل قاعدة القرآن (مرة واحدة فقط) ...', 'info');
          fetchJSON(CONFIG.API_BASE + '/quran/quran-uthmani', { timeout: 20000 })
            .then(function(data) {
              if (!data || !data.data || !data.data.surahs) throw new Error('Invalid Quran data');
              var ayahs = [];
              for (var i = 0; i < data.data.surahs.length; i++) {
                var surah = data.data.surahs[i];
                for (var j = 0; j < surah.ayahs.length; j++) {
                  var ayah = surah.ayahs[j];
                  ayahs.push({
                    surah: surah.number,
                    surahName: surah.name,
                    ayah: ayah.numberInSurah,
                    text: ayah.text,
                    normalized: normalizeExactText(ayah.text)
                  });
                }
              }
              state.fullQuranText = ayahs;
              state.fullQuranLoaded = true;
              var tx2 = db.transaction('fullText', 'readwrite');
              var store2 = tx2.objectStore('fullText');
              store2.put({ id: 'fullQuran', data: ayahs });
              showToast('✅ قاعدة القرآن جاهزة (البحث الآن سريع)', 'success');
              resolve();
            })
            .catch(reject);
        }
      };
      getReq.onerror = reject;
    };
    request.onerror = reject;
  });
}

function performExactSearch(query) {
  if (!query || query.trim().length < 2) {
    showToast('أدخل كلمة بحث (حرفان على الأقل)', 'error');
    return;
  }
  if (!state.fullQuranLoaded) {
    showToast('⚠️ قاعدة القرآن لا تزال تُحمَّل، انتظر قليلاً ثم حاول مجدداً', 'error');
    return;
  }

  dom.searchResults.innerHTML = '<div class="search-loading"><span class="loading-indicator"></span> جاري البحث ...</div>';
  dom.searchResults.style.display = 'block';

  var normQuery = normalizeExactText(query.trim());
  var matches = [];
  var maxResults = 100;
  for (var i = 0; i < state.fullQuranText.length && matches.length < maxResults; i++) {
    var ayah = state.fullQuranText[i];
    if (ayah.normalized.indexOf(normQuery) !== -1) {
      matches.push(ayah);
    }
  }
  renderLocalSearchResults(matches, query);
}

function renderLocalSearchResults(matches, query) {
  if (matches.length === 0) {
    dom.searchResults.innerHTML = '<div class="search-empty">❌ لا توجد نتائج لـ "' + escapeHtml(query) + '"</div>';
    return;
  }
  var html = '<div class="search-results-header">✅ عدد النتائج: ' + matches.length + '</div>';
  var re = new RegExp(escapeRegExp(query), 'gi');
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var highlighted = escapeHtml(m.text).replace(re, '<mark class="search-highlight">$&</mark>');
    html += '<div class="search-result-item" data-surah="' + m.surah + '" data-ayah="' + m.ayah + '">'
          + '<div class="search-result-title">' + escapeHtml(m.surahName) + ' — آية ' + m.ayah + '</div>'
          + '<div class="search-result-text">' + highlighted + '</div>'
          + '</div>';
  }
  dom.searchResults.innerHTML = html;

  var items = dom.searchResults.querySelectorAll('.search-result-item');
  for (var k = 0; k < items.length; k++) {
    (function(el) {
      el.addEventListener('click', function() {
        var sNum = parseInt(el.getAttribute('data-surah'), 10);
        var aNum = parseInt(el.getAttribute('data-ayah'), 10);
        dom.surahSelect.value = sNum;
        loadSurah(sNum, { startAyah: aNum });
        dom.searchResults.style.display = 'none';
      });
    })(items[k]);
  }
}

/* ============================================================
   19) البحث الجذري (Roots) — تم إصلاحه للتعامل مع ملف quranRoots.json الحالي
============================================================ */
function loadRootsData() {
  if (state.rootsLoaded) return Promise.resolve();
  return fetch(CONFIG.ROOTS_FILE)
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      // تحويل المصفوفة إلى كائن (الجذر كمفتاح)
      var rootsMap = {};
      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i++) {
          var item = data[i];
          var rootName = item.name;
          var occurrences = item.occurences || [];
          var positions = [];
          for (var j = 0; j < occurrences.length; j++) {
            var occ = occurrences[j];
            // التحويل من صيغة "سورة:آية" أو "سورة:آية-آية" إلى أرقام مطلقة
            if (typeof occ === 'string') {
              var parts = occ.split(':');
              if (parts.length === 2) {
                var surah = parseInt(parts[0], 10);
                var ayahPart = parts[1];
                if (ayahPart.indexOf('-') !== -1) {
                  var range = ayahPart.split('-');
                  var startAyah = parseInt(range[0], 10);
                  var endAyah = parseInt(range[1], 10);
                  for (var a = startAyah; a <= endAyah; a++) {
                    var abs = getAbsNumber(surah, a);
                    if (abs) positions.push({ abs: abs, word: rootName });
                  }
                } else {
                  var ayah = parseInt(ayahPart, 10);
                  var abs = getAbsNumber(surah, ayah);
                  if (abs) positions.push({ abs: abs, word: rootName });
                }
              }
            }
          }
          if (positions.length) rootsMap[rootName] = positions;
        }
      } else {
        rootsMap = data;
      }
      state.rootsData = rootsMap;
      state.rootsLoaded = true;
      console.log('✅ تم تحميل قاعدة الجذور بنجاح');
    })
    .catch(function(err) {
      console.warn('فشل تحميل الجذور:', err);
      state.rootsLoaded = false;
    });
}

function performRootSearch(query) {
  if (!query || query.trim().length < 2) {
    showToast('أدخل جذراً (حرفان على الأقل)', 'error');
    return;
  }
  dom.searchResults.innerHTML = '<div style="text-align:center; padding:20px;">'
    + '<span class="loading-indicator"></span> جاري البحث الجذري...'
    + '</div>';
  dom.searchResults.style.display = 'block';

  loadRootsData().then(function() {
    if (!state.rootsData) {
      dom.searchResults.innerHTML = '<div class="search-empty">⚠️ ملف الجذور غير متوفر — استخدم البحث الدقيق</div>';
      return;
    }
    var key = query.trim();
    var entries = state.rootsData[key];
    if (!entries || entries.length === 0) {
      dom.searchResults.innerHTML = '<div class="search-empty">لا توجد نتائج للجذر "' + escapeHtml(key) + '"</div>';
      return;
    }
    renderRootResults(entries, key);
  });
}

function renderRootResults(entries, root) {
  var html = '<div class="search-results-header">الجذر: <strong>' + escapeHtml(root)
    + '</strong> — عدد المواضع: ' + entries.length + '</div>';
  var max = Math.min(entries.length, 200);
  for (var i = 0; i < max; i++) {
    var e = entries[i];
    var info = absToSurahAyah(e.abs);
    if (!info) continue;
    html += '<div class="search-result-item" data-surah="' + info.surahNum + '" data-ayah="' + info.ayahNumInSurah + '">'
          + '<div class="search-result-title"><strong>' + escapeHtml(info.surahName) + '</strong> — آية ' + info.ayahNumInSurah + '</div>'
          + (e.word ? '<div class="search-result-text">كلمة: <strong>' + escapeHtml(e.word) + '</strong></div>' : '')
          + '</div>';
  }
  if (entries.length > 200) {
    html += '<div class="search-empty">... وعدد ' + (entries.length - 200) + ' موضع إضافي مخفي</div>';
  }
  dom.searchResults.innerHTML = html;

  var items = dom.searchResults.querySelectorAll('.search-result-item');
  for (var k = 0; k < items.length; k++) {
    (function(el) {
      el.addEventListener('click', function() {
        var sNum = parseInt(el.getAttribute('data-surah'), 10);
        var aNum = parseInt(el.getAttribute('data-ayah'), 10);
        dom.surahSelect.value = sNum;
        loadSurah(sNum, { startAyah: aNum });
        dom.searchResults.style.display = 'none';
      });
    })(items[k]);
  }
}

function executeSearch() {
  var query = dom.searchInput.value.trim();
  if (!query) return;
  if (state.searchType === 'root') {
    performRootSearch(query);
  } else {
    performExactSearch(query);
  }
}

function clearSearch() {
  dom.searchInput.value = '';
  dom.searchResults.innerHTML = '';
  dom.searchResults.style.display = 'none';
}

/* ============================================================
   20) المفضلة
============================================================ */
function loadFavorites() {
  state.favorites = storage.get('favorites', []) || [];
}

function saveFavorites() {
  storage.set('favorites', state.favorites);
}

function toggleFavoriteCurrentAyah() {
  if (!state.surahData) return;
  var a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a) return;
  var key = state.currentSurah + ':' + a.numberInSurah;
  var idx = -1;
  for (var i = 0; i < state.favorites.length; i++) {
    if (state.favorites[i].key === key) { idx = i; break; }
  }
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    showToast('💔 تمت إزالة الآية من المفضلة', '');
    if (dom.favoriteBtn) dom.favoriteBtn.classList.remove('active');
  } else {
    state.favorites.push({
      key: key,
      surah: state.currentSurah,
      surahName: state.surahData.name,
      ayah: a.numberInSurah,
      text: a.text,
      timestamp: Date.now()
    });
    showToast('❤️ أُضيفت الآية إلى المفضلة', 'success');
    if (dom.favoriteBtn) dom.favoriteBtn.classList.add('active');
  }
  saveFavorites();
  renderFavorites();
}

function isCurrentAyahFavorite() {
  if (!state.surahData) return false;
  var a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a) return false;
  var key = state.currentSurah + ':' + a.numberInSurah;
  for (var i = 0; i < state.favorites.length; i++) {
    if (state.favorites[i].key === key) return true;
  }
  return false;
}

function renderFavorites() {
  if (!dom.favoritesList) return;
  if (state.favorites.length === 0) {
    dom.favoritesList.innerHTML = '<div class="favorites-empty">لا توجد آيات مفضلة بعد</div>';
    return;
  }
  var html = '';
  var sorted = state.favorites.slice().sort(function(a, b) {
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
  for (var i = 0; i < sorted.length; i++) {
    var f = sorted[i];
    html += '<div class="favorite-item" data-key="' + escapeHtml(f.key) + '">'
          + '<div class="favorite-meta"><strong>' + escapeHtml(f.surahName) + '</strong> — آية ' + f.ayah + '</div>'
          + '<div class="favorite-text">﴿' + escapeHtml(f.text) + '﴾</div>'
          + '<div class="favorite-actions">'
          + '<button class="fav-go" data-surah="' + f.surah + '" data-ayah="' + f.ayah + '">انتقال</button>'
          + '<button class="fav-remove" data-key="' + escapeHtml(f.key) + '">حذف</button>'
          + '</div>'
          + '</div>';
  }
  dom.favoritesList.innerHTML = html;

  var goBtns = dom.favoritesList.querySelectorAll('.fav-go');
  for (var k = 0; k < goBtns.length; k++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        var sNum = parseInt(btn.getAttribute('data-surah'), 10);
        var aNum = parseInt(btn.getAttribute('data-ayah'), 10);
        dom.surahSelect.value = sNum;
        loadSurah(sNum, { startAyah: aNum });
        if (dom.favoritesPanel) dom.favoritesPanel.classList.remove('open');
      });
    })(goBtns[k]);
  }

  var rmBtns = dom.favoritesList.querySelectorAll('.fav-remove');
  for (var j = 0; j < rmBtns.length; j++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        var key = btn.getAttribute('data-key');
        for (var x = 0; x < state.favorites.length; x++) {
          if (state.favorites[x].key === key) {
            state.favorites.splice(x, 1);
            break;
          }
        }
        saveFavorites();
        renderFavorites();
        showToast('تم الحذف', '');
      });
    })(rmBtns[j]);
  }
}

/* ============================================================
   21) العلامة المرجعية (Bookmark)
============================================================ */
function setBookmark() {
  if (!state.surahData) return;
  var a = state.surahData.ayahs[state.currentAyahIndex];
  state.bookmark = {
    surah: state.currentSurah,
    surahName: state.surahData.name,
    ayah: a.numberInSurah,
    text: a.text,
    timestamp: Date.now()
  };
  storage.set('bookmark', state.bookmark);
  showToast('🔖 تم حفظ العلامة', 'success');
}

function gotoBookmark() {
  var bm = state.bookmark || storage.get('bookmark');
  if (!bm) {
    showToast('لا توجد علامة محفوظة', 'error');
    return;
  }
  state.bookmark = bm;
  dom.surahSelect.value = bm.surah;
  loadSurah(bm.surah, { startAyah: bm.ayah });
  showToast('📖 تم الانتقال للعلامة: ' + bm.surahName + ' — ' + bm.ayah, 'success');
}

function toggleBookmark() {
  setBookmark();
}

/* ============================================================
   22) المشاركة
============================================================ */
function buildShareText() {
  if (!state.surahData) return '';
  var a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a) return '';
  return '﴿' + a.text + '﴾\n— سورة ' + state.surahData.name + ' — آية ' + a.numberInSurah;
}

function toggleShareMenu() {
  if (!dom.shareMenu) return;
  dom.shareMenu.classList.toggle('open');
}

function shareNative() {
  var text = buildShareText();
  if (!text) return;
  if (navigator.share) {
    navigator.share({
      title: 'القرآن الكريم',
      text: text
    }).catch(function(err) {
      console.warn('Share canceled:', err);
    });
  } else {
    shareCopy();
  }
}

function shareCopy() {
  var text = buildShareText();
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(function() { showToast('📋 تم نسخ الآية', 'success'); })
      .catch(function() { fallbackCopy(text); });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('📋 تم نسخ الآية', 'success');
  } catch (e) {
    showToast('تعذّر النسخ', 'error');
  }
  document.body.removeChild(ta);
}

function shareWhatsApp() {
  var text = buildShareText();
  if (!text) return;
  var url = 'https://wa.me/?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}

function shareTelegram() {
  var text = buildShareText();
  if (!text) return;
  var url = 'https://t.me/share/url?url=' + encodeURIComponent(' ') + '&text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}

/* ============================================================
   23) حجم الخط والوضع الليلي
============================================================ */
function applyFontSize(size) {
  state.fontSize = size;
  var container = dom.surahContent.querySelector('.ayahs-container');
  if (container) container.style.fontSize = size + 'px';
  storage.set('font_size', size);
}

function cycleFontSize() {
  var sizes = [20, 24, 28, 32, 36, 40];
  var idx = sizes.indexOf(state.fontSize);
  idx = (idx + 1) % sizes.length;
  applyFontSize(sizes[idx]);
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = sizes[idx];
  showToast('🔠 حجم الخط: ' + sizes[idx] + 'px', '');
}

function applyNightMode(enabled) {
  state.nightMode = enabled;
  if (enabled) {
    document.body.classList.add('night-mode');
  } else {
    document.body.classList.remove('night-mode');
  }
  storage.set('night_mode', enabled);
}

function toggleNightMode() {
  applyNightMode(!state.nightMode);
}

/* ============================================================
   24) لوحة الإعدادات + المفضلة
============================================================ */
function openSettings() {
  if (dom.settingsPanel) dom.settingsPanel.classList.add('open');
}
function closeSettings() {
  if (dom.settingsPanel) dom.settingsPanel.classList.remove('open');
}
function openFavoritesPanel() {
  renderFavorites();
  if (dom.favoritesPanel) dom.favoritesPanel.classList.add('open');
}
function closeFavoritesPanel() {
  if (dom.favoritesPanel) dom.favoritesPanel.classList.remove('open');
}

function saveLocationSettings() {
  var city = dom.cityInput ? dom.cityInput.value.trim() : '';
  var country = dom.countryInput ? dom.countryInput.value.trim() : '';
  var method = dom.methodSelect ? dom.methodSelect.value : CONFIG.DEFAULT_METHOD;
  if (!city || !country) {
    showToast('أدخل المدينة والدولة', 'error');
    return;
  }
  state.city = city;
  state.country = country;
  state.method = method;
  storage.set('city', city);
  storage.set('country', country);
  storage.set('method', method);
  loadPrayerTimes().then(function() {
    showToast('✅ تم حفظ الموقع وتحديث المواقيت', 'success');
  });
}

function resetSettings() {
  if (!confirm('هل تريد إعادة ضبط جميع الإعدادات؟')) return;
  var keys = [
    'font_size','night_mode','city','country','method',
    'azan_enabled','azan_fajr_enabled','auto_save','reciter','tafsir_edition'
  ];
  for (var i = 0; i < keys.length; i++) storage.remove(keys[i]);
  showToast('تمت إعادة الضبط — سيُعاد التحميل', 'success');
  setTimeout(function() { location.reload(); }, 1200);
}

/* ============================================================
   25) المشغل المطوي / الموسّع
============================================================ */
function togglePlayerCollapse() {
  state.playerCollapsed = !state.playerCollapsed;
  if (state.playerCollapsed) {
    dom.player.classList.add('collapsed');
  } else {
    dom.player.classList.remove('collapsed');
  }
}

/* ============================================================
   26) اختصارات لوحة المفاتيح
============================================================ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
      return;
    }
    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowRight':
        prevAyah();
        break;
      case 'ArrowLeft':
        nextAyah();
        break;
      case 'ArrowUp':
        e.preventDefault();
        prevSurah();
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextSurah();
        break;
      case 'h': case 'H':
        toggleHifdhMode();
        break;
      case 'r': case 'R':
        toggleRepeatMode();
        break;
      case 'b': case 'B':
        setBookmark();
        break;
      case 'f': case 'F':
        toggleFavoriteCurrentAyah();
        break;
      case 't': case 'T':
        toggleTafsirCurtain();
        break;
      case 'n': case 'N':
        toggleNightMode();
        break;
      case '+': case '=':
        cycleFontSize();
        break;
      case 'Escape':
        closeSettings();
        closeFavoritesPanel();
        if (dom.searchResults) dom.searchResults.style.display = 'none';
        if (dom.shareMenu) dom.shareMenu.classList.remove('open');
        break;
    }
  });
}

/* ============================================================
   27) ربط الأحداث
============================================================ */
function bindEvents() {
  if (dom.tafsirCurtainHandle) dom.tafsirCurtainHandle.addEventListener('click', toggleTafsirCurtain);
  if (dom.tafsirSelect) {
    dom.tafsirSelect.addEventListener('change', function() {
      state.currentTafsirEdition = dom.tafsirSelect.value;
      storage.set('tafsir_edition', state.currentTafsirEdition);
      if (dom.tafsirCurtain.classList.contains('open')) {
        loadTafsirForCurrentAyah();
      }
    });
  }

  if (dom.surahSelect) {
    dom.surahSelect.addEventListener('change', function() {
      var n = parseInt(dom.surahSelect.value, 10);
      loadSurah(n);
    });
  }
  if (dom.reciterSelect) {
    dom.reciterSelect.addEventListener('change', function() {
      state.currentReciter = dom.reciterSelect.value;
      storage.set('reciter', state.currentReciter);
      loadSurah(state.currentSurah, { startAyah: state.surahData ? state.surahData.ayahs[state.currentAyahIndex].numberInSurah : 1 });
    });
  }

  if (dom.searchType) {
    dom.searchType.addEventListener('change', function() {
      state.searchType = dom.searchType.value;
    });
  }
  if (dom.searchBtn) dom.searchBtn.addEventListener('click', executeSearch);
  if (dom.clearSearchBtn) dom.clearSearchBtn.addEventListener('click', clearSearch);
  if (dom.searchInput) {
    dom.searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') executeSearch();
    });
  }

  if (dom.audioPlayer) dom.audioPlayer.addEventListener('ended', onAudioEnded);
  if (dom.prevAyahBtn) dom.prevAyahBtn.addEventListener('click', prevAyah);
  if (dom.nextAyahBtn) dom.nextAyahBtn.addEventListener('click', nextAyah);
  if (dom.prevSurahBtn) dom.prevSurahBtn.addEventListener('click', prevSurah);
  if (dom.nextSurahBtn) dom.nextSurahBtn.addEventListener('click', nextSurah);
  if (dom.hifdhBtn) dom.hifdhBtn.addEventListener('click', toggleHifdhMode);
  if (dom.repeatBtn) dom.repeatBtn.addEventListener('click', toggleRepeatMode);
  if (dom.bookmarkBtn) {
    dom.bookmarkBtn.addEventListener('click', setBookmark);
    dom.bookmarkBtn.addEventListener('dblclick', gotoBookmark);
  }
  if (dom.favoriteBtn) dom.favoriteBtn.addEventListener('click', toggleFavoriteCurrentAyah);
  if (dom.shareBtn) dom.shareBtn.addEventListener('click', toggleShareMenu);
  if (dom.fontBtn) dom.fontBtn.addEventListener('click', cycleFontSize);

  if (dom.shareMenu) {
    var shareNativeBtn = dom.shareMenu.querySelector('[data-share="native"]');
    var shareCopyBtn = dom.shareMenu.querySelector('[data-share="copy"]');
    var shareWaBtn = dom.shareMenu.querySelector('[data-share="whatsapp"]');
    var shareTgBtn = dom.shareMenu.querySelector('[data-share="telegram"]');
    if (shareNativeBtn) shareNativeBtn.addEventListener('click', function() { shareNative(); toggleShareMenu(); });
    if (shareCopyBtn) shareCopyBtn.addEventListener('click', function() { shareCopy(); toggleShareMenu(); });
    if (shareWaBtn) shareWaBtn.addEventListener('click', function() { shareWhatsApp(); toggleShareMenu(); });
    if (shareTgBtn) shareTgBtn.addEventListener('click', function() { shareTelegram(); toggleShareMenu(); });
  }

  if (dom.collapseBtn) dom.collapseBtn.addEventListener('click', togglePlayerCollapse);
  if (dom.collapsedExpandBtn) dom.collapsedExpandBtn.addEventListener('click', togglePlayerCollapse);
  if (dom.collapsedPlayBtn) dom.collapsedPlayBtn.addEventListener('click', togglePlayPause);

  if (dom.settingsToggleBtn) dom.settingsToggleBtn.addEventListener('click', openSettings);
  if (dom.settingsClose) dom.settingsClose.addEventListener('click', closeSettings);
  if (dom.themeToggle) dom.themeToggle.addEventListener('click', toggleNightMode);
  if (dom.saveLocationBtn) dom.saveLocationBtn.addEventListener('click', saveLocationSettings);
  if (dom.testAzanBtn) dom.testAzanBtn.addEventListener('click', testAzan);
  if (dom.resetSettingsBtn) dom.resetSettingsBtn.addEventListener('click', resetSettings);

  if (dom.azanToggle) {
    dom.azanToggle.addEventListener('change', function() {
      state.azanEnabled = dom.azanToggle.checked;
      storage.set('azan_enabled', state.azanEnabled);
    });
  }
  if (dom.azanFajrToggle) {
    dom.azanFajrToggle.addEventListener('change', function() {
      state.azanFajrEnabled = dom.azanFajrToggle.checked;
      storage.set('azan_fajr_enabled', state.azanFajrEnabled);
    });
  }
  if (dom.autoSaveToggle) {
    dom.autoSaveToggle.addEventListener('change', function() {
      state.autoSave = dom.autoSaveToggle.checked;
      storage.set('auto_save', state.autoSave);
    });
  }
  if (dom.fontSizeSelect) {
    dom.fontSizeSelect.addEventListener('change', function() {
      var v = parseInt(dom.fontSizeSelect.value, 10);
      applyFontSize(v);
    });
  }
  if (dom.cityQuickSelect) {
    dom.cityQuickSelect.addEventListener('change', function() {
      var v = dom.cityQuickSelect.value;
      if (!v) return;
      var parts = v.split('|');
      if (parts.length === 2 && dom.cityInput && dom.countryInput) {
        dom.cityInput.value = parts[0];
        dom.countryInput.value = parts[1];
      }
    });
  }

  if (dom.favoritesOpenBtn) dom.favoritesOpenBtn.addEventListener('click', openFavoritesPanel);
  if (dom.favoritesClose) dom.favoritesClose.addEventListener('click', closeFavoritesPanel);
}

/* ============================================================
   28) استرجاع الإعدادات المحفوظة
============================================================ */
function restoreSavedSettings() {
  var fs = storage.get('font_size');
  if (fs) state.fontSize = fs;

  var nm = storage.get('night_mode');
  if (nm === true) applyNightMode(true);

  var city = storage.get('city');
  if (city) state.city = city;
  var country = storage.get('country');
  if (country) state.country = country;
  var method = storage.get('method');
  if (method) state.method = method;

  var azan = storage.get('azan_enabled');
  if (azan === false) state.azanEnabled = false;
  var azanFajr = storage.get('azan_fajr_enabled');
  if (azanFajr === false) state.azanFajrEnabled = false;

  var as = storage.get('auto_save');
  if (as === false) state.autoSave = false;

  var rec = storage.get('reciter');
  if (rec) state.currentReciter = rec;

  var taf = storage.get('tafsir_edition');
  if (taf) state.currentTafsirEdition = taf;

  var bm = storage.get('bookmark');
  if (bm) state.bookmark = bm;

  if (dom.cityInput) dom.cityInput.value = state.city;
  if (dom.countryInput) dom.countryInput.value = state.country;
  if (dom.methodSelect) dom.methodSelect.value = state.method;
  if (dom.azanToggle) dom.azanToggle.checked = state.azanEnabled;
  if (dom.azanFajrToggle) dom.azanFajrToggle.checked = state.azanFajrEnabled;
  if (dom.autoSaveToggle) dom.autoSaveToggle.checked = state.autoSave;
  if (dom.fontSizeSelect) dom.fontSizeSelect.value = state.fontSize;
  if (dom.reciterSelect) dom.reciterSelect.value = state.currentReciter;
  if (dom.tafsirSelect) dom.tafsirSelect.value = state.currentTafsirEdition;
}

/* ============================================================
   29) الموضع الأخير
============================================================ */
function restoreLastPosition() {
  var last = storage.get('last_position');
  if (last && last.surah) {
    state.currentSurah = last.surah;
    if (dom.surahSelect) dom.surahSelect.value = last.surah;
    return loadSurah(last.surah, { startAyah: last.ayahNumberInSurah || 1 });
  }
  return loadSurah(1);
}

/* ============================================================
   30) تهيئة التطبيق (Init)
============================================================ */
function initApp() {
  cacheDom();
  loadFavorites();
  restoreSavedSettings();
  bindEvents();
  setupKeyboardShortcuts();

  if (dom.azanPlayer && !dom.azanPlayer.src) {
    dom.azanPlayer.src = CONFIG.AZAN_FILE;
    dom.azanPlayer.preload = 'auto';
  }

  updateClocks();
  setInterval(updateClocks, 1000);

  setInterval(function() {
    if (state.prayerTimes) updatePrayerCountdown();
  }, 1000);

  setInterval(checkAzanTime, 20000);

  loadSurahList()
    .then(function() {
      buildSurahOffsets();
      return restoreLastPosition();
    })
    .then(function() {
      return loadPrayerTimes();
    })
    .then(function() {
      scheduleMidnightRefresh();
    });

  // تحميل النص القرآني الكامل في الخلفية (للبحث المحلي)
  loadFullQuranText().catch(console.warn);

  // تحميل ملف الجذور في الخلفية
  loadRootsData().catch(console.warn);
}

function scheduleMidnightRefresh() {
  var now = new Date();
  var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 30);
  var delay = next.getTime() - now.getTime();
  setTimeout(function() {
    loadPrayerTimes();
    scheduleMidnightRefresh();
  }, delay);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
