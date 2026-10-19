/**
 * Capacitor splash-screen dismissal for the native Android build.
 *
 * `capacitor.config.ts` sets `launchAutoHide: true`, so the native plugin
 * normally hides the splash on its own. This is the JS safety net for the case
 * where that signal is missed; it must hide the splash as early as possible.
 *
 * History: the original safety net waited 500ms after `DOMContentLoaded` and
 * then asked for a 300ms fade. That ~0.8s was dead splash time the user saw on
 * every cold start. Hiding at `DOMContentLoaded` is safe because the page body
 * already paints its themed background (`var(--bg-gradient)`) and MainActivity
 * pre-colours the WebView, so there is no white flash to cover.
 */

import { getCapacitor } from './types.js';

/** Fade applied when we ask the plugin to hide; short so it is not a felt delay. */
const FADE_MS = 100;

/** Last-resort delay if the native plugin never becomes available. */
export const SPLASH_FALLBACK_MS = 2000;

/** Ask the Capacitor SplashScreen plugin to hide; safe to call more than once. */
export function hideNativeSplash(): void {
  try {
    const cap = getCapacitor();
    cap?.Plugins?.SplashScreen?.hide?.({ fadeOutDuration: FADE_MS });
  } catch {
    /* the plugin is optional; a missing hide is not fatal */
  }
}

/**
 * Hide the splash as soon as the document is parsed, with a single fallback
 * timer in case the DOM-ready event already passed or never arrives.
 */
export function dismissSplashOnReady(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideNativeSplash, { once: true });
  } else {
    hideNativeSplash();
  }
  setTimeout(hideNativeSplash, SPLASH_FALLBACK_MS);
}
