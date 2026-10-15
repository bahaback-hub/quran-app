/**
 * Tests for selective surah rendering (ARC-02).
 *
 * Full innerHTML rebuilds on every translation arrival and background refresh
 * repaint ~6,300 word spans and can move the reader's scroll. These tests pin
 * the cheaper paths: patching translation spans in place, and skipping
 * byte-identical refreshes entirely. Container-element identity is the proof:
 * a full render replaces .ayahs-container, a patch/skip preserves it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import {
  renderSurah,
  patchTranslations,
  renderSurahIfChanged,
  surahTextFingerprint,
  type SurahTextData,
} from '../surah-render.js';

function ayahs(n: number, prefix = 'text'): Array<{ numberInSurah: number; text: string }> {
  return Array.from({ length: n }, (_, i) => ({ numberInSurah: i + 1, text: `${prefix}-${i + 1}` }));
}

function surah(num: number, n: number, prefix = 'text'): SurahTextData {
  return { number: num, name: `S${num}`, englishName: `S${num}`, ayahs: ayahs(n, prefix) } as SurahTextData;
}

function container(): HTMLElement {
  return dom.surahContent!.querySelector('.ayahs-container') as HTMLElement;
}

describe('selective surah rendering (ARC-02)', () => {
  beforeEach(() => {
    const host = document.createElement('div');
    (dom as unknown as Record<string, unknown>).surahContent = host;
    state.surahData = null;
    state.translationData = null;
    state.translationEnabled = false;
    state.currentTranslation = '';
    state.tajweedEnabled = false;
    state.fontSize = 28;
  });

  it('fingerprints identical text equally and changed text differently', () => {
    const a = surah(1, 7);
    const b = surah(1, 7);
    const c = surah(1, 7, 'other');
    expect(surahTextFingerprint(a)).toBe(surahTextFingerprint(b));
    expect(surahTextFingerprint(a)).not.toBe(surahTextFingerprint(c));
    expect(surahTextFingerprint(a)).not.toBe(surahTextFingerprint(surah(2, 7)));
  });

  it('patchTranslations adds missing translation spans without rebuilding', () => {
    const text = surah(1, 3);
    state.surahData = text as unknown as typeof state.surahData;
    renderSurah(text);
    expect(container().querySelectorAll('.translation-text').length).toBe(0);

    state.translationEnabled = true;
    state.currentTranslation = 'en.sahih';
    state.translationData = { ayahs: [{ text: 't1' }, { text: 't2' }, { text: 't3' }] } as never;
    const before = container();

    expect(patchTranslations()).toBe(true);

    expect(container()).toBe(before);
    const spans = [...container().querySelectorAll('.translation-text')];
    expect(spans.length).toBe(3);
    expect(spans.map((s) => s.textContent)).toEqual(['t1', 't2', 't3']);
  });

  it('patchTranslations updates changed text in place', () => {
    const text = surah(1, 2);
    state.surahData = text as unknown as typeof state.surahData;
    state.translationEnabled = true;
    state.currentTranslation = 'en.sahih';
    state.translationData = { ayahs: [{ text: 'old-1' }, { text: 'old-2' }] } as never;
    renderSurah(text);
    const before = container();

    state.translationData = { ayahs: [{ text: 'new-1' }, { text: 'old-2' }] } as never;
    expect(patchTranslations()).toBe(true);

    expect(container()).toBe(before);
    const spans = [...container().querySelectorAll('.translation-text')];
    expect(spans.map((s) => s.textContent)).toEqual(['new-1', 'old-2']);
  });

  it('patchTranslations drops spans when translation is off', () => {
    const text = surah(1, 2);
    state.surahData = text as unknown as typeof state.surahData;
    state.translationEnabled = true;
    state.currentTranslation = 'en.sahih';
    state.translationData = { ayahs: [{ text: 't1' }, { text: 't2' }] } as never;
    renderSurah(text);
    expect(container().querySelectorAll('.translation-text').length).toBe(2);

    state.translationEnabled = false;
    state.translationData = null;
    expect(patchTranslations()).toBe(true);
    expect(container().querySelectorAll('.translation-text').length).toBe(0);
  });

  it('patchTranslations refuses a DOM that no longer matches the surah', () => {
    state.surahData = surah(1, 3) as unknown as typeof state.surahData;
    renderSurah(state.surahData as unknown as SurahTextData);
    // Reader moved on: state now points at another surah with another length.
    state.surahData = surah(2, 5) as unknown as typeof state.surahData;
    state.translationEnabled = true;
    state.currentTranslation = 'en.sahih';
    state.translationData = { ayahs: ayahs(5, 'x').map((a) => ({ text: a.text })) } as never;

    expect(patchTranslations()).toBe(false);
  });

  it('renderSurahIfChanged renders once, then skips identical data', () => {
    // Unique surah: module-level fingerprints persist across tests in this
    // file, so each skip test needs content no earlier test rendered.
    const text = surah(9, 3);
    state.surahData = text as unknown as typeof state.surahData;

    expect(renderSurahIfChanged(text)).toBe(true);
    const before = container();

    expect(renderSurahIfChanged(surah(9, 3))).toBe(false);
    expect(container()).toBe(before);
  });

  it('renderSurahIfChanged renders again when text or translation changed', () => {
    const text = surah(10, 2);
    state.surahData = text as unknown as typeof state.surahData;
    expect(renderSurahIfChanged(text)).toBe(true);
    const before = container();

    state.translationEnabled = true;
    state.currentTranslation = 'en.sahih';
    state.translationData = { ayahs: [{ text: 't1' }, { text: 't2' }] } as never;
    expect(renderSurahIfChanged(text)).toBe(true);
    expect(container()).not.toBe(before);

    const rebuilt = container();
    expect(renderSurahIfChanged(text)).toBe(false);
    expect(container()).toBe(rebuilt);
  });
});
