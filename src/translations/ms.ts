// Malay translations
import type { TranslationBundle } from '../i18n';

const ms: TranslationBundle = {
  // App
  app_title: 'Al-Quran Al-Karim',
  app_subtitle: 'Keluarga Al-Sulaimani — Bacaan, Penonjolan, Carian Penuh, dan Tafsir',
  app_description: 'Aplikasi Al-Quran — Bacaan, Carian, Tafsir, dan Waktu Solat',

  // Navigation
  select_surah: 'Pilih Surah',
  select_reciter: 'Pilih Qari',
  select_tafsir: 'Pilih Tafsir',
  search_placeholder: 'Masukkan perkataan...',

  // Player
  play: '⏯ Main',
  pause: '⏸ Jeda',
  prev_ayah: '◀ Sebelum',
  next_ayah_btn: 'Seterusnya ▶',
  prev_surah: '⏮ Surah Sebelum',
  next_surah: 'Surah Seterusnya ⏭',
  hifdh_mode: '🕋 Hafal',
  repeat: '🔁 Ulang',
  bookmark: '🔖 Tanda Buku',
  favorite: '❤️ Kegemaran',
  share: '📤 Kongsi',
  speed: 'Kelajuan',

  // Surah mode
  mode_surah: '📄 Mod Surah',
  mode_mushaf: '📄 Mod Mushaf',

  // Mushaf
  page: 'Halaman',
  juz: 'Juz',
  select_page: 'Nombor Halaman',
  surah_list: '📖 Surah',

  // Search
  search: '🔎 Carian',
  clear_results: 'Padamkan Hasil',
  min_chars: 'Masukkan sekurang-kurangnya 2 aksara',
  no_results: 'Tiada hasil ditemui',
  results_count: 'Bilangan hasil',
  all_quran: 'Cari Seluruh Al-Quran',

  // Tafsir
  tafsir: '📜 Tafsir',
  tafsir_no_ayah: '📖 Pilih surah dan ayat untuk melihat tafsir',
  tafsir_loading: '⏳ Memuatkan tafsir...',
  tafsir_error: '⚠️ Gagal memuatkan tafsir',

  // Settings
  settings: '⚙️ Tetapan',
  close: '✖',
  reset_settings: '🔄 Tetapan Semula',
  confirm_reset: 'Adakah anda pasti mahu menetapkan semula semua tetapan?',
  language: 'Bahasa',

  // Location & Prayer
  city: 'Bandar',
  country: 'Negara',
  calculation_method: 'Kaedah Pengiraan',
  quick_select: 'Pilihan Pantas',
  save_location: '💾 Simpan Lokasi & Kemas Kini Waktu',
  prayer_times: '🕌 Waktu Solat',
  next_prayer: 'Solat Seterusnya',
  time_remaining: 'Masa Berbaki',
  loading_prayer: '⏳ Memuatkan waktu solat...',
  cached_prayer: 'Menunjukkan waktu solat yang disimpan',
  failed_prayer: 'Gagal memuatkan waktu solat',

  // Azan
  azan: '🔔 Azan',
  azan_enable: 'Tanda Azan',
  azan_fajr: 'Azan Subuh',
  test_azan: '▶️ Uji Azan',
  stop_azan: '⏹️ Henti Azan',
  azan_playing: '🔔 Azan sedang dimainkan',
  azan_stopped: 'Azan dihentikan',
  azan_failed: 'Gagal memainkan azan',
  azan_by: '🎙️ Azan oleh Sheikh Nasser Al-Qatami',
  prayer_time_come: 'Waktu solat telah tiba',
  prayer: 'Solat',

  // Display
  display: '🎨 Paparan',
  font_size: 'Saiz Font',
  night_mode: 'Mod Malam',
  auto_save: 'Simpan automatik kedudukan terakhir',
  background: '🖼️ Latar Belakang',
  bg_none: 'Tiada',

  // Favorites
  favorites: '❤️ Kegemaran',
  no_favorites: 'Tiada ayat kegemaran lagi',
  added_to_favorites: '❤️ Ditambah ke kegemaran',
  removed_from_favorites: '💔 Dibuang dari kegemaran',
  go_to: 'Pergi',
  delete: 'Padam',
  deleted: 'Dipadam',

  // Bookmark
  bookmark_saved: '🔖 Tanda buku disimpan',
  bookmark_not_found: 'Tiada tanda buku ditemui',

  // Messages
  loading_surah: '⏳ Memuatkan surah',
  failed_load_surah: 'Gagal memuatkan surah',
  surah_complete: '✅ Surah selesai',
  repeat_complete: '✅ Ulangan selesai',
  hifdh_on: '🧠 Mod hafalan diaktifkan',
  hifdh_off: 'Mod hafalan dinyahaktifkan',
  repeat_on: '🔁 Mod ulangan diaktifkan',
  repeat_off: 'Ulangan dinyahaktifkan',
  no_audio: 'Tiada pautan audio untuk surah ini',
  no_audio_ayah: 'Tiada audio untuk ayat ini',
  audio_error: '⚠️ Gagal memainkan audio, cuba ayat lain',
  next_ayah: 'Melangkah ke ayat seterusnya',
  sleep_timer_remaining: 'Baki',
  copied: '📋 Ayat disalin',
  failed_copy: 'Gagal mendapatkan ayat',
  loading_quran_db: 'Memuatkan pangkalan data Al-Quran (sekali sahaja)...',
  quran_db_ready: '✅ Pangkalan data Al-Quran sedia',
  quran_db_loading: '⚠️ Pangkalan data Al-Quran sedang dimuatkan, sila tunggu',

  // Keyboard hint
  keyboard_hint:
    '💡 Pintasan: Space = Main/Jeda | ← → = Ayat Sebelum/Seterusnya | S = Surah Sebelum | D = Surah Seterusnya | H = Hafal | T = Tafsir | R = Ulang | M = Mushaf',

  // Footer
  footer_data_from: 'Data daripada',
  footer_by: 'Keluarga Al-Sulaimani',
  footer_prayer: 'Semoga Allah menerima amalan ini dari Keluarga Al-Sulaimani',

  // Weekdays
  weekdays: ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'],

  // Surah
  surah: 'Surah',
  ayah: 'Ayat',

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
    'ar.abdulsamad': 'Abdul Basit (Mujawwad)',
    'ar.minshawimujawwad': 'Al-Minshawi (Mujawwad)',
    'ar.abdullahbasfar': 'Abdullah Basfar',
    'ar.ahmedajamy': 'Ahmed Al-Ajamy',
    's_gmd': 'Saad Al-Ghamdi',
    'shur': 'Saud Al-Shuraim',
    's_bud': 'Salah Al-Budair',
    'bu_khtr': 'Salah Abu Khater',
    'hthfi': 'Ali Al-Huthaify',
    'a_jbr': 'Ali Jaber',
    'frs_a': 'Fares Abbad',
    'yasser': 'Yasser Al-Dosari',
    'salamah': 'Yasser Salamah',
    'qtm': 'Nasser Al-Qatami',
    'mtrod': 'Abdullah Al-Matroud',
    'qasm': 'Abdul Mohsen Al-Qasim',
    'sds': 'Abdur Rahman Al-Sudais',
    'maher': 'Maher Al-Muaiqly',
    'jbrl': 'Muhammad Jibreel',
    'minsh': 'Muhammad Siddiq Al-Minshawi',
    'shaatree_mp3': 'Abu Bakr Al-Shatri',
    'tnjy': 'Khalifa Al-Taniji',
  },

  // Reciter display names (flat keys for reciters.ts i18n)
  reciter_alafasy: 'Mishary Al-Afasy',
  reciter_abdulbasit_murattal: 'Abdul Basit (Murattal)',
  reciter_abdulsamad: 'Abdul Basit (Mujawwad)',
  reciter_sudais: 'Abdur Rahman Al-Sudais',
  reciter_husary: 'Mahmoud Khalil Al-Husary',
  reciter_minshawi_murattal: 'Al-Minshawi (Murattal)',
  reciter_minshawi_mujawwad: 'Al-Minshawi (Mujawwad)',
  reciter_ayyoub: 'Muhammad Ayyoub',
  reciter_shaatree: 'Abu Bakr Al-Shatri',
  reciter_basfar: 'Abdullah Basfar',
  reciter_ajamy: 'Ahmed Al-Ajamy',
  reciter_ghamdi: 'Saad Al-Ghamdi',
  reciter_shuraim: 'Saud Al-Shuraim',
  reciter_budayr: 'Salah Al-Budair',
  reciter_bukhatir: 'Salah Abu Khater',
  reciter_huthaify: 'Ali Al-Huthaify',
  reciter_jaber: 'Ali Jaber',
  reciter_abbad: 'Fares Abbad',
  reciter_dosari: 'Yasser Al-Dosari',
  reciter_salamah: 'Yasser Salamah',
  reciter_qatami: 'Nasser Al-Qatami',
  reciter_matroud: 'Abdullah Al-Matroud',
  reciter_qasim: 'Abdul Mohsen Al-Qasim',
  reciter_sudais_mp3: 'Abdur Rahman Al-Sudais',
  reciter_muaiqly: 'Maher Al-Muaiqly',
  reciter_jibreel: 'Muhammad Jibreel',
  reciter_minshawi_mp3: 'Muhammad Siddiq Al-Minshawi',
  reciter_shaatree_mp3: 'Abu Bakr Al-Shatri',
  reciter_taniji: 'Khalifa Al-Taniji',

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
    'دمشق|SY': 'Damsyik',
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
    '5': 'Pihak Berkuasa Mesir',
    '3': 'Liga Dunia Islam',
    '2': 'ISNA — Amerika Utara',
    '1': 'Universiti Karachi',
    '8': 'Kuwait',
    '9': 'Qatar',
    '10': 'Singapura',
    '12': 'Kesatuan Ulama Islam (Perancis)',
    '13': 'Diyanet — Turki',
  },

  // Toast types
  success: 'Berjaya',
  error: 'Ralat',
  loading: '⏳ Memuatkan...',
  select_hint: '📿 Pilih surah dari senarai',

  // Azan notification
  azan_notif_stop: '⏹️ Henti Azan',

  // Continue widget
  continue_reading: '📖 Teruskan Membaca',
  last_visit: 'Lawatan terakhir',

  // Search results
  search_play: '▶️ Main',
  search_copy: '📋 Salin',
  search_share: '📤 Kongsi',
  search_goto: '📍 Pergi',

  // Translation
  translation: '🌐 Terjemahan',
  translation_select: 'Pilih Terjemahan',
  translation_on: 'Terjemahan diaktifkan',
  translation_off: 'Terjemahan dinyahaktifkan',

  // Adhkar
  adhkar: 'Adhkar',
  adhkar_personal: 'Adhkar Saya',
  adhkar_add: 'Tambah Dhikr Baru',
  adhkar_edit: 'Sunting',
  adhkar_delete: 'Padam',
  adhkar_saved: '✅ Dhikr ditambah',
  adhkar_edited: '✏️ Dhikr disunting',
  adhkar_deleted: '🗑️ Dhikr dipadam',
  adhkar_reset: '🔄 Adhkar ditetapkan semula',
  adhkar_notification: '🕌 Masa Adhkar',
  adhkar_enable: 'Aktifkan peringatan',
  adhkar_sound: '🔔 bunyi amaran',
  adhkar_later: '⏰ Kemudian',
  adhkar_open: '🕌 Buka Adhkar',
  adhkar_add_dialog: '📝 Tambah Dhikr Baru',
  adhkar_text: 'Teks Dhikr',
  adhkar_count: 'Bilangan ulangan',
  adhkar_time: 'Masa peringatan (pilihan)',
  adhkar_duration: 'Tempoh pemberitahuan (minit)',
  adhkar_save: '💾 Simpan Dhikr',
  adhkar_no_personal: '📝 Tiada adhkar peribadi lagi',
  adhkar_confirm_delete: '🗑️ Padam dhikr ini?',
  adhkar_enter_text: '📝 Masukkan teks dhikr',
  adhkar_times: 'kali',
  adhkar_remaining: 'berbaki',

  // Welcome screen
  welcome_title: 'Al-Quran Al-Karim',
  welcome_subtitle: 'Keluarga Al-Sulaimani',
  welcome_feature_audio: '🎧 Dengar 8 qari',
  welcome_feature_search: '🔎 Cari seluruh Al-Quran',
  welcome_feature_tafsir: '📜 6 karya tafsir yang berwibawa',
  welcome_feature_translation: '🌐 Terjemahan (Inggeris, Perancis, Urdu)',
  welcome_feature_mushaf: '📄 Layari mushaf',
  welcome_feature_prayer: '🕌 Waktu solat & azan',
  welcome_dismiss: '✌️ Mula',

  // Sleep timer
  sleep_timer_title: '⏰ Pemasa Tidur',
  sleep_timer_placeholder: 'Minit',
  sleep_timer_hint: 'Masukkan minit dan tekan sahkan',
  sleep_timer_confirm: '✅ Sahkan',
  sleep_timer_cancel: '❌ Batal',
  sleep_timer_cancelled: 'Pemasa tidur dibatalkan',
  sleep_timer_stopped: '⏰ Audio dihentikan selepas {0} minit',
  sleep_timer_set: '⏰ Pemasa tidur: {0} minit',

  // Stats
  stats_ayahs_read: 'Ayat Dibaca',
  stats_reading_time: 'Masa Bacaan',
  stats_surahs_read: 'Surah Dibaca',
  stats_streak_days: 'Rentetan Hari',
  stats_sessions: 'Sesi Bacaan',
  stats_last_read: 'Bacaan Terakhir',
  stats_hours_mins: '{0}j {1}m',
  stats_mins: '{0} min',

  // Mushaf
  previous_page: 'Halaman Sebelumnya',
  next_page: 'Halaman Seterusnya',
  mushaf_page_info: 'Halaman {0} dari 604',
  mushaf_juz: 'Juzuk {0}',
  mushaf_page_error: 'Gagal memaparkan halaman',
  mushaf_page_not_found: 'Halaman tidak dijumpai',
  mushaf_no_secret: 'Tiada rahsia dicatat untuk surah ini',
  mushaf_surah_info: 'ℹ️ Maklumat Surah',
  surah_info_for: 'Maklumat Surah {0}',
  mushaf_loading_page: '⏳ Memuat halaman {0}...',

  // Search UI
  search_history_title: '🕐 Carian Terkini',
  search_history_cleared: 'Sejarah carian dikosongkan',
  voice_search_unsupported: 'Carian suara tidak disokong dalam pelayar ini',
  voice_search_speaking: '🎤 Bercakaplah sekarang...',
  voice_search_not_recognized: '🎤 Suara tidak dikenali, cuba lagi',
  load_more: '📥 Muat lagi ({0}+)',
  failed_ayah: 'Gagal mendapatkan ayat',

  // Ayah modal
  ayah_modal_title: 'Ayat {0} dari Surah {1}',
  last_ayah_in_quran: 'Ini adalah ayat terakhir dalam Al-Quran',
  next_ayah_label: '← Ayat seterusnya: Ayat {0} - {1}',
  page_loading: '📄 Halaman: Memuat...',
  juz_loading: '📖 Juzuk: Memuat...',
  page_info: '📄 Halaman: {0}',
  juz_info: '📖 Juzuk: {0}',
  bookmark_position_saved: '✅ Tanda buku disimpan',
  in_favorites: '⭐ Dalam Kegemaran',
  add_to_favorites: '⭐ Tambah ke Kegemaran',
  copy_text: '📋 Salin Teks',
  copy_simple: '📋 Salin Teks Ringkas',
  copy_with_tafsir: '📋 Salin dengan Tafsir',
  copy_for_share: '📤 Salin untuk Perkongsian',
  ayah_modal_play: '▶️ Main',
  ayah_modal_pause: '⏸️ Jeda',
  play_ayah_first: 'Mainkan ayat dahulu',
  no_tafsir_available: '⚠️ Tiada tafsir tersedia',

  // Prayer
  qibla_direction: 'Arah Kiblat: {0} ({1}°)',
  qibla_location_failed: '⚠️ Gagal mengesan lokasi',
  location_not_supported: '⚠️ Lokasi tidak disokong',
  prayer_countdown: '{0} — selepas {1}',
  prayer_dirs: 'Utara',
  prayer_dirs_ne: 'Timur Laut',
  prayer_dirs_e: 'Timur',
  prayer_dirs_se: 'Tenggara',
  prayer_dirs_s: 'Selatan',
  prayer_dirs_sw: 'Barat Daya',
  prayer_dirs_w: 'Barat',
  prayer_dirs_nw: 'Barat Laut',

  // Favorites
  favorites_export_none: 'Tiada ayat kegemaran untuk dieksport',
  favorites_exported_text: '📄 Kegemaran dieksport sebagai teks',
  favorites_exported_json: '💾 Kegemaran dieksport sebagai JSON',

  // Select mode
  select_mode_none: 'Tiada ayat dipilih',
  select_mode_copied: '📋 {0} ayat disalin',

  // Error boundary
  error_title: 'Ralat tidak dijangka berlaku',
  error_description:
    'Aplikasi menghadapi masalah yang tidak dijangka. Anda boleh muat semula atau kembali ke halaman utama.',
  error_reload: '🔄 Muat Semula',
  error_home: '🏠 Halaman Utama',
  error_copy_details: '📋 Salin Butiran Ralat',
  error_technical: 'Butiran Teknikal',
  error_copied: '✅ Disalin',

  // API errors
  error_no_connection: '⚠️ Tiada sambungan internet',
  error_timeout: '⏱️ Permintaan tamat masa',
  error_server_unreachable: '⚠️ Pelayan tidak dapat dicapai',
  error_server_error: '⚠️ Ralat pelayan',
  error_invalid_data: '⚠️ Data tidak sah',
  error_unexpected: '⚠️ Ralat tidak dijangka berlaku',

  // Onboarding
  onboarding_skip: 'Langkau',
  onboarding_prev: '→ Kembali',
  onboarding_next: 'Seterusnya ←',
  onboarding_start: '✔️ Mula',

  // Share
  share_copied_simple: '📋 Teks ringkas disalin',

  // Surah loader
  loading_surah_list: '⏳ Senarai surah dimuat...',
  offline_no_audio: '📖 Mod luar talian — audio tidak tersedia',
  surah_info_title: 'Maklumat Surah',

  // Continue widget
  continue_ayah: ' — Ayat {0}',
  last_visit_time: 'Lawatan terakhir: {0}',

  // Mushaf sources
  mushaf_sources: '📚 Sumber:',
  no_audio_data: 'Tiada data audio tersedia',
  invalid_surah_data: 'Data surah tidak sah',
  settings_imported: '✅ {0} tetapan diimport. Memuat semula...',
  failed_load_backgrounds: 'Gagal memuat senarai latar belakang',
  notification_active: '🔔 Pemberitahuan aktif',
  notification_paused: '🔕 Pemberitahuan dijeda',
  minutes: 'min',

  // Onboarding descriptions
  onboarding_desc_1: 'Tilawah, Tafsir, Carian, dan Waktu solat — semuanya dalam satu aplikasi.',
  onboarding_desc_2: 'Pilih qari kegemaran anda daripada 8 qari, kawal kelajuan dan pemasa tidur.',
  onboarding_desc_3: 'Cari seluruh al-Quran dengan hasil yang diurut mengikut kaitan dan auto-lengkap.',
  onboarding_desc_4: '6 tafsir dipercayai dan terjemahan makna dalam pelbagai bahasa.',
  onboarding_desc_5: 'Waktu solat tepat dengan azan dan pemberitahuan.',
  onboarding_desc_6: 'Mod malam, pelarasan fon dan jarak, eksport kegemaran.',

  // Update banner
  update_available: 'Kemas kini tersedia',
  update_now: 'Kemas Kini',

  // Mushaf loading & error states
  mushaf_loading_title: 'Memuatkan halaman mushaf...',
  mushaf_loading_subtitle: 'Memuatkan fon mushaf, ini mungkin mengambil sedikit masa',
  mushaf_load_failed: 'Gagal memuatkan halaman mushaf',
  mushaf_check_connection: 'Periksa sambungan internet anda dan cuba lagi',
  mushaf_retry_reload: 'Cuba Lagi',

  // Tajweed legend
  tajweed_legend_title: 'Warna Tajwid',
  tajweed_madd_2: 'Madd 2',
  tajweed_madd_separated: 'Madd 2-4-6 & Terpisah',
  tajweed_madd_6: 'Madd 6 (Wajib)',
  tajweed_madd_connected: 'Madd Bersambung',
  tajweed_ghunnah: 'Ghunnah, Ikhfa & Iqlab',
  tajweed_shamsiyyah: 'Lām Syamsiyyah & Qalqalah',
  tajweed_idgham: 'Hamzat Wasl & Idgham',
  tajweed_sukoon: 'Sukun',

  // Prayer names (i18n for PRAYER_NAMES_AR)
  prayer_fajr: 'Subuh',
  prayer_sunrise: 'Syuruq',
  prayer_dhuhr: 'Zuhur',
  prayer_asr: 'Asar',
  prayer_maghrib: 'Maghrib',
  prayer_isha: 'Isyak',

  // City defaults
  makkah: 'Makkah',

  // Juz & Sajdah labels
  juz_num: 'Juzuk {0}',
  sajdah_wajib: 'Sujud Wajib',
  sajdah_mustahab: 'Sujud Sunnah',

  // Background mood labels
  bg_dawn: 'Fajar',
  bg_morning: 'Pagi',
  bg_afternoon: 'Tengah Hari',
  bg_sunset: 'Matahari Terbenam',
  bg_night: 'Malam',

  // Presentation counter zero state
  pres_counter_zero: '0 / 0',

  // Minutes abbreviation
  minutes_abbr: '{0} min',

  // Invalid data error
  invalid_data: 'Data tidak sah',

  // Individual weekday keys (for config.ts ARABIC_WEEKDAYS backward compat)
  weekday_sunday: 'Ahad',
  weekday_monday: 'Isnin',
  weekday_tuesday: 'Selasa',
  weekday_wednesday: 'Rabu',
  weekday_thursday: 'Khamis',
  weekday_friday: 'Jumaat',
  weekday_saturday: 'Sabtu',
};

export default ms;
