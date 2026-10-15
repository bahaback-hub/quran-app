/**
 * Azan and tafsir event bindings (notification banner, tafsir curtain
 * open/close, translation select, curtain resize layout).
 *
 * Split from app-events.ts for maintainability; re-exported through its barrel.
 */
import { dom } from '../dom.js';
import { requireDom } from '../dom-require.js';
import { storage } from '../storage.js';
import { state } from '../state.js';
import { __ } from '../i18n.js';
import { stopAzan, hideAzanNotification } from '../features/prayer/prayer.js';
import { toggleTafsir, openTafsir, closeTafsir, loadTafsirForCurrentAyah } from '../tafsir.js';
import { loadSurah, toggleTranslation } from '../surah-loader.js';

/**
 * Bind azan notification and player events.
 */
export function bindAzanEvents(): void {
  dom.azanNotification?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === dom.azanNotification) {
      stopAzan();
    }
  });
  dom.azanPlayer?.addEventListener('ended', () => {
    state.azanPlaying = false;
    if (dom.testAzanBtn) {
      dom.testAzanBtn.textContent = __('test_azan');
    }
    hideAzanNotification();
  });
}

/**
 * Bind tafsir curtain and translation select.
 */
export function bindTafsirEvents(): void {
  bindTafsirCurtainLayout();
  dom.tafsirCurtainCloseBtn?.addEventListener('click', closeTafsir);
  dom.translationToggle?.addEventListener('click', toggleTranslation);
  dom.tafsirSelect?.addEventListener('change', () => {
    state.currentTafsirEdition = requireDom('tafsirSelect').value;
    storage.set('tafsir_edition', state.currentTafsirEdition);
    if (dom.tafsirCurtain?.classList.contains('open')) {
      loadTafsirForCurrentAyah();
    }
  });

  dom.translationSelect?.addEventListener('change', () => {
    const val = requireDom('translationSelect').value;
    if (val) {
      state.translationEnabled = true;
      state.currentTranslation = val;
    } else {
      state.translationEnabled = false;
      state.currentTranslation = '';
    }
    storage.set('translation_enabled', state.translationEnabled);
    storage.set('translation_edition', state.currentTranslation);
    if (state.currentSurah) {
      loadSurah(state.currentSurah);
    }
  });
}

/**
 * Keep the tafsir curtain readable in every viewport.
 * Desktop users resize its width from the visible edge; phone users resize the bottom sheet height.
 * The current size is saved locally, while all movements stay bounded inside the screen.
 */
