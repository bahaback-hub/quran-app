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
import { readingPlansPanelHTML } from './templates-reading-plans.js';

/* ===================== ADHKAR NOTIFICATION ===================== */

const adhkarNotificationHTML = `
<div class="adhkar-notification hidden" id="adhkarNotification" role="alert" aria-live="assertive">
  <div class="adhkar-notification-inner">
    <div class="adhkar-notification-icon" id="adhkarNotifIcon">🌅</div>
    <div class="adhkar-notification-title" id="adhkarNotifTitle" data-i18n="adhkar_notif_title">🕌 حان وقت الأذكار</div>
    <div class="adhkar-notification-text adhkar-notif-text" id="adhkarNotifText"></div>
    <div class="adhkar-notification-progress adhkar-notif-progress" id="adhkarNotifProgress"></div>
    <div class="adhkar-notification-actions">
      <button class="btn btn-gold" id="adhkarNotifOpenBtn" data-i18n="adhkar_notif_open">🕌 فتح الأذكار</button>
      <button class="btn btn-sm adhkar-notif-share-btn" id="adhkarNotifShareBtn" data-i18n="adhkar_notif_copy">📋 نسخ</button>
      <button class="btn" id="adhkarNotifDismissBtn" data-i18n="adhkar_notif_later">⏰ لاحقاً</button>
    </div>
  </div>
</div>
`;

/* ===================== ADHKAR ADD OVERLAY ===================== */

const adhkarAddOverlayHTML = `
<div class="adhkar-add-overlay hidden" id="adhkarAddOverlay" data-i18n-aria-label="adhkar_add_dlg" aria-label="إضافة ذكر جديد" aria-modal="true">
  <div class="adhkar-add-inner">
    <div class="adhkar-add-header">
      <h3 data-i18n="adhkar_add_title">📝 إضافة ذكر جديد</h3>
      <button class="btn" id="adhkarAddCloseBtn">✖</button>
    </div>
    <div class="adhkar-add-body">
      <div class="settings-row">
        <label for="adhkarAddText" data-i18n="adhkar_add_text">نص الذكر:</label>
        <textarea id="adhkarAddText" rows="3" data-i18n-placeholder="adhkar_add_text_ph" placeholder="اكتب الذكر هنا..."></textarea>
      </div>
      <div class="settings-row">
        <label for="adhkarAddCount" data-i18n="adhkar_add_count">عدد التكرار:</label>
        <input type="number" id="adhkarAddCount" value="1" min="1" max="999" />
      </div>
      <div class="settings-row">
        <label for="adhkarAddTime" data-i18n="adhkar_add_time">وقت التذكير (اختياري):</label>
        <input type="time" id="adhkarAddTime" />
      </div>
      <div class="settings-row">
        <label for="adhkarAddDuration" data-i18n="adhkar_add_duration">مدة الإشعار (دقائق):</label>
        <input type="number" id="adhkarAddDuration" value="1" min="1" max="60" />
      </div>
      <button class="btn btn-gold" id="adhkarAddSaveBtn" data-i18n="adhkar_add_save">💾 حفظ الذكر</button>
    </div>
  </div>
</div>
`;

/* ===================== PRESENTATION OVERLAY ===================== */

