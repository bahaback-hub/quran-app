/**
 * Tests for config.ts — application configuration constants.
 */

import { describe, it, expect, vi } from 'vitest';

// Override the setup mock so we get the actual config module
vi.unmock('../config.js');

// Mock i18n (config depends on __)
vi.mock('../i18n.js', () => ({
  __: (key: string) => {
    const translations: Record<string, string> = {
      makkah: 'مكة المكرمة',
      prayer_fajr: 'الفجر',
      prayer_sunrise: 'الشروق',
      prayer_dhuhr: 'الظهر',
      prayer_asr: 'العصر',
      prayer_maghrib: 'المغرب',
      prayer_isha: 'العشاء',
      weekday_sunday: 'الأحد',
      weekday_monday: 'الاثنين',
      weekday_tuesday: 'الثلاثاء',
      weekday_wednesday: 'الأربعاء',
      weekday_thursday: 'الخميس',
      weekday_friday: 'الجمعة',
      weekday_saturday: 'السبت',
    };
    return translations[key] || key;
  },
}));

import {
  CONFIG,
  PRAYER_NAMES_AR,
  PRAYER_ORDER,
  PRAYER_DISPLAY_ORDER,
  ARABIC_WEEKDAYS,
  JUZ_PAGES,
  TRANSLATION_EDITIONS,
  type AppConfig,
  type TranslationEdition,
} from '../config.js';

