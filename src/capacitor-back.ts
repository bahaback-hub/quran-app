import { closeSettings } from './settings.js';
import { state } from './state.js';
import { closeAdhkarPanel } from './adhkar.js';
import { closeFavorites } from './favorites.js';
import { closeTafsir } from './tafsir.js';

/** Capacitor App plugin interface. */
interface CapacitorAppPlugin {
  addListener: (event: string, callback: () => void) => void;
}

/** Capacitor plugins shape. */
interface CapacitorPlugins {
  App?: CapacitorAppPlugin;
}

/** Capacitor global interface. */
interface CapacitorGlobal {
  Plugins?: CapacitorPlugins;
}

interface ActivePanel {
  el: HTMLElement | null;
  close: () => void;
}

export function initCapacitorBackButton(plugins?: CapacitorPlugins): void {
  const capGlobal = (typeof globalThis !== 'undefined' &&
    (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor?.Plugins) as CapacitorPlugins | undefined;
  const app = plugins?.App || capGlobal?.App;
  if (!app) return;
  try {
    app.addListener('backButton', () => {
      const activeElements: ActivePanel[] = [
        { el: document.getElementById('settingsPanel'), close: () => closeSettings() },
        {
          el: document.getElementById('adhkarPanel'),
          close: () => {
            if (state.adhkarPanelOpen) closeAdhkarPanel();
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
        const isVisible = el && (
          el.classList.contains('open') ||
          (!el.classList.contains('hidden') && el.style.display && el.style.display !== 'none')
        );
        if (isVisible) {
          close();
          return;
        }
      }
      if (document.getElementById('player')?.classList.contains('collapsed') === false) {
        document.getElementById('player')?.classList.add('collapsed');
      }
    });
  } catch (e: unknown) {
    console.warn('Capacitor back button init failed:', e);
  }
}
