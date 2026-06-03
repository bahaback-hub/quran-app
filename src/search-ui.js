import { state } from "./state.js";
import { dom } from "./dom.js";
import { storage } from "./storage.js";
import { showToast } from "./ui.js";
import { escapeHtml, escapeRegExp, copyToClipboard, normalizeExactText, normalizeRelaxed } from "./utils.js";
import { loadSurah, highlightCurrentAyah } from "./app.js";
import { playCurrentAyah } from "./audio.js";
import { SEARCH_PAGE_SIZE, performSearch, buildSearchWords, addToSearchHistory, loadFullQuranText, getSearchHistory, clearSearchHistory } from "./search-core.js";
import { CONFIG } from "./config.js";

export { loadFullQuranText, getSearchHistory, clearSearchHistory };

export function performExactSearch(query) {
  if (!query.trim() || query.length < 2) { showToast('أدخل حرفين على الأقل', 'error'); return; }
  if (!state.fullQuranLoaded) { showToast('⚠️ قاعدة القرآن تُحمَّل، انتظر قليلاً', 'error'); return; }
  addToSearchHistory(query.trim());
  const matches = performSearch(query);
  state._allSearchMatches = matches;
  state._searchResultsPage = 1;
  renderSearchResults(matches.slice(0, SEARCH_PAGE_SIZE), query, matches.length > SEARCH_PAGE_SIZE);
}

const _highlightCache = new Map();
function buildSearchHighlight(text, query) {
  const cacheKey = text + '\n' + query;
  const cached = _highlightCache.get(cacheKey);
  if (cached) return cached;
  const normQuery = normalizeExactText(query);
  if (!normQuery) { const r = escapeHtml(text); _highlightCache.set(cacheKey, r); return r; }
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
  if (_highlightCache.size > 200) {
    const first = _highlightCache.keys().next().value;
    if (first) _highlightCache.delete(first);
  }
  _highlightCache.set(cacheKey, result);
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

  if (!dom.searchResults._delegationBound) {
    dom.searchResults._delegationBound = true;
    dom.searchResults.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target.id === 'closeSearchResultsBtn') { dom.searchResults.style.display = 'none'; return; }
      if (target.id === 'loadMoreSearchBtn') {
        const q = dom.searchResults.dataset.query || '';
        const currentCount = dom.searchResults.querySelectorAll('.search-result-item').length;
        state._searchResultsPage = (state._searchResultsPage || 1) + 1;
        const allMatches = state._allSearchMatches ?? [];
        const nextBatch = allMatches.slice(0, currentCount + SEARCH_PAGE_SIZE);
        renderSearchResults(nextBatch, q, nextBatch.length < allMatches.length);
        return;
      }
      const playBtn = target.closest('.search-play');
      if (playBtn) { playSpecificAyah(parseInt(playBtn.dataset.surah, 10), parseInt(playBtn.dataset.ayah, 10)); return; }
      const copyBtn = target.closest('.search-copy');
      if (copyBtn) { copySpecificAyah(parseInt(copyBtn.dataset.surah, 10), parseInt(copyBtn.dataset.ayah, 10)); return; }
      const shareBtn = target.closest('.search-share');
      if (shareBtn) { shareSpecificAyah(parseInt(shareBtn.dataset.surah, 10), parseInt(shareBtn.dataset.ayah, 10)); return; }
      const gotoBtn = target.closest('.search-goto');
      if (gotoBtn) {
        const s = parseInt(gotoBtn.dataset.surah, 10);
        const a = parseInt(gotoBtn.dataset.ayah, 10);
        if (dom.surahSelect) dom.surahSelect.value = s;
        loadSurah(s, { startAyah: a });
        return;
      }
      if (target.closest('.search-result-actions')) return;
      const item = target.closest('.search-result-item');
      if (!item) return;
      const s = parseInt(item.dataset.surah, 10);
      const a = parseInt(item.dataset.ayah, 10);
      const idx = parseInt(item.dataset.fulltextIndex, 10);
      const ayahObj = state.fullQuranText?.[idx];
      if (!ayahObj) return;
      import('./ayah-modal.js').then(m => m.openAyahModal({ surah: s, ayah: a, text: ayahObj.text, surahName: item.dataset.surahname, index: idx }));
    });
  }
  dom.searchResults.dataset.query = query;
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

/* ===================== AUTOCOMPLETE ===================== */

let _acIndex = -1;

function showSearchHistory() {
  const dropdown = document.getElementById('searchAutocomplete');
  const input = dom.searchInput;
  if (!dropdown) return;
  const history = getSearchHistory();
  if (!history.length) { dropdown.style.display = 'none'; return; }
  let html = '<div class="search-history-header" style="font-size:11px;padding:4px 8px;color:var(--text-muted);border-bottom:1px solid var(--border-soft);">🕐 آخر عمليات البحث</div>';
  for (let i = 0; i < history.length; i++) {
    html += '<div class="search-autocomplete-item search-history-item" data-index="' + i + '">'
      + '<span>' + escapeHtml(history[i]) + '</span>'
      + '<span class="count" style="font-size:10px;">✕</span>'
      + '</div>';
  }
  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
  _acIndex = -1;
  dropdown.querySelectorAll('.search-autocomplete-item').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const span = el.querySelector('span');
      if (/** @type {HTMLElement} */ (e.target).classList.contains('count')) {
        const history2 = getSearchHistory();
        const idx = parseInt(el.dataset.index, 10);
        history2.splice(idx, 1);
        storage.set('search_history', history2);
        showSearchHistory();
        return;
      }
      if (input) input.value = span.textContent;
      dropdown.style.display = 'none';
      performExactSearch(input.value);
    });
  });
}

export function initSearchAutocomplete() {
  const input = dom.searchInput;
  const dropdown = document.getElementById('searchAutocomplete');
  if (!input || !dropdown) return;

  input.addEventListener('focus', () => {
    if (!input.value.trim()) showSearchHistory();
  });

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
      const suggestions = normVal.length <= 5 ? (state.searchPrefixMap?.get(normVal) || []) : [];
      if (!suggestions.length) {
        for (const w of state.searchWords) {
          if (suggestions.length >= 8) break;
          if (w.word.startsWith(normVal)) suggestions.push(w);
        }
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
  recognition.onend = () => stopVoiceSearch();
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
