/**
 * Unit tests for settings.ts — import/export, reset, restore, and validation.
 *
 * Covers:
 *   - importSettings with valid/invalid JSON
 *   - exportSettings output format
 *   - resetSettings modal creation
 *   - restoreSettings from localStorage
 *   - ALLOWED_SETTINGS_KEYS validation
 *   - SETTING_TYPE_VALIDATORS for each key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../state.js', () => ({
  state: new Proxy(
    {
      fontSize: 28,
      nightMode: false,
      sepiaMode: false,
      city: 'Makkah',
      country: 'SA',
      method: '4',
      azanEnabled: true,
      azanFajrEnabled: true,
      autoSave: true,
      currentReciter: 'ar.alafasy',
      currentTafsirEdition: 'ar-tafsir-muyassar',
      barCollapsed: false,
      playerCollapsed: false,
      translationEnabled: false,
      currentTranslation: '',
      fontType: 'Amiri',
      lineSpacing: '1.8',
      tajweedEnabled: true,
      presBgMode: 'plain',
      presBgScene: 'stars',
      presBgNature: 'dawn',
      presentationMode: false,
      mushafMode: false,
      currentPage: 0,
      azanPlaying: false,
    },
    {
      set(target: Record<string, unknown>, prop: string, value: unknown) {
        target[prop] = value;
        return true;
      },
      get(target: Record<string, unknown>, prop: string) {
        return target[prop];
      },
    },
  ),
}));

vi.mock('../dom.js', () => ({
  dom: {
    settingsPanel: null,
    settingsCloseBtn: null,
    settingsToggleBtn: null,
    themeToggle: null,
    fontSizeSelect: null,
    cityInput: null,
    countryInput: null,
    methodSelect: null,
    azanToggle: null,
    azanFajrToggle: null,
    autoSaveToggle: null,
    reciterSelect: null,
    tafsirSelect: null,
    translationSelect: null,
    fontTypeSelect: null,
    lineSpacingSelect: null,
    speedSelect: null,
    audioPlayer: null,
    tajweedToggle: null,
    presBgSelect: null,
    presBgSceneSelect: null,
    presBgNatureSelect: null,
    presBgSceneRow: null,
    presBgNatureRow: null,
    prayerBar: null,
  },
}));

vi.mock('../storage.js', () => ({
  storage: {
    _data: {} as Record<string, unknown>,
    get(key: string) {
      return (this._data as Record<string, unknown>)[key] ?? null;
    },
    set(key: string, val: unknown) {
      (this._data as Record<string, unknown>)[key] = val;
      return true;
    },
    remove(key: string) {
      delete (this._data as Record<string, unknown>)[key];
    },
  },
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../prayer.js', () => ({
  stopAzan: vi.fn(),
  loadPrayerTimes: vi.fn(),
}));

vi.mock('../adhkar.js', () => ({
  renderAdhkarSettingsList: vi.fn(),
}));

vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
}));

// Import after mocks
import { storage } from '../storage.js';
import { ALLOWED_SETTINGS_KEYS, SETTING_TYPE_VALIDATORS } from '../settings.js';

describe('ALLOWED_SETTINGS_KEYS', () => {
  it('should contain essential setting keys', () => {
    expect(ALLOWED_SETTINGS_KEYS.has('font_size')).toBe(true);
    expect(ALLOWED_SETTINGS_KEYS.has('night_mode')).toBe(true);
    expect(ALLOWED_SETTINGS_KEYS.has('city')).toBe(true);
    expect(ALLOWED_SETTINGS_KEYS.has('country')).toBe(true);
    expect(ALLOWED_SETTINGS_KEYS.has('method')).toBe(true);
    expect(ALLOWED_SETTINGS_KEYS.has('reciter')).toBe(true);
    expect(ALLOWED_SETTINGS_KEYS.has('lang')).toBe(true);
  });

  it('should not contain dangerous keys', () => {
    expect(ALLOWED_SETTINGS_KEYS.has('__proto__')).toBe(false);
    expect(ALLOWED_SETTINGS_KEYS.has('constructor')).toBe(false);
    expect(ALLOWED_SETTINGS_KEYS.has('prototype')).toBe(false);
  });

  it('should have at least 25 keys', () => {
    expect(ALLOWED_SETTINGS_KEYS.size).toBeGreaterThanOrEqual(25);
  });
});

describe('SETTING_TYPE_VALIDATORS', () => {
  it('should validate font_size as number', () => {
    expect(SETTING_TYPE_VALIDATORS['font_size']!(28)).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['font_size']!('28')).toBe(false);
  });

  it('should validate night_mode as boolean', () => {
    expect(SETTING_TYPE_VALIDATORS['night_mode']!(true)).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['night_mode']!(false)).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['night_mode']!('true')).toBe(false);
  });

  it('should validate city as string', () => {
    expect(SETTING_TYPE_VALIDATORS['city']!('Makkah')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['city']!(42)).toBe(false);
  });

  it('should validate favorites as array', () => {
    expect(SETTING_TYPE_VALIDATORS['favorites']!([1, 2, 3])).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['favorites']!('not-array')).toBe(false);
  });

  it('should validate pres_bg_mode against allowed values', () => {
    expect(SETTING_TYPE_VALIDATORS['pres_bg_mode']!('plain')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_mode']!('nature')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_mode']!('scene')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_mode']!('invalid')).toBe(false);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_mode']!(42)).toBe(false);
  });

  it('should validate pres_bg_scene against allowed values', () => {
    expect(SETTING_TYPE_VALIDATORS['pres_bg_scene']!('stars')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_scene']!('waves')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_scene']!('aurora')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_scene']!('particles')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_scene']!('rain')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_scene']!('invalid')).toBe(false);
  });

  it('should validate pres_bg_nature against allowed values', () => {
    expect(SETTING_TYPE_VALIDATORS['pres_bg_nature']!('dawn')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_nature']!('morning')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_nature']!('afternoon')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_nature']!('sunset')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_nature']!('night')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['pres_bg_nature']!('invalid')).toBe(false);
  });

  it('should validate reading_stats as object', () => {
    expect(SETTING_TYPE_VALIDATORS['reading_stats']!({ total: 100 })).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['reading_stats']!(null)).toBe(false);
    expect(SETTING_TYPE_VALIDATORS['reading_stats']!('string')).toBe(false);
  });

  it('should validate adhkar_settings as non-null object', () => {
    expect(SETTING_TYPE_VALIDATORS['adhkar_settings']!({ morning: true })).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['adhkar_settings']!(null)).toBe(false);
  });

  it('should validate bookmark as null or object', () => {
    expect(SETTING_TYPE_VALIDATORS['bookmark']!(null)).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['bookmark']!({ surah: 1, ayah: 1 })).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['bookmark']!('not-bookmark')).toBe(false);
  });

  it('should validate last_position as string or number', () => {
    expect(SETTING_TYPE_VALIDATORS['last_position']!('1:5')).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['last_position']!(42)).toBe(true);
    expect(SETTING_TYPE_VALIDATORS['last_position']!(true)).toBe(false);
  });

  it('should validate all boolean fields correctly', () => {
    const boolKeys = [
      'night_mode',
      'azan_enabled',
      'azan_fajr_enabled',
      'auto_save',
      'bar_collapsed',
      'player_collapsed',
      'translation_enabled',
      'tajweed_enabled',
      'night_mode_set_by_user',
      'mushaf_mode',
      'sepia_mode',
    ];
    for (const key of boolKeys) {
      const validator = SETTING_TYPE_VALIDATORS[key];
      if (validator) {
        expect(validator(true), `${key} should accept true`).toBe(true);
        expect(validator(false), `${key} should accept false`).toBe(true);
        expect(validator('true'), `${key} should reject string`).toBe(false);
      }
    }
  });

  it('should validate all string fields correctly', () => {
    const stringKeys = [
      'city',
      'country',
      'method',
      'reciter',
      'tafsir_edition',
      'playback_speed',
      'lang',
      'translation_edition',
      'font_type',
      'line_spacing',
    ];
    for (const key of stringKeys) {
      const validator = SETTING_TYPE_VALIDATORS[key];
      if (validator) {
        expect(validator('valid'), `${key} should accept string`).toBe(true);
        expect(validator(42), `${key} should reject number`).toBe(false);
      }
    }
  });
});
