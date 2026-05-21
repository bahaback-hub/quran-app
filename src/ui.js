import { dom } from './dom.js';

export function showToast(msg, type = '') {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.className = 'toast show ' + type;
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

export const loadingBar = {
  el: null,
  timer: null,
  init() {
    this.el = document.getElementById('loadingProgress');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'loadingProgress';
      this.el.className = 'loading-bar';
      document.body.prepend(this.el);
    }
  },
  show(msg) {
    if (!this.el) this.init();
    this.el.classList.add('active');
    this.el.textContent = msg || '';
    clearTimeout(this.timer);
  },
  hide() {
    if (!this.el) return;
    this.el.classList.remove('active');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (this.el) this.el.textContent = ''; }, 300);
  }
};
