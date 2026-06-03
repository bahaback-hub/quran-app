import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { loadSurah } from './surah-loader.js';
import { stopClock, startClock } from './prayer.js';
import { checkAdhkarNotifications } from './adhkar.js';

/* ===================== CONTINUE WIDGET ===================== */

const CONTINUE_WIDGET_STYLES_ID = 'continue-widget-styles';

function injectContinueWidgetStyles() {
  if (document.getElementById(CONTINUE_WIDGET_STYLES_ID)) return;
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
      direction: rtl; cursor: pointer;
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

export function showContinueWidget(info) {
  injectContinueWidgetStyles();
  const existing = document.getElementById('continueWidget');
  if (existing) existing.remove();

  const widget = document.createElement('div');
  widget.id = 'continueWidget';
  widget.className = 'continue-widget';

  const icon = document.createElement('span');
  icon.className = 'continue-widget-icon';
  icon.textContent = '📖';

  const text = document.createElement('span');
  text.className = 'continue-widget-text';
  const dateStr = info.timestamp ? new Date(info.timestamp).toLocaleDateString('ar-SA') : '';
  const strong = document.createElement('strong');
  strong.textContent = info.surahName;
  const small = document.createElement('small');
  small.style.opacity = '0.7';
  small.textContent = `آخر زيارة: ${dateStr}`;
  text.append('📖 ', strong, ` — آية ${info.ayahNumberInSurah}`, document.createElement('br'), small);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'continue-widget-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'إغلاق');

  widget.appendChild(icon);
  widget.appendChild(text);
  widget.appendChild(closeBtn);

  widget.addEventListener('click', (e) => {
    if (e.target === closeBtn || closeBtn.contains(/** @type {Node} */ (e.target))) {
      widget.remove();
      return;
    }
    widget.remove();
    if (dom.surahSelect) dom.surahSelect.value = info.surah;
    loadSurah(info.surah, { startAyah: info.ayahNumberInSurah || 1 });
  });

  document.body.appendChild(widget);

  setTimeout(() => {
    const w = document.getElementById('continueWidget');
    if (w) w.remove();
  }, 8000);
}

/* ===================== WELCOME SCREEN ===================== */

export function showWelcomeScreen() {
  if (!dom.welcomeScreen) return;
  const dismissed = storage.get('welcome_dismissed');
  if (dismissed) return;
  dom.welcomeScreen.style.display = 'flex';
}

export function dismissWelcomeScreen() {
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
  storage.set('welcome_dismissed', true);
}

/* ===================== VISIBILITY ===================== */

export function handleVisibilityChange() {
  if (document.hidden) {
    stopClock();
    if (state.adhkarIntervalId) { clearInterval(state.adhkarIntervalId); state.adhkarIntervalId = null; }
  } else {
    startClock();
    if (!state.adhkarIntervalId) state.adhkarIntervalId = setInterval(checkAdhkarNotifications, 15000);
  }
}

/* ===================== NETWORK BANNER ===================== */

export function updateNetworkBanner() {
  if (!dom.networkBanner) return;
  if (!navigator.onLine) {
    dom.networkBanner.classList.add('show');
    dom.networkBanner.classList.remove('online');
  } else {
    dom.networkBanner.classList.remove('show');
  }
}

/* ===================== READING PROGRESS ===================== */

let _progressPending = false;
export function updateReadingProgress() {
  if (_progressPending) return;
  _progressPending = true;
  requestAnimationFrame(() => {
    _progressPending = false;
    const progressBar = document.getElementById('readingProgress');
    if (!progressBar) return;
    if (state.mushafMode) {
      progressBar.style.transform = `scaleX(${state.currentPage / 604})`;
      return;
    }
    const container = dom.surahContent;
    if (!container || !state.surahData) return;
    const total = state.surahData.ayahs?.length || 1;
    const progress = Math.min(1, (state.currentAyahIndex + 1) / total);
    progressBar.style.transform = `scaleX(${progress})`;
  });
}
