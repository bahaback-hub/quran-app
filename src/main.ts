import { initErrorBoundary } from './error-boundary.js';
import { initApp } from './app.js';
import { initI18n, __ } from './i18n.js';
import { isCapacitorNative, getCapacitor } from './types.js';
import { updateBanner } from './templates.js';

/**
 * One-time Service Worker cleanup (DISABLED — was causing infinite loop).
 *
 * This function was needed when migrating from 'prompt' to 'autoUpdate' SW mode.
 * It has served its purpose — all users now have the new SW. Keeping it active
 * causes an infinite loop:
 *   1. Page loads → unregister SW → reload
 *   2. SW re-registers → controllerchange → shows "Update" banner
 *   3. User clicks "Update" → unregister SW → reload
 *   4. Back to step 2 → infinite loop!
 *
 * The new SW (autoUpdate + skipWaiting + clientsClaim) handles updates
 * automatically without needing this aggressive cleanup.
 */

// Install global error handlers FIRST — before any other code runs
initErrorBoundary();

// Detect Capacitor native environment
const isCapNative = isCapacitorNative();

const isAndroidWebView = typeof navigator !== 'undefined' && /wv|Android.*Capacitor/i.test(navigator.userAgent);

if (isCapNative || isAndroidWebView) {
  document.documentElement.classList.add('capacitor-native');
  console.warn('[Capacitor] Native platform detected, applying mobile fixes');
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
      const cap = getCapacitor();
      cap?.Plugins?.SplashScreen?.hide?.({ fadeOutDuration: 300 });
    } catch {
      /* ignore */
    }
  };
  document.addEventListener('DOMContentLoaded', () => setTimeout(hideSplash, 500));
  setTimeout(hideSplash, 2000); // fallback
}

let _installEvent: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', ((e: Event) => {
  // Don't show install prompt in Capacitor native app
  if (isCapNative || isAndroidWebView) {
    return;
  }
  e.preventDefault();
  _installEvent = e as BeforeInstallPromptEvent;
  const btn = document.getElementById('installBtn');
  if (btn) {
    btn.style.display = '';
  }
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
if (!isCapNative && !isAndroidWebView && 'serviceWorker' in navigator) {
  let _swUpdateToastShown = false;

  /**
   * Create the update banner DOM element and attach a proper click handler
   * to the "Update now" button.
   *
   * We use addEventListener instead of inline onclick because:
   * 1. CSP may block inline handlers in some browsers
   * 2. Async functions work more reliably with addEventListener
   * 3. We can properly handle errors
   */
  function createUpdateBanner(): void {
    if (document.getElementById('updateBanner')) {
      return; // Already exists
    }
    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.style.cssText =
      'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:9999;' +
      'background:var(--accent-dark,#9a5e08);color:#fff;padding:10px 20px;border-radius:12px;' +
      'font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.3);' +
      'display:flex;align-items:center;gap:8px;';
    banner.innerHTML = updateBanner();
    document.body.appendChild(banner);

    // Attach click handler to the update button (NOT inline onclick)
    const updateBtn = banner.querySelector('.update-banner-btn');
    if (updateBtn) {
      updateBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        // Disable button to prevent double-clicks
        (updateBtn as HTMLButtonElement).disabled = true;
        (updateBtn as HTMLButtonElement).textContent = '...';
        // Hide banner immediately so it doesn't reappear on reload
        banner.style.display = 'none';
        // Set flag to suppress banner on next load (prevents loop)
        sessionStorage.setItem('_updateClicked', '1');
        // Simple reload — the SW with skipWaiting + clientsClaim
        // will have already applied the update by the time banner shows
        window.location.reload();
      });
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Prevent update banner loop: if user just clicked "Update now",
    // suppress the banner for this page load.
    if (sessionStorage.getItem('_updateClicked')) {
      sessionStorage.removeItem('_updateClicked');
      return; // Skip showing banner — user just updated
    }
    if (!_swUpdateToastShown) {
      _swUpdateToastShown = true;
      const el = document.getElementById('updateBanner');
      if (el) {
        el.style.display = 'flex';
      } else {
        createUpdateBanner();
      }
    }
  });

  navigator.serviceWorker.ready
    .then((reg) => {
      function showUpdateNotification(): void {
        const el = document.getElementById('updateBanner');
        if (el) {
          el.style.display = 'flex';
          return;
        }
        createUpdateBanner();
      }

      if (reg.waiting) {
        showUpdateNotification();
        return;
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) {
          return;
        }
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateNotification();
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    })
    .catch(() => {
      /* SW not available */
    });
} else if (isCapNative || isAndroidWebView) {
  // Unregister any existing service worker in Capacitor
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
          console.warn('[Capacitor] Unregistered service worker to prevent conflicts');
        }
      })
      .catch(() => { /* noop */ });
  }
}

initI18n().then(() => initApp());
