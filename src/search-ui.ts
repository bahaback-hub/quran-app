/**
 * @module search-ui
 * @description Search UI controller for the Quran app. Manages the search interface
 * including exact search execution, search result rendering with diacritic-aware
 * highlighting, autocomplete suggestions, search history, voice search via the
 * Web Speech API, and an on-screen Arabic keyboard for input.
 */

import { state, type QuranTextEntry, type SearchWord } from './state.js';
import {
  getAllSearchMatches,
  setAllSearchMatches,
  getSearchResultsPage,
  setSearchResultsPage,
  getVoiceListening,
  setVoiceListening,
  getVoiceRecognition,
  setVoiceRecognition,
} from './internal-state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { escapeRegExp, copyToClipboard, normalizeExactText } from './utils.js';
import {
  searchEmptyResults,
  searchResultsHeader,
  searchResultCard,
  searchLoadMoreButton,
  searchHistoryItem,
  searchAutocompleteItem,
  escapeHtml,
} from './templates.js';
import { loadSurah, highlightCurrentAyah } from './app.js';
import { playCurrentAyah } from './audio.js';
import {
  SEARCH_PAGE_SIZE,
  performSearch,
  addToSearchHistory,
  loadFullQuranText,
  getSearchHistory,
  clearSearchHistory,
} from './search-core.js';
import { CONFIG } from './config.js';
import { __ } from './i18n.js';


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

/** Track which elements have had delegation listeners bound (replaces expando properties). */
const _delegationBoundElements = new Set<HTMLElement>();

/**
 * Perform an exact normalized search and render the results.
 * Validates minimum query length (1 char for Arabic, 2 for other scripts),
 * adds the query to search history, delegates to the search engine core,
 * and renders the first page of results.
 *
 * @param query - The search query string.
 *
 * @example
 * performExactSearch('الله');   // Arabic search
 * performExactSearch('mercy');  // English search
 */
export function performExactSearch(query: string): void {
  // Allow single-character queries for Arabic text (common roots like رب, صل)
  const isArabic = /[\u0621-\u064A]/.test(query.trim());
  if (!query.trim() || (!isArabic && query.length < 2) || (isArabic && query.length < 1)) {
    showToast(__('min_chars'), 'error');
    return;
  }
  if (!state.fullQuranLoaded) {
    showToast(__('quran_db_loading'), 'error');
    return;
  }
  addToSearchHistory(query.trim());
  const matches = performSearch(query);
  setAllSearchMatches(matches);
  setSearchResultsPage(1);
  renderSearchResults(matches.slice(0, SEARCH_PAGE_SIZE), query, matches.length > SEARCH_PAGE_SIZE);
}

const _highlightCache = new Map<string, string>();

