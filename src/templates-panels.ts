/**
 * Large UI Panel Templates — Settings, Floating Player, Keyboard, Help.
 *
 * This module was extracted from templates.ts to reduce its size (was 53KB).
 * These are the four largest template functions, each generating a complete
 * UI panel/section that is injected at runtime via overlays.ts.
 *
 * Refactoring rationale:
 *   - templates.ts was 1262 lines / 53KB — too large for easy maintenance.
 *   - These four functions together are 518 lines (41% of the original).
 *   - Each is a self-contained HTML generator with no shared state.
 *
 * Security note: All user-provided or API-provided text MUST be escaped
 * via escapeHtml() from templates.ts before insertion into these templates.
 */

import { __ } from './i18n.js';

/* ===================== SETTINGS PANEL ===================== */

/**
 * Generate the complete settings panel HTML with all six tabs.
 *
 * Tabs: prayer, display, azan, adhkar, language, tools.
 *
 * All element IDs and class names are preserved exactly as they appear
 * in the original index.html to maintain compatibility with dom.ts caching.
 *
 * @returns HTML string for the complete settings panel aside element
 */
export function settingsPanelHTML(): string {
  return `<aside class="settings-panel" id="settingsPanel" aria-label="لوحة الإعدادات">
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
          <div class="prayer-times-list" id="prayerTimesRows">
            <p class="centered-muted">⏳ جاري تحميل المواقيت...</p>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">📍 <span data-i18n="location_calculation">الموقع وطريقة الحساب</span></div>
          <div class="settings-row">
            <label for="cityInput" data-i18n="city">المدينة:</label>
            <input type="text" id="cityInput" placeholder="مكة" />
          </div>
          <div class="settings-row">
            <label for="countryInput" data-i18n="country">الدولة:</label>
            <input type="text" id="countryInput" placeholder="SA" />
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
              <option value="waves">أمواج البحر 🌊</option>
              <option value="aurora">شفق قطبي 🌌</option>
              <option value="particles">جسيمات ذهبية ✦</option>
              <option value="rain">مطر 🌧️</option>
            </select>
          </div>
          <div class="settings-row hidden" id="presBgVideoRow">
            <label for="presBgVideoSelect">اختر الفيديو المحلي:</label>
            <select id="presBgVideoSelect" aria-label="اختر فيديو خلفية وضع العرض">
              <option value="eva">منزل إيفا والماء</option>
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
        </div>
      </div>
    </aside>`;
}

/* ===================== FLOATING PLAYER ===================== */

/**
 * Generate the floating audio player HTML with controls, repeat, share, and more.
 *
 * The player includes collapsed/expanded views, audio controls, playback
 * speed, hifdh/repeat/select modes, bookmark, favorite, share menu, sleep
 * timer, and download button.
 *
 * @returns HTML string for the floating player div element
 */
