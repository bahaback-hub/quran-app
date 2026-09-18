/**
 * Tests for the Home Launcher module.
 * Verifies first-visit launcher rendering, the 114-surah grid, surah selection
 * wiring, and quick-action routing onto existing toolbar controls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const loadSurahMock = vi.fn();

vi.mock('../surah-loader.js', () => ({
  loadSurah: (...args: unknown[]) => loadSurahMock(...args),
  loadSurahList: vi.fn(),
}));

import { dom } from '../dom.js';
import { state } from '../state.js';
import { showHome, isHomeVisible } from '../home.js';

/** Minimal surah metadata fixture. */
const SURAHS = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', numberOfAyahs: 286 },
  { number: 114, name: 'الناس', englishName: 'An-Nas', numberOfAyahs: 6 },
];

function setupDom(): HTMLElement {
  const content = document.createElement('main');
  content.id = 'surahContent';
  content.className = 'surah-content';
  document.body.appendChild(content);
  dom.surahContent = content;
  return content;
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  dom.surahContent = null;
  dom.viewMushafBtn = null;
  dom.searchToggleBtn = null;
  dom.searchInput = null;
  dom.expandBarBtn = null;
  dom.adhkarBtn = null;
  dom.favoritesOpenBtn = null;
  dom.settingsToggleBtn = null;
  state.surahList = [];
});

describe('home launcher', () => {
  it('renders the welcome hero and one card per surah', () => {
    state.surahList = [...SURAHS];
    const content = setupDom();

    showHome();

    expect(isHomeVisible()).toBe(true);
    expect(content.querySelectorAll('.home-surah-card')).toHaveLength(3);
    expect(content.querySelector('.home-bismillah')?.textContent).toContain('بِسْمِ اللهِ');
    expect(content.querySelector('.home-surah-card[data-surah="2"] .home-surah-name')?.textContent).toContain('البقرة');
  });

  it('renders a fallback row when the surah list is empty', () => {
    const content = setupDom();

    showHome();

    expect(isHomeVisible()).toBe(true);
    expect(content.querySelector('.home-surah-empty')).not.toBeNull();
  });

  it('is a no-op when the launcher is already visible', () => {
    state.surahList = [...SURAHS];
    setupDom();

    showHome();
    showHome();

    expect(contentShown()!.querySelectorAll('.home-surah-card')).toHaveLength(3);
  });

  it('does nothing when the reader surface is missing', () => {
    showHome();
    expect(isHomeVisible()).toBe(false);
  });

  it('loads the clicked surah from the grid', () => {
    state.surahList = [...SURAHS];
    const content = setupDom();
    showHome();

    const card = content.querySelector<HTMLElement>('.home-surah-card[data-surah="114"]');
    card?.click();

    expect(loadSurahMock).toHaveBeenCalledTimes(1);
    expect(loadSurahMock).toHaveBeenCalledWith(114);
    expect(isHomeVisible()).toBe(true);
  });

  it('ignores grid clicks for invalid surah numbers', () => {
    state.surahList = [...SURAHS];
    const content = setupDom();
    showHome();
    const card = content.querySelector<HTMLElement>('.home-surah-card[data-surah="1"]');
    if (card) {
      card.dataset['surah'] = '0';
      card.click();
    }
    expect(loadSurahMock).not.toHaveBeenCalled();
  });

  it('routes the search quick action to the search toggle', () => {
    state.surahList = [...SURAHS];
    const content = setupDom();
    const searchBtn = document.createElement('button');
    const clickSpy = vi.fn();
    searchBtn.addEventListener('click', clickSpy);
    dom.searchToggleBtn = searchBtn;
    showHome();

    const action = content.querySelector<HTMLElement>('.home-action-btn[data-action="search"]');
    action?.click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('routes the mushaf quick action to the mushaf view button', () => {
    state.surahList = [...SURAHS];
    const content = setupDom();
    const mushafBtn = document.createElement('button');
    const clickSpy = vi.fn();
    mushafBtn.addEventListener('click', clickSpy);
    dom.viewMushafBtn = mushafBtn;
    showHome();

    content.querySelector<HTMLElement>('.home-action-btn[data-action="mushaf"]')?.click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

function contentShown(): HTMLElement | null {
  return document.getElementById('surahContent');
}
