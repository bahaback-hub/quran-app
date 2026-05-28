import { state } from "./state.js";
import { copyToClipboard } from "./share.js";
import { CONFIG } from "./config.js";
import { dom } from "./dom.js";
import { storage } from "./storage.js";
import { showToast, loadingBar } from "./ui.js";
import { escapeHtml, escapeRegExp, normalizeExactText, normalizeRelaxed } from "./utils.js";
import { loadSurah, highlightCurrentAyah } from "./app.js";
import { playCurrentAyah } from "./audio.js";
import { openAyahModal } from "./ayah-modal.js";

/** Load full Quran text into IndexedDB for offline search. */
export async function loadFullQuranText() {
  if (state.fullQuranLoaded) return;
  return new Promise((resolve) => {
    const request = indexedDB.open('QuranAppDB', 1);
    request.onupgradeneeded = e => {
      const db = /** @type {IDBDatabase} */ (/** @type {IDBOpenDBRequest} */ (e.target).result);
      if (!db.objectStoreNames.contains('fullText')) db.createObjectStore('fullText', { keyPath: 'id' });
    };
    request.onsuccess = async (e) => {
      const db = /** @type {IDBDatabase} */ (/** @type {IDBOpenDBRequest} */ (e.target).result);
      try {
        const tx = db.transaction('fullText', 'readonly');
        const store = tx.objectStore('fullText');
        const getReq = store.get('fullQuran');
        getReq.onsuccess = async () => {
          if (getReq.result && getReq.result.data) {
            state.fullQuranText = getReq.result.data;
            state.fullQuranText.forEach(a => { a.normalized = normalizeExactText(a.text); });
            state.fullQuranLoaded = true;
            buildSearchWords();
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
              buildSearchWords();
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

/** Search full Quran text for exact matches. Falls back to relaxed if no results. */
export function performExactSearch(query) {
  if (!query.trim() || query.length < 2) { showToast('أدخل حرفين على الأقل', 'error'); return; }
  if (!state.fullQuranLoaded) { showToast('⚠️ قاعدة القرآن تُحمَّل، انتظر قليلاً', 'error'); return; }
  const normQuery = normalizeExactText(query.trim());
  const relaxedQuery = normalizeRelaxed(query.trim());
  const exactVariants = generateArabicVariants(normQuery);
  const relaxedVariants = generateArabicVariants(relaxedQuery);
  let matches = state.fullQuranText.filter(ayah =>
    exactVariants.some(q => ayah.normalized.includes(q))
  ).slice(0, 100);
  if (!matches.length) {
    matches = state.fullQuranText.filter(ayah =>
      relaxedVariants.some(q => normalizeRelaxed(ayah.text).includes(q))
    ).slice(0, 100);
  }
  renderSearchResults(matches, query);
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

  input.addEventListener('input', () => {
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

  document.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (/** @type {HTMLElement} */ (e.target).closest('.search-result-actions')) return;
      const s = parseInt(el.dataset.surah, 10);
      const a = parseInt(el.dataset.ayah, 10);
      const idx = parseInt(el.dataset.fulltextIndex, 10);
      const name = el.dataset.surahname;
      const ayahObj = state.fullQuranText?.[idx];
      if (!ayahObj) return;
      openAyahModal({ surah: s, ayah: a, text: ayahObj.text, surahName: name, index: idx });
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
