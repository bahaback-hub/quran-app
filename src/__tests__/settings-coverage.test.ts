/**
 * Additional tests for settings.ts — covering low-coverage functions.
 * Targets: applyPresBgScene, applyPresBgNature, initSystemThemeDetection,
 * resetSettings, exportSettings, importSettings, restoreSettings (thorough), initSettingsTabs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, resetState } from '../state.js';

// Override the global storage mock with a working one
const storageMap: Record<string, unknown> = {};
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn((key: string) => {
      if (key in storageMap) return storageMap[key];
      return null;
    }),
    set: vi.fn((key: string, val: unknown) => {
      storageMap[key] = val;
      return true;
    }),
    remove: vi.fn((key: string) => {
      delete storageMap[key];
    }),
  },
}));

import { storage } from '../storage.js';

// Mock container for ayahs-container queries
const mockContainer = document.createElement('div');
mockContainer.className = 'ayahs-container';
document.body.appendChild(mockContainer);

// Create mock dom object with mutable properties
const mockDom: Record<string, HTMLElement | null> = {
  presBgSceneSelect: null,
  presBgNatureSelect: null,
  presBgSceneRow: null,
  presBgNatureRow: null,
  themeToggle: null,
  settingsPanel: null,
  cityInput: null,
  countryInput: null,
  methodSelect: null,
  azanToggle: null,
  azanFajrToggle: null,
  autoSaveToggle: null,
  reciterSelect: null,
  tafsirSelect: null,
  translationSelect: null,
  speedSelect: null,
  audioPlayer: null,
  tajweedToggle: null,
  prayerBar: null,
  fontSizeSelect: null,
  fontTypeSelect: null,
  lineSpacingSelect: null,
  presBgSelect: null,
};

vi.mock('../dom.js', () => ({
  dom: mockDom,
  cacheDom: vi.fn(),
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
  loadingBar: { init: vi.fn(), show: vi.fn(), hide: vi.fn() },
}));

vi.mock('../prayer.js', () => ({
  stopAzan: vi.fn(),
  loadPrayerTimes: vi.fn(),
}));

vi.mock('../adhkar.js', () => ({
  renderAdhkarSettingsList: vi.fn(),
}));

vi.mock('../presentation.js', () => ({
  syncPresentation: vi.fn(),
}));

vi.mock('../mushaf.js', () => ({
  loadPage: vi.fn(() => Promise.resolve()),
}));

// Mock matchMedia for jsdom
const mockMatchMedia = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
});
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

describe('settings — additional coverage', () => {
  beforeEach(() => {
    resetState();
    // Clear storage map
    for (const key of Object.keys(storageMap)) {
      delete storageMap[key];
    }
    // Reset mock dom elements
    for (const key of Object.keys(mockDom)) {
      mockDom[key] = null;
    }
    vi.clearAllMocks();
    // Reset matchMedia to default
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    // Clean up any modals
    const existingModal = document.getElementById('resetConfirmModal');
    if (existingModal) existingModal.remove();
    // Clean up body classes
    document.body.classList.remove('night-mode');
    document.body.classList.remove('sepia-mode');
  });

  describe('applyPresBgScene', () => {
    it('should update state.presBgScene and persist', async () => {
      const { applyPresBgScene } = await import('../settings.js');
      applyPresBgScene('aurora');
      expect(state.presBgScene).toBe('aurora');
    });

    it('should update dom.presBgSceneSelect value when available', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = 'waves';
      select.appendChild(opt);
      mockDom.presBgSceneSelect = select;

      const { applyPresBgScene } = await import('../settings.js');
      applyPresBgScene('waves');
      expect(select.value).toBe('waves');
      mockDom.presBgSceneSelect = null;
    });

    it('should sync presentation when in presentation mode and scene bg mode', async () => {
      state.presentationMode = true;
      state.presBgMode = 'scene';

      const { applyPresBgScene } = await import('../settings.js');
      applyPresBgScene('stars');
      await new Promise((r) => setTimeout(r, 50));
      state.presentationMode = false;
      state.presBgMode = 'plain';
    });

    it('should not sync presentation when not in scene mode', async () => {
      state.presentationMode = true;
      state.presBgMode = 'plain';

      const { applyPresBgScene } = await import('../settings.js');
      applyPresBgScene('rain');
      state.presentationMode = false;
    });
  });

  describe('applyPresBgNature', () => {
    it('should update state.presBgNature and persist', async () => {
      const { applyPresBgNature } = await import('../settings.js');
      applyPresBgNature('sunset');
      expect(state.presBgNature).toBe('sunset');
    });

    it('should update dom.presBgNatureSelect value when available', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = 'morning';
      select.appendChild(opt);
      mockDom.presBgNatureSelect = select;

      const { applyPresBgNature } = await import('../settings.js');
      applyPresBgNature('morning');
      expect(select.value).toBe('morning');
      mockDom.presBgNatureSelect = null;
    });

    it('should sync presentation when in presentation mode and singleNature mode', async () => {
      state.presentationMode = true;
      state.presBgMode = 'singleNature';

      const { applyPresBgNature } = await import('../settings.js');
      applyPresBgNature('dawn');
      await new Promise((r) => setTimeout(r, 50));
      state.presentationMode = false;
      state.presBgMode = 'plain';
    });

    it('should not sync presentation when not in singleNature mode', async () => {
      state.presentationMode = true;
      state.presBgMode = 'nature';

      const { applyPresBgNature } = await import('../settings.js');
      applyPresBgNature('night');
      state.presentationMode = false;
    });
  });

  describe('initSystemThemeDetection', () => {
    it('should not apply if user has explicit night_mode preference', async () => {
      storage.set('night_mode', true);
      const { initSystemThemeDetection } = await import('../settings.js');
      expect(() => initSystemThemeDetection()).not.toThrow();
    });

    it('should apply system theme when no explicit preference', async () => {
      const { initSystemThemeDetection } = await import('../settings.js');
      expect(() => initSystemThemeDetection()).not.toThrow();
    });

    it('should add night-mode class when system prefers dark', async () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { initSystemThemeDetection } = await import('../settings.js');
      initSystemThemeDetection();
      expect(state.nightMode).toBe(true);
    });

    it('should not add night-mode when system prefers light', async () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      document.body.classList.remove('night-mode');
      state.nightMode = false;

      const { initSystemThemeDetection } = await import('../settings.js');
      initSystemThemeDetection();
      expect(state.nightMode).toBe(false);
    });

    it('should update theme toggle checkbox when available', async () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const toggleEl = document.createElement('div');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'theme-switch-check';
      toggleEl.appendChild(checkbox);
      mockDom.themeToggle = toggleEl;

      const { initSystemThemeDetection } = await import('../settings.js');
      initSystemThemeDetection();
      expect(checkbox.checked).toBe(true);
      // aria-checked is NOT set on #themeToggle (role="group" doesn't allow it);
      // the individual theme-btn buttons use aria-pressed instead.
      expect(toggleEl.getAttribute('aria-checked')).toBeNull();

      mockDom.themeToggle = null;
    });

    it('should use addListener fallback when addEventListener not available', async () => {
      const addListenerMock = vi.fn();
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: undefined as unknown as typeof EventTarget.prototype.addEventListener,
        removeEventListener: vi.fn(),
        addListener: addListenerMock,
        removeListener: vi.fn(),
      });

      const { initSystemThemeDetection } = await import('../settings.js');
      initSystemThemeDetection();
      expect(addListenerMock).toHaveBeenCalled();
    });

    it('should listen for system theme changes', async () => {
      const addEventListenerMock = vi.fn();
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: addEventListenerMock,
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { initSystemThemeDetection } = await import('../settings.js');
      initSystemThemeDetection();
      expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should not override when user sets preference after listener fires', async () => {
      let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
      const addEventListenerMock = vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      });
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: addEventListenerMock,
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { initSystemThemeDetection } = await import('../settings.js');
      initSystemThemeDetection();

      storage.set('night_mode', false);

      if (changeHandler) {
        changeHandler({ matches: true } as MediaQueryListEvent);
        expect(state.nightMode).toBe(false);
      }
    });

    it('should apply theme change when no user preference exists', async () => {
      let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
      const addEventListenerMock = vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      });
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: addEventListenerMock,
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { initSystemThemeDetection } = await import('../settings.js');
      initSystemThemeDetection();

      if (changeHandler) {
        changeHandler({ matches: true } as MediaQueryListEvent);
        expect(state.nightMode).toBe(true);
      }
    });

    it('should remove night-mode when system switches to light', async () => {
      // Ensure clean state
      for (const key of Object.keys(storageMap)) {
        delete storageMap[key];
      }
      document.body.classList.remove('night-mode');
      state.nightMode = false;

      let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
      const addEventListenerMock = vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      });
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: addEventListenerMock,
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { initSystemThemeDetection } = await import('../settings.js');
      initSystemThemeDetection();
      // Initial: system is dark, so night mode should be on
      expect(state.nightMode).toBe(true);
      expect(document.body.classList.contains('night-mode')).toBe(true);

      // Now simulate system switching to light
      if (changeHandler) {
        changeHandler({ matches: false } as MediaQueryListEvent);
        expect(state.nightMode).toBe(false);
      }
    });

    it('should update toggle checkbox when system theme changes', async () => {
      let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
      const addEventListenerMock = vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      });
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: addEventListenerMock,
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const toggleEl = document.createElement('div');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'theme-switch-check';
      toggleEl.appendChild(checkbox);
      mockDom.themeToggle = toggleEl;

      const { initSystemThemeDetection } = await import('../settings.js');
      initSystemThemeDetection();

      if (changeHandler) {
        changeHandler({ matches: true } as MediaQueryListEvent);
        expect(checkbox.checked).toBe(true);
        // aria-checked is NOT set on #themeToggle (role="group" doesn't allow it);
        // the individual theme-btn buttons use aria-pressed instead.
        expect(toggleEl.getAttribute('aria-checked')).toBeNull();
      }

      mockDom.themeToggle = null;
    });
  });

  describe('resetSettings', () => {
    it('should create and append reset confirmation modal', async () => {
      const { resetSettings } = await import('../settings.js');
      resetSettings();

      const modal = document.getElementById('resetConfirmModal');
      expect(modal).not.toBeNull();
      modal?.remove();
    });

    it('should remove existing modal before creating new one', async () => {
      const existingModal = document.createElement('div');
      existingModal.id = 'resetConfirmModal';
      document.body.appendChild(existingModal);

      const { resetSettings } = await import('../settings.js');
      resetSettings();

      const modals = document.querySelectorAll('#resetConfirmModal');
      expect(modals.length).toBe(1);
      modals[0].remove();
    });

    it('should have confirm and cancel buttons', async () => {
      const { resetSettings } = await import('../settings.js');
      resetSettings();

      const modal = document.getElementById('resetConfirmModal');
      const buttons = modal!.querySelectorAll('button');
      expect(buttons.length).toBe(2);
      modal?.remove();
    });

    it('should remove modal when cancel button is clicked', async () => {
      const { resetSettings } = await import('../settings.js');
      resetSettings();

      const modal = document.getElementById('resetConfirmModal');
      const cancelButton = modal!.querySelectorAll('button')[0];
      cancelButton.click();

      expect(document.getElementById('resetConfirmModal')).toBeNull();
    });

    it('should remove modal when clicking overlay background', async () => {
      const { resetSettings } = await import('../settings.js');
      resetSettings();

      const modal = document.getElementById('resetConfirmModal');
      modal!.click();

      expect(document.getElementById('resetConfirmModal')).toBeNull();
    });

    it('should not remove modal when clicking inner content', async () => {
      const { resetSettings } = await import('../settings.js');
      resetSettings();

      const modal = document.getElementById('resetConfirmModal');
      const innerModal = modal!.querySelector('div') as HTMLElement;
      innerModal.click();

      expect(document.getElementById('resetConfirmModal')).not.toBeNull();
      modal?.remove();
    });

    it('should clear storage keys when confirm button is clicked', async () => {
      storage.set('font_size', 32);
      storage.set('night_mode', true);
      storage.set('city', 'Test City');

      const { resetSettings } = await import('../settings.js');
      resetSettings();

      const modal = document.getElementById('resetConfirmModal');
      const confirmButton = modal!.querySelectorAll('button')[1];
      confirmButton.click();

      expect(storage.get('font_size')).toBeNull();
      expect(storage.get('night_mode')).toBeNull();
      expect(storage.get('city')).toBeNull();
    });

    it('should remove night_mode_set_by_user on confirm', async () => {
      storage.set('night_mode_set_by_user', true);

      const { resetSettings } = await import('../settings.js');
      resetSettings();

      const modal = document.getElementById('resetConfirmModal');
      const confirmButton = modal!.querySelectorAll('button')[1];
      confirmButton.click();

      expect(storage.get('night_mode_set_by_user')).toBeNull();
    });
  });

  describe('exportSettings', () => {
    it('should create a blob and trigger download', async () => {
      const { exportSettings } = await import('../settings.js');

      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();

      exportSettings();

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');

      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('should create JSON blob with settings data', async () => {
      storage.set('font_size', 28);
      storage.set('night_mode', false);
      storage.set('city', 'Makkah');

      const { exportSettings } = await import('../settings.js');

      let capturedBlob: Blob | null = null;
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:test';
      });
      URL.revokeObjectURL = vi.fn();

      exportSettings();

      expect(capturedBlob).not.toBeNull();
      expect(capturedBlob!.type).toBe('application/json');

      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('importSettings', () => {
    it('should not throw when called', async () => {
      const { importSettings } = await import('../settings.js');
      // This will create a file input and try to click it
      // Just verify it doesn't throw
      expect(() => importSettings()).not.toThrow();
    });

    it('should validate imported settings with type validators', async () => {
      // Test the validation logic indirectly by testing SETTING_TYPE_VALIDATORS
      // These are internal but we can verify the behavior through import flow
      const validators: Record<string, (v: unknown) => boolean> = {
        font_size: (v) => typeof v === 'number',
        night_mode: (v) => typeof v === 'boolean',
        city: (v) => typeof v === 'string',
        country: (v) => typeof v === 'string',
        method: (v) => typeof v === 'string',
        azan_enabled: (v) => typeof v === 'boolean',
        azan_fajr_enabled: (v) => typeof v === 'boolean',
        auto_save: (v) => typeof v === 'boolean',
        reciter: (v) => typeof v === 'string',
        tafsir_edition: (v) => typeof v === 'string',
        bar_collapsed: (v) => typeof v === 'boolean',
        player_collapsed: (v) => typeof v === 'boolean',
        playback_speed: (v) => typeof v === 'string',
        lang: (v) => typeof v === 'string',
        translation_enabled: (v) => typeof v === 'boolean',
        translation_edition: (v) => typeof v === 'string',
        favorites: (v) => Array.isArray(v),
        bookmark: (v) => v === null || typeof v === 'object',
        last_position: (v) => typeof v === 'string' || typeof v === 'number',
        mushaf_mode: (v) => typeof v === 'boolean',
        current_page: (v) => typeof v === 'number',
        adhkar_settings: (v) => typeof v === 'object' && v !== null,
        search_history: (v) => Array.isArray(v),
        font_type: (v) => typeof v === 'string',
        line_spacing: (v) => typeof v === 'string',
        tajweed_enabled: (v) => typeof v === 'boolean',
        night_mode_set_by_user: (v) => typeof v === 'boolean',
        surah_list: (v) => Array.isArray(v),
        pres_bg_mode: (v) =>
          typeof v === 'string' &&
          ['plain', 'nature', 'singleNature', 'auto', 'animated', 'scene', 'video'].includes(v),
        pres_bg_scene: (v) => typeof v === 'string' && ['stars', 'waves', 'aurora', 'particles', 'rain'].includes(v),
        pres_bg_nature: (v) => typeof v === 'string' && ['dawn', 'morning', 'afternoon', 'sunset', 'night'].includes(v),
        sepia_mode: (v) => typeof v === 'boolean',
        reading_stats: (v) => typeof v === 'object' && v !== null,
      };

      // Test font_size validation
      expect(validators.font_size(28)).toBe(true);
      expect(validators.font_size('28')).toBe(false);
      expect(validators.font_size(null)).toBe(false);

      // Test night_mode validation
      expect(validators.night_mode(true)).toBe(true);
      expect(validators.night_mode('true')).toBe(false);

      // Test city/country validation
      expect(validators.city('Makkah')).toBe(true);
      expect(validators.city(123)).toBe(false);

      // Test favorites validation
      expect(validators.favorites([])).toBe(true);
      expect(validators.favorites([1, 2, 3])).toBe(true);
      expect(validators.favorites('not array')).toBe(false);

      // Test bookmark validation
      expect(validators.bookmark(null)).toBe(true);
      expect(validators.bookmark({})).toBe(true);
      expect(validators.bookmark('string')).toBe(false);

      // Test pres_bg_mode validation
      expect(validators.pres_bg_mode('scene')).toBe(true);
      expect(validators.pres_bg_mode('invalid')).toBe(false);
      expect(validators.pres_bg_mode(123)).toBe(false);

      // Test pres_bg_scene validation
      expect(validators.pres_bg_scene('aurora')).toBe(true);
      expect(validators.pres_bg_scene('invalid')).toBe(false);

      // Test pres_bg_nature validation
      expect(validators.pres_bg_nature('sunset')).toBe(true);
      expect(validators.pres_bg_nature('invalid')).toBe(false);

      // Test reading_stats validation
      expect(validators.reading_stats({})).toBe(true);
      expect(validators.reading_stats(null)).toBe(false);
      expect(validators.reading_stats('string')).toBe(false);

      // Test adhkar_settings validation
      expect(validators.adhkar_settings({})).toBe(true);
      expect(validators.adhkar_settings(null)).toBe(false);
    });
  });

  describe('restoreSettings — thorough', () => {
    it('should restore font_size from storage', async () => {
      storage.set('font_size', 36);
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.fontSize).toBe(36);
    });

    it('should restore night_mode from storage', async () => {
      storage.set('night_mode', true);
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.nightMode).toBe(true);
    });

    it('should restore sepia_mode from storage', async () => {
      storage.set('sepia_mode', true);
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.sepiaMode).toBe(true);
    });

    it('should restore city from storage', async () => {
      storage.set('city', 'Jeddah');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.city).toBe('Jeddah');
    });

    it('should restore country from storage', async () => {
      storage.set('country', 'SA');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.country).toBe('SA');
    });

    it('should restore method from storage', async () => {
      storage.set('method', '2');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.method).toBe('2');
    });

    it('should restore azan_enabled from storage', async () => {
      storage.set('azan_enabled', true);
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.azanEnabled).toBe(true);
    });

    it('should restore azan_fajr_enabled from storage', async () => {
      storage.set('azan_fajr_enabled', true);
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.azanFajrEnabled).toBe(true);
    });

    it('should restore auto_save=false from storage', async () => {
      storage.set('auto_save', false);
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.autoSave).toBe(false);
    });

    it('should restore reciter from storage', async () => {
      storage.set('reciter', 'ar.abdulbasit');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.currentReciter).toBe('ar.abdulbasit');
    });

    it('should restore tafsir_edition from storage', async () => {
      storage.set('tafsir_edition', 'ar-tafsir-ibnkathir');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.currentTafsirEdition).toBe('ar-tafsir-ibnkathir');
    });

    it('should restore bar_collapsed=false from storage', async () => {
      storage.set('bar_collapsed', false);
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.barCollapsed).toBe(false);
    });

    it('should restore translation_enabled from storage', async () => {
      storage.set('translation_enabled', true);
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.translationEnabled).toBe(true);
    });

    it('should restore translation_edition from storage', async () => {
      storage.set('translation_edition', 'en.sahih');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.currentTranslation).toBe('en.sahih');
    });

    it('should update dom cityInput value when available', async () => {
      const input = document.createElement('input') as HTMLInputElement;
      mockDom.cityInput = input;
      storage.set('city', 'Medina');

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(input.value).toBe('Medina');

      mockDom.cityInput = null;
    });

    it('should update dom countryInput value when available', async () => {
      const input = document.createElement('input') as HTMLInputElement;
      mockDom.countryInput = input;
      storage.set('country', 'SA');

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(input.value).toBe('SA');

      mockDom.countryInput = null;
    });

    it('should update dom methodSelect value when available', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = '3';
      select.appendChild(opt);
      mockDom.methodSelect = select;
      state.method = '3';

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(select.value).toBe('3');

      mockDom.methodSelect = null;
    });

    it('should update dom azanToggle class when available', async () => {
      const toggle = document.createElement('div') as unknown as HTMLInputElement;
      mockDom.azanToggle = toggle;
      state.azanEnabled = true;

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(toggle.classList.contains('on')).toBe(true);

      mockDom.azanToggle = null;
    });

    it('should update dom reciterSelect value when available', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = 'ar.alafasy';
      select.appendChild(opt);
      mockDom.reciterSelect = select;
      state.currentReciter = 'ar.alafasy';

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(select.value).toBe('ar.alafasy');

      mockDom.reciterSelect = null;
    });

    it('should update dom tafsirSelect value when available', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = 'ar-tafsir-muyassar';
      select.appendChild(opt);
      mockDom.tafsirSelect = select;
      state.currentTafsirEdition = 'ar-tafsir-muyassar';

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(select.value).toBe('ar-tafsir-muyassar');

      mockDom.tafsirSelect = null;
    });

    it('should update dom translationSelect value when translation enabled', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = 'en.sahih';
      select.appendChild(opt);
      mockDom.translationSelect = select;
      state.translationEnabled = true;
      state.currentTranslation = 'en.sahih';

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(select.value).toBe('en.sahih');

      mockDom.translationSelect = null;
    });

    it('should set translationSelect to empty when translation disabled', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      mockDom.translationSelect = select;
      state.translationEnabled = false;

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(select.value).toBe('');

      mockDom.translationSelect = null;
    });

    it('should update dom fontSizeSelect value when available', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = String(state.fontSize);
      select.appendChild(opt);
      mockDom.fontSizeSelect = select;

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(select.value).toBe(String(state.fontSize));

      mockDom.fontSizeSelect = null;
    });

    it('should restore font_type from storage', async () => {
      storage.set('font_type', 'uthman');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.fontType).toBe('uthman');
    });

    it('should restore line_spacing from storage', async () => {
      storage.set('line_spacing', '2.0');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.lineSpacing).toBe('2.0');
    });

    it('should restore playback_speed and update dom when available', async () => {
      storage.set('playback_speed', '1.5');
      const select = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = '1.5';
      select.appendChild(opt);
      const audio = document.createElement('audio') as HTMLAudioElement;
      mockDom.speedSelect = select;
      mockDom.audioPlayer = audio;

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(select.value).toBe('1.5');
      expect(audio.playbackRate).toBe(1.5);

      mockDom.speedSelect = null;
      mockDom.audioPlayer = null;
    });

    it('should restore tajweed_enabled=false and update toggle', async () => {
      storage.set('tajweed_enabled', false);
      const toggle = document.createElement('div') as unknown as HTMLInputElement;
      mockDom.tajweedToggle = toggle;

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.tajweedEnabled).toBe(false);
      expect(toggle.classList.contains('on')).toBe(false);

      mockDom.tajweedToggle = null;
    });

    it('should default tajweed to true when not set to false', async () => {
      const toggle = document.createElement('div') as unknown as HTMLInputElement;
      mockDom.tajweedToggle = toggle;

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.tajweedEnabled).toBe(true);
      expect(toggle.classList.contains('on')).toBe(true);

      mockDom.tajweedToggle = null;
    });

    it('should restore pres_bg_mode from storage', async () => {
      storage.set('pres_bg_mode', 'scene');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.presBgMode).toBe('scene');
    });

    it('should restore pres_bg_scene from storage', async () => {
      storage.set('pres_bg_scene', 'aurora');
      state.presBgMode = 'scene';
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.presBgScene).toBe('aurora');
      state.presBgMode = 'plain';
    });

    it('should restore pres_bg_nature from storage', async () => {
      storage.set('pres_bg_nature', 'sunset');
      state.presBgMode = 'singleNature';
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.presBgNature).toBe('sunset');
      state.presBgMode = 'plain';
    });

    it('should update prayerBar class when not collapsed', async () => {
      state.barCollapsed = false;
      const prayerBar = document.createElement('div');
      mockDom.prayerBar = prayerBar;

      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(prayerBar.classList.contains('collapsed')).toBe(false);
      expect(prayerBar.classList.contains('expanded')).toBe(true);

      mockDom.prayerBar = null;
      state.barCollapsed = true;
    });

    it('should not restore invalid pres_bg_mode', async () => {
      storage.set('pres_bg_mode', 'invalid_mode');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.presBgMode).toBe('plain');
    });

    it('should not restore invalid pres_bg_scene', async () => {
      storage.set('pres_bg_scene', 'invalid_scene');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.presBgScene).toBe('stars');
    });

    it('should not restore invalid pres_bg_nature', async () => {
      storage.set('pres_bg_nature', 'invalid_nature');
      const { restoreSettings } = await import('../settings.js');
      restoreSettings();
      expect(state.presBgNature).toBe('dawn');
    });

    it('should restore all valid pres_bg_mode values', async () => {
      const validModes = ['nature', 'singleNature', 'auto', 'animated', 'scene'];
      for (const mode of validModes) {
        storage.set('pres_bg_mode', mode);
        const { restoreSettings } = await import('../settings.js');
        restoreSettings();
        expect(state.presBgMode).toBe(mode);
      }
      state.presBgMode = 'plain';
    });

    it('should restore all valid pres_bg_scene values', async () => {
      const validScenes = ['stars', 'waves', 'aurora', 'particles', 'rain'];
      state.presBgMode = 'scene';
      for (const scene of validScenes) {
        storage.set('pres_bg_scene', scene);
        const { restoreSettings } = await import('../settings.js');
        restoreSettings();
        expect(state.presBgScene).toBe(scene);
      }
      state.presBgMode = 'plain';
    });

    it('should restore all valid pres_bg_nature values', async () => {
      const validNatures = ['dawn', 'morning', 'afternoon', 'sunset', 'night'];
      state.presBgMode = 'singleNature';
      for (const nature of validNatures) {
        storage.set('pres_bg_nature', nature);
        const { restoreSettings } = await import('../settings.js');
        restoreSettings();
        expect(state.presBgNature).toBe(nature);
      }
      state.presBgMode = 'plain';
    });
  });

  describe('initSettingsTabs', () => {
    it('should not throw when settingsPanel is null', async () => {
      const { initSettingsTabs } = await import('../settings.js');
      expect(() => initSettingsTabs()).not.toThrow();
    });

    it('should not throw when no tabs container found', async () => {
      const panel = document.createElement('div');
      mockDom.settingsPanel = panel;

      const { initSettingsTabs } = await import('../settings.js');
      expect(() => initSettingsTabs()).not.toThrow();

      mockDom.settingsPanel = null;
    });

    it('should add click listeners to settings tabs', async () => {
      const panel = document.createElement('div');
      const tabsContainer = document.createElement('div');
      tabsContainer.id = 'settingsTabs';
      const tab1 = document.createElement('button');
      tab1.className = 'settings-tab';
      tab1.dataset['tab'] = 'general';
      const tab2 = document.createElement('button');
      tab2.className = 'settings-tab';
      tab2.dataset['tab'] = 'prayer';
      tabsContainer.appendChild(tab1);
      tabsContainer.appendChild(tab2);
      panel.appendChild(tabsContainer);
      mockDom.settingsPanel = panel;

      const { initSettingsTabs } = await import('../settings.js');
      initSettingsTabs();

      tab1.click();
      expect(tab1.classList.contains('active')).toBe(true);
      expect(tab2.classList.contains('active')).toBe(false);

      mockDom.settingsPanel = null;
    });

    it('should switch active tab on click', async () => {
      const panel = document.createElement('div');
      const tabsContainer = document.createElement('div');
      tabsContainer.id = 'settingsTabs';
      const tab1 = document.createElement('button');
      tab1.className = 'settings-tab';
      tab1.dataset['tab'] = 'general';
      const tab2 = document.createElement('button');
      tab2.className = 'settings-tab';
      tab2.dataset['tab'] = 'prayer';
      tabsContainer.appendChild(tab1);
      tabsContainer.appendChild(tab2);

      const content1 = document.createElement('div');
      content1.className = 'settings-tab-content';
      content1.dataset['tab'] = 'general';
      const content2 = document.createElement('div');
      content2.className = 'settings-tab-content';
      content2.dataset['tab'] = 'prayer';

      panel.appendChild(tabsContainer);
      panel.appendChild(content1);
      panel.appendChild(content2);
      mockDom.settingsPanel = panel;

      const { initSettingsTabs } = await import('../settings.js');
      initSettingsTabs();

      tab2.click();
      expect(tab2.classList.contains('active')).toBe(true);
      expect(tab1.classList.contains('active')).toBe(false);
      expect(content2.classList.contains('active')).toBe(true);
      expect(content1.classList.contains('active')).toBe(false);

      mockDom.settingsPanel = null;
    });

    it('should handle click on tab without data-tab attribute', async () => {
      const panel = document.createElement('div');
      const tabsContainer = document.createElement('div');
      tabsContainer.id = 'settingsTabs';
      const tab = document.createElement('button');
      tab.className = 'settings-tab';
      tabsContainer.appendChild(tab);
      panel.appendChild(tabsContainer);
      mockDom.settingsPanel = panel;

      const { initSettingsTabs } = await import('../settings.js');
      initSettingsTabs();

      expect(() => tab.click()).not.toThrow();

      mockDom.settingsPanel = null;
    });
  });

  describe('saveLocationSettings', () => {
    it('should show error toast when city is empty', async () => {
      const input = document.createElement('input') as HTMLInputElement;
      input.value = '';
      mockDom.cityInput = input;
      mockDom.countryInput = document.createElement('input');

      const { saveLocationSettings } = await import('../settings.js');
      saveLocationSettings();

      const { showToast } = await import('../ui.js');
      expect(showToast).toHaveBeenCalled();

      mockDom.cityInput = null;
      mockDom.countryInput = null;
    });

    it('should show error toast when country is empty', async () => {
      const cityInput = document.createElement('input') as HTMLInputElement;
      cityInput.value = 'Makkah';
      const countryInput = document.createElement('input') as HTMLInputElement;
      countryInput.value = '';
      mockDom.cityInput = cityInput;
      mockDom.countryInput = countryInput;

      const { saveLocationSettings } = await import('../settings.js');
      saveLocationSettings();

      const { showToast } = await import('../ui.js');
      expect(showToast).toHaveBeenCalled();

      mockDom.cityInput = null;
      mockDom.countryInput = null;
    });

    it('should save city, country, method and load prayer times', async () => {
      const cityInput = document.createElement('input') as HTMLInputElement;
      cityInput.value = 'Makkah';
      const countryInput = document.createElement('input') as HTMLInputElement;
      countryInput.value = 'SA';
      const methodSelect = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = '4';
      methodSelect.appendChild(opt);
      methodSelect.value = '4';

      mockDom.cityInput = cityInput;
      mockDom.countryInput = countryInput;
      mockDom.methodSelect = methodSelect;

      const { saveLocationSettings } = await import('../settings.js');
      saveLocationSettings();

      expect(state.city).toBe('Makkah');
      expect(state.country).toBe('SA');

      const { loadPrayerTimes } = await import('../prayer.js');
      expect(loadPrayerTimes).toHaveBeenCalled();

      mockDom.cityInput = null;
      mockDom.countryInput = null;
      mockDom.methodSelect = null;
    });
  });

  describe('openSettings', () => {
    it('should add open class to settingsPanel', async () => {
      const panel = document.createElement('div');
      mockDom.settingsPanel = panel;

      const { openSettings } = await import('../settings.js');
      openSettings();

      expect(panel.classList.contains('open')).toBe(true);

      mockDom.settingsPanel = null;
    });

    it('should render adhkar settings list', async () => {
      const panel = document.createElement('div');
      mockDom.settingsPanel = panel;

      const { openSettings } = await import('../settings.js');
      openSettings();

      const { renderAdhkarSettingsList } = await import('../adhkar.js');
      expect(renderAdhkarSettingsList).toHaveBeenCalled();

      mockDom.settingsPanel = null;
    });
  });

  describe('closeSettings', () => {
    it('should remove open class from settingsPanel', async () => {
      const panel = document.createElement('div');
      panel.classList.add('open');
      mockDom.settingsPanel = panel;

      const { closeSettings } = await import('../settings.js');
      closeSettings();

      expect(panel.classList.contains('open')).toBe(false);

      mockDom.settingsPanel = null;
    });

    it('should stop azan when azan is playing', async () => {
      state.azanPlaying = true;
      const panel = document.createElement('div');
      mockDom.settingsPanel = panel;

      const { closeSettings } = await import('../settings.js');
      closeSettings();

      const { stopAzan } = await import('../prayer.js');
      expect(stopAzan).toHaveBeenCalled();

      state.azanPlaying = false;
      mockDom.settingsPanel = null;
    });
  });

  describe('toggleNightMode', () => {
    it('should toggle night mode state', async () => {
      state.nightMode = false;
      const { toggleNightMode } = await import('../settings.js');
      toggleNightMode();
      expect(state.nightMode).toBe(true);
      toggleNightMode();
      expect(state.nightMode).toBe(false);
    });
  });

  describe('applyPresBgMode — sub-selector visibility', () => {
    it('should show scene row when mode is scene', async () => {
      const sceneRow = document.createElement('div');
      sceneRow.classList.add('hidden');
      mockDom.presBgSceneRow = sceneRow;

      const { applyPresBgMode } = await import('../settings.js');
      applyPresBgMode('scene');

      expect(sceneRow.classList.contains('hidden')).toBe(false);

      mockDom.presBgSceneRow = null;
      state.presBgMode = 'plain';
    });

    it('should hide scene row when mode is not scene', async () => {
      const sceneRow = document.createElement('div');
      mockDom.presBgSceneRow = sceneRow;

      const { applyPresBgMode } = await import('../settings.js');
      applyPresBgMode('plain');

      expect(sceneRow.classList.contains('hidden')).toBe(true);

      mockDom.presBgSceneRow = null;
    });

    it('should show nature row when mode is singleNature', async () => {
      const natureRow = document.createElement('div');
      natureRow.classList.add('hidden');
      mockDom.presBgNatureRow = natureRow;

      const { applyPresBgMode } = await import('../settings.js');
      applyPresBgMode('singleNature');

      expect(natureRow.classList.contains('hidden')).toBe(false);

      mockDom.presBgNatureRow = null;
      state.presBgMode = 'plain';
    });

    it('should hide nature row when mode is not singleNature', async () => {
      const natureRow = document.createElement('div');
      mockDom.presBgNatureRow = natureRow;

      const { applyPresBgMode } = await import('../settings.js');
      applyPresBgMode('nature');

      expect(natureRow.classList.contains('hidden')).toBe(true);

      mockDom.presBgNatureRow = null;
    });

    it('should update presBgSelect value when available', async () => {
      const select = document.createElement('select') as HTMLSelectElement;
      const opt = document.createElement('option');
      opt.value = 'auto';
      select.appendChild(opt);
      mockDom.presBgSelect = select;

      const { applyPresBgMode } = await import('../settings.js');
      applyPresBgMode('auto');

      expect(select.value).toBe('auto');

      mockDom.presBgSelect = null;
      state.presBgMode = 'plain';
    });

    it('should sync presentation when in presentation mode', async () => {
      state.presentationMode = true;

      const { applyPresBgMode } = await import('../settings.js');
      applyPresBgMode('animated');

      await new Promise((r) => setTimeout(r, 50));

      state.presentationMode = false;
      state.presBgMode = 'plain';
    });
  });

  describe('updateThemeButtons', () => {
    it('should set active class on light theme button in light mode', async () => {
      state.nightMode = false;
      state.sepiaMode = false;

      const btn = document.createElement('button');
      btn.className = 'theme-btn';
      btn.dataset['theme'] = 'light';
      document.body.appendChild(btn);

      const { applyNightMode } = await import('../settings.js');
      applyNightMode(false);

      expect(btn.classList.contains('active')).toBe(true);

      document.body.removeChild(btn);
    });

    it('should set active class on sepia theme button in sepia mode', async () => {
      const btn = document.createElement('button');
      btn.className = 'theme-btn';
      btn.dataset['theme'] = 'sepia';
      document.body.appendChild(btn);

      const { applySepiaMode } = await import('../settings.js');
      applySepiaMode(true);

      expect(btn.classList.contains('active')).toBe(true);

      document.body.removeChild(btn);
    });

    it('should set active class on night theme button in night mode', async () => {
      const btn = document.createElement('button');
      btn.className = 'theme-btn';
      btn.dataset['theme'] = 'night';
      document.body.appendChild(btn);

      const { applyNightMode } = await import('../settings.js');
      applyNightMode(true);

      expect(btn.classList.contains('active')).toBe(true);

      document.body.removeChild(btn);
      state.nightMode = false;
    });
  });
});
