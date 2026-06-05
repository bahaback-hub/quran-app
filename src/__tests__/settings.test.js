import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';
import { storage } from '../storage.js';
import {
  applyNightMode,
  toggleNightMode,
  applyFontSize,
  applyFontType,
  applyLineSpacing,
  initSystemThemeDetection,
  restoreSettings,
} from '../settings.js';

// Mock localStorage
const store = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  globalThis.localStorage = {
    getItem: (key) => (store[key] === undefined ? null : store[key]),
    setItem: (key, val) => {
      store[key] = String(val);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
  state.fontSize = 28;
  state.nightMode = false;
  state.azanEnabled = true;
  state.azanFajrEnabled = true;
  state.autoSave = true;
  state.currentReciter = 'ar.alafasy';
  state.currentTafsirEdition = 'ar-tafsir-muyassar';
  state.city = 'مكة';
  state.country = 'SA';
  state.method = '4';
  state.translationEnabled = false;
  state.currentTranslation = null;
  state.barCollapsed = false;
  state.mushafMode = false;
  state.currentPage = 1;
  state.tajweedEnabled = true;
  state.fontType = '';
  state.lineSpacing = '';
  document.body.classList.remove('night-mode');
});

describe('applyNightMode', () => {
  it('should enable night mode', () => {
    applyNightMode(true);
    expect(state.nightMode).toBe(true);
    expect(document.body.classList.contains('night-mode')).toBe(true);
  });

  it('should disable night mode', () => {
    document.body.classList.add('night-mode');
    applyNightMode(false);
    expect(state.nightMode).toBe(false);
    expect(document.body.classList.contains('night-mode')).toBe(false);
  });
});

describe('toggleNightMode', () => {
  it('should toggle from off to on', () => {
    state.nightMode = false;
    toggleNightMode();
    expect(state.nightMode).toBe(true);
  });

  it('should toggle from on to off', () => {
    state.nightMode = true;
    document.body.classList.add('night-mode');
    toggleNightMode();
    expect(state.nightMode).toBe(false);
  });
});

describe('applyFontSize', () => {
  it('should update state.fontSize', () => {
    applyFontSize(36);
    expect(state.fontSize).toBe(36);
  });

  it('should update container font size', () => {
    const container = document.createElement('div');
    container.className = 'ayahs-container';
    document.body.appendChild(container);
    applyFontSize(32);
    expect(container.style.fontSize).toBe('32px');
    document.body.removeChild(container);
  });

  it('should handle missing container gracefully', () => {
    expect(() => applyFontSize(28)).not.toThrow();
  });
});

describe('applyFontType', () => {
  it('should update state.fontType', () => {
    applyFontType('Uthmanic');
    expect(state.fontType).toBe('Uthmanic');
  });

  it('should update container fontFamily when container exists', () => {
    const container = document.createElement('div');
    container.className = 'ayahs-container';
    document.body.appendChild(container);
    applyFontType('Uthmanic');
    expect(container.style.fontFamily).toBe('Uthmanic');
    document.body.removeChild(container);
  });

  it('should handle missing container gracefully', () => {
    expect(() => applyFontType('Uthmanic')).not.toThrow();
  });
});

describe('applyLineSpacing', () => {
  it('should update state.lineSpacing', () => {
    applyLineSpacing('2.0');
    expect(state.lineSpacing).toBe('2.0');
  });

  it('should update container lineHeight when container exists', () => {
    const container = document.createElement('div');
    container.className = 'ayahs-container';
    document.body.appendChild(container);
    applyLineSpacing('1.8');
    expect(container.style.lineHeight).toBe('1.8');
    document.body.removeChild(container);
  });

  it('should handle missing container gracefully', () => {
    expect(() => applyLineSpacing('2.0')).not.toThrow();
  });
});

describe('initSystemThemeDetection', () => {
  it('should not override theme when user has explicit night_mode preference', () => {
    storage.set('night_mode', true);

    const matchMediaMock = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    window.matchMedia = matchMediaMock;

    initSystemThemeDetection();

    // Should not add night-mode since user has explicit pref
    expect(document.body.classList.contains('night-mode')).toBe(false);
  });

  it('should apply dark theme when system prefers dark and no explicit preference', () => {
    // Make sure no night_mode is stored
    storage.remove('night_mode');

    const matchMediaMock = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    window.matchMedia = matchMediaMock;

    initSystemThemeDetection();

    expect(state.nightMode).toBe(true);
    expect(document.body.classList.contains('night-mode')).toBe(true);
  });

  it('should not apply dark theme when system prefers light and no explicit preference', () => {
    storage.remove('night_mode');

    const matchMediaMock = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    window.matchMedia = matchMediaMock;

    initSystemThemeDetection();

    expect(state.nightMode).toBe(false);
    expect(document.body.classList.contains('night-mode')).toBe(false);
  });

  it('should register change listener on matchMedia', () => {
    const addEventListenerSpy = vi.fn();
    const matchMediaMock = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: addEventListenerSpy,
      removeEventListener: vi.fn(),
    });
    window.matchMedia = matchMediaMock;

    initSystemThemeDetection();

    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

describe('restoreSettings', () => {
  it('should handle corrupt JSON in localStorage gracefully', () => {
    store['quran_app_night_mode'] = '{invalid json';
    store['quran_app_font_size'] = 'not_a_number';

    expect(() => storage.get('night_mode')).not.toThrow();
    expect(storage.get('night_mode')).toBeNull();
    expect(storage.get('font_size')).toBeNull();
  });

  it('should restore night mode when set to true', () => {
    storage.set('night_mode', true);
    restoreSettings();
    expect(state.nightMode).toBe(true);
    expect(document.body.classList.contains('night-mode')).toBe(true);
  });

  it('should not apply night mode when storage returns false', () => {
    storage.set('night_mode', false);
    restoreSettings();
    // The source code only applies if nm === true
    expect(state.nightMode).toBe(false);
    expect(document.body.classList.contains('night-mode')).toBe(false);
  });

  it('should restore font size from storage', () => {
    storage.set('font_size', 36);
    restoreSettings();
    expect(state.fontSize).toBe(36);
  });

  it('should restore city and country from storage', () => {
    storage.set('city', 'الرياض');
    storage.set('country', 'SA');
    restoreSettings();
    expect(state.city).toBe('الرياض');
    expect(state.country).toBe('SA');
  });

  it('should restore azan disabled state', () => {
    storage.set('azan_enabled', false);
    restoreSettings();
    expect(state.azanEnabled).toBe(false);
  });

  it('should restore auto save disabled state', () => {
    storage.set('auto_save', false);
    restoreSettings();
    expect(state.autoSave).toBe(false);
  });

  it('should restore reciter from storage', () => {
    storage.set('reciter', 'ar.husary');
    restoreSettings();
    expect(state.currentReciter).toBe('ar.husary');
  });

  it('should handle null/undefined storage values gracefully', () => {
    expect(() => restoreSettings()).not.toThrow();
  });

  it('should set tajweedEnabled to false when storage returns false', () => {
    storage.set('tajweed_enabled', false);
    restoreSettings();
    expect(state.tajweedEnabled).toBe(false);
  });

  it('should restore translation settings', () => {
    storage.set('translation_enabled', true);
    storage.set('translation_edition', 'en.sahih');
    restoreSettings();
    expect(state.translationEnabled).toBe(true);
    expect(state.currentTranslation).toBe('en.sahih');
  });

  it('should restore bar collapsed state', () => {
    storage.set('bar_collapsed', false);
    restoreSettings();
    expect(state.barCollapsed).toBe(false);
  });
});
