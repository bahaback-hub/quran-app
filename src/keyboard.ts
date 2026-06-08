import { state } from './state.js';
import { dom } from './dom.js';
import {
  togglePlayPause,
  nextAyah,
  prevAyah,
  nextSurah,
  prevSurah,
  toggleHifdh,
  toggleRepeat,
  expandPlayer,
} from './audio.js';
import { toggleNightMode, applyFontSize, openSettings, closeSettings } from './settings.js';
import { toggleFavorite, setBookmark, gotoBookmark, openFavorites, closeFavorites } from './favorites.js';
import { stopAzan } from './prayer.js';
import { toggleTafsir, closeTafsir } from './tafsir.js';
import { storage } from './storage.js';

export function initKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && state.azanPlaying) {
      stopAzan();
      return;
    }
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'SELECT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    ) {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement;
        if (target && typeof target.blur === 'function') target.blur();
        if (dom.searchResults) dom.searchResults.style.display = 'none';
      }
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        dom.searchInput?.focus();
        dom.searchInput?.select();
      }
      return;
    }
    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft':
        prevAyah();
        break;
      case 'ArrowRight':
        nextAyah(false);
        break;
      case 's':
      case 'S':
        prevSurah();
        break;
      case 'd':
      case 'D':
        nextSurah();
        break;
      case 'h':
      case 'H':
        toggleHifdh();
        break;
      case 'r':
      case 'R':
        toggleRepeat();
        break;
      case 'b':
      case 'B':
        setBookmark();
        break;
      case 'f':
      case 'F':
        toggleFavorite();
        break;
      case 't':
      case 'T':
        toggleTafsir();
        break;
      case 'n':
      case 'N':
        toggleNightMode();
        break;
      case 'm':
      case 'M':
        import('./mushaf.js').then((m: { toggleMushafMode: () => void }) => m.toggleMushafMode());
        break;
      case 'p':
      case 'P':
        if (state.presentationMode) {
          import('./presentation.js')
            .then((m: { closePresentation: () => void }) => m.closePresentation())
            .catch(() => {});
        } else {
          import('./presentation.js')
            .then((m: { openPresentation: () => void }) => m.openPresentation())
            .catch(() => {});
        }
        break;
      case 'g':
      case 'G':
        gotoBookmark();
        break;
      case '+':
      case '=':
        applyFontSize(Math.min(45, state.fontSize + 2));
        break;
      case '-':
        applyFontSize(Math.max(16, state.fontSize - 2));
        break;
      case '0':
        applyFontSize(28);
        break;
      case 'Escape':
        closeSettings();
        closeFavorites();
        if (dom.surahSecretsOverlay) {
          dom.surahSecretsOverlay.classList.add('hidden');
          dom.surahSecretsOverlay.style.display = 'none';
        }
        if (dom.searchResults) dom.searchResults.style.display = 'none';
        if (dom.shareMenu) dom.shareMenu.classList.remove('show');
        closeTafsir();
        if (dom.player && !dom.player.classList.contains('collapsed')) {
          dom.player.classList.add('collapsed');
          storage.set('player_collapsed', true);
        }
        break;
    }
  });
}
