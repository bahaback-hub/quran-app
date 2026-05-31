import { state } from './state.js';
import { dom } from './dom.js';
import { CONFIG } from './config.js';
import { togglePlayPause, updatePlayPauseBtn } from './audio.js';

let _prevHighlightTimeout = null;

function injectStyles() {
  if (document.getElementById('pres-styles')) return;
  const style = document.createElement('style');
  style.id = 'pres-styles';
  style.textContent = `
    .presentation-overlay {
      position: fixed; inset: 0; z-index: 5000;
      background: var(--bg-primary, #1a1a2e);
      display: flex; align-items: center; justify-content: center;
      direction: rtl; font-family: 'Scheherazade New', 'Amiri', serif;
      animation: presFadeIn 0.3s ease;
    }
    .presentation-overlay.pres-light {
      background: #f5f0e8;
    }
    .presentation-overlay.pres-light .presentation-ayah-text {
      color: #1a1a1a;
    }
    .presentation-inner {
      display: flex; flex-direction: column;
      width: 100%; height: 100%; max-width: 1200px;
      padding: 20px; box-sizing: border-box;
    }
    .presentation-header {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .presentation-overlay.pres-light .presentation-header {
      border-color: rgba(0,0,0,0.1);
    }
    .presentation-title {
      font-size: 16px; color: var(--text-muted, #aaa); flex: 1;
    }
    .presentation-overlay.pres-light .presentation-title {
      color: #666;
    }
    .presentation-ayah-num {
      font-size: 18px; color: var(--accent, #ffe066); font-weight: 700;
    }
    .presentation-overlay.pres-light .presentation-ayah-num {
      color: #8b6f5a;
    }
    .presentation-header-btn, .presentation-close-btn {
      background: rgba(255,255,255,0.1); border: none;
      color: #fff; font-size: 22px; padding: 8px 16px;
      border-radius: 8px; cursor: pointer; transition: background 0.2s;
    }
    .presentation-overlay.pres-light .presentation-header-btn,
    .presentation-overlay.pres-light .presentation-close-btn {
      color: #333; background: rgba(0,0,0,0.08);
    }
    .presentation-header-btn:hover, .presentation-close-btn:hover {
      background: rgba(255,255,255,0.2);
    }
    .presentation-overlay.pres-light .presentation-header-btn:hover,
    .presentation-overlay.pres-light .presentation-close-btn:hover {
      background: rgba(0,0,0,0.15);
    }
    .presentation-close-btn {
      font-size: 18px; padding: 8px 14px;
    }
    .presentation-body {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 20px; overflow-y: auto;
    }
    .presentation-ayah-text {
      font-size: 60px; line-height: 1.8; text-align: center;
      color: #fff; max-width: 900px;
      word-spacing: 6px;
    }
    .presentation-translation {
      font-size: 24px; line-height: 1.6; text-align: center;
      color: rgba(255,255,255,0.7); margin-top: 24px;
      font-family: 'Segoe UI', Tahoma, sans-serif;
      max-width: 700px;
    }
    .presentation-overlay.pres-light .presentation-translation {
      color: rgba(0,0,0,0.6);
    }
    .presentation-footer {
      display: flex; align-items: center; justify-content: center;
      padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .presentation-overlay.pres-light .presentation-footer {
      border-color: rgba(0,0,0,0.1);
    }
    .presentation-counter {
      font-size: 16px; color: var(--text-muted, #aaa);
    }
    .presentation-overlay.pres-light .presentation-counter {
      color: #666;
    }
    @keyframes presFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    @media (max-width: 600px) {
      .presentation-ayah-text { font-size: 32px; }
      .presentation-body { padding: 20px 12px; }
      .presentation-translation { font-size: 18px; }
    }
    @media (min-width: 1200px) {
      .presentation-ayah-text { font-size: 72px; }
    }
  `;
  document.head.appendChild(style);
}

