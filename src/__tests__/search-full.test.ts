/**
 * Comprehensive tests for search.ts — the barrel module that re-exports
 * from search-core.js and search-ui.js.
 *
 * Covers:
 * - All re-exports are properly wired
 * - performExactSearch integration (delegates to search-ui)
 * - loadFullQuranText / getSearchHistory / clearSearchHistory (from search-core)
 * - startVoiceSearch / initKeyboard / initSearchAutocomplete (from search-ui)
 * - End-to-end search flow: query validation, search execution, result rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  normalizeRelaxed: (s: string) =>
    s
      .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED\u08D0-\u08E3]/g, '')
      .replace(/\u0670/g, 'ا')
      .replace(/[إأآٱٲٳٵ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ء/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
}));

vi.mock('../templates.js', () => ({
  searchEmptyResults: () => '<div class="search-empty">No results</div>',
  searchResultsHeader: (total: number) => `<div class="search-header">${total} results</div>`,
  searchResultCard: (data: { surah: number; ayah: number; surahName: string; fulltextIndex: number; highlighted: string }) =>
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
  loadFullQuranText,
  getSearchHistory,
  clearSearchHistory,
  performExactSearch,
  startVoiceSearch,
  initKeyboard,
  initSearchAutocomplete,
} from '../search.js';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { showToast } from '../ui.js';
import { storage } from '../storage.js';

// ═══════════════════════════════════════════════════════════════
// Barrel re-export verification
// ═══════════════════════════════════════════════════════════════

describe('search.ts barrel exports', () => {
  it('should export loadFullQuranText as a function', () => {
    expect(typeof loadFullQuranText).toBe('function');
  });

  it('should export getSearchHistory as a function', () => {
    expect(typeof getSearchHistory).toBe('function');
  });

  it('should export clearSearchHistory as a function', () => {
    expect(typeof clearSearchHistory).toBe('function');
  });

  it('should export performExactSearch as a function', () => {
    expect(typeof performExactSearch).toBe('function');
  });

  it('should export startVoiceSearch as a function', () => {
    expect(typeof startVoiceSearch).toBe('function');
  });

  it('should export initKeyboard as a function', () => {
    expect(typeof initKeyboard).toBe('function');
  });

  it('should export initSearchAutocomplete as a function', () => {
    expect(typeof initSearchAutocomplete).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════
// getSearchHistory (from search-core through barrel)
// ═══════════════════════════════════════════════════════════════

describe('getSearchHistory via barrel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when storage returns null', () => {
    vi.mocked(storage.get).mockReturnValue(null);
    expect(getSearchHistory()).toEqual([]);
  });

  it('should return stored history', () => {
    vi.mocked(storage.get).mockReturnValue(['الله', 'الرحمن']);
    expect(getSearchHistory()).toEqual(['الله', 'الرحمن']);
  });
});

// ═══════════════════════════════════════════════════════════════
// clearSearchHistory (from search-core through barrel)
// ═══════════════════════════════════════════════════════════════

describe('clearSearchHistory via barrel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove search_history from storage', () => {
    clearSearchHistory();
    expect(storage.remove).toHaveBeenCalledWith('search_history');
  });

  it('should show toast', () => {
    clearSearchHistory();
    expect(showToast).toHaveBeenCalledWith('search_history_cleared', '');
  });
});

// ═══════════════════════════════════════════════════════════════
// performExactSearch via barrel (end-to-end integration)
// ═══════════════════════════════════════════════════════════════

describe('performExactSearch via barrel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (state as Record<string, unknown>).fullQuranLoaded = true;
    (state as Record<string, unknown>).fullQuranText = [
      { surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', normalized: 'بسم الله الرحمن الرحيم' },
      { surah: 1, surahName: 'الفاتحة', ayah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', normalized: 'الحمد لله رب العلمين' },
    ];
  });

  it('should reject empty query', () => {
    performExactSearch('');
    expect(showToast).toHaveBeenCalledWith('min_chars', 'error');
  });

  it('should reject short non-Arabic query', () => {
    performExactSearch('a');
    expect(showToast).toHaveBeenCalledWith('min_chars', 'error');
  });

  it('should reject when Quran not loaded', () => {
    (state as Record<string, unknown>).fullQuranLoaded = false;
    performExactSearch('الله');
    expect(showToast).toHaveBeenCalledWith('quran_db_loading', 'error');
  });

  it('should accept Arabic single char query', () => {
    const el = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = el;
    performExactSearch('ر');
    expect(showToast).not.toHaveBeenCalledWith('min_chars', 'error');
    el.remove();
    (dom as Record<string, unknown>).searchResults = null;
  });

  it('should accept valid Arabic query and render results', () => {
    const el = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = el;
    performExactSearch('الله');
    expect(el.style.display).toBe('block');
    el.remove();
    (dom as Record<string, unknown>).searchResults = null;
  });

  it('should handle no results gracefully', () => {
    const el = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = el;
    performExactSearch('xyznomatch');
    expect(el.innerHTML).toContain('search-empty');
    el.remove();
    (dom as Record<string, unknown>).searchResults = null;
  });

  it('should not crash when searchResults DOM element is null', () => {
    (dom as Record<string, unknown>).searchResults = null;
    expect(() => performExactSearch('الله')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// initSearchAutocomplete via barrel
// ═══════════════════════════════════════════════════════════════

describe('initSearchAutocomplete via barrel', () => {
  it('should not throw when DOM elements are missing', () => {
    (dom as Record<string, unknown>).searchInput = null;
    expect(() => initSearchAutocomplete()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// startVoiceSearch via barrel
// ═══════════════════════════════════════════════════════════════

describe('startVoiceSearch via barrel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as Record<string, unknown>).SpeechRecognition;
    delete (window as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('should show error when SpeechRecognition is unavailable', () => {
    startVoiceSearch();
    expect(showToast).toHaveBeenCalledWith('voice_search_unsupported', 'error');
  });
});

// ═══════════════════════════════════════════════════════════════
// initKeyboard via barrel
// ═══════════════════════════════════════════════════════════════

describe('initKeyboard via barrel', () => {
  it('should not throw when keyboard DOM elements are missing', () => {
    expect(() => initKeyboard()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// loadFullQuranText via barrel
// ═══════════════════════════════════════════════════════════════

describe('loadFullQuranText via barrel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (state as Record<string, unknown>).fullQuranLoaded = false;
    (state as Record<string, unknown>).fullQuranText = null;
  });

  it('should be no-op when fullQuranLoaded is already true', async () => {
    (state as Record<string, unknown>).fullQuranLoaded = true;
    await loadFullQuranText();
    // Should not modify state
    expect(state.fullQuranLoaded).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Edge case: search with special characters
// ═══════════════════════════════════════════════════════════════

describe('edge cases through barrel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (state as Record<string, unknown>).fullQuranLoaded = true;
    (state as Record<string, unknown>).fullQuranText = [
      { surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', normalized: 'بسم الله' },
    ];
  });

  it('should handle query with only whitespace', () => {
    performExactSearch('   ');
    expect(showToast).toHaveBeenCalledWith('min_chars', 'error');
  });

  it('should handle very long query', () => {
    const el = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = el;
    const longQuery = 'الله'.repeat(100);
    expect(() => performExactSearch(longQuery)).not.toThrow();
    el.remove();
    (dom as Record<string, unknown>).searchResults = null;
  });

  it('should handle mixed Arabic and non-Arabic query', () => {
    const el = document.createElement('div');
    (dom as Record<string, unknown>).searchResults = el;
    // This has Arabic chars so it passes the min-length check
    performExactSearch('الله test');
    expect(el.style.display).toBe('block');
    el.remove();
    (dom as Record<string, unknown>).searchResults = null;
  });
});
