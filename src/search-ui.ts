import { state, QuranTextEntry, SearchWord } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { escapeHtml, escapeRegExp, copyToClipboard, normalizeExactText, normalizeRelaxed } from './utils.js';
import { loadSurah, highlightCurrentAyah } from './app.js';
import { playCurrentAyah } from './audio.js';
import {
  SEARCH_PAGE_SIZE,
  performSearch,
  buildSearchWords,
  addToSearchHistory,
  loadFullQuranText,
  getSearchHistory,
  clearSearchHistory,
} from './search-core.js';
import { CONFIG } from './config.js';
import { __ } from './i18n.js';

/** Options for loading a surah (matches surah-loader internal interface). */
interface LoadSurahOptions {
  startAyah?: number;
  autoPlay?: boolean;
}

/** Data shape for opening the ayah modal. */
interface ModalAyahData {
  surah: number;
  ayah: number;
  text: string;
  surahName: string;
  index: number;
}

/** Shape of the ayah-modal module's exports. */
interface AyahModalModule {
  openAyahModal: (data: ModalAyahData) => void;
}

/** Match range for search highlight mapping. */
interface NormMatchRange {
  start: number;
  end: number;
}

/** Original text range for search highlight. */
interface OrigRange {
  start: number;
  end: number;
}

export { loadFullQuranText, getSearchHistory, clearSearchHistory };

export function performExactSearch(query: string): void {
  if (!query.trim() || query.length < 2) {
    showToast(__('min_chars'), 'error');
    return;
  }
  if (!state.fullQuranLoaded) {
    showToast(__('quran_db_loading'), 'error');
    return;
  }
  addToSearchHistory(query.trim());
  const matches = performSearch(query);
  state._allSearchMatches = matches;
  state._searchResultsPage = 1;
  renderSearchResults(matches.slice(0, SEARCH_PAGE_SIZE), query, matches.length > SEARCH_PAGE_SIZE);
}

const _highlightCache = new Map<string, string>();