export function floatingPlayerHTML(): string {
  return `<div class="player collapsed" id="player" role="region" aria-label="مشغل التلاوة">
      <div class="collapsed-content" id="collapsedContent">
        <button class="floating-play-btn" id="collapsedPlayBtn" aria-label="تشغيل/إيقاف">
          <svg class="icon icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
        <div class="floating-info" id="collapsedInfo">—</div>
      </div>

      <div class="expanded-content">
        <div class="expanded-header">
          <span id="playerReciterName">—</span>
          <span id="playerSurahName">—</span>
          <button class="collapse-btn" id="collapsePlayerBtn" aria-label="إغلاق المشغل">✖</button>
        </div>
        <div class="current-ayah" id="playerCurrentAyah">—</div>
        <span id="sleepTimerDisplay" style="display:none;font-size:11px;color:var(--accent);margin:0 8px;"></span>
        <canvas class="audio-visualizer" id="audioVisualizer" width="300" height="40" aria-hidden="true"></canvas>
        <div class="player-row">
          <audio id="audioPlayer" controls preload="metadata"></audio>
        </div>
        <div class="player-buttons">
          <button class="btn" id="prevSurahBtn" aria-label="السورة السابقة" title="السورة السابقة">⏮</button>
          <button class="btn" id="prevAyahBtn" aria-label="الآية السابقة" title="الآية السابقة">◀</button>
          <button class="btn btn-gold" id="playPauseBtn" aria-label="تشغيل/إيقاف">⏯</button>
          <button class="btn" id="nextAyahBtn" aria-label="الآية التالية" title="الآية التالية">▶</button>
          <button class="btn" id="nextSurahBtn" aria-label="السورة التالية" title="السورة التالية">⏭</button>
          <button class="btn btn-more" id="playerMoreBtn" aria-label="المزيد" title="المزيد">⁝</button>
        </div>
        <div class="player-more-row hidden" id="playerMoreRow">
          <button class="btn btn-hifdh" id="hifdhBtn" aria-label="وضع الحفظ">🕋 حفظ</button>
          <button class="btn btn-repeat" id="repeatBtn" aria-label="التكرار">🔁 تكرار</button>
          <button class="btn btn-autoplay" id="autoPlayNextBtn" data-i18n="autoplay_next" aria-label="التشغيل المتصل" title="التشغيل المتصل — ينتقل تلقائياً للسورة التالية">🔗 متصل</button>
          <button class="btn btn-select" id="selectModeBtn" aria-label="تحديد متعدد">☑️ تحديد</button>
          <button
            class="btn btn-bookmark"
            id="bookmarkBtn"
            aria-label="إشارة مرجعية"
            title="نقرة: حفظ — نقرتان: انتقال"
          >
            🔖 علامة
          </button>
          <button class="btn btn-favorite" id="favoriteBtn" aria-label="إضافة للمفضلة">❤️ مفضلة</button>
          <button class="btn btn-gold" id="shareBtn" aria-label="مشاركة الآية">📤 مشاركة</button>
          <span class="speed-control speed-control-span">
            <span>⏩</span>
            <select id="speedSelect" aria-label="سرعة التلاوة" class="speed-select">
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1" selected>1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </span>
          <button class="btn btn-sleep" id="sleepTimerBtn" aria-label="مؤقت النوم" title="مؤقت النوم">😴 نوم</button>
          <button class="btn btn-download" id="downloadAudioBtn" data-i18n="download_audio" aria-label="تحميل السورة للعمل بدون إنترنت" title="تحميل السورة للعمل بدون إنترنت">📥 تحميل</button>
        </div>
        <div class="select-mode-bar hidden" id="selectModeBar">
          <span id="selectCount">0</span> آية محددة
          <button class="btn btn-gold" id="selectShareBtn">📤 مشاركة المحدد</button>
          <button class="btn" id="selectClearBtn">✖ إلغاء</button>
        </div>
        <div class="repeat-controls hidden" id="repeatControls">
          <label
            >من:
            <select id="repeatFrom"></select
          ></label>
          <label
            >إلى:
            <select id="repeatTo"></select
          ></label>
          <label
            >عدد المرات:
            <select id="repeatTimes">
              <option value="2">2</option>
              <option value="3" selected>3</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </label>
        </div>
        <div class="share-menu" id="shareMenu" role="menu">
          <button data-share="native">📲 مشاركة عامة</button>
          <button data-share="copy">📋 نسخ النص</button>
          <button data-share="copy-simple">📋 نسخ مبسط (بدون تشكيل)</button>
          <button data-share="whatsapp">💬 واتساب</button>
          <button data-share="telegram">✈️ تيليجرام</button>
        </div>
      </div>
    </div>`;
}

/* ===================== ARABIC KEYBOARD ===================== */

/**
 * Generate the Arabic on-screen keyboard HTML for search input.
 *
 * Includes four rows: number row, letter rows, and a modifier row
 * with shift, space, backspace, and clear keys.
 *
 * @returns HTML string for the Arabic keyboard div element
 */
