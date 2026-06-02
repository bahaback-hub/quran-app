export function initCapacitorBackButton(plugins) {
  const app = plugins?.App || (typeof globalThis.Capacitor !== 'undefined' && globalThis.Capacitor.Plugins?.App);
  if (!app) return;
  try {
    app.addListener('backButton', () => {
      const activeElements = [
        { el: document.getElementById('settingsPanel'), close: () => import('./settings.js').then(m => m.closeSettings()) },
        { el: document.getElementById('adhkarPanel'), close: () => import('./state.js').then(({state}) => { if (state.adhkarPanelOpen) import('./adhkar.js').then(m => m.closeAdhkarPanel()); }) },
        { el: document.getElementById('favoritesPanel'), close: () => import('./favorites.js').then(m => m.closeFavorites()) },
        { el: document.getElementById('ayahModal'), close: () => document.getElementById('ayahModalCloseBtn')?.click() },
        { el: document.getElementById('tafsirCurtain'), close: () => import('./tafsir.js').then(m => m.closeTafsir()) }
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