function buildSearchHighlight(text: string, query: string): string {
  const cacheKey = text + '\n' + query;
  const cached = _highlightCache.get(cacheKey);
  if (cached) {
    return cached;
  }
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
    if (diacriticRE.test(text[i]!)) {
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
  if (!matches.length) {
    const r = escapeHtml(text);
    _highlightCache.set(cacheKey, r);
    return r;
  }
  const origRanges: OrigRange[] = matches
    .map((match) => {
      let origStart = -1,
        origEnd = -1;
      for (let i = 0; i < map.length; i++) {
        if (map[i] === match.start && origStart === -1) {
          origStart = i;
        }
        if (map[i] === match.end - 1) {
          origEnd = i;
        }
      }
      if (origEnd === -1) {
        origEnd = text.length - 1;
      }
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
    if (first) {
      _highlightCache.delete(first);
    }
  }
  _highlightCache.set(cacheKey, result);
  return result;
}

function renderSearchResults(matches: QuranTextEntry[], query: string, hasMore: boolean): void {
  if (!dom.searchResults) {
    return;
  }
  dom.searchResults.innerHTML = '';
  if (!matches.length) {
    dom.searchResults.innerHTML = searchEmptyResults();
    dom.searchResults.style.display = 'block';
    return;
  }
  const totalResults = getAllSearchMatches()?.length ?? matches.length;
  let html = searchResultsHeader(totalResults);
  for (const m of matches) {
    const highlighted = buildSearchHighlight(m.text, query);
    const fi = state.fullQuranText?.indexOf(m) ?? -1;
    html += searchResultCard({
      surah: m.surah,
      ayah: m.ayah,
      surahName: m.surahName || '',
      fulltextIndex: fi,
      highlighted,
    });
  }
  if (hasMore) {
    html += searchLoadMoreButton(Math.min(SEARCH_PAGE_SIZE, totalResults - matches.length));
  }
  dom.searchResults.innerHTML = html;
  dom.searchResults.style.display = 'block';

  if (!_delegationBoundElements.has(dom.searchResults)) {
    _delegationBoundElements.add(dom.searchResults);
    dom.searchResults.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.id === 'closeSearchResultsBtn') {
        dom.searchResults!.style.display = 'none';
        return;
      }
      if (target.id === 'loadMoreSearchBtn') {
        const q = dom.searchResults!.dataset['query'] || '';
        const currentCount = dom.searchResults!.querySelectorAll('.search-result-item').length;
        setSearchResultsPage((getSearchResultsPage() || 1) + 1);
        const allMatches = getAllSearchMatches() ?? [];
        const nextBatch = allMatches.slice(0, currentCount + SEARCH_PAGE_SIZE);
        renderSearchResults(nextBatch, q, nextBatch.length < allMatches.length);
        return;
      }
      const playBtn = target.closest('.search-play') as HTMLElement | null;
      if (playBtn) {
        playSpecificAyah(parseInt(playBtn.dataset['surah']!, 10), parseInt(playBtn.dataset['ayah']!, 10));
        return;
      }
      const copyBtn = target.closest('.search-copy') as HTMLElement | null;
      if (copyBtn) {
        copySpecificAyah(parseInt(copyBtn.dataset['surah']!, 10), parseInt(copyBtn.dataset['ayah']!, 10));
        return;
      }
      const shareBtn = target.closest('.search-share') as HTMLElement | null;
      if (shareBtn) {
        shareSpecificAyah(parseInt(shareBtn.dataset['surah']!, 10), parseInt(shareBtn.dataset['ayah']!, 10));
        return;
      }
      const gotoBtn = target.closest('.search-goto') as HTMLElement | null;
      if (gotoBtn) {
        const s = parseInt(gotoBtn.dataset['surah']!, 10);
        const a = parseInt(gotoBtn.dataset['ayah']!, 10);
        if (dom.surahSelect) {
          dom.surahSelect.value = String(s);
        }
        loadSurah(s, { startAyah: a });
        return;
      }
      if (target.closest('.search-result-actions')) {
        return;
      }
      const item = target.closest('.search-result-item') as HTMLElement | null;
      if (!item) {
        return;
      }
      const s = parseInt(item.dataset['surah']!, 10);
      const a = parseInt(item.dataset['ayah']!, 10);
      const idx = parseInt(item.dataset['fulltextIndex']!, 10);
      const ayahObj = state.fullQuranText?.[idx];
      if (!ayahObj) {
        return;
      }
      import('./ayah-modal.js').then((m: AyahModalModule) =>
        m.openAyahModal({ surah: s, ayah: a, text: ayahObj.text, surahName: item.dataset['surahname']!, index: idx }),
      );
    });
  }
  dom.searchResults.dataset['query'] = query;
}

function playSpecificAyah(surah: number, ayah: number): void {
  if (state.currentSurah !== surah || !state.surahData) {
    loadSurah(surah, { startAyah: ayah, autoPlay: true });
  } else {
    const ayahs = state.surahData?.ayahs;
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
    if (ayahObj) {
      text = ayahObj.text;
    }
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
    if (ayahObj) {
      text = ayahObj.text;
    }
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
      if (err.name !== 'AbortError') {
        console.warn('Share failed:', err);
      }
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
  if (!dropdown) {
    return;
  }
  const history = getSearchHistory();
  if (!history.length) {
    dropdown.style.display = 'none';
    return;
  }
  let html = '<div class="search-history-header">' + __('search_history_title') + '</div>';
  for (let i = 0; i < history.length; i++) {
    html += searchHistoryItem(history[i]!, i);
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
        const idx = parseInt((el as HTMLElement).dataset['index']!, 10);
        history2.splice(idx, 1);
        storage.set('search_history', history2);
        showSearchHistory();
        return;
      }
      if (input) {
        input.value = span!.textContent!;
      }
      dropdown.style.display = 'none';
      performExactSearch(input!.value);
    });
  });
}

/**
 * Initialize the search autocomplete dropdown.
 * Binds focus, input (debounced 150ms), keydown (arrow navigation),
 * and document click (outside-dismiss) listeners on the search input
 * and autocomplete dropdown. Shows search history when the input is empty
 * and focused, and word suggestions as the user types.
 *
 * @example
 * initSearchAutocomplete(); // call after DOM is ready
 */
