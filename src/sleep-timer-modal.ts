/**
 * Custom sleep timer modal — replaces browser prompt().
 * All styling uses CSS classes instead of inline styles.
 */

import { __ } from './i18n.js';
import { trapFocus } from './a11y.js';

/** Audio module interface with setSleepTimer method. */
export interface AudioModule {
  setSleepTimer: (mins: number) => void;
}

/**
 * Show a custom modal for the sleep timer.
 */
export function showSleepTimerModal(audioModule: AudioModule): void {
  const existing = document.getElementById('sleepTimerModal');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'sleepTimerModal';
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', __('sleep_timer_title'));

  const modal = document.createElement('div');
  modal.className = 'modal-box';

  const title = document.createElement('h3');
  title.className = 'modal-title';
  title.textContent = __('sleep_timer_title');

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = '180';
  input.value = '15';
  input.className = 'modal-input';
  input.placeholder = __('sleep_timer_placeholder');

  const hint = document.createElement('p');
  hint.className = 'modal-hint';
  hint.textContent = __('sleep_timer_hint');

  const btnRow = document.createElement('div');
  btnRow.className = 'modal-btn-row';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = __('sleep_timer_confirm');
  confirmBtn.className = 'btn btn-gold modal-btn';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = __('sleep_timer_cancel');
  cancelBtn.className = 'btn modal-btn-cancel';

  const quickBtns = document.createElement('div');
  quickBtns.className = 'modal-quick-btns';
  [5, 10, 15, 30, 45, 60].forEach((mins: number) => {
    const btn = document.createElement('button');
    btn.textContent = __('minutes_abbr', String(mins));
    btn.className = 'modal-quick-btn';
    btn.addEventListener('click', () => {
      input.value = String(mins);
    });
    quickBtns.appendChild(btn);
  });

  let focusCleanup: (() => void) | null = null;

  function close(): void {
    if (focusCleanup) {
      focusCleanup();
    }
    overlay.remove();
  }

  confirmBtn.addEventListener('click', () => {
    let mins = parseInt(input.value, 10);
    if (isNaN(mins) || mins <= 0) {
      close();
      return;
    }
    mins = Math.min(mins, 180); // Enforce max
    audioModule.setSleepTimer(mins);
    close();
  });
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) {
      close();
    }
  });
  overlay.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  modal.appendChild(title);
  modal.appendChild(quickBtns);
  modal.appendChild(input);
  modal.appendChild(hint);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  focusCleanup = trapFocus(overlay);
  input.focus();
  input.select();
}
