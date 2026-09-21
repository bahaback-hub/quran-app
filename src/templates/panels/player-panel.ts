/**
 * Floating Audio Player Template.
 */
export function floatingPlayerHTML(): string {
  return `<div class="player collapsed" id="player" role="region" aria-label="مشغل التلاوة">
      <div class="collapsed-content" id="collapsedContent">
        <span class="collapse-chevron" aria-hidden="true">▲</span>
        <div class="collapsed-controls">
          <button class="collapsed-nav-btn" id="collapsedPrevAyahBtn" aria-label="الآية السابقة" title="الآية السابقة">◀</button>
          <button class="floating-play-btn" id="collapsedPlayBtn" aria-label="تشغيل/إيقاف">
            <svg class="icon icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
          <button class="collapsed-nav-btn" id="collapsedNextAyahBtn" aria-label="الآية التالية" title="الآية التالية">▶</button>
        </div>
        <div class="floating-info" id="collapsedInfo">—</div>
      </div>
      <div class="player-expand-hint" id="playerExpandHint" role="status" hidden>اضغط لعرض كامل المشغل ▲</div>

      <div class="expanded-content">
        <div class="expanded-header">
          <span id="playerReciterName">—</span>
          <span id="playerSurahName">—</span>
          <button class="collapse-btn" id="collapsePlayerBtn" aria-label="إغلاق المشغل" data-i18n-aria-label="collapse_player">✖</button>
        </div>
        <div class="current-ayah" id="playerCurrentAyah">—</div>
        <span id="sleepTimerDisplay" class="sleep-timer-badge"></span>
        <div class="player-row">
          <audio id="audioPlayer" controls preload="metadata"></audio>
        </div>
        <div class="player-buttons">
          <button class="btn" id="prevSurahBtn" aria-label="السورة السابقة" title="السورة السابقة" data-i18n-aria-label="prev_surah" data-i18n-title="prev_surah">⏮</button>
          <button class="btn" id="prevAyahBtn" aria-label="الآية السابقة" title="الآية السابقة" data-i18n-aria-label="prev_ayah" data-i18n-title="prev_ayah">◀</button>
          <span class="speed-control" id="speedControl">
            <span class="speed-icon" aria-hidden="true">⏩</span>
            <select id="speedSelect" aria-label="سرعة التلاوة" title="سرعة التلاوة" data-i18n-aria-label="recitation_speed" data-i18n-title="recitation_speed" class="speed-select">
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1" selected>1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </span>
          <span class="pitch-control" id="pitchControl">
            <span class="pitch-icon" aria-hidden="true">🎵</span>
            <select id="pitchSelect" aria-label="التردد المرجعي" title="التردد المرجعي" data-i18n-aria-label="reference_frequency" data-i18n-title="reference_frequency" class="pitch-select">
              <option value="440" selected>440Hz</option>
              <option value="432">432Hz</option>
              <option value="528">528Hz</option>
              <option value="550">550Hz</option>
            </select>
            <input type="range" id="pitchRange" min="400" max="600" step="1" value="440" aria-label="ضبط التردد" title="ضبط التردد (400-600Hz)" data-i18n-aria-label="pitch_tuning" data-i18n-title="pitch_tuning" class="pitch-range" />
          </span>
          <button class="btn btn-gold" id="playPauseBtn" aria-label="تشغيل/إيقاف" data-i18n-aria-label="play_pause">⏯</button>
          <button class="btn" id="nextAyahBtn" aria-label="الآية التالية" title="الآية التالية" data-i18n-aria-label="next_ayah" data-i18n-title="next_ayah">▶</button>
          <button class="btn" id="nextSurahBtn" aria-label="السورة التالية" title="السورة التالية" data-i18n-aria-label="next_surah" data-i18n-title="next_surah">⏭</button>
        </div>
        <div class="player-grid">
          <button class="btn btn-hifdh grid-btn" id="hifdhBtn" aria-label="وضع الحفظ" data-i18n-aria-label="hifz_mode">🕋 حفظ</button>
          <button class="btn btn-repeat grid-btn" id="repeatBtn" aria-label="التكرار" data-i18n-aria-label="repeat_mode">🔁 تكرار</button>
          <button class="btn btn-autoplay grid-btn" id="autoPlayNextBtn" data-i18n="autoplay_next" aria-label="التشغيل المتصل" title="التشغيل المتصل — ينتقل تلقائياً للسورة التالية" data-i18n-aria-label="autoplay_next" data-i18n-title="autoplay_next_hint">🔗 متصل</button>
          <button class="btn btn-sleep grid-btn" id="sleepTimerBtn" aria-label="مؤقت النوم" title="مؤقت النوم" data-i18n-aria-label="sleep_timer" data-i18n-title="sleep_timer">😴 نوم</button>
          <button class="btn btn-download grid-btn" id="downloadAudioBtn" data-i18n="download_audio" aria-label="تحميل السورة للعمل بدون إنترنت" title="تحميل السورة للعمل بدون إنترنت" data-i18n-aria-label="download_surah_audio" data-i18n-title="download_surah_audio">📥 تحميل</button>
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
      </div>
    </div>`;
}
