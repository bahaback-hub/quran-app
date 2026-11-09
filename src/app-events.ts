/**
 * Application event bindings — barrel over src/events/*.
 *
 * The bind* implementations live in focused per-domain modules; this file
 * only re-exports them (so every existing import path keeps working) and
 * hosts the grouped startup binders.
 */
import { bindHelpEvents } from './events/help-events.js';
import { bindNavigationEvents } from './events/navigation-events.js';
import { bindHeaderAndSettingsEvents, bindDisplaySettingsEvents } from './events/settings-events.js';
import { bindAzanEvents, bindTafsirEvents } from './events/media-events.js';
import {
  bindPanelsAndShareEvents,
  bindSearchEvents,
  bindGlobalClickHandler,
  bindHeaderMenuEvents,
  bindMiscEvents,
  initAutoPlayNextButton,
} from './events/reader-events.js';

export {
  bindHelpEvents,
  bindNavigationEvents,
  bindHeaderAndSettingsEvents,
  bindDisplaySettingsEvents,
  bindAzanEvents,
  bindTafsirEvents,
  bindPanelsAndShareEvents,
  bindSearchEvents,
  bindGlobalClickHandler,
  bindHeaderMenuEvents,
  bindMiscEvents,
  initAutoPlayNextButton,
};

/**
 * Register only the controls needed during the first interaction window.
 * Keep this group synchronous so navigation and settings work immediately.
 */
export function bindCriticalEvents(): void {
  bindNavigationEvents();
  bindHeaderAndSettingsEvents();
  bindDisplaySettingsEvents();
  bindGlobalClickHandler();
}

/**
 * Register the remaining integrations: azan, tafsir, panels/share, search,
 * header menu, misc overlays and the guide.
 *
 * Called in the same turn as {@link bindCriticalEvents} — listener registration
 * is cheap, and delaying it left those controls inert after the first paint.
 */
export function bindDeferredEvents(): void {
  bindAzanEvents();
  bindTafsirEvents();
  bindPanelsAndShareEvents();
  bindSearchEvents();
  bindHeaderMenuEvents();
  bindMiscEvents();
  bindHelpEvents();
}

/**
 * Backwards-compatible all-at-once binder for callers outside the boot path.
 * The application boot uses the two grouped functions above to yield between
 * critical and secondary event registration.
 */
export function bindAllEvents(): void {
  bindCriticalEvents();
  bindDeferredEvents();
}