function buildSearchHighlight(text: string, query: string): string {
  const cacheKey = text + '\n' + query;
  const cached = _highlightCache.get(cacheKey);
  if (cached) return cached;
  const normQuery = normalizeExactText(query);
  if (!normQuery) {
    const r = escapeHtml(text);
    _highlightCache.set(cacheKey, r);
    return r;
  }
  const normText = normalizeExactText(text);
  const diacriticRE = /[\u064B-\u065F\u0670\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/;
  const map: number[] = [];
  let normIdx = 0;
  for (let i = 0; i < text.length; i++) {
    if (diacriticRE.test(text[i])) {
      map.push(-1);
    } else {
      map.push(normIdx);
      normIdx++;
    }
  }
  const matches: NormMatchRange[] = [];
  const re = new RegExp(escapeRegExp(normQuery), 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(normText)) !== null) {
    matches.push({ start: m.index, end: m.index + normQuery.length });
  }
  if (!matches.length) return escapeHtml(text);
  const origRanges: OrigRange[] = matches
    .map((match) => {
      let origStart = -1,
        origEnd = -1;
      for (let i = 0; i < map.length; i++) {
        if (map[i] === match.start && origStart === -1) origStart = i;
        if (map[i] === match.end - 1) origEnd = i;
      }
      if (origEnd === -1) origEnd = text.length - 1;
      return { start: origStart, end: origEnd + 1 };
    })
    .filter((r) => r.start !== -1);
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

function renderSearchResults(matches: QuranTextEntry[], query: string, hasMore: boolean): void {
  if (!dom.searchResults) return;
  dom.searchResults.innerHTML = '';
  if (!matches.length) {
    dom.searchResults.innerHTML = `<div class="search-empty">❌ ${__('no_results')}</div>`;
    dom.searchResults.style.display = 'block';
    return;
  }
  const totalResults = state._allSearchMatches?.length ?? matches.length;
  let html = `<div class="search-results-header">
    <span>✅ ${__('results_count')}: ${totalResults}</span>
    <button class="search-results-close" id="closeSearchResultsBtn" aria-label="${__('close')}">✖</button>
  </div>`;
  for (const m of matches) {
    const highlighted = buildSearchHighlight(m.text, query);
    const fi = state.fullQuranText?.indexOf(m) ?? -1;
    html += `<div class="search-result-item" data-surah="${m.surah}" data-ayah="${m.ayah}" data-surahname="${escapeHtml(m.surahName || '')}" data-fulltext-index="${fi}">
      <div class="search-result-title">${escapeHtml(m.surahName || '')} — ${__('ayah')} ${m.ayah}</div>
      <div class="search-result-text">${highlighted}</div>
      <div class="search-result-actions">
        <button class="search-play" data-surah="${m.surah}" data-ayah="${m.ayah}">${__('search_play')}</button>
        <button class="search-copy" data-surah="${m.surah}" data-ayah="${m.ayah}">${__('search_copy')}</button>
        <button class="search-share" data-surah="${m.surah}" data-ayah="${m.ayah}">${__('search_share')}</button>
        <button class="search-goto" data-surah="${m.surah}" data-ayah="${m.ayah}">${__('search_goto')}</button>
      </div>
    </div>`;
  }
  if (hasMore) {
    html += `<div style="text-align:center;padding:12px;">
      <button class="btn btn-gold" id="loadMoreSearchBtn">${__('load_more', String(Math.min(SEARCH_PAGE_SIZE, totalResults - matches.length)))}</button>
    </div>`;
  }
  dom.searchResults.innerHTML = html;
  dom.searchResults.style.display = 'block';

  if (!(dom.searchResults as unknown as Record<string, boolean>)._delegationBound) {
    (dom.searchResults as unknown as Record<string, boolean>)._delegationBound = true;
    dom.searchResults.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.id === 'closeSearchResultsBtn') {
        dom.searchResults!.style.display = 'none';
        return;
      }
      if (target.id === 'loadMoreSearchBtn') {
        const q = dom.searchResults!.dataset.query || '';
        const currentCount = dom.searchResults!.querySelectorAll('.search-result-item').length;
        state._searchResultsPage = (state._searchResultsPage || 1) + 1;
        const allMatches = state._allSearchMatches ?? [];
        const nextBatch = allMatches.slice(0, currentCount + SEARCH_PAGE_SIZE);
        renderSearchResults(nextBatch, q, nextBatch.length < allMatches.length);
        return;
      }
      const playBtn = target.closest('.search-play') as HTMLElement | null;
      if (playBtn) {
        playSpecificAyah(parseInt(playBtn.dataset.surah!, 10), parseInt(playBtn.dataset.ayah!, 10));
        return;
      }
      const copyBtn = target.closest('.search-copy') as HTMLElement | null;
      if (copyBtn) {
        copySpecificAyah(parseInt(copyBtn.dataset.surah!, 10), parseInt(copyBtn.dataset.ayah!, 10));
        return;
      }
      const shareBtn = target.closest('.search-share') as HTMLElement | null;
      if (shareBtn) {
        shareSpecificAyah(parseInt(shareBtn.dataset.surah!, 10), parseInt(shareBtn.dataset.ayah!, 10));
        return;
      }
      const gotoBtn = target.closest('.search-goto') as HTMLElement | null;
      if (gotoBtn) {
        const s = parseInt(gotoBtn.dataset.surah!, 10);
        const a = parseInt(gotoBtn.dataset.ayah!, 10);
        if (dom.surahSelect) dom.surahSelect.value = String(s);
        loadSurah(s, { startAyah: a });
        return;
      }
      if (target.closest('.search-result-actions')) return;
      const item = target.closest('.search-result-item') as HTMLElement | null;
      if (!item) return;
      const s = parseInt(item.dataset.surah!, 10);
      const a = parseInt(item.dataset.ayah!, 10);
      const idx = parseInt(item.dataset.fulltextIndex!, 10);
      const ayahObj = state.fullQuranText?.[idx];
      if (!ayahObj) return;
      import('./ayah-modal.js').then((m: AyahModalModule) =>
        m.openAyahModal({ surah: s, ayah: a, text: ayahObj.text, surahName: item.dataset.surahname!, index: idx })
      );
    });
  }
  dom.searchResults.dataset.query = query;
}

function playSpecificAyah(surah: number, ayah: number): void {
  if (state.currentSurah !== surah || !state.surahData) {
    loadSurah(surah, { startAyah: ayah, autoPlay: true });
  } else {
    const ayahs = (state.surahData as Record<string, unknown> & { ayahs?: Array<{ numberInSurah: number }> }).ayahs;
    const idx = ayahs?.findIndex((a) => a.numberInSurah === ayah) ?? -1;
    if (idx !== -1) {
      state.currentAyahIndex = idx;
      highlightCurrentAyah();
      playCurrentAyah();
    }
  }
}

