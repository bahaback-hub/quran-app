/** Application configuration constants interface. */
export interface AppConfig {
  API_BASE: string;
  TAFSIR_API: string;
  PRAYER_API: string;
  AZAN_FILE: string;
  SURAH_COUNT: number;
  STORAGE_PREFIX: string;
  DEFAULT_RECITER: string;
  DEFAULT_TAFSIR: string;
  DEFAULT_METHOD: string;
  DEFAULT_CITY: string;
  DEFAULT_COUNTRY: string;
  CACHE_LIMIT: number;
}

/** Translation edition metadata. */
export interface TranslationEdition {
  lang: string;
  name: string;
}

/** Get environment variable with fallback. */
function env(key: string, fallback: string): string {
  try {
    return import.meta.env[key] || fallback;
  } catch (_e) {
    return fallback;
  }
}

/** Application configuration constants. */
export const CONFIG: AppConfig = {
  API_BASE: env('VITE_API_BASE', 'https://api.alquran.cloud/v1'),
  TAFSIR_API: env('VITE_TAFSIR_API', 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir'),
  PRAYER_API: env('VITE_PRAYER_API', 'https://api.aladhan.com/v1/timingsByCity'),
  AZAN_FILE: 'azan.mp3',
  SURAH_COUNT: 114,
  STORAGE_PREFIX: 'quran_app_',
  DEFAULT_RECITER: 'ar.alafasy',
  DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
  DEFAULT_METHOD: '4',
  DEFAULT_CITY: 'مكة',
  DEFAULT_COUNTRY: 'SA',
  CACHE_LIMIT: 20,
};

/** Arabic names for prayer times. */
export const PRAYER_NAMES_AR: Record<string, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

/** Ordered list of prayer keys. */
export const PRAYER_ORDER: string[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** Arabic weekday names. */
export const ARABIC_WEEKDAYS: string[] = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** Starting page numbers for each Juz (30 entries). */
export const JUZ_PAGES: number[] = [
  1, 22, 42, 62, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482,
  502, 522, 542, 562, 582,
];

/** Available translation editions with language and name. */
export const TRANSLATION_EDITIONS: Record<string, TranslationEdition> = {
  'en.sahih': { lang: 'en', name: 'Sahih International' },
  'en.pickthall': { lang: 'en', name: 'Pickthall' },
  'en.yusufali': { lang: 'en', name: 'Yusuf Ali' },
  'fr.hamidullah': { lang: 'fr', name: 'Hamidullah' },
  'ur.jalandhry': { lang: 'ur', name: 'Jalandhry' },
};
