/**
 * English translation bundle — with plural forms.
 */
const en = {
  app_title: 'Quran',
  loading: 'Loading...',
  error: 'An error occurred',
  retry: 'Retry',

  quran: 'Quran',
  player: 'Player',
  controls: 'Tools',
  search: 'Search',
  more: 'Menu',

  surah: 'Surah',
  ayah: 'Ayah',
  bismillah: 'In the name of Allah, the Most Gracious, the Most Merciful',
  select_hint: '📿 Select a surah from the list to view and listen',

  ayah_count: {
    zero: 'no ayahs',
    one: '{count} ayah',
    two: '{count} ayahs',
    few: '{count} ayahs',
    many: '{count} ayahs',
    other: '{count} ayahs',
  },

  favorite_count: {
    zero: 'no favorites',
    one: '{count} favorite',
    two: '{count} favorites',
    few: '{count} favorites',
    many: '{count} favorites',
    other: '{count} favorites',
  },

  search_results: {
    zero: 'no results',
    one: '{count} result',
    two: '{count} results',
    few: '{count} results',
    many: '{count} results',
    other: '{count} results',
  },

  minutes_remaining: {
    one: '{count} minute remaining',
    two: '{count} minutes remaining',
    few: '{count} minutes remaining',
    many: '{count} minutes remaining',
    other: '{count} minutes remaining',
  },

  pages_count: {
    one: '{count} page',
    two: '{count} pages',
    few: '{count} pages',
    many: '{count} pages',
    other: '{count} pages',
  },

  play: 'Play',
  pause: 'Pause',
  next_ayah: 'Next Ayah',
  prev_ayah: 'Previous Ayah',
  next_surah: 'Next Surah',
  prev_surah: 'Previous Surah',
  reciter: 'Reciter',
  speed: 'Speed',
  repeat: 'Repeat',
  sleep_timer: 'Sleep Timer',

  theme_light: 'Light Mode',
  theme_sepia: 'Sepia Mode',
  theme_night: 'Night Mode',

  prayer_fajr: 'Fajr',
  prayer_sunrise: 'Sunrise',
  prayer_dhuhr: 'Dhuhr',
  prayer_asr: 'Asr',
  prayer_maghrib: 'Maghrib',
  prayer_isha: 'Isha',
  next_prayer: 'Next Prayer',

  tafsir: 'Tafsir',
  tafsir_muyassar: 'Muyassar',
  tafsir_ibn_kathir: 'Ibn Kathir',
  tafsir_tabari: 'Tabari',
  tafsir_saadi: 'Saadi',
  tafsir_baghawi: 'Baghawi',
  tafsir_qurtubi: 'Qurtubi',
  tafsir_no_ayah: '📖 Select a surah and ayah to view tafsir',

  favorites: 'Favorites',
  favorites_empty: 'No favorite ayahs yet',
  favorite_added: 'Added to favorites',
  favorite_removed: 'Removed from favorites',

  bookmark_set: 'Bookmark set',
  bookmark_goto: 'Go to bookmark',
  bookmark_not_set: 'No bookmark set',

  search_placeholder: 'Search the Quran...',
  search_no_results: 'No matching results',
  search_history: 'Search history',
  search_clear: 'Clear history',

  settings: 'Settings',
  settings_save: 'Save settings',
  settings_reset: 'Reset',
  settings_export: 'Export settings',
  settings_import: 'Import settings',

  error_load_surah: 'Failed to load surah. Check your internet connection.',
  error_load_audio: 'Failed to load audio. Try again.',
  error_load_tafsir: 'Failed to load tafsir.',
  error_search: 'Search error occurred.',
  offline_banner: '🔌 No internet connection — some features may not work',

  mushaf_mode: 'Mushaf Mode',
  page: 'Page',
  page_of: 'Page {current} of {total}',

  presentation_mode: 'Presentation Mode',
  exit: 'Exit',
  fullscreen: 'Fullscreen',

  adhkar: 'Adhkar',
  adhkar_morning: 'Morning Adhkar',
  adhkar_evening: 'Evening Adhkar',
  adhkar_count: 'Count: {count}',

  surah_loaded: 'Loaded {name}',
  position_saved: 'Position saved',
  khatm_completed: 'Khatm completed 🎉',

  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
} as const;

export default en;