async function copySpecificAyah(surah: number, ayah: number): Promise<void> {
  let text = '';
  if (state.fullQuranLoaded) {
    const ayahObj = state.fullQuranText?.find((a) => a.surah === surah && a.ayah === ayah);
    if (ayahObj) text = ayahObj.text;
  }
  if (!text) {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/ayah/${surah}:${ayah}/quran-uthmani`);
      const data = await res.json();
      text = data?.data?.text || '';
    } catch (err) {
      console.warn('Failed to fetch ayah for copy:', err);
    }
  }
  if (text) {
    copyToClipboard(text);
    showToast(__('copied'), 'success');
  } else {
    showToast(__('failed_ayah'), 'error');
  }
}

async function shareSpecificAyah(surah: number, ayah: number): Promise<void> {
  const surahObj = state.surahList.find((s) => s.number === Number(surah));
  const surahName = surahObj ? surahObj.name : `${__('surah')} `;
  let text = '';
  if (state.fullQuranLoaded) {
    const ayahObj = state.fullQuranText?.find((a) => a.surah === surah && a.ayah === ayah);
    if (ayahObj) text = ayahObj.text;
  }
  if (!text) {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/ayah/${surah}:${ayah}/quran-uthmani`);
      const data = await res.json();
      text = data?.data?.text || '';
    } catch (err) {
      console.warn('Failed to fetch ayah for share:', err);
    }
  }
  const shareMsg = text
    ? `﴿${text}﴾\n— ${surahName.trim()} — ${__('ayah')} ${ayah}`
    : `${__('ayah')} ${ayah} ${__('surah')} ${surahName.trim()}`;
  if (navigator.share) {
    navigator.share({ title: __('app_title'), text: shareMsg }).catch((err) => {
      if (err.name !== 'AbortError') console.warn('Share failed:', err);
    });
  } else {
    copyToClipboard(shareMsg);
    showToast(__('copied'), 'success');
  }
}

/* ===================== AUTOCOMPLETE ===================== */

let _acIndex: number = -1;

function showSearchHistory(): void {
  const dropdown = document.getElementById('searchAutocomplete');
  const input = dom.searchInput;
  if (!dropdown) return;
  const history = getSearchHistory();
  if (!history.length) {
    dropdown.style.display = 'none';
    return;
  }
  let html =
    '<div class="search-history-header" style="font-size:11px;padding:4px 8px;color:var(--text-muted);border-bottom:1px solid var(--border-soft);">' +
    __('search_history_title') +
    '</div>';
  for (let i = 0; i < history.length; i++) {
    html +=
      '<div class="search-autocomplete-item search-history-item" data-index="' +
      i +
      '">' +
      '<span>' +
      escapeHtml(history[i]) +
      '</span>' +
      '<span class="count" style="font-size:10px;">✕</span>' +
      '</div>';
  }
  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
  _acIndex = -1;
  dropdown.querySelectorAll('.search-autocomplete-item').forEach((el: Element) => {
    (el as HTMLElement).addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      const span = el.querySelector('span');
      if ((e.target as HTMLElement).classList.contains('count')) {
        const history2 = getSearchHistory();
        const idx = parseInt((el as HTMLElement).dataset.index!, 10);
        history2.splice(idx, 1);
        storage.set('search_history', history2);
        showSearchHistory();
        return;
      }
      if (input) input.value = span!.textContent!;
      dropdown.style.display = 'none';
      performExactSearch(input!.value);
    });
  });
}

export function initSearchAutocomplete(): void {
  const input = dom.searchInput;
  const dropdown = document.getElementById('searchAutocomplete');
  if (!input || !dropdown) return;

  input.addEventListener('focus', () => {
    if (!input.value.trim()) showSearchHistory();
  });

  let acTimer: ReturnType<typeof setTimeout> | null = null;
  input.addEventListener('input', () => {
    clearTimeout(acTimer!);
    acTimer = setTimeout(() => {
      const val = input.value.trim();
      if (!val || !state.searchWords?.length) {
        dropdown.style.display = 'none';
        _acIndex = -1;
        return;
      }
      const normVal = normalizeExactText(val);
      const suggestions: SearchWord[] =
        normVal.length <= 5 ? (state.searchPrefixMap?.get(normVal) as SearchWord[] | undefined) || [] : [];
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
        html +=
          '<div class="search-autocomplete-item" data-index="' +
          i +
          '">' +
          '<span>' +
          escapeHtml(suggestions[i].word) +
          '</span>' +
          '<span class="count">' +
          suggestions[i].count +
          '</span>' +
          '</div>';
      }
      dropdown.innerHTML = html;
      dropdown.style.display = 'block';
      _acIndex = -1;

      dropdown.querySelectorAll('.search-autocomplete-item').forEach((el: Element) => {
        (el as HTMLElement).addEventListener('mousedown', (e: MouseEvent) => {
          e.preventDefault();
          input.value = el.querySelector('span')!.textContent!;
          dropdown.style.display = 'none';
          performExactSearch(input.value);
        });
        el.addEventListener('mouseenter', () => {
          dropdown.querySelectorAll('.search-autocomplete-item').forEach((c) => c.classList.remove('active'));
          el.classList.add('active');
          _acIndex = parseInt(el.dataset.index!, 10);
        });
      });
    }, 150);
  });

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (dropdown.style.display === 'none') return;
    const items = dropdown.querySelectorAll('.search-autocomplete-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _acIndex = Math.min(_acIndex + 1, items.length - 1);
      items.forEach((c, i) => c.classList.toggle('active', i === _acIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _acIndex = _acIndex - 1;
      if (_acIndex < -1) _acIndex = -1;
      items.forEach((c, i) => c.classList.toggle('active', i === _acIndex));
    } else if (e.key === 'Enter' && _acIndex >= 0) {
      e.preventDefault();
      const sel = items[_acIndex];
      if (sel) {
        input.value = sel.querySelector('span')!.textContent!;
        dropdown.style.display = 'none';
        performExactSearch(input.value);
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
      _acIndex = -1;
    }
  });

  document.addEventListener('click', (e: MouseEvent) => {
    if (!dropdown.contains(e.target as Node) && e.target !== input) {
      dropdown.style.display = 'none';
      _acIndex = -1;
    }
  });
}

