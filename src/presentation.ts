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

/** Available nature background images with their mood/time. */
const NATURE_BACKGROUNDS = [
  { src: 'backgrounds/dawn.jpg', mood: 'dawn', label: 'فجر' },
  { src: 'backgrounds/clouds.jpg', mood: 'morning', label: 'صباح' },
  { src: 'backgrounds/mountains.jpg', mood: 'afternoon', label: 'ظهر' },
  { src: 'backgrounds/sunset.jpg', mood: 'sunset', label: 'غروب' },
  { src: 'backgrounds/nightsky.jpg', mood: 'night', label: 'ليل' },
];

/** Get a background image based on the current time of day. */
function getAutoBackground(): (typeof NATURE_BACKGROUNDS)[number] {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 7) return NATURE_BACKGROUNDS[0]; // dawn
  if (hour >= 7 && hour < 12) return NATURE_BACKGROUNDS[1]; // morning clouds
  if (hour >= 12 && hour < 16) return NATURE_BACKGROUNDS[2]; // afternoon mountains
  if (hour >= 16 && hour < 19) return NATURE_BACKGROUNDS[3]; // sunset
  return NATURE_BACKGROUNDS[4]; // night sky
}

/** Get a random nature background (cycles per ayah). */
function getRandomNatureBg(): (typeof NATURE_BACKGROUNDS)[number] {
  const idx = Math.floor(Math.random() * NATURE_BACKGROUNDS.length);
  return NATURE_BACKGROUNDS[idx];
}

let _prevHighlightTimeout: ReturnType<typeof setTimeout> | null = null;

/** Presentation-local tajweed toggle — independent of the global setting. */
let _presTajweedEnabled = true;

/** Timeout for auto-hiding presentation controls. */
let _hideControlsTimeout: ReturnType<typeof setTimeout> | null = null;

/** Ken Burns animation variants — each uses a different pan/zoom direction. */
const KEN_BURNS_ANIMATIONS = [
  'kenBurns1', // zoom in + pan right
  'kenBurns2', // zoom out + pan left
  'kenBurns3', // zoom in + pan up
  'kenBurns4', // zoom out + pan down
  'kenBurns5', // slow zoom in center
];

