import { __ } from '../../i18n.js';

/**
 * Generate the Arabic on-screen keyboard HTML for search input.
 */
export function arabicKeyboardHTML(): string {
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

/**
 * Generate the help/guide panel HTML with accordion sections.
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
