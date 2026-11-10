/** Application configuration constants interface. */
export interface AppConfig {
  API_BASE: string;
  TAFSIR_API: string;
  PRAYER_API: string;
  AZAN_FILE: string;
  CSP_REPORT_ENDPOINT: string;
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
  } catch {
    return fallback;
  }
}

/** Application configuration constants. */
export const CONFIG: AppConfig = {
  API_BASE: env('VITE_API_BASE', 'https://api.alquran.cloud/v1'),
  // Pin the upstream dataset so production builds remain reproducible. Override
  // with VITE_TAFSIR_API when testing or operating a private mirror.
  TAFSIR_API: env(
    'VITE_TAFSIR_API',
    'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@eb82bb6294efe30ad5c135c03b1864afaa70e855/tafsir',
  ),
  PRAYER_API: env('VITE_PRAYER_API', 'https://api.aladhan.com/v1/timingsByCity'),
  AZAN_FILE: `${import.meta.env.BASE_URL}azan.mp3`,
  CSP_REPORT_ENDPOINT: env('VITE_CSP_REPORT_ENDPOINT', ''),
  SURAH_COUNT: 114,
  STORAGE_PREFIX: 'quran_app_',
  DEFAULT_RECITER: 'ar.alafasy',
  DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
  DEFAULT_METHOD: '4',
  // N-09: this used to be a localized "madinah" string, evaluated at module
  // load — before initI18n() could finish in bootApp(), freezing either the
  // raw key or the Arabic display name into a new user's state.city.
  // state.city is a data key, not a display string: the Aladhan query sends
  // it verbatim and the UI localizes it at render time via getCityName().
  // The stable English key is correct for both consumers, so no translation
  // belongs here.
  DEFAULT_CITY: 'madinah',
  DEFAULT_COUNTRY: 'SA',
  CACHE_LIMIT: 20,
};

/** Ordered list of prayer keys for azan scheduling (excludes Sunrise — not a prayer). */
export const PRAYER_ORDER: string[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** Ordered list for countdown display (includes Sunrise). */
export const PRAYER_DISPLAY_ORDER: string[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// N-09: PRAYER_NAMES_AR and ARABIC_WEEKDAYS were removed — production code
// localizes through getPrayerName()/getWeekday() from the i18n module at
// render time; the module-load-time translation snapshots here were the same
// early-evaluation pattern as DEFAULT_CITY and had no production importer.

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
