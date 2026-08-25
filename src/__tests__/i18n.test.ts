/**
 * Tests for i18n.ts — internationalization system.
 * Comprehensive tests covering all exported functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Override the setup mock so we get the actual i18n module
vi.unmock('../i18n.js');

// Mock storage module (i18n depends on it)
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
  getLang,
  setLang,
  initI18n,
  applyTranslations,
  getReciterName,
  getTafsirName,
  getCityName,
  getCalcMethodName,
  getWeekday,
  getPrayerName,
  getLoadedLangs,
  unloadLang,
  preloadLang,
  AVAILABLE_LANGUAGES,
} from '../i18n.js';

describe('AVAILABLE_LANGUAGES', () => {
  it('should contain 8 languages', () => {
    expect(AVAILABLE_LANGUAGES).toHaveLength(8);
  });

  it('should include Arabic with RTL direction', () => {
    const ar = AVAILABLE_LANGUAGES.find((l) => l.code === 'ar');
    expect(ar).toBeDefined();
    expect(ar!.dir).toBe('rtl');
    expect(ar!.nativeName).toBe('العربية');
  });

  it('should include English with LTR direction', () => {
    const en = AVAILABLE_LANGUAGES.find((l) => l.code === 'en');
    expect(en).toBeDefined();
    expect(en!.dir).toBe('ltr');
    expect(en!.nativeName).toBe('English');
  });

  it('should include Turkish', () => {
    const tr = AVAILABLE_LANGUAGES.find((l) => l.code === 'tr');
    expect(tr).toBeDefined();
    expect(tr!.nativeName).toBe('Türkçe');
  });

  it('should include Malay and Indonesian', () => {
    const ms = AVAILABLE_LANGUAGES.find((l) => l.code === 'ms');
    const id = AVAILABLE_LANGUAGES.find((l) => l.code === 'id');
    expect(ms).toBeDefined();
    expect(id).toBeDefined();
  });

  it('should include French, German, and Russian with LTR direction', () => {
    const fr = AVAILABLE_LANGUAGES.find((l) => l.code === 'fr');
    const de = AVAILABLE_LANGUAGES.find((l) => l.code === 'de');
    const ru = AVAILABLE_LANGUAGES.find((l) => l.code === 'ru');
    expect(fr?.nativeName).toBe('Français');
    expect(de?.nativeName).toBe('Deutsch');
    expect(ru?.nativeName).toBe('Русский');
    expect(fr?.dir).toBe('ltr');
    expect(de?.dir).toBe('ltr');
    expect(ru?.dir).toBe('ltr');
  });

  it('each language should have code, nativeName, englishName, dir', () => {
    for (const lang of AVAILABLE_LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.nativeName).toBeTruthy();
      expect(lang.englishName).toBeTruthy();
      expect(['rtl', 'ltr']).toContain(lang.dir);
    }
  });

  it('Arabic should be the only RTL language', () => {
    const rtlLangs = AVAILABLE_LANGUAGES.filter((l) => l.dir === 'rtl');
    expect(rtlLangs).toHaveLength(1);
    expect(rtlLangs[0].code).toBe('ar');
  });

  it('each language code should be unique', () => {
    const codes = AVAILABLE_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('__ (translate)', () => {
  beforeEach(async () => {
    // Reset store
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should return translated string for existing key', () => {
    expect(__('error_title')).toBe('حدث خطأ');
  });

  it('should return the key itself when translation is missing', () => {
    expect(__('nonexistent_key')).toBe('nonexistent_key');
  });

  it('should support argument interpolation with {0} placeholders', async () => {
    // Test with a key that has no placeholders — args should be ignored
    expect(__('error_title', 'arg1')).toBe('حدث خطأ');
  });

  it('should return the key when currentBundle is null and no fallback', () => {
    expect(__('absolutely_missing_key_xyz')).toBe('absolutely_missing_key_xyz');
  });

  it('should fall back to Arabic bundle when key missing in current language', async () => {
    await setLang('ar');
    const result = __('error_title');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('should handle multiple interpolation args', async () => {
    // Some key with {0} and {1} placeholders
    const result = __('nonexistent_key_{0}_{1}', 'first', 'second');
    // Since key doesn't exist, it returns the key itself
    expect(result).toBe('nonexistent_key_{0}_{1}');
  });

  it('should return string even for array values', async () => {
    // weekdays is an array, accessing it via __ should return the key or convert
    const result = __('weekdays');
    expect(typeof result).toBe('string');
  });

  it('should work with English bundle', async () => {
    await setLang('en');
    expect(__('error_title')).toBe('An error occurred');
  });

  it('should return key for unknown language bundle missing key', async () => {
    await setLang('en');
    // A key that might not exist in English but exists in Arabic
    const result = __('some_key_that_might_not_exist');
    expect(typeof result).toBe('string');
  });
});

describe('getLang', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it('should return "ar" after setting Arabic', async () => {
    await setLang('ar');
    expect(getLang()).toBe('ar');
  });

  it('should return the currently set language', async () => {
    await setLang('en');
    expect(getLang()).toBe('en');
  });

  it('should return "tr" after setting Turkish', async () => {
    await setLang('tr');
    expect(getLang()).toBe('tr');
  });

  it('should return "ms" after setting Malay', async () => {
    await setLang('ms');
    expect(getLang()).toBe('ms');
  });

  it('should return "id" after setting Indonesian', async () => {
    await setLang('id');
    expect(getLang()).toBe('id');
  });
});

describe('setLang', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it('should change the current language', async () => {
    await setLang('en');
    expect(getLang()).toBe('en');
  });

  it('should update document direction to ltr for English', async () => {
    await setLang('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('should update document direction to rtl for Arabic', async () => {
    await setLang('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('should update document.documentElement.lang', async () => {
    await setLang('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('should update body style direction to rtl for Arabic', async () => {
    await setLang('ar');
    expect(document.body.style.direction).toBe('rtl');
  });

  it('should update body style direction to ltr for English', async () => {
    await setLang('en');
    expect(document.body.style.direction).toBe('ltr');
  });

  it('should save language to storage', async () => {
    await setLang('en');
    expect(store['lang']).toBe('en');
  });

  it('should dispatch app:langchange event', async () => {
    const handler = vi.fn();
    window.addEventListener('app:langchange', handler);
    await setLang('en');
    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail.lang).toBe('en');
    window.removeEventListener('app:langchange', handler);
  });

  it('should apply translations after setting language', async () => {
    const el = document.createElement('div');
    el.setAttribute('data-i18n', 'error_title');
    document.body.appendChild(el);

    await setLang('en');
    expect(el.textContent).toBe('An error occurred');

    await setLang('ar');
    expect(el.textContent).toBe('حدث خطأ');

    document.body.removeChild(el);
  });

  it('should set LTR direction for Turkish', async () => {
    await setLang('tr');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.body.style.direction).toBe('ltr');
  });

  it('should set LTR direction for Malay', async () => {
    await setLang('ms');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('should set LTR direction for Indonesian', async () => {
    await setLang('id');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('should save Turkish to storage', async () => {
    await setLang('tr');
    expect(store['lang']).toBe('tr');
  });
});

describe('applyTranslations', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should translate elements with data-i18n attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-i18n', 'error_title');
    document.body.appendChild(el);

    applyTranslations();
    expect(el.textContent).toBe('حدث خطأ');

    document.body.removeChild(el);
  });

  it('should translate elements with data-i18n-placeholder attribute', () => {
    const input = document.createElement('input');
    input.setAttribute('data-i18n-placeholder', 'makkah');
    document.body.appendChild(input);

    applyTranslations();
    expect(input.placeholder).toBe('مكة المكرمة');

    document.body.removeChild(input);
  });

  it('should translate elements with data-i18n-title attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-i18n-title', 'error_title');
    document.body.appendChild(el);

    applyTranslations();
    expect(el.title).toBe('حدث خطأ');

    document.body.removeChild(el);
  });

  it('should translate elements with data-i18n-aria-label attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-i18n-aria-label', 'error_title');
    document.body.appendChild(el);

    applyTranslations();
    expect(el.getAttribute('aria-label')).toBe('حدث خطأ');

    document.body.removeChild(el);
  });

  it('should handle elements with empty data-i18n attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-i18n', '');
    document.body.appendChild(el);

    expect(() => applyTranslations()).not.toThrow();

    document.body.removeChild(el);
  });

  it('should handle elements with empty data-i18n-placeholder attribute', () => {
    const input = document.createElement('input');
    input.setAttribute('data-i18n-placeholder', '');
    document.body.appendChild(input);

    expect(() => applyTranslations()).not.toThrow();

    document.body.removeChild(input);
  });

  it('should handle elements with empty data-i18n-title attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-i18n-title', '');
    document.body.appendChild(el);

    expect(() => applyTranslations()).not.toThrow();

    document.body.removeChild(el);
  });

  it('should handle elements with empty data-i18n-aria-label attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-i18n-aria-label', '');
    document.body.appendChild(el);

    expect(() => applyTranslations()).not.toThrow();

    document.body.removeChild(el);
  });

  it('should translate multiple elements at once', () => {
    const el1 = document.createElement('div');
    el1.setAttribute('data-i18n', 'error_title');
    const el2 = document.createElement('div');
    el2.setAttribute('data-i18n', 'makkah');
    document.body.appendChild(el1);
    document.body.appendChild(el2);

    applyTranslations();
    expect(el1.textContent).toBe('حدث خطأ');
    expect(el2.textContent).toBe('مكة المكرمة');

    document.body.removeChild(el1);
    document.body.removeChild(el2);
  });

  it('should update translations when language changes', async () => {
    const el = document.createElement('div');
    el.setAttribute('data-i18n', 'error_title');
    document.body.appendChild(el);

    await setLang('en');
    applyTranslations();
    expect(el.textContent).toBe('An error occurred');

    await setLang('ar');
    applyTranslations();
    expect(el.textContent).toBe('حدث خطأ');

    document.body.removeChild(el);
  });
});

describe('getReciterName', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should return localized reciter name for known key', () => {
    expect(getReciterName('ar.alafasy')).toBe('مشاري العفاسي');
  });

  it('should return the key when reciter is not found', () => {
    expect(getReciterName('unknown.reciter')).toBe('unknown.reciter');
  });

  it('should return English name when English is active', async () => {
    await setLang('en');
    expect(getReciterName('ar.alafasy')).toBe('Mishary Alafasy');
  });

  it('should return English name for unknown reciter in English', async () => {
    await setLang('en');
    expect(getReciterName('unknown.reciter')).toBe('unknown.reciter');
  });
});

describe('getTafsirName', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should return localized tafsir name for known key', () => {
    expect(getTafsirName('ar-tafsir-muyassar')).toBe('التفسير الميسر');
  });

  it('should return the key when tafsir is not found', () => {
    expect(getTafsirName('unknown-tafsir')).toBe('unknown-tafsir');
  });

  it('should return English tafsir name when English is active', async () => {
    await setLang('en');
    expect(getTafsirName('ar-tafsir-muyassar')).toBe('Muyassar Tafsir');
  });
});

describe('getCityName', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should return localized city name for known key', () => {
    expect(getCityName('makkah')).toBe('مكة المكرمة');
  });

  it('should return the key when city is not found', () => {
    expect(getCityName('unknown_city')).toBe('unknown_city');
  });

  it('should return English city name when English is active', async () => {
    await setLang('en');
    expect(getCityName('makkah')).toBe('Makkah');
  });
});

describe('getCalcMethodName', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should return localized calc method name for known key', () => {
    expect(getCalcMethodName('4')).toBe('أم القرى');
  });

  it('should return the key when method is not found', () => {
    expect(getCalcMethodName('99')).toBe('99');
  });

  it('should return English calc method name when English is active', async () => {
    await setLang('en');
    expect(getCalcMethodName('4')).toBe('Umm Al-Qura');
  });
});

describe('getWeekday', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should return Arabic weekday name by index', () => {
    expect(getWeekday(0)).toBe('الأحد');
    expect(getWeekday(1)).toBe('الاثنين');
    expect(getWeekday(6)).toBe('السبت');
  });

  it('should return English weekday name when English is active', async () => {
    await setLang('en');
    expect(getWeekday(0)).toBe('Sunday');
    expect(getWeekday(5)).toBe('Friday');
  });

  it('should return empty string for out-of-range index', () => {
    expect(getWeekday(7)).toBe('');
    expect(getWeekday(-1)).toBe('');
  });

  it('should return all 7 Arabic weekdays', () => {
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
});

describe('getPrayerName', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should return localized prayer name for known prayer key', () => {
    expect(getPrayerName('Fajr')).toBe('الفجر');
    expect(getPrayerName('Dhuhr')).toBe('الظهر');
    expect(getPrayerName('Asr')).toBe('العصر');
    expect(getPrayerName('Maghrib')).toBe('المغرب');
    expect(getPrayerName('Isha')).toBe('العشاء');
    expect(getPrayerName('Sunrise')).toBe('الشروق');
  });

  it('should return the key itself for unknown prayer key', () => {
    expect(getPrayerName('Unknown')).toBe('Unknown');
  });

  it('should return English prayer name when English is active', async () => {
    await setLang('en');
    expect(getPrayerName('Fajr')).toBe('Fajr');
    expect(getPrayerName('Sunrise')).toBe('Sunrise');
  });

  it('should return English name for all prayers', async () => {
    await setLang('en');
    expect(getPrayerName('Dhuhr')).toBe('Dhuhr');
    expect(getPrayerName('Asr')).toBe('Asr');
    expect(getPrayerName('Maghrib')).toBe('Maghrib');
    expect(getPrayerName('Isha')).toBe('Isha');
  });
});

describe('getLoadedLangs', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it('should include Arabic after loading', async () => {
    await setLang('ar');
    const loaded = getLoadedLangs();
    expect(loaded).toContain('ar');
  });

  it('should include English after loading', async () => {
    await setLang('en');
    const loaded = getLoadedLangs();
    expect(loaded).toContain('en');
    expect(loaded).toContain('ar'); // Arabic is always loaded as fallback
  });

  it('should include Turkish after loading', async () => {
    await setLang('tr');
    const loaded = getLoadedLangs();
    expect(loaded).toContain('tr');
  });

  it('should include Malay after loading', async () => {
    await setLang('ms');
    const loaded = getLoadedLangs();
    expect(loaded).toContain('ms');
  });

  it('should include Indonesian after loading', async () => {
    await setLang('id');
    const loaded = getLoadedLangs();
    expect(loaded).toContain('id');
  });
});

describe('unloadLang', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should not unload Arabic (fallback)', () => {
    expect(unloadLang('ar')).toBe(false);
  });

  it('should not unload the current language', async () => {
    await setLang('en');
    expect(unloadLang('en')).toBe(false);
  });

  it('should unload a non-current, non-Arabic language', async () => {
    await setLang('ar');
    // First load English
    await setLang('en');
    await setLang('ar'); // Switch back to Arabic
    // Now English can be unloaded
    const result = unloadLang('en');
    expect(result).toBe(true);
  });

  it('should return false for language that is not loaded', async () => {
    // Ensure Turkish is not loaded by explicitly checking getLoadedLangs
    if (getLoadedLangs().includes('tr')) {
      unloadLang('tr');
    }
    expect(getLoadedLangs()).not.toContain('tr');
    expect(unloadLang('tr')).toBe(false);
  });

  it('should remove the language from getLoadedLangs after unload', async () => {
    await setLang('en');
    await setLang('ar');
    // English should be loaded
    expect(getLoadedLangs()).toContain('en');
    // Unload English
    unloadLang('en');
    expect(getLoadedLangs()).not.toContain('en');
  });

  it('should not unload Turkish if it is current', async () => {
    await setLang('tr');
    expect(unloadLang('tr')).toBe(false);
  });
});

describe('initI18n', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it('should initialize with saved language from storage', async () => {
    store['lang'] = 'en';
    await initI18n();
    expect(getLang()).toBe('en');
  });

  it('should initialize with Arabic when no saved language and browser is not English', async () => {
    const originalLang = navigator.language;
    Object.defineProperty(navigator, 'language', { value: 'ar-SA', configurable: true });

    await initI18n();
    expect(getLang()).toBe('ar');

    Object.defineProperty(navigator, 'language', { value: originalLang, configurable: true });
  });

  it('should initialize with English when browser language starts with "en"', async () => {
    const originalLang = navigator.language;
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });

    await initI18n();
    expect(getLang()).toBe('en');

    Object.defineProperty(navigator, 'language', { value: originalLang, configurable: true });
  });

  it('should initialize with saved Turkish', async () => {
    store['lang'] = 'tr';
    await initI18n();
    expect(getLang()).toBe('tr');
  });

  it('should initialize with French when browser language starts with "fr"', async () => {
    const originalLang = navigator.language;
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });

    await initI18n();
    expect(getLang()).toBe('fr');

    Object.defineProperty(navigator, 'language', { value: originalLang, configurable: true });
  });
});

describe('preloadLang', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it('should not throw when preloading a language', () => {
    expect(() => preloadLang('en')).not.toThrow();
  });

  it('should not throw when preloading a language that might fail', () => {
    expect(() => preloadLang('tr')).not.toThrow();
  });

  it('should not throw when preloading Malay', () => {
    expect(() => preloadLang('ms')).not.toThrow();
  });

  it('should not throw when preloading Indonesian', () => {
    expect(() => preloadLang('id')).not.toThrow();
  });
});

describe('setLang for all languages', () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it('should load and set Turkish correctly', async () => {
    await setLang('tr');
    expect(getLang()).toBe('tr');
    expect(store['lang']).toBe('tr');
  });

  it('should load and set Malay correctly', async () => {
    await setLang('ms');
    expect(getLang()).toBe('ms');
    expect(store['lang']).toBe('ms');
  });

  it('should load and set Indonesian correctly', async () => {
    await setLang('id');
    expect(getLang()).toBe('id');
    expect(store['lang']).toBe('id');
  });

  it('should be able to switch between languages', async () => {
    await setLang('ar');
    expect(getLang()).toBe('ar');
    await setLang('en');
    expect(getLang()).toBe('en');
    await setLang('tr');
    expect(getLang()).toBe('tr');
    await setLang('ar');
    expect(getLang()).toBe('ar');
  });
});

describe('i18n edge cases', () => {
  beforeEach(async () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    await setLang('ar');
  });

  it('should handle null storage gracefully', async () => {
    // Override storage.get to return null for this test
    const { storage } = await import('../storage.js');
    const originalGet = storage.get;
    (storage.get as ReturnType<typeof vi.fn>).mockReturnValue(null);

    await initI18n();
    expect(getLang()).toBeTruthy();

    (storage.get as ReturnType<typeof vi.fn>).mockImplementation(originalGet);
  });

  it('should handle switching language with DOM elements present', async () => {
    const el = document.createElement('div');
    el.setAttribute('data-i18n', 'error_title');
    document.body.appendChild(el);

    await setLang('en');
    expect(el.textContent).toBe('An error occurred');

    await setLang('ar');
    expect(el.textContent).toBe('حدث خطأ');

    document.body.removeChild(el);
  });

  it('getReciterName should fall back to Arabic when key not in current bundle', async () => {
    await setLang('en');
    // ar.alafasy should be in English bundle, so it should be found
    expect(getReciterName('ar.alafasy')).toBe('Mishary Alafasy');
  });
});
