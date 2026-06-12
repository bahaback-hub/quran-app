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

window.installPWA = function (): void {
  if (_installEvent) {
    _installEvent.prompt();
    _installEvent.userChoice.then(() => {
      _installEvent = null;
    });
  }
};

// Service Worker update notification — show "Update available" toast
if ('serviceWorker' in navigator) {
  let _swUpdateToastShown = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // New service worker has taken control — prompt user to reload
    if (!_swUpdateToastShown) {
      _swUpdateToastShown = true;
      const el = document.getElementById('updateBanner');
      if (el) {
        el.style.display = 'flex';
      } else {
        // Fallback: create a temporary toast
        const banner = document.createElement('div');
        banner.id = 'updateBanner';
        banner.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--accent,#5c2e2e);color:#fff;padding:10px 20px;border-radius:12px;font-size:14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;';
        banner.innerHTML = '<span>تحديث متوفر</span><button onclick="location.reload()" style="background:#fff;color:#5c2e2e;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:bold;font-family:inherit;">تحديث</button>';
        document.body.appendChild(banner);
      }
    }
  });

  // Listen for waiting service worker on registration
  navigator.serviceWorker.ready.then((reg) => {
    function showUpdateNotification(): void {
      const el = document.getElementById('updateBanner');
      if (el) {
        el.style.display = 'flex';
        return;
      }
      const banner = document.createElement('div');
      banner.id = 'updateBanner';
      banner.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--accent,#5c2e2e);color:#fff;padding:10px 20px;border-radius:12px;font-size:14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;';
      banner.innerHTML = '<span>تحديث متوفر</span><button onclick="location.reload()" style="background:#fff;color:#5c2e2e;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:bold;font-family:inherit;">تحديث</button>';
      document.body.appendChild(banner);
    }

    if (reg.waiting) {
      showUpdateNotification();
      return;
    }

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New content is available
          showUpdateNotification();
          // Tell the waiting SW to activate
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  }).catch(() => { /* SW not available */ });
}

initI18n().then(() => initApp());
