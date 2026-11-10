/**
 * N-14 regression — accessibility and metadata leftovers on live surfaces:
 * icon-only close buttons with no accessible name (screen readers announced
 * nothing but "button"), ayah-number spans with role="button" but no
 * tabindex/keyboard activation, and og metadata that advertised only half the
 * app's nine UI languages.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { state } from '../state.js';
import { dom } from '../dom.js';
import { renderSurah, type SurahTextData } from '../surah-render.js';

const ONE_AYAH: SurahTextData = {
  number: 1,
  name: 'S1',
  englishName: 'S1',
  ayahs: [{ numberInSurah: 1, text: 'a' }],
} as SurahTextData;

describe('icon-only close buttons carry a translated accessible name (N-14)', () => {
  it('labels every bare ✖ close button in the overlay templates', () => {
    const overlays = readFileSync(resolve(import.meta.dirname, '../overlays.ts'), 'utf8');
    const idRe = /id="(adhkarAddCloseBtn|surahSecretsCloseBtn|readingStatsCloseBtn)"/g;
    const matches = [...overlays.matchAll(idRe)];
    expect(matches.length).toBe(3);
    for (const match of matches) {
      const buttonTag = overlays.slice(Math.max(0, match.index! - 200), match.index! + match[0].length + 120);
      expect(buttonTag, match[1]).toContain('data-i18n-aria-label="close"');
      expect(buttonTag, match[1]).toMatch(/aria-label="[^"]+"/);
    }
  });
});

describe('ayah numbers are keyboard-operable (N-14)', () => {
  beforeEach(() => {
    const host = document.createElement('div');
    (dom as unknown as Record<string, unknown>).surahContent = host;
    state.surahData = null;
    state.translationData = null;
    state.translationEnabled = false;
    state.tajweedEnabled = false;
    state.fontSize = 28;
  });

  it('emits the ayah-number span with role, tabindex, and aria-label', () => {
    state.surahData = ONE_AYAH as unknown as typeof state.surahData;
    renderSurah(ONE_AYAH);
    const number = dom.surahContent!.querySelector('.ayah-number') as HTMLElement;
    expect(number.getAttribute('role')).toBe('button');
    expect(number.getAttribute('tabindex')).toBe('0');
    expect(number.getAttribute('aria-label')).toBeTruthy();
  });

  it('activates through Enter and Space like a real button', async () => {
    // The delegated keydown handler binds once per module instance (and a
    // previous test may have bound it to another host), so take a fresh
    // module bound to THIS test's host.
    vi.resetModules();
    const { renderSurah: freshRenderSurah } = await import('../surah-render.js');
    state.surahData = ONE_AYAH as unknown as typeof state.surahData;
    freshRenderSurah(ONE_AYAH);
    const number = dom.surahContent!.querySelector('.ayah-number') as HTMLElement;
    const clicked = vi.fn();
    number.addEventListener('click', clicked);

    number.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    number.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    number.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));

    expect(clicked).toHaveBeenCalledTimes(2);
  });
});

describe('og metadata covers all nine UI languages (N-14)', () => {
  it('lists an og:locale:alternate for every supported UI locale', () => {
    const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');
    const alternates = [...html.matchAll(/og:locale:alternate" content="([a-zA-Z_]+)"/g)].map((m) => m[1]!);
    const expected = ['en_US', 'tr_TR', 'ms_MY', 'id_ID', 'fr_FR', 'de_DE', 'ru_RU', 'ur_PK'];
    for (const locale of expected) {
      expect(alternates, `${locale} must be advertised`).toContain(locale);
    }
  });

  it('describes the share image for screen readers and slow networks', () => {
    const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');
    expect(html).toMatch(/og:image:alt" content="[^"]+"/);
  });
});
