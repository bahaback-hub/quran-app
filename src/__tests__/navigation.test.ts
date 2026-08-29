import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dom } from '../dom.js';

Element.prototype.scrollIntoView = vi.fn();

function setupDOM() {
  document.body.innerHTML = `
    <button id="collapsedPrevSurahBtn"></button>
    <button id="collapsedPrevAyahBtn"></button>
    <button id="collapsedPlayBtn"></button>
    <button id="collapsedNextAyahBtn"></button>
    <button id="collapsedNextSurahBtn"></button>
    <div id="collapsedContent"></div>
    <div id="player"></div>
  `;
  const el = (tag: string) => document.createElement(tag);
  dom.surahContent = el('div');
  dom.player = document.getElementById('player');
  dom.controls = el('div');
  dom.searchInput = el('input') as HTMLInputElement;
  dom.prevAyahBtn = el('button');
  dom.nextAyahBtn = el('button');
  dom.prevSurahBtn = el('button');
  dom.nextSurahBtn = el('button');
  dom.hifdhBtn = el('button');
  dom.repeatBtn = el('button');
  dom.collapsePlayerBtn = el('button');
  dom.collapsedContent = document.getElementById('collapsedContent');
  dom.playPauseBtn = el('button');
  dom.collapsedPlayBtn = document.getElementById('collapsedPlayBtn');
  dom.playerMoreBtn = el('button');
  dom.playerMoreRow = el('div');
  dom.speedSelect = el('select') as HTMLSelectElement;
  dom.audioPlayer = el('audio') as HTMLAudioElement;
  dom.viewSurahBtn = el('button');
  dom.viewMushafBtn = el('button');
  dom.viewPresBtn = el('button');
  dom.pageSelect = el('select') as HTMLSelectElement;
  dom.pageSlider = el('input') as HTMLInputElement;
  dom.pageIndicator = el('div');
}

describe('initNavigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setupDOM();
  });

  it('should bind surah nav buttons', async () => {
    const { initNavigation } = await import('../navigation.js');
    const spy = vi.spyOn(dom.prevAyahBtn!, 'addEventListener');
    initNavigation();
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should bind player control buttons', async () => {
    const { initNavigation } = await import('../navigation.js');
    const spy = vi.spyOn(dom.playPauseBtn!, 'addEventListener');
    initNavigation();
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should bind view mode toggles', async () => {
    const { initNavigation } = await import('../navigation.js');
    const spy = vi.spyOn(dom.viewSurahBtn!, 'addEventListener');
    initNavigation();
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should collapse player on collapsePlayerBtn click', async () => {
    const { initNavigation } = await import('../navigation.js');
    initNavigation();
    dom.collapsePlayerBtn!.click();
    expect(dom.player!.classList.contains('collapsed')).toBe(true);
  });

  it('should navigate on bottom nav tab click', async () => {
    const bottomNav = document.createElement('div');
    bottomNav.id = 'bottomNav';
    const btnQuran = document.createElement('button');
    btnQuran.className = 'bottom-nav-btn';
    btnQuran.dataset.tab = 'quran';
    const btnControls = document.createElement('button');
    btnControls.className = 'bottom-nav-btn';
    btnControls.dataset.tab = 'controls';
    bottomNav.appendChild(btnQuran);
    bottomNav.appendChild(btnControls);
    document.body.appendChild(bottomNav);

    const { initNavigation } = await import('../navigation.js');
    initNavigation();
    // First switch to 'controls' to change activeTab away from 'quran'
    btnControls.click();
    // Now 'quran' should trigger the switch case
    btnQuran.click();
    expect(dom.surahContent!.scrollIntoView).toHaveBeenCalled();
  });

  it('should handle player tab in bottom nav', async () => {
    const bottomNav = document.createElement('div');
    bottomNav.id = 'bottomNav';
    const btn = document.createElement('button');
    btn.className = 'bottom-nav-btn';
    btn.dataset.tab = 'player';
    bottomNav.appendChild(btn);
    document.body.appendChild(bottomNav);

    const { initNavigation } = await import('../navigation.js');
    initNavigation();
    btn.click();
    expect(dom.player!.scrollIntoView).toHaveBeenCalled();
  });

  it('should handle search tab in bottom nav', async () => {
    const bottomNav = document.createElement('div');
    bottomNav.id = 'bottomNav';
    const btn = document.createElement('button');
    btn.className = 'bottom-nav-btn';
    btn.dataset.tab = 'search';
    bottomNav.appendChild(btn);
    document.body.appendChild(bottomNav);
    const headerSearch = document.createElement('div');
    headerSearch.id = 'headerSearch';
    document.body.appendChild(headerSearch);

    const { initNavigation } = await import('../navigation.js');
    initNavigation();
    btn.click();
    expect(headerSearch.classList.contains('is-expanded')).toBe(true);
  });

  it('should handle speed select change', async () => {
    const { initNavigation } = await import('../navigation.js');
    initNavigation();
    const opt = document.createElement('option');
    opt.value = '1.5';
    dom.speedSelect!.appendChild(opt);
    dom.speedSelect!.value = '1.5';
    dom.speedSelect!.dispatchEvent(new Event('change'));
    expect(dom.audioPlayer!.playbackRate).toBe(1.5);
  });

  it('binds collapsed-mode nav buttons without expanding the player', async () => {
    const { initNavigation } = await import('../navigation.js');
    initNavigation();
    const ids = [
      'collapsedPrevSurahBtn',
      'collapsedPrevAyahBtn',
      'collapsedNextAyahBtn',
      'collapsedNextSurahBtn',
    ];
    for (const id of ids) {
      const btn = document.getElementById(id);
      expect(btn).not.toBeNull();
      // Clicking a collapsed nav button must NOT add the expanded class to body.
      document.body.classList.remove('player-expanded');
      btn!.dispatchEvent(new Event('click', { bubbles: true }));
      expect(document.body.classList.contains('player-expanded')).toBe(false);
    }
  });
});
