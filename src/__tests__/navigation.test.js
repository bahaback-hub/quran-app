import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dom } from '../dom.js';

Element.prototype.scrollIntoView = vi.fn();

function setupDOM() {
  const el = (tag) => document.createElement(tag);
  dom.surahContent = el('div');
  dom.player = el('div');
  dom.controls = el('div');
  dom.searchInput = el('input');
  dom.prevAyahBtn = el('button');
  dom.nextAyahBtn = el('button');
  dom.prevSurahBtn = el('button');
  dom.nextSurahBtn = el('button');
  dom.hifdhBtn = el('button');
  dom.repeatBtn = el('button');
  dom.collapsePlayerBtn = el('button');
  dom.collapsedExpandBtn = el('button');
  dom.collapsedContent = el('div');
  dom.playPauseBtn = el('button');
  dom.collapsedPlayBtn = el('button');
  dom.playerMoreBtn = el('button');
  dom.playerMoreRow = el('div');
  dom.speedSelect = el('select');
  dom.audioPlayer = el('audio');
  dom.viewSurahBtn = el('button');
  dom.viewMushafBtn = el('button');
  dom.viewPresBtn = el('button');
  dom.pageSelect = el('select');
  dom.pageSlider = el('input');
  dom.surahModeControls = el('div');
  dom.pageIndicator = el('div');
}

describe('initNavigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setupDOM();
  });

  it('should bind surah nav buttons', async () => {
    const { initNavigation } = await import('../navigation.js');
    const spy = vi.spyOn(dom.prevAyahBtn, 'addEventListener');
    initNavigation();
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should bind player control buttons', async () => {
    const { initNavigation } = await import('../navigation.js');
    const spy = vi.spyOn(dom.playPauseBtn, 'addEventListener');
    initNavigation();
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should bind view mode toggles', async () => {
    const { initNavigation } = await import('../navigation.js');
    const spy = vi.spyOn(dom.viewSurahBtn, 'addEventListener');
    initNavigation();
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should collapse player on collapsePlayerBtn click', async () => {
    const { initNavigation } = await import('../navigation.js');
    initNavigation();
    dom.collapsePlayerBtn.click();
    expect(dom.player.classList.contains('collapsed')).toBe(true);
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
    expect(dom.surahContent.scrollIntoView).toHaveBeenCalled();
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
    expect(dom.player.scrollIntoView).toHaveBeenCalled();
  });

  it('should handle search tab in bottom nav', async () => {
    const bottomNav = document.createElement('div');
    bottomNav.id = 'bottomNav';
    const btn = document.createElement('button');
    btn.className = 'bottom-nav-btn';
    btn.dataset.tab = 'search';
    bottomNav.appendChild(btn);
    document.body.appendChild(bottomNav);

    const { initNavigation } = await import('../navigation.js');
    initNavigation();
    btn.click();
    expect(dom.controls.classList.contains('mobile-show')).toBe(true);
  });

  it('should handle speed select change', async () => {
    const { initNavigation } = await import('../navigation.js');
    initNavigation();
    const opt = document.createElement('option');
    opt.value = '1.5';
    dom.speedSelect.appendChild(opt);
    dom.speedSelect.value = '1.5';
    dom.speedSelect.dispatchEvent(new Event('change'));
    expect(dom.audioPlayer.playbackRate).toBe(1.5);
  });
});
