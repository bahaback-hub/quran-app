// Turkish translations
import type { TranslationBundle } from '../i18n';

const tr: TranslationBundle = {
  // App
  app_title: 'Mükemmel Kuran',
  app_subtitle: 'Al-Sulaimani Ailesi — Tilavet, İşaretli Okuma, Tam Arama ve Tefsir',
  app_description: 'Kuran Uygulaması — Tilavet, Arama, Tefsir ve Namaz Vakitleri',

  // Navigation
  select_surah: 'Sure Seç',
  select_reciter: 'Kurra Seç',
  select_tafsir: 'Tefsir Seç',
  search_placeholder: 'Bir kelime girin...',

  // Player
  play: '⏯ Oynat',
  pause: '⏸ Duraklat',
  prev_ayah: '◀ Önceki',
  next_ayah: 'Sonraki ▶',
  prev_surah: '⏮ Önceki Sure',
  next_surah: 'Sonraki Sure ⏭',
  hifdh_mode: '🕋 Ezberle',
  repeat: '🔁 Tekrarla',
  bookmark: '🔖 Yer İşiareti',
  favorite: '❤️ Favori',
  share: '📤 Paylaş',
  speed: 'Hız',

  // Surah mode
  mode_surah: '📄 Sure Modu',
  mode_mushaf: '📄 Mushaf Modu',

  // Mushaf
  page: 'Sayfa',
  juz: 'Cüz',
  select_page: 'Sayfa Numarası',
  surah_list: '📖 Sureler',

  // Search
  search: '🔎 Ara',
  clear_results: 'Sonuçları Temizle',
  min_chars: 'En az 2 karakter girin',
  no_results: 'Sonuç bulunamadı',
  results_count: 'Sonuç sayısı',
  all_quran: "Tüm Kuran'ı Ara",

  // Tafsir
  tafsir: '📜 Tefsir',
  tafsir_no_ayah: '📖 Tefsir görmek için sure ve ayet seçin',
  tafsir_loading: '⏳ Tefsir yükleniyor...',
  tafsir_error: '⚠️ Tefsir yüklenemedi',

  // Settings
  settings: '⚙️ Ayarlar',
  close: '✖',
  reset_settings: '🔄 Ayarları Sıfırla',
  confirm_reset: 'Tüm ayarları sıfırlamak istediğinizden emin misiniz?',
  language: 'Dil',

  // Location & Prayer
  city: 'Şehir',
  country: 'Ülke',
  calculation_method: 'Hesaplama Yöntemi',
  quick_select: 'Hızlı Seçim',
  save_location: '💾 Konumu Kaydet ve Vakitleri Güncelle',
  prayer_times: '🕌 Namaz Vakitleri',
  next_prayer: 'Sıradaki Namaz',
  time_remaining: 'Kalan Süre',
  loading_prayer: '⏳ Namaz vakitleri yükleniyor...',
  cached_prayer: 'Önbelleğe alınmış namaz vakitleri gösteriliyor',
  failed_prayer: 'Namaz vakitleri yüklenemedi',

  // Azan
  azan: '🔔 Ezan',
  azan_enable: 'Ezan Uyarısı',
  azan_fajr: 'Sabah Ezanı',
  test_azan: '▶️ Ezanı Test Et',
  stop_azan: '⏹️ Ezanı Durdur',
  azan_playing: '🔔 Ezan çalıyor',
  azan_stopped: 'Ezan durduruldu',
  azan_failed: 'Ezan çalınamadı',
  azan_by: '🎙️ Ezan: Şeyh Nasır El-Katami',
  prayer_time_come: 'Namaz vakti geldi',
  prayer: 'Namaz',

  // Display
  display: '🎨 Görünüm',
  font_size: 'Yazı Boyutu',
  night_mode: 'Gece Modu',
  auto_save: 'Son konumu otomatik kaydet',
  background: '🖼️ Arka Plan',
  bg_none: 'Yok',

  // Favorites
  favorites: '❤️ Favoriler',
  no_favorites: 'Henüz favori ayet yok',
  added_to_favorites: '❤️ Favorilere eklendi',
  removed_from_favorites: '💔 Favorilerden kaldırıldı',
  go_to: 'Git',
  delete: 'Sil',
  deleted: 'Silindi',

  // Bookmark
  bookmark_saved: '🔖 Yer işareti kaydedildi',
  bookmark_not_found: 'Yer işareti bulunamadı',

  // Messages
  loading_surah: '⏳ Sure yükleniyor',
  failed_load_surah: 'Sure yüklenemedi',
  surah_complete: '✅ Sure tamamlandı',
  repeat_complete: '✅ Tekrar tamamlandı',
  hifdh_on: '🧠 Ezberleme modu aktif edildi',
  hifdh_off: 'Ezberleme modu devre dışı',
  repeat_on: '🔁 Tekrar modu aktif edildi',
  repeat_off: 'Tekrar devre dışı',
  no_audio: 'Bu sure için ses bağlantısı yok',
  no_audio_ayah: 'Bu ayet için ses yok',
  audio_error: '⚠️ Ses çalınamadı, başka bir ayet deneyin',
  copied: '📋 Ayet kopyalandı',
  failed_copy: 'Ayet kopyalanamadı',
  loading_quran_db: 'Kuran veritabanı yükleniyor (sadece bir kez)...',
  quran_db_ready: '✅ Kuran veritabanı hazır',
  quran_db_loading: '⚠️ Kuran veritabanı yükleniyor, lütfen bekleyin',

  // Keyboard hint
  keyboard_hint:
    '💡 Kısayollar: Space = Oynat/Duraklat | ← → = Önceki/Sonraki Ayet | S = Önceki Sure | D = Sonraki Sure | H = Ezberle | T = Tefsir | R = Tekrar | M = Mushaf',

  // Footer
  footer_data_from: 'Veriler',
  footer_by: 'Al-Sulaimani Ailesi',
  footer_prayer: "Allah bu çalışmayı Al-Sulaimani Ailesi'nden kabul etsin",

  // Weekdays
  weekdays: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],

  // Surah
  surah: 'Sure',
  ayah: 'Ayet',

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
    'مكة|SA': 'Mekke',
    'المدينة|SA': 'Medine',
    'الرياض|SA': 'Riyad',
    'القاهرة|EG': 'Kahire',
    'دمشق|SY': 'Şam',
    'عمان|JO': 'Amman',
    'بغداد|IQ': 'Bağdat',
    'الدوحة|QA': 'Doha',
    'الكويت|KW': 'Kuveyt',
    'دبي|AE': 'Dubai',
    'بيروت|LB': 'Beyrut',
    'الجزائر|DZ': 'Cezayir',
    'الرباط|MA': 'Rabat',
    'تونس|TN': 'Tunus',
    'الخرطوم|SD': 'Hartum',
    'صنعاء|YE': 'Sana',
    'إسطنبول|TR': 'İstanbul',
  },

  // Calculation methods
  calc_methods: {
    '4': 'Umm Al-Qura — Mekke',
    '5': 'Mısır Otoritesi',
    '3': 'Dünya Müslüman Birliği',
    '2': 'ISNA — Kuzey Amerika',
    '1': 'Karachi Üniversitesi',
    '8': 'Kuveyt',
    '9': 'Katar',
    '10': 'Singapur',
    '12': 'İslam Birliği (Fransa)',
    '13': 'Diyanet — Türkiye',
  },

  // Toast types
  success: 'Başarılı',
  error: 'Hata',
  loading: '⏳ Yükleniyor...',
  select_hint: '📿 Listeden bir sure seçin',

  // Azan notification
  azan_notif_stop: '⏹️ Ezanı Durdur',

  // Continue widget
  continue_reading: '📖 Okumaya Devam Et',
  last_visit: 'Son ziyaret',

  // Search results
  search_play: '▶️ Oynat',
  search_copy: '📋 Kopyala',
  search_share: '📤 Paylaş',
  search_goto: '📍 Git',

  // Translation
  translation: '🌐 Çeviri',
  translation_select: 'Çeviri Seç',
  translation_on: 'Çeviri etkinleştirildi',
  translation_off: 'Çeviri devre dışı',

  // Adhkar
  adhkar: 'Esmâ ül-Hüsnâ',
  adhkar_personal: 'Kişisel Esmâ ül-Hüsnâ',
  adhkar_add: 'Yeni Zikir Ekle',
  adhkar_edit: 'Düzenle',
  adhkar_delete: 'Sil',
  adhkar_saved: '✅ Zikir eklendi',
  adhkar_edited: '✏️ Zikir düzenlendi',
  adhkar_deleted: '🗑️ Zikir silindi',
  adhkar_reset: '🔄 Esmâ ül-Hüsnâ sıfırlandı',
  adhkar_notification: '🕌 Zikir vakti',
  adhkar_enable: 'Hatırlatıcıları etkinleştir',
  adhkar_sound: '🔔 Sesli uyarı',
  adhkar_later: '⏰ Daha Sonra',
  adhkar_open: '🕌 Esmâ ül-Hüsnâ Aç',
  adhkar_add_dialog: '📝 Yeni Zikir Ekle',
  adhkar_text: 'Zikir metni',
  adhkar_count: 'Tekrar sayısı',
  adhkar_time: 'Hatırlatıcı zamanı (isteğe bağlı)',
  adhkar_duration: 'Bildirim süresi (dakika)',
  adhkar_save: '💾 Zikri Kaydet',
  adhkar_no_personal: '📝 Henüz kişisel zikir yok',
  adhkar_confirm_delete: '🗑️ Bu zikri silmek istiyor musunuz?',
  adhkar_enter_text: '📝 Zikir metnini girin',
  adhkar_times: 'kez',
  adhkar_remaining: 'kalan',

  // Welcome screen
  welcome_title: 'Mükemmel Kuran',
  welcome_subtitle: 'Al-Sulaimani Ailesi',
  welcome_feature_audio: '🎧 8 kurradan dinleyin',
  welcome_feature_search: "🔎 Tüm Kuran'ı arayın",
  welcome_feature_tafsir: '📜 6 muteber tefsir eseri',
  welcome_feature_translation: '🌐 Çeviri (İngilizce, Fransızca, Urduca)',
  welcome_feature_mushaf: "📄 Mushaf'ı tarayın",
  welcome_feature_prayer: '🕌 Namaz vakitleri ve ezan',
  welcome_dismiss: '✌️ Başla',

  // Missing keys added for 10/10 quality
  // Sleep timer
  sleep_timer_title: '⏰ Uyku Zamanlayıcısı',
  sleep_timer_placeholder: 'Dakika',
  sleep_timer_hint: 'Dakika girin ve onaylayın',
  sleep_timer_confirm: '✅ Onayla',
  sleep_timer_cancel: '❌ İptal',
  sleep_timer_cancelled: 'Uyku zamanlayıcısı iptal edildi',
  sleep_timer_stopped: '⏰ {0} dakika sonra ses durduruldu',
  sleep_timer_set: '⏰ Uyku zamanlayıcısı: {0} dakika',

  // Stats
  stats_ayahs_read: 'Okunan Ayetler',
  stats_reading_time: 'Okuma Süresi',
  stats_surahs_read: 'Okunan Sureler',
  stats_streak_days: 'Gün Serisi',
  stats_sessions: 'Okuma Oturumları',
  stats_last_read: 'Son Okuma',
  stats_hours_mins: '{0}s {1}d',
  stats_mins: '{0} dk',

  // Mushaf
  previous_page: 'Önceki Sayfa',
  next_page: 'Sonraki Sayfa',
  mushaf_page_info: 'Sayfa {0} / 604',
  mushaf_juz: 'Cüz {0}',
  mushaf_page_error: 'Sayfa görüntülenemedi',
  mushaf_page_not_found: 'Sayfa bulunamadı',
  mushaf_no_secret: 'Bu sure için kayıtlı sır yok',
  mushaf_surah_info: 'ℹ️ Sure Bilgisi',
  surah_info_for: '{0} Suresi Bilgisi',
  mushaf_loading_page: '⏳ {0}. sayfa yükleniyor...',

  // Search UI
  search_history_title: '🕐 Son Aramalar',
  voice_search_unsupported: 'Sesli arama bu tarayıcıda desteklenmiyor',
  voice_search_speaking: '🎤 Şimdi konuşun...',
  voice_search_not_recognized: '🎤 Ses tanınamadı, tekrar deneyin',
  load_more: '📥 Daha fazla yükle ({0}+)',
  failed_ayah: 'Ayet alınamadı',

  // Ayah modal
  ayah_modal_title: '{1} Suresi {0}. Ayet',
  last_ayah_in_quran: "Bu Kur'an'daki son ayettir",
  next_ayah_label: '← Sonraki ayet: {1} - {0}. Ayet',
  page_loading: '📄 Sayfa: Yükleniyor...',
  juz_loading: '📖 Cüz: Yükleniyor...',
  page_info: '📄 Sayfa: {0}',
  juz_info: '📖 Cüz: {0}',
  bookmark_position_saved: '✅ Yer imi kaydedildi',
  in_favorites: '⭐ Favorilerde',
  add_to_favorites: '⭐ Favorilere Ekle',
  copy_text: '📋 Metni Kopyala',
  copy_simple: '📋 Sade Metni Kopyala',
  copy_with_tafsir: '📋 Tefsirle Kopyala',
  copy_for_share: '📤 Paylaşmak İçin Kopyala',
  ayah_modal_play: '▶️ Oynat',
  ayah_modal_pause: '⏸️ Durdur',
  play_ayah_first: 'Önce ayeti oynatın',
  no_tafsir_available: '⚠️ Tefsir mevcut değil',

  // Prayer
  qibla_direction: 'Kıble Yönü: {0} ({1}°)',
  qibla_location_failed: '⚠️ Konum tespit edilemedi',
  location_not_supported: '⚠️ Konum desteklenmiyor',
  prayer_countdown: '{0} — {1} sonra',
  prayer_dirs: 'Kuzey',
  prayer_dirs_ne: 'Kuzeydoğu',
  prayer_dirs_e: 'Doğu',
  prayer_dirs_se: 'Güneydoğu',
  prayer_dirs_s: 'Güney',
  prayer_dirs_sw: 'Güneybatı',
  prayer_dirs_w: 'Batı',
  prayer_dirs_nw: 'Kuzeybatı',

  // Favorites
  favorites_export_none: 'Dışa aktarılacak favori ayet yok',
  favorites_exported_text: '📄 Favoriler metin olarak dışa aktarıldı',
  favorites_exported_json: '💾 Favoriler JSON olarak dışa aktarıldı',

  // Select mode
  select_mode_none: 'Hiçbir ayet seçilmedi',
  select_mode_copied: '📋 {0} ayet kopyalandı',

  // Error boundary
  error_title: 'Beklenmeyen bir hata oluştu',
  error_description:
    'Uygulama beklenmeyen bir sorunla karşılaştı. Yeniden yükleyebilir veya ana sayfaya dönebilirsiniz.',
  error_reload: '🔄 Yeniden Yükle',
  error_home: '🏠 Ana Sayfa',
  error_copy_details: '📋 Hata Ayrıntılarını Kopyala',
  error_technical: 'Teknik Ayrıntılar',
  error_copied: '✅ Kopyalandı',

  // API errors
  error_no_connection: '⚠️ İnternet bağlantısı yok',
  error_timeout: '⏱️ İstek zaman aşımına uğradı',
  error_server_unreachable: '⚠️ Sunucuya ulaşılamıyor',
  error_server_error: '⚠️ Sunucu hatası',
  error_invalid_data: '⚠️ Geçersiz veri',
  error_unexpected: '⚠️ Beklenmeyen bir hata oluştu',

  // Onboarding
  onboarding_skip: 'Geç',
  onboarding_prev: '→ Geri',
  onboarding_next: 'İleri ←',
  onboarding_start: '✔️ Başla',

  // Share
  share_copied_simple: '📋 Sade metin kopyalandı',

  // Surah loader
  loading_surah_list: '⏳ Sure listesi yükleniyor...',
  offline_no_audio: '📖 Çevrimdışı mod — ses kullanılamıyor',
  surah_info_title: 'Sure Bilgisi',

  // Continue widget
  continue_ayah: ' — Ayet {0}',
  last_visit_time: 'Son ziyaret: {0}',

  // Mushaf sources
  mushaf_sources: '📚 Kaynaklar:',
  no_audio_data: 'Ses verisi mevcut değil',
  invalid_surah_data: 'Geçersiz sure verisi',
  settings_imported: '✅ {0} ayar içe aktarıldı. Yeniden yükleniyor...',
  failed_load_backgrounds: 'Arka plan listesi yüklenemedi',
  notification_active: '🔔 Bildirim aktif',
  notification_paused: '🔕 Bildirim duraklatıldı',
  minutes: 'dk',

  // Onboarding descriptions
  onboarding_desc_1: 'Tilavet, Tefsir, Arama ve Namaz vakitleri — hepsi tek uygulamada.',
  onboarding_desc_2: '8 okuyucu arasından seçim yapın, hızı ve uyku zamanlayıcısını kontrol edin.',
  onboarding_desc_3: "Tüm Kuran'ı alaka düzeyine göre sıralanmış sonuçlar ve otomatik tamamlama ile arayın.",
  onboarding_desc_4: '6 güvenilir tefsir ve birden çok dilde anlam çevirisi.',
  onboarding_desc_5: 'Ezan ve bildirimlerle doğru namaz vakitleri.',
  onboarding_desc_6: 'Gece modu, sepya modu, yazı tipi ve boşluk ayarları, favori dışa aktarma.',
};

export default tr;
