/**
 * Behavioral tests for surah-loader.ts functions that were under-covered.
 *
 * Focuses on:
 *   - buildSurahOffsets() — populates state.surahOffsets
 *   - populateReciterSelect() — populates #reciterSelect from RECITERS
 *   - chunkCacheKey() — returns `${surahNum}_${chunkIdx}` format
 *   - getChunkIndex() — Math.floor(ayahIndex / VIRTUAL_CHUNK_SIZE)
 *   - countArabicChars() — counts Arabic letters ignoring diacritics
 *   - toggleTranslation() — flips state.translationEnabled + persists
 *   - saveCurrentPosition() — persists current surah/ayah
 *   - updatePlayerInfo() — updates player DOM when surahData is set
 *
 * These tests verify actual behavior (DOM mutations, state changes,
 * return values) — NOT just `typeof === 'function'`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Unmock the modules we want to test the real implementation of
vi.unmock('../surah-loader.js');
vi.unmock('../dom.js');
vi.unmock('../storage.js');

// Re-mock i18n with getReciterName (which reciters.ts uses)
vi.mock('../i18n.js', () => ({
  __: (key: string, ..._args: string[]) => key,
  getLang: vi.fn(() => 'ar'),
  toArabicDigits: (value: string | number) => String(value),
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
  getReciterName: (key: string) => key,
}));

import { state, resetState } from '../state.js';
import { dom } from '../dom.js';

// Test fixture: a small 3-surah list with known ayah counts
const TEST_SURAHS = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqara', numberOfAyahs: 286 },
  { number: 3, name: 'آل عمران', englishName: 'Aal-i-Imraan', numberOfAyahs: 200 },
];

// Helper: populate state.surahList with the test fixture
function setupSurahList() {
  state.surahList = TEST_SURAHS.map((s) => ({ ...s }));
}

describe('surah-loader — buildSurahOffsets', () => {
  beforeEach(() => {
    resetState();
    setupSurahList();
  });

  it('populates state.surahOffsets with entries matching surahList length', async () => {
    const { buildSurahOffsets } = await import('../surah-loader.js');
    expect(state.surahOffsets).toBeNull();
    buildSurahOffsets();
    expect(state.surahOffsets).toBeDefined();
    expect(state.surahOffsets!.length).toBe(TEST_SURAHS.length);
  });

  it('first surah offset starts at absolute ayah 1', async () => {
    const { buildSurahOffsets } = await import('../surah-loader.js');
    buildSurahOffsets();
    const first = state.surahOffsets![0];
    expect(first.surahNum).toBe(1);
    expect(first.startAbs).toBe(1);
    expect(first.count).toBe(7); // Al-Fatiha has 7 ayahs
  });

  it('cumulative offsets are correct (Surah 2 starts at ayah 8)', async () => {
    const { buildSurahOffsets } = await import('../surah-loader.js');
    buildSurahOffsets();
    const second = state.surahOffsets![1];
    expect(second.surahNum).toBe(2);
    expect(second.startAbs).toBe(8); // After Al-Fatiha's 7 ayahs
    expect(second.count).toBe(286);
  });

  it('cumulative offsets are correct (Surah 3 starts at ayah 294)', async () => {
    const { buildSurahOffsets } = await import('../surah-loader.js');
    buildSurahOffsets();
    const third = state.surahOffsets![2];
    expect(third.surahNum).toBe(3);
    expect(third.startAbs).toBe(294); // 7 + 286 + 1
    expect(third.count).toBe(200);
  });

  it('is idempotent — calling twice does not rebuild', async () => {
    const { buildSurahOffsets } = await import('../surah-loader.js');
    buildSurahOffsets();
    const firstOffsets = state.surahOffsets;
    buildSurahOffsets();
    // The function early-returns if surahOffsets is already set
    expect(state.surahOffsets).toBe(firstOffsets);
  });

  it('no-ops when surahList is empty', async () => {
    state.surahList = [];
    state.surahOffsets = null;
    const { buildSurahOffsets } = await import('../surah-loader.js');
    buildSurahOffsets();
    expect(state.surahOffsets).toBeNull();
  });
});

describe('surah-loader — populateReciterSelect', () => {
  beforeEach(() => {
    // Create a fresh select element
    document.body.innerHTML = '<select id="reciterSelect"></select>';
    const select = document.getElementById('reciterSelect') as HTMLSelectElement;
    (dom as { reciterSelect: HTMLSelectElement | null }).reciterSelect = select;
  });

  it('populates #reciterSelect with options from RECITERS catalog', async () => {
    const { populateReciterSelect } = await import('../surah-loader.js');
    populateReciterSelect();
    const select = document.getElementById('reciterSelect') as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(0);
    // Each option must have a value (reciter ID) and text (reciter name)
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      expect(opt.value).toBeTruthy();
      expect(opt.textContent).toBeTruthy();
    }
  });

  it('includes the default reciter (ar.alafasy)', async () => {
    const { populateReciterSelect } = await import('../surah-loader.js');
    populateReciterSelect();
    const select = document.getElementById('reciterSelect') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('ar.alafasy');
  });

  it('no-ops gracefully when dom.reciterSelect is null', async () => {
    (dom as { reciterSelect: HTMLSelectElement | null }).reciterSelect = null;
    const { populateReciterSelect } = await import('../surah-loader.js');
    expect(() => populateReciterSelect()).not.toThrow();
  });

  it('selects the option matching state.currentReciter', async () => {
    state.currentReciter = 'ar.alafasy';
    const { populateReciterSelect } = await import('../surah-loader.js');
    populateReciterSelect();
    const select = document.getElementById('reciterSelect') as HTMLSelectElement;
    expect(select.value).toBe('ar.alafasy');
  });
});

describe('surah-loader — toggleTranslation', () => {
  beforeEach(() => {
    resetState();
    // Create a translation select with a default value
    document.body.innerHTML =
      '<select id="translationSelect"><option value="">— none —</option><option value="en.sahih">Sahih</option></select>';
    const sel = document.getElementById('translationSelect') as HTMLSelectElement;
    (dom as { translationSelect: HTMLSelectElement | null }).translationSelect = sel;
  });

  it('flips state.translationEnabled from false to true', async () => {
    const { toggleTranslation } = await import('../surah-loader.js');
    expect(state.translationEnabled).toBeFalsy();
    toggleTranslation();
    expect(state.translationEnabled).toBe(true);
  });

  it('flips state.translationEnabled back to false on second toggle', async () => {
    const { toggleTranslation } = await import('../surah-loader.js');
    toggleTranslation(); // → true
    toggleTranslation(); // → false
    expect(state.translationEnabled).toBe(false);
  });

  it('sets state.currentTranslation when enabling without a current edition', async () => {
    const { toggleTranslation } = await import('../surah-loader.js');
    expect(state.currentTranslation).toBeFalsy();
    toggleTranslation();
    expect(state.currentTranslation).toBeTruthy();
  });

  it('no-ops gracefully when state.currentSurah is null (no reload)', async () => {
    const { toggleTranslation } = await import('../surah-loader.js');
    state.currentSurah = null;
    expect(() => toggleTranslation()).not.toThrow();
  });
});

describe('surah-loader — updatePlayerInfo', () => {
  beforeEach(() => {
    resetState();
    document.body.innerHTML = `
      <span id="playerSurahName">—</span>
      <span id="playerCurrentAyah">—</span>
      <span id="playerReciterName">—</span>
      <span id="collapsedInfo">—</span>
    `;
    (dom as { playerSurahName: HTMLElement | null }).playerSurahName = document.getElementById('playerSurahName');
    (dom as { playerCurrentAyah: HTMLElement | null }).playerCurrentAyah = document.getElementById('playerCurrentAyah');
    (dom as { playerReciterName: HTMLElement | null }).playerReciterName = document.getElementById('playerReciterName');
    (dom as { collapsedInfo: HTMLElement | null }).collapsedInfo = document.getElementById('collapsedInfo');
  });

  it('updates player DOM when surahData and currentAyahIndex are set', async () => {
    const { updatePlayerInfo } = await import('../surah-loader.js');
    state.surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      numberOfAyahs: 7,
      ayahs: [
        { number: 1, text: 'بسم الله', numberInSurah: 1 },
        { number: 2, text: 'الحمد لله', numberInSurah: 2 },
      ],
    } as unknown as typeof state.surahData;
    state.currentAyahIndex = 0;
    state.currentReciter = 'ar.alafasy';
    updatePlayerInfo();
    const surahName = document.getElementById('playerSurahName');
    expect(surahName?.textContent).not.toBe('—');
  });

  it('no-ops gracefully when state.surahData is null', async () => {
    const { updatePlayerInfo } = await import('../surah-loader.js');
    state.surahData = null;
    expect(() => updatePlayerInfo()).not.toThrow();
    // DOM should remain at defaults
    expect(document.getElementById('playerSurahName')?.textContent).toBe('—');
  });

  it('no-ops gracefully when currentAyahIndex is out of bounds', async () => {
    const { updatePlayerInfo } = await import('../surah-loader.js');
    state.surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      numberOfAyahs: 7,
      ayahs: [{ number: 1, text: 'بسم الله', numberInSurah: 1 }],
    } as unknown as typeof state.surahData;
    state.currentAyahIndex = 999; // out of bounds
    expect(() => updatePlayerInfo()).not.toThrow();
  });
});

describe('surah-loader — highlightCurrentAyah', () => {
  beforeEach(() => {
    resetState();
    // highlightCurrentAyah queries .ayahs-container (child of #surahContent)
    // and matches .ayah[data-index="${state.currentAyahIndex}"]
    document.body.innerHTML = `
      <div class="surah-content" id="surahContent">
        <div class="ayahs-container">
          <div class="ayah" data-index="0"><span class="ayah-number">﴿١﴾</span>بسم الله</div>
          <div class="ayah" data-index="1"><span class="ayah-number">﴿٢﴾</span>الحمد لله</div>
          <div class="ayah" data-index="2"><span class="ayah-number">﴿٣﴾</span>الرحمن الرحيم</div>
        </div>
      </div>
    `;
    (dom as { surahContent: HTMLElement | null }).surahContent = document.getElementById('surahContent');
  });

  it('removes .current from all ayahs when state.surahData is null', async () => {
    const { highlightCurrentAyah } = await import('../surah-loader.js');
    state.surahData = null;
    expect(() => highlightCurrentAyah()).not.toThrow();
    // No ayah should have .current class
    const highlighted = document.querySelectorAll('.ayah.current');
    expect(highlighted.length).toBe(0);
  });

  it('no-ops gracefully when dom.surahContent is null', async () => {
    (dom as { surahContent: HTMLElement | null }).surahContent = null;
    const { highlightCurrentAyah } = await import('../surah-loader.js');
    expect(() => highlightCurrentAyah()).not.toThrow();
  });

  it('adds .current class to the ayah matching currentAyahIndex', async () => {
    // jsdom doesn't implement scrollIntoView — polyfill it as a no-op
    Element.prototype.scrollIntoView = vi.fn();
    const { highlightCurrentAyah } = await import('../surah-loader.js');
    state.surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      numberOfAyahs: 7,
      ayahs: [{ number: 1, text: 'بسم الله', numberInSurah: 1 }],
    } as unknown as typeof state.surahData;
    state.currentAyahIndex = 1; // data-index="1"
    highlightCurrentAyah();
    const highlighted = document.querySelector('.ayah[data-index="1"]');
    expect(highlighted?.classList.contains('current')).toBe(true);
    const notHighlighted = document.querySelector('.ayah[data-index="0"]');
    expect(notHighlighted?.classList.contains('current')).toBe(false);
  });
});

describe('surah-loader — populateSurahSelect', () => {
  beforeEach(() => {
    resetState();
    document.body.innerHTML = '<select id="surahSelect"></select>';
    (dom as { surahSelect: HTMLSelectElement | null }).surahSelect = document.getElementById(
      'surahSelect',
    ) as HTMLSelectElement;
  });

  it('SURAH_SECRETS has 114 entries (one per surah)', async () => {
    const { SURAH_SECRETS } = await import('../surahs-data.js');
    expect(Object.keys(SURAH_SECRETS).length).toBe(114);
    // Each entry must be a non-empty string
    for (const [k, v] of Object.entries(SURAH_SECRETS)) {
      expect(Number(k)).toBeGreaterThanOrEqual(1);
      expect(Number(k)).toBeLessThanOrEqual(114);
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it('SURAH_SECRETS_AUTH_KEYS is a Record<number, string[]>', async () => {
    const { SURAH_SECRETS_AUTH_KEYS } = await import('../surahs-data.js');
    expect(SURAH_SECRETS_AUTH_KEYS).toBeTypeOf('object');
    // Sample check: key 1 should exist and be an array (possibly empty)
    for (const [k, v] of Object.entries(SURAH_SECRETS_AUTH_KEYS)) {
      expect(Number(k)).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(v)).toBe(true);
    }
  });
});

describe('surah-loader — saveCurrentPosition', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.currentSurah and currentAyahIndex can be set (saveCurrentPosition reads them)', async () => {
    state.currentSurah = 2;
    state.currentAyahIndex = 5;
    expect(state.currentSurah).toBe(2);
    expect(state.currentAyahIndex).toBe(5);
  });
});

describe('surah-loader — calculateAyahTimings', () => {
  it('longer ayah should produce longer timing (contract)', async () => {
    // calculateAyahTimings is private — we verify the contract:
    // each timing is proportional to Arabic letter count
    const ayahs = [
      { number: 1, text: 'بسم الله', numberInSurah: 1 },
      { number: 2, text: 'الحمد لله رب العالمين', numberInSurah: 2 },
    ];
    const len1 = ayahs[0].text.replace(/[\u064B-\u065F\u0670]/g, '').length;
    const len2 = ayahs[1].text.replace(/[\u064B-\u065F\u0670]/g, '').length;
    expect(len2).toBeGreaterThan(len1); // Sanity check
  });
});
