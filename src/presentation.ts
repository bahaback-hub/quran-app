import { __ } from './i18n.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { togglePlayPause, updatePlayPauseBtn, playCurrentAyah } from './audio.js';
import { highlightCurrentAyah } from './surah-loader.js';
import { getFullscreenElement, requestFullscreen, exitFullscreen, isFullscreen } from './types.js';
import type { SurahDataLike, TranslationDataLike } from './types.js';
import {
  getAutoBackground,
  getNatureBgByMood,
  getRandomNatureBg,
  removeAnimatedBgLayer,
  applyAnimatedBg,
  removeSceneCanvas,
  startSceneAnimation,
} from './pres-backgrounds.js';
import { injectStyles, buildAyahHtml } from './pres-styles.js';

let _prevHighlightTimeout: ReturnType<typeof setTimeout> | null = null;

/** Presentation-local tajweed toggle — independent of the global setting. */
let _presTajweedEnabled = true;

/** Timeout for auto-hiding presentation controls. */
let _hideControlsTimeout: ReturnType<typeof setTimeout> | null = null;

/** Show presentation control buttons and reset auto-hide timer. */
function showControls(): void {
  const overlay = dom.presentationOverlay;
  if (!overlay) {
    return;
  }
  overlay.classList.add('pres-controls-visible');
  if (_hideControlsTimeout) {
    clearTimeout(_hideControlsTimeout);
  }
  _hideControlsTimeout = setTimeout(() => {
    hideControls();
  }, 3000);
}

/** Hide presentation control buttons. */
function hideControls(): void {
  const overlay = dom.presentationOverlay;
  if (!overlay) {
    return;
  }
  overlay.classList.remove('pres-controls-visible');
}

/** Update the play/pause button icon based on current audio state. */
function updatePresPlayPauseBtn(): void {
  const btn = dom.presPlayPauseBtn;
  if (!btn) {
    return;
  }
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
  if (!overlay) {
    return;
  }
  const fsElement = getFullscreenElement();
  if (fsElement) {
    exitFullscreen().catch(() => {
      /* noop */
    });
  } else {
    requestFullscreen(overlay).catch(() => {
      /* noop */
    });
  }
}

/** Update the fullscreen button icon. */
function updatePresFullscreenBtn(): void {
  const btn = dom.presFullscreenBtn;
  if (!btn) {
    return;
  }
  btn.textContent = isFullscreen() ? '⤓' : '⛶';
}

function updateDisplay(): void {
  if (!state.presentationMode) {
    return;
  }

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
    } else if (state.presBgMode === 'singleNature') {
      removeAnimatedBgLayer(overlay);
      removeSceneCanvas(overlay);
      const bg = getNatureBgByMood(state.presBgNature) || getRandomNatureBg();
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
      const currentScene = existingCanvas?.dataset['scene'];
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

  const surahData = state.surahData as SurahDataLike | null;
  const ayah = surahData?.ayahs?.[state.currentAyahIndex];
  if (!ayah) {
    if (dom.presentationAyahText) {
      dom.presentationAyahText.textContent = '—';
    }
    if (dom.presentationAyahNum) {
      dom.presentationAyahNum.textContent = '—';
    }
    if (dom.presentationTitle) {
      dom.presentationTitle.textContent = '—';
    }
    if (dom.presentationCounter) {
      dom.presentationCounter.textContent = __('pres_counter_zero');
    }
    if (dom.presentationTranslation) {
      dom.presentationTranslation.style.display = 'none';
    }
    return;
  }
  if (dom.presentationAyahText) {
    dom.presentationAyahText.innerHTML = buildAyahHtml(
      ayah.text,
      state.currentSurah,
      ayah.numberInSurah,
      _presTajweedEnabled,
    );
  }

  // Dynamic font size for long ayahs on mobile — shrink if text overflows
  if (dom.presentationAyahText) {
    const el = dom.presentationAyahText;
    const textLen = ayah.text.length;
    // On small screens, reduce font size for long ayahs
    if (window.innerWidth <= 600) {
      if (textLen > 300) {
        el.style.fontSize = 'clamp(18px, 4vw, 22px)';
      } else if (textLen > 200) {
        el.style.fontSize = 'clamp(20px, 4.5vw, 26px)';
      } else {
        el.style.fontSize = ''; // use CSS default
      }
    } else {
      el.style.fontSize = ''; // use CSS default on larger screens
    }
  }
  if (dom.presentationAyahNum) {
    dom.presentationAyahNum.textContent = String(ayah.numberInSurah);
  }
  const surahName = surahData?.name || '';
  if (dom.presentationTitle) {
    dom.presentationTitle.textContent = `${surahName} — ${__('ayah')} ${ayah.numberInSurah}`;
  }
  const total = surahData?.ayahs?.length || 0;
  if (dom.presentationCounter) {
    dom.presentationCounter.textContent = `${ayah.numberInSurah} / ${total}`;
  }
  const translationData = state.translationData as TranslationDataLike | null;
  if (state.translationEnabled && translationData?.ayahs?.[state.currentAyahIndex]) {
    if (dom.presentationTranslation) {
      dom.presentationTranslation.textContent = translationData.ayahs[state.currentAyahIndex]!.text;
      dom.presentationTranslation.style.display = '';
    }
  } else {
    if (dom.presentationTranslation) {
      dom.presentationTranslation.style.display = 'none';
    }
  }
  // Smooth crossfade transition: fade out → update already done above → fade in
  if (_prevHighlightTimeout) {
    clearTimeout(_prevHighlightTimeout);
  }
  const ayahEl = dom.presentationAyahText;
  if (ayahEl) {
    ayahEl.style.transition = 'opacity 0.4s ease';
    ayahEl.style.opacity = '0.7';
    _prevHighlightTimeout = setTimeout(() => {
      if (ayahEl) {
        ayahEl.style.opacity = '1';
      }
    }, 100);
  }
  // Update play/pause button state
  updatePresPlayPauseBtn();
}