export function initSearchAutocomplete(): void {
  const input = dom.searchInput;
  const dropdown = document.getElementById('searchAutocomplete');
  if (!input || !dropdown) {
    return;
  }

  input.addEventListener('focus', () => {
    if (!input.value.trim()) {
      showSearchHistory();
    }
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
          if (suggestions.length >= 8) {
            break;
          }
          if (w.word.startsWith(normVal)) {
            suggestions.push(w);
          }
        }
      }
      if (!suggestions.length) {
        dropdown.style.display = 'none';
        _acIndex = -1;
        return;
      }
      let html = '';
      for (let i = 0; i < suggestions.length; i++) {
        html += searchAutocompleteItem(suggestions[i]!.word, suggestions[i]!.count, i);
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
          _acIndex = parseInt(el.dataset['index']!, 10);
        });
      });
    }, 150);
  });

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (dropdown.style.display === 'none') {
      return;
    }
    const items = dropdown.querySelectorAll('.search-autocomplete-item');
    if (!items.length) {
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _acIndex = Math.min(_acIndex + 1, items.length - 1);
      items.forEach((c, i) => c.classList.toggle('active', i === _acIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _acIndex = _acIndex - 1;
      if (_acIndex < -1) {
        _acIndex = -1;
      }
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

/**
 * Start voice search using the Web Speech API (SpeechRecognition).
 * Configures recognition for Arabic (ar-SA), shows a listening indicator,
 * and auto-fills the search input with the recognized transcript.
 * Falls back to an error toast if the API is unavailable.
 *
 * @example
 * startVoiceSearch(); // typically bound to a microphone button click
 */
export function startVoiceSearch(): void {
  const SpeechRecognition =
    (
      window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).SpeechRecognition ||
    (
      window as Window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast(__('voice_search_unsupported'), 'error');
    return;
  }
  if (getVoiceListening()) {
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'ar-SA';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  setVoiceListening(true);
  dom.voiceSearchBtn?.classList.add('listening');
  showToast(__('voice_search_speaking'), 'success');
  recognition.onresult = (e: SpeechRecognitionEvent) => {
    const transcript = e.results[0]![0]!.transcript;
    if (dom.searchInput) {
      dom.searchInput.value = transcript;
    }
    dom.searchBtn?.click();
    stopVoiceSearch();
  };
  recognition.onerror = () => {
    showToast(__('voice_search_not_recognized'), 'error');
    stopVoiceSearch();
  };
  recognition.onend = () => stopVoiceSearch();
  recognition.start();
  setVoiceRecognition(recognition);
}

function stopVoiceSearch(): void {
  setVoiceListening(false);
  dom.voiceSearchBtn?.classList.remove('listening');
  if (getVoiceRecognition()) {
    try {
      (getVoiceRecognition() as SpeechRecognitionInstance).stop();
    } catch {
      /* noop */
    }
    setVoiceRecognition(null);
  }
}

/* ===================== ARABIC KEYBOARD ===================== */

let _shiftActive = false;

function toggleKeyboard(): void {
  const kbd = document.getElementById('arabicKeyboard');
  if (!kbd) {
    return;
  }
  kbd.classList.toggle('open');
  dom.kbdToggleBtn?.classList.toggle('active');
}

function handleKeyClick(e: MouseEvent): void {
  const key = (e.currentTarget as HTMLElement).dataset['key']!;
  const input = dom.searchInput;
  if (!input) {
    return;
  }
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
    for (const [k2, v] of Object.entries(shiftMap)) {
      reverseMap[v] = k2;
    }
    document.querySelectorAll('.kbd-key[data-key]').forEach((k) => {
      const el = k as HTMLElement;
      const val = el.dataset['key'];
      if (!val || val === 'space' || val === 'backspace' || val === 'clear' || val === 'shift') {
        return;
      }
      if (_shiftActive) {
        const shifted = shiftMap[val];
        if (shifted) {
          el.textContent = shifted;
          el.dataset['key'] = shifted;
        }
      } else {
        const unshifted = reverseMap[val];
        if (unshifted) {
          el.textContent = unshifted;
          el.dataset['key'] = unshifted;
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

/**
 * Idempotency guard: prevents double-binding of keyboard event listeners
 * if initKeyboard() is called more than once. Without this, calling
 * initKeyboard() twice would attach duplicate click handlers to each
 * .kbd-key button, causing each keypress to insert the character twice.
 */
let _keyboardInitialized = false;

/**
 * Reset the keyboard initialization state.
 * Useful for testing: allows re-binding handlers to new DOM elements
 * in isolated test cases. In production, this should not be called.
 *
 * @internal
 */
export function _resetKeyboardForTests(): void {
  _keyboardInitialized = false;
}

/**
 * Initialize the on-screen Arabic keyboard.
 * Binds toggle button click, individual key presses (letters, space,
 * backspace, clear, shift), and an outside-click dismiss handler.
 * Should be called once during app startup.
 *
 * @example
 * initKeyboard(); // call after cacheDom()
 */
export function initKeyboard(): void {
  if (_keyboardInitialized) {
    return;
  }
  _keyboardInitialized = true;
  // kbdToggleBtn is already cached by cacheDom() — the reassignment below is
  // kept as a defensive fallback in case cacheDom() ran before the element
  // was injected into the DOM (race condition with overlays.ts).
  if (!dom.kbdToggleBtn) {
    dom.kbdToggleBtn = document.getElementById('kbdToggleBtn');
  }
  dom.kbdToggleBtn?.addEventListener('click', toggleKeyboard);
  document.querySelectorAll('.kbd-key').forEach((btn: Element) => {
    (btn as HTMLElement).addEventListener('click', handleKeyClick);
  });
  document.addEventListener('click', (e: MouseEvent) => {
    const kbd = document.getElementById('arabicKeyboard');
    const toggle = dom.kbdToggleBtn;
    if (!kbd || !toggle) {
      return;
    }
    const target = e.target as Node;
    if (!kbd.contains(target) && target !== toggle && !toggle.contains(target)) {
      kbd.classList.remove('open');
      toggle.classList.remove('active');
    }
  });
}