const presentationOverlayHTML = `
<div class="presentation-overlay hidden" id="presentationOverlay" role="dialog" data-i18n-aria-label="pres_dlg" aria-label="وضع العرض" aria-modal="true">
  <div class="presentation-inner">
    <div class="presentation-header">
      <div class="presentation-nav-cluster presentation-surah-nav" data-i18n-aria-label="pres_nav_surahs" aria-label="التنقل بين السور">
        <button class="presentation-header-btn presentation-surah-btn" id="presentationPrevSurahBtn" data-i18n-aria-label="pres_prev_surah" aria-label="السورة السابقة" data-i18n-title="pres_prev_surah" title="السورة السابقة">❯</button>
        <button class="presentation-header-btn presentation-surah-btn" id="presentationNextSurahBtn" data-i18n-aria-label="pres_next_surah" aria-label="السورة التالية" data-i18n-title="pres_next_surah" title="السورة التالية">❮</button>
      </div>
      <div class="presentation-current-meta" aria-live="polite">
        <span class="presentation-title" id="presentationTitle">—</span>
        <span class="presentation-ayah-num" id="presentationAyahNum">—</span>
      </div>
      <div class="presentation-nav-cluster presentation-ayah-nav" data-i18n-aria-label="pres_nav_ayahs" aria-label="التنقل بين الآيات">
        <button class="presentation-header-btn presentation-ayah-btn" id="presentationPrevBtn" data-i18n-aria-label="pres_prev_ayah" aria-label="الآية السابقة" data-i18n-title="pres_prev_ayah" title="الآية السابقة">⏮</button>
        <button class="presentation-header-btn presentation-ayah-btn" id="presentationNextBtn" data-i18n-aria-label="pres_next_ayah" aria-label="الآية التالية" data-i18n-title="pres_next_ayah" title="الآية التالية">⏭</button>
      </div>
      <div class="presentation-actions" data-i18n-aria-label="pres_tools" aria-label="أدوات وضع العرض">
        <button class="presentation-header-btn pres-control-btn" id="presPlayPauseBtn" data-i18n-aria-label="pres_play_pause" aria-label="تشغيل / إيقاف">▶</button>
        <button class="presentation-header-btn pres-control-btn pres-tajweed-btn" id="presTajweedBtn" data-i18n-aria-label="pres_tajweed" aria-label="ألوان التجويد" data-i18n-title="pres_tajweed_title" title="تشغيل/إيقاف ألوان التجويد">🎨</button>
        <button class="presentation-header-btn pres-control-btn pres-background-btn" id="presBackgroundBtn" type="button" data-i18n-aria-label="pres_bg" aria-label="اختيار الخلفية" aria-expanded="false" aria-controls="presBackgroundPicker" title="اختيار الخلفية">🖼️</button>
        <button class="presentation-header-btn pres-control-btn" id="presFullscreenBtn" data-i18n-aria-label="pres_fullscreen" aria-label="ملء الشاشة">⛶</button>
        <button class="presentation-header-btn pres-control-btn" id="presShareBtn" data-i18n-aria-label="pres_share" aria-label="مشاركة صورة الآية" data-i18n-title="pres_share" title="مشاركة صورة الآية">↗</button>
        <button class="presentation-header-btn pres-control-btn hidden" id="presVideoShareBtn" type="button" data-i18n-aria-label="pres_video_share" aria-label="مشاركة فيديو العفاسي" data-i18n-title="pres_video_share" title="مشاركة فيديو العفاسي">🎞</button>
        <button class="presentation-close-btn" id="presentationCloseBtn" data-i18n-aria-label="pres_close" aria-label="خروج">✖</button>
        <section class="presentation-background-picker hidden" id="presBackgroundPicker" data-i18n-aria-label="pres_pick_dlg" aria-label="اختيار خلفية وضع العرض">
          <p class="presentation-background-picker-title" data-i18n="pres_pick_title">اختر الخلفية</p>
          <div class="presentation-background-options" role="group" data-i18n-aria-label="pres_pick_options" aria-label="خيارات الخلفية">
            <button type="button" data-pres-bg-mode="plain" data-i18n="pres_pick_plain">هدوء</button>
            <button type="button" data-pres-bg-mode="nature" data-i18n="pres_pick_nature">طبيعية</button>
            <button type="button" data-pres-bg-mode="scene" data-pres-bg-scene="stars" data-i18n="pres_pick_stars">سماء ونجوم</button>
            <button type="button" data-pres-bg-mode="animated" data-i18n="pres_pick_animated">منظر متحرك</button>
            <button type="button" data-pres-bg-mode="video" data-pres-bg-video="eva" data-i18n="pres_pick_eva">منزل على البحر</button>
            <button type="button" data-pres-bg-mode="video" data-pres-bg-video="alps" data-i18n="pres_pick_alps">جبال الألب والضباب</button>
            <button type="button" data-pres-bg-mode="video" data-pres-bg-video="sunset" data-i18n="pres_pick_sunset">غروب البحر</button>
            <button type="button" data-pres-bg-mode="video" data-pres-bg-video="wave" data-i18n="pres_pick_wave">الموج المتكسر</button>
          </div>
        </section>
      </div>
    </div>
    <div class="presentation-body" id="presentationBody">
      <div class="presentation-ayah-text" id="presentationAyahText"></div>
      <div class="presentation-translation hidden" id="presentationTranslation"></div>
    </div>
    <div class="presentation-footer">
      <span class="presentation-counter" id="presentationCounter">٠ / ٠</span>
    </div>
  </div>
  <button class="presentation-video-retry hidden" id="presVideoRetryBtn" type="button" data-i18n="pres_video_retry" aria-hidden="true">▶ تحريك الخلفية</button>
</div>
`;

