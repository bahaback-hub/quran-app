/**
 * Manual application update check (Settings → "Check for updates").
 *
 * The service worker already updates itself in the background, but users who
 * keep the app open (or installed PWA users on stale caches) may never see
 * the new version. This module lets them check on demand:
 *
 * - settings UI dispatches `app:check-updates` (see app-events.ts),
 * - main.ts runs `checkForAppUpdates()` and shows the standard update banner
 *   via `app:update-available` when a newer worker is ready.
 */

import { __ } from './i18n.js';

export type UpdateCheckResult = 'updated' | 'up-to-date' | 'failed' | 'unsupported';

/** Name of the event settings dispatches to request a check. */
export const CHECK_UPDATES_EVENT = 'app:check-updates';

/** Name of the event fired when a newer worker is ready to apply. */
export const UPDATE_AVAILABLE_EVENT = 'app:update-available';

/** How long to wait for a downloading worker before giving up. */
const INSTALL_TIMEOUT_MS = 20_000;

/** Wait until the installing worker reaches `installed` (or fails/times out). */
function waitForInstalled(reg: ServiceWorkerRegistration): Promise<boolean> {
  return new Promise((resolve) => {
    const worker = reg.installing;
    if (!worker) {
      resolve(false);
      return;
    }
    if (worker.state === 'installed') {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => resolve(false), INSTALL_TIMEOUT_MS);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        clearTimeout(timer);
        resolve(true);
      } else if (worker.state === 'redundant') {
        clearTimeout(timer);
        resolve(false);
      }
    });
  });
}

/**
 * Check for a newer service worker and report the outcome in `statusEl`.
 * Fires UPDATE_AVAILABLE_EVENT when an update is ready to apply.
 */
export async function checkForAppUpdates(statusEl: HTMLElement | null): Promise<UpdateCheckResult> {
  const setStatus = (key: 'update_checking' | 'update_up_to_date' | 'update_check_failed'): void => {
    if (statusEl) {
      statusEl.textContent = __(key);
    }
  };
  try {
    if (!('serviceWorker' in navigator)) {
      return 'unsupported';
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      setStatus('update_up_to_date');
      return 'up-to-date';
    }
    setStatus('update_checking');
    await reg.update();
    if (reg.waiting) {
      window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
      return 'updated';
    }
    if (reg.installing) {
      const installed = await waitForInstalled(reg);
      if (installed && reg.waiting) {
        window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
        return 'updated';
      }
    }
    setStatus('update_up_to_date');
    return 'up-to-date';
  } catch {
    setStatus('update_check_failed');
    return 'failed';
  }
}
