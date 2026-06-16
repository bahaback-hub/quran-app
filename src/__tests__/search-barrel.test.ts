/**
 * Tests for search.ts — barrel re-export file.
 * Verifies that all re-exported functions exist and are callable.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock dependencies that search-core.ts needs
vi.mock('../state.js', () => ({
  state: {
    fullQuranLoaded: false,
    fullQuranText: null as unknown,
    searchWords: [] as Array<{ word: string; count: number }>,
    searchPrefixMap: null as unknown,
  },
}));

vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
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
  normalizeExactText: (s: string) => s.replace(/[\u064B-\u065F\u0670]/g, '').trim(),
  normalizeRelaxed: (s: string) => s.replace(/[\u064B-\u065F\u0670]/g, '').trim(),
  escapeRegExp: (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
}));

vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
}));

vi.mock('../internal-state.js', () => ({
  setAllSearchMatches: vi.fn(),
  getAllSearchMatches: vi.fn(() => []),
  setSearchResultsPage: vi.fn(),
  getSearchResultsPage: vi.fn(() => 1),
  getVoiceListening: vi.fn(() => false),
  setVoiceListening: vi.fn(),
  getVoiceRecognition: vi.fn(() => null),
  setVoiceRecognition: vi.fn(),
}));

vi.mock('../dom.js', () => ({
  dom: {},
}));

vi.mock('../templates.js', () => ({
  searchEmptyResults: vi.fn(() => ''),
  searchResultsHeader: vi.fn(() => ''),
  searchResultCard: vi.fn(() => ''),
  searchLoadMoreButton: vi.fn(() => ''),
  searchHistoryItem: vi.fn(() => ''),
  searchAutocompleteItem: vi.fn(() => ''),
  escapeHtml: vi.fn((s: string) => s),
}));

import * as searchModule from '../search.js';

describe('search.ts barrel re-exports', () => {
  it('should export loadFullQuranText from search-core', () => {
    expect(typeof searchModule.loadFullQuranText).toBe('function');
  });

  it('should export getSearchHistory from search-core', () => {
    expect(typeof searchModule.getSearchHistory).toBe('function');
  });

  it('should export clearSearchHistory from search-core', () => {
    expect(typeof searchModule.clearSearchHistory).toBe('function');
  });

  it('should export performExactSearch from search-ui', () => {
    expect(typeof searchModule.performExactSearch).toBe('function');
  });

  it('should export startVoiceSearch from search-ui', () => {
    expect(typeof searchModule.startVoiceSearch).toBe('function');
  });

  it('should export initKeyboard from search-ui', () => {
    expect(typeof searchModule.initKeyboard).toBe('function');
  });

  it('should export initSearchAutocomplete from search-ui', () => {
    expect(typeof searchModule.initSearchAutocomplete).toBe('function');
  });

  it('should have exactly 7 exports', () => {
    const exports = Object.keys(searchModule);
    expect(exports.length).toBe(7);
    expect(exports).toContain('loadFullQuranText');
    expect(exports).toContain('getSearchHistory');
    expect(exports).toContain('clearSearchHistory');
    expect(exports).toContain('performExactSearch');
    expect(exports).toContain('startVoiceSearch');
    expect(exports).toContain('initKeyboard');
    expect(exports).toContain('initSearchAutocomplete');
  });

  it('should allow calling getSearchHistory without errors', () => {
    expect(() => searchModule.getSearchHistory()).not.toThrow();
  });

  it('should allow calling clearSearchHistory without errors', () => {
    expect(() => searchModule.clearSearchHistory()).not.toThrow();
  });
});
