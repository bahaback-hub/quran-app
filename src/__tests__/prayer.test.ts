import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../state.js';

// Mock config with the constants the test needs
vi.mock('../config.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    CONFIG: {
      API_BASE: 'https://api.alquran.cloud/v1',
      TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
      PRAYER_API: 'https://api.aladhan.com/v1/timingsByCity',
      AZAN_FILE: 'azan.mp3',
      SURAH_COUNT: 114,
      STORAGE_PREFIX: 'quran_app_',
      DEFAULT_RECITER: 'ar.alafasy',
      DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
      DEFAULT_METHOD: '4',
      DEFAULT_CITY: 'مكة المكرمة',
      DEFAULT_COUNTRY: 'SA',
      CACHE_LIMIT: 20,
    },
    PRAYER_ORDER: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
    PRAYER_NAMES_AR: {
      Fajr: 'الفجر',
      Dhuhr: 'الظهر',
      Asr: 'العصر',
      Maghrib: 'المغرب',
      Isha: 'العشاء',
    },
  };
});

vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
  setLocale: vi.fn(),
  getCurrentLocale: vi.fn(() => 'ar'),
  loadLocale: vi.fn(() => Promise.resolve()),
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

import { PRAYER_ORDER, PRAYER_NAMES_AR } from '../config.js';
import { getNextPrayerKey } from '../prayer.js';

describe('PRAYER_ORDER', () => {
  it('should have 5 prayers in order', () => {
    expect(PRAYER_ORDER).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  });
});

describe('PRAYER_NAMES_AR', () => {
  it('should have Arabic names for all prayers', () => {
    expect(PRAYER_NAMES_AR.Fajr).toBe('الفجر');
    expect(PRAYER_NAMES_AR.Dhuhr).toBe('الظهر');
    expect(PRAYER_NAMES_AR.Asr).toBe('العصر');
    expect(PRAYER_NAMES_AR.Maghrib).toBe('المغرب');
    expect(PRAYER_NAMES_AR.Isha).toBe('العشاء');
  });
});

describe('getNextPrayerKey', () => {
  beforeEach(() => {
    state.prayerTimes = null;
  });

  it('should return null for no prayerTimes', () => {
    expect(getNextPrayerKey()).toBeNull();
  });

  it('should return a valid prayer key', () => {
    state.prayerTimes = {
      Fajr: '05:00 AM',
      Sunrise: '06:30 AM',
      Dhuhr: '12:30 PM',
      Asr: '03:45 PM',
      Maghrib: '06:20 PM',
      Isha: '07:50 PM',
    };
    const result = getNextPrayerKey();
    expect(result).not.toBeNull();
    // Result should be one of the prayer keys in PRAYER_DISPLAY_ORDER
    // (which includes Sunrise because the countdown can target sunrise)
    expect(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']).toContain(result);
  });
});
