import { __ } from './i18n.js';
import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { togglePlayPause, updatePlayPauseBtn, playCurrentAyah } from './audio.js';
import { highlightCurrentAyah, loadSurah } from './surah-loader.js';
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
import {
  applyPresentationVideo,
  bindPresentationVideoVisibility,
  removePresentationVideo,
  syncPresentationVideoPlayback,
} from './pres-video.js';
import { injectStyles, buildAyahHtml } from './pres-styles.js';
import {
  closePresentationSharePreview,
  initPresentationShare,
  preparePresentationShareImage,
} from './presentation-share.js';
import { applyPresBgMode, applyPresBgScene, applyPresBgVideo } from './settings.js';

let _prevHighlightTimeout: ReturnType<typeof setTimeout> | null = null;

/** Presentation-local tajweed toggle — independent of the global setting. */
let _presTajweedEnabled = true;

/** Timeout for auto-hiding presentation controls. */
let _hideControlsTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Tracks a user-requested fullscreen transition before Android WebView reflects
 * it in document.fullscreenElement. Arabic shaping must already be continuous
 * during that short native transition.
 */
let _presFullscreenRequested = false;

/** Whether the in-presentation background picker is open. */
let _backgroundPickerOpen = false;

function setBackgroundPickerOpen(open: boolean, restoreFocus = false): void {
  const picker = dom.presBackgroundPicker;
  const button = dom.presBackgroundBtn;
  _backgroundPickerOpen = open;
  picker?.classList.toggle('hidden', !open);
  button?.setAttribute('aria-expanded', String(open));
  if (!open && restoreFocus) {
    button?.focus();
  }
}

function syncBackgroundPickerSelection(): void {
  const picker = dom.presBackgroundPicker;
  if (!picker) {
    return;
  }
  picker.querySelectorAll<HTMLButtonElement>('[data-pres-bg-mode]').forEach((option) => {
    const mode = option.dataset['presBgMode'];
    const scene = option.dataset['presBgScene'];
    const video = option.dataset['presBgVideo'];
    const active =
      mode === state.presBgMode && (!scene || scene === state.presBgScene) && (!video || video === state.presBgVideo);
    option.setAttribute('aria-pressed', String(active));
  });
}

/**
 * Fit the current ayah entirely inside the presentation body.
 *
 * Long ayahs previously kept the desktop font size and could exceed the body
 * height. Since the body is centred, that hid both the beginning and the end
 * of the ayah. Keep the normal reading scale whenever it fits, then tighten
 * line spacing and reduce the size in small steps only when required.
 */
