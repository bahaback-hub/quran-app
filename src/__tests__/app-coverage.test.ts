/**
 * Comprehensive tests for app.ts — Application Initialization Module.
 *
 * Covers:
 *   - initApp — full initialization flow (Phase 1, Phase 2, Phase 3)
 *   - initState — state reset
 *   - Re-exports from surah-loader
 *   - Last position restore
 *   - Language selector setting
 *   - Player collapsed state restore
 *   - Network banner events
 *   - Visibility change listener
 *   - Reading progress update
 *   - requestIdleCallback / setTimeout fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock values ───────────────────────────────────────────

const {
  mockStorageGet,
  mockStorageSet,
  mockDom,
  mockResetState,
  mockLoadSurah,
  mockLoadSurahList,
  mockBuildSurahOffsets,
  mockPopulateReciterSelect,
} = vi.hoisted(() => ({
  mockStorageGet: vi.fn(() => null),
  mockStorageSet: vi.fn(),
  mockDom: {
    langSelect: null as HTMLSelectElement | null,
    player: null as HTMLElement | null,
    surahContent: null as HTMLElement | null,
  },
  mockResetState: vi.fn(),
  mockLoadSurah: vi.fn(() => Promise.resolve()),
  mockLoadSurahList: vi.fn(() => Promise.resolve()),
  mockBuildSurahOffsets: vi.fn(),
  mockPopulateReciterSelect: vi.fn(),
}));

// ─── Mock ALL dependencies ─────────────────────────────────────────

vi.mock('../storage.js', () => ({
  storage: {
    get: (...args: unknown[]) => mockStorageGet(...args),
    set: (...args: unknown[]) => mockStorageSet(...args),
    remove: vi.fn(),
  },
}));

vi.mock('../dom.js', () => ({
  dom: mockDom,
  cacheDom: vi.fn(),
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
  loadingBar: { init: vi.fn(), hide: vi.fn(), show: vi.fn() },
}));

vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) => {
    let val = key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, arg);
    });
    return val;
  },
  getLang: vi.fn(() => 'ar'),
  applyTranslations: vi.fn(),
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

vi.mock('../state.js', () => ({
  state: {
    currentSurah: 1,
    surahData: null,
    currentAyahIndex: 0,
    isPlaying: false,
    playerCollapsed: false,
  },
  resetState: (...args: unknown[]) => mockResetState(...args),
  setState: vi.fn(),
  batch: vi.fn((fn: () => void) => fn()),
}));

vi.mock('../internal-state.js', () => ({
  setUpdateReadingProgress: vi.fn(),
  resetInternalState: vi.fn(),
}));

vi.mock('../prayer.js', () => ({
  startClock: vi.fn(),
  loadPrayerTimes: vi.fn(() => Promise.resolve()),
  loadUnderwrittenPrayerTable: vi.fn(() => Promise.resolve()),
  scheduleNextAzanCheck: vi.fn(),
}));

vi.mock('../favorites.js', () => ({
  loadFavorites: vi.fn(),
}));

vi.mock('../adhkar.js', () => ({
  initAdhkarState: vi.fn(),
  loadAdhkarSettings: vi.fn(),
  startAdhkarNotificationScheduler: vi.fn(),
}));

vi.mock('../audio.js', () => ({
  bindAudioEvents: vi.fn(),
  setLoadSurah: vi.fn(),
}));

vi.mock('../search-ui.js', () => ({
  loadFullQuranText: vi.fn(() => Promise.resolve()),
}));

vi.mock('../keyboard.js', () => ({
  initKeyboardShortcuts: vi.fn(),
}));

vi.mock('../capacitor-back.js', () => ({
  initCapacitorBackButton: vi.fn(),
}));

vi.mock('../navigation.js', () => ({
  initNavigation: vi.fn(),
}));

vi.mock('../a11y.js', () => ({
  initToggleSwitchAccessibility: vi.fn(),
  initReducedMotionDetection: vi.fn(),
}));

vi.mock('../surah-loader.js', () => ({
  loadSurah: (...args: unknown[]) => mockLoadSurah(...args),
  loadSurahList: (...args: unknown[]) => mockLoadSurahList(...args),
  buildSurahOffsets: (...args: unknown[]) => mockBuildSurahOffsets(...args),
  populateReciterSelect: (...args: unknown[]) => mockPopulateReciterSelect(...args),
  renderSurah: vi.fn(),
  highlightCurrentAyah: vi.fn(),
  updatePlayerInfo: vi.fn(),
  updateCurrentSurahLocale: vi.fn(),
}));

vi.mock('../tajweed-data.js', () => ({
  preloadTajweedIfNeeded: vi.fn(),
}));

vi.mock('../ui-extras.js', () => ({
  handleVisibilityChange: vi.fn(),
  updateNetworkBanner: vi.fn(),
  updateReadingProgress: vi.fn(),
  showContinueWidget: vi.fn(),
}));

vi.mock('../settings.js', () => ({
  restoreSettings: vi.fn(),
  initSystemThemeDetection: vi.fn(),
}));

vi.mock('../app-events.js', () => ({
  bindAllEvents: vi.fn(),
  initAutoPlayNextButton: vi.fn(),
}));

vi.mock('../overlays.js', () => ({
  injectOverlays: vi.fn(),
}));

// ─── Import module under test ──────────────────────────────────────

import { initApp } from '../app.js';
import * as appExports from '../app.js';

// ─── Tests ─────────────────────────────────────────────────────────

describe('app.ts — initApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset dom mock
    mockDom.langSelect = null;
    mockDom.player = null;

    // Default storage returns
    mockStorageGet.mockReturnValue(null);

    // Default loadSurah resolves
    mockLoadSurah.mockResolvedValue(undefined);
    mockLoadSurahList.mockResolvedValue(undefined);
  });

  // ─── Phase 1: Critical path ─────────────────────────────────────

  describe('Phase 1 — Critical Path', () => {
    it('should call resetState at the beginning', async () => {
      await initApp();
      expect(mockResetState).toHaveBeenCalled();
    });

    it('should call setLoadSurah with loadSurah', async () => {
      const { setLoadSurah } = await import('../audio.js');
      await initApp();
      expect(setLoadSurah).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should call injectOverlays before cacheDom', async () => {
      const { injectOverlays } = await import('../overlays.js');
      const { cacheDom } = await import('../dom.js');

      await initApp();

      const injectOrder = injectOverlays.mock.invocationCallOrder[0];
      const cacheOrder = cacheDom.mock.invocationCallOrder[0];
      expect(injectOrder).toBeLessThan(cacheOrder);
    });

    it('should call cacheDom', async () => {
      const { cacheDom } = await import('../dom.js');
      await initApp();
      expect(cacheDom).toHaveBeenCalled();
    });

    it('should call restoreSettings', async () => {
      const { restoreSettings } = await import('../settings.js');
      await initApp();
      expect(restoreSettings).toHaveBeenCalled();
    });

    it('should call initSystemThemeDetection', async () => {
      const { initSystemThemeDetection } = await import('../settings.js');
      await initApp();
      expect(initSystemThemeDetection).toHaveBeenCalled();
    });

    it('should call preloadTajweedIfNeeded', async () => {
      const { preloadTajweedIfNeeded } = await import('../tajweed-data.js');
      await initApp();
      expect(preloadTajweedIfNeeded).toHaveBeenCalled();
    });

    it('should call populateReciterSelect', async () => {
      await initApp();
      expect(mockPopulateReciterSelect).toHaveBeenCalled();
    });

    it('should call loadSurahList', async () => {
      await initApp();
      expect(mockLoadSurahList).toHaveBeenCalled();
    });

    it('should call buildSurahOffsets', async () => {
      await initApp();
      expect(mockBuildSurahOffsets).toHaveBeenCalled();
    });

    it('should load surah 1 when no last_position', async () => {
      mockStorageGet.mockImplementation((key: string) => {
        if (key === 'last_position') return null;
        if (key === 'player_collapsed') return null;
        return null;
      });

      await initApp();
      expect(mockLoadSurah).toHaveBeenCalledWith(1);
    });

    it('should restore last_position and load that surah', async () => {
      mockStorageGet.mockImplementation((key: string) => {
        if (key === 'last_position') return { surah: 5, ayahNumberInSurah: 10 };
        if (key === 'player_collapsed') return null;
        return null;
      });

      await initApp();
      expect(mockLoadSurah).toHaveBeenCalledWith(5, { startAyah: 10 });
    });

    it('should restore last_position with default startAyah', async () => {
      mockStorageGet.mockImplementation((key: string) => {
        if (key === 'last_position') return { surah: 3 };
        if (key === 'player_collapsed') return null;
        return null;
      });

      await initApp();
      expect(mockLoadSurah).toHaveBeenCalledWith(3, { startAyah: 1 });
    });

    it('should load surah 1 when last_position has no surah', async () => {
      mockStorageGet.mockImplementation((key: string) => {
        if (key === 'last_position') return { ayahNumberInSurah: 5 };
        if (key === 'player_collapsed') return null;
        return null;
      });

      await initApp();
      expect(mockLoadSurah).toHaveBeenCalledWith(1);
    });

    it('should call bindAudioEvents', async () => {
      const { bindAudioEvents } = await import('../audio.js');
      await initApp();
      expect(bindAudioEvents).toHaveBeenCalled();
    });
  });

  // ─── Phase 2: Event Bindings ────────────────────────────────────

  describe('Phase 2 — Event Bindings', () => {
    it('should call bindAllEvents', async () => {
      const { bindAllEvents } = await import('../app-events.js');
      await initApp();
      expect(bindAllEvents).toHaveBeenCalled();
    });

    it('should call initAutoPlayNextButton', async () => {
      const { initAutoPlayNextButton } = await import('../app-events.js');
      await initApp();
      expect(initAutoPlayNextButton).toHaveBeenCalled();
    });

    it('should call initNavigation', async () => {
      const { initNavigation } = await import('../navigation.js');
      await initApp();
      expect(initNavigation).toHaveBeenCalled();
    });

    it('should call initKeyboardShortcuts', async () => {
      const { initKeyboardShortcuts } = await import('../keyboard.js');
      await initApp();
      expect(initKeyboardShortcuts).toHaveBeenCalled();
    });

    it('should call initCapacitorBackButton', async () => {
      const { initCapacitorBackButton } = await import('../capacitor-back.js');
      await initApp();
      expect(initCapacitorBackButton).toHaveBeenCalled();
    });

    it('should call initToggleSwitchAccessibility', async () => {
      const { initToggleSwitchAccessibility } = await import('../a11y.js');
      await initApp();
      expect(initToggleSwitchAccessibility).toHaveBeenCalled();
    });

    it('should call initReducedMotionDetection', async () => {
      const { initReducedMotionDetection } = await import('../a11y.js');
      await initApp();
      expect(initReducedMotionDetection).toHaveBeenCalled();
    });

    it('should set langSelect value to current language', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      // Add an 'ar' option so the select can be set to that value
      const opt = document.createElement('option');
      opt.value = 'ar';
      opt.textContent = 'Arabic';
      select.appendChild(opt);
      mockDom.langSelect = select;

      await initApp();

      expect(select.value).toBe('ar');
    });

    it('should handle null langSelect gracefully', async () => {
      mockDom.langSelect = null;
      await initApp();
    });

    it('should add app:langchange event listener', async () => {
      const addEventSpy = vi.spyOn(window, 'addEventListener');

      await initApp();

      expect(addEventSpy).toHaveBeenCalledWith('app:langchange', expect.any(Function));
      addEventSpy.mockRestore();
    });

    it('should restore player_collapsed=false by removing collapsed class', async () => {
      const player = document.createElement('div');
      player.classList.add('collapsed');
      mockDom.player = player;

      mockStorageGet.mockImplementation((key: string) => {
        if (key === 'player_collapsed') return false;
        if (key === 'last_position') return null;
        return null;
      });

      await initApp();

      expect(player.classList.contains('collapsed')).toBe(false);
    });

    it('should not remove collapsed class when player_collapsed is true', async () => {
      const player = document.createElement('div');
      player.classList.add('collapsed');
      mockDom.player = player;

      mockStorageGet.mockImplementation((key: string) => {
        if (key === 'player_collapsed') return true;
        if (key === 'last_position') return null;
        return null;
      });

      await initApp();

      expect(player.classList.contains('collapsed')).toBe(true);
    });

    it('should handle null player element when restoring collapsed state', async () => {
      mockDom.player = null;
      mockStorageGet.mockImplementation((key: string) => {
        if (key === 'player_collapsed') return false;
        if (key === 'last_position') return null;
        return null;
      });

      await initApp();
    });

    it('should add online/offline event listeners', async () => {
      const addEventSpy = vi.spyOn(window, 'addEventListener');

      await initApp();

      expect(addEventSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      addEventSpy.mockRestore();
    });

    it('should call updateNetworkBanner', async () => {
      const { updateNetworkBanner } = await import('../ui-extras.js');
      await initApp();
      expect(updateNetworkBanner).toHaveBeenCalled();
    });

    it('should add visibilitychange event listener', async () => {
      const addEventSpy = vi.spyOn(document, 'addEventListener');

      await initApp();

      expect(addEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      addEventSpy.mockRestore();
    });

    it('should call setUpdateReadingProgress', async () => {
      const { setUpdateReadingProgress } = await import('../internal-state.js');
      await initApp();
      expect(setUpdateReadingProgress).toHaveBeenCalled();
    });

    it('should add scroll event listener for reading progress', async () => {
      const addEventSpy = vi.spyOn(window, 'addEventListener');

      await initApp();

      expect(addEventSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
      addEventSpy.mockRestore();
    });

    it('should call updateReadingProgress', async () => {
      const { updateReadingProgress } = await import('../ui-extras.js');
      await initApp();
      expect(updateReadingProgress).toHaveBeenCalled();
    });
  });

  // ─── Phase 3: Deferred init ─────────────────────────────────────

  describe('Phase 3 — Deferred Non-Critical Init', () => {
    it('should call loadingBar.init and hide via requestIdleCallback', async () => {
      const { loadingBar } = await import('../ui.js');
      await initApp();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadingBar.init).toHaveBeenCalled();
      expect(loadingBar.hide).toHaveBeenCalled();
    });

    it('should call initAdhkarState and loadAdhkarSettings', async () => {
      const { initAdhkarState, loadAdhkarSettings } = await import('../adhkar.js');
      await initApp();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(initAdhkarState).toHaveBeenCalled();
      expect(loadAdhkarSettings).toHaveBeenCalled();
    });

    it('should call loadFavorites', async () => {
      const { loadFavorites } = await import('../favorites.js');
      await initApp();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadFavorites).toHaveBeenCalled();
    });

    it('should call startClock and scheduleNextAzanCheck', async () => {
      const { startClock, scheduleNextAzanCheck } = await import('../prayer.js');
      await initApp();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(startClock).toHaveBeenCalled();
      expect(scheduleNextAzanCheck).toHaveBeenCalled();
    });
  });

  // ─── Re-exports ─────────────────────────────────────────────────

  describe('Re-exports from surah-loader', () => {
    it('should export loadSurah', () => {
      expect(typeof appExports.loadSurah).toBe('function');
    });

    it('should export loadSurahList', () => {
      expect(typeof appExports.loadSurahList).toBe('function');
    });

    it('should export buildSurahOffsets', () => {
      expect(typeof appExports.buildSurahOffsets).toBe('function');
    });

    it('should export renderSurah', () => {
      expect(typeof appExports.renderSurah).toBe('function');
    });

    it('should export highlightCurrentAyah', () => {
      expect(typeof appExports.highlightCurrentAyah).toBe('function');
    });

    it('should export updatePlayerInfo', () => {
      expect(typeof appExports.updatePlayerInfo).toBe('function');
    });
  });

  // ─── Offline mode ───────────────────────────────────────────────

  describe('Offline mode handling', () => {
    it('should await fullQuranPromise when offline', async () => {
      const { loadFullQuranText } = await import('../search-ui.js');

      // Simulate offline
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      await initApp();

      expect(loadFullQuranText).toHaveBeenCalled();

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });
  });

  // ─── app:langchange handler ─────────────────────────────────────

  describe('app:langchange handler', () => {
    it('should update keyboard hint element text', async () => {
      const hintEl = document.createElement('div');
      hintEl.id = 'keyboardHint';
      hintEl.textContent = 'some text';
      document.body.appendChild(hintEl);

      await initApp();

      window.dispatchEvent(new CustomEvent('app:langchange'));

      expect(hintEl.textContent).toBe('');

      document.body.removeChild(hintEl);
    });

    it('should handle missing keyboard hint element', async () => {
      await initApp();

      expect(() => window.dispatchEvent(new CustomEvent('app:langchange'))).not.toThrow();
    });
  });
});