export function arabicKeyboardHTML(): string {
  // Layout matches the standard Arabic keyboard:
  // Row 1: digits (top row, like physical keyboard)
  // Row 2: ض ص ث ق ف غ ع ه خ ح ج د
  // Row 3: ش س ي ب ل ا ت ن م ك ط
  // Row 4: ذ ء ؤ ر ى ة و ز ظ
  // Row 5: Shift, Space, Backspace, Clear
  return `<div class="arabic-keyboard" id="arabicKeyboard" dir="ltr">
                <div class="kbd-row">
                  <button class="kbd-key" data-key="١">١</button>
                  <button class="kbd-key" data-key="٢">٢</button>
                  <button class="kbd-key" data-key="٣">٣</button>
                  <button class="kbd-key" data-key="٤">٤</button>
                  <button class="kbd-key" data-key="٥">٥</button>
                  <button class="kbd-key" data-key="٦">٦</button>
                  <button class="kbd-key" data-key="٧">٧</button>
                  <button class="kbd-key" data-key="٨">٨</button>
                  <button class="kbd-key" data-key="٩">٩</button>
                  <button class="kbd-key" data-key="٠">٠</button>
                </div>
                <div class="kbd-row">
                  <button class="kbd-key" data-key="ض">ض</button>
                  <button class="kbd-key" data-key="ص">ص</button>
                  <button class="kbd-key" data-key="ث">ث</button>
                  <button class="kbd-key" data-key="ق">ق</button>
                  <button class="kbd-key" data-key="ف">ف</button>
                  <button class="kbd-key" data-key="غ">غ</button>
                  <button class="kbd-key" data-key="ع">ع</button>
                  <button class="kbd-key" data-key="ه">ه</button>
                  <button class="kbd-key" data-key="خ">خ</button>
                  <button class="kbd-key" data-key="ح">ح</button>
                  <button class="kbd-key" data-key="ج">ج</button>
                  <button class="kbd-key" data-key="د">د</button>
                </div>
                <div class="kbd-row">
                  <button class="kbd-key" data-key="ش">ش</button>
                  <button class="kbd-key" data-key="س">س</button>
                  <button class="kbd-key" data-key="ي">ي</button>
                  <button class="kbd-key" data-key="ب">ب</button>
                  <button class="kbd-key" data-key="ل">ل</button>
                  <button class="kbd-key" data-key="ا">ا</button>
                  <button class="kbd-key" data-key="ت">ت</button>
                  <button class="kbd-key" data-key="ن">ن</button>
                  <button class="kbd-key" data-key="م">م</button>
                  <button class="kbd-key" data-key="ك">ك</button>
                  <button class="kbd-key" data-key="ط">ط</button>
                </div>
                <div class="kbd-row">
                  <button class="kbd-key" data-key="ذ">ذ</button>
                  <button class="kbd-key" data-key="ء">ء</button>
                  <button class="kbd-key" data-key="ؤ">ؤ</button>
                  <button class="kbd-key" data-key="ر">ر</button>
                  <button class="kbd-key" data-key="ى">ى</button>
                  <button class="kbd-key" data-key="ة">ة</button>
                  <button class="kbd-key" data-key="و">و</button>
                  <button class="kbd-key" data-key="ز">ز</button>
                  <button class="kbd-key" data-key="ظ">ظ</button>
                </div>
                <div class="kbd-row">
                  <button class="kbd-key kbd-key-shift" data-key="shift">⇧</button>
                  <button class="kbd-key kbd-key-space" data-key="space">⎵</button>
                  <button class="kbd-key kbd-key-backspace" data-key="backspace">⌫</button>
                  <button class="kbd-key kbd-key-clear" data-key="clear">مسح</button>
                </div>
              </div>`;
}

/* ===================== HELP PANEL ===================== */

/**
 * Generate the help/guide panel HTML with accordion sections.
 * Each section explains a feature, where to find it, and how to use it.
 * Uses data-i18n attributes for translation support.
 *
 * @returns HTML string for the complete help panel aside element
 */