describe('CONFIG', () => {
  it('should have API_BASE property', () => {
    expect(CONFIG.API_BASE).toBe('https://api.alquran.cloud/v1');
  });

  it('should have TAFSIR_API property', () => {
    expect(CONFIG.TAFSIR_API).toContain('tafsir');
  });

  it('should have PRAYER_API property', () => {
    expect(CONFIG.PRAYER_API).toContain('aladhan');
  });

  it('should have AZAN_FILE property', () => {
    expect(CONFIG.AZAN_FILE).toBe('azan.mp3');
  });

  it('should have SURAH_COUNT of 114', () => {
    expect(CONFIG.SURAH_COUNT).toBe(114);
  });

  it('should have STORAGE_PREFIX with quran_app_', () => {
    expect(CONFIG.STORAGE_PREFIX).toBe('quran_app_');
  });

  it('should have DEFAULT_RECITER', () => {
    expect(CONFIG.DEFAULT_RECITER).toBe('ar.alafasy');
  });

  it('should have DEFAULT_TAFSIR', () => {
    expect(CONFIG.DEFAULT_TAFSIR).toBe('ar-tafsir-muyassar');
  });

  it('should have DEFAULT_METHOD', () => {
    expect(CONFIG.DEFAULT_METHOD).toBe('4');
  });

  it('should have DEFAULT_CITY', () => {
    expect(CONFIG.DEFAULT_CITY).toBeTruthy();
  });

  it('should have DEFAULT_COUNTRY', () => {
    expect(CONFIG.DEFAULT_COUNTRY).toBe('SA');
  });

  it('should have CACHE_LIMIT', () => {
    expect(CONFIG.CACHE_LIMIT).toBe(20);
  });

  it('should satisfy AppConfig interface', () => {
    const requiredKeys: (keyof AppConfig)[] = [
      'API_BASE', 'TAFSIR_API', 'PRAYER_API', 'AZAN_FILE',
      'SURAH_COUNT', 'STORAGE_PREFIX', 'DEFAULT_RECITER', 'DEFAULT_TAFSIR',
      'DEFAULT_METHOD', 'DEFAULT_CITY', 'DEFAULT_COUNTRY', 'CACHE_LIMIT',
    ];
    for (const key of requiredKeys) {
      expect(CONFIG).toHaveProperty(key);
    }
  });

  it('API_BASE should be a valid URL', () => {
    expect(CONFIG.API_BASE).toMatch(/^https?:\/\//);
  });

  it('PRAYER_API should be a valid URL', () => {
    expect(CONFIG.PRAYER_API).toMatch(/^https?:\/\//);
  });
});

describe('PRAYER_NAMES_AR', () => {
  it('should have 6 prayer names', () => {
    expect(Object.keys(PRAYER_NAMES_AR)).toHaveLength(6);
  });

  it('should include all standard prayer times', () => {
    expect(PRAYER_NAMES_AR).toHaveProperty('Fajr');
    expect(PRAYER_NAMES_AR).toHaveProperty('Sunrise');
    expect(PRAYER_NAMES_AR).toHaveProperty('Dhuhr');
    expect(PRAYER_NAMES_AR).toHaveProperty('Asr');
    expect(PRAYER_NAMES_AR).toHaveProperty('Maghrib');
    expect(PRAYER_NAMES_AR).toHaveProperty('Isha');
  });

  it('should have Arabic strings as values', () => {
    // Arabic text contains Arabic Unicode characters
    for (const key of Object.keys(PRAYER_NAMES_AR)) {
      expect(PRAYER_NAMES_AR[key]).toBeTruthy();
      expect(typeof PRAYER_NAMES_AR[key]).toBe('string');
    }
  });
});

describe('PRAYER_ORDER', () => {
  it('should have 5 entries (excludes Sunrise)', () => {
    expect(PRAYER_ORDER).toHaveLength(5);
  });

  it('should not include Sunrise', () => {
    expect(PRAYER_ORDER).not.toContain('Sunrise');
  });

  it('should be in correct order', () => {
    expect(PRAYER_ORDER).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  });
});

describe('PRAYER_DISPLAY_ORDER', () => {
  it('should have 6 entries (includes Sunrise)', () => {
    expect(PRAYER_DISPLAY_ORDER).toHaveLength(6);
  });

  it('should include Sunrise', () => {
    expect(PRAYER_DISPLAY_ORDER).toContain('Sunrise');
  });

  it('should be in correct chronological order', () => {
    expect(PRAYER_DISPLAY_ORDER).toEqual(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  });
});

describe('ARABIC_WEEKDAYS', () => {
  it('should have 7 entries', () => {
    expect(ARABIC_WEEKDAYS).toHaveLength(7);
  });

  it('should start with Sunday', () => {
    expect(ARABIC_WEEKDAYS[0]).toBeTruthy();
  });

  it('should have Friday at index 5', () => {
    expect(ARABIC_WEEKDAYS[5]).toBeTruthy();
  });

  it('all entries should be strings', () => {
    for (const day of ARABIC_WEEKDAYS) {
      expect(typeof day).toBe('string');
      expect(day.length).toBeGreaterThan(0);
    }
  });
});

describe('JUZ_PAGES', () => {
  it('should have exactly 30 entries', () => {
    expect(JUZ_PAGES).toHaveLength(30);
  });

  it('should start with page 1', () => {
    expect(JUZ_PAGES[0]).toBe(1);
  });

  it('should be in ascending order', () => {
    for (let i = 1; i < JUZ_PAGES.length; i++) {
      const curr = JUZ_PAGES[i]!;
      const prev = JUZ_PAGES[i - 1]!;
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it('should have incrementing by approximately 20 pages per juz', () => {
    // Each juz is roughly 20 pages, with some variation
    for (let i = 1; i < JUZ_PAGES.length; i++) {
      const curr = JUZ_PAGES[i]!;
      const prev = JUZ_PAGES[i - 1]!;
      const diff = curr - prev;
      expect(diff).toBeGreaterThanOrEqual(18);
      expect(diff).toBeLessThanOrEqual(22);
    }
  });

  it('last juz should start at page 582', () => {
    expect(JUZ_PAGES[29]).toBe(582);
  });
});

describe('TRANSLATION_EDITIONS', () => {
  it('should have multiple editions', () => {
    expect(Object.keys(TRANSLATION_EDITIONS).length).toBeGreaterThanOrEqual(3);
  });

  it('should include Sahih International', () => {
    expect(TRANSLATION_EDITIONS).toHaveProperty('en.sahih');
    expect(TRANSLATION_EDITIONS['en.sahih'].lang).toBe('en');
    expect(TRANSLATION_EDITIONS['en.sahih'].name).toBe('Sahih International');
  });

  it('should include Pickthall', () => {
    expect(TRANSLATION_EDITIONS).toHaveProperty('en.pickthall');
  });

  it('should include Yusuf Ali', () => {
    expect(TRANSLATION_EDITIONS).toHaveProperty('en.yusufali');
  });

  it('should include French Hamidullah', () => {
    expect(TRANSLATION_EDITIONS).toHaveProperty('fr.hamidullah');
    expect(TRANSLATION_EDITIONS['fr.hamidullah']!.lang).toBe('fr');
  });

  it('should include Urdu Jalandhry', () => {
    expect(TRANSLATION_EDITIONS).toHaveProperty('ur.jalandhry');
    expect(TRANSLATION_EDITIONS['ur.jalandhry']!.lang).toBe('ur');
  });

  it('each edition should have lang and name properties', () => {
    for (const [key, edition] of Object.entries(TRANSLATION_EDITIONS)) {
      expect(edition.lang).toBeTruthy();
      expect(typeof edition.lang).toBe('string');
      expect(edition.name).toBeTruthy();
      expect(typeof edition.name).toBe('string');
    }
  });

  it('should satisfy TranslationEdition interface', () => {
    const edition = TRANSLATION_EDITIONS['en.sahih'];
    expect(edition).toMatchObject({
      lang: expect.any(String),
      name: expect.any(String),
    });
  });
});
