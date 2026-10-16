/**
 * Repeat-mode UI for the audio player — the active-state class, the range
 * dropdowns, and the toggle button. The playback side of repeat (looping,
 * range jumps, completion) lives in audio.ts; this module is the
 * presentation layer.
 *
 * Extracted from audio.ts and re-exported there for existing callers.
 */

import { state } from '../../state.js';
import { dom } from '../../dom.js';
import { requireDom } from '../../dom-require.js';
import { showToast } from '../../ui.js';
import { hapticFeedback } from '../../utils.js';
import { __ } from '../../i18n.js';
import type { SurahData } from '../../types.js';
import type { RepeatRange } from './audio-types.js';

/* ===================== REPEAT UI ===================== */

/**
 * Compute the default repeat range for the current surah.
 * Pure function — no side effects, easy to test.
 *
 * @param surahData The surah data to compute the default range for
 * @returns A RepeatRange with from=1, to=ayah count, times=3
 */
export function getDefaultRepeatRange(surahData: SurahData): RepeatRange {
  return { from: 1, to: surahData.ayahs.length, times: 3 };
}

/**
 * Apply the repeat mode UI state — toggle button active class and controls visibility.
 * Separated from toggleRepeat for testability — pure DOM operation.
 *
 * @param active Whether repeat mode is currently active
 */
export function applyRepeatUI(active: boolean): void {
  dom.repeatBtn?.classList.toggle('active', active);
  if (dom.repeatControls) {
    // `.hidden` uses `display: none !important`; remove it before showing
    // the range controls or Android will keep them invisible.
    dom.repeatControls.classList.toggle('hidden', !active);
    dom.repeatControls.style.display = active ? 'flex' : 'none';
  }
}

/**
 * Reset the repeat mode UI elements.
 * Separated from completeRepeat for testability.
 */
export function resetRepeatUI(): void {
  dom.repeatBtn?.classList.remove('active');
  if (dom.repeatControls) {
    dom.repeatControls.style.display = 'none';
  }
}

/**
 * Populate repeat range dropdowns in the UI.
 * Separated from toggleRepeat for testability and clarity.
 *
 * @param range The repeat range configuration to populate the UI with
 */
export function populateRepeatUI(range: RepeatRange): void {
  if (!dom.repeatFrom || !dom.repeatTo || !dom.repeatTimes) {
    return;
  }

  // Build option elements once and clone for each dropdown. For long surahs
  // (e.g. Al-Baqarah with 286 ayahs) this halves the number of <option>
  // allocations from 572 to 286 + clones (which are cheap).
  const fromOpts = document.createDocumentFragment();
  const toOpts = document.createDocumentFragment();

  for (let i = 1; i <= range.to; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    // Clone for the "to" dropdown — cloneNode is faster than recreating
    // because it skips attribute parsing.
    fromOpts.appendChild(opt);
    toOpts.appendChild(opt.cloneNode(true));
  }

  dom.repeatFrom.replaceChildren(fromOpts);
  dom.repeatTo.replaceChildren(toOpts);
  dom.repeatFrom.value = String(range.from);
  dom.repeatTo.value = String(range.to);
  dom.repeatTimes.value = String(range.times);

  // Bind change handlers
  dom.repeatFrom.onchange = () => {
    state.repeatFrom = parseInt(requireDom('repeatFrom').value, 10);
    if (state.repeatFrom > state.repeatTo) {
      state.repeatTo = state.repeatFrom;
      requireDom('repeatTo').value = String(state.repeatTo);
    }
    state.repeatCounter = 0;
  };
  dom.repeatTo.onchange = () => {
    state.repeatTo = parseInt(requireDom('repeatTo').value, 10);
    if (state.repeatTo < state.repeatFrom) {
      state.repeatFrom = state.repeatTo;
      requireDom('repeatFrom').value = String(state.repeatFrom);
    }
    state.repeatCounter = 0;
  };
  dom.repeatTimes.onchange = () => {
    state.repeatTimes = parseInt(requireDom('repeatTimes').value, 10);
    state.repeatCounter = 0;
  };
}

/**
 * Toggle repeat mode on/off.
 * State changes are separated from DOM updates for testability.
 * When enabled, initializes the repeat range to the full surah and populates UI dropdowns.
 */
export function toggleRepeat(): void {
  hapticFeedback();
  state.repeatMode = !state.repeatMode;
  state.repeatCounter = 0;
  applyRepeatUI(state.repeatMode);

  if (state.repeatMode && state.surahData) {
    const range = getDefaultRepeatRange(state.surahData);
    state.repeatFrom = range.from;
    state.repeatTo = range.to;
    state.repeatTimes = range.times;
    populateRepeatUI(range);
    showToast(__('repeat_on'), 'success');
  } else {
    showToast(__('repeat_off'), '');
  }
}
