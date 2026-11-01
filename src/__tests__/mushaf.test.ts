import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dom } from '../dom.js';

// Mock config with JUZ_PAGES
vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
    TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
    PRAYER_API: 'https://api.aladhan.com/v1/timingsByCity',
    AZAN_FILE: 'azan.mp3',
    SURAH_COUNT: 114,
    STORAGE_PREFIX: 'quran_app_',
    DEFAULT_RECITER: 'ar.alafasy',
    DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
    DEFAULT_METHOD: '4',
    DEFAULT_CITY: 'مكة المكرمة',
    DEFAULT_COUNTRY: 'SA',
    CACHE_LIMIT: 20,
  },
  JUZ_PAGES: [
    1, 22, 42, 62, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462,
    482, 502, 522, 542, 562, 582,
  ],
}));

// Mock i18n
vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) => {
    let val = key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, arg);
    });
    return val;
  },
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

vi.mock('../features/mushaf/mushaf-renderer.js', () => ({}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

import { getJuzForPage, updatePageIndicator, buildMushafTextBlocks } from '../features/mushaf/mushaf.js';

describe('getJuzForPage', () => {
  it('should return juz 1 for page 1', () => {
    expect(getJuzForPage(1)).toBe(1);
  });

  it('should return juz 1 for page 21', () => {
    expect(getJuzForPage(21)).toBe(1);
  });

  it('should return juz 2 for page 22', () => {
    expect(getJuzForPage(22)).toBe(2);
  });

  it('should return juz 30 for page 604', () => {
    expect(getJuzForPage(604)).toBe(30);
  });

  it('should return correct juz for middle pages', () => {
    expect(getJuzForPage(50)).toBe(3);
    expect(getJuzForPage(100)).toBe(5);
    expect(getJuzForPage(200)).toBe(10);
    expect(getJuzForPage(400)).toBe(20);
    expect(getJuzForPage(500)).toBe(25);
  });
});

describe('buildMushafTextBlocks', () => {
  it('returns an empty list when there is no layout', () => {
    expect(buildMushafTextBlocks(null)).toEqual([]);
    expect(buildMushafTextBlocks({ lines: [] })).toEqual([]);
  });

  it('joins the words of one verse and keeps verse order', () => {
    const blocks = buildMushafTextBlocks({
      lines: [
        {
          words: [
            { char: 'x', text: 'بِسْمِ', type: 'word', verse_key: '1:1' },
            { char: 'x', text: 'اللَّهِ', type: 'word', verse_key: '1:1' },
          ],
        },
        {
          words: [
            { char: 'x', text: 'الرَّحْمَنِ', type: 'word', verse_key: '1:1' },
            { char: 'x', text: 'الرَّحِيمِ', type: 'word', verse_key: '1:1' },
            { char: 'x', text: 'الْحَمْدُ', type: 'word', verse_key: '1:2' },
          ],
        },
      ],
    });

    expect(blocks).toEqual([
      { verseKey: '1:1', text: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ' },
      { verseKey: '1:2', text: 'الْحَمْدُ' },
    ]);
  });

  it('skips surah headers and verse-end glyph placeholders', () => {
    const blocks = buildMushafTextBlocks({
      lines: [
        {
          words: [
            { char: 'x', text: 'سُورَةُ البَقَرَةِ', type: 'surah_header' },
            { char: 'x', text: 'الم', type: 'word', verse_key: '2:1' },
            { char: 'x', text: 'V1', type: 'end', verse_key: '2:1' },
            { char: 'x', text: 'ذَلِكَ', type: 'word', verse_key: '2:2' },
          ],
        },
      ],
    });

    expect(blocks).toEqual([
      { verseKey: '2:1', text: 'الم' },
      { verseKey: '2:2', text: 'ذَلِكَ' },
    ]);
  });

  it('keeps an opening basmala as its own block without a verse key', () => {
    const blocks = buildMushafTextBlocks({
      lines: [
        {
          words: [
            { char: 'x', text: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ', type: 'bismillah' },
            { char: 'x', text: 'الم', type: 'word', verse_key: '2:1' },
          ],
        },
      ],
    });

    expect(blocks).toEqual([
      { verseKey: null, text: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ' },
      { verseKey: '2:1', text: 'الم' },
    ]);
  });

  it('trims word text and ignores glyphs that carry no readable text', () => {
    const blocks = buildMushafTextBlocks({
      lines: [
        {
          words: [
            { char: 'x', text: '  الم  ', type: 'word', verse_key: '2:1' },
            { char: 'x', text: '', type: 'word', verse_key: '2:1' },
            { char: 'x', text: undefined, type: 'word', verse_key: '2:1' },
            { char: 'x', text: 'ذَلِكَ', type: 'word', verse_key: '2:2' },
          ],
        },
      ],
    });

    expect(blocks).toEqual([
      { verseKey: '2:1', text: 'الم' },
      { verseKey: '2:2', text: 'ذَلِكَ' },
    ]);
  });
});

describe('updatePageIndicator', () => {
  beforeEach(() => {
    dom.pageIndicator = document.createElement('div');
  });

  it('should set page indicator text', () => {
    updatePageIndicator(1);
    expect(dom.pageIndicator!.textContent).toBeTruthy();
  });

  it('should update to another page', () => {
    updatePageIndicator(50);
    expect(dom.pageIndicator!.textContent).toBeTruthy();
    expect(dom.pageIndicator!.textContent).not.toBe('');
  });

  it('should do nothing if pageIndicator is falsy', () => {
    dom.pageIndicator = null;
    expect(() => updatePageIndicator(1)).not.toThrow();
  });
});