export function helpPanelHTML(): string {
  return `<aside class="help-panel" id="helpPanel" aria-label="${__('help_guide')}">
      <div class="help-header">
        <h2 data-i18n="help_guide">❓ ${__('help_guide')}</h2>
        <button class="help-close" id="helpCloseBtn" aria-label="${__('close')}">✖</button>
      </div>
      <div class="help-body">
        <p class="help-intro">${__('help_intro')}</p>

        <div class="help-section">
          <button class="help-section-toggle" data-section="playback">
            <span>🎵 ${__('help_playback')}</span>
            <span class="help-toggle-icon">▼</span>
          </button>
          <div class="help-section-content" data-section="playback">
            <div class="help-item">
              <div class="help-item-title">⏯ ${__('help_play_pause')}</div>
              <div class="help-item-desc">${__('help_play_pause_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">◀ ▶ ⏮ ⏭ ${__('help_navigation')}</div>
              <div class="help-item-desc">${__('help_navigation_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">🔗 ${__('help_continuous')}</div>
              <div class="help-item-desc">${__('help_continuous_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">🔁 ${__('help_repeat')}</div>
              <div class="help-item-desc">${__('help_repeat_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">🕋 ${__('help_hifdh')}</div>
              <div class="help-item-desc">${__('help_hifdh_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">﴿١﴾ ${__('help_ayah_number')}</div>
              <div class="help-item-desc">${__('help_ayah_number_desc')}</div>
            </div>
          </div>
        </div>

        <div class="help-section">
          <button class="help-section-toggle" data-section="hifz-room">
            <span>۞ ${__('help_hifz_room')}</span>
            <span class="help-toggle-icon">▼</span>
          </button>
          <div class="help-section-content" data-section="hifz-room">
            <div class="help-item">
              <div class="help-item-title">${__('help_hifz_room_open')}</div>
              <div class="help-item-desc">${__('help_hifz_room_open_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">${__('help_hifz_room_prepare')}</div>
              <div class="help-item-desc">${__('help_hifz_room_prepare_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">${__('help_hifz_room_session')}</div>
              <div class="help-item-desc">${__('help_hifz_room_session_desc')}</div>
            </div>
          </div>
        </div>

        <div class="help-section">
          <button class="help-section-toggle" data-section="contemplation">
            <span>✦ ${__('help_contemplation')}</span>
            <span class="help-toggle-icon">▼</span>
          </button>
          <div class="help-section-content" data-section="contemplation">
            <div class="help-item">
              <div class="help-item-title">${__('help_contemplation_open')}</div>
              <div class="help-item-desc">${__('help_contemplation_open_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">${__('help_contemplation_privacy')}</div>
              <div class="help-item-desc">${__('help_contemplation_privacy_desc')}</div>
            </div>
          </div>
        </div>

        <div class="help-section">
          <button class="help-section-toggle" data-section="offline">
            <span>📥 ${__('help_offline')}</span>
            <span class="help-toggle-icon">▼</span>
          </button>
          <div class="help-section-content" data-section="offline">
            <div class="help-item">
              <div class="help-item-title">📥 ${__('help_download_audio')}</div>
              <div class="help-item-desc">${__('help_download_audio_desc')}</div>
            </div>
          </div>
        </div>

        <div class="help-section">
          <button class="help-section-toggle" data-section="bookmarks">
            <span>🔖 ${__('help_bookmarks_favorites')}</span>
            <span class="help-toggle-icon">▼</span>
          </button>
          <div class="help-section-content" data-section="bookmarks">
            <div class="help-item">
              <div class="help-item-title">🔖 ${__('help_bookmark')}</div>
              <div class="help-item-desc">${__('help_bookmark_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">❤️ ${__('help_favorite')}</div>
              <div class="help-item-desc">${__('help_favorite_desc')}</div>
            </div>
          </div>
        </div>

        <div class="help-section">
          <button class="help-section-toggle" data-section="search">
            <span>🔍 ${__('help_search')}</span>
            <span class="help-toggle-icon">▼</span>
          </button>
          <div class="help-section-content" data-section="search">
            <div class="help-item">
              <div class="help-item-title">🔎 ${__('help_text_search')}</div>
              <div class="help-item-desc">${__('help_text_search_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">🎤 ${__('help_voice_search')}</div>
              <div class="help-item-desc">${__('help_voice_search_desc')}</div>
            </div>
          </div>
        </div>

        <div class="help-section">
          <button class="help-section-toggle" data-section="extras">
            <span>🕌 ${__('help_extras')}</span>
            <span class="help-toggle-icon">▼</span>
          </button>
          <div class="help-section-content" data-section="extras">
            <div class="help-item">
              <div class="help-item-title">😴 ${__('help_sleep_timer')}</div>
              <div class="help-item-desc">${__('help_sleep_timer_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">📖 ${__('help_mushaf_mode')}</div>
              <div class="help-item-desc">${__('help_mushaf_mode_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">🧭 ${__('help_qibla')}</div>
              <div class="help-item-desc">${__('help_qibla_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">🤲 ${__('help_adhkar')}</div>
              <div class="help-item-desc">${__('help_adhkar_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">📖 ${__('help_tafsir')}</div>
              <div class="help-item-desc">${__('help_tafsir_desc')}</div>
            </div>
            <div class="help-item">
              <div class="help-item-title">📤 ${__('help_share')}</div>
              <div class="help-item-desc">${__('help_share_desc')}</div>
            </div>
          </div>
        </div>

        <div class="help-section">
          <button class="help-section-toggle" data-section="keyboard">
            <span>⌨️ ${__('help_keyboard')}</span>
            <span class="help-toggle-icon">▼</span>
          </button>
          <div class="help-section-content" data-section="keyboard">
            <div class="help-item">
              <div class="help-item-title">${__('help_keyboard_shortcuts')}</div>
              <div class="help-item-desc">${__('help_keyboard_shortcuts_desc')}</div>
            </div>
          </div>
        </div>

      </div>
    </aside>`;
}