const presentationSharePreviewHTML = `
<div class="presentation-share-preview hidden" id="presentationSharePreview" role="dialog" aria-modal="true" aria-labelledby="presentationShareHeading">
  <div class="presentation-share-preview-inner">
    <div class="presentation-share-preview-header">
      <h3 id="presentationShareHeading" data-i18n="share_preview_title">معاينة صورة الآية</h3>
      <button class="presentation-share-close" id="presentationShareCloseBtn" data-i18n-aria-label="close" aria-label="إغلاق" data-i18n="share_close_btn">✖ إغلاق</button>
    </div>
    <div class="presentation-share-image-wrap">
      <img id="presentationShareImage" alt="" />
    </div>
    <p id="presentationShareStatus" class="presentation-share-status" role="status" aria-live="polite" data-i18n="share_preparing">جارٍ تجهيز الصورة…</p>
    <div class="presentation-share-actions">
      <button class="presentation-share-primary" id="presentationShareNativeBtn" type="button" disabled data-i18n="share_now">↗ مشاركة الآن</button>
      <button class="presentation-share-secondary" id="presentationShareDownloadBtn" type="button" disabled data-i18n="share_png">↓ تنزيل PNG</button>
      <button class="presentation-share-video hidden" id="presentationShareVideoBtn" type="button" data-i18n="share_make_video">🎞 إنشاء فيديو العفاسي</button>
      <button class="presentation-share-video-download hidden" id="presentationShareVideoDownloadBtn" type="button" data-i18n="share_save_hd">↓ حفظ نسخة HD</button>
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
    <div class="azan-notification-title" data-i18n="azan_now">حان الآن وقت الصلاة</div>
    <div class="azan-notification-prayer" id="azanNotifPrayer">---</div>
    <div class="azan-notification-actions">
      <button class="btn btn-gold" id="azanNotifStopBtn" data-i18n="stop_azan">⏹️ إيقاف الأذان</button>
    </div>
  </div>
</div>
`;

/* ===================== SURAH SECRETS OVERLAY ===================== */

const surahSecretsOverlayHTML = `
<div class="surah-secrets-overlay hidden" id="surahSecretsOverlay" role="dialog" data-i18n-aria-label="secrets_dlg" aria-label="سرّ السورة" aria-modal="true">
  <div class="surah-secrets-overlay-inner">
    <div class="surah-secrets-overlay-header">
      <h3 id="surahSecretsTitle" data-i18n="secrets_title">🌟 سرّ السورة</h3>
      <button class="btn" id="surahSecretsCloseBtn">✖</button>
    </div>
    <div class="surah-secrets-overlay-surah-name" id="surahSecretsSurahName"></div>
    <div class="surah-secrets-overlay-body" id="surahSecretsBody"></div>
  </div>
</div>
`;

/* ===================== AYAH MODAL ===================== */

