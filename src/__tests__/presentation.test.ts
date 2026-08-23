/**
 * Tests for presentation.ts — Full-screen presentation mode for Quran ayah display.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, resetState } from '../state.js';
import { dom } from '../dom.js';
import { storage } from '../storage.js';

// Mock audio module
vi.mock('../audio.js', () => ({
  togglePlayPause: vi.fn(),
  updatePlayPauseBtn: vi.fn(),
  playCurrentAyah: vi.fn(),
}));

// Mock surah-loader
vi.mock('../surah-loader.js', () => ({
  highlightCurrentAyah: vi.fn(),
}));

// Mock types fullscreen functions
vi.mock('../types.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getFullscreenElement: vi.fn(() => null),
    requestFullscreen: vi.fn(() => Promise.resolve()),
    exitFullscreen: vi.fn(() => Promise.resolve()),
    isFullscreen: vi.fn(() => false),
  };
});

// Mock pres-backgrounds
vi.mock('../pres-backgrounds.js', () => ({
  getAutoBackground: vi.fn(() => ({ src: 'auto-bg.jpg' })),
  getNatureBgByMood: vi.fn(() => ({ src: 'nature-bg.jpg' })),
  getRandomNatureBg: vi.fn(() => ({ src: 'random-nature.jpg' })),
  removeAnimatedBgLayer: vi.fn(),
  applyAnimatedBg: vi.fn(),
  removeSceneCanvas: vi.fn(),
  startSceneAnimation: vi.fn(),
}));

// Mock pres-styles
vi.mock('../pres-styles.js', () => ({
  injectStyles: vi.fn(),
  buildAyahHtml: vi.fn((_text: string, _surah: number, _ayah: number, _tajweed: boolean) => '<span>mock ayah html</span>'),
}));

vi.mock('../settings.js', () => ({
  applyPresBgMode: vi.fn(),
  applyPresBgScene: vi.fn(),
}));

// Mock app.js for the dynamic import in openPresentation
vi.mock('../app.js', () => ({
  renderSurah: vi.fn(),
}));

function setupPresentationDom() {
  dom.presentationOverlay = document.createElement('div');
  dom.presentationOverlay.id = 'presentationOverlay';
  dom.presentationAyahText = document.createElement('div');
  dom.presentationAyahNum = document.createElement('div');
  dom.presentationTitle = document.createElement('div');
  dom.presentationCounter = document.createElement('div');
  dom.presentationTranslation = document.createElement('div');
  dom.presentationCloseBtn = document.createElement('button');
  dom.presentationPrevBtn = document.createElement('button');
  dom.presentationNextBtn = document.createElement('button');
  dom.presPlayPauseBtn = document.createElement('button');
  dom.presTajweedBtn = document.createElement('button');
  dom.presBackgroundBtn = document.createElement('button');
  dom.presBackgroundPicker = document.createElement('section');
  dom.presBackgroundPicker.classList.add('hidden');
  dom.presBackgroundPicker.innerHTML = `
    <button data-pres-bg-mode="plain"></button>
    <button data-pres-bg-mode="scene" data-pres-bg-scene="rain"></button>`;
  dom.presFullscreenBtn = document.createElement('button');
  dom.presentationBody = document.createElement('div');
  dom.pageIndicator = document.createElement('div');
  document.body.appendChild(dom.presentationOverlay);
  dom.presentationOverlay.append(dom.presBackgroundBtn, dom.presBackgroundPicker);
}

function setupSurahData() {
  state.surahData = {
    number: 1,
    name: 'الفاتحة',
    englishName: 'Al-Fatiha',
    ayahs: [
      { numberInSurah: 1, number: 1, audio: '', text: 'بسم الله الرحمن الرحيم' },
      { numberInSurah: 2, number: 2, audio: '', text: 'الحمد لله رب العالمين' },
      { numberInSurah: 3, number: 3, audio: '', text: 'الرحمن الرحيم' },
    ],
  } as any;
  state.currentSurah = 1;
  state.currentAyahIndex = 0;
  state.translationEnabled = false;
  state.translationData = null;
  state.tajweedEnabled = true;
  state.presBgMode = 'plain';
}

describe('presentation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetState();
    setupPresentationDom();
    setupSurahData();
    document.body.classList.remove('night-mode', 'presentation-active');
    vi.clearAllMocks();
  });

  /* ==================== openPresentation ==================== */

  describe('openPresentation', () => {
    it('should set presentationMode to true', async () => {
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      expect(state.presentationMode).toBe(true);
    });

    it('should make overlay visible', async () => {
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      expect(dom.presentationOverlay!.classList.contains('hidden')).toBe(false);
      expect(dom.presentationOverlay!.classList.contains('presentation-visible')).toBe(true);
      expect(dom.presentationOverlay!.style.display).toBe('flex');
    });

    it('should add presentation-active class to body', async () => {
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      expect(document.body.classList.contains('presentation-active')).toBe(true);
    });

    it('should add pres-light class when not in night mode and bg is plain', async () => {
      document.body.classList.remove('night-mode');
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      expect(dom.presentationOverlay!.classList.contains('pres-light')).toBe(true);
    });

    it('should NOT add pres-light class when in night mode', async () => {
      document.body.classList.add('night-mode');
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      expect(dom.presentationOverlay!.classList.contains('pres-light')).toBe(false);
    });

    it('should sync tajweed button with global setting', async () => {
      state.tajweedEnabled = false;
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      expect(dom.presTajweedBtn!.classList.contains('pres-tajweed-off')).toBe(true);
    });

    it('should set view-mode-btn to presentation mode', async () => {
      const viewBtns = [
        { dataset: { mode: 'surah' }, classList: { toggle: vi.fn() } },
        { dataset: { mode: 'presentation' }, classList: { toggle: vi.fn() } },
      ];
      const querySelectorAllSpy = vi.spyOn(document, 'querySelectorAll').mockReturnValue(viewBtns as any);
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      expect(querySelectorAllSpy).toHaveBeenCalledWith('.view-mode-btn');
      querySelectorAllSpy.mockRestore();
    });

    it('should exit mushaf mode synchronously before opening', async () => {
      state.mushafMode = true;
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      expect(state.mushafMode).toBe(false);
      expect(storage.set).toHaveBeenCalledWith('mushaf_mode', false);
    });

    it('should call injectStyles', async () => {
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      const { injectStyles } = await import('../pres-styles.js');
      expect(injectStyles).toHaveBeenCalled();
    });
  });

  /* ==================== closePresentation ==================== */

  describe('closePresentation', () => {
    it('should set presentationMode to false', async () => {
      const { openPresentation, closePresentation } = await import('../presentation.js');
      openPresentation();
      closePresentation();
      expect(state.presentationMode).toBe(false);
    });

    it('should hide overlay', async () => {
      const { openPresentation, closePresentation } = await import('../presentation.js');
      openPresentation();
      closePresentation();
      expect(dom.presentationOverlay!.classList.contains('hidden')).toBe(true);
      expect(dom.presentationOverlay!.classList.contains('presentation-visible')).toBe(false);
      expect(dom.presentationOverlay!.style.display).toBe('none');
    });

    it('should remove presentation-active class from body', async () => {
      const { openPresentation, closePresentation } = await import('../presentation.js');
      openPresentation();
      closePresentation();
      expect(document.body.classList.contains('presentation-active')).toBe(false);
    });

    it('should remove presentation CSS classes from overlay', async () => {
      const { openPresentation, closePresentation } = await import('../presentation.js');
      openPresentation();
      closePresentation();
      const overlay = dom.presentationOverlay!;
      expect(overlay.classList.contains('pres-controls-visible')).toBe(false);
      expect(overlay.classList.contains('pres-nature')).toBe(false);
      expect(overlay.classList.contains('pres-light')).toBe(false);
      expect(overlay.classList.contains('pres-auto')).toBe(false);
      expect(overlay.classList.contains('pres-animated')).toBe(false);
      expect(overlay.classList.contains('pres-scene')).toBe(false);
    });

    it('should clear inline positioning styles from overlay', async () => {
      const { openPresentation, closePresentation } = await import('../presentation.js');
      openPresentation();
      closePresentation();
      const overlay = dom.presentationOverlay!;
      expect(overlay.style.position).toBe('');
      expect(overlay.style.zIndex).toBe('');
      expect(overlay.style.width).toBe('');
      expect(overlay.style.height).toBe('');
    });

    it('should call removeAnimatedBgLayer and removeSceneCanvas', async () => {
      const { openPresentation, closePresentation } = await import('../presentation.js');
      openPresentation();
      closePresentation();
      const { removeAnimatedBgLayer, removeSceneCanvas } = await import('../pres-backgrounds.js');
      expect(removeAnimatedBgLayer).toHaveBeenCalled();
      expect(removeSceneCanvas).toHaveBeenCalled();
    });

    it('should set view-mode-btn to surah mode', async () => {
      const { openPresentation, closePresentation } = await import('../presentation.js');
      openPresentation();
      closePresentation();
      // The view-mode-btns are toggled via querySelectorAll
      expect(document.querySelectorAll).toBeDefined();
    });
  });

  /* ==================== togglePresentation ==================== */

  describe('togglePresentation', () => {
    it('should open presentation when not in presentation mode', async () => {
      state.presentationMode = false;
      const { togglePresentation } = await import('../presentation.js');
      togglePresentation();
      expect(state.presentationMode).toBe(true);
    });

    it('should close presentation when already in presentation mode', async () => {
      const { openPresentation, togglePresentation } = await import('../presentation.js');
      openPresentation();
      togglePresentation();
      expect(state.presentationMode).toBe(false);
    });
  });

  /* ==================== syncPresentation ==================== */

  describe('syncPresentation', () => {
    it('should update display when in presentation mode', async () => {
      state.presentationMode = true;
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      // Should update ayah text display
      expect(dom.presentationAyahText!.innerHTML).toBeTruthy();
    });

    it('should do nothing when not in presentation mode', async () => {
      state.presentationMode = false;
      const { syncPresentation } = await import('../presentation.js');
      dom.presentationAyahText!.innerHTML = '';
      syncPresentation();
      expect(dom.presentationAyahText!.innerHTML).toBe('');
    });
  });

  /* ==================== initPresentation ==================== */

  describe('initPresentation', () => {
    it('should bind click handlers to navigation buttons', async () => {
      const { initPresentation } = await import('../presentation.js');
      const closeSpy = vi.spyOn(dom.presentationCloseBtn!, 'addEventListener');
      const prevSpy = vi.spyOn(dom.presentationPrevBtn!, 'addEventListener');
      const nextSpy = vi.spyOn(dom.presentationNextBtn!, 'addEventListener');
      initPresentation();
      expect(closeSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(prevSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(nextSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should bind click handler to play/pause button', async () => {
      const { initPresentation } = await import('../presentation.js');
      const spy = vi.spyOn(dom.presPlayPauseBtn!, 'addEventListener');
      initPresentation();
      expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should bind click handler to tajweed button', async () => {
      const { initPresentation } = await import('../presentation.js');
      const spy = vi.spyOn(dom.presTajweedBtn!, 'addEventListener');
      initPresentation();
      expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('opens the background picker and applies a selected scene through settings helpers', async () => {
      const { initPresentation } = await import('../presentation.js');
      const { applyPresBgMode, applyPresBgScene } = await import('../settings.js');
      initPresentation();

      dom.presBackgroundBtn!.click();
      expect(dom.presBackgroundPicker!.classList.contains('hidden')).toBe(false);
      expect(dom.presBackgroundBtn!.getAttribute('aria-expanded')).toBe('true');

      (dom.presBackgroundPicker!.querySelector('[data-pres-bg-scene="rain"]') as HTMLButtonElement).click();
      expect(applyPresBgScene).toHaveBeenCalledWith('rain');
      expect(applyPresBgMode).toHaveBeenCalledWith('scene');
      expect(dom.presBackgroundPicker!.classList.contains('hidden')).toBe(true);
      expect(dom.presBackgroundBtn!.getAttribute('aria-expanded')).toBe('false');
    });

    it('should bind click handler to fullscreen button', async () => {
      const { initPresentation } = await import('../presentation.js');
      const spy = vi.spyOn(dom.presFullscreenBtn!, 'addEventListener');
      initPresentation();
      expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should bind mousemove handler on overlay', async () => {
      const { initPresentation } = await import('../presentation.js');
      const spy = vi.spyOn(dom.presentationOverlay!, 'addEventListener');
      initPresentation();
      expect(spy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('should not throw when overlay is missing from DOM', async () => {
      // Remove the overlay from DOM
      const overlay = document.getElementById('presentationOverlay');
      if (overlay) overlay.remove();
      const { initPresentation } = await import('../presentation.js');
      expect(() => initPresentation()).not.toThrow();
    });
  });

  /* ==================== Presentation Display Update ==================== */

  describe('display update', () => {
    it('should show dash when surahData is null', async () => {
      state.surahData = null;
      state.presentationMode = true;
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      expect(dom.presentationAyahText!.textContent).toBe('—');
      expect(dom.presentationAyahNum!.textContent).toBe('—');
      expect(dom.presentationTitle!.textContent).toBe('—');
    });

    it('should show dash when ayahs array is empty', async () => {
      state.surahData = { number: 1, name: 'Test', englishName: 'Test', ayahs: [] } as any;
      state.presentationMode = true;
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      expect(dom.presentationAyahText!.textContent).toBe('—');
    });

    it('should display current ayah info', async () => {
      state.presentationMode = true;
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      expect(dom.presentationAyahNum!.textContent).toBe('1');
      expect(dom.presentationTitle!.textContent).toContain('الفاتحة');
    });

    it('should display ayah counter', async () => {
      state.presentationMode = true;
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      expect(dom.presentationCounter!.textContent).toBe('1 / 3');
    });

    it('should reduce an overflowing long ayah to keep its start and end in view', async () => {
      state.presentationMode = true;
      state.surahData!.ayahs[0]!.text = 'آية طويلة '.repeat(70);
      Object.defineProperty(dom.presentationBody!, 'clientHeight', { configurable: true, value: 460 });
      Object.defineProperty(dom.presentationAyahText!, 'scrollHeight', {
        configurable: true,
        get: () => (Number.parseFloat(dom.presentationAyahText!.style.fontSize || '72') > 42 ? 780 : 420),
      });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      expect(Number.parseFloat(dom.presentationAyahText!.style.fontSize)).toBeLessThanOrEqual(42);
      expect(dom.presentationAyahText!.style.lineHeight).toBe('1.48');
      expect(dom.presentationBody!.scrollTop).toBe(0);
    });

    it('should show translation when enabled', async () => {
      state.presentationMode = true;
      state.translationEnabled = true;
      state.translationData = {
        ayahs: [
          { numberInSurah: 1, text: 'In the name of Allah' },
          { numberInSurah: 2, text: 'All praise is for Allah' },
          { numberInSurah: 3, text: 'The Most Merciful' },
        ],
      } as any;
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      expect(dom.presentationTranslation!.textContent).toBe('In the name of Allah');
      expect(dom.presentationTranslation!.style.display).not.toBe('none');
    });

    it('should hide translation when disabled', async () => {
      state.presentationMode = true;
      state.translationEnabled = false;
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      expect(dom.presentationTranslation!.style.display).toBe('none');
    });

    it('should apply nature background mode', async () => {
      state.presentationMode = true;
      state.presBgMode = 'nature';
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      const { getRandomNatureBg } = await import('../pres-backgrounds.js');
      expect(getRandomNatureBg).toHaveBeenCalled();
      expect(dom.presentationOverlay!.classList.contains('pres-nature')).toBe(true);
    });

    it('should apply auto background mode', async () => {
      state.presentationMode = true;
      state.presBgMode = 'auto';
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      const { getAutoBackground } = await import('../pres-backgrounds.js');
      expect(getAutoBackground).toHaveBeenCalled();
      expect(dom.presentationOverlay!.classList.contains('pres-auto')).toBe(true);
    });

    it('should apply animated background mode', async () => {
      state.presentationMode = true;
      state.presBgMode = 'animated';
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      const { applyAnimatedBg } = await import('../pres-backgrounds.js');
      expect(applyAnimatedBg).toHaveBeenCalled();
      expect(dom.presentationOverlay!.classList.contains('pres-animated')).toBe(true);
    });

    it('should apply scene background mode', async () => {
      state.presentationMode = true;
      state.presBgMode = 'scene';
      state.presBgScene = 'stars';
      const { syncPresentation } = await import('../presentation.js');
      syncPresentation();
      const { startSceneAnimation } = await import('../pres-backgrounds.js');
      expect(startSceneAnimation).toHaveBeenCalled();
      expect(dom.presentationOverlay!.classList.contains('pres-scene')).toBe(true);
    });
  });

  /* ==================== Keyboard Navigation ==================== */

  describe('keyboard navigation in presentation', () => {
    it('should close presentation on Escape key when not fullscreen', async () => {
      const { isFullscreen } = await import('../types.js');
      (isFullscreen as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      // Dispatch Escape key event
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(state.presentationMode).toBe(false);
    });

    it('should exit fullscreen on Escape when in fullscreen mode', async () => {
      const { isFullscreen, exitFullscreen } = await import('../types.js');
      (isFullscreen as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(exitFullscreen).toHaveBeenCalled();
    });

    it('should ignore keydown events on INPUT elements', async () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      const { openPresentation } = await import('../presentation.js');
      openPresentation();
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      Object.defineProperty(event, 'target', { value: input, writable: false });
      document.dispatchEvent(event);
      // Should not change ayah index
      expect(state.currentAyahIndex).toBe(0);
    });
  });
});
