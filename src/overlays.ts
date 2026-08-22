/**
 * Lazy Overlay Templates for Quran App.
 *
 * This module extracts large overlay/panel HTML sections from index.html
 * into JavaScript template literals, which are injected into the DOM
 * during initialization (before cacheDom runs). This approach:
 *
 *   1. Reduces the initial HTML payload — index.html is ~375 lines smaller
 *   2. Keeps overlay HTML co-located with the modules that use them
 *   3. Makes overlays easier to find, modify, and test
 *   4. Maintains full backward compatibility — all DOM IDs are preserved
 *
 * IMPORTANT: injectOverlays() MUST be called before cacheDom() in the
 * app initialization sequence, otherwise dom.ts won't find these elements.
 */

import { settingsPanelHTML, floatingPlayerHTML, arabicKeyboardHTML, helpPanelHTML } from './templates.js';

/* ===================== ADHKAR NOTIFICATION ===================== */

const adhkarNotificationHTML = `
<div class="adhkar-notification hidden" id="adhkarNotification" role="alert" aria-live="assertive">
  <div class="adhkar-notification-inner">
    <div class="adhkar-notification-icon" id="adhkarNotifIcon">🌅</div>
    <div class="adhkar-notification-title" id="adhkarNotifTitle">🕌 حان وقت الأذكار</div>
    <div class="adhkar-notification-text adhkar-notif-text" id="adhkarNotifText"></div>
    <div class="adhkar-notification-progress adhkar-notif-progress" id="adhkarNotifProgress"></div>
    <div class="adhkar-notification-actions">
      <button class="btn btn-gold" id="adhkarNotifOpenBtn">🕌 فتح الأذكار</button>
      <button class="btn btn-sm adhkar-notif-share-btn" id="adhkarNotifShareBtn">📋 نسخ</button>
      <button class="btn" id="adhkarNotifDismissBtn">⏰ لاحقاً</button>
    </div>
  </div>
</div>
`;

/* ===================== ADHKAR ADD OVERLAY ===================== */

const adhkarAddOverlayHTML = `
<div class="adhkar-add-overlay hidden" id="adhkarAddOverlay" aria-label="إضافة ذكر جديد" aria-modal="true">
  <div class="adhkar-add-inner">
    <div class="adhkar-add-header">
      <h3>📝 إضافة ذكر جديد</h3>
      <button class="btn" id="adhkarAddCloseBtn">✖</button>
    </div>
    <div class="adhkar-add-body">
      <div class="settings-row">
        <label for="adhkarAddText">نص الذكر:</label>
        <textarea id="adhkarAddText" rows="3" placeholder="اكتب الذكر هنا..."></textarea>
      </div>
      <div class="settings-row">
        <label for="adhkarAddCount">عدد التكرار:</label>
        <input type="number" id="adhkarAddCount" value="1" min="1" max="999" />
      </div>
      <div class="settings-row">
        <label for="adhkarAddTime">وقت التذكير (اختياري):</label>
        <input type="time" id="adhkarAddTime" />
      </div>
      <div class="settings-row">
        <label for="adhkarAddDuration">مدة الإشعار (دقائق):</label>
        <input type="number" id="adhkarAddDuration" value="1" min="1" max="60" />
      </div>
      <button class="btn btn-gold" id="adhkarAddSaveBtn">💾 حفظ الذكر</button>
    </div>
  </div>
</div>
`;

/* ===================== PRESENTATION OVERLAY ===================== */

const presentationOverlayHTML = `
<div class="presentation-overlay hidden" id="presentationOverlay" role="dialog" aria-label="وضع العرض" aria-modal="true">
  <div class="presentation-inner">
    <div class="presentation-header">
      <button class="presentation-header-btn" id="presentationPrevBtn" aria-label="الآية السابقة">⏮</button>
      <span class="presentation-title" id="presentationTitle">—</span>
      <span class="presentation-ayah-num" id="presentationAyahNum">—</span>
      <button class="presentation-header-btn pres-control-btn" id="presPlayPauseBtn" aria-label="تشغيل / إيقاف">▶</button>
      <button class="presentation-header-btn pres-control-btn pres-tajweed-btn" id="presTajweedBtn" aria-label="ألوان التجويد" title="تشغيل/إيقاف ألوان التجويد">🎨</button>
      <button class="presentation-header-btn pres-control-btn" id="presFullscreenBtn" aria-label="ملء الشاشة">⛶</button>
      <button class="presentation-header-btn" id="presentationNextBtn" aria-label="الآية التالية">⏭</button>
      <button class="presentation-close-btn" id="presentationCloseBtn" aria-label="خروج">✖</button>
    </div>
    <div class="presentation-body" id="presentationBody">
      <div class="presentation-ayah-text" id="presentationAyahText"></div>
      <div class="presentation-translation hidden" id="presentationTranslation"></div>
    </div>
    <div class="presentation-footer">
      <span class="presentation-counter" id="presentationCounter">٠ / ٠</span>
    </div>
  </div>
</div>
`;

/* ===================== AZAN PLAYER & NOTIFICATION ===================== */

