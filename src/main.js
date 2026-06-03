import { initApp } from './app.js';
import { initI18n } from './i18n.js';

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
