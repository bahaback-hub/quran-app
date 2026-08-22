import { state } from './state.js';
import { dom } from './dom.js';
import { loadSurah } from './surah-loader.js';
import { stopClock, startClock } from './prayer.js';
import { checkAdhkarNotifications } from './adhkar.js';
import { __, getLang } from './i18n.js';
import { getAdhkarIntervalId, setAdhkarIntervalId } from './internal-state.js';
// Static import of announceToScreenReader (was dynamic, but a11y.ts is
// already statically imported by app.ts, app-events.ts, and
// sleep-timer-modal.ts — the dynamic import produced an
// INEFFECTIVE_DYNAMIC_IMPORT warning with no code-splitting benefit).
import { announceToScreenReader } from './a11y.js';

/* ===================== CONTINUE WIDGET ===================== */

const CONTINUE_WIDGET_STYLES_ID = 'continue-widget-styles';

interface ContinueInfo {
  surah: number;
  surahName: string;
  englishSurahName?: string;
  ayahNumberInSurah: number;
  timestamp?: number;
  restored?: boolean;
}

function injectContinueWidgetStyles(): void {
  if (document.getElementById(CONTINUE_WIDGET_STYLES_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = CONTINUE_WIDGET_STYLES_ID;
  style.textContent = `
    .continue-widget {
      position: fixed; bottom: 110px; left: 50%; transform: translateX(-50%);
      background: linear-gradient(135deg, #8b6f5a, #a0846c);
      color: #fff; padding: 12px 24px; border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 3000;
      display: flex; align-items: center; gap: 12px;
      font-family: 'Amiri', 'Traditional Arabic', serif;
      text-align: start; cursor: pointer;
      animation: slideUp 0.4s ease;
      border: 1px solid rgba(255,255,255,0.2);
      max-width: 90vw;
    }
    .continue-widget:hover { transform: translateX(-50%) translateY(-2px); }
    .continue-widget-close {
      background: rgba(255,255,255,0.2); border: none; color: #fff;
      width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
      font-size: 14px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background 0.2s;
    }
    .continue-widget-close:hover { background: rgba(255,255,255,0.4); }
    .continue-widget-text { font-size: 15px; line-height: 1.5; }
    .continue-widget-text strong { color: #ffe066; }
    .continue-widget-text small { display: inline-block; margin-top: 1px; }
    .continue-widget-icon { font-size: 24px; flex-shrink: 0; }
    @keyframes slideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(30px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    body.night-mode .continue-widget {
      background: linear-gradient(135deg, #1a1f2e, #232838);
      border-color: #5a4a3a;
    }
  `;
  document.head.appendChild(style);
}

export function showContinueWidget(info: ContinueInfo): void {
  injectContinueWidgetStyles();
  const existing = document.getElementById('continueWidget');
  if (existing) {
    existing.remove();
  }

  const widget = document.createElement('div');
  widget.id = 'continueWidget';
  widget.className = 'continue-widget';
  const lang = getLang();
  widget.dir = lang === 'ar' ? 'rtl' : 'ltr';
  widget.setAttribute('role', 'status');

  const icon = document.createElement('span');
  icon.className = 'continue-widget-icon';
  icon.textContent = '📖';

  const text = document.createElement('span');
  text.className = 'continue-widget-text';
  const locale = ({ ar: 'ar-SA', en: 'en', tr: 'tr', ms: 'ms', id: 'id' } as const)[lang];
  const dateStr = info.timestamp ? new Date(info.timestamp).toLocaleDateString(locale) : '';
  const strong = document.createElement('strong');
  const visibleSurahName = lang === 'ar' || !info.englishSurahName ? info.surahName : info.englishSurahName;
  strong.textContent = visibleSurahName;
  const small = document.createElement('small');
  small.style.opacity = '0.7';
  small.textContent = dateStr ? __('last_visit_time', dateStr) : '';
  text.append(
    `${__('continue_reading')}: `,
    strong,
    `${__('continue_ayah', String(info.ayahNumberInSurah))}`,
    document.createElement('br'),
    small,
  );

  const closeBtn = document.createElement('button');
  closeBtn.className = 'continue-widget-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', __('close'));

  widget.appendChild(icon);
  widget.appendChild(text);
  widget.appendChild(closeBtn);

  widget.addEventListener('click', (e: MouseEvent) => {
    if (e.target === closeBtn || closeBtn.contains(e.target as Node)) {
      widget.remove();
      return;
    }
    widget.remove();
    if (!info.restored) {
      if (dom.surahSelect) {
        dom.surahSelect.value = String(info.surah);
      }
      void loadSurah(info.surah, { startAyah: info.ayahNumberInSurah || 1 });
    }
  });

  document.body.appendChild(widget);

  setTimeout(() => {
    const w = document.getElementById('continueWidget');
    if (w) {
      w.remove();
    }
  }, 8000);
}

/* ===================== VISIBILITY ===================== */

export function handleVisibilityChange(): void {
  if (document.hidden) {
    stopClock();
    const intervalId = getAdhkarIntervalId();
    if (intervalId) {
      clearInterval(intervalId);
      setAdhkarIntervalId(null);
    }
  } else {
    startClock();
    if (!getAdhkarIntervalId()) {
      setAdhkarIntervalId(setInterval(checkAdhkarNotifications, 30_000));
    }
  }
}

/* ===================== NETWORK BANNER ===================== */

/** Previous online state — used to announce changes to screen readers. */
let _wasOnline: boolean | null = null;

/**
 * Update the network banner visibility based on connection status.
 * Announces state changes to screen readers via ARIA live regions.
 */
export function updateNetworkBanner(): void {
  if (!dom.networkBanner) {
    return;
  }
  const isOnline = navigator.onLine !== false;
  // `hidden` prevents a stale `.show` class from leaving a false offline
  // message visible after a browser restores connectivity from its cache.
  dom.networkBanner.hidden = isOnline;
  dom.networkBanner.classList.toggle('show', !isOnline);
  dom.networkBanner.classList.remove('online');

  // Announce connection state changes to screen readers.
  // announceToScreenReader is statically imported at the top of this module.
  if (_wasOnline !== null && _wasOnline !== isOnline) {
    try {
      announceToScreenReader(
        isOnline ? __('a11y_you_are_online') : __('a11y_you_are_offline'),
        isOnline ? 'polite' : 'assertive',
      );
    } catch {
      /* a11y announce failed — non-critical */
    }
  }
  _wasOnline = isOnline;
}

/* ===================== READING PROGRESS ===================== */

let _progressPending = false;
export function updateReadingProgress(): void {
  if (_progressPending) {
    return;
  }
  _progressPending = true;
  requestAnimationFrame(() => {
    _progressPending = false;
    const progressBar = document.getElementById('readingProgress');
    if (!progressBar) {
      return;
    }
    if (state.mushafMode) {
      const pct = Math.round((state.currentPage / 604) * 100);
      progressBar.style.transform = `scaleX(${state.currentPage / 604})`;
      progressBar.setAttribute('aria-valuenow', String(pct));
      return;
    }
    const container = dom.surahContent;
    if (!container || !state.surahData) {
      return;
    }
    const ayahs = state.surahData.ayahs;
    const total = Array.isArray(ayahs) ? ayahs.length : 1;
    const progress = Math.min(1, (state.currentAyahIndex + 1) / total);
    progressBar.style.transform = `scaleX(${progress})`;
    progressBar.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  });
}
