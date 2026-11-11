/**
 * KFGQPC print display — the plain reading surfaces must match the printed
 * King Fahd Complex (Madani) mushaf.
 *
 * The Uthmani digital text (Tanzil extended encoding, the same data as
 * quran.com / AlQuran Cloud) marks an ikhfa/idgham tanween with a small meem
 * (U+06ED) after the tanween sign — e.g. 86:13 لَقَوْلٌۭ فَصْلٌۭ. The printed
 * mushaf draws those tanweens as sequential dammas above the letter, and the
 * bundled reading fonts draw U+06ED literally as a small meem below the word,
 * which readers report as a tashkeel difference against the mushaf. The
 * display now hides the mark (data untouched); tajweed mode intentionally
 * keeps the full notation.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { renderSurah, type SurahTextData } from '../surah-render.js';
import { hideSequentialTanweenMeem } from '../uthmani-display.js';

/** 86:13 exactly as stored in public/data/quran-uthmani.json. */
const AT_TARIQ_13 = 'إِنَّهُۥ لَقَوْلٌۭ فَصْلٌۭ';

describe('hideSequentialTanweenMeem (helper)', () => {
  it('removes the sequential-tanween meem after every tanween form', () => {
    expect(hideSequentialTanweenMeem('لَقَوْلٌۭ فَصْلٌۭ')).toBe('لَقَوْلٌ فَصْلٌ');
    expect(hideSequentialTanweenMeem('كَيْدًۭا')).toBe('كَيْدًا'); // fathatan
    expect(hideSequentialTanweenMeem('بَطْشًۭا')).toBe('بَطْشًا');
  });

  it('keeps every other Uthmani mark (print-authentic notation)', () => {
    // small waw on the pronoun — present in the printed mushaf itself
    expect(hideSequentialTanweenMeem('إِنَّهُۥ')).toBe('إِنَّهُۥ');
    // waqf sign, silent-letter zero, small ya, empty sukun stay untouched
    expect(hideSequentialTanweenMeem('ءَامَنُوا۟ ۖ هُۦ')).toBe('ءَامَنُوا۟ ۖ هُۦ');
  });

  it('is a no-op for text without the mark', () => {
    expect(hideSequentialTanweenMeem('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ')).toBe(
      'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    );
    expect(hideSequentialTanweenMeem('')).toBe('');
  });

  it('matches the mushaf look for the owner-reported example verse', () => {
    // Reported against the Madani mushaf: the reading view must show the
    // verse exactly like the print reads: إِنَّهُۥ لَقَوْلٌ فَصْلٌ
    expect(hideSequentialTanweenMeem(AT_TARIQ_13)).toBe('إِنَّهُۥ لَقَوْلٌ فَصْلٌ');
  });
});

describe('surah reading view matches the printed mushaf (display only)', () => {
  beforeEach(() => {
    const host = document.createElement('div');
    (dom as unknown as Record<string, unknown>).surahContent = host;
    state.surahData = null;
    state.translationData = null;
    state.translationEnabled = false;
    state.tajweedEnabled = false;
    state.fontSize = 28;
  });

  it('renders the ayah without the sequential-tanween meem', () => {
    const surah: SurahTextData = {
      number: 86,
      name: 'سُورَةُ الطَّارِقِ',
      englishName: 'At-Tariq',
      ayahs: [
        { numberInSurah: 13, text: AT_TARIQ_13, juz: 30, page: 591, number: 5917 },
      ],
    } as unknown as SurahTextData;
    state.surahData = surah as unknown as typeof state.surahData;
    renderSurah(surah);

    const ayahEl = dom.surahContent!.querySelector('.ayah') as HTMLElement;
    expect(ayahEl.textContent).toContain('إِنَّهُۥ لَقَوْلٌ فَصْلٌ');
    expect(ayahEl.textContent).not.toContain('\u06ED');
  });

  it('keeps the stored data untouched (search/copy/integrity keep the standard text)', () => {
    const surah: SurahTextData = {
      number: 86,
      name: 'سُورَةُ الطَّارِقِ',
      englishName: 'At-Tariq',
      ayahs: [
        { numberInSurah: 13, text: AT_TARIQ_13, juz: 30, page: 591, number: 5917 },
      ],
    } as unknown as SurahTextData;
    state.surahData = surah as unknown as typeof state.surahData;
    renderSurah(surah);

    // Same object reference the renderer read from: the stored text is intact.
    expect(surah.ayahs[0]!.text).toBe(AT_TARIQ_13);
    expect(surah.ayahs[0]!.text).toContain('\u06ED');
  });

  it('does not change the word elements the audio tracker walks', () => {
    const surah: SurahTextData = {
      number: 86,
      name: 'سُورَةُ الطَّارِقِ',
      englishName: 'At-Tariq',
      ayahs: [
        { numberInSurah: 13, text: AT_TARIQ_13, juz: 30, page: 591, number: 5917 },
      ],
    } as unknown as SurahTextData;
    state.surahData = surah as unknown as typeof state.surahData;
    renderSurah(surah);

    const words = dom.surahContent!.querySelectorAll('.word');
    expect(words.length).toBe(3); // إنه + لقول + فصل
    // Base-letter counts (what word weights use) are mark-independent anyway.
    for (const w of words) {
      expect(w.textContent).toBeTruthy();
    }
  });
});

describe('ayah modal matches the printed mushaf', () => {
  it('routes both modal display sites through the helper', () => {
    const src = readFileSync(resolve(import.meta.dirname, '../ayah-modal.ts'), 'utf8');
    const matches = src.match(/ayahModalText!\.textContent = hideSequentialTanweenMeem\(/g);
    expect(matches?.length).toBe(2);
  });
});

describe('tajweed mode intentionally keeps the full notation', () => {
  it('the tajweed render path still receives the raw word', () => {
    const src = readFileSync(resolve(import.meta.dirname, '../surah-render.ts'), 'utf8');
    expect(src).toContain('tajweedColorWord(word, outputPos, colorMap!)');
    expect(src).toContain('escapeHtml(hideSequentialTanweenMeem(word))');
  });
});
