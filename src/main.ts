import { initErrorBoundary } from './error-boundary.js';
import { initApp } from './app.js';
import { initI18n, __ } from './i18n.js';
import { isCapacitorNative, getCapacitor } from './types.js';
import { updateBanner } from './templates.js';

/**
 * AGGRESSIVE Service Worker cleanup — runs BEFORE anything else.
 *
 * Problem: Users with an old SW (registered with 'prompt' mode) are stuck
 * with the old cached version. Even after deploying 'autoUpdate' mode,
 * the OLD service worker is still active in their browser and intercepting
 * requests with stale cache.
 *
 * Solution: Forcefully unregister ALL existing service workers on every
 * page load. The new SW (with autoUpdate + skipWaiting) will re-register
 * immediately with the latest version.
 *
 * This is a one-time migration — once users get the new SW, future updates
 * will be automatic (no need for this aggressive cleanup).
 */
async function forceUnregisterOldServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      return;
    }
    // Forcefully unregister all SWs — the new SW (autoUpdate mode)
    // will re-register immediately via injectRegister: 'auto'.
    await Promise.all(registrations.map((reg) => reg.unregister()));

    // Also clear ALL caches to remove stale entries from the old SW.
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // If we just unregistered a SW, force a reload to get fresh content
    // (only if this is the first load after unregister, not a loop).
    if (registrations.length > 0 && !sessionStorage.getItem('_swCleared')) {
      sessionStorage.setItem('_swCleared', '1');
      window.location.reload();
      return;
    }
  } catch (err) {
    console.warn('[SW Cleanup] Failed to unregister old SW:', err);
  }
}

// Run cleanup FIRST, before any other code
if (typeof window !== 'undefined' && !isCapacitorNative()) {
  // Use top-level await pattern via IIFE to avoid blocking module load
  void forceUnregisterOldServiceWorkers();
}

/**
 * Global function called by the "Update now" button in the update banner.
 * Kept for backward compatibility — but the actual button now uses
 * addEventListener (see createUpdateBanner above) which is more reliable.
 */
if (typeof window !== 'undefined') {
  (window as unknown as { forceUpdateApp?: () => void }).forceUpdateApp = async function (): Promise<void> {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      sessionStorage.removeItem('_swCleared');
    } catch (err) {
      console.warn('[forceUpdateApp] Cleanup failed:', err);
    }
    // Use href with cache-busting query param instead of reload()
    // to force the browser to fetch fresh content (bypassing any remaining cache)
    const href = window.location.href.split('#')[0]?.split('?')[0] ?? '/';
    window.location.href = href + '?_t=' + Date.now();
  };
}

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
      updateBtn.addEventListener('click', async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        // Disable button to prevent double-clicks
        (updateBtn as HTMLButtonElement).disabled = true;
        (updateBtn as HTMLButtonElement).textContent = '...';
        try {
          // 1. Unregister ALL service workers
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
          // 2. Clear ALL caches
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          // 3. Clear sessionStorage flag
          sessionStorage.removeItem('_swCleared');
        } catch (err) {
          console.warn('[Update] Cleanup failed:', err);
        }
        // 4. Hard reload — bypass cache completely using cache-busting URL
        const currentHref = window.location.href.split('#')[0]?.split('?')[0] ?? '/';
        window.location.href = currentHref + '?_t=' + Date.now();
      });
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
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
