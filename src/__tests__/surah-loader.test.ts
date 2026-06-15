import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { storage } from '../storage.js';

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  globalThis.localStorage = {
    getItem: (key: string) => (store[key] === undefined ? null : store[key]),
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  } as Storage;
});

// Mock external dependencies
vi.mock('../audio.js', () => ({
  togglePlayPause: vi.fn(),
  nextAyah: vi.fn(),
  prevAyah: vi.fn(),
  nextSurah: vi.fn(),
  prevSurah: vi.fn(),
  toggleHifdh: vi.fn(),
  toggleRepeat: vi.fn(),
  expandPlayer: vi.fn(),
  prepareAudioForNewSurah: vi.fn(),
  playCurrentAyah: vi.fn(),
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
  loadingBar: { show: vi.fn(), hide: vi.fn() },
}));

vi.mock('../i18n.js', () => ({
  __: vi.fn((key: string) => key),
}));

vi.mock('../tajweed.js', () => ({
  tajweedColorWord: vi.fn((word: string) => word),
  buildColorMap: vi.fn(() => null),
}));

vi.mock('../tajweed-data.js', () => ({
  getAyahAnnotations: vi.fn(() => []),
}));

vi.mock('../surahs-data.js', () => ({
  SURAH_SECRETS: {},
}));

vi.mock('../reading-stats.js', () => ({
  recordReadingSession: vi.fn(),
}));

vi.mock('../tafsir.js', () => ({
  loadTafsirForCurrentAyah: vi.fn(),
}));

vi.mock('../reciters.js', () => ({
  RECITERS: [
    { id: 'ar.alafasy', name: 'reciter_alafasy', source: 'api' },
    { id: 'ar.husary', name: 'reciter_husary', source: 'mp3quran' },
  ],
  getReciterById: vi.fn((id: string) => {
    const map: Record<string, { id: string; name: string; source: string }> = {
      'ar.alafasy': { id: 'ar.alafasy', name: 'reciter_alafasy', source: 'api' },
      'ar.husary': { id: 'ar.husary', name: 'reciter_husary', source: 'mp3quran' },
    };
    return map[id] || { id, name: id, source: 'api' };
  }),
  getReciterDisplayName: vi.fn((r: { name: string }) =>
    r.name.startsWith('reciter_') ? r.name.replace('reciter_', '') : r.name,
  ),
  buildAudioUrl: vi.fn(() => 'https://example.com/audio.mp3'),
  getTimingApiId: vi.fn(() => null),
}));

vi.mock('../presentation.js', () => ({
  openPresentation: vi.fn(),
  closePresentation: vi.fn(),
  syncPresentation: vi.fn(),
}));

vi.mock('../mushaf.js', () => ({
  toggleMushafMode: vi.fn(),
  highlightMushafAyah: vi.fn(),
}));

vi.mock('../api-client.js', () => ({
  apiFetch: vi.fn(),
  jsonFetch: vi.fn(),
}));

vi.mock('../templates.js', () => ({
  surahSelectDefault: vi.fn(() => '<option>select_surah</option>'),
  surahSelectLoading: vi.fn(() => '<option>loading...</option>'),
  surahSelectError: vi.fn(() => '<option>error</option>'),
  reciterOptions: vi.fn((reciters: Array<{ id: string; name: string }>, selectedId: string) =>
    reciters.map((r) => `<option value="${r.id}"${r.id === selectedId ? ' selected' : ''}>${r.name}</option>`).join(''),
  ),
  escapeHtml: vi.fn((s: string) => s),
}));

import { loadSurahList, buildSurahOffsets, populateReciterSelect } from '../surah-loader.js';
import { apiFetch, jsonFetch } from '../api-client.js';

// Sample surah list data for testing
const SAMPLE_SURAH_LIST = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqara', numberOfAyahs: 286 },
  { number: 3, name: 'آل عمران', englishName: 'Aal-Imran', numberOfAyahs: 200 },
];

const FULL_SURAH_LIST = Array.from({ length: 114 }, (_, i) => ({
  number: i + 1,
  name: `سورة ${i + 1}`,
  englishName: `Surah ${i + 1}`,
  numberOfAyahs: 6,
}));

