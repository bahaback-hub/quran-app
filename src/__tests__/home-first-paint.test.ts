/**
 * Tests for the early-paint path on the home launcher.
 *
 * The launcher is what a first-time visitor sees, and its bismillah is their
 * Largest Contentful Paint. Lighthouse measured that at 1.0s with 1523ms of
 * element render delay against a 2ms time-to-first-byte, which pointed at one
 * thing: the page sat waiting on `loadSurahList()` before anything the visitor
 * would judge the page on existed. So the launcher is now painted first and the
 * grid is filled in afterwards.
 *
 * These tests hold the three things that could silently undo that: the grid must
 * actually be filled in later, the cards that replace it must still be clickable
 * (freshly inserted buttons do not inherit listeners), and a late list must
 * never overwrite a reader's text.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadSurahMock = vi.fn();

vi.mock('../surah-loader.js', () => ({
  loadSurah: (...args: unknown[]) => loadSurahMock(...args),
  loadSurahList: vi.fn(),
}));

vi.mock('../reading-plans.js', () => ({ openReadingPlanPanel: vi.fn() }));

import { dom } from '../dom.js';
import { state } from '../state.js';
import { showHome, refreshHomeGrid, isHomeVisible } from '../home.js';

const SURAHS = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', numberOfAyahs: 286 },
];

function setupDom(): HTMLElement {
  const content = document.createElement('main');
  content.id = 'surahContent';
  content.className = 'surah-content';
  document.body.appendChild(content);
  dom.surahContent = content;
  return content;
}

const grid = (content: HTMLElement) => content.querySelector('.home-surah-grid')!;

beforeEach(() => {
  document.body.innerHTML = '';
  loadSurahMock.mockClear();
  state.surahList = [];
  dom.surahContent = null;
});

describe('home launcher paints before the surah list arrives', () => {
  it('renders the hero with an empty grid when the list has not loaded', () => {
    const content = setupDom();
    showHome();

    expect(isHomeVisible()).toBe(true);
    // The bismillah is the LCP element, so it must be in the DOM at this point
    // and not depend on any network result.
    expect(content.querySelector('.home-bismillah')?.textContent?.trim()).not.toBe('');
    expect(grid(content).querySelectorAll('.home-surah-card')).toHaveLength(0);
    expect(grid(content).dataset['filled']).toBeUndefined();
  });

  it('fills the grid in once the list lands, without touching the hero', () => {
    const content = setupDom();
    showHome();
    const hero = content.querySelector('.home-bismillah')!;

    state.surahList = SURAHS as never;
    refreshHomeGrid();

    expect(grid(content).querySelectorAll('.home-surah-card')).toHaveLength(2);
    expect(grid(content).dataset['filled']).toBe('true');
    // The hero must be the same node, not re-rendered: a re-render would move it
    // and cost a layout shift on the one element being measured.
    expect(content.querySelector('.home-bismillah')).toBe(hero);
  });

  it('keeps the replacement cards clickable', () => {
    const content = setupDom();
    showHome();
    state.surahList = SURAHS as never;
    refreshHomeGrid();

    const card = grid(content).querySelector<HTMLElement>('.home-surah-card[data-surah="2"]')!;
    expect(card).toBeTruthy();
    card.click();
    expect(loadSurahMock).toHaveBeenCalledWith(2);
  });

  it('is idempotent, so a second call cannot rebuild a filled grid', () => {
    const content = setupDom();
    showHome();
    state.surahList = SURAHS as never;
    refreshHomeGrid();
    const first = grid(content).firstElementChild;

    refreshHomeGrid();
    expect(grid(content).firstElementChild).toBe(first);
  });

  it('renders the full grid immediately when the list is already there', () => {
    const content = setupDom();
    state.surahList = SURAHS as never;
    showHome();

    expect(grid(content).querySelectorAll('.home-surah-card')).toHaveLength(2);
    expect(grid(content).dataset['filled']).toBe('true');
  });

  it('never overwrites a reader who has already opened a surah', () => {
    const content = setupDom();
    showHome();
    // The reader picks a surah before the list finishes arriving.
    content.innerHTML = '<div class="ayah">verse text</div>';

    state.surahList = SURAHS as never;
    refreshHomeGrid();

    expect(content.querySelector('.ayah')?.textContent).toBe('verse text');
    expect(content.querySelector('.home-surah-grid')).toBeNull();
  });

  it('does nothing when the list is still empty', () => {
    const content = setupDom();
    showHome();
    refreshHomeGrid();
    expect(grid(content).dataset['filled']).toBeUndefined();
  });
});