function fitPresentationAyahText(): void {
  const ayahText = dom.presentationAyahText;
  const body = dom.presentationBody;
  if (!ayahText || !body) {
    return;
  }

  ayahText.style.fontSize = '';
  ayahText.style.lineHeight = '';
  body.scrollTop = 0;

  const translation = dom.presentationTranslation;
  const translationVisible = Boolean(translation && translation.style.display !== 'none');
  const translationHeight =
    translationVisible && translation
      ? translation.getBoundingClientRect().height +
        Number.parseFloat(window.getComputedStyle(translation).marginTop || '0')
      : 0;
  const availableHeight = body.clientHeight - translationHeight - 8;
  if (availableHeight <= 0 || ayahText.scrollHeight <= availableHeight) {
    return;
  }

  const computed = window.getComputedStyle(ayahText);
  const measuredSize = Number.parseFloat(computed.fontSize);
  const initialSize =
    Number.isFinite(measuredSize) && measuredSize > 0 ? measuredSize : window.innerWidth <= 600 ? 32 : 60;

  const minimumSize = window.innerWidth <= 600 ? 19 : 26;
  let size = initialSize;

  // First preserve the font size and recover vertical room by using a still
  // comfortable Quranic line height. This is enough for many medium ayahs.
  ayahText.style.lineHeight = '1.48';

  while (ayahText.scrollHeight > availableHeight && size > minimumSize) {
    size = Math.max(minimumSize, size - 2);
    ayahText.style.fontSize = `${size}px`;
  }

  body.scrollTop = 0;
}

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
  if (!overlay || _backgroundPickerOpen) {
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
  if (fsElement || _presFullscreenRequested) {
    _presFullscreenRequested = false;
    updateDisplay();
    exitFullscreen().catch(() => {
      _presFullscreenRequested = isFullscreen();
      updateDisplay();
    });
  } else {
    // Android WebView may resolve the request before it updates
    // document.fullscreenElement. Mark the request immediately so the ayah is
    // rebuilt as one uninterrupted Arabic run before the native transition.
    _presFullscreenRequested = true;
    updateDisplay();
    requestFullscreen(overlay).catch(() => {
      _presFullscreenRequested = false;
      updateDisplay();
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
    overlay.classList.remove('pres-nature', 'pres-auto', 'pres-animated', 'pres-scene', 'pres-video');
    if (state.presBgMode === 'nature') {
      removePresentationVideo(overlay);
      removeAnimatedBgLayer(overlay);
      removeSceneCanvas(overlay);
      const bg = getRandomNatureBg();
      overlay.style.backgroundImage = `url('${bg.src}')`;
      overlay.classList.add('pres-nature');
      overlay.classList.remove('pres-light');
    } else if (state.presBgMode === 'singleNature') {
      removePresentationVideo(overlay);
      removeAnimatedBgLayer(overlay);
      removeSceneCanvas(overlay);
      const bg = getNatureBgByMood(state.presBgNature) || getRandomNatureBg();
      overlay.style.backgroundImage = `url('${bg.src}')`;
      overlay.classList.add('pres-nature');
      overlay.classList.remove('pres-light');
    } else if (state.presBgMode === 'auto') {
      removePresentationVideo(overlay);
      removeAnimatedBgLayer(overlay);
      removeSceneCanvas(overlay);
      const bg = getAutoBackground();
      overlay.style.backgroundImage = `url('${bg.src}')`;
      overlay.classList.add('pres-auto');
      overlay.classList.remove('pres-light');
    } else if (state.presBgMode === 'animated') {
      removePresentationVideo(overlay);
      removeSceneCanvas(overlay);
      overlay.style.backgroundImage = 'none';
      const bg = getRandomNatureBg();
      applyAnimatedBg(overlay, bg.src);
      overlay.classList.add('pres-animated');
      overlay.classList.remove('pres-light');
    } else if (state.presBgMode === 'scene') {
      removePresentationVideo(overlay);
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
    } else if (state.presBgMode === 'video') {
      removeAnimatedBgLayer(overlay);
      removeSceneCanvas(overlay);
      applyPresentationVideo(overlay, state.presBgVideo);
      overlay.classList.remove('pres-light');
    } else {
      removePresentationVideo(overlay);
      removeAnimatedBgLayer(overlay);
      removeSceneCanvas(overlay);
      overlay.style.backgroundImage = '';
      if (!document.body.classList.contains('night-mode')) {
        overlay.classList.add('pres-light');
      }
    }
  }
  syncBackgroundPickerSelection();

  const surahData = state.surahData as SurahDataLike | null;
  const ayah = surahData?.ayahs?.[state.currentAyahIndex];
  updateSurahNavigationButtons();
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
    // Android WebView can split Arabic shaping runs at the coloured inline
    // tajweed spans in fullscreen. Render a single uninterrupted text run
    // there; normal presentation mode keeps its local tajweed colours.
    const usePresentationTajweed = _presTajweedEnabled && !isFullscreen() && !_presFullscreenRequested;
    dom.presentationAyahText.innerHTML = buildAyahHtml(
      ayah.text,
      state.currentSurah,
      ayah.numberInSurah,
      usePresentationTajweed,
    );
  }

  if (dom.presentationAyahNum) {
    dom.presentationAyahNum.textContent = `${__('ayah')} ${ayah.numberInSurah}`;
  }
  const surahName = surahData?.name || '';
  if (dom.presentationTitle) {
    dom.presentationTitle.textContent = surahName;
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
  fitPresentationAyahText();
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
  preparePresentationShareImage();
}

function updateSurahNavigationButtons(): void {
  const applyState = (button: HTMLElement | null, disabled: boolean): void => {
    if (!button) {
      return;
    }
    button.toggleAttribute('disabled', disabled);
    button.setAttribute('aria-disabled', String(disabled));
  };
  applyState(dom.presentationPrevSurahBtn, state.currentSurah <= 1);
  applyState(dom.presentationNextSurahBtn, state.currentSurah >= 114);
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

async function navigateSurah(delta: number): Promise<void> {
  const targetSurah = state.currentSurah + delta;
  if (targetSurah < 1 || targetSurah > 114 || targetSurah === state.currentSurah) {
    return;
  }
  const wasPlaying = state.isPlaying;
  const targetInfo = state.surahList.find((surah) => surah.number === targetSurah);
  const startAyah = delta < 0 ? targetInfo?.numberOfAyahs || 1 : 1;
  await loadSurah(targetSurah, { startAyah, autoPlay: wasPlaying });
  if (state.presentationMode) {
    updateDisplay();
    showControls();
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
      const active = (b as HTMLElement).dataset['mode'] === 'surah';
      b.classList.toggle('active', active);
      if (typeof (b as HTMLElement).setAttribute === 'function') {
        b.setAttribute('aria-pressed', String(active));
      }
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

  // Presentation always renders as a clean standalone surface. Remove the
  // reader-only Mushaf class before the overlay appears to prevent CSS leakage.
  document.body.classList.remove('mushaf-active');
  state.presentationMode = true;
  _presFullscreenRequested = false;
  setBackgroundPickerOpen(false);
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
    const active = (b as HTMLElement).dataset['mode'] === 'presentation';
    b.classList.toggle('active', active);
    if (typeof (b as HTMLElement).setAttribute === 'function') {
      b.setAttribute('aria-pressed', String(active));
    }
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
  _presFullscreenRequested = false;
  setBackgroundPickerOpen(false);
  closePresentationSharePreview();
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
      'pres-video',
      'pres-light',
    );
    dom.presentationOverlay.style.backgroundImage = '';
    removeAnimatedBgLayer(dom.presentationOverlay);
    removeSceneCanvas(dom.presentationOverlay);
    removePresentationVideo(dom.presentationOverlay);
  }
  if (_hideControlsTimeout) {
    clearTimeout(_hideControlsTimeout);
    _hideControlsTimeout = null;
  }
  document.body.classList.remove('presentation-active');
  document.removeEventListener('keydown', handleKeyDown);
  document.querySelectorAll('.view-mode-btn').forEach((b: Element) => {
    const active = (b as HTMLElement).dataset['mode'] === 'surah';
    b.classList.toggle('active', active);
    if (typeof (b as HTMLElement).setAttribute === 'function') {
      b.setAttribute('aria-pressed', String(active));
    }
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
  if (e.key === 'Escape' && _backgroundPickerOpen) {
    e.preventDefault();
    setBackgroundPickerOpen(false, true);
    return;
  }
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
  _presFullscreenRequested = isFullscreen();
  updatePresFullscreenBtn();
  // Rebuild the ayah after the fullscreen state changes so Android receives
  // one continuous Arabic shaping run in fullscreen and restores tajweed on exit.
  if (state.presentationMode) {
    updateDisplay();
  }
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
  if (overlay && state.presBgMode === 'video') {
    syncPresentationVideoPlayback(overlay);
  }
}

/** Re-fit the text on a viewport resize without rebuilding the background. */
function handlePresentationResize(): void {
  if (state.presentationMode) {
    fitPresentationAyahText();
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
  initPresentationShare();
  bindPresentationVideoVisibility();
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
  if (dom.presentationPrevSurahBtn) {
    dom.presentationPrevSurahBtn.addEventListener('click', () => void navigateSurah(-1));
  }
  if (dom.presentationNextSurahBtn) {
    dom.presentationNextSurahBtn.addEventListener('click', () => void navigateSurah(1));
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

  if (dom.presBackgroundBtn) {
    dom.presBackgroundBtn.addEventListener('click', () => {
      setBackgroundPickerOpen(!_backgroundPickerOpen);
      syncBackgroundPickerSelection();
      showControls();
    });
  }
  if (dom.presBackgroundPicker) {
    dom.presBackgroundPicker.addEventListener('click', (event: MouseEvent) => {
      const option = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pres-bg-mode]');
      const mode = option?.dataset['presBgMode'];
      if (!mode) {
        return;
      }
      const scene = option?.dataset['presBgScene'];
      const video = option?.dataset['presBgVideo'];
      if (scene) {
        applyPresBgScene(scene);
      }
      if (video) {
        applyPresBgVideo(video);
      }
      applyPresBgMode(mode as 'plain' | 'nature' | 'animated' | 'scene' | 'video');
      setBackgroundPickerOpen(false, true);
      showControls();
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
  window.addEventListener('resize', handlePresentationResize);

  console.warn('[Presentation] initPresentation() completed successfully');
}
