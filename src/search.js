import { state } from "./state.js";
import { copyToClipboard } from "./utils.js";
import { CONFIG } from "./config.js";
import { dom } from "./dom.js";
import { storage } from "./storage.js";
import { showToast, loadingBar } from "./ui.js";
import { escapeHtml, escapeRegExp, normalizeExactText, normalizeRelaxed } from "./utils.js";
import { loadSurah, highlightCurrentAyah } from "./app.js";
import { playCurrentAyah } from "./audio.js";

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_SEARCH_HISTORY = 10;


/** Open IndexedDB and return the database instance. */
function openQuranDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QuranAppDB', 1);
    request.onupgradeneeded = e => {
      const db = /** @type {IDBDatabase} */ (/** @type {IDBOpenDBRequest} */ (e.target).result);
      if (!db.objectStoreNames.contains('fullText')) db.createObjectStore('fullText', { keyPath: 'id' });
    };
    request.onsuccess = e => resolve(/** @type {IDBDatabase} */ (/** @type {IDBOpenDBRequest} */ (e.target).result));
    request.onerror = () => reject(new Error('Failed to open QuranAppDB'));
  });
}

/** Try to load Quran text from IndexedDB. */
async function loadFromIndexedDB(db) {
  return new Promise((resolve) => {
    const tx = db.transaction('fullText', 'readonly');
    const store = tx.objectStore('fullText');
    const getReq = store.get('fullQuran');
    getReq.onsuccess = () => resolve(getReq.result?.data || null);
    getReq.onerror = () => resolve(null);
  });
}

/** Fetch Quran text from local file or API. */
async function fetchQuranText() {
  let res = await fetch('data/quran-uthmani.json').catch(() => null);
  if (!res || !res.ok) {
    res = await fetch(`${CONFIG.API_BASE}/quran/quran-uthmani`);
  }
  const data = await res.json();
  if (!data?.data?.surahs) throw new Error('بيانات غير صالحة');
  return data;
}

/** Strip basmala from ayah text if it's the first ayah of a surah (except 1,9). */
function stripBasmala(text, surahNum, ayahNum) {
  if (surahNum === 1 || surahNum === 9 || ayahNum !== 1) return text;
  return text.replace(/^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u, '');
}

/** Flatten surah-based API response into ayah array using JSON reviver (parse inline for speed). */
function flattenAyahs(jsonText) {
  const ayahs = [];
  let currentSurah = null;
  JSON.parse(jsonText, function (key, val) {
    if (key === 'surahs' && Array.isArray(val)) return val;
    if (val && typeof val === 'object' && val.number && val.ayahs) {
      currentSurah = val;
      return val;
    }
    if (currentSurah && key === 'ayahs' && Array.isArray(val)) {
      for (const ayah of val) {
        const ayahText = stripBasmala(ayah.text, currentSurah.number, ayah.numberInSurah);
        ayahs.push({
          surah: currentSurah.number,
          surahName: currentSurah.name,
          ayah: ayah.numberInSurah,
          text: ayahText,
          normalized: normalizeExactText(ayahText)
        });
      }
      return val;
    }
    return val;
  });
  return ayahs;
}

/** Cache ayah array in IndexedDB. */
function cacheInIndexedDB(db, ayahs) {
  try {
    const tx = db.transaction('fullText', 'readwrite');
    tx.objectStore('fullText').put({ id: 'fullQuran', data: ayahs });
  } catch (err) { console.warn('Failed to cache full Quran text:', err); }
}