describe('loadSurahList', () => {
  beforeEach(() => {
    state.surahList = [];
    state.surahOffsets = null;
    state.currentSurah = 1;
    dom.surahSelect = document.createElement('select') as HTMLSelectElement;
  });

  it('should load surah list from storage cache if valid', async () => {
    vi.spyOn(storage, 'get').mockReturnValue(FULL_SURAH_LIST);

    await loadSurahList();

    expect(state.surahList).toEqual(FULL_SURAH_LIST);
    expect(state.surahOffsets).not.toBeNull();
  });

  it('should populate surah select when loaded from cache', async () => {
    vi.spyOn(storage, 'get').mockReturnValue(FULL_SURAH_LIST);

    await loadSurahList();

    // Should have default option + 114 surah options
    const options = dom.surahSelect!.querySelectorAll('option');
    expect(options.length).toBe(115); // 1 default + 114 surahs
  });

  it('should fetch from API when no cache exists', async () => {
    vi.spyOn(storage, 'get').mockReturnValue(null);
    vi.spyOn(storage, 'set').mockImplementation(() => true);

    vi.mocked(apiFetch).mockResolvedValue({ data: FULL_SURAH_LIST });

    await loadSurahList();

    expect(apiFetch).toHaveBeenCalled();
    expect(state.surahList).toEqual(FULL_SURAH_LIST);
  });

  it('should fall back to local JSON when API fails', async () => {
    vi.spyOn(storage, 'get').mockReturnValue(null);
    vi.spyOn(storage, 'set').mockImplementation(() => true);

    vi.mocked(apiFetch).mockRejectedValue(new Error('API down'));
    vi.mocked(jsonFetch).mockResolvedValue(FULL_SURAH_LIST);

    await loadSurahList();

    expect(apiFetch).toHaveBeenCalled();
    expect(jsonFetch).toHaveBeenCalled();
    expect(state.surahList).toEqual(FULL_SURAH_LIST);
  });

  it('should handle gracefully when both API and local fallback fail', async () => {
    vi.spyOn(storage, 'get').mockReturnValue(null);

    vi.mocked(apiFetch).mockRejectedValue(new Error('No network'));
    vi.mocked(jsonFetch).mockRejectedValue(new Error('No local file'));

    await loadSurahList();

    expect(state.surahList).toEqual([]);
  });

  it('should ignore cache if list length does not match SURAH_COUNT', async () => {
    // Short cache that doesn't match 114 surahs
    vi.spyOn(storage, 'get').mockReturnValue(SAMPLE_SURAH_LIST);
    vi.spyOn(storage, 'set').mockImplementation(() => true);

    vi.mocked(apiFetch).mockResolvedValue({ data: FULL_SURAH_LIST });

    await loadSurahList();

    // Should have fallen through to API
    expect(apiFetch).toHaveBeenCalled();
    expect(state.surahList).toEqual(FULL_SURAH_LIST);
  });
});

describe('buildSurahOffsets', () => {
  beforeEach(() => {
    state.surahList = [];
    state.surahOffsets = null;
  });

  it('should build offsets from surah list', () => {
    state.surahList = SAMPLE_SURAH_LIST;
    buildSurahOffsets();

    expect(state.surahOffsets).toEqual([
      { surahNum: 1, startAbs: 1, count: 7, name: 'الفاتحة' },
      { surahNum: 2, startAbs: 8, count: 286, name: 'البقرة' },
      { surahNum: 3, startAbs: 294, count: 200, name: 'آل عمران' },
    ]);
  });

  it('should not overwrite existing offsets', () => {
    const existing = [{ surahNum: 1, startAbs: 1, count: 7, name: 'test' }];
    state.surahOffsets = existing;
    state.surahList = SAMPLE_SURAH_LIST;

    buildSurahOffsets();

    expect(state.surahOffsets).toEqual(existing);
  });

  it('should not build offsets when surahList is empty', () => {
    state.surahList = [];
    buildSurahOffsets();

    expect(state.surahOffsets).toBeNull();
  });

  it('should calculate cumulative absolute ayah numbers correctly', () => {
    state.surahList = [
      { number: 1, name: 'A', englishName: 'A', numberOfAyahs: 3 },
      { number: 2, name: 'B', englishName: 'B', numberOfAyahs: 5 },
      { number: 3, name: 'C', englishName: 'C', numberOfAyahs: 2 },
    ];
    buildSurahOffsets();

    expect(state.surahOffsets![0].startAbs).toBe(1); // Surah 1 starts at ayah 1
    expect(state.surahOffsets![1].startAbs).toBe(4); // Surah 2 starts at ayah 4 (1+3)
    expect(state.surahOffsets![2].startAbs).toBe(9); // Surah 3 starts at ayah 9 (4+5)
  });
});

describe('populateReciterSelect', () => {
  beforeEach(() => {
    dom.reciterSelect = document.createElement('select') as HTMLSelectElement;
    state.currentReciter = 'ar.alafasy';
  });

  it('should populate reciter select with RECITERS', () => {
    populateReciterSelect();

    const options = dom.reciterSelect!.querySelectorAll('option');
    expect(options.length).toBe(2);
    expect(options[0].value).toBe('ar.alafasy');
    expect(options[1].value).toBe('ar.husary');
  });

  it('should set the selected reciter value', () => {
    state.currentReciter = 'ar.husary';
    populateReciterSelect();

    expect(dom.reciterSelect!.value).toBe('ar.husary');
  });

  it('should use default reciter when state has none', () => {
    state.currentReciter = '';
    populateReciterSelect();

    expect(dom.reciterSelect!.value).toBe('ar.alafasy');
  });

  it('should handle missing reciterSelect gracefully', () => {
    dom.reciterSelect = null;
    expect(() => populateReciterSelect()).not.toThrow();
  });
});