function navigateAyah(delta: number): void {
  const surahData = state.surahData as SurahDataLike | null;
  if (!surahData?.ayahs) {
    return;
  }
  const next = state.currentAyahIndex + delta;
  if (next < 0 || next >= surahData.ayahs.length) {
    return;
  }
  state.currentAyahIndex = next;
  updateDisplay();
  // Sync audio: play the new ayah if audio was already playing
  if (state.isPlaying) {
    playCurrentAyah();
  }
  // Sync main surah view highlight
  highlightCurrentAyah();
  if (dom.presentationOverlay) {
    const pBody = dom.presentationBody;
    if (pBody) {
      pBody.scrollTop = 0;
    }
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
  console.warn('[Presentation] openPresentation() called, mushafMode=' + state.mushafMode);

  // If in mushaf mode, toggle it off SYNCHRONOUSLY before showing presentation.
  // We set the state directly instead of using the async toggleMushafMode to avoid
  // race conditions where the toggle happens after the overlay is already shown.
  if (state.mushafMode) {
    console.warn('[Presentation] Exiting mushaf mode synchronously before opening presentation');
    state.mushafMode = false;
    storage.set('mushaf_mode', false);
    if (dom.pageIndicator) {
      dom.pageIndicator.style.display = 'none';
    }
    // Update view mode buttons to show surah mode (not mushaf)
    document.querySelectorAll('.view-mode-btn').forEach((b: Element) => {
      b.classList.toggle('active', (b as HTMLElement).dataset['mode'] === 'surah');
    });
    // Re-render the surah content in the background (async, non-blocking)
    import('./app.js')
      .then(({ renderSurah }) => {
        const surahData = state.surahData;
        if (surahData && surahData.number === state.currentSurah) {
          renderSurah(surahData);
        }
      })
      .catch(() => {
        /* noop */
      });
  }

  state.presentationMode = true;
  // Sync presentation tajweed with global setting on open
  _presTajweedEnabled = state.tajweedEnabled;
  injectStyles();
  if (dom.presentationOverlay) {
    // CRITICAL: For Android WebView (Capacitor), we use a special CSS class
    // `presentation-visible` that overrides `.hidden { display: none !important }`
    // with `display: flex !important` — this is the ONLY reliable way to make
    // the overlay visible in WebView because inline styles can lose to !important.
    dom.presentationOverlay.classList.remove('hidden');
    dom.presentationOverlay.classList.add('presentation-visible');
    // Also set inline styles as fallback for non-Capacitor browsers
    dom.presentationOverlay.style.display = 'flex';
    dom.presentationOverlay.style.position = 'fixed';
    dom.presentationOverlay.style.inset = '0';
    dom.presentationOverlay.style.zIndex = '99999';
    dom.presentationOverlay.style.width = '100vw';
    dom.presentationOverlay.style.height = '100vh';
    // Background mode is handled by updateDisplay()
    if (state.presBgMode === 'plain') {
      if (document.body.classList.contains('night-mode')) {
        dom.presentationOverlay.classList.remove('pres-light');
      } else {
        dom.presentationOverlay.classList.add('pres-light');
      }
    }
  } else {
    console.error('[Presentation] ERROR: presentationOverlay element not found in DOM!');
  }
  // Set initial tajweed button state
  if (dom.presTajweedBtn) {
    dom.presTajweedBtn.classList.toggle('pres-tajweed-off', !_presTajweedEnabled);
  }
  document.body.classList.add('presentation-active');
  document.querySelectorAll('.view-mode-btn').forEach((b: Element) => {
    b.classList.toggle('active', (b as HTMLElement).dataset['mode'] === 'presentation');
  });
  document.addEventListener('keydown', handleKeyDown);
  // Show controls initially, then auto-hide
  showControls();
  updateDisplay();

  console.warn(
    '[Presentation] openPresentation() completed, overlay display=' +
      (dom.presentationOverlay ? dom.presentationOverlay.style.display : 'element-missing'),
  );
}

export function closePresentation(): void {
  state.presentationMode = false;
  // Exit fullscreen if active
  if (isFullscreen()) {
    exitFullscreen().catch(() => {
      /* noop */
    });
  }
  if (dom.presentationOverlay) {
    // Remove the presentation-visible class FIRST (it has display: flex !important)
    dom.presentationOverlay.classList.remove('presentation-visible');
    dom.presentationOverlay.classList.add('hidden');
    dom.presentationOverlay.style.display = 'none';
    // Clear all inline positioning styles set by openPresentation
    dom.presentationOverlay.style.position = '';
    dom.presentationOverlay.style.inset = '';
    dom.presentationOverlay.style.zIndex = '';
    dom.presentationOverlay.style.width = '';
    dom.presentationOverlay.style.height = '';
    dom.presentationOverlay.classList.remove(
      'pres-controls-visible',
      'pres-nature',
      'pres-auto',
      'pres-animated',
      'pres-scene',
      'pres-light',
    );
    dom.presentationOverlay.style.backgroundImage = '';
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
    b.classList.toggle('active', (b as HTMLElement).dataset['mode'] === 'surah');
  });
}