/** Pick a random Ken Burns animation name. */
function getRandomKenBurns(): string {
  return KEN_BURNS_ANIMATIONS[Math.floor(Math.random() * KEN_BURNS_ANIMATIONS.length)];
}

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
      transition: background-image 1.2s ease;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      overflow: hidden;
    }
    .presentation-overlay.pres-nature,
    .presentation-overlay.pres-auto {
      background-size: cover;
      background-position: center;
    }
    .presentation-overlay.pres-nature::before,
    .presentation-overlay.pres-auto::before {
      content: '';
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.35);
      z-index: 0;
    }
    .presentation-overlay.pres-nature .presentation-inner,
    .presentation-overlay.pres-auto .presentation-inner {
      position: relative; z-index: 1;
    }

    /* ===== ANIMATED MODE ===== */
    .presentation-overlay.pres-animated {
      background-size: cover;
      background-position: center;
    }
    .presentation-overlay.pres-animated::before {
      content: '';
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.3);
      z-index: 1;
    }
    .presentation-overlay.pres-animated::after {
      content: '';
      position: absolute;
      top: -20%; left: -20%;
      width: 140%; height: 140%;
      z-index: 0;
      pointer-events: none;
      background:
        radial-gradient(ellipse 600px 300px at 20% 30%, rgba(255,255,255,0.18) 0%, transparent 70%),
        radial-gradient(ellipse 500px 250px at 70% 50%, rgba(255,255,255,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 700px 350px at 50% 70%, rgba(255,255,255,0.10) 0%, transparent 70%),
        radial-gradient(ellipse 400px 200px at 80% 20%, rgba(255,255,255,0.14) 0%, transparent 70%);
      animation: cloudDrift 25s ease-in-out infinite alternate;
    }
    .presentation-overlay.pres-animated .pres-bg-layer {
      position: absolute; inset: 0;
      background-size: cover;
      background-position: center;
      z-index: 0;
      animation: kenBurns1 24s ease-in-out infinite alternate;
    }
    .presentation-overlay.pres-animated .pres-bg-layer.kb2 { animation-name: kenBurns2; animation-duration: 28s; }
    .presentation-overlay.pres-animated .pres-bg-layer.kb3 { animation-name: kenBurns3; animation-duration: 22s; }
    .presentation-overlay.pres-animated .pres-bg-layer.kb4 { animation-name: kenBurns4; animation-duration: 26s; }
    .presentation-overlay.pres-animated .pres-bg-layer.kb5 { animation-name: kenBurns5; animation-duration: 30s; }
    .presentation-overlay.pres-animated .presentation-inner {
      position: relative; z-index: 2;
    }

    /* Ken Burns keyframes — cinematic slow pan/zoom */
    @keyframes kenBurns1 {
      0%   { transform: scale(1)   translate(0, 0); }
      100% { transform: scale(1.12) translate(3%, -2%); }
    }
    @keyframes kenBurns2 {
      0%   { transform: scale(1.1) translate(2%, 1%); }
      100% { transform: scale(1)    translate(-2%, -1%); }
    }
    @keyframes kenBurns3 {
      0%   { transform: scale(1)   translate(0, 2%); }
      100% { transform: scale(1.08) translate(1%, -3%); }
    }
    @keyframes kenBurns4 {
      0%   { transform: scale(1.1) translate(-1%, -2%); }
      100% { transform: scale(1)    translate(2%, 1%); }
    }
    @keyframes kenBurns5 {
      0%   { transform: scale(1); }
      100% { transform: scale(1.15); }
    }

    /* Floating cloud overlay animation */
    @keyframes cloudDrift {
      0%   { transform: translate(0, 0); }
      33%  { transform: translate(4%, 2%); }
      66%  { transform: translate(-3%, 1%); }
      100% { transform: translate(2%, -1%); }
    }

    /* Animated mode text colors (same as nature) */
    .presentation-overlay.pres-animated .presentation-ayah-text {
      color: #fff;
      text-shadow: 0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-animated .presentation-translation {
      color: rgba(255,255,255,0.85);
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-animated .presentation-title {
      color: rgba(255,255,255,0.8);
    }
    .presentation-overlay.pres-animated .presentation-ayah-num {
      color: #ffe066;
    }
    .presentation-overlay.pres-animated .presentation-header {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-animated .presentation-footer {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-animated .presentation-counter {
      color: rgba(255,255,255,0.7);
    }
    .presentation-overlay.pres-animated .presentation-header-btn,
    .presentation-overlay.pres-animated .presentation-close-btn {
      color: #fff; background: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-animated .presentation-header-btn:hover,
    .presentation-overlay.pres-animated .presentation-close-btn:hover {
      background: rgba(255,255,255,0.3);
    }

    .presentation-overlay.pres-light {
      background: #f5f0e8;
    }
    .presentation-overlay.pres-light .presentation-ayah-text {
      color: #1a1a1a;
    }
    .presentation-overlay.pres-nature .presentation-ayah-text,
    .presentation-overlay.pres-auto .presentation-ayah-text {
      color: #fff;
      text-shadow: 0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-nature .presentation-translation,
    .presentation-overlay.pres-auto .presentation-translation {
      color: rgba(255,255,255,0.85);
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-nature .presentation-title,
    .presentation-overlay.pres-auto .presentation-title {
      color: rgba(255,255,255,0.8);
    }
    .presentation-overlay.pres-nature .presentation-ayah-num,
    .presentation-overlay.pres-auto .presentation-ayah-num {
      color: #ffe066;
    }
    .presentation-overlay.pres-nature .presentation-header,
    .presentation-overlay.pres-auto .presentation-header {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-nature .presentation-footer,
    .presentation-overlay.pres-auto .presentation-footer {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-nature .presentation-counter,
    .presentation-overlay.pres-auto .presentation-counter {
      color: rgba(255,255,255,0.7);
    }
    .presentation-overlay.pres-nature .presentation-header-btn,
    .presentation-overlay.pres-auto .presentation-header-btn,
    .presentation-overlay.pres-nature .presentation-close-btn,
    .presentation-overlay.pres-auto .presentation-close-btn {
      color: #fff; background: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-nature .presentation-header-btn:hover,
    .presentation-overlay.pres-auto .presentation-header-btn:hover,
    .presentation-overlay.pres-nature .presentation-close-btn:hover,
    .presentation-overlay.pres-auto .presentation-close-btn:hover {
      background: rgba(255,255,255,0.3);
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

    /* ===== AUTO-HIDE CONTROL BUTTONS ===== */
    .pres-control-btn {
      opacity: 0;
      transition: opacity 0.5s ease, background 0.2s;
      pointer-events: none;
    }
    .presentation-overlay.pres-controls-visible .pres-control-btn {
      opacity: 1;
      pointer-events: auto;
    }
    .pres-control-btn.pres-tajweed-off {
      opacity: 0.5;
    }
    .presentation-overlay.pres-controls-visible .pres-control-btn.pres-tajweed-off {
      opacity: 0.5;
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
  if (!_presTajweedEnabled) return escapeHtml(txt);
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

/** Remove any animated background layer from the overlay. */
function removeAnimatedBgLayer(overlay: HTMLElement): void {
  const existing = overlay.querySelector('.pres-bg-layer');
  if (existing) existing.remove();
}

/** Create and insert the animated background image layer with a random Ken Burns effect. */
function applyAnimatedBg(overlay: HTMLElement, bgSrc: string): void {
  removeAnimatedBgLayer(overlay);
  const layer = document.createElement('div');
  layer.className = 'pres-bg-layer ' + getRandomKenBurns();
  layer.style.backgroundImage = `url('${bgSrc}')`;
  overlay.insertBefore(layer, overlay.firstChild);
}

/** Show presentation control buttons and reset auto-hide timer. */
function showControls(): void {
  const overlay = dom.presentationOverlay;
  if (!overlay) return;
  overlay.classList.add('pres-controls-visible');
  if (_hideControlsTimeout) clearTimeout(_hideControlsTimeout);
  _hideControlsTimeout = setTimeout(() => {
    hideControls();
  }, 3000);
}

/** Hide presentation control buttons. */
function hideControls(): void {
  const overlay = dom.presentationOverlay;
  if (!overlay) return;
  overlay.classList.remove('pres-controls-visible');
}

/** Update the play/pause button icon based on current audio state. */
function updatePresPlayPauseBtn(): void {
  const btn = dom.presPlayPauseBtn;
  if (!btn) return;
  btn.textContent = state.isPlaying ? '⏸' : '▶';
}

/** Toggle tajweed colors in presentation mode only. */
function togglePresTajweed(): void {
  _presTajweedEnabled = !_presTajweedEnabled;
  const btn = dom.presTajweedBtn;
  if (btn) {
    btn.classList.toggle('pres-tajweed-off', !_presTajweedEnabled);
  }
  updateDisplay();
}

/** Toggle fullscreen mode for the presentation overlay. */
function togglePresFullscreen(): void {
  const overlay = dom.presentationOverlay;
  if (!overlay) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    overlay.requestFullscreen().catch(() => {});
  }
}

/** Update the fullscreen button icon. */
function updatePresFullscreenBtn(): void {
  const btn = dom.presFullscreenBtn;
  if (!btn) return;
  btn.textContent = document.fullscreenElement ? '⛶' : '⛶';
}

function updateDisplay(): void {
  if (!state.presentationMode) return;

  // Apply background based on presBgMode setting
  const overlay = dom.presentationOverlay;
  if (overlay) {
    overlay.classList.remove('pres-nature', 'pres-auto', 'pres-animated');
    if (state.presBgMode === 'nature') {
      removeAnimatedBgLayer(overlay);
      const bg = getRandomNatureBg();
      overlay.style.backgroundImage = `url('${bg.src}')`;
      overlay.classList.add('pres-nature');
      overlay.classList.remove('pres-light');
    } else if (state.presBgMode === 'auto') {
      removeAnimatedBgLayer(overlay);
      const bg = getAutoBackground();
      overlay.style.backgroundImage = `url('${bg.src}')`;
      overlay.classList.add('pres-auto');
      overlay.classList.remove('pres-light');
    } else if (state.presBgMode === 'animated') {
      overlay.style.backgroundImage = 'none';
      const bg = getRandomNatureBg();
      applyAnimatedBg(overlay, bg.src);
      overlay.classList.add('pres-animated');
      overlay.classList.remove('pres-light');
    } else {
      removeAnimatedBgLayer(overlay);
      overlay.style.backgroundImage = '';
      if (!document.body.classList.contains('night-mode')) {
        overlay.classList.add('pres-light');
      }
    }
  }

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
  // Smooth crossfade transition: fade out → update already done above → fade in
  if (_prevHighlightTimeout) clearTimeout(_prevHighlightTimeout);
  const ayahEl = dom.presentationAyahText;
  if (ayahEl) {
    ayahEl.style.transition = 'opacity 0.4s ease';
    ayahEl.style.opacity = '0.7';
    _prevHighlightTimeout = setTimeout(() => {
      if (ayahEl) ayahEl.style.opacity = '1';
    }, 100);
  }
  // Update play/pause button state
  updatePresPlayPauseBtn();
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
  // Sync presentation tajweed with global setting on open
  _presTajweedEnabled = state.tajweedEnabled;
  injectStyles();
  if (dom.presentationOverlay) {
    dom.presentationOverlay.classList.remove('hidden');
    dom.presentationOverlay.style.display = '';
    // Background mode is handled by updateDisplay()
    if (state.presBgMode === 'plain') {
      if (document.body.classList.contains('night-mode')) {
        dom.presentationOverlay.classList.remove('pres-light');
      } else {
        dom.presentationOverlay.classList.add('pres-light');
      }
    }
  }
  // Set initial tajweed button state
  if (dom.presTajweedBtn) {
    dom.presTajweedBtn.classList.toggle('pres-tajweed-off', !_presTajweedEnabled);
  }
  document.body.classList.add('presentation-active');
  document.querySelectorAll('.view-mode-btn').forEach((b: Element) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.mode === 'presentation');
  });
  document.addEventListener('keydown', handleKeyDown);
  // Show controls initially, then auto-hide
  showControls();
  updateDisplay();
}

export function closePresentation(): void {
  state.presentationMode = false;
  // Exit fullscreen if active
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  if (dom.presentationOverlay) {
    dom.presentationOverlay.classList.add('hidden');
    dom.presentationOverlay.style.display = '';
    dom.presentationOverlay.classList.remove('pres-controls-visible');
    removeAnimatedBgLayer(dom.presentationOverlay);
  }
  if (_hideControlsTimeout) {
    clearTimeout(_hideControlsTimeout);
    _hideControlsTimeout = null;
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
  // Any key press shows controls
  showControls();
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
      updatePresPlayPauseBtn();
      break;
  }
}

/** Handle mouse/touch movement on presentation overlay — show controls. */
function handleOverlayMouseMove(): void {
  showControls();
}

/** Handle fullscreen change event — update button icon. */
function handleFullscreenChange(): void {
  updatePresFullscreenBtn();
}

export function syncPresentation(): void {
  if (state.presentationMode) {
    updateDisplay();
    updatePresPlayPauseBtn();
  }
}

export function initPresentation(): void {
  injectStyles();
  if (dom.presentationCloseBtn) dom.presentationCloseBtn.addEventListener('click', closePresentation);
  if (dom.presentationPrevBtn) dom.presentationPrevBtn.addEventListener('click', () => navigateAyah(-1));
  if (dom.presentationNextBtn) dom.presentationNextBtn.addEventListener('click', () => navigateAyah(1));
  dom.presentationOverlay?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.presentationOverlay) closePresentation();
  });

  // Play/Pause button
  if (dom.presPlayPauseBtn) {
    dom.presPlayPauseBtn.addEventListener('click', () => {
      togglePlayPause();
      updatePlayPauseBtn();
      updatePresPlayPauseBtn();
      showControls(); // Reset auto-hide timer
    });
  }

  // Tajweed toggle button (presentation-local)
  if (dom.presTajweedBtn) {
    dom.presTajweedBtn.addEventListener('click', () => {
      togglePresTajweed();
      showControls(); // Reset auto-hide timer
    });
  }

  // Fullscreen toggle button
  if (dom.presFullscreenBtn) {
    dom.presFullscreenBtn.addEventListener('click', () => {
      togglePresFullscreen();
      showControls(); // Reset auto-hide timer
    });
  }

  // Mouse/touch movement shows controls
  dom.presentationOverlay?.addEventListener('mousemove', handleOverlayMouseMove);
  dom.presentationOverlay?.addEventListener('touchstart', handleOverlayMouseMove, { passive: true });

  // Fullscreen change event
  document.addEventListener('fullscreenchange', handleFullscreenChange);
}
