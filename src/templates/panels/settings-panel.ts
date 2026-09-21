import { __ } from '../../i18n.js';

/**
 * Generate the complete settings panel HTML with all six tabs.
 */
export function settingsPanelHTML(): string {
  return `<aside class="settings-panel" id="settingsPanel" role="dialog" aria-modal="true" aria-label="لوحة الإعدادات">
      <div class="settings-header">
        <h2 data-i18n="settings">⚙️ الإعدادات</h2>
        <button class="settings-close" id="settingsCloseBtn" aria-label="إغلاق الإعدادات">✖</button>
      </div>

      <div class="big-clock">
        <div class="big-clock-time" id="bigClockTime2">--:--:--</div>
        <div id="bigClockDate">---</div>
        <div id="bigClockHijri">---</div>
      </div>

      <div class="settings-tabs" id="settingsTabs">
        <button class="settings-tab active" data-tab="prayer">🕌 <span data-i18n="prayer_times">المواقيت</span></button>
        <button class="settings-tab" data-tab="display">🎨 <span data-i18n="display">العرض</span></button>
        <button class="settings-tab" data-tab="azan">🔔 <span data-i18n="azan">الأذان</span></button>
        <button class="settings-tab" data-tab="adhkar">🕌 <span data-i18n="adhkar">الأذكار</span></button>
        <button class="settings-tab" data-tab="language">🌐 <span data-i18n="language">اللغة</span></button>
        <button class="settings-tab" data-tab="tools">⚙️ <span data-i18n="tools">أدوات</span></button>
      </div>

      <div class="settings-tab-content active" data-tab="prayer">
        <div class="settings-section">
          <div class="prayer-times-list" id="settingsPrayerTimesRows" aria-live="polite">
            <p class="centered-muted" data-i18n="prayer_times_loading">⏳ جاري تحميل المواقيت...</p>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">📍 <span data-i18n="location_calculation">الموقع وطريقة الحساب</span></div>
          <div class="settings-row">
            <label for="cityInput" data-i18n="city">المدينة:</label>
            <input type="text" id="cityInput" placeholder="مكة" data-i18n-placeholder="city_placeholder" />
          </div>
          <div class="settings-row">
            <button class="btn" id="useLocationBtn" data-i18n="use_my_location">📍 استخدم موقعي</button>
            <label class="settings-checkbox-label">
              <input type="checkbox" id="autoLocationToggle" />
              <span data-i18n="auto_location">تلقائي</span>
            </label>
          </div>
          <div class="settings-row">
            <label for="countryInput" data-i18n="country">الدولة:</label>
            <input type="text" id="countryInput" placeholder="SA" data-i18n-placeholder="country_placeholder" />
          </div>
          <div class="settings-row">
            <label for="cityQuickSelect" data-i18n="quick_select">اختيار سريع:</label>
            <select id="cityQuickSelect">
              <option value="" data-i18n="select_option">— اختر —</option>
              <option value="مكة|SA">مكة المكرمة</option>
              <option value="المدينة|SA">المدينة المنورة</option>
              <option value="الرياض|SA">الرياض</option>
              <option value="القاهرة|EG">القاهرة</option>
              <option value="دمشق|SY">دمشق</option>
              <option value="عمان|JO">عمّان</option>
              <option value="بغداد|IQ">بغداد</option>
              <option value="الدوحة|QA">الدوحة</option>
              <option value="الكويت|KW">الكويت</option>
              <option value="دبي|AE">دبي</option>
              <option value="بيروت|LB">بيروت</option>
              <option value="الجزائر|DZ">الجزائر</option>
              <option value="الرباط|MA">الرباط</option>
              <option value="تونس|TN">تونس</option>
              <option value="الخرطوم|SD">الخرطوم</option>
              <option value="صنعاء|YE">صنعاء</option>
              <option value="إسطنبول|TR">إسطنبول</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="methodSelect" data-i18n="calculation_method">طريقة الحساب:</label>
            <select id="methodSelect">
              <option value="4">أم القرى — مكة</option>
              <option value="5">الهيئة المصرية</option>
              <option value="3">رابطة العالم الإسلامي</option>
              <option value="2">ISNA — أمريكا الشمالية</option>
              <option value="1">جامعة العلوم — كراتشي</option>
              <option value="8">الديوان الكويتي</option>
              <option value="9">قطر</option>
              <option value="10">سنغافورة</option>
              <option value="12">اتحاد علماء أوروبا</option>
              <option value="13">ديانت — تركيا</option>
            </select>
          </div>
          <div class="settings-row">
            <button class="btn btn-gold" id="saveLocationBtn" data-i18n="save_location">
              💾 حفظ الموقع وتحديث المواقيت
            </button>
          </div>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="display">
        <div class="settings-section">
          <div class="settings-section-title">🎨 <span data-i18n="display">العرض</span></div>
          <div class="settings-row">
            <label for="fontSizeSelect" data-i18n="font_size">حجم الخط:</label>
            <select id="fontSizeSelect">
              <option value="20">20</option>
              <option value="24">24</option>
              <option value="28" selected>28</option>
              <option value="32">32</option>
              <option value="36">36</option>
              <option value="40">40</option>
              <option value="44">44</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="fontTypeSelect" data-i18n="font_type">نوع الخط:</label>
            <select id="fontTypeSelect">
              <option value="'Amiri','Traditional Arabic',serif" selected>أميري</option>
              <option value="'Scheherazade New','Traditional Arabic',serif">شهرزاد</option>
              <option value="'Traditional Arabic',serif">عربي تقليدي</option>
              <option value="'KFGQPC HAFS Uthmanic Script','Traditional Arabic',serif" data-i18n="font_uthmanic_hafs">حفص عثماني رسمي</option>
              <option value="'Al Qalam','Traditional Arabic',serif">القلم</option>
            </select>
          </div>
          <div class="settings-row">
            <label for="lineSpacingSelect" data-i18n="line_spacing">تباعد الأسطر:</label>
            <select id="lineSpacingSelect">
              <option value="1.4" data-i18n="compact">ضيق</option>
              <option value="1.8" selected data-i18n="normal">عادي</option>
              <option value="2.2" data-i18n="spacious">واسع</option>
              <option value="2.6" data-i18n="extra_spacious">واسع جداً</option>
            </select>
          </div>
          <div class="settings-row">
            <label data-i18n="tajweed_colors">ألوان التجويد</label>
            <div class="toggle-switch on" id="tajweedToggle" role="switch" aria-label="ألوان التجويد"></div>
          </div>
          <div class="settings-row">
            <label for="presBgSelect" data-i18n="pres_bg_label">خلفية وضع العرض:</label>
            <select id="presBgSelect" aria-label="خلفية وضع العرض">
              <option value="plain" data-i18n="pres_bg_plain">صامتة</option>
              <option value="nature" data-i18n="pres_bg_nature">مناظر طبيعية</option>
              <option value="singleNature" data-i18n="pres_bg_single_nature">منظر طبيعي واحد</option>
              <option value="animated" data-i18n="pres_bg_animated">مناظر متحركة</option>
              <option value="scene" data-i18n="pres_bg_scene">منظر واحد متحرك</option>
              <option value="video" data-i18n="pres_bg_video">فيديو محلي متحرك</option>
              <option value="auto" data-i18n="pres_bg_auto">تلقائي (حسب الوقت)</option>
            </select>
          </div>
          <div class="settings-row hidden" id="presBgNatureRow">
            <label for="presBgNatureSelect">اختر المنظر الطبيعي:</label>
            <select id="presBgNatureSelect" aria-label="اختر المنظر الطبيعي">
              <option value="dawn">🌅 فجر</option>
              <option value="morning">☁️ صباح</option>
              <option value="afternoon">⛰️ ظهر</option>
              <option value="sunset">🌇 غروب</option>
              <option value="night">🌙 ليل</option>
            </select>
          </div>
          <div class="settings-row hidden" id="presBgSceneRow">
            <label for="presBgSceneSelect">اختر المنظر:</label>
            <select id="presBgSceneSelect" aria-label="اختر المنظر المتحرك">
              <option value="stars">سماء نجوم ✨</option>
              <option value="particles">جسيمات ذهبية ✦</option>
            </select>
          </div>
          <div class="settings-row hidden" id="presBgVideoRow">
            <label for="presBgVideoSelect">اختر الفيديو المحلي:</label>
            <select id="presBgVideoSelect" aria-label="اختر فيديو خلفية وضع العرض">
              <option value="eva">منزل على البحر</option>
              <option value="alps">جبال الألب والضباب</option>
              <option value="sunset">غروب البحر</option>
              <option value="wave">الموج المتكسر</option>
            </select>
          </div>
          <div class="settings-row">
            <label data-i18n="auto_save_position">حفظ آخر موضع تلقائياً</label>
            <div class="toggle-switch on" id="autoSaveToggle" role="switch" aria-label="حفظ آخر موضع"></div>
          </div>
          <div class="settings-row">
            <label for="translationSelect" data-i18n="translation">الترجمة:</label>
            <select id="translationSelect" aria-label="اختيار الترجمة">
              <option value="" data-i18n="no_translation">— بدون ترجمة —</option>
              <option value="en.sahih">Sahih International</option>
              <option value="en.pickthall">Pickthall</option>
              <option value="en.yusufali">Yusuf Ali</option>
              <option value="fr.hamidullah">Hamidullah (Français)</option>
              <option value="ur.jalandhry">Jalandhry (اردو)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="azan">
        <div class="settings-section">
          <div class="settings-section-title" data-i18n="azan">🔔 الأذان</div>
          <div class="settings-row">
            <label data-i18n="azan_enable">تنبيه الأذان:</label>
            <div class="toggle-switch" id="azanToggle" role="switch" aria-label="تفعيل الأذان"></div>
          </div>
          <div class="settings-row">
            <label data-i18n="azan_fajr">أذان الفجر:</label>
            <div class="toggle-switch" id="azanFajrToggle" role="switch" aria-label="تفعيل أذان الفجر"></div>
          </div>
          <div class="settings-row">
            <button class="btn" id="testAzanBtn" data-i18n="test_azan">▶️ اختبار الأذان</button>
          </div>
          <p class="azan-note">🎙️ الأذان بصوت الشيخ ناصر القطامي</p>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="adhkar">
        <div class="settings-section">
          <div class="settings-section-title">🕌 <span data-i18n="adhkar">الأذكار</span></div>
          <div class="settings-row">
            <label data-i18n="adhkar_reminder">تفعيل التذكير العام</label>
            <div class="toggle-switch" id="adhkarEnabledToggle" role="switch" aria-label="تفعيل التذكير"></div>
          </div>
          <div class="settings-row">
            <label>🔔 <span data-i18n="notification_sound">صوت التنبيه</span></label>
            <div class="toggle-switch" id="adhkarSoundToggle" role="switch" aria-label="صوت التنبيه"></div>
          </div>
          <div id="adhkarSettingsList"></div>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="language">
        <div class="settings-section">
          <div class="settings-section-title">🌐 Language / اللغة</div>
          <div class="settings-row">
            <label for="langSelect">اللغة / Language:</label>
            <select id="langSelect">
              <option value="ar">العربية</option>
              <option value="en">English</option>
              <option value="tr">Türkçe</option>
              <option value="ms">Bahasa Melayu</option>
              <option value="id">Bahasa Indonesia</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="ru">Русский</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-tab-content" data-tab="tools">
        <div class="settings-section">
          <div class="settings-section-title">⚙️ <span data-i18n="tools">أدوات</span></div>
          <div class="settings-row">
            <button class="btn btn-gold" id="exportSettingsBtn">📤 <span data-i18n="export_settings">تصدير الإعدادات</span></button>
          </div>
          <div class="settings-row">
            <button class="btn" id="importSettingsBtn">📥 <span data-i18n="import_settings">استيراد الإعدادات</span></button>
          </div>
          <div class="settings-row">
            <button class="btn" id="helpFromSettingsBtn" data-i18n-aria-label="help_guide" aria-label="دليل الاستخدام">
              📖 <span data-i18n="help_guide">دليل الاستخدام</span>
            </button>
          </div>
          <div class="settings-section mushaf-data-pack" id="mushafDataPackSection">
            <div class="settings-section-title">📚 <span data-i18n="mushaf_data_pack">المصحف دون اتصال</span></div>
            <p class="settings-note" id="mushafDataPackStatus" aria-live="polite" data-i18n="mushaf_data_pack_not_installed">نزّل المصحف ليعمل كاملًا دون إنترنت.</p>
            <div class="settings-row">
              <button class="btn btn-gold" id="downloadMushafDataPackBtn">⬇️ <span data-i18n="mushaf_data_pack_download">تنزيل المصحف للعمل دون إنترنت</span></button>
            </div>
            <div class="settings-row mushaf-data-pack-actions">
              <button class="btn" id="verifyMushafDataPackBtn">🛡️ <span data-i18n="mushaf_data_pack_verify">فحص التنزيل</span></button>
              <button class="btn btn-danger" id="deleteMushafDataPackBtn">🗑️ <span data-i18n="mushaf_data_pack_delete">حذف التنزيل</span></button>
            </div>
          </div>
          <div class="settings-row">
            <button class="btn btn-danger" id="resetSettingsBtn" data-i18n="reset_settings">
              🔄 إعادة ضبط الإعدادات
            </button>
          </div>
          <div class="settings-section" id="appUpdateSection">
            <div class="settings-section-title">🆕 <span data-i18n="app_updates">تحديثات التطبيق</span></div>
            <div class="settings-row">
              <label data-i18n="tv_mode">وضع التلفاز (تحكم بالريموت)</label>
              <div class="toggle-switch" id="tvModeToggle" role="switch" aria-label="وضع التلفاز"></div>
            </div>
            <div class="settings-row">
              <label data-i18n="pointer_mode">وضع المؤشر (ريموت بلا فأرة)</label>
              <div class="toggle-switch" id="pointerModeToggle" role="switch" aria-label="وضع المؤشر"></div>
            </div>
            <div class="settings-row">
              <span><span data-i18n="app_version">إصدار التطبيق:</span> <strong id="appVersionLabel">…</strong></span>
            </div>
            <div class="settings-row">
              <button class="btn btn-gold" id="checkUpdatesBtn">🔄 <span data-i18n="check_updates">التحقق من التحديث</span></button>
            </div>
            <p class="settings-note" id="updateCheckStatus" aria-live="polite"></p>
          </div>
        </div>
      </div>
    </aside>`;
}
