import { initApp } from './app.js';
import { initI18n } from './i18n.js';
import { showToast } from './ui.js';

/** @type {Event|null} */
/** @type {BeforeInstallPromptEvent|null} */
let _installEvent = null;
window.addEventListener('beforeinstallprompt', /** @param {BeforeInstallPromptEvent} e */ (e) => {
  e.preventDefault();
  _installEvent = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = '';
});

window.installPWA = function() {
  if (_installEvent) {
    _installEvent.prompt();
    _installEvent.userChoice.then(() => { _installEvent = null; });
  }
};

initI18n();
initApp();

window.addEventListener('app-update', () => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const div = document.createElement('div');
  div.className = 'toast sw-update-toast';
  div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;';
  div.innerHTML = `
    <span>🆕 يتوفر تحديث جديد للتطبيق</span>
    <button id="swUpdateBtn" style="background:#2d8a4e;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;">تحديث</button>
    <button id="swDismissBtn" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.3);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;">✖</button>
  `;
  toast.appendChild(div);
  document.getElementById('swUpdateBtn')?.addEventListener('click', () => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  });
  document.getElementById('swDismissBtn')?.addEventListener('click', () => div.remove());
});
