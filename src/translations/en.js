// English translations
const en = {
  // App
  app_title: 'The Noble Quran',
  app_subtitle: 'Al-Sulaimani Family — Recitation, Highlighting, Full Search, and Tafsir',
  app_description: 'Quran App — Recitation, Search, Tafsir, and Prayer Times',

  // Navigation
  select_surah: 'Select Surah',
  select_reciter: 'Select Reciter',
  select_tafsir: 'Select Tafsir',
  search_placeholder: 'Enter a word or root...',
  search_type_exact: 'Exact Search',
  search_type_root: 'Root Search',

  // Player
  play: '⏯ Play',
  pause: '⏸ Pause',
  prev_ayah: '◀ Prev',
  next_ayah: 'Next ▶',
  prev_surah: '⏮ Prev Surah',
  next_surah: 'Next Surah ⏭',
  hifdh_mode: '🕋 Memorize',
  repeat: '🔁 Repeat',
  bookmark: '🔖 Bookmark',
  favorite: '❤️ Favorite',
  share: '📤 Share',
  speed: 'Speed',

  // Surah mode
  mode_surah: '📄 Surah Mode',
  mode_mushaf: '📄 Mushaf Mode',

  // Mushaf
  page: 'Page',
  juz: 'Juz',
  select_page: 'Page Number',
  surah_list: '📖 Surahs',
  choose_ayah: '🎯 Choose an ayah to listen or view tafsir',

  // Search
  search: '🔎 Search',
  clear_results: 'Clear Results',
  min_chars: 'Enter at least 2 characters',
  no_results: 'No results found',
  results_count: 'Results count',
  all_quran: 'Search the Entire Quran',

  // Tafsir
  tafsir: '📜 Tafsir',
  tafsir_no_ayah: '📖 Select a surah and ayah to view tafsir',
  tafsir_loading: '⏳ Loading tafsir...',
  tafsir_error: '⚠️ Failed to load tafsir',

  // Settings
  settings: '⚙️ Settings',
  close: '✖',
  reset_settings: '🔄 Reset Settings',
  confirm_reset: 'Are you sure you want to reset all settings?',
  language: 'Language',

  // Location & Prayer
  city: 'City',
  country: 'Country',
  calculation_method: 'Calculation Method',
  quick_select: 'Quick Select',
  save_location: '💾 Save Location & Update Times',
  prayer_times: '🕌 Prayer Times',
  next_prayer: 'Next Prayer',
  time_remaining: 'Time Remaining',
  loading_prayer: '⏳ Loading prayer times...',
  cached_prayer: 'Showing cached prayer times',
  failed_prayer: 'Failed to load prayer times',

  // Azan
  azan: '🔔 Azan',
  azan_enable: 'Azan Alert',
  azan_fajr: 'Fajr Azan',
  test_azan: '▶️ Test Azan',
  stop_azan: '⏹️ Stop Azan',
  azan_playing: '🔔 Azan is playing',
  azan_stopped: 'Azan stopped',
  azan_failed: 'Failed to play azan',
  azan_by: '🎙️ Azan by Sheikh Nasser Al-Qatami',
  prayer_time_come: 'Prayer time has arrived',
  prayer: 'Prayer',

  // Display
  display: '🎨 Display',
  font_size: 'Font Size',
  night_mode: 'Night Mode',
  auto_save: 'Auto-save last position',
  background: '🖼️ Background',
  bg_none: 'None',

  // Favorites
  favorites: '❤️ Favorites',
  no_favorites: 'No favorite ayahs yet',
  added_to_favorites: '❤️ Added to favorites',
  removed_from_favorites: '💔 Removed from favorites',
  go_to: 'Go',
  delete: 'Delete',
  deleted: 'Deleted',

  // Bookmark
  bookmark_saved: '🔖 Bookmark saved',
  bookmark_not_found: 'No bookmark found',

  // Messages
  loading_surah: '⏳ Loading surah',
  failed_load_surah: 'Failed to load surah',
  surah_complete: '✅ Completed surah',
  repeat_complete: '✅ Repeat completed',
  hifdh_on: '🧠 Memorization mode activated',
  hifdh_off: 'Memorization mode disabled',
  repeat_on: '🔁 Repeat mode activated',
  repeat_off: 'Repeat disabled',
  no_audio: 'No audio links for this surah',
  no_audio_ayah: 'No audio for this ayah',
  audio_error: '⚠️ Failed to play audio, try another ayah',
  copied: '📋 Ayah copied',
  failed_copy: 'Failed to get ayah',
  loading_quran_db: 'Loading Quran database (one time only)...',
  quran_db_ready: '✅ Quran database ready',
  quran_db_loading: '⚠️ Quran database is loading, please wait',

  // Keyboard hint
  keyboard_hint: '💡 Shortcuts: Space = Play/Pause | ← → = Prev/Next Ayah | S = Prev Surah | D = Next Surah | H = Memorize | T = Tafsir | R = Repeat | M = Mushaf',

  // Footer
  footer_data_from: 'Data from',
  footer_by: 'Al-Sulaimani Family',
  footer_prayer: 'May Allah accept this work from the Al-Sulaimani Family',

  // Weekdays
  weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

  // Surah
  surah: 'Surah',
  ayah: 'Ayah',

  // Reciters
  reciters: {
    'ar.alafasy': 'Mishary Al-Afasy',
    'ar.abdulbasitmurattal': 'Abdul Basit Abdus Samad',
    'ar.abdurrahmaansudais': 'Abdur Rahman Al-Sudais',
    'ar.husary': 'Mahmoud Khalil Al-Husary',
    'ar.minshawi': 'Muhammad Siddiq Al-Minshawi',
    'ar.muhammadayyoub': 'Muhammad Ayyoub',
    'ar.aliabdurrahmanalhuthaify': 'Ali Al-Huthaify',
    'ar.shaatree': 'Abu Bakr Al-Shatri'
  },

  // Tafsir names
  tafsir_names: {
    'ar-tafsir-muyassar': 'Al-Muyassar',
    'ar-tafsir-al-tabari': 'Al-Tabari',
    'ar-tafsir-ibn-kathir': 'Ibn Kathir',
    'ar-tafsir-as-saadi': 'Al-Sa\'di',
    'ar-tafsir-al-baghawi': 'Al-Baghawi',
    'ar-tafsir-al-qurtubi': 'Al-Qurtubi'
  },

  // Cities
  cities: {
    'مكة|SA': 'Makkah',
    'المدينة|SA': 'Madinah',
    'الرياض|SA': 'Riyadh',
    'القاهرة|EG': 'Cairo',
    'دمشق|SY': 'Damascus',
    'عمان|JO': 'Amman',
    'بغداد|IQ': 'Baghdad',
    'الدوحة|QA': 'Doha',
    'الكويت|KW': 'Kuwait',
    'دبي|AE': 'Dubai',
    'بيروت|LB': 'Beirut',
    'الجزائر|DZ': 'Algiers',
    'الرباط|MA': 'Rabat',
    'تونس|TN': 'Tunis',
    'الخرطوم|SD': 'Khartoum',
    'صنعاء|YE': 'Sana\'a',
    'إسطنبول|TR': 'Istanbul'
  },

  // Calculation methods
  calc_methods: {
    '4': 'Umm Al-Qura — Makkah',
    '5': 'Egyptian Authority',
    '3': 'Muslim World League',
    '2': 'ISNA — North America',
    '1': 'University of Karachi',
    '8': 'Kuwait',
    '9': 'Qatar',
    '10': 'Singapore',
    '12': 'Union of Islamic Scholars (France)',
    '13': 'Diyanet — Turkey'
  },

  // Toast types
  success: 'Success',
  error: 'Error',
  loading: '⏳ Loading...',
  select_hint: '📿 Select a surah from the list',

  // Azan notification
  azan_notif_stop: '⏹️ Stop Azan',

  // Continue widget
  continue_reading: '📖 Continue Reading',
  last_visit: 'Last visit',

  // Search results
  search_play: '▶️ Play',
  search_copy: '📋 Copy',
  search_share: '📤 Share',
  search_goto: '📍 Go',

  // Translation
  translation: '🌐 Translation',
  translation_select: 'Select Translation',
  translation_on: 'Translation enabled',
  translation_off: 'Translation disabled',

  // Welcome screen
  welcome_title: 'The Noble Quran',
  welcome_subtitle: 'Al-Sulaimani Family',
  welcome_feature_audio: '🎧 Listen to 8 reciters',
  welcome_feature_search: '🔎 Search the entire Quran',
  welcome_feature_tafsir: '📜 6 authoritative tafsir works',
  welcome_feature_translation: '🌐 Translation (English, French, Urdu)',
  welcome_feature_mushaf: '📄 Browse the mushaf',
  welcome_feature_prayer: '🕌 Prayer times & azan',
  welcome_dismiss: '✌️ Get Started',
};

export default en;
