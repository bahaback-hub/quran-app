/**
 * @module capacitor-back
 * @description Capacitor back button handler for the Quran app. Implements the
 * hardware back button behavior on Android/Capacitor builds, closing panels and
 * overlays in a priority order: presentation → mushaf overlay → secrets overlay →
 * active panels (settings, adhkar, favorites, ayah modal, tafsir) → player
 * collapse → mushaf mode exit. The reader search field is permanently visible,
 * so Android back now leaves it in place rather than hiding a core control.
 */

import { closeSettings } from './settings.js';
import { state } from './state.js';
import { closeAdhkarPanel } from './adhkar.js';
import { closeFavorites } from './favorites.js';
import { closeTafsir } from './tafsir.js';
import { hideQiblaCompass } from './prayer.js';
import { __ } from './i18n.js';
import { getCapacitor } from './types.js';
import type { CapacitorPlugins } from './types.js';

/** Represents an active panel/modal that can be closed by the back button. */
interface ActivePanel {
  el: HTMLElement | null;
  close: () => void;
}

/**
 * Initialize the Capacitor hardware back button handler.
 * Registers a listener that closes panels/overlays in priority order when
 * the Android back button is pressed. If the Capacitor App plugin is not
 * available (e.g., running in a browser), this function exits silently.
 *
 * @param plugins - Optional Capacitor plugins object for testing or custom injection.
 *
 * @example
 * initCapacitorBackButton();               // auto-detect Capacitor
 * initCapacitorBackButton(customPlugins);  // inject custom plugins
 */
export function initCapacitorBackButton(plugins?: CapacitorPlugins): void {
  const capGlobal = getCapacitor()?.Plugins as CapacitorPlugins | undefined;
  const app = plugins?.App || capGlobal?.App;
  if (!app) {
    return;
  }
  try {
    app.addListener?.('backButton', () => {
      // Close presentation overlay first — use proper close function
      if (state.presentationMode) {
        import('./presentation.js')
          .then((m) => m.closePresentation())
          .catch(() => {
            /* noop */
          });
        return;
      }

      // Close mushaf surah overlay
      const mushafOverlay = document.getElementById('mushafSurahOverlay');
      if (mushafOverlay && !mushafOverlay.classList.contains('hidden')) {
        mushafOverlay.classList.add('hidden');
        mushafOverlay.style.display = 'none';
        return;
      }

      // Close surah secrets overlay
      const secretsOverlay = document.getElementById('surahSecretsOverlay');
      if (secretsOverlay && !secretsOverlay.classList.contains('hidden')) {
        secretsOverlay.classList.add('hidden');
        secretsOverlay.style.display = 'none';
        return;
      }

      const qiblaOverlay = document.getElementById('qiblaOverlay');
      if (qiblaOverlay && !qiblaOverlay.classList.contains('hidden')) {
        hideQiblaCompass();
        return;
      }

      const helpPanel = document.getElementById('helpPanel');
      if (helpPanel?.classList.contains('open')) {
        document.getElementById('helpCloseBtn')?.click();
        return;
      }

      const readingStatsPanel = document.getElementById('readingStatsPanel');
      if (
        readingStatsPanel &&
        !readingStatsPanel.classList.contains('hidden') &&
        readingStatsPanel.style.display !== 'none'
      ) {
        document.getElementById('readingStatsCloseBtn')?.click();
        return;
      }

      const sleepTimerModal = document.getElementById('sleepTimerModal');
      if (sleepTimerModal) {
        (sleepTimerModal.querySelector('.modal-btn-cancel') as HTMLButtonElement | null)?.click();
        return;
      }

      // Close any active panels/modals
      const activeElements: ActivePanel[] = [
        { el: document.getElementById('settingsPanel'), close: () => closeSettings() },
        {
          el: document.getElementById('adhkarPanel'),
          close: () => {
            if (state.adhkarPanelOpen) {
              closeAdhkarPanel();
            }
          },
        },
        { el: document.getElementById('favoritesPanel'), close: () => closeFavorites() },
        {
          el: document.getElementById('ayahModal'),
          close: () => document.getElementById('ayahModalCloseBtn')?.click(),
        },
        { el: document.getElementById('tafsirCurtain'), close: () => closeTafsir() },
      ];
      for (const { el, close } of activeElements) {
        // Check visibility using CSS classes (open/hidden) not inline display
        const isVisible =
          el &&
          (el.classList.contains('open') ||
            (!el.classList.contains('hidden') && el.style.display && el.style.display !== 'none'));
        if (isVisible) {
          close();
          return;
        }
      }

      // Collapse player if expanded
      if (document.getElementById('player')?.classList.contains('collapsed') === false) {
        document.getElementById('player')?.classList.add('collapsed');
        return;
      }

      // Exit mushaf mode back to surah mode
      if (state.mushafMode) {
        const viewSurahBtn = document.getElementById('viewSurahBtn') as HTMLButtonElement | null;
        if (viewSurahBtn) {
          viewSurahBtn.click();
        }
        return;
      }

      // At the reader root, Android back is destructive. Ask explicitly before exiting.
      if (window.confirm(__('exit_app_confirm'))) {
        app.exitApp?.();
      }
    });
  } catch (e: unknown) {
    console.warn('Capacitor back button init failed:', e);
  }
}
