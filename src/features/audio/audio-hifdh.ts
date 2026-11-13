/**
 * Hifdh (memorization) mode helpers for the audio player.
 *
 * Extracted from `audio.ts`; behavior unchanged.
 */
import { state } from '../../state.js';
import { dom } from '../../dom.js';
import { hapticFeedback } from '../../utils.js';
import { __ } from '../../i18n.js';
import { highlightCurrentAyah } from './audio-navigation.js';
import { showToast } from '../../ui.js';

/**
 * Apply hifdh mode CSS classes to all ayah elements in the DOM.
 * Separated from toggleHifdh for testability — pure DOM operation.
 * @param enabled Whether hifdh mode is active
 */
export function applyHifdhUI(enabled: boolean): void {
  dom.hifdhBtn?.classList.toggle('active', enabled);
  document.querySelectorAll('.ayah').forEach((el: Element) => {
    if (enabled) {
      el.classList.add('hifdh-mode');
    } else {
      el.classList.remove('hifdh-mode', 'revealed');
    }
  });
}

/**
 * Toggle hifdh (memorization) mode.
 * State change is separated from DOM update for testability.
 */
export function toggleHifdh(): void {
  hapticFeedback();
  state.hifdhMode = !state.hifdhMode;
  applyHifdhUI(state.hifdhMode);
  if (state.hifdhMode) {
    highlightCurrentAyah();
  }
  showToast(state.hifdhMode ? __('hifdh_on') : __('hifdh_off'), state.hifdhMode ? 'success' : '');
}
