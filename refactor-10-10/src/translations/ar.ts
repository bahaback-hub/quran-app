/**
 * Arabic translation bundle — with plural forms.
 *
 * Plural form keys (per Intl.PluralRules):
 *   - zero  (0)
 *   - one   (1)
 *   - two   (2)
 *   - few   (3-10)
 *   - many  (11-99)
 *   - other (100+)
 */

const ar = {
  // App
  app_title: 'القرآن الكريم',
  loading: 'جاري التحميل...',
  error: 'حدث خطأ',
  retry: 'إعادة المحاولة',

  // Navigation
  quran: 'القرآن',
  player: 'المشغل',
  controls: 'أدوات',
  search: 'بحث',
  more: 'القائمة',

  // Surah
  surah: 'السورة',
  ayah: 'آية',
  bismillah: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  select_hint: '📿 اختر سورة من القائمة لعرض النص والاستماع',

  // === PLURAL FORMS ===
  ayah_count: {
    zero: 'لا توجد آيات',
    one: 'آية واحدة',
    two: 'آيتان',
    few: '{count} آيات',
    many: '{count} آية',
    other: '{count} آية',
  },

  favorite_count: {
    zero: 'لا توجد مفضلات',
    one: 'مفضلة واحدة',
    two: 'مفضلتان',
    few: '{count} مفضلات',
    many: '{count} مفضلة',
    other: '{count} مفضلة',
  },

  search_results: {
    zero: 'لا توجد نتائج',
    one: 'نتيجة واحدة',
    two: 'نتيجتان',
    few: '{count} نتائج',
    many: '{count} نتيجة',
    other: '{count} نتيجة',
  },

  minutes_remaining: {
    one: 'دقيقة واحدة متبقية',
    two: 'دقيقتان متبقيتان',
    few: '{count} دقائق متبقية',
    many: '{count} دقيقة متبقية',
    other: '{count} دقيقة متبقية',
  },

  pages_count: {
    one: 'صفحة واحدة',
    two: 'صفحتان',
    few: '{count} صفحات',
    many: '{count} صفحة',
    other: '{count} صفحة',
  },

  // Audio
  play: 'تشغيل',
  pause: 'إيقاف',
  next_ayah: 'الآية التالية',
  prev_ayah: 'الآية السابقة',
  next_surah: 'السورة التالية',
  prev_surah: 'السورة السابقة',
  reciter: 'القارئ',
  speed: 'السرعة',
  repeat: 'التكرار',
  sleep_timer: 'مؤقت النوم',

  // Themes
  theme_light: 'الوضع النهاري',
  theme_sepia: 'وضع السيبيا',
  theme_night: 'الوضع الليلي',

  // Prayer
  prayer_fajr: 'الفجر',
  prayer_sunrise: 'الشروق',
  prayer_dhuhr: 'الظهر',
  prayer_asr: 'العصر',
  prayer_maghrib: 'المغرب',
  prayer_isha: 'العشاء',
  next_prayer: 'الصلاة التالية',

  // Tafsir
  tafsir: 'التفسير',
  tafsir_muyassar: 'التفسير الميسّر',
  tafsir_ibn_kathir: 'تفسير ابن كثير',
  tafsir_tabari: 'تفسير الطبري',
  tafsir_saadi: 'تفسير السعدي',
  tafsir_baghawi: 'تفسير البغوي',
  tafsir_qurtubi: 'تفسير القرطبي',
  tafsir_no_ayah: '📖 اختر سورة وآية لعرض التفسير',

  // Favorites
  favorites: 'المفضلة',
  favorites_empty: 'لا توجد آيات مفضلة بعد',
  favorite_added: 'تمت الإضافة للمفضلة',
  favorite_removed: 'تمت الإزالة من المفضلة',

  // Bookmarks
  bookmark_set: 'تم تعيين العلامة المرجعية',
  bookmark_goto: 'الانتقال للعلامة',
  bookmark_not_set: 'لا توجد علامة مرجعية',

  // Search
  search_placeholder: 'ابحث في القرآن...',
  search_no_results: 'لا توجد نتائج مطابقة',
  search_history: 'سجل البحث',
  search_clear: 'مسح السجل',

  // Settings
  settings: 'الإعدادات',
  settings_save: 'حفظ الإعدادات',
  settings_reset: 'إعادة تعيين',
  settings_export: 'تصدير الإعدادات',
  settings_import: 'استيراد الإعدادات',

  // Errors
  error_load_surah: 'تعذّر تحميل السورة. تحقق من الاتصال بالإنترنت.',
  error_load_audio: 'تعذّر تحميل الصوت. حاول مرة أخرى.',
  error_load_tafsir: 'تعذّر تحميل التفسير.',
  error_search: 'حدث خطأ أثناء البحث.',
  offline_banner: '🔌 لا يوجد اتصال بالإنترنت — بعض الميزات قد لا تعمل',

  // Mushaf
  mushaf_mode: 'وضع المصحف',
  page: 'صفحة',
  page_of: 'صفحة {current} من {total}',

  // Presentation
  presentation_mode: 'وضع العرض',
  exit: 'خروج',
  fullscreen: 'ملء الشاشة',

  // Adhkar
  adhkar: 'الأذكار',
  adhkar_morning: 'أذكار الصباح',
  adhkar_evening: 'أذكار المساء',
  adhkar_count: 'العدد: {count}',

  // Toasts
  surah_loaded: 'تم تحميل {name}',
  position_saved: 'تم حفظ الموضع',
  khatm_completed: 'تمت الختمة 🎉',

  // Weekdays
  weekdays: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
} as const;

export default ar;
