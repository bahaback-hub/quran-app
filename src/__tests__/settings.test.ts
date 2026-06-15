import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';

// Mock storage with a working in-memory store
const store: Record<string, string> = {};
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(<T>(_key: string, _default?: T): T | null => {
      const fullKey = 'quran_app_' + _key;
      const raw = store[fullKey];
      if (raw === undefined) {
        return _default ?? null;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }),
    set: vi.fn((_key: string, val: unknown): boolean => {
      const fullKey = 'quran_app_' + _key;
      try {
        store[fullKey] = JSON.stringify(val);
        return true;
      } catch {
        return false;
      }
    }),
    remove: vi.fn((_key: string): void => {
      const fullKey = 'quran_app_' + _key;
      delete store[fullKey];
    }),
  },
}));

vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

vi.mock('../prayer.js', () => ({
  stopAzan: vi.fn(),
  loadPrayerTimes: vi.fn(),
}));

vi.mock('../adhkar.js', () => ({
  renderAdhkarSettingsList: vi.fn(),
}));

vi.mock('../dom.js', () => ({
  dom: {},
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

import {
  applyNightMode,
  toggleNightMode,
  applyFontSize,
  applyFontType,
  applyLineSpacing,
  initSystemThemeDetection,
  restoreSettings,
} from '../settings.js';

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  state.fontSize = 28;
  state.nightMode = false;
  state.azanEnabled = true;
  state.azanFajrEnabled = true;
  state.autoSave = true;
  state.currentReciter = 'ar.alafasy';
  state.currentTafsirEdition = 'ar-tafsir-muyassar';
  state.city = 'مكة المكرمة';
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
    // Set night_mode in storage (true)
    store['quran_app_night_mode'] = JSON.stringify(true);

    const matchMediaMock = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    window.matchMedia = matchMediaMock;

    initSystemThemeDetection();

    // initSystemThemeDetection returns early when user has explicit preference
    // It does NOT apply the system theme (that's the point — don't override)
    // Night mode was NOT applied by this function; it would be applied by restoreSettings
    expect(document.body.classList.contains('night-mode')).toBe(false);
  });

  it('should apply dark theme when system prefers dark and no explicit preference', () => {
    // Make sure no night_mode is stored
    delete store['quran_app_night_mode'];

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
    delete store['quran_app_night_mode'];

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
  it('should restore night mode when set to true', () => {
    store['quran_app_night_mode'] = JSON.stringify(true);
    restoreSettings();
    expect(state.nightMode).toBe(true);
    expect(document.body.classList.contains('night-mode')).toBe(true);
  });

  it('should not apply night mode when storage returns false', () => {
    store['quran_app_night_mode'] = JSON.stringify(false);
    restoreSettings();
    // Source code: if (nm === true) applyNightMode(true)
    expect(state.nightMode).toBe(false);
    expect(document.body.classList.contains('night-mode')).toBe(false);
  });

  it('should restore font size from storage', () => {
    store['quran_app_font_size'] = JSON.stringify(36);
    restoreSettings();
    expect(state.fontSize).toBe(36);
  });

  it('should restore city and country from storage', () => {
    store['quran_app_city'] = JSON.stringify('الرياض');
    store['quran_app_country'] = JSON.stringify('SA');
    restoreSettings();
    expect(state.city).toBe('الرياض');
    expect(state.country).toBe('SA');
  });

  it('should restore azan disabled state', () => {
    store['quran_app_azan_enabled'] = JSON.stringify(false);
    restoreSettings();
    expect(state.azanEnabled).toBe(false);
  });

  it('should restore auto save disabled state', () => {
    store['quran_app_auto_save'] = JSON.stringify(false);
    restoreSettings();
    expect(state.autoSave).toBe(false);
  });

  it('should restore reciter from storage', () => {
    store['quran_app_reciter'] = JSON.stringify('ar.husary');
    restoreSettings();
    expect(state.currentReciter).toBe('ar.husary');
  });

  it('should handle null/undefined storage values gracefully', () => {
    expect(() => restoreSettings()).not.toThrow();
  });

  it('should set tajweedEnabled to false when storage returns false', () => {
    store['quran_app_tajweed_enabled'] = JSON.stringify(false);
    restoreSettings();
    expect(state.tajweedEnabled).toBe(false);
  });

  it('should restore translation settings', () => {
    store['quran_app_translation_enabled'] = JSON.stringify(true);
    store['quran_app_translation_edition'] = JSON.stringify('en.sahih');
    restoreSettings();
    expect(state.translationEnabled).toBe(true);
    expect(state.currentTranslation).toBe('en.sahih');
  });

  it('should restore bar collapsed state', () => {
    store['quran_app_bar_collapsed'] = JSON.stringify(false);
    restoreSettings();
    expect(state.barCollapsed).toBe(false);
  });
});
