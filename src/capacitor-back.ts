import { closeSettings } from './settings.js';
import { state } from './state.js';
import { closeAdhkarPanel } from './adhkar.js';
import { closeFavorites } from './favorites.js';
import { closeTafsir } from './tafsir.js';
import { getCapacitor } from './types.js';
import type { CapacitorPlugins } from './types.js';

/** Capacitor App plugin interface. */
interface CapacitorAppPlugin {
  addListener: (event: string, callback: () => void) => void;
}

interface ActivePanel {
  el: HTMLElement | null;
  close: () => void;
}

export function initCapacitorBackButton(plugins?: CapacitorPlugins): void {
  const capGlobal = getCapacitor()?.Plugins as CapacitorPlugins | undefined;
  const app = plugins?.App || capGlobal?.App;
  if (!app) return;
  try {
    app.addListener?.('backButton', () => {
      // Close presentation overlay first — use proper close function
      if (state.presentationMode) {
        import('./presentation.js').then((m) => m.closePresentation()).catch(() => {});
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

      // Close any active panels/modals
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

      // Collapse player if expanded
      if (document.getElementById('player')?.classList.contains('collapsed') === false) {
        document.getElementById('player')?.classList.add('collapsed');
        return;
      }

      // Exit mushaf mode back to surah mode
      if (state.mushafMode) {
        const viewSurahBtn = document.getElementById('viewSurahBtn') as HTMLButtonElement | null;
        if (viewSurahBtn) viewSurahBtn.click();
        return;
      }

      // If search is open, close it
      const searchInputGroup = document.getElementById('searchInputGroup');
      if (searchInputGroup && !searchInputGroup.classList.contains('hidden')) {
        searchInputGroup.classList.add('hidden');
        return;
      }
    });
  } catch (e: unknown) {
    console.warn('Capacitor back button init failed:', e);
  }
}