/** Load full Quran text into IndexedDB for offline search. */
export async function loadFullQuranText() {
  if (state.fullQuranLoaded) return;
  try {
    const db = await openQuranDB();
    const cached = await loadFromIndexedDB(db);
    if (cached) {
      const needsNormalize = cached.length > 0 && !cached[0].normalized;
      if (needsNormalize) {
        for (const a of cached) {
          a.normalized = normalizeExactText(a.text);
        }
        cacheInIndexedDB(db, cached);
      }
      state.fullQuranText = cached;
      state.fullQuranLoaded = true;
      buildSearchWords();
      return;
    }
    showToast('جاري تحميل قاعدة القرآن (مرة واحدة فقط)...', 'success');
    const data = await fetchQuranText();
    const ayahs = flattenAyahs(JSON.stringify(data));
    for (const a of ayahs) {
      a.normalized = normalizeExactText(a.text);
    }
    state.fullQuranText = ayahs;
    state.fullQuranLoaded = true;
    buildSearchWords();
    cacheInIndexedDB(db, ayahs);
    showToast('✅ قاعدة القرآن جاهزة', 'success');
  } catch (err) {
    console.error('Failed to load full Quran text:', err);
    showToast('❌ فشل تحميل قاعدة القرآن', 'error');
  }
}

/** Generate Arabic search variants: original + stem without "ال" prefix.
 *  This handles cases where the Quran text has prefixes (ل, ب, ف, و) before "ال"
 *  which causes alef assimilation (e.g. "للملائكة" vs "الملائكة").
 */
function generateArabicVariants(normQuery) {
  const variants = [normQuery];
  if (normQuery.startsWith('ال') && normQuery.length > 3) {
    variants.push(normQuery.slice(2));
  }
  return [...new Set(variants)];
}

const SEARCH_PAGE_SIZE = 50;

/** Search full Quran text for exact matches. Falls back to relaxed if no results. */
export function performExactSearch(query) {
  if (!query.trim() || query.length < 2) { showToast('أدخل حرفين على الأقل', 'error'); return; }
  if (!state.fullQuranLoaded) { showToast('⚠️ قاعدة القرآن تُحمَّل، انتظر قليلاً', 'error'); return; }
  addToSearchHistory(query.trim());
  const normQuery = normalizeExactText(query.trim());
  const relaxedQuery = normalizeRelaxed(query.trim());
  const exactVariants = generateArabicVariants(normQuery);
  const relaxedVariants = generateArabicVariants(relaxedQuery);
  let matches = state.fullQuranText.filter(ayah =>
    exactVariants.some(q => ayah.normalized.includes(q))
  );
  if (!matches.length) {
    matches = state.fullQuranText.filter(ayah =>
      relaxedVariants.some(q => normalizeRelaxed(ayah.text).includes(q))
    );
  }
  state._allSearchMatches = matches;
  state._searchResultsPage = 1;
  renderSearchResults(matches.slice(0, SEARCH_PAGE_SIZE), query, matches.length > SEARCH_PAGE_SIZE);
}

/* ===================== SEARCH AUTOCOMPLETE ===================== */

