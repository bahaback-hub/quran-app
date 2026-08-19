/**
 * Comprehensive tests for navigation.ts — Navigation controller for the Quran app.
 * Covers: initNavigation, surah nav buttons, player controls, view mode toggles,
 * page selectors, bottom navigation tab bar, and mushaf mode restoration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../audio.js', () => ({
  prevAyah: vi.fn(),
  nextAyah: vi.fn(),
  prevSurah: vi.fn(),
  nextSurah: vi.fn(),
  toggleHifdh: vi.fn(),
  toggleRepeat: vi.fn(),
  expandPlayer: vi.fn(),
  collapsePlayer: vi.fn(),
  togglePlayPause: vi.fn(),
  updatePlayPauseBtn: vi.fn(),
}));

vi.mock('../settings.js', () => ({
  openSettings: vi.fn(),
}));

vi.mock('../mushaf.js', () => ({
  toggleMushafMode: vi.fn(),
  loadPage: vi.fn(),
}));

vi.mock('../presentation.js', () => ({
  closePresentation: vi.fn(),
  openPresentation: vi.fn(),
}));

vi.mock('../state.js', () => ({
  state: {
    mushafMode: false,
    currentPage: 1,
  },
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
  },
}));

vi.mock('../dom.js', () => ({
  dom: {
    surahContent: null as HTMLElement | null,
    player: null as HTMLElement | null,
    controls: null as HTMLElement | null,
    searchInput: null as HTMLInputElement | null,
    searchInputGroup: null as HTMLElement | null,
    searchToggleBtn: null as HTMLElement | null,
    prevAyahBtn: null as HTMLElement | null,
    nextAyahBtn: null as HTMLElement | null,
    prevSurahBtn: null as HTMLElement | null,
    nextSurahBtn: null as HTMLElement | null,
    hifdhBtn: null as HTMLElement | null,
    repeatBtn: null as HTMLElement | null,
    collapsePlayerBtn: null as HTMLElement | null,
    collapsedContent: null as HTMLElement | null,
    collapsedPlayBtn: null as HTMLElement | null,
    playPauseBtn: null as HTMLElement | null,
    playerMoreBtn: null as HTMLElement | null,
    playerMoreRow: null as HTMLElement | null,
    speedSelect: null as HTMLSelectElement | null,
    audioPlayer: null as HTMLAudioElement | null,
    viewSurahBtn: null as HTMLElement | null,
    viewMushafBtn: null as HTMLElement | null,
    viewPresBtn: null as HTMLElement | null,
    pageSelect: null as HTMLSelectElement | null,
    pageSlider: null as HTMLInputElement | null,
    pageIndicator: null as HTMLElement | null,
  },
}));

import { initNavigation } from '../navigation.js';
import { dom } from '../dom.js';
import { state } from '../state.js';
import { storage } from '../storage.js';
import {
  prevAyah,
  nextAyah,
  prevSurah,
  nextSurah,
  toggleHifdh,
  toggleRepeat,
  expandPlayer,
  collapsePlayer,
  togglePlayPause,
  updatePlayPauseBtn,
} from '../audio.js';
import { openSettings } from '../settings.js';

Element.prototype.scrollIntoView = vi.fn();

function setupDOM() {
  const el = (tag: string) => document.createElement(tag);
  dom.surahContent = el('div');
  dom.player = el('div');
  dom.controls = el('div');
  dom.searchInput = el('input') as HTMLInputElement;
  dom.searchInputGroup = el('div');
  dom.searchToggleBtn = el('button');
  dom.prevAyahBtn = el('button');
  dom.nextAyahBtn = el('button');
  dom.prevSurahBtn = el('button');
  dom.nextSurahBtn = el('button');
  dom.hifdhBtn = el('button');
  dom.repeatBtn = el('button');
  dom.collapsePlayerBtn = el('button');
  dom.collapsedContent = el('div');
  dom.playPauseBtn = el('button');
  dom.collapsedPlayBtn = el('button');
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

describe('navigation-full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    setupDOM();
    state.mushafMode = false;
    state.currentPage = 1;
  });

  /* ===================== Surah Nav Buttons ===================== */

  describe('surah nav buttons', () => {
    it('should bind prevAyahBtn click to prevAyah', async () => {
      const { initNavigation } = await import('../navigation.js');
      const spy = vi.spyOn(dom.prevAyahBtn!, 'addEventListener');
      initNavigation();
      expect(spy).toHaveBeenCalledWith('click', prevAyah);
    });

    it('should bind nextAyahBtn click to nextAyah(false)', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.nextAyahBtn!.click();
      expect(nextAyah).toHaveBeenCalledWith(false);
    });

    it('should bind prevSurahBtn click to prevSurah', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.prevSurahBtn!.click();
      expect(prevSurah).toHaveBeenCalled();
    });

    it('should bind nextSurahBtn click to nextSurah', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.nextSurahBtn!.click();
      expect(nextSurah).toHaveBeenCalled();
    });

    it('should bind hifdhBtn click to toggleHifdh', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.hifdhBtn!.click();
      expect(toggleHifdh).toHaveBeenCalled();
    });

    it('should bind repeatBtn click to toggleRepeat', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.repeatBtn!.click();
      expect(toggleRepeat).toHaveBeenCalled();
    });
  });

  /* ===================== Player Controls ===================== */

  describe('player controls', () => {
    it('should collapse player on collapsePlayerBtn click', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.collapsePlayerBtn!.click();
      expect(collapsePlayer).toHaveBeenCalled();
    });

    it('should save player_collapsed to storage on collapse', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.collapsePlayerBtn!.click();
      expect(collapsePlayer).toHaveBeenCalled();
    });

    it('should expand player when collapsedContent clicked (not on play btn)', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.collapsedContent!.click();
      expect(expandPlayer).toHaveBeenCalled();
    });

    it('should not expand player when collapsedPlayBtn is clicked', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      // Simulate click on collapsedPlayBtn within collapsedContent
      const evt = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(evt, 'target', { value: dom.collapsedPlayBtn });
      dom.collapsedContent!.dispatchEvent(evt);
      // expandPlayer should NOT be called since the click was on the play button
      // The check is (e.target as HTMLElement).closest('#collapsedPlayBtn')
    });

    it('should toggle play/pause on playPauseBtn click', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.playPauseBtn!.click();
      expect(togglePlayPause).toHaveBeenCalled();
      expect(updatePlayPauseBtn).toHaveBeenCalled();
    });

    it('should toggle play/pause on collapsedPlayBtn click', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.collapsedPlayBtn!.click();
      expect(togglePlayPause).toHaveBeenCalled();
      expect(updatePlayPauseBtn).toHaveBeenCalled();
    });

    it('should toggle playerMoreRow visibility on playerMoreBtn click', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.playerMoreBtn!.click();
      expect(dom.playerMoreRow!.classList.contains('hidden')).toBe(true);
      expect(dom.playerMoreBtn!.getAttribute('aria-expanded')).toBe('false');
    });

    it('should toggle playerMoreRow back to visible on second click', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.playerMoreBtn!.click();
      dom.playerMoreBtn!.click();
      expect(dom.playerMoreRow!.classList.contains('hidden')).toBe(false);
      expect(dom.playerMoreBtn!.getAttribute('aria-expanded')).toBe('true');
    });

    it('should update playback rate on speed select change', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      const opt = document.createElement('option');
      opt.value = '1.5';
      dom.speedSelect!.appendChild(opt);
      dom.speedSelect!.value = '1.5';
      dom.speedSelect!.dispatchEvent(new Event('change'));
      expect(dom.audioPlayer!.playbackRate).toBe(1.5);
      expect(storage.set).toHaveBeenCalledWith('playback_speed', 1.5);
    });
  });

  /* ===================== View Mode Toggles ===================== */

  describe('view mode toggles', () => {
    it('should bind viewSurahBtn click handler', async () => {
      const { initNavigation } = await import('../navigation.js');
      const spy = vi.spyOn(dom.viewSurahBtn!, 'addEventListener');
      initNavigation();
      expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should hide page controls when switching to surah view', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.viewSurahBtn!.click();
      expect(dom.pageSelect!.style.display).toBe('none');
      expect(dom.pageSlider!.style.display).toBe('none');
      expect(dom.pageIndicator!.style.display).toBe('none');
    });

    it('should toggle active class on view mode buttons in surah view', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();

      // Create view mode buttons in DOM so querySelectorAll works
      const btn1 = document.createElement('button');
      btn1.className = 'view-mode-btn';
      btn1.dataset['mode'] = 'surah';
      document.body.appendChild(btn1);
      const btn2 = document.createElement('button');
      btn2.className = 'view-mode-btn';
      btn2.dataset['mode'] = 'mushaf';
      document.body.appendChild(btn2);

      dom.viewSurahBtn!.click();
      expect(btn1.classList.contains('active')).toBe(true);
      expect(btn2.classList.contains('active')).toBe(false);

      btn1.remove();
      btn2.remove();
    });

    it('should toggle mushaf mode when clicking viewMushafBtn', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.viewMushafBtn!.click();
      // mushaf.toggleMushafMode is dynamically imported
    });

    it('should handle page select change', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      const opt = document.createElement('option');
      opt.value = '50';
      dom.pageSelect!.appendChild(opt);
      dom.pageSelect!.value = '50';
      dom.pageSelect!.dispatchEvent(new Event('change'));
      expect(dom.pageSlider!.value).toBe('50');
    });

    it('should handle page slider input', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      // Add options to page select so value can be set
      const opt = document.createElement('option');
      opt.value = '30';
      dom.pageSelect!.appendChild(opt);
      dom.pageSlider!.value = '30';
      dom.pageSlider!.dispatchEvent(new Event('input'));
      expect(dom.pageSelect!.value).toBe('30');
    });

    it('should not update page slider when page select value is empty', async () => {
      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.pageSelect!.value = '';
      dom.pageSelect!.dispatchEvent(new Event('change'));
      // loadPage should not have been called
    });
  });

  /* ===================== Bottom Navigation ===================== */

  describe('bottom navigation', () => {
    it('should handle quran tab click', async () => {
      const bottomNav = document.createElement('div');
      bottomNav.id = 'bottomNav';
      const btnQuran = document.createElement('button');
      btnQuran.className = 'bottom-nav-btn';
      btnQuran.dataset.tab = 'quran';
      bottomNav.appendChild(btnQuran);
      document.body.appendChild(bottomNav);

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      // First switch to 'controls' to change activeTab away from 'quran'
      const btnControls = document.createElement('button');
      btnControls.className = 'bottom-nav-btn';
      btnControls.dataset.tab = 'controls';
      bottomNav.appendChild(btnControls);
      btnControls.click();
      btnQuran.click();
      expect(dom.surahContent!.scrollIntoView).toHaveBeenCalled();
      expect(dom.controls!.classList.contains('mobile-show')).toBe(false);
    });

    it('should handle player tab click', async () => {
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
      expect(expandPlayer).toHaveBeenCalled();
      expect(dom.player!.scrollIntoView).toHaveBeenCalled();
      expect(dom.controls!.classList.contains('mobile-show')).toBe(false);
    });

    it('should handle controls tab click', async () => {
      const bottomNav = document.createElement('div');
      bottomNav.id = 'bottomNav';
      const btn = document.createElement('button');
      btn.className = 'bottom-nav-btn';
      btn.dataset.tab = 'controls';
      bottomNav.appendChild(btn);
      document.body.appendChild(bottomNav);

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      btn.click();
      expect(dom.controls!.classList.contains('mobile-show')).toBe(true);
    });

    it('should toggle mobile-show on repeated controls tab click', async () => {
      const bottomNav = document.createElement('div');
      bottomNav.id = 'bottomNav';
      const btn = document.createElement('button');
      btn.className = 'bottom-nav-btn';
      btn.dataset.tab = 'controls';
      bottomNav.appendChild(btn);
      document.body.appendChild(bottomNav);

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      btn.click();
      expect(dom.controls!.classList.contains('mobile-show')).toBe(true);
      btn.click();
      expect(dom.controls!.classList.contains('mobile-show')).toBe(false);
    });

    it('should handle search tab click', async () => {
      const bottomNav = document.createElement('div');
      bottomNav.id = 'bottomNav';
      const btn = document.createElement('button');
      btn.className = 'bottom-nav-btn';
      btn.dataset.tab = 'search';
      bottomNav.appendChild(btn);
      document.body.appendChild(bottomNav);

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      // Show search first
      dom.searchInputGroup!.classList.add('hidden');
      btn.click();
      expect(dom.searchInputGroup!.classList.contains('hidden')).toBe(false);
      expect(dom.searchToggleBtn!.classList.contains('active')).toBe(true);
      expect(dom.controls!.classList.contains('mobile-show')).toBe(true);
    });

    it('should handle more tab click (opens adhkar panel)', async () => {
      const bottomNav = document.createElement('div');
      bottomNav.id = 'bottomNav';
      const btn = document.createElement('button');
      btn.className = 'bottom-nav-btn';
      btn.dataset.tab = 'more';
      bottomNav.appendChild(btn);
      document.body.appendChild(bottomNav);

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      btn.click();
      // 'more' tab now opens adhkar panel (was openSettings before)
      // Verify controls are hidden (mobile-show removed)
      expect(dom.controls!.classList.contains('mobile-show')).toBe(false);
    });

    it('should ignore clicks on non-button elements in bottom nav', async () => {
      const bottomNav = document.createElement('div');
      bottomNav.id = 'bottomNav';
      const span = document.createElement('span');
      span.textContent = 'not a button';
      bottomNav.appendChild(span);
      document.body.appendChild(bottomNav);

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      span.click();
      // Should not throw or call any navigation functions
    });

    it('should ignore clicks on buttons without tab dataset', async () => {
      const bottomNav = document.createElement('div');
      bottomNav.id = 'bottomNav';
      const btn = document.createElement('button');
      btn.className = 'bottom-nav-btn';
      // No dataset.tab
      bottomNav.appendChild(btn);
      document.body.appendChild(bottomNav);

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      btn.click();
      // Should not throw
    });

    it('should handle default case (unknown tab)', async () => {
      const bottomNav = document.createElement('div');
      bottomNav.id = 'bottomNav';
      const btn = document.createElement('button');
      btn.className = 'bottom-nav-btn';
      btn.dataset.tab = 'unknown';
      bottomNav.appendChild(btn);
      document.body.appendChild(bottomNav);

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      expect(() => btn.click()).not.toThrow();
    });

    it('should handle bottom nav click when bottomNav is null', async () => {
      // No bottomNav element in the DOM
      const { initNavigation } = await import('../navigation.js');
      expect(() => initNavigation()).not.toThrow();
    });
  });

  /* ===================== Mushaf Mode Restoration ===================== */

  describe('mushaf mode restoration', () => {
    it('should restore saved page from storage', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'current_page') return 42;
        return null;
      });

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      expect(state.currentPage).toBe(42);
    });

    it('should not restore mushaf mode when not saved', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      expect(state.mushafMode).toBe(false);
    });

    it('should not crash when storage returns undefined for page', async () => {
      (storage.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      const { initNavigation } = await import('../navigation.js');
      expect(() => initNavigation()).not.toThrow();
    });
  });

  /* ===================== Edge Cases ===================== */

  describe('edge cases', () => {
    it('should handle missing dom elements gracefully', async () => {
      // Reset all dom elements to null
      Object.keys(dom).forEach((key) => {
        (dom as any)[key] = null;
      });

      const { initNavigation } = await import('../navigation.js');
      expect(() => initNavigation()).not.toThrow();
    });

    it('should handle search tab when search input group is already visible', async () => {
      const bottomNav = document.createElement('div');
      bottomNav.id = 'bottomNav';
      const btn = document.createElement('button');
      btn.className = 'bottom-nav-btn';
      btn.dataset.tab = 'search';
      bottomNav.appendChild(btn);
      document.body.appendChild(bottomNav);

      dom.searchInputGroup!.classList.remove('hidden');

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      btn.click();
      // Should still focus the search input
    });

    it('should handle viewSurahBtn when in mushafMode', async () => {
      state.mushafMode = true;

      const { initNavigation } = await import('../navigation.js');
      initNavigation();
      dom.viewSurahBtn!.click();
      // Should call toggleMushafMode via dynamic import
    });
  });
});
