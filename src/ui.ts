/**
 * UI Utility Functions for Quran App.
 *
 * Provides toast notifications and loading bar controls.
 * All functions are safe to call with null DOM references.
 *
 * @module ui
 */

import { dom } from './dom.js';

/** Timer ID for the current toast auto-dismiss. */
let _toastTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a toast notification with auto-dismiss after 2.5 seconds.
 * If a toast is already showing, it replaces the content and resets the timer.
 *
 * @param msg The message text to display
 * @param type Optional CSS class name for styling (e.g. 'error', 'success')
 *
 * @example
 *   showToast('تم الحفظ', 'success');
 *   showToast('حدث خطأ', 'error');
 */
export function showToast(msg: string, type: string = ''): void {
  if (!dom.toast) {
    return;
  }
  dom.toast.textContent = msg;
  dom.toast.className = 'toast show ' + type;
  if (_toastTimeout) {
    clearTimeout(_toastTimeout);
  }
  _toastTimeout = setTimeout(() => dom.toast?.classList.remove('show'), 2500);
}

/** Loading bar controller with show/hide methods. */
export const loadingBar = {
  el: null as HTMLElement | null,
  timer: null as ReturnType<typeof setTimeout> | null,

  init(): void {
    this.el = document.getElementById('loadingProgress');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'loadingProgress';
      this.el.className = 'loading-bar';
      document.body.prepend(this.el);
    }
  },

  show(msg?: string): void {
    if (!this.el) {
      this.init();
    }
    this.el?.classList.add('active');
    if (this.el && msg) {
      this.el.textContent = msg;
    }
    if (this.timer) {
      clearTimeout(this.timer);
    }
  },

  hide(): void {
    if (!this.el) {
      return;
    }
    this.el.classList.remove('active');
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      if (this.el) {
        this.el.textContent = '';
      }
    }, 300);
  },
};
