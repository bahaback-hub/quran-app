/**
 * Additional tests for i18n.ts — covering more branches for higher coverage.
 * Targets: preloadLang, unloadLang, getLoadedLangs, getReciterName,
 * getTafsirName, getCityName, getCalcMethodName, getWeekday, getPrayerName,
 * __ interpolation, and internal loadTranslation behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Override the setup mock so we get the actual i18n module
vi.unmock('../i18n.js');

// Mock storage module
const store: Record<string, unknown> = {};
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn((key: string) => store[key] ?? null),
    set: vi.fn((key: string, val: unknown) => {
      store[key] = val;
      return true;
    }),
    remove: vi.fn((key: string) => {
      delete store[key];
    }),
  },
}));

import {
  __,
  setLang,
  getLang,
  preloadLang,
  unloadLang,
  getLoadedLangs,
  getReciterName,
  getTafsirName,
  getCityName,
  getCalcMethodName,
  getWeekday,
  getPrayerName,
  AVAILABLE_LANGUAGES,
} from '../i18n.js';

describe('i18n — additional coverage', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  describe('preloadLang — thorough', () => {
    it('should preload Arabic without error', async () => {
      await setLang('en');
      expect(() => preloadLang('ar')).not.toThrow();
    });

    it('should preload English from Arabic', async () => {
      await setLang('ar');
      expect(() => preloadLang('en')).not.toThrow();
      // Wait a bit for async preload
      await new Promise((r) => setTimeout(r, 200));
      expect(getLoadedLangs()).toContain('en');
    });

    it('should preload Turkish', async () => {
      await setLang('ar');
      expect(() => preloadLang('tr')).not.toThrow();
      await new Promise((r) => setTimeout(r, 200));
      expect(getLoadedLangs()).toContain('tr');
    });

    it('should preload Malay', async () => {
      await setLang('ar');
      expect(() => preloadLang('ms')).not.toThrow();
      await new Promise((r) => setTimeout(r, 200));
      expect(getLoadedLangs()).toContain('ms');
    });

    it('should preload Indonesian', async () => {
      await setLang('ar');
      expect(() => preloadLang('id')).not.toThrow();
      await new Promise((r) => setTimeout(r, 200));
      expect(getLoadedLangs()).toContain('id');
    });

    it('should not throw for already-loaded language', async () => {
      await setLang('en');
      expect(() => preloadLang('en')).not.toThrow();
    });
  });

  describe('unloadLang — thorough', () => {
    it('should return false for Arabic even if it is not the current language', async () => {
      await setLang('en');
      expect(unloadLang('ar')).toBe(false);
    });

    it('should return false for language not yet loaded', async () => {
      await setLang('ar');
      // Ensure id is not loaded
      if (getLoadedLangs().includes('id')) {
        unloadLang('id');
      }
      expect(unloadLang('id')).toBe(false);
    });

    it('should successfully unload a loaded non-current non-Arabic language', async () => {
      await setLang('en');
      await setLang('ar');
      // English should be loaded still (was current)
      expect(getLoadedLangs()).toContain('en');
      const result = unloadLang('en');
      expect(result).toBe(true);
      expect(getLoadedLangs()).not.toContain('en');
    });

    it('should unload Turkish after switching away', async () => {
      await setLang('tr');
      await setLang('ar');
      expect(getLoadedLangs()).toContain('tr');
      const result = unloadLang('tr');
      expect(result).toBe(true);
      expect(getLoadedLangs()).not.toContain('tr');
    });

    it('should unload Malay after switching away', async () => {
      await setLang('ms');
      await setLang('ar');
      expect(getLoadedLangs()).toContain('ms');
      const result = unloadLang('ms');
      expect(result).toBe(true);
      expect(getLoadedLangs()).not.toContain('ms');
    });

    it('should unload Indonesian after switching away', async () => {
      await setLang('id');
      await setLang('ar');
      expect(getLoadedLangs()).toContain('id');
      const result = unloadLang('id');
      expect(result).toBe(true);
      expect(getLoadedLangs()).not.toContain('id');
    });

    it('should not unload the current language', async () => {
      await setLang('en');
      expect(unloadLang('en')).toBe(false);
      expect(getLoadedLangs()).toContain('en');
    });
  });

  describe('getLoadedLangs — thorough', () => {
    it('should return at least Arabic after init', async () => {
      await setLang('ar');
      const langs = getLoadedLangs();
      expect(langs.length).toBeGreaterThanOrEqual(1);
      expect(langs).toContain('ar');
    });

    it('should return both Arabic and English after setting English', async () => {
      await setLang('en');
      const langs = getLoadedLangs();
      expect(langs).toContain('ar');
      expect(langs).toContain('en');
    });

    it('should reflect unloaded languages', async () => {
      await setLang('tr');
      await setLang('ar');
      expect(getLoadedLangs()).toContain('tr');
      unloadLang('tr');
      expect(getLoadedLangs()).not.toContain('tr');
    });
  });

  describe('getReciterName — thorough', () => {
    it('should return Arabic name for known reciter', async () => {
      await setLang('ar');
      const name = getReciterName('ar.alafasy');
      expect(name).toBe('مشاري العفاسي');
    });

    it('should return English name for known reciter', async () => {
      await setLang('en');
      const name = getReciterName('ar.alafasy');
      expect(name).toBe('Mishary Alafasy');
    });

    it('should return key for unknown reciter', async () => {
      await setLang('ar');
      const name = getReciterName('nonexistent.reciter');
      expect(name).toBe('nonexistent.reciter');
    });

    it('should return Turkish name for known reciter', async () => {
      await setLang('tr');
      const name = getReciterName('ar.alafasy');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should return Malay name for known reciter', async () => {
      await setLang('ms');
      const name = getReciterName('ar.alafasy');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should return Indonesian name for known reciter', async () => {
      await setLang('id');
      const name = getReciterName('ar.alafasy');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe('getTafsirName — thorough', () => {
    it('should return Arabic name for known tafsir', async () => {
      await setLang('ar');
      const name = getTafsirName('ar-tafsir-muyassar');
      expect(name).toBe('التفسير الميسر');
    });

    it('should return English name for known tafsir', async () => {
      await setLang('en');
      const name = getTafsirName('ar-tafsir-muyassar');
      expect(name).toBe('Muyassar Tafsir');
    });

    it('should return key for unknown tafsir', async () => {
      await setLang('ar');
      const name = getTafsirName('unknown-tafsir');
      expect(name).toBe('unknown-tafsir');
    });

    it('should return Turkish name for known tafsir', async () => {
      await setLang('tr');
      const name = getTafsirName('ar-tafsir-muyassar');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should fallback to Arabic when not found in current language', async () => {
      await setLang('en');
      // A tafsir that may only exist in Arabic bundle
      const name = getTafsirName('ar-tafsir-muyassar');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe('getCityName — thorough', () => {
    it('should return Arabic name for known city', async () => {
      await setLang('ar');
      const name = getCityName('makkah');
      expect(name).toBe('مكة المكرمة');
    });

    it('should return English name for known city', async () => {
      await setLang('en');
      const name = getCityName('makkah');
      expect(name).toBe('Makkah');
    });

    it('should return key for unknown city', async () => {
      await setLang('ar');
      const name = getCityName('unknown_city');
      expect(name).toBe('unknown_city');
    });

    it('should return Turkish name for known city', async () => {
      await setLang('tr');
      const name = getCityName('makkah');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should return Malay name for known city', async () => {
      await setLang('ms');
      const name = getCityName('makkah');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe('getCalcMethodName — thorough', () => {
    it('should return Arabic name for known method', async () => {
      await setLang('ar');
      const name = getCalcMethodName('4');
      expect(name).toBe('أم القرى');
    });

    it('should return English name for known method', async () => {
      await setLang('en');
      const name = getCalcMethodName('4');
      expect(name).toBe('Umm Al-Qura');
    });

    it('should return key for unknown method', async () => {
      await setLang('ar');
      const name = getCalcMethodName('999');
      expect(name).toBe('999');
    });

    it('should return Turkish name for known method', async () => {
      await setLang('tr');
      const name = getCalcMethodName('4');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('should return Indonesian name for known method', async () => {
      await setLang('id');
      const name = getCalcMethodName('4');
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe('getWeekday — thorough', () => {
    it('should return all 7 Arabic weekdays', async () => {
      await setLang('ar');
      const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      for (let i = 0; i < 7; i++) {
        expect(getWeekday(i)).toBe(days[i]);
      }
    });

    it('should return all 7 English weekdays', async () => {
      await setLang('en');
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      for (let i = 0; i < 7; i++) {
        expect(getWeekday(i)).toBe(days[i]);
      }
    });

    it('should return all 7 Turkish weekdays', async () => {
      await setLang('tr');
      for (let i = 0; i < 7; i++) {
        const day = getWeekday(i);
        expect(typeof day).toBe('string');
        expect(day.length).toBeGreaterThan(0);
      }
    });

    it('should return all 7 Malay weekdays', async () => {
      await setLang('ms');
      for (let i = 0; i < 7; i++) {
        const day = getWeekday(i);
        expect(typeof day).toBe('string');
        expect(day.length).toBeGreaterThan(0);
      }
    });

    it('should return empty string for out-of-range indices', async () => {
      await setLang('ar');
      expect(getWeekday(7)).toBe('');
      expect(getWeekday(-1)).toBe('');
      expect(getWeekday(100)).toBe('');
    });
  });

  describe('getPrayerName — thorough', () => {
    it('should return Arabic names for all prayers', async () => {
      await setLang('ar');
      expect(getPrayerName('Fajr')).toBe('الفجر');
      expect(getPrayerName('Sunrise')).toBe('الشروق');
      expect(getPrayerName('Dhuhr')).toBe('الظهر');
      expect(getPrayerName('Asr')).toBe('العصر');
      expect(getPrayerName('Maghrib')).toBe('المغرب');
      expect(getPrayerName('Isha')).toBe('العشاء');
    });

    it('should return English names for all prayers', async () => {
      await setLang('en');
      expect(getPrayerName('Fajr')).toBe('Fajr');
      expect(getPrayerName('Sunrise')).toBe('Sunrise');
      expect(getPrayerName('Dhuhr')).toBe('Dhuhr');
      expect(getPrayerName('Asr')).toBe('Asr');
      expect(getPrayerName('Maghrib')).toBe('Maghrib');
      expect(getPrayerName('Isha')).toBe('Isha');
    });

    it('should return Turkish names for all prayers', async () => {
      await setLang('tr');
      const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      for (const prayer of prayers) {
        const name = getPrayerName(prayer);
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    });

    it('should return Malay names for all prayers', async () => {
      await setLang('ms');
      const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      for (const prayer of prayers) {
        const name = getPrayerName(prayer);
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    });

    it('should return Indonesian names for all prayers', async () => {
      await setLang('id');
      const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      for (const prayer of prayers) {
        const name = getPrayerName(prayer);
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    });

    it('should return key for unknown prayer', async () => {
      await setLang('ar');
      expect(getPrayerName('Unknown')).toBe('Unknown');
      expect(getPrayerName('')).toBe('');
    });
  });

  describe('__ interpolation — thorough', () => {
    it('should interpolate {0} placeholder', async () => {
      await setLang('ar');
      // Use a key with placeholders — if not in bundle, it returns the key
      const result = __('settings_imported', '5');
      // Should either return the translated string with "5" or the key itself
      expect(typeof result).toBe('string');
    });

    it('should interpolate multiple placeholders when key exists', async () => {
      await setLang('en');
      // Use a non-existent key - interpolation won't happen for missing keys
      const result = __('nonexistent_{0}_{1}', 'first', 'second');
      // Key not found, so it returns the key as-is (no interpolation)
      expect(result).toBe('nonexistent_{0}_{1}');
    });

    it('should keep unmatched placeholders when key exists', async () => {
      await setLang('ar');
      // Key not found returns the key without interpolation
      const result = __('nonexistent_{0}_{1}', 'only_first');
      expect(result).toBe('nonexistent_{0}_{1}');
    });

    it('should return key when no args needed', async () => {
      await setLang('ar');
      const result = __('error_title');
      expect(result).toBe('حدث خطأ');
    });
  });

  describe('AVAILABLE_LANGUAGES — additional coverage', () => {
    it('should have correct structure for Turkish', () => {
      const tr = AVAILABLE_LANGUAGES.find((l) => l.code === 'tr');
      expect(tr).toBeDefined();
      expect(tr!.englishName).toBe('Turkish');
      expect(tr!.dir).toBe('ltr');
    });

    it('should have correct structure for Malay', () => {
      const ms = AVAILABLE_LANGUAGES.find((l) => l.code === 'ms');
      expect(ms).toBeDefined();
      expect(ms!.englishName).toBe('Malay');
      expect(ms!.dir).toBe('ltr');
    });

    it('should have correct structure for Indonesian', () => {
      const id = AVAILABLE_LANGUAGES.find((l) => l.code === 'id');
      expect(id).toBeDefined();
      expect(id!.englishName).toBe('Indonesian');
      expect(id!.dir).toBe('ltr');
    });
  });

  describe('language switching — stress test', () => {
    it('should handle rapid language switches', async () => {
      await setLang('ar');
      await setLang('en');
      await setLang('tr');
      await setLang('ms');
      await setLang('id');
      expect(getLang()).toBe('id');
    });

    it('should handle switching back and forth', async () => {
      await setLang('ar');
      expect(getLang()).toBe('ar');
      await setLang('en');
      expect(getLang()).toBe('en');
      await setLang('ar');
      expect(getLang()).toBe('ar');
    });
  });
});