const ayahModalHTML = `
<div class="ayah-modal hidden" id="ayahModal" role="dialog" data-i18n-aria-label="ayah_dlg" aria-label="تفاصيل الآية" aria-modal="true">
  <div class="ayah-modal-inner">
    <div class="ayah-modal-header">
      <button class="ayah-modal-close-btn" id="ayahModalCloseBtn" data-ayah-key="ayah_modal_close"></button>
      <span class="ayah-modal-title" id="ayahModalTitle" data-i18n="ayah_title_ph">الآية — </span>
    </div>
    <div class="ayah-modal-badges">
      <button class="btn btn-sm btn-outline" id="ayahModalBookmarkBtn" data-ayah-key="ayah_modal_bookmark"></button>
      <button class="btn btn-sm btn-fav" id="ayahModalFavBtn"></button>
    </div>
    <div class="ayah-modal-nav" id="ayahModalNav">
      <span class="ayah-modal-nav-btn" id="ayahModalNextBtn" data-i18n="ayah_next">← الآية التالية</span>
    </div>
    <div class="ayah-modal-text-box">
      <div class="ayah-modal-text" id="ayahModalText"></div>
    </div>
    <div class="ayah-modal-meta">
      <span class="ayah-modal-meta-item" id="ayahModalPage" data-i18n="ayah_page_ph">📄 الصفحة: --</span>
      <span class="ayah-modal-meta-item" id="ayahModalJuz" data-i18n="ayah_juz_ph">📖 الجزء: --</span>
      <span class="ayah-modal-meta-item" id="ayahModalSurahAyah"></span>
    </div>
    <div class="ayah-modal-section">
      <button class="btn btn-gold btn-block" id="ayahModalTafsirBtn" data-ayah-key="ayah_modal_full_tafsir"></button>
    </div>
    <div class="ayah-modal-section ayah-modal-contemplation-action">
      <button class="btn btn-block" id="ayahModalContemplationBtn" hidden data-i18n="contemplation">✦ تأمل في الآية</button>
      <p class="ayah-modal-contemplation-status" id="ayahModalContemplationStatus" aria-live="polite" hidden></p>
    </div>
    <div class="ayah-modal-actions">
      <button class="btn btn-sm" id="ayahModalShareBtn" data-ayah-key="ayah_modal_share"></button>
      <button class="btn btn-sm" id="ayahModalCopyBtn" data-ayah-key="ayah_modal_copy_diacritics"></button>
      <button class="btn btn-sm" id="ayahModalCopySimpleBtn" data-ayah-key="ayah_modal_copy_plain"></button>
      <button class="btn btn-sm" id="ayahModalCopyTafsirBtn" data-ayah-key="ayah_modal_copy_tafsir"></button>
    </div>
    <div class="ayah-modal-audio" id="ayahModalAudio">
      <div class="ayah-modal-audio-row">
        <select class="ayah-modal-qari-select" id="ayahModalQariSelect"></select>
        <button class="btn btn-gold btn-audio-play" id="ayahModalPlayBtn">▶️</button>
      </div>
      <div class="ayah-modal-audio-progress">
        <span id="ayahModalAudioCurrent">0:00</span>
        <input type="range" class="ayah-modal-audio-slider" id="ayahModalAudioSlider" min="0" max="100" value="0" />
        <span id="ayahModalAudioDuration">0:00</span>
      </div>
      <label class="ayah-modal-repeat-label"> <input type="checkbox" id="ayahModalRepeatChk" /><span data-ayah-key="ayah_modal_repeat"></span></label>
      <button class="btn btn-sm btn-block" id="ayahModalDownloadBtn" data-ayah-key="ayah_modal_download"></button>
      <audio id="ayahModalAudioPlayer" preload="none"></audio>
    </div>
    <div class="ayah-modal-tafsir-tabs" id="ayahModalTafsirTabs">
      <button class="ayah-modal-tafsir-tab active" data-edition="ar-tafsir-muyassar">الميسر</button>
      <button class="ayah-modal-tafsir-tab" data-edition="ar-tafsir-as-saadi">السعدي</button>
      <button class="ayah-modal-tafsir-tab" data-edition="ar-tafsir-ibn-kathir">ابن كثير</button>
      <button class="ayah-modal-tafsir-tab" data-edition="ar-tafsir-al-tabari">الطبري</button>
    </div>
    <div class="ayah-modal-tafsir-body" id="ayahModalTafsirBody">
      <p class="tafsir-loading" data-i18n="tafsir_loading">⏳ جاري تحميل التفسير...</p>
    </div>
  </div>
</div>
`;

