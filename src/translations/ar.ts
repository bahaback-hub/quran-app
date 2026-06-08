// Arabic translations
import type { TranslationBundle } from '../i18n';

const ar: TranslationBundle = {
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
  keyboard_hint:
    '💡 اختصارات: Space = تشغيل/إيقاف | ← → = آية سابقة/تالية | S = سورة سابقة | D = سورة تالية | H = حفظ | T = تفسير | R = تكرار | M = مصحف',

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
    'ar.shaatree': 'أبو بكر الشاطري',
  },

  // Tafsir names
  tafsir_names: {
    'ar-tafsir-muyassar': 'التفسير الميسّر',
    'ar-tafsir-al-tabari': 'تفسير الطبري',
    'ar-tafsir-ibn-kathir': 'تفسير ابن كثير',
    'ar-tafsir-as-saadi': 'تفسير السعدي',
    'ar-tafsir-al-baghawi': 'تفسير البغوي',
    'ar-tafsir-al-qurtubi': 'تفسير القرطبي',
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
    'إسطنبول|TR': 'إسطنبول',
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
    '13': 'ديانت — تركيا',
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

  // Adhkar
  adhkar: 'الأذكار',
  adhkar_personal: 'أذكاري',
  adhkar_add: 'إضافة ذكر جديد',
  adhkar_edit: 'تعديل',
  adhkar_delete: 'حذف',
  adhkar_saved: '✅ تم إضافة الذكر',
  adhkar_edited: '✏️ تم تعديل الذكر',
  adhkar_deleted: '🗑️ تم حذف الذكر',
  adhkar_reset: '🔄 تم إعادة تعيين الأذكار',
  adhkar_notification: '🕌 حان وقت الأذكار',
  adhkar_enable: 'تفعيل التذكير العام',
  adhkar_sound: '🔔 صوت التنبيه',
  adhkar_later: '⏰ لاحقاً',
  adhkar_open: '🕌 فتح الأذكار',
  adhkar_add_dialog: '📝 إضافة ذكر جديد',
  adhkar_text: 'نص الذكر',
  adhkar_count: 'عدد التكرار',
  adhkar_time: 'وقت التذكير (اختياري)',
  adhkar_duration: 'مدة الإشعار (دقائق)',
  adhkar_save: '💾 حفظ الذكر',
  adhkar_no_personal: '📝 لم تضف أي ذكر شخصي بعد',
  adhkar_confirm_delete: '🗑️ هل تريد حذف هذا الذكر؟',
  adhkar_enter_text: '📝 أدخل نص الذكر',
  adhkar_times: 'مرة',
  adhkar_remaining: 'متبقي',

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

  // Missing keys added for 10/10 quality
  // Sleep timer
  sleep_timer_title: '⏰ مؤقت النوم',
  sleep_timer_placeholder: 'عدد الدقائق',
  sleep_timer_hint: 'أدخل عدد الدقائق ثم اضغط تأكيد',
  sleep_timer_confirm: '✅ تأكيد',
  sleep_timer_cancel: '❌ إلغاء',
  sleep_timer_cancelled: 'تم إلغاء مؤقت النوم',
  sleep_timer_stopped: '⏰ تم إيقاف الصوت بعد {0} دقيقة',
  sleep_timer_set: '⏰ مؤقت النوم: {0} دقيقة',

  // Stats
  stats_ayahs_read: 'آية مقروءة',
  stats_reading_time: 'وقت القراءة',
  stats_surahs_read: 'سورة مقروءة',
  stats_streak_days: 'أيام متتالية',
  stats_sessions: 'جلسة قراءة',
  stats_last_read: 'آخر قراءة',
  stats_hours_mins: '{0} ساعة {1} دقيقة',
  stats_mins: '{0} دقيقة',

  // Mushaf
  previous_page: 'الصفحة السابقة',
  next_page: 'الصفحة التالية',
  mushaf_page_info: 'صفحة {0} من ٦٠٤',
  mushaf_juz: 'الجزء {0}',
  mushaf_page_error: 'تعذّر عرض الصفحة',
  mushaf_page_not_found: 'تعذّر العثور على الصفحة',
  mushaf_no_secret: 'لا يوجد سر مسجل لهذه السورة',
  mushaf_surah_info: 'ℹ️ معلومات عن السورة',
  surah_info_for: 'معلومات عن سورة {0}',
  mushaf_loading_page: '⏳ جاري تحميل الصفحة {0}...',

  // Search UI
  search_history_title: '🕐 آخر عمليات البحث',
  search_history_cleared: 'تم مسح سجل البحث',
  voice_search_unsupported: 'البحث الصوتي غير مدعوم في هذا المتصفح',
  voice_search_speaking: '🎤 تحدّث الآن...',
  voice_search_not_recognized: '🎤 لم يتم التعرف على الصوت، حاول مرة أخرى',
  load_more: '📥 تحميل المزيد ({0}+)',
  failed_ayah: 'فشل في الحصول على الآية',

  // Ayah modal
  ayah_modal_title: 'الآية {0} من سورة {1}',
  last_ayah_in_quran: 'هذه آخر آية في القرآن',
  next_ayah_label: '← الآية التالية: الآية {0} - {1}',
  page_loading: '📄 الصفحة: جاري...',
  juz_loading: '📖 الجزء: جاري...',
  page_info: '📄 الصفحة: {0}',
  juz_info: '📖 الجزء: {0}',
  bookmark_position_saved: '✅ تم حفظ موضع الوقوف',
  in_favorites: '⭐ في المفضلة',
  add_to_favorites: '⭐ إضافة للمفضلة',
  copy_text: '📋 نُسخ النص',
  copy_simple: '📋 نُسخ بدون تشكيل',
  copy_with_tafsir: '📋 نُسخ مع التفسير',
  copy_for_share: '📤 نُسخ للمشاركة',
  ayah_modal_play: '▶️ تشغيل',
  ayah_modal_pause: '⏸️ إيقاف',
  play_ayah_first: 'شغّل الآية أولاً',
  no_tafsir_available: '⚠️ لا يوجد تفسير متاح',

  // Prayer
  qibla_direction: 'اتجاه القبلة: {0} ({1}°)',
  qibla_location_failed: '⚠️ تعذّر تحديد الموقع',
  location_not_supported: '⚠️ الموقع غير مدعوم',
  prayer_countdown: '{0} — بعد {1}',
  prayer_dirs: 'شمال',
  prayer_dirs_ne: 'شمال شرق',
  prayer_dirs_e: 'شرق',
  prayer_dirs_se: 'جنوب شرق',
  prayer_dirs_s: 'جنوب',
  prayer_dirs_sw: 'جنوب غرب',
  prayer_dirs_w: 'غرب',
  prayer_dirs_nw: 'شمال غرب',

  // Favorites
  favorites_export_none: 'لا توجد آيات مفضلة للتصدير',
  favorites_exported_text: '📄 تم تصدير المفضلة كنص',
  favorites_exported_json: '💾 تم تصدير المفضلة JSON',

  // Select mode
  select_mode_none: 'لم تختر أي آيات',
  select_mode_copied: '📋 تم نسخ {0} آيات',

  // Error boundary
  error_title: 'حدث خطأ غير متوقع',
  error_description: 'واجه التطبيق مشكلة غير متوقعة. يمكنك إعادة التحميل أو العودة للصفحة الرئيسية.',
  error_reload: '🔄 إعادة تحميل',
  error_home: '🏠 الصفحة الرئيسية',
  error_copy_details: '📋 نسخ تفاصيل الخطأ',
  error_technical: 'تفاصيل تقنية',
  error_copied: '✅ تم النسخ',

  // API errors
  error_no_connection: '⚠️ لا يوجد اتصال بالإنترنت',
  error_timeout: '⏱️ انتهت مهلة الطلب',
  error_server_unreachable: '⚠️ تعذّر الاتصال بالخادم',
  error_server_error: '⚠️ خطأ في الخادم',
  error_invalid_data: '⚠️ بيانات غير صالحة',
  error_unexpected: '⚠️ حدث خطأ غير متوقع',

  // Onboarding
  onboarding_skip: 'تخطي',
  onboarding_prev: '→ السابق',
  onboarding_next: 'التالي ←',
  onboarding_start: '✔️ ابدأ التطبيق',

  // Share
  share_copied_simple: '📋 تم نسخ النص المبسط',

  // Surah loader
  loading_surah_list: '⏳ جاري تحميل قائمة السور...',
  offline_no_audio: '📖 وضع عدم الاتصال — الصوت غير متاح',
  surah_info_title: 'معلومات عن السورة',

  // Continue widget
  continue_ayah: ' — آية {0}',
  last_visit_time: 'آخر زيارة: {0}',

  // Mushaf sources
  mushaf_sources: '📚 المصادر:',
  no_audio_data: 'لا توجد بيانات صوت',
  invalid_surah_data: 'بيانات السورة غير صالحة',
  settings_imported: '✅ تم استيراد {0} إعدادات. جارٍ التحديث...',
  failed_load_backgrounds: 'فشل تحميل قائمة الخلفيات',
  notification_active: '✅ التنبيه مفعّل',
  notification_paused: '⏸ التنبيه متوقف',
  minutes: 'دقيقة',

  // Onboarding descriptions
  onboarding_desc_1: 'تلاوة، تفسير، بحث، ومواقيت الصلاة — كل ما تحتاجه في تطبيق واحد.',
  onboarding_desc_2: 'اختر قارئك المفضل من 8 قرّاء، وتحكم في سرعة التلاوة ومؤقت النوم.',
  onboarding_desc_3: 'ابحث في القرآن كاملًا بنتائج مرتبة حسب الأهمية مع إكمال تلقائي.',
  onboarding_desc_4: '6 تفاسير معتمدة وترجمة المعاني بلغات متعددة.',
  onboarding_desc_5: 'مواقيت دقيقة مع الأذان والتنبيهات.',
  onboarding_desc_6: 'الوضع الليلي، وضع السيبيا، تغيير الخط والمسافات، تصدير المفضلة.',
};

export default ar;
