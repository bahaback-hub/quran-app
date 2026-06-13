import { initErrorBoundary } from './error-boundary.js';
import { initApp } from './app.js';
import { initI18n } from './i18n.js';

// Install global error handlers FIRST — before any other code runs
initErrorBoundary();

// Detect Capacitor native environment
const isCapacitorNative = typeof globalThis !== 'undefined' &&
  ((globalThis as any).Capacitor?.isNativePlatform?.() ||
   (globalThis as any).Capacitor?.isNative ||
   (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()));

const isAndroidWebView = typeof navigator !== 'undefined' && /wv|Android.*Capacitor/i.test(navigator.userAgent);

if (isCapacitorNative || isAndroidWebView) {
  document.documentElement.classList.add('capacitor-native');
  console.log('[Capacitor] Native platform detected, applying mobile fixes');
  // Apply class after DOM is ready
  if (document.body) {
    document.body.classList.add('capacitor-native');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('capacitor-native');
    });
  }

  // Hide splash screen when app is ready (safety net even with launchAutoHide)
  const hideSplash = () => {
    try {
      if ((globalThis as any).Capacitor?.Plugins?.SplashScreen) {
        (globalThis as any).Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 300 });
      }
    } catch (e) { /* ignore */ }
  };
  document.addEventListener('DOMContentLoaded', () => setTimeout(hideSplash, 500));
  setTimeout(hideSplash, 2000); // fallback
}

let _installEvent: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', ((e: Event) => {
  // Don't show install prompt in Capacitor native app
  if (isCapacitorNative || isAndroidWebView) return;
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

// Service Worker — DISABLE in Capacitor native app to avoid conflicts
// The SW intercepts fetch requests and breaks Capacitor's WebView loading
if (!isCapacitorNative && !isAndroidWebView && 'serviceWorker' in navigator) {
  let _swUpdateToastShown = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!_swUpdateToastShown) {
      _swUpdateToastShown = true;
      const el = document.getElementById('updateBanner');
      if (el) {
        el.style.display = 'flex';
      } else {
        const banner = document.createElement('div');
        banner.id = 'updateBanner';
        banner.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--accent,#5c2e2e);color:#fff;padding:10px 20px;border-radius:12px;font-size:14px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;';
        banner.innerHTML = '<span>تحديث متوفر</span><button onclick="location.reload()" style="background:#fff;color:#5c2e2e;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:bold;font-family:inherit;">تحديث</button>';
        document.body.appendChild(banner);
      }
    }
  });

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
          showUpdateNotification();
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  }).catch(() => { /* SW not available */ });
} else if (isCapacitorNative || isAndroidWebView) {
  // Unregister any existing service worker in Capacitor
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const reg of registrations) {
        reg.unregister();
        console.log('[Capacitor] Unregistered service worker to prevent conflicts');
      }
    }).catch(() => {});
  }
}

initI18n().then(() => initApp());