function updateDisplay() {
  if (!state.presentationMode) return;
  const ayah = state.surahData?.ayahs?.[state.currentAyahIndex];
  if (!ayah) {
    dom.presentationAyahText.textContent = '—';
    dom.presentationAyahNum.textContent = '—';
    dom.presentationTitle.textContent = '—';
    dom.presentationCounter.textContent = '٠ / ٠';
    dom.presentationTranslation.style.display = 'none';
    return;
  }
  dom.presentationAyahText.textContent = ayah.text;
  dom.presentationAyahNum.textContent = ayah.numberInSurah;
  const surahName = state.surahData?.name || '';
  dom.presentationTitle.textContent = `${surahName} — آية ${ayah.numberInSurah}`;
  const total = state.surahData?.ayahs?.length || 0;
  dom.presentationCounter.textContent = `${ayah.numberInSurah} / ${total}`;
  if (state.translationEnabled && state.translationData?.ayahs?.[state.currentAyahIndex]) {
    dom.presentationTranslation.textContent = state.translationData.ayahs[state.currentAyahIndex].text;
    dom.presentationTranslation.style.display = '';
  } else {
    dom.presentationTranslation.style.display = 'none';
  }
  if (_prevHighlightTimeout) clearTimeout(_prevHighlightTimeout);
  _prevHighlightTimeout = setTimeout(() => {
    const el = dom.presentationAyahText;
    if (el) {
      el.style.transition = 'opacity 0.15s';
      el.style.opacity = '0';
      requestAnimationFrame(() => {
        el.style.opacity = '1';
      });
    }
  }, 50);
}

function navigateAyah(delta) {
  if (!state.surahData?.ayahs) return;
  const next = state.currentAyahIndex + delta;
  if (next < 0 || next >= state.surahData.ayahs.length) return;
  state.currentAyahIndex = next;
  updateDisplay();
  if (dom.presentationOverlay) {
    const pBody = dom.presentationBody;
    if (pBody) pBody.scrollTop = 0;
  }
}

export function togglePresentation() {
  if (state.presentationMode) {
    closePresentation();
  } else {
    openPresentation();
  }
}

export function openPresentation() {
  if (state.mushafMode) {
    import('./mushaf.js').then(m => m.toggleMushafMode());
  }
  state.presentationMode = true;
  injectStyles();
  if (dom.presentationOverlay) dom.presentationOverlay.style.display = '';
  document.body.classList.add('presentation-active');
  document.querySelectorAll('.view-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === 'presentation');
  });
  document.addEventListener('keydown', handleKeyDown);
  updateDisplay();
}

export function closePresentation() {
  state.presentationMode = false;
  if (dom.presentationOverlay) dom.presentationOverlay.style.display = 'none';
  document.body.classList.remove('presentation-active');
  document.removeEventListener('keydown', handleKeyDown);
  document.querySelectorAll('.view-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === 'surah');
  });
}

function handleKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  switch (e.key) {
    case 'Escape': closePresentation(); break;
    case 'ArrowRight': case 'ArrowDown': e.preventDefault(); navigateAyah(1); break;
    case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); navigateAyah(-1); break;
    case ' ': e.preventDefault(); togglePlayPause(); updatePlayPauseBtn(); break;
  }
}

export function syncPresentation() {
  if (state.presentationMode) updateDisplay();
}

export function initPresentation() {
  injectStyles();
  if (dom.presentationCloseBtn) dom.presentationCloseBtn.addEventListener('click', closePresentation);
  if (dom.presentationPrevBtn) dom.presentationPrevBtn.addEventListener('click', () => navigateAyah(-1));
  if (dom.presentationNextBtn) dom.presentationNextBtn.addEventListener('click', () => navigateAyah(1));
  dom.presentationOverlay?.addEventListener('click', (e) => {
    if (e.target === dom.presentationOverlay) closePresentation();
  });
}
