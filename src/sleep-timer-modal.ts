/**
 * Custom sleep timer modal — replaces browser prompt().
 * All styling uses CSS classes instead of inline styles.
 */

import { __ } from './i18n.js';

/** Audio module interface with setSleepTimer method. */
export interface AudioModule {
  setSleepTimer: (mins: number) => void;
}

/**
 * Show a custom modal for the sleep timer.
 */
export function showSleepTimerModal(audioModule: AudioModule): void {
  const existing = document.getElementById('sleepTimerModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sleepTimerModal';
  overlay.className = 'modal-overlay';

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
    btn.textContent = `${mins} د`;
    btn.className = 'modal-quick-btn';
    btn.addEventListener('click', () => {
      input.value = String(mins);
    });
    quickBtns.appendChild(btn);
  });

  function close(): void {
    overlay.remove();
  }
  confirmBtn.addEventListener('click', () => {
    const mins = parseInt(input.value, 10);
    if (mins > 0) audioModule.setSleepTimer(mins);
    close();
  });
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) close();
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
  input.focus();
  input.select();
}
