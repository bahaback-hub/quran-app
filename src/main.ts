import { initErrorBoundary } from './error-boundary.js';
import { initApp } from './app.js';
import { initI18n, __ } from './i18n.js';
import { isCapacitorNative, getCapacitor } from './types.js';
import { updateBanner } from './templates.js';

/**
 * Performance: Load non-critical modules lazily after initial render.
 * Web Vitals monitoring and Memory Manager are useful but not needed
 * for first paint. Loading them lazily improves Time to Interactive.
 */
function loadNonCriticalModules(): void {
  // Use requestIdleCallback to defer until browser is idle
  const load = (): void => {
    import('./web-vitals.js')
      .then(({ initWebVitalsMonitoring }) => initWebVitalsMonitoring())
      .catch(() => {
        /* non-critical */
      });
    import('./memory-manager.js')
      .then(({ initMemoryManager }) => initMemoryManager())
      .catch(() => {
        /* non-critical */
      });
  };

  if ('requestIdleCallback' in window) {
    (window as Window).requestIdleCallback(load, { timeout: 3000 });
  } else {
    setTimeout(load, 2000);
  }
}

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
  let _swUpdateInProgress = false;
  let _swReloadFallback: number | null = null;

  function hideUpdateBanner(): void {
    document.getElementById('updateBanner')?.remove();
    _swUpdateToastShown = false;
  }

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
    // On mobile, the player (44px) + bottom-nav (56px) occupy the bottom ~100px.
    // Desktop only has the player (~55px) at bottom:0, so 70px clears it.
    // Use a CSS class instead of inline bottom so media queries can adjust it.
    banner.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);z-index:9999;' +
      'background:var(--accent-dark,#9a5e08);color:#fff;padding:10px 20px;border-radius:12px;' +
      'font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.3);' +
      'display:flex;align-items:center;gap:8px;';
    banner.classList.add('update-banner');
    banner.innerHTML = updateBanner();
    document.body.appendChild(banner);

    // Attach click handler to the update button (NOT inline onclick)
    const updateBtn = banner.querySelector('.update-banner-btn');
    if (updateBtn) {
      updateBtn.addEventListener('click', async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (_swUpdateInProgress) {
          return;
        }
        _swUpdateInProgress = true;
        // Disable button to prevent double-clicks
        (updateBtn as HTMLButtonElement).disabled = true;
        (updateBtn as HTMLButtonElement).textContent = 'جارٍ التحديث…';
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration?.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            // Reload only after the new worker controls the page. The fallback
            // protects browsers that do not emit controllerchange reliably.
            _swReloadFallback = window.setTimeout(() => window.location.reload(), 8_000);
          } else {
            window.location.reload();
          }
        } catch {
          window.location.reload();
        }
      });
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swReloadFallback !== null) {
      window.clearTimeout(_swReloadFallback);
      _swReloadFallback = null;
    }
    hideUpdateBanner();
    if (_swUpdateInProgress) {
      window.location.reload();
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
            // Wait for `registration.waiting` so the action reliably applies
            // the exact worker advertised by the banner.
            window.setTimeout(() => {
              if (reg.waiting) {
                showUpdateNotification();
              }
            }, 0);
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
      .catch(() => {
        /* noop */
      });
  }
}

// Performance: Load non-critical modules (Web Vitals, Memory Manager) lazily
// after the browser is idle. This improves Time to Interactive.
loadNonCriticalModules();

initI18n().then(() => initApp());

/**
 * Mobile panel observer.
 *
 * Watches the sliding panels (settings / favorites / adhkar / tafsir / help /
 * mushaf-surah-overlay) for `open` class changes and toggles body classes:
 *   - `panel-open`      → any panel is open (hides bottom-nav + player on mobile)
 *   - `tafsir-only-open` → only the tafsir curtain is open (keeps player visible)
 *
 * This keeps the mobile UI usable: panels that take full-screen width no longer
 * get their bottom content covered by the fixed bottom-nav (z-index 5000) and
 * floating player. See responsive.css for the matching CSS rules.
 *
 * Implementation note: uses subtree:true on document.body because some panels
 * (settings, help, sleep-timer, etc.) are injected dynamically by overlays.ts
 * AFTER this observer is set up. Without subtree, we'd miss their class changes.
 */
function setupMobilePanelObserver(): void {
  const PANEL_SELECTOR = [
    '.settings-panel',
    '.favorites-panel',
    '.adhkar-panel',
    '.tafsir-curtain',
    '.help-panel',
    '.mushaf-surah-overlay',
    '.sleep-timer-overlay',
  ].join(',');

  let rafId = 0;
  const updateBodyClasses = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const panels = document.querySelectorAll<HTMLElement>(PANEL_SELECTOR);
      let anyOpen = false;
      let tafsirOpen = false;
      let otherOpen = false;
      panels.forEach((p) => {
        // Consider visibility: hidden + display:none as closed
        const cs = getComputedStyle(p);
        if (cs.display === 'none' || cs.visibility === 'hidden') {
          return;
        }
        if (p.classList.contains('open') && !p.classList.contains('hidden')) {
          anyOpen = true;
          if (p.id === 'tafsirCurtain') {
            tafsirOpen = true;
          } else {
            otherOpen = true;
          }
        }
      });
      document.body.classList.toggle('panel-open', anyOpen);
      // "tafsir only" = tafsir is open AND nothing else is
      document.body.classList.toggle('tafsir-only-open', tafsirOpen && !otherOpen);
    });
  };

  const start = () => {
    updateBodyClasses();
    // Watch the entire body subtree for class attribute changes. This catches
    // panels that exist now AND panels injected later (overlays.ts injects
    // settings-panel, help-panel, sleep-timer-overlay after initApp()).
    const observer = new MutationObserver(() => updateBodyClasses());
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
      childList: true,
    });
    // Also re-check on resize (in case viewport changes desktop <-> mobile)
    window.addEventListener('resize', updateBodyClasses, { passive: true });
    // Re-check shortly after page load in case panels are added dynamically
    setTimeout(updateBodyClasses, 1500);
    setTimeout(updateBodyClasses, 3000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

setupMobilePanelObserver();