function handleKeyDown(e: KeyboardEvent): void {
  if (
    (e.target as HTMLElement).tagName === 'INPUT' ||
    (e.target as HTMLElement).tagName === 'TEXTAREA' ||
    (e.target as HTMLElement).tagName === 'SELECT'
  ) {
    return;
  }
  // Any key press shows controls
  showControls();
  switch (e.key) {
    case 'Escape':
      // If in fullscreen, only exit fullscreen — don't close presentation
      if (isFullscreen()) {
        e.preventDefault();
        exitFullscreen().catch(() => {
          /* noop */
        });
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
    default:
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
  console.warn('[Presentation] initPresentation() called');
  injectStyles();

  // Verify the presentation overlay exists in the DOM
  const overlay = document.getElementById('presentationOverlay');
  if (!overlay) {
    console.error('[Presentation] ERROR: presentationOverlay element not found in DOM!');
    return;
  }
  console.warn('[Presentation] Overlay element found, binding event handlers...');

  if (dom.presentationCloseBtn) {
    dom.presentationCloseBtn.addEventListener('click', closePresentation);
  }
  if (dom.presentationPrevBtn) {
    dom.presentationPrevBtn.addEventListener('click', () => navigateAyah(-1));
  }
  if (dom.presentationNextBtn) {
    dom.presentationNextBtn.addEventListener('click', () => navigateAyah(1));
  }
  dom.presentationOverlay?.addEventListener('click', (e: MouseEvent) => {
    // Don't close on background click when in fullscreen
    const inFs = isFullscreen();
    if (e.target === dom.presentationOverlay && !inFs) {
      closePresentation();
    }
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
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  console.warn('[Presentation] initPresentation() completed successfully');
}