const azanHTML = `
<audio id="azanPlayer" preload="none"></audio>
<div class="azan-notification hidden" id="azanNotification" role="alert" aria-live="assertive">
  <div class="azan-notification-inner">
    <div class="azan-notification-icon">🕌</div>
    <div class="azan-notification-title">حان الآن وقت الصلاة</div>
    <div class="azan-notification-prayer" id="azanNotifPrayer">---</div>
    <div class="azan-notification-actions">
      <button class="btn btn-gold" id="azanNotifStopBtn">⏹️ إيقاف الأذان</button>
    </div>
  </div>
</div>
`;

/* ===================== SURAH SECRETS OVERLAY ===================== */

const surahSecretsOverlayHTML = `
<div class="surah-secrets-overlay hidden" id="surahSecretsOverlay" role="dialog" aria-label="سرّ السورة" aria-modal="true">
  <div class="surah-secrets-overlay-inner">
    <div class="surah-secrets-overlay-header">
      <h3 id="surahSecretsTitle">🌟 سرّ السورة</h3>
      <button class="btn" id="surahSecretsCloseBtn">✖</button>
    </div>
    <div class="surah-secrets-overlay-surah-name" id="surahSecretsSurahName"></div>
    <div class="surah-secrets-overlay-body" id="surahSecretsBody"></div>
  </div>
</div>
`;

/* ===================== AYAH MODAL ===================== */

const ayahModalHTML = `
<div class="ayah-modal hidden" id="ayahModal" role="dialog" aria-label="تفاصيل الآية" aria-modal="true">
  <div class="ayah-modal-inner">
    <div class="ayah-modal-header">
      <button class="ayah-modal-close-btn" id="ayahModalCloseBtn">✖ إغلاق</button>
      <span class="ayah-modal-title" id="ayahModalTitle">الآية — </span>
    </div>
    <div class="ayah-modal-badges">
      <button class="btn btn-sm btn-outline" id="ayahModalBookmarkBtn">🔖 تحديد موضع الوقوف</button>
      <button class="btn btn-sm btn-fav" id="ayahModalFavBtn">⭐ إضافة للمفضلة</button>
    </div>
    <div class="ayah-modal-nav" id="ayahModalNav">
      <span class="ayah-modal-nav-btn" id="ayahModalNextBtn">← الآية التالية</span>
    </div>
    <div class="ayah-modal-text-box">
      <div class="ayah-modal-text" id="ayahModalText"></div>
    </div>
    <div class="ayah-modal-meta">
      <span class="ayah-modal-meta-item" id="ayahModalPage">📄 الصفحة: --</span>
      <span class="ayah-modal-meta-item" id="ayahModalJuz">📖 الجزء: --</span>
      <span class="ayah-modal-meta-item" id="ayahModalSurahAyah"></span>
    </div>
    <div class="ayah-modal-section">
      <button class="btn btn-gold btn-block" id="ayahModalTafsirBtn">📖 صفحة التفسير الكاملة</button>
    </div>
    <div class="ayah-modal-section ayah-modal-contemplation-action">
      <button class="btn btn-block" id="ayahModalContemplationBtn" hidden>✦ تأمل في الآية</button>
      <p class="ayah-modal-contemplation-status" id="ayahModalContemplationStatus" aria-live="polite" hidden></p>
    </div>
    <div class="ayah-modal-actions">
      <button class="btn btn-sm" id="ayahModalShareBtn">📤 مشاركة</button>
      <button class="btn btn-sm" id="ayahModalCopyBtn">📋 نسخ بتشكيل</button>
      <button class="btn btn-sm" id="ayahModalCopySimpleBtn">📋 نسخ بدون تشكيل</button>
      <button class="btn btn-sm" id="ayahModalCopyTafsirBtn">📋 نسخ مع التفسير</button>
    </div>
    <div class="ayah-modal-audio" id="ayahModalAudio">
      <div class="ayah-modal-audio-row">
        <select class="ayah-modal-qari-select" id="ayahModalQariSelect"></select>
        <button class="btn btn-gold btn-audio-play" id="ayahModalPlayBtn">▶️ تشغيل</button>
      </div>
      <div class="ayah-modal-audio-progress">
        <span id="ayahModalAudioCurrent">0:00</span>
        <input type="range" class="ayah-modal-audio-slider" id="ayahModalAudioSlider" min="0" max="100" value="0" />
        <span id="ayahModalAudioDuration">0:00</span>
      </div>
      <label class="ayah-modal-repeat-label"> <input type="checkbox" id="ayahModalRepeatChk" /> 🔁 تكرار </label>
      <button class="btn btn-sm btn-block" id="ayahModalDownloadBtn">⬇️ تنزيل الآية</button>
      <audio id="ayahModalAudioPlayer" preload="none"></audio>
    </div>
    <div class="ayah-modal-tafsir-tabs" id="ayahModalTafsirTabs">
      <button class="ayah-modal-tafsir-tab active" data-edition="ar-tafsir-muyassar">الميسر</button>
      <button class="ayah-modal-tafsir-tab" data-edition="ar-tafsir-as-saadi">السعدي</button>
      <button class="ayah-modal-tafsir-tab" data-edition="ar-tafsir-ibn-kathir">ابن كثير</button>
      <button class="ayah-modal-tafsir-tab" data-edition="ar-tafsir-al-tabari">الطبري</button>
    </div>
    <div class="ayah-modal-tafsir-body" id="ayahModalTafsirBody">
      <p class="tafsir-loading">⏳ جاري تحميل التفسير...</p>
    </div>
  </div>
</div>
`;

