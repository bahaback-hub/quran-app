import { closeSettings } from './settings.js';
import { state } from './state.js';
import { closeAdhkarPanel } from './adhkar.js';
import { closeFavorites } from './favorites.js';
import { closeTafsir } from './tafsir.js';

export function initCapacitorBackButton(plugins) {
  const app = plugins?.App || (typeof globalThis.Capacitor !== 'undefined' && globalThis.Capacitor.Plugins?.App);
  if (!app) return;
  try {
    app.addListener('backButton', () => {
      const activeElements = [
        { el: document.getElementById('settingsPanel'), close: () => closeSettings() },
        { el: document.getElementById('adhkarPanel'), close: () => { if (state.adhkarPanelOpen) closeAdhkarPanel(); } },
        { el: document.getElementById('favoritesPanel'), close: () => closeFavorites() },
        { el: document.getElementById('ayahModal'), close: () => document.getElementById('ayahModalCloseBtn')?.click() },
        { el: document.getElementById('tafsirCurtain'), close: () => closeTafsir() }
      ];
      for (const { el, close } of activeElements) {
        if (el && el.style.display !== 'none' && el.style.display !== '') {
          close();
          return;
        }
      }
      if (document.getElementById('player')?.classList.contains('collapsed') === false) {
        document.getElementById('player')?.classList.add('collapsed');
      }
    });
  } catch (e) {
    console.warn('Capacitor back button init failed:', e);
  }
}
