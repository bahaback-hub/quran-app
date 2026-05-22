export const CONFIG = {
  API_BASE: 'https://api.alquran.cloud/v1',
  TAFSIR_API: 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir',
  PRAYER_API: 'https://api.aladhan.com/v1/timingsByCity',
  ROOTS_FILE: 'data/quranRoots.json',
  AZAN_FILE: 'azan.mp3',
  SURAH_COUNT: 114,
  STORAGE_PREFIX: 'quran_app_',
  DEFAULT_RECITER: 'ar.alafasy',
  DEFAULT_TAFSIR: 'ar-tafsir-muyassar',
  DEFAULT_METHOD: '4',
  DEFAULT_CITY: 'مكة',
  DEFAULT_COUNTRY: 'SA',
  CACHE_LIMIT: 20
};

export const PRAYER_NAMES_AR = {
  Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر',
  Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء'
};

export const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

export const ARABIC_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const JUZ_PAGES = [1, 22, 42, 62, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];

export const TRANSLATION_EDITIONS = {
  'en.sahih': { lang: 'en', name: 'Sahih International' },
  'en.pickthall': { lang: 'en', name: 'Pickthall' },
  'en.yusufali': { lang: 'en', name: 'Yusuf Ali' },
  'fr.hamidullah': { lang: 'fr', name: 'Hamidullah' },
  'ur.jalandhry': { lang: 'ur', name: 'Jalandhry' }
};