export function buildSearchWords() {
  if (!state.fullQuranText || state.searchWords?.length) return;
  const freq = new Map();
  for (const ayah of state.fullQuranText) {
    const words = ayah.normalized.split(/\s+/);
    for (const w of words) {
      if (w.length < 2) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  state.searchWords = [...freq.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

let _acIndex = -1;

export function initSearchAutocomplete() {
  const input = dom.searchInput;
  const dropdown = document.getElementById('searchAutocomplete');
  if (!input || !dropdown) return;

  let acTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(acTimer);
    acTimer = setTimeout(() => {
      const val = input.value.trim();
      if (!val || !state.searchWords?.length) {
        dropdown.style.display = 'none';
        _acIndex = -1;
        return;
      }
      const normVal = normalizeExactText(val);
      const suggestions = [];
      for (const w of state.searchWords) {
        if (suggestions.length >= 8) break;
        if (w.word.startsWith(normVal)) suggestions.push(w);
      }
      if (!suggestions.length) {
        dropdown.style.display = 'none';
        _acIndex = -1;
        return;
      }
      let html = '';
      for (let i = 0; i < suggestions.length; i++) {
        html += '<div class="search-autocomplete-item" data-index="' + i + '">'
          + '<span>' + escapeHtml(suggestions[i].word) + '</span>'
          + '<span class="count">' + suggestions[i].count + '</span>'
          + '</div>';
      }
      dropdown.innerHTML = html;
      dropdown.style.display = 'block';
      _acIndex = -1;

      dropdown.querySelectorAll('.search-autocomplete-item').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          input.value = el.querySelector('span').textContent;
          dropdown.style.display = 'none';
          performExactSearch(input.value);
        });
        el.addEventListener('mouseenter', () => {
          dropdown.querySelectorAll('.search-autocomplete-item').forEach(c => c.classList.remove('active'));
          el.classList.add('active');
          _acIndex = parseInt(el.dataset.index, 10);
        });
      });
    }, 150);
  });

  input.addEventListener('keydown', (e) => {
    if (dropdown.style.display === 'none') return;
    const items = dropdown.querySelectorAll('.search-autocomplete-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _acIndex = Math.min(_acIndex + 1, items.length - 1);
      items.forEach((c, i) => c.classList.toggle('active', i === _acIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _acIndex = Math.max(_acIndex - 1, 0);
      items.forEach((c, i) => c.classList.toggle('active', i === _acIndex));
    } else if (e.key === 'Enter' && _acIndex >= 0) {
      e.preventDefault();
      const sel = items[_acIndex];
      if (sel) {
        input.value = sel.querySelector('span').textContent;
        dropdown.style.display = 'none';
        performExactSearch(input.value);
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
      _acIndex = -1;
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(/** @type {Node} */(e.target)) && e.target !== input) {
      dropdown.style.display = 'none';
      _acIndex = -1;
    }
  });
}

/* ===================== VOICE SEARCH ===================== */

/** Start voice search (webkitSpeechRecognition). */
export function startVoiceSearch() {
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

/** Build and attach the on-screen Arabic keyboard. */
export function initKeyboard() {
  dom.kbdToggleBtn = document.getElementById('kbdToggleBtn');
  dom.kbdToggleBtn?.addEventListener('click', toggleKeyboard);
  document.querySelectorAll('.kbd-key').forEach(btn => {
    btn.addEventListener('click', handleKeyClick);
  });
  document.addEventListener('click', (e) => {
    const kbd = document.getElementById('arabicKeyboard');
    const toggle = dom.kbdToggleBtn;
    if (!kbd || !toggle) return;
    const target = /** @type {Node} */ (e.target);
    if (!kbd.contains(target) && target !== toggle && !toggle.contains(target)) {
      kbd.classList.remove('open');
      toggle.classList.remove('active');
    }
  });
}

/**
 * Highlight search keyword in original Uthmani text by mapping match positions
 * from normalized text back to original character positions.
 */
function buildSearchHighlight(text, query) {
  const normQuery = normalizeExactText(query);
  if (!normQuery) return escapeHtml(text);
  const normText = normalizeExactText(text);
  const diacriticRE = /[\u064B-\u065F\u0670\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/;
  const map = [];
  let normIdx = 0;
  for (let i = 0; i < text.length; i++) {
    if (diacriticRE.test(text[i])) {
      map.push(-1);
    } else {
      map.push(normIdx);
      normIdx++;
    }
  }
  const matches = [];
  const re = new RegExp(escapeRegExp(normQuery), 'gi');
  let m;
  while ((m = re.exec(normText)) !== null) {
    matches.push({ start: m.index, end: m.index + normQuery.length });
  }
  if (!matches.length) return escapeHtml(text);
  const origRanges = matches.map(match => {
    let origStart = -1, origEnd = -1;
    for (let i = 0; i < map.length; i++) {
      if (map[i] === match.start && origStart === -1) origStart = i;
      if (map[i] === match.end - 1) origEnd = i;
    }
    if (origEnd === -1) origEnd = text.length - 1;
    return { start: origStart, end: origEnd + 1 };
  }).filter(r => r.start !== -1);
  let result = '';
  let lastEnd = 0;
  for (const range of origRanges) {
    result += escapeHtml(text.slice(lastEnd, range.start));
    result += '<mark class="search-highlight">' + escapeHtml(text.slice(range.start, range.end)) + '</mark>';
    lastEnd = range.end;
  }
  result += escapeHtml(text.slice(lastEnd));
  return result;
}

function renderSearchResults(matches, query, hasMore) {
  if (!dom.searchResults) return;
  dom.searchResults.innerHTML = '';
  if (!matches.length) {
    dom.searchResults.innerHTML = `<div class="search-empty">❌ لا توجد نتائج لـ "${escapeHtml(query)}"</div>`;
    dom.searchResults.style.display = 'block';
    return;
  }
  const totalResults = state._allSearchMatches?.length ?? matches.length;
  let html = `<div class="search-results-header">
    <span>✅ عدد النتائج: ${totalResults}</span>
    <button class="search-results-close" id="closeSearchResultsBtn" aria-label="إغلاق">✖</button>
  </div>`;
  for (const m of matches) {
    const highlighted = buildSearchHighlight(m.text, query);
    const fi = state.fullQuranText?.indexOf(m) ?? -1;
    html += `<div class="search-result-item" data-surah="${m.surah}" data-ayah="${m.ayah}" data-surahname="${escapeHtml(m.surahName || '')}" data-fulltext-index="${fi}">
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
  if (hasMore) {
    html += `<div style="text-align:center;padding:12px;">
      <button class="btn btn-gold" id="loadMoreSearchBtn">📥 تحميل المزيد (${Math.min(SEARCH_PAGE_SIZE, totalResults - matches.length)}+)</button>
    </div>`;
  }
  dom.searchResults.innerHTML = html;
  dom.searchResults.style.display = 'block';

  const closeBtn = document.getElementById('closeSearchResultsBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => { dom.searchResults.style.display = 'none'; });

  document.getElementById('loadMoreSearchBtn')?.addEventListener('click', () => {
    const currentCount = document.querySelectorAll('.search-result-item').length;
    const nextPage = state._searchResultsPage + 1;
    state._searchResultsPage = nextPage;
    const allMatches = state._allSearchMatches ?? [];
    const nextBatch = allMatches.slice(0, currentCount + SEARCH_PAGE_SIZE);
    renderSearchResults(nextBatch, query, nextBatch.length < allMatches.length);
  });

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

  document.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest('.search-result-actions')) return;
      const s = parseInt(el.dataset.surah, 10);
      const a = parseInt(el.dataset.ayah, 10);
      const idx = parseInt(el.dataset.fulltextIndex, 10);
      const name = el.dataset.surahname;
      const ayahObj = state.fullQuranText?.[idx];
      if (!ayahObj) return;
      import('./ayah-modal.js').then(m => m.openAyahModal({ surah: s, ayah: a, text: ayahObj.text, surahName: name, index: idx }));
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
    } catch (err) { console.warn('Failed to fetch ayah for copy:', err); }
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
    } catch (err) { console.warn('Failed to fetch ayah for share:', err); }
  }
  const shareMsg = text ? `﴿${text}﴾\n— ${surahName.trim()} — آية ${ayah}` : `الآية ${ayah} من سورة ${surahName.trim()}`;
  if (navigator.share) {
    navigator.share({ title: 'القرآن الكريم', text: shareMsg }).catch(err => { if (err.name !== 'AbortError') console.warn('Share failed:', err); });
  } else {
    copyToClipboard(shareMsg);
    showToast('📋 تم نسخ الآية للمشاركة', 'success');
  }
}

/* ===================== SEARCH HISTORY ===================== */

/** Get search history from localStorage. */
export function getSearchHistory() {
  return storage.get(SEARCH_HISTORY_KEY, []);
}

/** Add a query to search history (keeps last 10 unique entries). */
function addToSearchHistory(query) {
  const history = getSearchHistory().filter(h => h !== query);
  history.unshift(query);
  if (history.length > MAX_SEARCH_HISTORY) history.length = MAX_SEARCH_HISTORY;
  storage.set(SEARCH_HISTORY_KEY, history);
}

/** Clear all search history. */
export function clearSearchHistory() {
  storage.remove(SEARCH_HISTORY_KEY);
  showToast('تم مسح سجل البحث', '');
}
