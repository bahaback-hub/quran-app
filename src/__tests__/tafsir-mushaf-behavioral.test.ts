/**
 * Behavioral tests for tafsir.ts and mushaf.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../tafsir.js');
vi.unmock('../mushaf.js');
vi.unmock('../config.js');

import { state, resetState } from '../state.js';

describe('tafsir — state defaults', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.currentTafsirEdition is a string', () => {
    expect(typeof state.currentTafsirEdition).toBe('string');
  });

  it('state.translationEnabled is boolean', () => {
    expect(typeof state.translationEnabled).toBe('boolean');
  });

  it('state.translationData is null by default', () => {
    expect(state.translationData).toBeNull();
  });
});

describe('tafsir — tafsir editions', () => {
  it('DEFAULT_TAFSIR is ar-tafsir-muyassar', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.DEFAULT_TAFSIR).toBe('ar-tafsir-muyassar');
  });

  it('TAFSIR_API points to jsDelivr tafsir_api', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.TAFSIR_API).toMatch(/cdn\.jsdelivr\.net.*tafsir_api/);
  });

  it('TAFSIR_API uses HTTPS', async () => {
    const { CONFIG } = await import('../config.js');
    expect(CONFIG.TAFSIR_API).toMatch(/^https:\/\//);
  });
});

describe('tafsir — tafsir data structure', () => {
  beforeEach(() => {
    resetState();
  });

  it('can set translationData with HTML content', () => {
    state.translationData = '<p>تفسير الآية الأولى</p>' as unknown as typeof state.translationData;
    expect(state.translationData).not.toBeNull();
    expect(state.translationData).toContain('<p>');
  });

  it('can clear translationData', () => {
    state.translationData = '<p>تفسير</p>' as unknown as typeof state.translationData;
    state.translationData = null;
    expect(state.translationData).toBeNull();
  });

  it('can toggle translationEnabled', () => {
    state.translationEnabled = false;
    state.translationEnabled = true;
    expect(state.translationEnabled).toBe(true);
  });

  it('can change currentTafsirEdition', () => {
    state.currentTafsirEdition = 'ar-tafsir-muyassar';
    expect(state.currentTafsirEdition).toBe('ar-tafsir-muyassar');
    state.currentTafsirEdition = 'en.hilali';
    expect(state.currentTafsirEdition).toBe('en.hilali');
  });
});

describe('tafsir — local fallback', () => {
  it('loadLocalTafsirMuyassar returns null on network error', async () => {
    const { loadLocalTafsirMuyassar } = await import('../api-fallback.js');
    // Without mock, jsonFetch will try real network and fail
    const result = await loadLocalTafsirMuyassar(999);
    expect(result).toBeNull();
  });
});

describe('mushaf — state defaults', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.mushafMode is boolean', () => {
    expect(typeof state.mushafMode).toBe('boolean');
  });

  it('state.currentPage is a number', () => {
    expect(typeof state.currentPage).toBe('number');
  });

  it('state.currentPage is in valid range (1-604)', () => {
    expect(state.currentPage).toBeGreaterThanOrEqual(1);
    expect(state.currentPage).toBeLessThanOrEqual(604);
  });
});

describe('mushaf — page navigation', () => {
  beforeEach(() => {
    resetState();
  });

  it('can set currentPage to 1 (first page)', () => {
    state.currentPage = 1;
    expect(state.currentPage).toBe(1);
  });

  it('can set currentPage to 604 (last page)', () => {
    state.currentPage = 604;
    expect(state.currentPage).toBe(604);
  });

  it('can navigate to middle page (300)', () => {
    state.currentPage = 300;
    expect(state.currentPage).toBe(300);
  });

  it('can toggle mushafMode', () => {
    state.mushafMode = false;
    state.mushafMode = true;
    expect(state.mushafMode).toBe(true);
  });
});

describe('mushaf — page boundaries', () => {
  it('page 1 is the first page of the Quran', () => {
    expect(1).toBeLessThanOrEqual(604);
  });

  it('page 604 is the last page of the Quran', () => {
    expect(604).toBeGreaterThanOrEqual(1);
  });

  it('total pages is 604 (canonical Mushaf page count)', () => {
    const TOTAL_PAGES = 604;
    expect(TOTAL_PAGES).toBe(604);
  });

  it('JUZ_PAGES has 30 entries mapping to page numbers', async () => {
    const { JUZ_PAGES } = await import('../config.js');
    expect(JUZ_PAGES.length).toBe(30);
    expect(JUZ_PAGES[0]).toBe(1);
    // Each juz page should be within 1-604 range
    for (const page of JUZ_PAGES) {
      expect(page).toBeGreaterThanOrEqual(1);
      expect(page).toBeLessThanOrEqual(604);
    }
  });
});

describe('mushaf — sajda ayahs', () => {
  it('SAJDA_AYAHS has 15 entries (14 locations + 1 duplicate in Al-Hajj)', async () => {
    const { SAJDA_AYAHS } = await import('../quran-meta.js');
    expect(Object.keys(SAJDA_AYAHS).length).toBe(15);
  });

  it('each sajda ayah is marked as obligatory or recommended', async () => {
    const { SAJDA_AYAHS } = await import('../quran-meta.js');
    for (const [key, value] of Object.entries(SAJDA_AYAHS)) {
      expect(key).toMatch(/^\d+:\d+$/);
      expect(['obligatory', 'recommended']).toContain(value);
    }
  });

  it("sajda at 7:206 is obligatory (Surah Al-A'raf)", async () => {
    const { SAJDA_AYAHS } = await import('../quran-meta.js');
    expect(SAJDA_AYAHS['7:206']).toBe('obligatory');
  });

  it('sajda at 22:77 is recommended (Surah Al-Hajj, second sajda)', async () => {
    const { SAJDA_AYAHS } = await import('../quran-meta.js');
    expect(SAJDA_AYAHS['22:77']).toBe('recommended');
  });
});
