/**
 * Tests for search-ui.ts — Search UI controller: exact search, autocomplete,
 * voice search, Arabic keyboard, highlight rendering, and result interactions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock state module
vi.mock('../state.js', () => ({
  state: {
    fullQuranLoaded: false,
    fullQuranText: [] as Array<{ surah: number; surahName: string; ayah: number; text: string; normalized: string }>,
    currentSurah: 0,
    surahData: null as unknown,
    currentAyahIndex: 0,
    searchWords: [] as Array<{ word: string; count: number }>,
    searchPrefixMap: new Map<string, Array<{ word: string; count: number }>>(),
    surahList: [] as Array<{ number: number; name: string }>,
  },
}));

// Mock dom module
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

// Mock storage module
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock ui module
vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

// Mock utils module
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

// Mock templates module
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

// Mock app module
vi.mock('../app.js', () => ({
  loadSurah: vi.fn(),
  highlightCurrentAyah: vi.fn(),
}));

// Mock audio module
vi.mock('../audio.js', () => ({
  playCurrentAyah: vi.fn(),
}));

// Mock search-core module
vi.mock('../search-core.js', () => ({
  SEARCH_PAGE_SIZE: 10,
  performSearch: vi.fn(() => []),
  addToSearchHistory: vi.fn(),
  loadFullQuranText: vi.fn(),
  getSearchHistory: vi.fn(() => []),
  clearSearchHistory: vi.fn(),
}));

// Mock config module
vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
  },
}));

// Mock i18n module
vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) => {
    let val = key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, arg);
    });
    return val;
  },
}));

// Mock internal-state module
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

import { performExactSearch, initSearchAutocomplete, startVoiceSearch, initKeyboard } from '../search-ui.js';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { showToast } from '../ui.js';
import { performSearch, addToSearchHistory, getSearchHistory } from '../search-core.js';
import { setAllSearchMatches, setSearchResultsPage, getVoiceListening, setVoiceListening } from '../internal-state.js';

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

  it('should allow single-character Arabic query', () => {
    performExactSearch('ر');
    expect(showToast).not.toHaveBeenCalledWith('min_chars', 'error');
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
});

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
});

describe('startVoiceSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no SpeechRecognition by default
    delete (window as Record<string, unknown>).SpeechRecognition;
    delete (window as Record<string, unknown>).webkitSpeechRecognition;
  });

  afterEach(() => {
    delete (window as Record<string, unknown>).SpeechRecognition;
    delete (window as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('should show error toast when SpeechRecognition is not available', () => {
    vi.mocked(getVoiceListening).mockReturnValue(false);
    startVoiceSearch();
    expect(showToast).toHaveBeenCalledWith('voice_search_unsupported', 'error');
  });

  it('should not start recognition if already listening (SpeechRecognition available)', () => {
    // Need SpeechRecognition available first for the listening check to be reached
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

    // Should not start recognition because already listening
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
    // Note: lang is set on the new instance, not accessible from here
    // but we can verify the constructor was called
  });
});

describe('initKeyboard', () => {
  let toggleBtn: HTMLElement;
  let keyBtn: HTMLElement;

  beforeEach(() => {
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

  it('should not throw when searchInput is null and a key is clicked', () => {
    (dom as Record<string, unknown>).searchInput = null;
    initKeyboard();
    expect(() => keyBtn.click()).not.toThrow();
  });
});
