// Arabic translations
const ar = {
  // App
  app_title: 'القرآن الكريم',
  app_subtitle: 'برمجة عائلة السليماني — تلاوة، تظليل، بحث كامل، وتفسير',
  app_description: 'تطبيق القرآن الكريم — تلاوة، بحث، تفسير، ومواقيت الصلاة',

  // Navigation
  select_surah: 'اختر السورة',
  select_reciter: 'اختر القارئ',
  select_tafsir: 'اختر التفسير',
  search_placeholder: 'اكتب كلمة...',

  // Player
  play: '⏯ تشغيل',
  pause: '⏸ إيقاف',
  prev_ayah: '◀ سابقة',
  next_ayah: 'تالية ▶',
  prev_surah: '⏮ السورة السابقة',
  next_surah: 'السورة التالية ⏭',
  hifdh_mode: '🕋 حفظ',
  repeat: '🔁 تكرار',
  bookmark: '🔖 علامة',
  favorite: '❤️ مفضلة',
  share: '📤 مشاركة',
  speed: 'السرعة',

  // Surah mode
  mode_surah: '📄 وضع السورة',
  mode_mushaf: '📄 وضع المصحف',

  // Mushaf
  page: 'صفحة',
  juz: 'الجزء',
  select_page: 'رقم الصفحة',
  surah_list: '📖 السور',
  choose_ayah: '🎯 اختر آية للاستماع أو التفسير',

  // Search
  search: '🔎 بحث',
  clear_results: 'مسح النتائج',
  min_chars: 'أدخل حرفين على الأقل',
  no_results: 'لا توجد نتائج',
  results_count: 'عدد النتائج',
  all_quran: 'البحث في القرآن كاملًا',

  // Tafsir
  tafsir: '📜 التفسير',
  tafsir_no_ayah: '📖 اختر سورة وآية لعرض التفسير',
  tafsir_loading: '⏳ جاري تحميل التفسير...',
  tafsir_error: '⚠️ تعذّر تحميل التفسير',

  // Settings
  settings: '⚙️ الإعدادات',
  close: '✖',
  reset_settings: '🔄 إعادة ضبط الإعدادات',
  confirm_reset: 'هل تريد إعادة ضبط جميع الإعدادات؟',
  language: 'اللغة',

  // Location & Prayer
  city: 'المدينة',
  country: 'الدولة',
  calculation_method: 'طريقة الحساب',
  quick_select: 'اختيار سريع',
  save_location: '💾 حفظ الموقع وتحديث المواقيت',
  prayer_times: '🕌 مواقيت الصلاة',
  next_prayer: 'الصلاة القادمة',
  time_remaining: 'الوقت المتبقي',
  loading_prayer: '⏳ جاري تحميل المواقيت...',
  cached_prayer: 'عرض المواقيت من الكاش المحلي',
  failed_prayer: 'تعذّر تحميل مواقيت الصلاة',

  // Azan
  azan: '🔔 الأذان',
  azan_enable: 'تنبيه الأذان',
  azan_fajr: 'أذان الفجر',
  test_azan: '▶️ اختبار الأذان',
  stop_azan: '⏹️ إيقاف الأذان',
  azan_playing: '🔔 الأذان يعمل',
  azan_stopped: 'تم إيقاف الأذان',
  azan_failed: 'تعذّر تشغيل الأذان',
  azan_by: '🎙️ الأذان بصوت الشيخ ناصر القطامي',
  prayer_time_come: 'حان الآن وقت الصلاة',
  prayer: 'صلاة',

  // Display
  display: '🎨 العرض',
  font_size: 'حجم الخط',
  night_mode: 'الوضع الليلي',
  auto_save: 'حفظ آخر موضع تلقائياً',
  background: '🖼️ الخلفية',
  bg_none: 'بدون',

  // Favorites
  favorites: '❤️ المفضلة',
  no_favorites: 'لا توجد آيات مفضلة بعد',
  added_to_favorites: '❤️ أُضيفت إلى المفضلة',
  removed_from_favorites: '💔 تمت إزالة من المفضلة',
  go_to: 'انتقال',
  delete: 'حذف',
  deleted: 'تم الحذف',

  // Bookmark
  bookmark_saved: '🔖 تم حفظ العلامة',
  bookmark_not_found: 'لا توجد علامة محفوظة',

  // Messages
  loading_surah: '⏳ جاري تحميل سورة',
  failed_load_surah: 'فشل تحميل السورة',
  surah_complete: '✅ انتهت سورة',
  repeat_complete: '✅ انتهى التكرار',
  hifdh_on: '🧠 وضع الحفظ مفعّل',
  hifdh_off: 'وضع الحفظ مغلق',
  repeat_on: '🔁 وضع التكرار مفعّل',
  repeat_off: 'التكرار مغلق',
  no_audio: 'لا توجد روابط صوت لهذه السورة',
  no_audio_ayah: 'لا يوجد صوت لهذه الآية',
  audio_error: '⚠️ تعذّر تشغيل الصوت، حاول آية أخرى',
  copied: '📋 تم نسخ الآية',
  failed_copy: 'فشل في الحصول على الآية',
  loading_quran_db: 'جاري تحميل قاعدة القرآن (مرة واحدة فقط)...',
  quran_db_ready: '✅ قاعدة القرآن جاهزة',
  quran_db_loading: '⚠️ قاعدة القرآن تُحمَّل، انتظر قليلاً',

  // Keyboard hint
  keyboard_hint: '💡 اختصارات: Space = تشغيل/إيقاف | ← → = آية سابقة/تالية | S = سورة سابقة | D = سورة تالية | H = حفظ | T = تفسير | R = تكرار | M = مصحح',

  // Footer
  footer_data_from: 'البيانات من',
  footer_by: 'برمجة عائلة السليماني',
  footer_prayer: 'اللهم اجعل هذا العمل في ميزان أعمال عائلة السليماني',

  // Weekdays
  weekdays: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],

  // Surah
  surah: 'سورة',
  ayah: 'آية',

  // Reciters
  reciters: {
    'ar.alafasy': 'مشاري العفاسي',
    'ar.abdulbasitmurattal': 'عبد الباسط عبد الصمد',
    'ar.abdurrahmaansudais': 'عبد الرحمن السديس',
    'ar.husary': 'محمود خليل الحصري',
    'ar.minshawi': 'محمد صديق المنشاوي',
    'ar.muhammadayyoub': 'محمد أيوب',
    'ar.aliabdurrahmanalhuthaify': 'علي الحذيفي',
    'ar.shaatree': 'أبو بكر الشاطري'
  },

  // Tafsir names
  tafsir_names: {
    'ar-tafsir-muyassar': 'التفسير الميسّر',
    'ar-tafsir-al-tabari': 'تفسير الطبري',
    'ar-tafsir-ibn-kathir': 'تفسير ابن كثير',
    'ar-tafsir-as-saadi': 'تفسير السعدي',
    'ar-tafsir-al-baghawi': 'تفسير البغوي',
    'ar-tafsir-al-qurtubi': 'تفسير القرطبي'
  },

  // Cities
  cities: {
    'مكة|SA': 'مكة المكرمة',
    'المدينة|SA': 'المدينة المنورة',
    'الرياض|SA': 'الرياض',
    'القاهرة|EG': 'القاهرة',
    'دمشق|SY': 'دمشق',
    'عمان|JO': 'عمّان',
    'بغداد|IQ': 'بغداد',
    'الدوحة|QA': 'الدوحة',
    'الكويت|KW': 'الكويت',
    'دبي|AE': 'دبي',
    'بيروت|LB': 'بيروت',
    'الجزائر|DZ': 'الجزائر',
    'الرباط|MA': 'الرباط',
    'تونس|TN': 'تونس',
    'الخرطوم|SD': 'الخرطوم',
    'صنعاء|YE': 'صنعاء',
    'إسطنبول|TR': 'إسطنبول'
  },

  // Calculation methods
  calc_methods: {
    '4': 'أم القرى — مكة',
    '5': 'الهيئة المصرية',
    '3': 'رابطة العالم الإسلامي',
    '2': 'ISNA — أمريكا الشمالية',
    '1': 'جامعة العلوم — كراتشي',
    '8': 'الديوان الكويتي',
    '9': 'قطر',
    '10': 'سنغافورة',
    '12': 'اتحاد علماء أوروبا',
    '13': 'ديانت — تركيا'
  },

  // Toast types
  success: 'نجاح',
  error: 'خطأ',
  loading: '⏳ جاري التحميل...',
  select_hint: '📿 اختر سورة من القائمة لعرض النص والاستماع',

  // Azan notification
  azan_notif_stop: '⏹️ إيقاف الأذان',

  // Continue widget
  continue_reading: '📖 متابعة القراءة',
  last_visit: 'آخر زيارة',

  // Search results
  search_play: '▶️ تشغيل',
  search_copy: '📋 نسخ',
  search_share: '📤 مشاركة',
  search_goto: '📍 الذهاب',

  // Translation
  translation: '🌐 الترجمة',
  translation_select: 'اختيار الترجمة',
  translation_on: 'الترجمة مفعّلة',
  translation_off: 'الترجمة مغلقة',

  // Welcome screen
  welcome_title: 'القرآن الكريم',
  welcome_subtitle: 'برمجة عائلة السليماني',
  welcome_feature_audio: '🎧 استمع لتلاوات 8 قرّاء',
  welcome_feature_search: '🔎 ابحث في القرآن كاملًا',
  welcome_feature_tafsir: '📜 تفسير 6 تفاسير معتمدة',
  welcome_feature_translation: '🌐 ترجمة المعاني (إنجليزية، فرنسية، أردو)',
  welcome_feature_mushaf: '📄 تصفّح المصحف كاملًا',
  welcome_feature_prayer: '🕌 مواقيت الصلاة والأذان',
  welcome_dismiss: '✌️ البدء',
};

export default ar;
