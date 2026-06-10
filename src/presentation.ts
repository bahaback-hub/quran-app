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

/** Animation frame ID for canvas scene rendering. */
let _sceneAnimationId: number | null = null;

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

    /* ===== SCENE MODE (Canvas Animated Background) ===== */
    .presentation-overlay.pres-scene {
      background: #0a0a1a;
    }
    .presentation-overlay.pres-scene .pres-canvas-bg {
      position: absolute; inset: 0;
      z-index: 0;
      width: 100%; height: 100%;
    }
    .presentation-overlay.pres-scene::before {
      content: '';
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.15);
      z-index: 1;
    }
    .presentation-overlay.pres-scene .presentation-inner {
      position: relative; z-index: 2;
    }
    .presentation-overlay.pres-scene .presentation-ayah-text {
      color: #fff;
      text-shadow: 0 2px 16px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6);
    }
    .presentation-overlay.pres-scene .presentation-translation {
      color: rgba(255,255,255,0.85);
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-scene .presentation-title {
      color: rgba(255,255,255,0.8);
    }
    .presentation-overlay.pres-scene .presentation-ayah-num {
      color: #ffe066;
    }
    .presentation-overlay.pres-scene .presentation-header {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-scene .presentation-footer {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-scene .presentation-counter {
      color: rgba(255,255,255,0.7);
    }
    .presentation-overlay.pres-scene .presentation-header-btn,
    .presentation-overlay.pres-scene .presentation-close-btn {
      color: #fff; background: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-scene .presentation-header-btn:hover,
    .presentation-overlay.pres-scene .presentation-close-btn:hover {
      background: rgba(255,255,255,0.3);
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
    .presentation-overlay.pres-controls-visible .pres-control-btn.pres-tajweed-off {
      opacity: 0.5;
    }

    /* ===== FULLSCREEN: HIDE ALL UI, SHOW ONLY AYAH ===== */
    .presentation-overlay:fullscreen .presentation-header,
    .presentation-overlay:fullscreen .presentation-footer,
    .presentation-overlay:fullscreen .presentation-translation {
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    }
    .presentation-overlay:fullscreen.pres-controls-visible .presentation-header,
    .presentation-overlay:fullscreen.pres-controls-visible .presentation-footer {
      opacity: 1;
      pointer-events: auto;
    }
    .presentation-overlay:fullscreen .presentation-body {
      justify-content: center;
    }
    .presentation-overlay:fullscreen .presentation-ayah-text {
      font-size: 80px;
    }
    @media (max-width: 600px) {
      .presentation-overlay:fullscreen .presentation-ayah-text { font-size: 40px; }
    }
    @media (min-width: 1200px) {
      .presentation-overlay:fullscreen .presentation-ayah-text { font-size: 90px; }
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

/* ===== CANVAS ANIMATED SCENES ===== */

/** Remove the scene canvas and stop its animation loop. */
function removeSceneCanvas(overlay: HTMLElement): void {
  if (_sceneAnimationId !== null) {
    cancelAnimationFrame(_sceneAnimationId);
    _sceneAnimationId = null;
  }
  const existing = overlay.querySelector('.pres-canvas-bg');
  if (existing) {
    // Clean up resize listener
    const cleanup = (existing as unknown as Record<string, unknown>)._cleanupResize;
    if (typeof cleanup === 'function') {
      window.removeEventListener('resize', cleanup as EventListener);
    }
    existing.remove();
  }
}

/** Star data for the stars scene. */
interface StarData {
  x: number; y: number;
  size: number; speed: number;
  brightness: number; phase: number;
}

/** Shooting star data. */
interface ShootingStar {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  length: number;
}

/** Wave layer data for the waves scene. */
interface WaveLayer {
  amplitude: number; frequency: number;
  speed: number; yBase: number;
  color: string;
}

/** Particle data for the particles scene. */
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; opacity: number;
  phase: number;
}

/** Rain drop data. */
interface RainDrop {
  x: number; y: number;
  speed: number; length: number;
  opacity: number;
}

/** Star scene — twinkling stars with occasional shooting stars. */
function renderStarsScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let stars: StarData[] = [];
  let shootingStars: ShootingStar[] = [];
  let time = 0;

  function init(): void {
    const w = canvas.width;
    const h = canvas.height;
    stars = [];
    for (let i = 0; i < 250; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 2.5 + 0.5,
        speed: Math.random() * 0.02 + 0.005,
        brightness: Math.random(),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  init();

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Dark sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#05050f');
    grad.addColorStop(0.5, '#0a0a2e');
    grad.addColorStop(1, '#101030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Milky way band
    const mwGrad = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.6);
    mwGrad.addColorStop(0, 'rgba(60, 50, 80, 0)');
    mwGrad.addColorStop(0.3, 'rgba(80, 60, 120, 0.06)');
    mwGrad.addColorStop(0.5, 'rgba(100, 80, 140, 0.08)');
    mwGrad.addColorStop(0.7, 'rgba(80, 60, 120, 0.06)');
    mwGrad.addColorStop(1, 'rgba(60, 50, 80, 0)');
    ctx.fillStyle = mwGrad;
    ctx.fillRect(0, 0, w, h);

    // Draw twinkling stars
    for (const star of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * star.speed * 60 + star.phase);
      const alpha = star.brightness * twinkle;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * (0.7 + 0.3 * twinkle), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 240, ${alpha})`;
      ctx.fill();
      // Glow for bigger stars
      if (star.size > 1.8) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 200, 255, ${alpha * 0.1})`;
        ctx.fill();
      }
    }

    // Shooting stars
    if (Math.random() < 0.003) {
      shootingStars.push({
        x: Math.random() * w * 0.8,
        y: Math.random() * h * 0.3,
        vx: 4 + Math.random() * 4,
        vy: 2 + Math.random() * 2,
        life: 0,
        maxLife: 30 + Math.random() * 30,
        length: 40 + Math.random() * 60,
      });
    }
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i];
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life++;
      const alpha = 1 - ss.life / ss.maxLife;
      if (alpha <= 0) { shootingStars.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x - ss.vx * ss.length / 6, ss.y - ss.vy * ss.length / 6);
      const ssGrad = ctx.createLinearGradient(
        ss.x, ss.y,
        ss.x - ss.vx * ss.length / 6, ss.y - ss.vy * ss.length / 6
      );
      ssGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      ssGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
      ctx.strokeStyle = ssGrad;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => { if (_sceneAnimationId !== null) { cancelAnimationFrame(_sceneAnimationId); _sceneAnimationId = null; } };
}

/** Ocean waves scene — animated waves with gradient sky. */
function renderWavesScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let time = 0;

  const waveLayers: WaveLayer[] = [
    { amplitude: 25, frequency: 0.008, speed: 0.4, yBase: 0.45, color: 'rgba(10, 60, 120, 0.4)' },
    { amplitude: 20, frequency: 0.012, speed: 0.6, yBase: 0.52, color: 'rgba(15, 80, 160, 0.5)' },
    { amplitude: 18, frequency: 0.015, speed: 0.8, yBase: 0.58, color: 'rgba(20, 100, 180, 0.6)' },
    { amplitude: 15, frequency: 0.02, speed: 1.0, yBase: 0.64, color: 'rgba(25, 120, 200, 0.7)' },
    { amplitude: 12, frequency: 0.025, speed: 1.3, yBase: 0.70, color: 'rgba(30, 140, 210, 0.8)' },
    { amplitude: 8, frequency: 0.03, speed: 1.6, yBase: 0.78, color: 'rgba(35, 150, 220, 0.85)' },
    { amplitude: 5, frequency: 0.04, speed: 2.0, yBase: 0.85, color: 'rgba(40, 160, 230, 0.9)' },
  ];

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Sky gradient (sunset-like)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGrad.addColorStop(0, '#0d1b2a');
    skyGrad.addColorStop(0.3, '#1b2838');
    skyGrad.addColorStop(0.6, '#2d4059');
    skyGrad.addColorStop(0.85, '#4a6741');
    skyGrad.addColorStop(1, '#7a8450');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Moon glow
    const moonX = w * 0.75;
    const moonY = h * 0.15;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 120);
    moonGlow.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
    moonGlow.addColorStop(0.3, 'rgba(255, 255, 200, 0.08)');
    moonGlow.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(0, 0, w, h);

    // Moon
    ctx.beginPath();
    ctx.arc(moonX, moonY, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 220, 0.9)';
    ctx.fill();

    // Draw waves back to front
    for (const wave of waveLayers) {
      ctx.beginPath();
      const baseY = h * wave.yBase;
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const y = baseY + Math.sin(x * wave.frequency + time * wave.speed) * wave.amplitude
          + Math.sin(x * wave.frequency * 0.5 + time * wave.speed * 0.7) * wave.amplitude * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = wave.color;
      ctx.fill();
    }

    // Foam/sparkles on top wave
    for (let i = 0; i < 30; i++) {
      const fx = (i / 30) * w + Math.sin(time * 0.5 + i) * 20;
      const fy = h * 0.44 + Math.sin(fx * 0.008 + time * 0.4) * 25 - 5;
      const sparkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 2 + i * 0.5));
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${sparkle * 0.5})`;
      ctx.fill();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => { if (_sceneAnimationId !== null) { cancelAnimationFrame(_sceneAnimationId); _sceneAnimationId = null; } };
}

/** Aurora scene — northern lights effect. */
function renderAuroraScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let time = 0;

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Dark sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#020810');
    skyGrad.addColorStop(0.4, '#050d1a');
    skyGrad.addColorStop(0.7, '#081020');
    skyGrad.addColorStop(1, '#0c1525');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (let i = 0; i < 80; i++) {
      const sx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * w;
      const sy = (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * h * 0.6;
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 0.5 + i));
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 240, ${twinkle * 0.6})`;
      ctx.fill();
    }

    // Aurora bands — multiple semi-transparent curved shapes
    const auroraColors = [
      { r: 50, g: 255, b: 100 },  // green
      { r: 80, g: 200, b: 255 },  // blue
      { r: 150, g: 100, b: 255 }, // purple
      { r: 50, g: 255, b: 180 },  // teal
    ];

    for (let band = 0; band < 4; band++) {
      const color = auroraColors[band];
      const yCenter = h * (0.15 + band * 0.1);
      const bandWidth = h * 0.15;

      ctx.beginPath();
      ctx.moveTo(0, yCenter);

      for (let x = 0; x <= w; x += 5) {
        const wave1 = Math.sin(x * 0.003 + time * 0.3 + band * 1.5) * 40;
        const wave2 = Math.sin(x * 0.006 + time * 0.5 + band * 0.8) * 25;
        const wave3 = Math.sin(x * 0.001 + time * 0.15 + band * 2.0) * 60;
        const y = yCenter + wave1 + wave2 + wave3;
        ctx.lineTo(x, y);
      }

      for (let x = w; x >= 0; x -= 5) {
        const wave1 = Math.sin(x * 0.003 + time * 0.3 + band * 1.5) * 40;
        const wave2 = Math.sin(x * 0.006 + time * 0.5 + band * 0.8) * 25;
        const wave3 = Math.sin(x * 0.001 + time * 0.15 + band * 2.0) * 60;
        const y = yCenter + wave1 + wave2 + wave3 + bandWidth;
        ctx.lineTo(x, y);
      }

      ctx.closePath();

      const aGrad = ctx.createLinearGradient(0, yCenter - bandWidth, 0, yCenter + bandWidth * 2);
      aGrad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      aGrad.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`);
      aGrad.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.12)`);
      aGrad.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`);
      aGrad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      ctx.fillStyle = aGrad;
      ctx.fill();
    }

    // Vertical aurora rays
    for (let i = 0; i < 20; i++) {
      const rx = (i / 20) * w + Math.sin(time * 0.3 + i * 2) * 50;
      const rayHeight = 100 + Math.sin(time * 0.5 + i) * 50;
      const rayAlpha = 0.03 + 0.04 * Math.abs(Math.sin(time * 0.8 + i * 0.7));
      const colorIdx = i % auroraColors.length;
      const c = auroraColors[colorIdx];

      const rayGrad = ctx.createLinearGradient(rx, h * 0.1, rx, h * 0.1 + rayHeight);
      rayGrad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
      rayGrad.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, ${rayAlpha})`);
      rayGrad.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);

      ctx.beginPath();
      ctx.moveTo(rx - 15, h * 0.1);
      ctx.lineTo(rx + 15, h * 0.1);
      ctx.lineTo(rx + 5, h * 0.1 + rayHeight);
      ctx.lineTo(rx - 5, h * 0.1 + rayHeight);
      ctx.closePath();
      ctx.fillStyle = rayGrad;
      ctx.fill();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => { if (_sceneAnimationId !== null) { cancelAnimationFrame(_sceneAnimationId); _sceneAnimationId = null; } };
}

