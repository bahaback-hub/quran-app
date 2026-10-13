/**
 * Application event bindings — barrel over src/events/*.
 *
 * The bind* implementations live in focused per-domain modules; this file
 * only re-exports them (so every existing import path keeps working) and
 * hosts bindAllEvents, which registers everything at startup.
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
 * Register all application event bindings at once.
 */
export function bindAllEvents(): void {
  bindNavigationEvents();
  bindHeaderAndSettingsEvents();
  bindAzanEvents();
  bindTafsirEvents();
  bindDisplaySettingsEvents();
  bindPanelsAndShareEvents();
  bindSearchEvents();
  bindGlobalClickHandler();
  bindHeaderMenuEvents();
  bindMiscEvents();
  bindHelpEvents();
}
