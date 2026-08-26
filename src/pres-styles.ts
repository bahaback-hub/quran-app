import { buildColorMap, tajweedColorWord } from './tajweed.js';
import { getAyahAnnotations } from './tajweed-data.js';
import type { TajweedAnnotation } from './tajweed-data.js';
import { escapeHtml } from './utils.js';

/** Inject presentation-specific CSS styles into the document head (idempotent). */
export function injectStyles(): void {
  if (document.getElementById('pres-styles')) {
    return;
  }
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
    /* The shared .hidden helper uses display:none !important. This class must
       override it in every browser, not only in the Capacitor WebView rules. */
    .presentation-overlay.presentation-visible { display: flex !important; visibility: visible !important; }
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

    /* ===== VIDEO MODE =====
       The moving asset always stays behind an opaque enough contrast layer. */
    .presentation-overlay.pres-video {
      background-color: #162426;
      background-size: cover;
      background-position: center;
    }
    .presentation-overlay.pres-video .pres-video-bg {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      z-index: 0;
      pointer-events: none;
    }
    .presentation-overlay.pres-video::before {
      content: '';
      position: absolute; inset: 0;
      z-index: 1;
      background: linear-gradient(180deg, rgba(4, 11, 14, 0.62) 0%, rgba(7, 18, 19, 0.50) 44%, rgba(3, 8, 10, 0.70) 100%);
    }
    .presentation-overlay.pres-video .presentation-inner { position: relative; z-index: 2; }
    .presentation-overlay.pres-video .presentation-ayah-text {
      color: #fffdf5;
      text-shadow: 0 3px 20px rgba(0,0,0,0.9), 0 1px 5px rgba(0,0,0,0.75);
    }
    .presentation-overlay.pres-video .presentation-translation {
      color: rgba(255,253,245,0.9);
      text-shadow: 0 1px 7px rgba(0,0,0,0.75);
    }
    .presentation-overlay.pres-video .presentation-title,
    .presentation-overlay.pres-video .presentation-counter { color: rgba(255,253,245,0.82); }
    .presentation-overlay.pres-video .presentation-ayah-num { color: #f3cf72; }
    .presentation-overlay.pres-video .presentation-header,
    .presentation-overlay.pres-video .presentation-footer { border-color: rgba(255,255,255,0.18); }
    .presentation-overlay.pres-video .presentation-header-btn,
    .presentation-overlay.pres-video .presentation-close-btn { color: #fffdf5; background: rgba(8,18,18,0.46); }
    .presentation-overlay.pres-video .presentation-header-btn:hover,
    .presentation-overlay.pres-video .presentation-close-btn:hover { background: rgba(8,18,18,0.72); }
    .presentation-video-retry {
      position: absolute;
      z-index: 3;
      left: 50%;
      bottom: max(24px, env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      min-height: 44px;
      padding: 9px 16px;
      border: 1px solid rgba(243, 207, 114, 0.82);
      border-radius: 999px;
      background: rgba(7, 18, 19, 0.82);
      color: #fffdf5;
      box-shadow: 0 8px 24px rgba(0,0,0,0.36);
      font: 700 15px/1.2 system-ui, sans-serif;
      cursor: pointer;
    }
    .presentation-video-retry.hidden { display: none; }
    .presentation-video-retry:focus-visible { outline: 3px solid #f3cf72; outline-offset: 3px; }

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
    .presentation-share-preview {
      position: fixed; inset: 0; z-index: 100001;
      display: none; align-items: center; justify-content: center;
      padding: 20px; direction: rtl;
      background: rgba(5, 12, 16, 0.72); backdrop-filter: blur(12px);
      font-family: 'Amiri', 'Traditional Arabic', serif;
    }
    .presentation-share-preview:not(.hidden) { display: flex !important; }
    .presentation-share-preview-inner {
      width: min(420px, 100%); max-height: min(760px, calc(100vh - 40px));
      display: flex; flex-direction: column; gap: 14px;
      padding: 16px; border: 1px solid rgba(216, 178, 95, 0.58);
      background: #12201f; color: #fffaf0;
      box-shadow: 0 20px 62px rgba(0, 0, 0, 0.5);
    }
    .presentation-share-preview-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .presentation-share-preview-header h3 { margin: 0; color: #f7dd9e; font-size: 1.18rem; font-weight: 600; }
    .presentation-share-close, .presentation-share-secondary, .presentation-share-primary, .presentation-share-video, .presentation-share-video-download {
      border: 1px solid rgba(255,255,255,0.28); min-height: 42px; padding: 8px 13px;
      color: #fffaf0; background: rgba(255,255,255,0.08); font: inherit; cursor: pointer;
    }
    .presentation-share-primary { border-color: #e1c06e; background: #b98b25; color: #1d170c; font-weight: 700; }
    .presentation-share-video { border-color: rgba(165, 214, 201, 0.78); background: rgba(65, 132, 116, 0.32); color: #ecfff6; }
    .presentation-share-video-download { border-color: rgba(230, 198, 121, 0.72); background: rgba(125, 95, 35, 0.32); color: #fff7dc; }
    .presentation-share-primary:disabled, .presentation-share-secondary:disabled, .presentation-share-video:disabled, .presentation-share-video-download:disabled { opacity: 0.48; cursor: wait; }
    .presentation-share-image-wrap { min-height: 280px; display: grid; place-items: center; background: #0b1516; }
    .presentation-share-image-wrap img { display: block; width: auto; max-width: 100%; max-height: 440px; object-fit: contain; }
    .presentation-share-status { min-height: 1.5em; margin: 0; text-align: center; color: #efe2bd; font-size: 0.95rem; }
    .presentation-share-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .presentation-share-actions > button { flex: 1; }
    .presentation-share-actions > .presentation-share-video { flex-basis: 100%; }
    @media (max-width: 520px) {
      .presentation-share-preview { padding: 12px; }
      .presentation-share-preview-inner { padding: 14px; }
      .presentation-share-image-wrap img { max-height: 380px; }
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
      width: 100%; height: 100%; max-width: 1320px;
      padding: 20px; box-sizing: border-box;
    }
    .presentation-header {
      display: flex; align-items: center; gap: 10px; position: relative;
      min-height: 52px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .presentation-overlay.pres-light .presentation-header {
      border-color: rgba(0,0,0,0.1);
    }
    .presentation-nav-cluster,
    .presentation-actions {
      display: flex; align-items: center; gap: 6px;
    }
    .presentation-current-meta {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-width: 126px; max-width: 220px; gap: 2px; text-align: center;
    }
    .presentation-actions {
      position: relative; margin-inline-start: auto;
    }
    .presentation-title {
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 16px; color: var(--text-muted, #aaa); font-weight: 700;
    }
    .presentation-overlay.pres-light .presentation-title {
      color: #666;
    }
    .presentation-ayah-num {
      font-size: 13px; color: var(--accent, #ffe066); font-weight: 700;
    }
    .presentation-overlay.pres-light .presentation-ayah-num {
      color: #8b6f5a;
    }
    .presentation-header-btn, .presentation-close-btn {
      background: rgba(255,255,255,0.1); border: none;
      color: #fff; font-size: 18px; width: 40px; height: 40px; padding: 0;
      border-radius: 10px; cursor: pointer; transition: background 160ms ease-out, transform 160ms ease-out;
    }
    .presentation-overlay.pres-light .presentation-header-btn,
    .presentation-overlay.pres-light .presentation-close-btn {
      color: #333; background: rgba(0,0,0,0.08);
    }
    .presentation-header-btn:hover, .presentation-close-btn:hover {
      background: rgba(255,255,255,0.2);
    }
    .presentation-header-btn:active, .presentation-close-btn:active { transform: scale(0.97); }
    .presentation-header-btn:disabled {
      cursor: not-allowed; opacity: 0.32;
    }
    .presentation-surah-btn {
      border: 1px solid rgba(216, 178, 95, 0.28); color: #f8e1a0;
      background: rgba(216, 178, 95, 0.1); font-size: 15px;
    }
    .presentation-ayah-btn {
      width: 46px; color: #fffdf5; background: rgba(31, 91, 73, 0.7); font-size: 19px;
    }
    .presentation-overlay.pres-light .presentation-header-btn:hover,
    .presentation-overlay.pres-light .presentation-close-btn:hover {
      background: rgba(0,0,0,0.15);
    }
    .presentation-close-btn { color: #f8e1a0; }

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
    /* Close button ALWAYS visible — critical for mobile users to exit */
    .presentation-overlay .presentation-close-btn {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    /* Tajweed toggle always visible — important feature users need to discover */
    .presentation-overlay .pres-tajweed-btn {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    .presentation-overlay .pres-tajweed-btn.pres-tajweed-off {
      opacity: 0.5 !important;
    }
    .presentation-overlay .pres-background-btn {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    .presentation-background-picker {
      position: absolute;
      inset-inline-start: auto;
      inset-inline-end: 0;
      top: calc(100% + 10px);
      z-index: 12;
      width: min(344px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 14px;
      border: 1px solid rgba(216, 178, 95, 0.46);
      border-radius: 12px;
      background: rgba(9, 18, 27, 0.92);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.38);
      backdrop-filter: blur(12px);
      direction: rtl;
    }
    .presentation-background-picker.hidden { display: none; }
    .presentation-overlay.pres-light .presentation-background-picker {
      background: rgba(255, 252, 244, 0.94);
      border-color: rgba(139, 111, 90, 0.42);
    }
    .presentation-background-picker-title {
      margin: 0 0 10px;
      color: #f8e1a0;
      font-size: 15px;
      font-weight: 700;
    }
    .presentation-overlay.pres-light .presentation-background-picker-title { color: #755a3d; }
    .presentation-background-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
    }
    .presentation-background-options button {
      min-height: 38px;
      padding: 7px 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: #fffdf6;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .presentation-overlay.pres-light .presentation-background-options button {
      border-color: rgba(68, 50, 33, 0.16);
      background: rgba(68, 50, 33, 0.06);
      color: #3c3025;
    }
    .presentation-background-options button[aria-pressed="true"] {
      border-color: #d8b25f;
      background: rgba(216, 178, 95, 0.24);
      color: #fff4cc;
    }
    .presentation-overlay.pres-light .presentation-background-options button[aria-pressed="true"] {
      color: #4a351b;
      background: rgba(216, 178, 95, 0.28);
    }
    .presentation-background-options button:focus-visible {
      outline: 2px solid #f8e1a0;
      outline-offset: 2px;
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
      /* Keep Quranic Arabic words intact in Android WebView fullscreen. */
      word-break: normal;
      overflow-wrap: normal;
      hyphens: none;
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
      min-height: 0;
      padding: 40px 20px; overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }
    .presentation-ayah-text {
      font-size: 60px; line-height: 1.8; text-align: center;
      color: #fff; max-width: 900px;
      word-spacing: 6px;
      /* Quranic ayahs wrap at spaces only; never split an Arabic word. */
      font-size: clamp(24px, 6vw, 60px);
      white-space: normal;
      overflow-wrap: normal;
      word-break: normal;
      hyphens: none;
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
      .presentation-ayah-text { font-size: clamp(22px, 5.5vw, 32px); }
      .presentation-body { padding: 16px 10px; overflow-y: hidden !important; }
      .presentation-translation { font-size: 16px; margin-top: 12px; }
      /* Mobile keeps the title, navigation and utilities in three clear rows. */
      .presentation-header {
        display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 6px 2px;
      }
      .presentation-current-meta { grid-column: 1 / -1; grid-row: 1; max-width: none; min-width: 0; }
      .presentation-title { font-size: 13px; }
      .presentation-ayah-num { font-size: 12px; }
      .presentation-surah-nav { grid-column: 1; grid-row: 2; justify-content: flex-start; }
      .presentation-ayah-nav { grid-column: 2; grid-row: 2; justify-content: flex-end; }
      .presentation-actions {
        grid-column: 1 / -1; grid-row: 3; margin-inline-start: 0; justify-content: center;
        max-width: 100%; overflow-x: auto; scrollbar-width: none;
      }
      .presentation-actions::-webkit-scrollbar { display: none; }
      .presentation-header-btn, .presentation-close-btn {
        width: 36px; height: 36px; font-size: 16px; border-radius: 8px; flex: 0 0 auto;
      }
      .presentation-ayah-btn { width: 42px; font-size: 18px; }
      .presentation-surah-btn { font-size: 14px; }
      .presentation-background-picker {
        inset-inline-start: auto;
        inset-inline-end: 0;
        top: calc(100% + 6px);
        width: min(320px, calc(100vw - 24px));
        padding: 10px;
      }
      .presentation-background-picker-title { margin-bottom: 8px; }
      .presentation-background-options { gap: 6px; }
      .presentation-background-options button { min-height: 36px; font-size: 13px; }
      .presentation-footer { padding: 6px 0; }
      .presentation-counter { font-size: 13px; }
      /* Ensure body can scroll for long ayahs */
      .presentation-inner {
        padding: 8px !important;
      }
    }

    /* ===== MOBILE: SHRINK BACKGROUND IMAGE INTO A FRAMED PICTURE ===== */
    /* On phones, the full-bleed nature image (background-size: cover) dominates
       the whole screen. Instead, show it as a smaller centered framed picture
       while keeping the ayah text readable above it. */
    @media (max-width: 600px) {
      .presentation-overlay.pres-nature,
      .presentation-overlay.pres-auto {
        background-size: 0;
        background-repeat: no-repeat;
        background-color: #14141f;
      }
      .presentation-overlay.pres-nature::after,
      .presentation-overlay.pres-auto::after {
        content: '';
        position: absolute;
        inset: 14vh 4vw;
        z-index: 0;
        pointer-events: none;
        background-image: inherit;
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        background-color: rgba(0, 0, 0, 0.3);
        background-blend-mode: multiply;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55);
      }
      /* Animated mode: frame the moving background layer instead of full-bleed */
      .presentation-overlay.pres-animated .pres-bg-layer {
        inset: 14vh 4vw;
        background-size: contain;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55);
      }

      /* Fullscreen is an immersive reading surface, not a framed preview. */
      .presentation-overlay:fullscreen.pres-nature,
      .presentation-overlay:fullscreen.pres-auto {
        background-size: cover;
      }
      .presentation-overlay:fullscreen.pres-nature::after,
      .presentation-overlay:fullscreen.pres-auto::after {
        content: none;
      }
      .presentation-overlay:fullscreen.pres-animated .pres-bg-layer {
        inset: 0;
        background-size: cover;
        border-radius: 0;
        border: 0;
        box-shadow: none;
      }
    }
    @media (min-width: 1200px) {
      .presentation-ayah-text { font-size: 72px; }
    }
  `;
  document.head.appendChild(style);
}

/** Build the HTML string for an ayah, optionally applying tajweed coloring.
 *  @param tajweedEnabled — whether tajweed coloring is active (presentation-local toggle). */
export function buildAyahHtml(text: string, surahNum: number, ayahNum: number, tajweedEnabled: boolean): string {
  let txt = text;
  let offsetAdj = 0;
  if (surahNum !== 1 && ayahNum === 1) {
    const stripped = txt.replace(
      /^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u,
      '',
    );
    offsetAdj = txt.length - stripped.length;
    txt = stripped;
  }
  if (!tajweedEnabled) {
    return escapeHtml(txt);
  }
  const annotations = getAyahAnnotations(surahNum, ayahNum);
  if (annotations.length === 0) {
    return escapeHtml(txt);
  }
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
    .map((word: string, idx: number) => {
      const wordHtml = tajweedColorWord(word, outputPos, colorMap);
      outputPos += word.length + (idx < words.length - 1 ? 1 : 0); // +1 for space between words
      return wordHtml;
    })
    .join(' ');
}
