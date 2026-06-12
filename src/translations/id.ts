// Indonesian translations
import type { TranslationBundle } from '../i18n';

const id: TranslationBundle = {
  // App
  app_title: "Al-Qur'an yang Mulia",
  app_subtitle: 'Keluarga Al-Sulaimani — Membaca, Penandaan, Pencarian Lengkap, dan Tafsir',
  app_description: "Aplikasi Al-Qur'an — Membaca, Pencarian, Tafsir, dan Waktu Sholat",

  // Navigation
  select_surah: 'Pilih Surah',
  select_reciter: 'Pilih Qari',
  select_tafsir: 'Pilih Tafsir',
  search_placeholder: 'Masukkan kata...',

  // Player
  play: '⏯ Putar',
  pause: '⏸ Jeda',
  prev_ayah: '◀ Sebelumnya',
  next_ayah: 'Berikutnya ▶',
  prev_surah: '⏮ Surah Sebelumnya',
  next_surah: 'Surah Berikutnya ⏭',
  hifdh_mode: '🕋 Hafalkan',
  repeat: '🔁 Ulangi',
  bookmark: '🔖 Tandai',
  favorite: '❤️ Favorit',
  share: '📤 Bagikan',
  speed: 'Kecepatan',

  // Surah mode
  mode_surah: '📄 Mode Surah',
  mode_mushaf: '📄 Mode Mushaf',

  // Mushaf
  page: 'Halaman',
  juz: 'Juz',
  select_page: 'Nomor Halaman',
  surah_list: '📖 Surah',

  // Search
  search: '🔎 Cari',
  clear_results: 'Hapus Hasil',
  min_chars: 'Masukkan minimal 2 karakter',
  no_results: 'Tidak ada hasil yang ditemukan',
  results_count: 'Jumlah hasil',
  all_quran: "Cari Seluruh Al-Qur'an",

  // Tafsir
  tafsir: '📜 Tafsir',
  tafsir_no_ayah: '📖 Pilih surah dan ayah untuk melihat tafsir',
  tafsir_loading: '⏳ Memuat tafsir...',
  tafsir_error: '⚠️ Gagal memuat tafsir',

  // Settings
  settings: '⚙️ Pengaturan',
  close: '✖',
  reset_settings: '🔄 Atur Ulang Pengaturan',
  confirm_reset: 'Apakah Anda yakin ingin mengatur ulang semua pengaturan?',
  language: 'Bahasa',

  // Location & Prayer
  city: 'Kota',
  country: 'Negara',
  calculation_method: 'Metode Perhitungan',
  quick_select: 'Pilihan Cepat',
  save_location: '💾 Simpan Lokasi & Perbarui Waktu',
  prayer_times: '🕌 Waktu Sholat',
  next_prayer: 'Sholat Berikutnya',
  time_remaining: 'Waktu Tersisa',
  loading_prayer: '⏳ Memuat waktu sholat...',
  cached_prayer: 'Menampilkan waktu sholat yang tersimpan',
  failed_prayer: 'Gagal memuat waktu sholat',

  // Azan
  azan: '🔔 Azan',
  azan_enable: 'Peringatan Azan',
  azan_fajr: 'Azan Subuh',
  test_azan: '▶️ Uji Azan',
  stop_azan: '⏹️ Hentikan Azan',
  azan_playing: '🔔 Azan sedang diputar',
  azan_stopped: 'Azan dihentikan',
  azan_failed: 'Gagal memutar azan',
  azan_by: '🎙️ Azan oleh Sheikh Nasser Al-Qatami',
  prayer_time_come: 'Waktu sholat telah tiba',
  prayer: 'Sholat',

  // Display
  display: '🎨 Tampilan',
  font_size: 'Ukuran Font',
  night_mode: 'Mode Malam',
  auto_save: 'Simpan otomatis posisi terakhir',
  background: '🖼️ Latar Belakang',
  bg_none: 'Tidak Ada',

  // Favorites
  favorites: '❤️ Favorit',
  no_favorites: 'Belum ada ayah favorit',
  added_to_favorites: '❤️ Ditambahkan ke favorit',
  removed_from_favorites: '💔 Dihapus dari favorit',
  go_to: 'Pergi',
  delete: 'Hapus',
  deleted: 'Dihapus',

  // Bookmark
  bookmark_saved: '🔖 Tandai tersimpan',
  bookmark_not_found: 'Tidak ada tanda yang ditemukan',

  // Messages
  loading_surah: '⏳ Memuat surah',
  failed_load_surah: 'Gagal memuat surah',
  surah_complete: '✅ Surah selesai',
  repeat_complete: '✅ Pengulangan selesai',
  hifdh_on: '🧠 Mode menghafal diaktifkan',
  hifdh_off: 'Mode menghafal dinonaktifkan',
  repeat_on: '🔁 Mode pengulangan diaktifkan',
  repeat_off: 'Pengulangan dinonaktifkan',
  no_audio: 'Tidak ada tautan audio untuk surah ini',
  no_audio_ayah: 'Tidak ada audio untuk ayah ini',
  audio_error: '⚠️ Gagal memutar audio, coba ayah lain',
  next_ayah: 'Melanjut ke ayah berikutnya',
  sleep_timer_remaining: 'Sisa',
  copied: '📋 Ayah disalin',
  failed_copy: 'Gagal mendapatkan ayah',
  loading_quran_db: "Memuat basis data Al-Qur'an (hanya sekali)...",
  quran_db_ready: "✅ Basis data Al-Qur'an siap",
  quran_db_loading: "⚠️ Basis data Al-Qur'an sedang dimuat, harap tunggu",

  // Keyboard hint
  keyboard_hint:
    '💡 Pintasan: Space = Putar/Jeda | ← → = Ayah Sebelumnya/Berikutnya | S = Surah Sebelumnya | D = Surah Berikutnya | H = Hafalkan | T = Tafsir | R = Ulangi | M = Mushaf',

  // Footer
  footer_data_from: 'Data dari',
  footer_by: 'Keluarga Al-Sulaimani',
  footer_prayer: 'Semoga Allah menerima amalan ini dari Keluarga Al-Sulaimani',

  // Weekdays
  weekdays: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],

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
    'القاهرة|EG': 'Kairo',
    'دمشق|SY': 'Damaskus',
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
    '5': 'Otoritas Mesir',
    '3': 'Liga Dunia Muslim',
    '2': 'ISNA — Amerika Utara',
    '1': 'Universitas Karachi',
    '8': 'Kuwait',
    '9': 'Qatar',
    '10': 'Singapura',
    '12': 'Serikat Ulama Islam (Prancis)',
    '13': 'Diyanet — Turki',
  },

  // Toast types
  success: 'Berhasil',
  error: 'Galat',
  loading: '⏳ Memuat...',
  select_hint: '📿 Pilih surah dari daftar',

  // Azan notification
  azan_notif_stop: '⏹️ Hentikan Azan',

  // Continue widget
  continue_reading: '📖 Lanjutkan Membaca',
  last_visit: 'Kunjungan terakhir',

  // Search results
  search_play: '▶️ Putar',
  search_copy: '📋 Salin',
  search_share: '📤 Bagikan',
  search_goto: '📍 Pergi',

  // Translation
  translation: '🌐 Terjemahan',
  translation_select: 'Pilih Terjemahan',
  translation_on: 'Terjemahan diaktifkan',
  translation_off: 'Terjemahan dinonaktifkan',

  // Adhkar
  adhkar: 'Adhkar',
  adhkar_personal: 'Adhkar Saya',
  adhkar_add: 'Tambahkan Dhikr Baru',
  adhkar_edit: 'Edit',
  adhkar_delete: 'Hapus',
  adhkar_saved: '✅ Dhikr ditambahkan',
  adhkar_edited: '✏️ Dhikr diedit',
  adhkar_deleted: '🗑️ Dhikr dihapus',
  adhkar_reset: '🔄 Adhkar diatur ulang',
  adhkar_notification: '🕌 Waktu Adhkar',
  adhkar_enable: 'Aktifkan pengingat',
  adhkar_sound: '🔔 Peringatan suara',
  adhkar_later: '⏰ Nanti',
  adhkar_open: '🕌 Buka Adhkar',
  adhkar_add_dialog: '📝 Tambahkan Dhikr baru',
  adhkar_text: 'Teks Dhikr',
  adhkar_count: 'Jumlah pengulangan',
  adhkar_time: 'Waktu pengingat (opsional)',
  adhkar_duration: 'Durasi notifikasi (menit)',
  adhkar_save: '💾 Simpan Dhikr',
  adhkar_no_personal: '📝 Belum ada adhkar pribadi',
  adhkar_confirm_delete: '🗑️ Hapus dhikr ini?',
  adhkar_enter_text: '📝 Masukkan teks dhikr',
  adhkar_times: 'kali',
  adhkar_remaining: 'tersisa',

  // Welcome screen
  welcome_title: "Al-Qur'an yang Mulia",
  welcome_subtitle: 'Keluarga Al-Sulaimani',
  welcome_feature_audio: '🎧 Dengarkan 8 qari',
  welcome_feature_search: "🔎 Cari seluruh Al-Qur'an",
  welcome_feature_tafsir: '📜 6 karya tafsir otoritatif',
  welcome_feature_translation: '🌐 Terjemahan (Inggris, Prancis, Urdu)',
  welcome_feature_mushaf: '📄 Jelajahi mushaf',
  welcome_feature_prayer: '🕌 Waktu sholat & azan',
  welcome_dismiss: '✌️ Mulai',

  // Missing keys added for 10/10 quality
  // Sleep timer
  sleep_timer_title: '⏰ Timer Tidur',
  sleep_timer_placeholder: 'Menit',
  sleep_timer_hint: 'Masukkan menit dan tekan konfirmasi',
  sleep_timer_confirm: '✅ Konfirmasi',
  sleep_timer_cancel: '❌ Batal',
  sleep_timer_cancelled: 'Timer tidur dibatalkan',
  sleep_timer_stopped: '⏰ Audio dihentikan setelah {0} menit',
  sleep_timer_set: '⏰ Timer tidur: {0} menit',

  // Stats
  stats_ayahs_read: 'Ayat Dibaca',
  stats_reading_time: 'Waktu Baca',
  stats_surahs_read: 'Surah Dibaca',
  stats_streak_days: 'Hari Beruntun',
  stats_sessions: 'Sesi Membaca',
  stats_last_read: 'Terakhir Dibaca',
  stats_hours_mins: '{0}j {1}m',
  stats_mins: '{0} mnt',

  // Mushaf
  previous_page: 'Halaman Sebelumnya',
  next_page: 'Halaman Berikutnya',
  mushaf_page_info: 'Halaman {0} dari 604',
  mushaf_juz: 'Juz {0}',
  mushaf_page_error: 'Gagal menampilkan halaman',
  mushaf_page_not_found: 'Halaman tidak ditemukan',
  mushaf_no_secret: 'Tidak ada rahasia tercatat untuk surah ini',
  mushaf_surah_info: 'ℹ️ Info Surah',
  surah_info_for: 'Info Surah {0}',
  mushaf_loading_page: '⏳ Memuat halaman {0}...',

  // Search UI
  search_history_title: '🕐 Pencarian Terbaru',
  search_history_cleared: 'Riwayat pencarian dihapus',
  voice_search_unsupported: 'Pencarian suara tidak didukung di browser ini',
  voice_search_speaking: '🎤 Bicara sekarang...',
  voice_search_not_recognized: '🎤 Suara tidak dikenali, coba lagi',
  load_more: '📥 Muat lebih banyak ({0}+)',
  failed_ayah: 'Gagal mendapatkan ayat',

  // Ayah modal
  ayah_modal_title: 'Ayat {0} dari Surah {1}',
  last_ayah_in_quran: 'Ini adalah ayat terakhir dalam Al-Quran',
  next_ayah_label: '← Ayat berikutnya: Ayat {0} - {1}',
  page_loading: '📄 Halaman: Memuat...',
  juz_loading: '📖 Juz: Memuat...',
  page_info: '📄 Halaman: {0}',
  juz_info: '📖 Juz: {0}',
  bookmark_position_saved: '✅ Posisi bookmark disimpan',
  in_favorites: '⭐ Di Favorit',
  add_to_favorites: '⭐ Tambah ke Favorit',
  copy_text: '📋 Salin Teks',
  copy_simple: '📋 Salin Teks Sederhana',
  copy_with_tafsir: '📋 Salin dengan Tafsir',
  copy_for_share: '📤 Salin untuk Dibagikan',
  ayah_modal_play: '▶️ Putar',
  ayah_modal_pause: '⏸️ Jeda',
  play_ayah_first: 'Putar ayat terlebih dahulu',
  no_tafsir_available: '⚠️ Tafsir tidak tersedia',

  // Prayer
  qibla_direction: 'Arah Kiblat: {0} ({1}°)',
  qibla_location_failed: '⚠️ Gagal mendeteksi lokasi',
  location_not_supported: '⚠️ Lokasi tidak didukung',
  prayer_countdown: '{0} — setelah {1}',
  prayer_dirs: 'Utara',
  prayer_dirs_ne: 'Timur Laut',
  prayer_dirs_e: 'Timur',
  prayer_dirs_se: 'Tenggara',
  prayer_dirs_s: 'Selatan',
  prayer_dirs_sw: 'Barat Daya',
  prayer_dirs_w: 'Barat',
  prayer_dirs_nw: 'Barat Laut',

  // Favorites
  favorites_export_none: 'Tidak ada ayat favorit untuk diekspor',
  favorites_exported_text: '📄 Favorit diekspor sebagai teks',
  favorites_exported_json: '💾 Favorit diekspor sebagai JSON',

  // Select mode
  select_mode_none: 'Tidak ada ayat dipilih',
  select_mode_copied: '📋 {0} ayat disalin',

  // Error boundary
  error_title: 'Terjadi kesalahan tak terduga',
  error_description: 'Aplikasi mengalami masalah tak terduga. Anda dapat memuat ulang atau kembali ke halaman utama.',
  error_reload: '🔄 Muat Ulang',
  error_home: '🏠 Halaman Utama',
  error_copy_details: '📋 Salin Detail Kesalahan',
  error_technical: 'Detail Teknis',
  error_copied: '✅ Disalin',

  // API errors
  error_no_connection: '⚠️ Tidak ada koneksi internet',
  error_timeout: '⏱️ Waktu permintaan habis',
  error_server_unreachable: '⚠️ Server tidak terjangkau',
  error_server_error: '⚠️ Kesalahan server',
  error_invalid_data: '⚠️ Data tidak valid',
  error_unexpected: '⚠️ Terjadi kesalahan tak terduga',

  // Onboarding
  onboarding_skip: 'Lewati',
  onboarding_prev: '→ Kembali',
  onboarding_next: 'Berikutnya ←',
  onboarding_start: '✔️ Mulai',

  // Share
  share_copied_simple: '📋 Teks sederhana disalin',

  // Surah loader
  loading_surah_list: '⏳ Memuat daftar surah...',
  offline_no_audio: '📖 Mode offline — audio tidak tersedia',
  surah_info_title: 'Info Surah',

  // Continue widget
  continue_ayah: ' — Ayat {0}',
  last_visit_time: 'Kunjungan terakhir: {0}',

  // Mushaf sources
  mushaf_sources: '📚 Sumber:',
  no_audio_data: 'Tidak ada data audio tersedia',
  invalid_surah_data: 'Data surah tidak valid',
  settings_imported: '✅ {0} pengaturan diimpor. Memuat ulang...',
  failed_load_backgrounds: 'Gagal memuat daftar latar belakang',
  notification_active: '🔔 Notifikasi aktif',
  notification_paused: '🔕 Notifikasi dijeda',
  minutes: 'mnt',

  // Onboarding descriptions
  onboarding_desc_1: 'Tilawah, Tafsir, Pencarian, dan Waktu sholat — semuanya dalam satu aplikasi.',
  onboarding_desc_2: 'Pilih qari favorit Anda dari 8 qari, kontrol kecepatan dan timer tidur.',
  onboarding_desc_3: 'Cari seluruh al-Quran dengan hasil yang diurut berdasarkan relevansi dan auto-lengkap.',
  onboarding_desc_4: '6 tafsir terpercaya dan terjemahan makna dalam berbagai bahasa.',
  onboarding_desc_5: 'Waktu sholat akurat dengan adzan dan notifikasi.',
  onboarding_desc_6: 'Mode malam, penyesuaian font dan jarak, ekspor favorit.',
};

export default id;
