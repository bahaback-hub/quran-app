// English translations
import type { TranslationBundle } from '../i18n';

const en: TranslationBundle = {
  // App
  app_title: 'The Noble Quran',
  app_subtitle: 'Al-Sulaimani Family — Recitation, Highlighting, Full Search, and Tafsir',
  app_description: 'Quran App — Recitation, Search, Tafsir, and Prayer Times',

  // Navigation
  select_surah: 'Select Surah',
  select_reciter: 'Select Reciter',
  select_tafsir: 'Select Tafsir',
  search_placeholder: 'Enter a word...',

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
  next_ayah: 'Skipping to next ayah',
  sleep_timer_remaining: 'Remaining',
  copied: '📋 Ayah copied',
  failed_copy: 'Failed to get ayah',
  loading_quran_db: 'Loading Quran database (one time only)...',
  quran_db_ready: '✅ Quran database ready',
  quran_db_loading: '⚠️ Quran database is loading, please wait',

  // Keyboard hint
  keyboard_hint:
    '💡 Shortcuts: Space = Play/Pause | ← → = Prev/Next Ayah | S = Prev Surah | D = Next Surah | H = Memorize | T = Tafsir | R = Repeat | M = Mushaf',

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
    'ar.shaatree': 'Abu Bakr Al-Shatri',
  },

  // Tafsir names
  tafsir_names: {
    'ar-tafsir-muyassar': 'Al-Muyassar',
    'ar-tafsir-al-tabari': 'Al-Tabari',
    'ar-tafsir-ibn-kathir': 'Ibn Kathir',
    'ar-tafsir-as-saadi': "Al-Sa'di",
    'ar-tafsir-al-baghawi': 'Al-Baghawi',
    'ar-tafsir-al-qurtubi': 'Al-Qurtubi',
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
    'صنعاء|YE': "Sana'a",
    'إسطنبول|TR': 'Istanbul',
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
    '13': 'Diyanet — Turkey',
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

  // Adhkar
  adhkar: 'Adhkar',
  adhkar_personal: 'My Adhkar',
  adhkar_add: 'Add New Dhikr',
  adhkar_edit: 'Edit',
  adhkar_delete: 'Delete',
  adhkar_saved: '✅ Dhikr added',
  adhkar_edited: '✏️ Dhikr edited',
  adhkar_deleted: '🗑️ Dhikr deleted',
  adhkar_reset: '🔄 Adhkar reset',
  adhkar_notification: '🕌 Adhkar time',
  adhkar_enable: 'Enable reminders',
  adhkar_sound: '🔔 Sound alert',
  adhkar_later: '⏰ Later',
  adhkar_open: '🕌 Open Adhkar',
  adhkar_add_dialog: '📝 Add new Dhikr',
  adhkar_text: 'Dhikr text',
  adhkar_count: 'Repeat count',
  adhkar_time: 'Reminder time (optional)',
  adhkar_duration: 'Notification duration (minutes)',
  adhkar_save: '💾 Save Dhikr',
  adhkar_no_personal: '📝 No personal adhkar yet',
  adhkar_confirm_delete: '🗑️ Delete this dhikr?',
  adhkar_enter_text: '📝 Enter dhikr text',
  adhkar_times: 'times',
  adhkar_remaining: 'remaining',

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

  // Missing keys added for 10/10 quality
  // Sleep timer
  sleep_timer_title: '⏰ Sleep Timer',
  sleep_timer_placeholder: 'Minutes',
  sleep_timer_hint: 'Enter minutes and press confirm',
  sleep_timer_confirm: '✅ Confirm',
  sleep_timer_cancel: '❌ Cancel',
  sleep_timer_cancelled: 'Sleep timer cancelled',
  sleep_timer_stopped: '⏰ Audio stopped after {0} minutes',
  sleep_timer_set: '⏰ Sleep timer: {0} minutes',

  // Stats
  stats_ayahs_read: 'Ayahs Read',
  stats_reading_time: 'Reading Time',
  stats_surahs_read: 'Surahs Read',
  stats_streak_days: 'Day Streak',
  stats_sessions: 'Reading Sessions',
  stats_last_read: 'Last Read',
  stats_hours_mins: '{0}h {1}m',
  stats_mins: '{0} min',

  // Mushaf
  previous_page: 'Previous Page',
  next_page: 'Next Page',
  mushaf_page_info: 'Page {0} of 604',
  mushaf_juz: 'Juz {0}',
  mushaf_page_error: 'Failed to display page',
  mushaf_page_not_found: 'Page not found',
  mushaf_no_secret: 'No secret recorded for this surah',
  mushaf_surah_info: 'ℹ️ Surah Info',
  surah_info_for: 'Info for Surah {0}',
  mushaf_loading_page: '⏳ Loading page {0}...',

  // Search UI
  search_history_title: '🕐 Recent Searches',
  search_history_cleared: 'Search history cleared',
  voice_search_unsupported: 'Voice search is not supported in this browser',
  voice_search_speaking: '🎤 Speak now...',
  voice_search_not_recognized: '🎤 Speech not recognized, try again',
  load_more: '📥 Load more ({0}+)',
  failed_ayah: 'Failed to get ayah',

  // Ayah modal
  ayah_modal_title: 'Ayah {0} of Surah {1}',
  last_ayah_in_quran: 'This is the last ayah in the Quran',
  next_ayah_label: '← Next ayah: Ayah {0} - {1}',
  page_loading: '📄 Page: Loading...',
  juz_loading: '📖 Juz: Loading...',
  page_info: '📄 Page: {0}',
  juz_info: '📖 Juz: {0}',
  bookmark_position_saved: '✅ Bookmark position saved',
  in_favorites: '⭐ In Favorites',
  add_to_favorites: '⭐ Add to Favorites',
  copy_text: '📋 Copy Text',
  copy_simple: '📋 Copy Plain Text',
  copy_with_tafsir: '📋 Copy with Tafsir',
  copy_for_share: '📤 Copy for Sharing',
  ayah_modal_play: '▶️ Play',
  ayah_modal_pause: '⏸️ Pause',
  play_ayah_first: 'Play the ayah first',
  no_tafsir_available: '⚠️ No tafsir available',

  // Prayer
  qibla_direction: 'Qibla Direction: {0} ({1}°)',
  qibla_location_failed: '⚠️ Failed to detect location',
  location_not_supported: '⚠️ Location not supported',
  prayer_countdown: '{0} — after {1}',
  prayer_dirs: 'North',
  prayer_dirs_ne: 'Northeast',
  prayer_dirs_e: 'East',
  prayer_dirs_se: 'Southeast',
  prayer_dirs_s: 'South',
  prayer_dirs_sw: 'Southwest',
  prayer_dirs_w: 'West',
  prayer_dirs_nw: 'Northwest',

  // Favorites
  favorites_export_none: 'No favorite ayahs to export',
  favorites_exported_text: '📄 Favorites exported as text',
  favorites_exported_json: '💾 Favorites exported as JSON',

  // Select mode
  select_mode_none: 'No ayahs selected',
  select_mode_copied: '📋 Copied {0} ayahs',

  // Error boundary
  error_title: 'An unexpected error occurred',
  error_description: 'The app encountered an unexpected issue. You can reload or return to the home page.',
  error_reload: '🔄 Reload',
  error_home: '🏠 Home Page',
  error_copy_details: '📋 Copy Error Details',
  error_technical: 'Technical Details',
  error_copied: '✅ Copied',

  // API errors
  error_no_connection: '⚠️ No internet connection',
  error_timeout: '⏱️ Request timed out',
  error_server_unreachable: '⚠️ Server unreachable',
  error_server_error: '⚠️ Server error',
  error_invalid_data: '⚠️ Invalid data',
  error_unexpected: '⚠️ An unexpected error occurred',

  // Onboarding
  onboarding_skip: 'Skip',
  onboarding_prev: '→ Back',
  onboarding_next: 'Next ←',
  onboarding_start: '✔️ Get Started',

  // Share
  share_copied_simple: '📋 Plain text copied',

  // Surah loader
  loading_surah_list: '⏳ Loading surah list...',
  offline_no_audio: '📖 Offline mode — audio unavailable',
  surah_info_title: 'Surah Info',

  // Continue widget
  continue_ayah: ' — Ayah {0}',
  last_visit_time: 'Last visit: {0}',

  // Mushaf sources
  mushaf_sources: '📚 Sources:',
  no_audio_data: 'No audio data available',
  invalid_surah_data: 'Invalid surah data',
  settings_imported: '✅ Imported {0} settings. Reloading...',
  failed_load_backgrounds: 'Failed to load backgrounds list',
  notification_active: '🔔 Notification active',
  notification_paused: '🔕 Notification paused',
  minutes: 'min',

  // Onboarding descriptions
  onboarding_desc_1: 'Recitation, Tafsir, Search, and Prayer times — all in one app.',
  onboarding_desc_2: 'Choose your favorite reciter from 8 reciters, control speed and sleep timer.',
  onboarding_desc_3: 'Search the entire Quran with relevance-ranked results and auto-complete.',
  onboarding_desc_4: '6 trusted tafsirs and translation of meanings in multiple languages.',
  onboarding_desc_5: 'Accurate prayer times with athan and notifications.',
  onboarding_desc_6: 'Night mode, font and spacing adjustments, favorites export.',
};

export default en;
