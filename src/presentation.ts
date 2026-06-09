import { __ } from './i18n.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { CONFIG } from './config.js';
import { togglePlayPause, updatePlayPauseBtn } from './audio.js';
import { buildColorMap, tajweedColorWord } from './tajweed.js';
import { getAyahAnnotations } from './tajweed-data.js';
import type { TajweedAnnotation } from './tajweed-data.js';
import { escapeHtml } from './utils.js';

/** Shape of surahData when accessed in presentation functions. */
interface SurahAyahData {
  numberInSurah: number;
  text: string;
}

interface SurahDataLike {
  name: string;
  ayahs: SurahAyahData[];
}

interface TranslationAyahData {
  text: string;
}

interface TranslationDataLike {
  ayahs: TranslationAyahData[];
}

let _prevHighlightTimeout: ReturnType<typeof setTimeout> | null = null;

function injectStyles(): void {
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

function buildAyahHtml(text: string, surahNum: number, ayahNum: number): string {
  let txt = text;
  let offsetAdj = 0;
  if (surahNum !== 1 && ayahNum === 1) {
    const stripped = txt.replace(
      /^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u,
      ''
    );
    offsetAdj = txt.length - stripped.length;
    txt = stripped;
  }
  if (!state.tajweedEnabled) return escapeHtml(txt);
  const annotations = getAyahAnnotations(surahNum, ayahNum);
  if (annotations.length === 0) return escapeHtml(txt);
  const adjusted =
    offsetAdj > 0
      ? annotations.map((ann: TajweedAnnotation) => ({
          rule: ann.rule,
          start: ann.start - offsetAdj,
          end: ann.end - offsetAdj,
        }))
      : annotations;
  const colorMap = buildColorMap(adjusted);
  const words = txt.split(/\s+/).filter((w) => w.length > 0);
  let outputPos = 0;
  return words
    .map((word: string) => {
      const wordHtml = tajweedColorWord(word, outputPos, colorMap);
      outputPos += word.length;
      return wordHtml;
    })
    .join(' ');
}

function updateDisplay(): void {
  if (!state.presentationMode) return;
  const surahData = state.surahData as unknown as SurahDataLike | null;
  const ayah = surahData?.ayahs?.[state.currentAyahIndex];
  if (!ayah) {
    if (dom.presentationAyahText) dom.presentationAyahText.innerHTML = '—';
    if (dom.presentationAyahNum) dom.presentationAyahNum.textContent = '—';
    if (dom.presentationTitle) dom.presentationTitle.textContent = '—';
    if (dom.presentationCounter) dom.presentationCounter.textContent = '٠ / ٠';
    if (dom.presentationTranslation) dom.presentationTranslation.style.display = 'none';
    return;
  }
  if (dom.presentationAyahText)
    dom.presentationAyahText.innerHTML = buildAyahHtml(ayah.text, state.currentSurah, ayah.numberInSurah);
  if (dom.presentationAyahNum) dom.presentationAyahNum.textContent = String(ayah.numberInSurah);
  const surahName = surahData?.name || '';
  if (dom.presentationTitle) dom.presentationTitle.textContent = `${surahName} — ${__('ayah')} ${ayah.numberInSurah}`;
  const total = surahData?.ayahs?.length || 0;
  if (dom.presentationCounter) dom.presentationCounter.textContent = `${ayah.numberInSurah} / ${total}`;
  const translationData = state.translationData as unknown as TranslationDataLike | null;
  if (state.translationEnabled && translationData?.ayahs?.[state.currentAyahIndex]) {
    if (dom.presentationTranslation) {
      dom.presentationTranslation.textContent = translationData.ayahs[state.currentAyahIndex].text;
      dom.presentationTranslation.style.display = '';
    }
  } else {
    if (dom.presentationTranslation) dom.presentationTranslation.style.display = 'none';
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

function navigateAyah(delta: number): void {
  const surahData = state.surahData as unknown as SurahDataLike | null;
  if (!surahData?.ayahs) return;
  const next = state.currentAyahIndex + delta;
  if (next < 0 || next >= surahData.ayahs.length) return;
  state.currentAyahIndex = next;
  updateDisplay();
  if (dom.presentationOverlay) {
    const pBody = dom.presentationBody;
    if (pBody) pBody.scrollTop = 0;
  }
}

export function togglePresentation(): void {
  if (state.presentationMode) {
    closePresentation();
  } else {
    openPresentation();
  }
}

export function openPresentation(): void {
  if (state.mushafMode) {
    import('./mushaf.js').then((m: { toggleMushafMode: () => void }) => m.toggleMushafMode());
  }
  state.presentationMode = true;
  injectStyles();
  if (dom.presentationOverlay) {
    dom.presentationOverlay.classList.remove('hidden');
    dom.presentationOverlay.style.display = '';
    if (document.body.classList.contains('night-mode')) {
      dom.presentationOverlay.classList.remove('pres-light');
    } else {
      dom.presentationOverlay.classList.add('pres-light');
    }
  }
  document.body.classList.add('presentation-active');
  document.querySelectorAll('.view-mode-btn').forEach((b: Element) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.mode === 'presentation');
  });
  document.addEventListener('keydown', handleKeyDown);
  updateDisplay();
}

export function closePresentation(): void {
  state.presentationMode = false;
  if (dom.presentationOverlay) {
    dom.presentationOverlay.classList.add('hidden');
    dom.presentationOverlay.style.display = '';
  }
  document.body.classList.remove('presentation-active');
  document.removeEventListener('keydown', handleKeyDown);
  document.querySelectorAll('.view-mode-btn').forEach((b: Element) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.mode === 'surah');
  });
}

function handleKeyDown(e: KeyboardEvent): void {
  if (
    (e.target as HTMLElement).tagName === 'INPUT' ||
    (e.target as HTMLElement).tagName === 'TEXTAREA' ||
    (e.target as HTMLElement).tagName === 'SELECT'
  )
    return;
  switch (e.key) {
    case 'Escape':
      closePresentation();
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      navigateAyah(1);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      navigateAyah(-1);
      break;
    case ' ':
      e.preventDefault();
      togglePlayPause();
      updatePlayPauseBtn();
      break;
  }
}

export function syncPresentation(): void {
  if (state.presentationMode) updateDisplay();
}

export function initPresentation(): void {
  injectStyles();
  if (dom.presentationCloseBtn) dom.presentationCloseBtn.addEventListener('click', closePresentation);
  if (dom.presentationPrevBtn) dom.presentationPrevBtn.addEventListener('click', () => navigateAyah(-1));
  if (dom.presentationNextBtn) dom.presentationNextBtn.addEventListener('click', () => navigateAyah(1));
  dom.presentationOverlay?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.presentationOverlay) closePresentation();
  });
}
