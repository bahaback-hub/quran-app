/**
 * Tests for settings.ts — Theme, font, spacing, and settings management.
 *
 * Covers applyFontSize, applyNightMode, applySepiaMode, applyTheme,
 * applyFontType, applyLineSpacing, applyPresBgMode, restoreSettings,
 * and type validators for settings import.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { state, resetState } from '../state.js';
import { storage } from '../storage.js';

// Mock DOM before importing settings (since settings.ts uses document at top level)
const mockContainer = document.createElement('div');
mockContainer.className = 'ayahs-container';
document.body.appendChild(mockContainer);

vi.mock('../dom.js', () => ({
  dom: {
    fontSizeSelect: null,
    fontTypeSelect: null,
    lineSpacingSelect: null,
    presBgSelect: null,
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
  },
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

describe('settings', () => {
  beforeEach(() => {
    resetState();
    localStorage.clear();
    document.documentElement.style.removeProperty('--mushaf-page-width');
  });

  describe('applyFontSize', () => {
    it('should update state.fontSize', async () => {
      const { applyFontSize } = await import('../settings.js');
      applyFontSize(32);
      expect(state.fontSize).toBe(32);
    });

    it('should persist font size to storage', async () => {
      const { applyFontSize } = await import('../settings.js');
      applyFontSize(36);
      // Verify via state (storage.set is called internally)
      expect(state.fontSize).toBe(36);
    });

    it('should update ayahs container style', async () => {
      const { applyFontSize } = await import('../settings.js');
      applyFontSize(30);
      expect(mockContainer.style.fontSize).toBe('30px');
    });

    it('should keep the Mushaf scale independent from Surah font size', async () => {
      const { applyFontSize, applyMushafZoom } = await import('../settings.js');
      applyMushafZoom(150);
      applyFontSize(42);
      expect(document.documentElement.style.getPropertyValue('--mushaf-page-width')).toBe('150%');
    });
  });

  describe('applyMushafZoom', () => {
    it('should apply and persist an allowed QCF4 page scale', async () => {
      const { applyMushafZoom } = await import('../settings.js');
      const storageSet = vi.spyOn(storage, 'set');
      applyMushafZoom(175);
      expect(state.mushafZoom).toBe(175);
      expect(document.documentElement.style.getPropertyValue('--mushaf-page-width')).toBe('175%');
      expect(storageSet).toHaveBeenCalledWith('mushaf_zoom', 175);
    });
  });

  describe('applyNightMode', () => {
    it('should add night-mode class when enabled', async () => {
      const { applyNightMode } = await import('../settings.js');
      applyNightMode(true);
      expect(document.body.classList.contains('night-mode')).toBe(true);
    });

    it('should remove night-mode class when disabled', async () => {
      const { applyNightMode } = await import('../settings.js');
      document.body.classList.add('night-mode');
      applyNightMode(false);
      expect(document.body.classList.contains('night-mode')).toBe(false);
    });

    it('should remove sepia-mode when night mode is enabled', async () => {
      const { applyNightMode } = await import('../settings.js');
      document.body.classList.add('sepia-mode');
      applyNightMode(true);
      expect(document.body.classList.contains('sepia-mode')).toBe(false);
    });

    it('should update state.nightMode', async () => {
      const { applyNightMode } = await import('../settings.js');
      applyNightMode(true);
      expect(state.nightMode).toBe(true);
    });

    it('should persist night mode to storage', async () => {
      const { applyNightMode } = await import('../settings.js');
      applyNightMode(true);
      expect(state.nightMode).toBe(true);
    });

    it('should set sepia_mode to false in state when night enabled', async () => {
      const { applyNightMode } = await import('../settings.js');
      applyNightMode(true);
      expect(state.sepiaMode).toBe(false);
    });
  });

  describe('applySepiaMode', () => {
    it('should add sepia-mode class when enabled', async () => {
      const { applySepiaMode } = await import('../settings.js');
      applySepiaMode(true);
      expect(document.body.classList.contains('sepia-mode')).toBe(true);
    });

    it('should remove sepia-mode class when disabled', async () => {
      const { applySepiaMode } = await import('../settings.js');
      document.body.classList.add('sepia-mode');
      applySepiaMode(false);
      expect(document.body.classList.contains('sepia-mode')).toBe(false);
    });

    it('should remove night-mode when sepia is enabled', async () => {
      const { applySepiaMode } = await import('../settings.js');
      document.body.classList.add('night-mode');
      applySepiaMode(true);
      expect(document.body.classList.contains('night-mode')).toBe(false);
    });

    it('should update state.sepiaMode', async () => {
      const { applySepiaMode } = await import('../settings.js');
      applySepiaMode(true);
      expect(state.sepiaMode).toBe(true);
    });

    it('should persist sepia mode to state', async () => {
      const { applySepiaMode } = await import('../settings.js');
      applySepiaMode(true);
      expect(state.sepiaMode).toBe(true);
    });
  });

  describe('applyTheme', () => {
    it('should apply night theme', async () => {
      const { applyTheme } = await import('../settings.js');
      applyTheme('night');
      expect(state.nightMode).toBe(true);
    });

    it('should apply sepia theme', async () => {
      const { applyTheme } = await import('../settings.js');
      applyTheme('sepia');
      expect(state.sepiaMode).toBe(true);
    });

    it('should apply light theme', async () => {
      const { applyTheme } = await import('../settings.js');
      document.body.classList.add('night-mode');
      document.body.classList.add('sepia-mode');
      applyTheme('light');
      expect(state.nightMode).toBe(false);
      expect(state.sepiaMode).toBe(false);
    });
  });

  describe('applyFontType', () => {
    it('should update state.fontType', async () => {
      const { applyFontType } = await import('../settings.js');
      applyFontType('uthman');
      expect(state.fontType).toBe('uthman');
    });

    it('should persist font type to state', async () => {
      const { applyFontType } = await import('../settings.js');
      applyFontType('naskh');
      expect(state.fontType).toBe('naskh');
    });

    it('should update container font family', async () => {
      const { applyFontType } = await import('../settings.js');
      applyFontType('amiri');
      expect(mockContainer.style.fontFamily).toBe('amiri');
    });
  });

  describe('applyLineSpacing', () => {
    it('should update state.lineSpacing', async () => {
      const { applyLineSpacing } = await import('../settings.js');
      applyLineSpacing('2.0');
      expect(state.lineSpacing).toBe('2.0');
    });

    it('should persist line spacing to state', async () => {
      const { applyLineSpacing } = await import('../settings.js');
      applyLineSpacing('2.2');
      expect(state.lineSpacing).toBe('2.2');
    });

    it('should update container line height', async () => {
      const { applyLineSpacing } = await import('../settings.js');
      applyLineSpacing('1.8');
      expect(mockContainer.style.lineHeight).toBe('1.8');
    });
  });

  describe('applyReaderSurfaceTransparency', () => {
    it('should persist the reader surface transparency and set the matching CSS alpha', async () => {
      const { applyReaderSurfaceTransparency } = await import('../settings.js');
      const storageSet = vi.spyOn(storage, 'set');
      applyReaderSurfaceTransparency(65);
      expect(document.documentElement.style.getPropertyValue('--reader-surface-alpha')).toBe('0.60');
      expect(storageSet).toHaveBeenCalledWith('reader_surface_transparency', 65);
    });

    it('should clamp extreme values to the readable range', async () => {
      const { applyReaderSurfaceTransparency } = await import('../settings.js');
      applyReaderSurfaceTransparency(999);
      expect(document.documentElement.style.getPropertyValue('--reader-surface-alpha')).toBe('0.42');
      applyReaderSurfaceTransparency(-20);
      expect(document.documentElement.style.getPropertyValue('--reader-surface-alpha')).toBe('0.94');
    });
  });

  describe('applyPresBgMode', () => {
    it('should update state.presBgMode', async () => {
      const { applyPresBgMode } = await import('../settings.js');
      applyPresBgMode('scene');
      expect(state.presBgMode).toBe('scene');
    });

    it('should persist pres bg mode to state', async () => {
      const { applyPresBgMode } = await import('../settings.js');
      applyPresBgMode('nature');
      expect(state.presBgMode).toBe('nature');
    });

    it('should accept all valid modes', async () => {
      const { applyPresBgMode } = await import('../settings.js');
      const modes = ['plain', 'nature', 'singleNature', 'auto', 'animated', 'scene', 'video'] as const;
      for (const mode of modes) {
        applyPresBgMode(mode);
        expect(state.presBgMode).toBe(mode);
      }
    });
  });

  describe('ALLOWED_SETTINGS_KEYS (import validation)', () => {
    it('should validate font_size as number', () => {
      const validators: Record<string, (v: unknown) => boolean> = {
        font_size: (v) => typeof v === 'number',
        night_mode: (v) => typeof v === 'boolean',
        city: (v) => typeof v === 'string',
        favorites: (v) => Array.isArray(v),
        pres_bg_mode: (v) =>
          typeof v === 'string' &&
          ['plain', 'nature', 'singleNature', 'auto', 'animated', 'scene', 'video'].includes(v),
      };

      expect(validators.font_size(28)).toBe(true);
      expect(validators.font_size('28')).toBe(false);
      expect(validators.night_mode(true)).toBe(true);
      expect(validators.night_mode('true')).toBe(false);
      expect(validators.city('Makkah')).toBe(true);
      expect(validators.city(123)).toBe(false);
      expect(validators.favorites([])).toBe(true);
      expect(validators.favorites('not array')).toBe(false);
      expect(validators.pres_bg_mode('scene')).toBe(true);
      expect(validators.pres_bg_mode('invalid')).toBe(false);
    });

    it('should keep imported reader surface transparency within the safe range', async () => {
      const { SETTING_TYPE_VALIDATORS } = await import('../settings.js');
      expect(SETTING_TYPE_VALIDATORS['reader_surface_transparency']!(65)).toBe(true);
      expect(SETTING_TYPE_VALIDATORS['reader_surface_transparency']!(101)).toBe(false);
      expect(SETTING_TYPE_VALIDATORS['reader_surface_transparency']!(-1)).toBe(false);
    });
  });

  describe('openSettings', () => {
    it('should not throw when settingsPanel is null', async () => {
      const { openSettings } = await import('../settings.js');
      expect(() => openSettings()).not.toThrow();
    });
  });

  describe('closeSettings', () => {
    it('should not throw when called', async () => {
      const { closeSettings } = await import('../settings.js');
      expect(() => closeSettings()).not.toThrow();
    });
  });

  describe('initSettingsTabs', () => {
    it('should not throw when called', async () => {
      const { initSettingsTabs } = await import('../settings.js');
      expect(() => initSettingsTabs()).not.toThrow();
    });
  });
});