/** Golden particles scene — floating dust motes. */
function renderParticlesScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let time = 0;
  let particles: Particle[] = [];

  function init(): void {
    const w = canvas.width;
    const h = canvas.height;
    particles = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.5 - 0.1,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  init();

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Dark warm background
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.7);
    bgGrad.addColorStop(0, '#1a1510');
    bgGrad.addColorStop(0.5, '#0f0d08');
    bgGrad.addColorStop(1, '#080604');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Warm light source glow
    const lightGlow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.4);
    lightGlow.addColorStop(0, 'rgba(255, 200, 100, 0.08)');
    lightGlow.addColorStop(0.5, 'rgba(255, 180, 80, 0.03)');
    lightGlow.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = lightGlow;
    ctx.fillRect(0, 0, w, h);

    // Draw and update particles
    for (const p of particles) {
      p.x += p.vx + Math.sin(time + p.phase) * 0.2;
      p.y += p.vy;

      // Wrap around
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      const pulse = 0.6 + 0.4 * Math.sin(time * 1.5 + p.phase);
      const alpha = p.opacity * pulse;

      // Glow
      const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
      glowGrad.addColorStop(0, `rgba(255, 210, 100, ${alpha * 0.5})`);
      glowGrad.addColorStop(1, 'rgba(255, 180, 50, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(p.x - p.size * 4, p.y - p.size * 4, p.size * 8, p.size * 8);

      // Core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 220, 120, ${alpha})`;
      ctx.fill();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => { if (_sceneAnimationId !== null) { cancelAnimationFrame(_sceneAnimationId); _sceneAnimationId = null; } };
}

/** Rain scene — falling rain with lightning. */
function renderRainScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let time = 0;
  let drops: RainDrop[] = [];
  let lightningAlpha = 0;
  let nextLightning = 200 + Math.random() * 400;

  function init(): void {
    const w = canvas.width;
    const h = canvas.height;
    drops = [];
    for (let i = 0; i < 200; i++) {
      drops.push({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 8 + Math.random() * 8,
        length: 15 + Math.random() * 20,
        opacity: 0.1 + Math.random() * 0.3,
      });
    }
  }
  init();

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Stormy sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0a0c12');
    skyGrad.addColorStop(0.3, '#111520');
    skyGrad.addColorStop(0.6, '#1a1e2e');
    skyGrad.addColorStop(1, '#0d1018');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Lightning flash
    if (time * 60 > nextLightning) {
      lightningAlpha = 0.6;
      nextLightning = time * 60 + 200 + Math.random() * 500;
    }
    if (lightningAlpha > 0) {
      ctx.fillStyle = `rgba(180, 190, 255, ${lightningAlpha})`;
      ctx.fillRect(0, 0, w, h);
      lightningAlpha *= 0.85;
      if (lightningAlpha < 0.01) lightningAlpha = 0;
    }

    // Cloud layer
    for (let i = 0; i < 5; i++) {
      const cx = (i / 5) * w + Math.sin(time * 0.1 + i * 3) * 40;
      const cy = h * 0.05 + Math.sin(time * 0.05 + i) * 20;
      const cw = 200 + Math.sin(i * 7.3) * 80;
      const ch = 60 + Math.sin(i * 4.1) * 20;
      const cloudGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw * 0.5);
      cloudGrad.addColorStop(0, 'rgba(30, 35, 50, 0.6)');
      cloudGrad.addColorStop(1, 'rgba(20, 25, 35, 0)');
      ctx.fillStyle = cloudGrad;
      ctx.fillRect(cx - cw, cy - ch, cw * 2, ch * 2);
    }

    // Rain drops
    ctx.lineCap = 'round';
    for (const d of drops) {
      d.y += d.speed;
      d.x -= 1; // Slight wind

      if (d.y > h) {
        d.y = -d.length;
        d.x = Math.random() * w;
      }
      if (d.x < -20) d.x = w + 20;

      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 1.5, d.y + d.length);
      ctx.strokeStyle = `rgba(150, 170, 220, ${d.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Splash effects at bottom
    for (let i = 0; i < 15; i++) {
      const sx = (Math.sin(time * 3 + i * 17.3) * 0.5 + 0.5) * w;
      const sy = h - 10 - Math.random() * 5;
      const splashAlpha = 0.2 + 0.2 * Math.abs(Math.sin(time * 5 + i * 3.7));
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150, 170, 220, ${splashAlpha})`;
      ctx.fill();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => { if (_sceneAnimationId !== null) { cancelAnimationFrame(_sceneAnimationId); _sceneAnimationId = null; } };
}