/* ===================== CONTEMPLATION SHEET ===================== */

const contemplationSheetHTML = `
<div class="contemplation-sheet hidden" id="contemplationSheet" role="dialog" aria-modal="true" aria-label="تأمل في الآية">
  <section class="contemplation-sheet-inner" role="document">
    <div class="contemplation-sheet-grip" aria-hidden="true"><span></span></div>
    <div class="contemplation-sheet-header">
      <div>
        <p class="contemplation-sheet-reference" id="contemplationReference"></p>
        <h2 id="contemplationTitle">تأمل في الآية</h2>
      </div>
      <button class="contemplation-close-btn" id="contemplationCloseBtn" aria-label="إغلاق">✕</button>
    </div>
    <p class="contemplation-sheet-hint" id="contemplationHint">أسئلة للتدبر، لا إجابات جاهزة.</p>
    <ol class="contemplation-questions" id="contemplationQuestions"></ol>
  </section>
</div>
`;

/* ===================== QIBLA OVERLAY ===================== */

const qiblaOverlayHTML = `
<div class="qibla-overlay hidden" id="qiblaOverlay" role="dialog" data-i18n-aria-label="qibla" aria-label="اتجاه القبلة" aria-modal="true">
  <div class="qibla-panel">
    <h2>🧭 <span data-i18n="qibla">اتجاه القبلة</span></h2>
    <div class="qibla-compass" id="qiblaCompass">
      <div class="qibla-needle"></div>
      <div class="qibla-center"></div>
      <span class="qibla-label qibla-n" data-i18n="prayer_dirs_n">شمال</span>
      <span class="qibla-label qibla-s" data-i18n="prayer_dirs_s">جنوب</span>
      <span class="qibla-label qibla-e" data-i18n="prayer_dirs_e">شرق</span>
      <span class="qibla-label qibla-w" data-i18n="prayer_dirs_w">غرب</span>
    </div>
    <div class="qibla-angle" id="qiblaAngle">---</div>
    <div class="qibla-direction" id="qiblaDirection">جاري تحديد الموقع...</div>
    <div class="qibla-status" id="qiblaStatus" aria-live="polite">جاري تفعيل البوصلة...</div>
    <button class="qibla-close" id="qiblaCloseBtn">✖ <span data-i18n="close">إغلاق</span></button>
  </div>
</div>
`;

/* ===================== READING STATS PANEL ===================== */

const readingStatsPanelHTML = `
<div class="settings-panel hidden" id="readingStatsPanel" role="dialog" aria-label="إحصائيات القراءة" aria-modal="true">
  <div class="settings-panel-inner">
    <div class="settings-header">
      <h3>📊 إحصائيات القراءة</h3>
      <button class="btn" id="readingStatsCloseBtn">✖</button>
    </div>
    <div id="readingStatsContent"></div>
  </div>
</div>
`;

/* ===================== INJECTION ===================== */

/**
 * Inject all overlay HTML into the document body.
 * MUST be called before cacheDom() to ensure all DOM IDs are available.
 *
 * Each overlay is inserted as raw HTML using a template element for
 * safe parsing, then appended to the body. This preserves all DOM
 * IDs and structure expected by dom.ts.
 *
 * Large panels (settings, player, keyboard) are injected alongside
 * the existing overlays, all before cacheDom() runs.
 */
export function injectOverlays(): void {
  // Inject the floating player, tafsir curtain, settings panel, and
  // other body-level panels BEFORE the overlay wrapper so they appear
  // in the correct DOM order relative to the static HTML elements.
  const bodyFragments = [floatingPlayerHTML(), settingsPanelHTML(), helpPanelHTML()];

  const bodyWrapper = document.createElement('div');
  bodyWrapper.id = 'injected-panels';
  bodyWrapper.innerHTML = bodyFragments.join('\n');
  document.body.appendChild(bodyWrapper);

  // Inject the Arabic keyboard into its mount point in the search input group
  const kbdMount = document.getElementById('arabicKeyboardMount');
  if (kbdMount) {
    kbdMount.innerHTML = arabicKeyboardHTML();
  }

  // Existing overlay fragments (dialogs, modals, notifications)
  const overlayFragments = [
    adhkarNotificationHTML,
    adhkarAddOverlayHTML,
    presentationOverlayHTML,
    azanHTML,
    surahSecretsOverlayHTML,
    ayahModalHTML,
    contemplationSheetHTML,
    qiblaOverlayHTML,
    readingStatsPanelHTML,
  ];

  const wrapper = document.createElement('div');
  wrapper.id = 'injected-overlays';
  wrapper.innerHTML = overlayFragments.join('\n');
  document.body.appendChild(wrapper);
}
