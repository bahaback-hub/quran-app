/**
 * @module search-ui
 * @description Search UI controller for the Quran app. Manages the search interface
 * including exact search execution, search result rendering with diacritic-aware
 * highlighting, autocomplete suggestions, search history, voice search via the
 * Web Speech API, and an on-screen Arabic keyboard for input.
 */

import { state, type QuranTextEntry, type SearchWord } from '../../state.js';
import {
  getAllSearchMatches,
  setAllSearchMatches,
  getSearchResultsPage,
  setSearchResultsPage,
} from '../../internal-state.js';
import { dom } from '../../dom.js';
import { requireDom } from '../../dom-require.js';
import { storage } from '../../storage.js';
import { showToast } from '../../ui.js';
import { escapeRegExp, copyToClipboard, normalizeExactText } from '../../utils.js';
import {
  searchEmptyResults,
  searchResultsHeader,
  searchResultCard,
  searchLoadMoreButton,
  searchHistoryItem,
  searchAutocompleteItem,
  escapeHtml,
} from '../../templates.js';
import { loadSurah, highlightCurrentAyah } from '../../surah-loader.js';
import { apiFetch } from '../../api-client.js';
import { playCurrentAyah } from '../audio/audio.js';
import {
  SEARCH_PAGE_SIZE,
  performSearch,
  addToSearchHistory,
  loadFullQuranText,
  getSearchHistory,
  clearSearchHistory,
} from './search-core.js';
import { __ } from '../../i18n.js';
import { shareText } from '../../share.js';
import { setTrustedHtml } from '../../safe-html.js';

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
  dom.searchResults.replaceChildren();
  if (!matches.length) {
    setTrustedHtml(dom.searchResults, searchEmptyResults());
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
  setTrustedHtml(dom.searchResults, html);
  dom.searchResults.style.display = 'block';

  if (!_delegationBoundElements.has(dom.searchResults)) {
    _delegationBoundElements.add(dom.searchResults);
    dom.searchResults.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.id === 'closeSearchResultsBtn') {
        requireDom('searchResults').style.display = 'none';
        return;
      }
      if (target.id === 'loadMoreSearchBtn') {
        const q = requireDom('searchResults').dataset['query'] || '';
        const currentCount = requireDom('searchResults').querySelectorAll('.search-result-item').length;
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
      import('../../ayah-modal.js').then((m: AyahModalModule) =>
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
      const data = await apiFetch<{ data?: { text?: string } }>(`/ayah/${surah}:${ayah}/quran-uthmani`);
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
      const data = await apiFetch<{ data?: { text?: string } }>(`/ayah/${surah}:${ayah}/quran-uthmani`);
      text = data?.data?.text || '';
    } catch (err) {
      console.warn('Failed to fetch ayah for share:', err);
    }
  }
  const shareMsg = text
    ? `﴿${text}﴾\n— ${surahName.trim()} — ${__('ayah')} ${ayah}`
    : `${__('ayah')} ${ayah} ${__('surah')} ${surahName.trim()}`;
  void shareText(shareMsg, __('copied'));
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
  setTrustedHtml(dropdown, html);
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
      setTrustedHtml(dropdown, html);
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

export { startVoiceSearch } from './search-ui-voice.js';
export { initKeyboard, _resetKeyboardForTests } from './search-ui-keyboard.js';