/** Map of scene ID to its render function. */
const SCENE_RENDERERS: Record<string, (canvas: HTMLCanvasElement) => () => void> = {
  stars: renderStarsScene,
  waves: renderWavesScene,
  aurora: renderAuroraScene,
  particles: renderParticlesScene,
  rain: renderRainScene,
};

/** Start a canvas scene animation on the given overlay. */
function startSceneAnimation(overlay: HTMLElement, sceneId: string): void {
  removeSceneCanvas(overlay);
  const canvas = document.createElement('canvas');
  canvas.className = 'pres-canvas-bg';
  canvas.dataset.scene = sceneId;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  overlay.insertBefore(canvas, overlay.firstChild);

  const renderer = SCENE_RENDERERS[sceneId];
  if (renderer) {
    renderer(canvas);
  }

  // Handle resize
  const onResize = (): void => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', onResize);
  // Store cleanup reference on the canvas element
  (canvas as unknown as Record<string, unknown>)._cleanupResize = onResize;
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
    overlay.classList.remove('pres-nature', 'pres-auto', 'pres-animated', 'pres-scene');
    if (state.presBgMode === 'nature') {
      removeAnimatedBgLayer(overlay);
      removeSceneCanvas(overlay);
      const bg = getRandomNatureBg();
      overlay.style.backgroundImage = `url('${bg.src}')`;
      overlay.classList.add('pres-nature');
      overlay.classList.remove('pres-light');
    } else if (state.presBgMode === 'auto') {
      removeAnimatedBgLayer(overlay);
      removeSceneCanvas(overlay);
      const bg = getAutoBackground();
      overlay.style.backgroundImage = `url('${bg.src}')`;
      overlay.classList.add('pres-auto');
      overlay.classList.remove('pres-light');
    } else if (state.presBgMode === 'animated') {
      removeSceneCanvas(overlay);
      overlay.style.backgroundImage = 'none';
      const bg = getRandomNatureBg();
      applyAnimatedBg(overlay, bg.src);
      overlay.classList.add('pres-animated');
      overlay.classList.remove('pres-light');
    } else if (state.presBgMode === 'scene') {
      removeAnimatedBgLayer(overlay);
      overlay.style.backgroundImage = 'none';
      // Only recreate canvas if scene changed or not running
      const existingCanvas = overlay.querySelector('.pres-canvas-bg') as HTMLCanvasElement | null;
      const currentScene = existingCanvas?.dataset.scene;
      if (!existingCanvas || currentScene !== state.presBgScene) {
        startSceneAnimation(overlay, state.presBgScene);
      }
      overlay.classList.add('pres-scene');
      overlay.classList.remove('pres-light');
    } else {
      removeAnimatedBgLayer(overlay);
      removeSceneCanvas(overlay);
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
    removeSceneCanvas(dom.presentationOverlay);
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
      // If in fullscreen, only exit fullscreen — don't close presentation
      if (document.fullscreenElement) {
        e.preventDefault();
        document.exitFullscreen().catch(() => {});
      } else {
        closePresentation();
      }
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

/** Handle fullscreen change event — update button icon and resize canvas. */
function handleFullscreenChange(): void {
  updatePresFullscreenBtn();
  // Resize canvas scene if active
  const overlay = dom.presentationOverlay;
  if (overlay && state.presBgMode === 'scene') {
    const canvas = overlay.querySelector('.pres-canvas-bg') as HTMLCanvasElement | null;
    if (canvas) {
      setTimeout(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }, 100);
    }
  }
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
    // Don't close on background click when in fullscreen
    if (e.target === dom.presentationOverlay && !document.fullscreenElement) closePresentation();
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