/* ===================== CONTEMPLATION SHEET ===================== */

const contemplationSheetHTML = `
<div class="contemplation-sheet hidden" id="contemplationSheet" role="dialog" aria-modal="true" data-i18n-aria-label="contemplation_title" aria-label="تأمل في الآية">
  <section class="contemplation-sheet-inner" role="document">
    <div class="contemplation-sheet-grip" aria-hidden="true"><span></span></div>
    <div class="contemplation-sheet-header">
      <div>
        <p class="contemplation-sheet-reference" id="contemplationReference"></p>
        <h2 id="contemplationTitle" data-i18n="contemplation_title">تأمل في الآية</h2>
      </div>
      <button class="contemplation-close-btn" id="contemplationCloseBtn" data-i18n-aria-label="close" aria-label="إغلاق">✕</button>
    </div>
    <p class="contemplation-sheet-hint" id="contemplationHint" data-i18n="contemplation_hint">أسئلة للتدبر، لا إجابات جاهزة.</p>
    <ol class="contemplation-questions" id="contemplationQuestions"></ol>
  </section>
</div>
`;

/* ===================== QIBLA OVERLAY ===================== */

const qiblaOverlayHTML = `
<div class="qibla-overlay hidden" id="qiblaOverlay" role="dialog" data-i18n-aria-label="qibla" aria-label="اتجاه القبلة" aria-modal="true">
  <div class="qibla-panel">
    <h2 class="qibla-title">🧭 <span data-i18n="qibla">اتجاه القبلة</span></h2>
    <button class="qibla-close" id="qiblaCloseBtn" type="button" aria-label="إغلاق اتجاه القبلة" data-i18n-aria-label="close" title="إغلاق" data-i18n-title="close">✖</button>
    <div class="qibla-compass" id="qiblaCompass">
      <div class="qibla-needle"></div>
      <div class="qibla-center"></div>
      <span class="qibla-label qibla-n" data-i18n="prayer_dirs_n">شمال</span>
      <span class="qibla-label qibla-s" data-i18n="prayer_dirs_s">جنوب</span>
      <span class="qibla-label qibla-e" data-i18n="prayer_dirs_e">شرق</span>
      <span class="qibla-label qibla-w" data-i18n="prayer_dirs_w">غرب</span>
    </div>
    <div class="qibla-angle" id="qiblaAngle">---</div>
    <div class="qibla-direction" id="qiblaDirection" data-i18n="qibla_locating">جاري تحديد الموقع...</div>
    <div class="qibla-status" id="qiblaStatus" aria-live="polite" data-i18n="qibla_starting">جاري تفعيل البوصلة...</div>
  </div>
</div>
`;

/* ===================== READING STATS PANEL ===================== */

const readingStatsPanelHTML = `
<div class="settings-panel hidden" id="readingStatsPanel" role="dialog" data-i18n-aria-label="stats_dlg" aria-label="إحصائيات القراءة" aria-modal="true">
  <div class="settings-panel-inner">
    <div class="settings-header">
      <h3 data-i18n="stats_title">📊 إحصائيات القراءة</h3>
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
  const bodyFragments = [floatingPlayerHTML(), settingsPanelHTML(), helpPanelHTML(), readingPlansPanelHTML()];

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
    presentationSharePreviewHTML,
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
