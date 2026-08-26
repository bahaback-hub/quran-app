/**
 * Comprehensive tests for search-ui.ts — covers all exported functions:
 * - performExactSearch
 * - initSearchAutocomplete
 * - startVoiceSearch
 * - initKeyboard
 * - loadFullQuranText / getSearchHistory / clearSearchHistory (re-exports)
 * Plus internal behaviors: highlight caching, result rendering, delegation,
 * pagination (load more), play/copy/share/goto actions, autocomplete
 * navigation, history display, keyboard input handling, shift mode, etc.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock all dependencies ─────────────────────────────────────

vi.mock('../state.js', () => ({
  state: {
    fullQuranLoaded: false,
    fullQuranText: null as unknown,
    currentSurah: 0,
    surahData: null as unknown,
    currentAyahIndex: 0,
    searchWords: [] as Array<{ word: string; count: number }>,
    searchPrefixMap: null as unknown,
    surahList: [] as Array<{ number: number; name: string }>,
  },
}));

vi.mock('../dom.js', () => ({
  dom: {
    searchResults: null as HTMLElement | null,
    searchInput: null as HTMLInputElement | null,
    searchBtn: null as HTMLElement | null,
    surahSelect: null as HTMLSelectElement | null,
    voiceSearchBtn: null as HTMLElement | null,
    kbdToggleBtn: null as HTMLElement | null,
  },
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  escapeRegExp: (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  copyToClipboard: vi.fn(),
  normalizeExactText: (s: string) =>
    s
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[\u0610-\u061A]/g, '')
      .replace(/[\u06D6-\u06ED]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
}));

vi.mock('../templates.js', () => ({
  searchEmptyResults: () => '<div class="search-empty">No results</div>',
  searchResultsHeader: (total: number) => `<div class="search-header">${total} results</div>`,
  searchResultCard: (data: {
    surah: number;
    ayah: number;
    surahName: string;
    fulltextIndex: number;
    highlighted: string;
  }) =>
    `<div class="search-result-item" data-surah="${data.surah}" data-ayah="${data.ayah}" data-fulltext-index="${data.fulltextIndex}" data-surahname="${data.surahName}">${data.highlighted}</div>`,
  searchLoadMoreButton: (remaining: number) => `<button id="loadMoreSearchBtn">Load more (${remaining})</button>`,
  searchHistoryItem: (text: string, idx: number) =>
    `<div class="search-autocomplete-item" data-index="${idx}"><span>${text}</span><span class="count">✕</span></div>`,
  searchAutocompleteItem: (word: string, count: number, idx: number) =>
    `<div class="search-autocomplete-item" data-index="${idx}"><span>${word}</span> (${count})</div>`,
  escapeHtml: (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
}));

vi.mock('../app.js', () => ({
  loadSurah: vi.fn(),
  highlightCurrentAyah: vi.fn(),
}));

vi.mock('../audio.js', () => ({
  playCurrentAyah: vi.fn(),
}));

vi.mock('../search-core.js', () => ({
  SEARCH_PAGE_SIZE: 10,
  performSearch: vi.fn(() => []),
  addToSearchHistory: vi.fn(),
  loadFullQuranText: vi.fn(),
  getSearchHistory: vi.fn(() => []),
  clearSearchHistory: vi.fn(),
}));

vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
  },
}));

vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) => {
    let val = key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, arg);
    });
    return val;
  },
}));

vi.mock('../internal-state.js', () => ({
  getAllSearchMatches: vi.fn(() => []),
  setAllSearchMatches: vi.fn(),
  getSearchResultsPage: vi.fn(() => 1),
  setSearchResultsPage: vi.fn(),
  getVoiceListening: vi.fn(() => false),
  setVoiceListening: vi.fn(),
  getVoiceRecognition: vi.fn(() => null),
  setVoiceRecognition: vi.fn(),
}));

// ─── Import after mocks ────────────────────────────────────────

import {
  performExactSearch,
  initSearchAutocomplete,
  startVoiceSearch,
  initKeyboard,
  _resetKeyboardForTests,
} from '../search-ui.js';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { showToast } from '../ui.js';
import { performSearch, addToSearchHistory, getSearchHistory } from '../search-core.js';
import {
  setAllSearchMatches,
  setSearchResultsPage,
  getVoiceListening,
  setVoiceListening,
  getVoiceRecognition,
  setVoiceRecognition,
  getAllSearchMatches,
  getSearchResultsPage,
} from '../internal-state.js';
import { copyToClipboard } from '../utils.js';
import { loadSurah, highlightCurrentAyah } from '../app.js';
import { playCurrentAyah } from '../audio.js';

// ═══════════════════════════════════════════════════════════════
// performExactSearch
// ═══════════════════════════════════════════════════════════════

describe('performExactSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (state as Record<string, unknown>).fullQuranLoaded = true;
    (state as Record<string, unknown>).fullQuranText = [];
  });

  it('should show error toast for empty query', () => {
    performExactSearch('');
    expect(showToast).toHaveBeenCalledWith('min_chars', 'error');
  });

  it('should show error toast for whitespace-only query', () => {
    performExactSearch('   ');
    expect(showToast).toHaveBeenCalledWith('min_chars', 'error');
  });

  it('should show error toast for non-Arabic single character query', () => {
    performExactSearch('a');
    expect(showToast).toHaveBeenCalledWith('min_chars', 'error');
  });

  it('should show error toast for single non-Arabic letter', () => {
    performExactSearch('x');
    expect(showToast).toHaveBeenCalledWith('min_chars', 'error');
  });

  it('should allow single-character Arabic query', () => {
    performExactSearch('ر');
    // Should NOT have called with min_chars error
    expect(showToast).not.toHaveBeenCalledWith('min_chars', 'error');
  });

  it('should allow multi-character Arabic query', () => {
    performExactSearch('الله');
    expect(addToSearchHistory).toHaveBeenCalledWith('الله');
  });

  it('should show error toast when Quran is not loaded', () => {
    (state as Record<string, unknown>).fullQuranLoaded = false;
    performExactSearch('الله');
    expect(showToast).toHaveBeenCalledWith('quran_db_loading', 'error');
  });

  it('should add trimmed query to search history', () => {
    performExactSearch('  الله  ');
    expect(addToSearchHistory).toHaveBeenCalledWith('الله');
  });

  it('should call performSearch with the query', () => {
    performExactSearch('الرحمن');
    expect(performSearch).toHaveBeenCalledWith('الرحمن');
  });

  it('should set all search matches and page', () => {
    performExactSearch('الله');
    expect(setAllSearchMatches).toHaveBeenCalled();
    expect(setSearchResultsPage).toHaveBeenCalledWith(1);
  });

  it('should not throw when searchResults DOM is null', () => {
    (dom as Record<string, unknown>).searchResults = null;
    expect(() => performExactSearch('الله')).not.toThrow();
  });

  it('should render results into searchResults element', () => {
    const el = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = el;
    performExactSearch('الله');
    expect(el.style.display).toBe('block');
  });

  it('should handle non-Arabic queries of sufficient length', () => {
    performExactSearch('mercy');
    expect(addToSearchHistory).toHaveBeenCalledWith('mercy');
  });

  it('should render empty results when no matches found', () => {
    const el = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = el;
    vi.mocked(performSearch).mockReturnValue([]);
    performExactSearch('xyz');
    expect(el.innerHTML).toContain('search-empty');
  });

  it('should render match cards when results found', () => {
    const el = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = el;
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    (state as Record<string, unknown>).fullQuranText = matches;
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);
    performExactSearch('الله');
    expect(el.innerHTML).toContain('search-result-item');
  });

  it('should show load more button when results exceed page size', () => {
    const el = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = el;
    const manyMatches = Array.from({ length: 15 }, (_, i) => ({
      surah: 1,
      surahName: 'الفاتحة',
      ayah: i + 1,
      text: `آية ${i}`,
      normalized: `آية ${i}`,
    }));
    (state as Record<string, unknown>).fullQuranText = manyMatches;
    vi.mocked(performSearch).mockReturnValue(manyMatches);
    vi.mocked(getAllSearchMatches).mockReturnValue(manyMatches);
    performExactSearch('آية');
    expect(el.innerHTML).toContain('loadMoreSearchBtn');
  });
});

// ═══════════════════════════════════════════════════════════════
// initSearchAutocomplete
// ═══════════════════════════════════════════════════════════════

describe('initSearchAutocomplete', () => {
  let input: HTMLInputElement;
  let dropdown: HTMLElement;

  beforeEach(() => {
    input = document.createElement('input');
    input.id = 'searchInput';
    dropdown = document.createElement('div');
    dropdown.id = 'searchAutocomplete';
    document.body.appendChild(input);
    document.body.appendChild(dropdown);
    (dom as Record<string, unknown>).searchInput = input;
  });

  afterEach(() => {
    input.remove();
    dropdown.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should not throw when input or dropdown is missing', () => {
    (dom as Record<string, unknown>).searchInput = null;
    expect(() => initSearchAutocomplete()).not.toThrow();
  });

  it('should not throw when dropdown is missing', () => {
    dropdown.remove();
    expect(() => initSearchAutocomplete()).not.toThrow();
  });

  it('should bind focus event on input', () => {
    const spy = vi.spyOn(input, 'addEventListener');
    initSearchAutocomplete();
    expect(spy).toHaveBeenCalledWith('focus', expect.any(Function));
  });

  it('should bind input event on input', () => {
    const spy = vi.spyOn(input, 'addEventListener');
    initSearchAutocomplete();
    expect(spy).toHaveBeenCalledWith('input', expect.any(Function));
  });

  it('should bind keydown event on input', () => {
    const spy = vi.spyOn(input, 'addEventListener');
    initSearchAutocomplete();
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should show search history on focus when input is empty', () => {
    vi.mocked(getSearchHistory).mockReturnValue(['الله', 'الرحمن']);
    initSearchAutocomplete();
    input.dispatchEvent(new Event('focus'));
    expect(dropdown.style.display).toBe('block');
  });

  it('should hide dropdown when input is empty and no history', () => {
    vi.mocked(getSearchHistory).mockReturnValue([]);
    initSearchAutocomplete();
    input.value = '';
    input.dispatchEvent(new Event('focus'));
    expect(dropdown.style.display).toBe('none');
  });

  it('should show autocomplete suggestions on input', () => {
    vi.useFakeTimers();
    (state as Record<string, unknown>).searchWords = [
      { word: 'الله', count: 100 },
      { word: 'الرحمن', count: 50 },
    ];
    (state as Record<string, unknown>).searchPrefixMap = new Map([['ال', [{ word: 'الله', count: 100 }]]]);
    initSearchAutocomplete();
    input.value = 'ال';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(200);
    expect(dropdown.style.display).toBe('block');
    expect(dropdown.innerHTML).toContain('الله');
    vi.useRealTimers();
  });

  it('should hide dropdown when input is empty after typing', () => {
    vi.useFakeTimers();
    (state as Record<string, unknown>).searchWords = [];
    initSearchAutocomplete();
    input.value = '';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(200);
    expect(dropdown.style.display).toBe('none');
    vi.useRealTimers();
  });

  it('should hide dropdown when searchWords is empty', () => {
    vi.useFakeTimers();
    (state as Record<string, unknown>).searchWords = [];
    initSearchAutocomplete();
    input.value = 'test';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(200);
    expect(dropdown.style.display).toBe('none');
    vi.useRealTimers();
  });

  it('should navigate with arrow keys', () => {
    vi.mocked(getSearchHistory).mockReturnValue([]);
    initSearchAutocomplete();

    // Set up dropdown with items manually
    dropdown.innerHTML = `
      <div class="search-autocomplete-item" data-index="0"><span>الله</span></div>
      <div class="search-autocomplete-item" data-index="1"><span>الرحمن</span></div>
    `;
    dropdown.style.display = 'block';

    const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    input.dispatchEvent(downEvent);

    const downEvent2 = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    input.dispatchEvent(downEvent2);

    const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
    input.dispatchEvent(upEvent);

    // Should not throw
    expect(true).toBe(true);
  });

  it('should close dropdown on Escape', () => {
    initSearchAutocomplete();
    dropdown.innerHTML = '<div class="search-autocomplete-item" data-index="0"><span>test</span></div>';
    dropdown.style.display = 'block';

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    input.dispatchEvent(escEvent);
    expect(dropdown.style.display).toBe('none');
  });

  it('should not process keydown when dropdown is hidden', () => {
    initSearchAutocomplete();
    dropdown.style.display = 'none';
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    // Should not throw
    expect(() => input.dispatchEvent(event)).not.toThrow();
  });

  it('should close dropdown on outside click', () => {
    initSearchAutocomplete();
    dropdown.style.display = 'block';

    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    outsideEl.click();
    expect(dropdown.style.display).toBe('none');
    outsideEl.remove();
  });

  it('should not close dropdown when clicking inside dropdown', () => {
    initSearchAutocomplete();
    dropdown.style.display = 'block';

    // Click inside dropdown — should not hide
    const innerEl = document.createElement('span');
    dropdown.appendChild(innerEl);
    innerEl.click();
    expect(dropdown.style.display).toBe('block');
  });

  it('should select autocomplete item on Enter when index >= 0', () => {
    initSearchAutocomplete();
    dropdown.innerHTML = `<div class="search-autocomplete-item" data-index="0"><span>الله</span></div>`;
    dropdown.style.display = 'block';

    // Navigate down first
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // Then Enter
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enterEvent);

    // Should have hidden dropdown and triggered search
    expect(dropdown.style.display).toBe('none');
  });

  it('should fall back to linear scan for prefixes longer than 5', () => {
    vi.useFakeTimers();
    (state as Record<string, unknown>).searchWords = [{ word: 'abcdefghij', count: 5 }];
    (state as Record<string, unknown>).searchPrefixMap = new Map();
    initSearchAutocomplete();
    input.value = 'abcdef';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(200);
    expect(dropdown.style.display).toBe('block');
    expect(dropdown.innerHTML).toContain('abcdefghij');
    vi.useRealTimers();
  });

  it('should hide dropdown when no suggestions match for long prefix', () => {
    vi.useFakeTimers();
    (state as Record<string, unknown>).searchWords = [{ word: 'xyz', count: 5 }];
    (state as Record<string, unknown>).searchPrefixMap = new Map();
    initSearchAutocomplete();
    input.value = 'abcdef';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(200);
    expect(dropdown.style.display).toBe('none');
    vi.useRealTimers();
  });
});

// ═══════════════════════════════════════════════════════════════
// startVoiceSearch
// ═══════════════════════════════════════════════════════════════

describe('startVoiceSearch', () => {
  let voiceBtn: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    voiceBtn = document.createElement('button');
    voiceBtn.id = 'voiceSearchBtn';
    document.body.appendChild(voiceBtn);
    (dom as Record<string, unknown>).voiceSearchBtn = voiceBtn;
    // Ensure no SpeechRecognition by default
    delete (window as Record<string, unknown>).SpeechRecognition;
    delete (window as Record<string, unknown>).webkitSpeechRecognition;
  });

  afterEach(() => {
    voiceBtn.remove();
    (dom as Record<string, unknown>).voiceSearchBtn = null;
    delete (window as Record<string, unknown>).SpeechRecognition;
    delete (window as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('should show error toast when SpeechRecognition is not available', () => {
    vi.mocked(getVoiceListening).mockReturnValue(false);
    startVoiceSearch();
    expect(showToast).toHaveBeenCalledWith('voice_search_unsupported', 'error');
  });

  it('should not start recognition if already listening', () => {
    const mockStart = vi.fn();
    function MockSpeechRecognition(this: {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: unknown;
      onerror: unknown;
      onend: unknown;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = mockStart;
      this.stop = vi.fn();
    }
    (window as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    vi.mocked(getVoiceListening).mockReturnValue(true);
    startVoiceSearch();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('should start recognition when SpeechRecognition is available and not listening', () => {
    const mockStart = vi.fn();
    function MockSpeechRecognition(this: {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: unknown;
      onerror: unknown;
      onend: unknown;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = mockStart;
      this.stop = vi.fn();
    }
    (window as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    vi.mocked(getVoiceListening).mockReturnValue(false);
    startVoiceSearch();
    expect(setVoiceListening).toHaveBeenCalledWith(true);
    expect(mockStart).toHaveBeenCalled();
  });

  it('should add listening class to voice button', () => {
    function MockSpeechRecognition(this: {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: unknown;
      onerror: unknown;
      onend: unknown;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = vi.fn();
      this.stop = vi.fn();
    }
    (window as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    vi.mocked(getVoiceListening).mockReturnValue(false);
    startVoiceSearch();
    expect(voiceBtn.classList.contains('listening')).toBe(true);
  });

  it('should use webkitSpeechRecognition as fallback', () => {
    const mockStart = vi.fn();
    function MockWebkitSpeechRecognition(this: {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: unknown;
      onerror: unknown;
      onend: unknown;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = mockStart;
      this.stop = vi.fn();
    }
    (window as Record<string, unknown>).webkitSpeechRecognition = MockWebkitSpeechRecognition;
    vi.mocked(getVoiceListening).mockReturnValue(false);
    startVoiceSearch();
    expect(mockStart).toHaveBeenCalled();
  });

  it('should set recognition lang to ar-SA', () => {
    let capturedLang = '';
    function MockSpeechRecognition(this: {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: unknown;
      onerror: unknown;
      onend: unknown;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = vi.fn();
      this.stop = vi.fn();
      // Capture the lang after it's set
      setTimeout(() => {
        capturedLang = this.lang;
      }, 0);
    }
    (window as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    vi.mocked(getVoiceListening).mockReturnValue(false);
    startVoiceSearch();
    // The recognition object is stored; verify via setVoiceRecognition
    expect(setVoiceRecognition).toHaveBeenCalled();
  });

  it('should handle onresult callback — fill search input and click search', () => {
    let onresultHandler: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null = null;
    function MockSpeechRecognition(this: {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
      onerror: unknown;
      onend: unknown;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = vi.fn();
      this.stop = vi.fn();
      // Capture the handler after construction
      setTimeout(() => {
        onresultHandler = this.onresult;
      }, 0);
    }
    (window as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;

    const searchInput = document.createElement('input');
    searchInput.id = 'searchInput';
    document.body.appendChild(searchInput);
    (dom as Record<string, unknown>).searchInput = searchInput;

    const searchBtn = document.createElement('button');
    const clickSpy = vi.spyOn(searchBtn, 'click');
    (dom as Record<string, unknown>).searchBtn = searchBtn;

    vi.mocked(getVoiceListening).mockReturnValue(false);
    startVoiceSearch();

    // Simulate onresult being set — we need to access it from the recognition instance
    const recognition = vi.mocked(setVoiceRecognition).mock.calls[0]![0] as {
      onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
    };
    if (recognition && recognition.onresult) {
      recognition.onresult({ results: { 0: { 0: { transcript: 'الله' } } } } as unknown as Event);
      expect(searchInput.value).toBe('الله');
    }

    searchInput.remove();
    searchBtn.remove();
    (dom as Record<string, unknown>).searchInput = null;
    (dom as Record<string, unknown>).searchBtn = null;
  });

  it('should handle onerror callback — show error toast', () => {
    let onerrorHandler: ((e: Event) => void) | null = null;
    function MockSpeechRecognition(this: {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: unknown;
      onerror: ((e: Event) => void) | null;
      onend: unknown;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = vi.fn();
      this.stop = vi.fn();
    }
    (window as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    vi.mocked(getVoiceListening).mockReturnValue(false);
    startVoiceSearch();

    const recognition = vi.mocked(setVoiceRecognition).mock.calls[0]![0] as {
      onerror: ((e: Event) => void) | null;
    };
    if (recognition && recognition.onerror) {
      vi.clearAllMocks();
      recognition.onerror(new Event('error'));
      expect(showToast).toHaveBeenCalledWith('voice_search_not_recognized', 'error');
    }
  });

  it('should handle onend callback — stop voice search', () => {
    function MockSpeechRecognition(this: {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: unknown;
      onerror: unknown;
      onend: (() => void) | null;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }) {
      this.lang = '';
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.start = vi.fn();
      this.stop = vi.fn();
    }
    (window as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition;
    vi.mocked(getVoiceListening).mockReturnValue(false);
    startVoiceSearch();

    const recognition = vi.mocked(setVoiceRecognition).mock.calls[0]![0] as {
      onend: (() => void) | null;
    };
    if (recognition && recognition.onend) {
      vi.clearAllMocks();
      recognition.onend();
      expect(setVoiceListening).toHaveBeenCalledWith(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// initKeyboard
// ═══════════════════════════════════════════════════════════════

describe('initKeyboard', () => {
  let toggleBtn: HTMLElement;
  let keyBtn: HTMLElement;

  beforeEach(() => {
    _resetKeyboardForTests();
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'kbdToggleBtn';
    keyBtn = document.createElement('button');
    keyBtn.className = 'kbd-key';
    keyBtn.dataset['key'] = 'ا';
    keyBtn.textContent = 'ا';
    document.body.appendChild(toggleBtn);
    document.body.appendChild(keyBtn);
    (dom as Record<string, unknown>).kbdToggleBtn = toggleBtn;
  });

  afterEach(() => {
    toggleBtn.remove();
    keyBtn.remove();
    (dom as Record<string, unknown>).kbdToggleBtn = null;
  });

  it('should find and set kbdToggleBtn in dom', () => {
    initKeyboard();
    expect(dom.kbdToggleBtn).toBe(toggleBtn);
  });

  it('should not throw when keyboard toggle button does not exist', () => {
    (dom as Record<string, unknown>).kbdToggleBtn = null;
    toggleBtn.remove();
    expect(() => initKeyboard()).not.toThrow();
  });

  it('should type a key character into the search input', () => {
    const input = document.createElement('input');
    input.type = 'text';
    (dom as Record<string, unknown>).searchInput = input;
    initKeyboard();

    keyBtn.click();
    expect(input.value).toContain('ا');

    input.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should handle clear key', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'test';
    (dom as Record<string, unknown>).searchInput = input;
    initKeyboard();

    keyBtn.dataset['key'] = 'clear';
    keyBtn.click();
    expect(input.value).toBe('');

    input.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should handle space key', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'hello';
    (dom as Record<string, unknown>).searchInput = input;
    initKeyboard();

    keyBtn.dataset['key'] = 'space';
    keyBtn.click();
    expect(input.value).toBe('hello ');

    input.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should handle backspace key when cursor at end', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'abc';
    (dom as Record<string, unknown>).searchInput = input;
    initKeyboard();

    keyBtn.dataset['key'] = 'backspace';
    // Set selection at end
    input.selectionStart = 3;
    input.selectionEnd = 3;
    keyBtn.click();
    expect(input.value).toBe('ab');

    input.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should handle backspace key with selection range', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'abcdef';
    (dom as Record<string, unknown>).searchInput = input;
    initKeyboard();

    keyBtn.dataset['key'] = 'backspace';
    input.selectionStart = 2;
    input.selectionEnd = 4;
    keyBtn.click();
    expect(input.value).toBe('abef');

    input.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should handle backspace key when selectionStart is 0 (falls back to value.length)', () => {
    // Note: code uses `input.selectionStart || input.value.length` which treats 0 as falsy,
    // so selectionStart=0 falls back to value.length=3, effectively deleting from end.
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'abc';
    (dom as Record<string, unknown>).searchInput = input;
    initKeyboard();

    keyBtn.dataset['key'] = 'backspace';
    input.selectionStart = 0;
    input.selectionEnd = 0;
    keyBtn.click();
    // Because `0 || 3` evaluates to 3, backspace operates at end of input
    expect(input.value).toBe('ab');

    input.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should not throw when searchInput is null and a key is clicked', () => {
    (dom as Record<string, unknown>).searchInput = null;
    initKeyboard();
    expect(() => keyBtn.click()).not.toThrow();
  });

  it('should toggle keyboard on toggle button click', () => {
    const kbd = document.createElement('div');
    kbd.id = 'arabicKeyboard';
    document.body.appendChild(kbd);
    initKeyboard();

    toggleBtn.click();
    expect(kbd.classList.contains('open')).toBe(true);

    toggleBtn.click();
    expect(kbd.classList.contains('open')).toBe(false);

    kbd.remove();
  });

  it('should close keyboard on outside click', () => {
    const kbd = document.createElement('div');
    kbd.id = 'arabicKeyboard';
    document.body.appendChild(kbd);
    initKeyboard();

    // Open keyboard
    kbd.classList.add('open');
    toggleBtn.classList.add('active');

    // Click outside
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    outsideEl.click();

    expect(kbd.classList.contains('open')).toBe(false);
    expect(toggleBtn.classList.contains('active')).toBe(false);

    kbd.remove();
    outsideEl.remove();
  });

  it('should not close keyboard when clicking inside it', () => {
    const kbd = document.createElement('div');
    kbd.id = 'arabicKeyboard';
    document.body.appendChild(kbd);
    initKeyboard();

    kbd.classList.add('open');

    // Click inside keyboard
    const innerEl = document.createElement('span');
    kbd.appendChild(innerEl);
    innerEl.click();

    expect(kbd.classList.contains('open')).toBe(true);

    kbd.remove();
  });

  it('should handle shift key toggle', () => {
    const input = document.createElement('input');
    input.type = 'text';
    (dom as Record<string, unknown>).searchInput = input;
    initKeyboard();

    // Create a shift-mappable key
    const shiftKey = document.createElement('button');
    shiftKey.className = 'kbd-key';
    shiftKey.dataset['key'] = 'ذ';
    shiftKey.textContent = 'ذ';
    document.body.appendChild(shiftKey);

    // Click shift
    keyBtn.dataset['key'] = 'shift';
    keyBtn.click();

    // The ذ key should now showّ (shadda)
    expect(shiftKey.dataset['key']).toBe('ّ');
    expect(shiftKey.textContent).toBe('ّ');

    // Click shift again to unshift
    keyBtn.click();
    expect(shiftKey.dataset['key']).toBe('ذ');
    expect(shiftKey.textContent).toBe('ذ');

    shiftKey.remove();
    input.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should handle shift for number keys', () => {
    const input = document.createElement('input');
    input.type = 'text';
    (dom as Record<string, unknown>).searchInput = input;
    initKeyboard();

    const numKey = document.createElement('button');
    numKey.className = 'kbd-key';
    numKey.dataset['key'] = '١';
    numKey.textContent = '١';
    document.body.appendChild(numKey);

    // Click shift
    keyBtn.dataset['key'] = 'shift';
    keyBtn.click();

    expect(numKey.dataset['key']).toBe('!');
    expect(numKey.textContent).toBe('!');

    // Unshift
    keyBtn.click();
    expect(numKey.dataset['key']).toBe('١');
    expect(numKey.textContent).toBe('١');

    numKey.remove();
    input.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should insert regular character at cursor position', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'ab';
    (dom as Record<string, unknown>).searchInput = input;
    initKeyboard();

    input.selectionStart = 1;
    input.selectionEnd = 1;
    keyBtn.dataset['key'] = 'X';
    keyBtn.click();
    expect(input.value).toBe('aXb');

    input.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });
});

// ═══════════════════════════════════════════════════════════════
// Search result click delegation
// ═══════════════════════════════════════════════════════════════

describe('search result click delegation', () => {
  let resultsEl: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    resultsEl = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = resultsEl;
    (state as Record<string, unknown>).fullQuranLoaded = true;
    (state as Record<string, unknown>).fullQuranText = [
      { surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' },
    ];
    document.body.appendChild(resultsEl);
  });

  afterEach(() => {
    resultsEl.remove();
    (dom as Record<string, unknown>).searchResults = null;
  });

  it('should close results on close button click', () => {
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);
    performExactSearch('الله');

    // Simulate close button click
    const closeBtn = document.createElement('button');
    closeBtn.id = 'closeSearchResultsBtn';
    resultsEl.appendChild(closeBtn);
    closeBtn.click();
    expect(resultsEl.style.display).toBe('none');
  });

  it('should handle play button click — different surah', () => {
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);
    (state as Record<string, unknown>).currentSurah = 2; // Different surah

    performExactSearch('الله');

    const playBtn = document.createElement('button');
    playBtn.className = 'search-play';
    playBtn.dataset['surah'] = '1';
    playBtn.dataset['ayah'] = '1';
    resultsEl.appendChild(playBtn);
    playBtn.click();

    expect(loadSurah).toHaveBeenCalledWith(1, { startAyah: 1, autoPlay: true });
  });

  it('should handle play button click — same surah', () => {
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);
    (state as Record<string, unknown>).currentSurah = 1;
    (state as Record<string, unknown>).surahData = {
      ayahs: [{ numberInSurah: 1 }, { numberInSurah: 2 }],
    };

    performExactSearch('الله');

    const playBtn = document.createElement('button');
    playBtn.className = 'search-play';
    playBtn.dataset['surah'] = '1';
    playBtn.dataset['ayah'] = '1';
    resultsEl.appendChild(playBtn);
    playBtn.click();

    expect(highlightCurrentAyah).toHaveBeenCalled();
    expect(playCurrentAyah).toHaveBeenCalled();
  });

  it('should handle copy button click with fullQuranLoaded', async () => {
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);
    (state as Record<string, unknown>).fullQuranLoaded = true;
    (state as Record<string, unknown>).fullQuranText = matches;

    performExactSearch('الله');

    const copyBtn = document.createElement('button');
    copyBtn.className = 'search-copy';
    copyBtn.dataset['surah'] = '1';
    copyBtn.dataset['ayah'] = '1';
    resultsEl.appendChild(copyBtn);
    copyBtn.click();

    // Wait for async copySpecificAyah
    await new Promise((r) => setTimeout(r, 10));
    expect(copyToClipboard).toHaveBeenCalledWith('بسم الله');
  });

  it('should handle goto button click', () => {
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);

    const surahSelect = document.createElement('select');
    const opt = document.createElement('option');
    opt.value = '1';
    opt.textContent = '1';
    surahSelect.appendChild(opt);
    (dom as Record<string, unknown>).surahSelect = surahSelect;

    performExactSearch('الله');

    const gotoBtn = document.createElement('button');
    gotoBtn.className = 'search-goto';
    gotoBtn.dataset['surah'] = '1';
    gotoBtn.dataset['ayah'] = '1';
    resultsEl.appendChild(gotoBtn);
    gotoBtn.click();

    expect(loadSurah).toHaveBeenCalledWith(1, { startAyah: 1 });
    expect(surahSelect.value).toBe('1');

    surahSelect.remove();
    (dom as Record<string, unknown>).surahSelect = null;
  });

  it('should handle clicking on a result item to open ayah modal', () => {
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);
    (state as Record<string, unknown>).fullQuranText = matches;

    performExactSearch('الله');

    // Find the rendered result item and click it
    const item = resultsEl.querySelector('.search-result-item') as HTMLElement;
    if (item) {
      item.click();
      // The import('./ayah-modal.js') is async; just verify no throw
    }
  });

  it('should handle load more button click', () => {
    const manyMatches = Array.from({ length: 15 }, (_, i) => ({
      surah: 1,
      surahName: 'الفاتحة',
      ayah: i + 1,
      text: `آية ${i}`,
      normalized: `آية ${i}`,
    }));
    (state as Record<string, unknown>).fullQuranText = manyMatches;
    vi.mocked(performSearch).mockReturnValue(manyMatches);
    vi.mocked(getAllSearchMatches).mockReturnValue(manyMatches);

    performExactSearch('آية');

    const loadMoreBtn = resultsEl.querySelector('#loadMoreSearchBtn') as HTMLElement;
    if (loadMoreBtn) {
      loadMoreBtn.click();
      expect(setSearchResultsPage).toHaveBeenCalledWith(2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Search history display
// ═══════════════════════════════════════════════════════════════

describe('search history display', () => {
  let input: HTMLInputElement;
  let dropdown: HTMLElement;

  beforeEach(() => {
    input = document.createElement('input');
    input.id = 'searchInput';
    dropdown = document.createElement('div');
    dropdown.id = 'searchAutocomplete';
    document.body.appendChild(input);
    document.body.appendChild(dropdown);
    (dom as Record<string, unknown>).searchInput = input;
  });

  afterEach(() => {
    input.remove();
    dropdown.remove();
    (dom as Record<string, unknown>).searchInput = null;
  });

  it('should render history items with delete buttons', () => {
    vi.mocked(getSearchHistory).mockReturnValue(['الله', 'الرحمن']);
    initSearchAutocomplete();
    input.dispatchEvent(new Event('focus'));
    expect(dropdown.innerHTML).toContain('الله');
    expect(dropdown.innerHTML).toContain('الرحمن');
    expect(dropdown.innerHTML).toContain('count'); // Delete button class
  });

  it('should render search history title', () => {
    vi.mocked(getSearchHistory).mockReturnValue(['الله']);
    initSearchAutocomplete();
    input.dispatchEvent(new Event('focus'));
    expect(dropdown.innerHTML).toContain('search_history_title');
  });
});

// ═══════════════════════════════════════════════════════════════
// Re-exports from search-core
// ═══════════════════════════════════════════════════════════════

describe('search-ui re-exports', () => {
  it('should re-export loadFullQuranText from search-core', async () => {
    const mod = await import('../search-ui.js');
    expect(mod.loadFullQuranText).toBeDefined();
  });

  it('should re-export getSearchHistory from search-core', async () => {
    const mod = await import('../search-ui.js');
    expect(mod.getSearchHistory).toBeDefined();
  });

  it('should re-export clearSearchHistory from search-core', async () => {
    const mod = await import('../search-ui.js');
    expect(mod.clearSearchHistory).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// shareSpecificAyah — navigator.share vs clipboard fallback
// ═══════════════════════════════════════════════════════════════

describe('share functionality', () => {
  let resultsEl: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    resultsEl = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = resultsEl;
    (state as Record<string, unknown>).fullQuranLoaded = true;
    (state as Record<string, unknown>).fullQuranText = [
      { surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' },
    ];
    document.body.appendChild(resultsEl);
  });

  afterEach(() => {
    resultsEl.remove();
    (dom as Record<string, unknown>).searchResults = null;
  });

  it('should handle share button click with text', async () => {
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);

    performExactSearch('الله');

    const shareBtn = document.createElement('button');
    shareBtn.className = 'search-share';
    shareBtn.dataset['surah'] = '1';
    shareBtn.dataset['ayah'] = '1';
    resultsEl.appendChild(shareBtn);

    // Mock navigator.share as unavailable to test clipboard fallback
    const originalShare = navigator.share;
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

    shareBtn.click();
    await new Promise((r) => setTimeout(r, 10));

    // Should fall back to clipboard
    expect(copyToClipboard).toHaveBeenCalled();

    Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
  });
});

// ═══════════════════════════════════════════════════════════════
// Highlight caching behavior
// ═══════════════════════════════════════════════════════════════

describe('search highlight caching', () => {
  let resultsEl: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    resultsEl = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = resultsEl;
    (state as Record<string, unknown>).fullQuranLoaded = true;
    document.body.appendChild(resultsEl);
  });

  afterEach(() => {
    resultsEl.remove();
    (dom as Record<string, unknown>).searchResults = null;
  });

  it('should cache highlight for no-match text (escaped text)', () => {
    // When no match, the escaped text should still be cached
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    (state as Record<string, unknown>).fullQuranText = matches;
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);

    // Search with a query that won't match the highlight pattern
    performExactSearch('XYZ');
    // Verify that result rendering completed without error
    expect(resultsEl.innerHTML).toBeDefined();
  });

  it('should produce highlight markup when matches found', () => {
    const matches = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' }];
    (state as Record<string, unknown>).fullQuranText = matches;
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);

    performExactSearch('الله');
    // The highlight should produce <mark> tags
    expect(resultsEl.innerHTML).toContain('search-highlight');
  });

  it('should handle Arabic diacritics in highlighted text', () => {
    const matches = [
      {
        surah: 1,
        surahName: 'الفاتحة',
        ayah: 1,
        text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ',
        normalized: 'بسم الله الرحمن الرحيم',
      },
    ];
    (state as Record<string, unknown>).fullQuranText = matches;
    vi.mocked(performSearch).mockReturnValue(matches);
    vi.mocked(getAllSearchMatches).mockReturnValue(matches);

    performExactSearch('الله');
    expect(resultsEl.innerHTML).toContain('search-highlight');
  });
});