/* ===================== VOICE SEARCH ===================== */

/** SpeechRecognition API types (not in standard TS DOM lib). */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

export function startVoiceSearch(): void {
  const SpeechRecognition =
    (
      window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).SpeechRecognition ||
    (
      window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast(__('voice_search_unsupported'), 'error');
    return;
  }
  if (state._voiceListening) return;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  state._voiceListening = true;
  dom.voiceSearchBtn?.classList.add('listening');
  showToast(__('voice_search_speaking'), 'success');
  recognition.onresult = (e: SpeechRecognitionEvent) => {
    const transcript = e.results[0][0].transcript;
    if (dom.searchInput) dom.searchInput.value = transcript;
    dom.searchBtn?.click();
    stopVoiceSearch();
  };
  recognition.onerror = () => {
    showToast(__('voice_search_not_recognized'), 'error');
    stopVoiceSearch();
  };
  recognition.onend = () => stopVoiceSearch();
  recognition.start();
  state._voiceRecognition = recognition;
}

function stopVoiceSearch(): void {
  state._voiceListening = false;
  dom.voiceSearchBtn?.classList.remove('listening');
  if (state._voiceRecognition) {
    try {
      (state._voiceRecognition as SpeechRecognitionInstance).stop();
    } catch (_e) {
      /* noop */
    }
    state._voiceRecognition = null;
  }
}

/* ===================== ARABIC KEYBOARD ===================== */

let _shiftActive = false;

function toggleKeyboard(): void {
  const kbd = document.getElementById('arabicKeyboard');
  if (!kbd) return;
  kbd.classList.toggle('open');
  dom.kbdToggleBtn?.classList.toggle('active');
}

function handleKeyClick(e: MouseEvent): void {
  const key = (e.currentTarget as HTMLElement).dataset.key!;
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
    const shiftMap: Record<string, string> = {
      ذ: 'ّ',
      '١': '!',
      '٢': '@',
      '٣': '#',
      '٤': '$',
      '٥': '%',
      '٦': '^',
      '٧': '&',
      '٨': '*',
      '٩': '(',
      '٠': ')',
      '-': '_',
      '=': '+',
    };
    const reverseMap: Record<string, string> = {};
    for (const [k2, v] of Object.entries(shiftMap)) reverseMap[v] = k2;
    document.querySelectorAll('.kbd-key[data-key]').forEach((k) => {
      const el = k as HTMLElement;
      const val = el.dataset.key;
      if (!val || val === 'space' || val === 'backspace' || val === 'clear' || val === 'shift') return;
      if (_shiftActive) {
        const shifted = shiftMap[val];
        if (shifted) {
          el.textContent = shifted;
          el.dataset.key = shifted;
        }
      } else {
        const unshifted = reverseMap[val];
        if (unshifted) {
          el.textContent = unshifted;
          el.dataset.key = unshifted;
        }
      }
    });
    return;
  } else {
    input.value = input.value.slice(0, start) + key + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + key.length;
  }
  input.focus();
}

export function initKeyboard(): void {
  dom.kbdToggleBtn = document.getElementById('kbdToggleBtn');
  dom.kbdToggleBtn?.addEventListener('click', toggleKeyboard);
  document.querySelectorAll('.kbd-key').forEach((btn: Element) => {
    (btn as HTMLElement).addEventListener('click', handleKeyClick);
  });
  document.addEventListener('click', (e: MouseEvent) => {
    const kbd = document.getElementById('arabicKeyboard');
    const toggle = dom.kbdToggleBtn;
    if (!kbd || !toggle) return;
    const target = e.target as Node;
    if (!kbd.contains(target) && target !== toggle && !toggle.contains(target)) {
      kbd.classList.remove('open');
      toggle.classList.remove('active');
    }
  });
}