function bindTafsirCurtainLayout(): void {
  const curtain = dom.tafsirCurtain;
  const body = dom.tafsirCurtainBody;
  const handle = dom.tafsirCurtainHandle;
  const grip = dom.tafsirCurtainGrip;
  const shrinkButton = dom.tafsirCurtainShrinkBtn;
  const growButton = dom.tafsirCurtainGrowBtn;
  const resetButton = dom.tafsirCurtainResetBtn;
  if (
    !curtain ||
    !body ||
    !handle ||
    !grip ||
    !shrinkButton ||
    !growButton ||
    !resetButton ||
    curtain.dataset['layoutBound'] === 'true'
  ) {
    return;
  }
  curtain.dataset['layoutBound'] = 'true';

  const isMobileSheet = () => window.matchMedia?.('(max-width: 600px)').matches ?? false;
  const sheetLimits = () => ({ min: window.innerHeight * 0.35, max: window.innerHeight * 0.84 });
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const readCssSize = (property: string, fallback: number) => {
    const stored = Number.parseFloat(document.documentElement.style.getPropertyValue(property));
    return Number.isFinite(stored) ? stored : fallback;
  };
  const applySheetHeight = (height: number, persist = true) => {
    const limits = sheetLimits();
    const nextHeight = Math.round(clamp(height, limits.min, limits.max));
    document.documentElement.style.setProperty('--tafsir-sheet-height', `${nextHeight}px`);
    if (persist) {
      storage.set('tafsir_sheet_height', nextHeight);
    }
  };
  const updateSheetAria = () => {
    const limits = sheetLimits();
    const value = readCssSize('--tafsir-sheet-height', window.innerHeight * 0.6);
    grip.setAttribute('aria-valuemin', String(Math.round(limits.min)));
    grip.setAttribute('aria-valuemax', String(Math.round(limits.max)));
    grip.setAttribute('aria-valuenow', String(Math.round(value)));
  };
  const syncSavedSheetHeight = () => {
    if (isMobileSheet()) {
      const saved = storage.get<number>('tafsir_sheet_height');
      applySheetHeight(typeof saved === 'number' ? saved : window.innerHeight * 0.6, false);
    }
  };
  const textLimits = { min: 14, max: 28, default: 16 };
  const applyTextSize = (size: number, persist = true) => {
    const nextSize = Math.round(clamp(size, textLimits.min, textLimits.max));
    document.documentElement.style.setProperty('--tafsir-text-size', `${nextSize}px`);
    if (persist) {
      storage.set('tafsir_text_size', nextSize);
    }
  };
  const syncSavedTextSize = () => {
    const saved = storage.get<number>('tafsir_text_size');
    applyTextSize(typeof saved === 'number' ? saved : textLimits.default, false);
  };
  const changeTextSize = (direction: 1 | -1) => {
    const current = readCssSize('--tafsir-text-size', textLimits.default);
    applyTextSize(current + direction);
  };
  syncSavedSheetHeight();
  syncSavedTextSize();
  shrinkButton.addEventListener('click', () => changeTextSize(-1));
  growButton.addEventListener('click', () => changeTextSize(1));
  resetButton.addEventListener('click', () => {
    storage.remove('tafsir_text_size');
    applyTextSize(textLimits.default, false);
  });

  grip.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!isMobileSheet()) {
      return;
    }
    const limits = sheetLimits();
    if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      applySheetHeight(
        readCssSize('--tafsir-sheet-height', window.innerHeight * 0.6) + Math.round(window.innerHeight * 0.1),
      );
    } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      applySheetHeight(
        readCssSize('--tafsir-sheet-height', window.innerHeight * 0.6) - Math.round(window.innerHeight * 0.1),
      );
    } else if (event.key === 'Home') {
      event.preventDefault();
      applySheetHeight(limits.min);
    } else if (event.key === 'End') {
      event.preventDefault();
      applySheetHeight(limits.max);
    }
  });

  let startY = 0;
  let startHeight = 0;
  let mobilePointerId: number | null = null;
  let lastTouchY: number | null = null;

  grip.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') {
      return;
    }
    if (!isMobileSheet() || !curtain.classList.contains('open')) {
      return;
    }
    event.preventDefault();
    mobilePointerId = event.pointerId;
    startY = event.clientY;
    startHeight = curtain.getBoundingClientRect().height;
    curtain.classList.add('is-resizing');
    grip.setPointerCapture?.(event.pointerId);
  });

  grip.addEventListener('pointermove', (event: PointerEvent) => {
    if (mobilePointerId !== event.pointerId) {
      return;
    }
    applySheetHeight(startHeight + startY - event.clientY, false);
  });

  const finishResize = (event: PointerEvent) => {
    if (mobilePointerId !== event.pointerId) {
      return;
    }
    grip.releasePointerCapture?.(event.pointerId);
    mobilePointerId = null;
    curtain.classList.remove('is-resizing');
    applySheetHeight(readCssSize('--tafsir-sheet-height', window.innerHeight * 0.6));
    updateSheetAria();
  };
  grip.addEventListener('pointerup', finishResize);
  grip.addEventListener('pointercancel', finishResize);

  const curtainWidth = () => {
    const renderedWidth = curtain.getBoundingClientRect().width;
    return renderedWidth > 0 ? renderedWidth : readCssSize('--tafsir-curtain-width', 380);
  };
  const revealLimit = () => Math.min(curtainWidth(), Math.max(260, Math.round(window.innerWidth * 0.45)));
  const applyReveal = (reveal: number, persist = true) => {
    const nextReveal = Math.round(clamp(reveal, 0, revealLimit()));
    document.documentElement.style.setProperty('--tafsir-curtain-reveal', `${nextReveal}px`);
    if (persist) {
      storage.set('tafsir_curtain_reveal', nextReveal);
    }
  };
  const syncSavedReveal = () => {
    if (isMobileSheet()) {
      return;
    }
    const saved = storage.get<number>('tafsir_curtain_reveal');
    applyReveal(typeof saved === 'number' ? saved : curtainWidth(), false);
  };
  let handlePointerId: number | null = null;
  let handleStartX = 0;
  let handleStartReveal = 0;
  let handleDragged = false;
  let handleWasOpen = false;
  let suppressHandleClick = false;
  handle.addEventListener('click', () => {
    if (suppressHandleClick) {
      suppressHandleClick = false;
      return;
    }
    toggleTafsir();
  });
  handle.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') {
      return;
    }
    if (isMobileSheet()) {
      return;
    }
    event.preventDefault();
    handlePointerId = event.pointerId;
    handleStartX = event.clientX;
    handleWasOpen = curtain.classList.contains('open');
    handleStartReveal = handleWasOpen ? readCssSize('--tafsir-curtain-reveal', curtainWidth()) : 0;
    handleDragged = false;
    handle.classList.add('is-dragging');
    handle.setPointerCapture?.(event.pointerId);
  });
  handle.addEventListener('pointermove', (event: PointerEvent) => {
    if (handlePointerId !== event.pointerId) {
      return;
    }
    const distance = event.clientX - handleStartX;
    if (Math.abs(distance) > 4) {
      handleDragged = true;
    }
    if (handleDragged && !curtain.classList.contains('open')) {
      applyReveal(0, false);
      openTafsir();
    }
    applyReveal(handleStartReveal + distance, false);
  });
  const finishHandleDrag = (event: PointerEvent) => {
    if (handlePointerId !== event.pointerId) {
      return;
    }
    handle.releasePointerCapture?.(event.pointerId);
    handlePointerId = null;
    handle.classList.remove('is-dragging');
    if (!handleDragged) {
      return;
    }
    suppressHandleClick = true;
    const reveal = readCssSize('--tafsir-curtain-reveal', curtainWidth());
    if (reveal < 48) {
      storage.remove('tafsir_curtain_reveal');
      document.documentElement.style.removeProperty('--tafsir-curtain-reveal');
      if (curtain.classList.contains('open')) {
        toggleTafsir();
      }
      return;
    }
    applyReveal(reveal);
  };
  handle.addEventListener('pointerup', finishHandleDrag);
  handle.addEventListener('pointercancel', finishHandleDrag);
  syncSavedReveal();
  window.addEventListener(
    'resize',
    () => {
      syncSavedSheetHeight();
      syncSavedReveal();
      updateSheetAria();
    },
    { passive: true },
  );

  body.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      const atTop = body.scrollTop <= 0;
      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
      if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  body.addEventListener(
    'touchstart',
    (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY ?? null;
    },
    { passive: true },
  );
  body.addEventListener(
    'touchmove',
    (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined || lastTouchY === null) {
        return;
      }
      const atTop = body.scrollTop <= 0;
      const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
      const movingDown = currentY > lastTouchY;
      const movingUp = currentY < lastTouchY;
      if ((movingDown && atTop) || (movingUp && atBottom)) {
        event.preventDefault();
      }
      lastTouchY = currentY;
    },
    { passive: false },
  );
  body.addEventListener(
    'touchend',
    () => {
      lastTouchY = null;
    },
    { passive: true },
  );
}
