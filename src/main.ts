import { initErrorBoundary } from './error-boundary.js';
import { initApp } from './app.js';
import { initI18n } from './i18n.js';

// Install global error handlers FIRST — before any other code runs
initErrorBoundary();

let _installEvent: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', ((e: Event) => {
  e.preventDefault();
  _installEvent = e as BeforeInstallPromptEvent;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = '';
}) as EventListener);

window.installPWA = function(): void {
  if (_installEvent) {
    _installEvent.prompt();
    _installEvent.userChoice.then(() => { _installEvent = null; });
  }
};

initI18n().then(() => initApp());
