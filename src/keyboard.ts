/**
 * @module keyboard
 * @description Keyboard shortcuts for the Quran app. Registers global keydown
 * listeners that provide quick access to playback controls (play/pause, next/prev
 * ayah/surah), bookmark & favorite toggling, tafsir, night mode, mushaf mode,
 * presentation mode, font size adjustment, and panel dismissal via Escape.
 */

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
  collapsePlayer,
} from './features/audio/audio.js';
import { toggleNightMode, applyFontSize, closeSettings } from './settings.js';
import { toggleFavorite, setBookmark, gotoBookmark, closeFavorites } from './favorites.js';
import { stopAzan } from './features/prayer/prayer.js';
import { toggleTafsir, closeTafsir } from './tafsir.js';
import { isTvNavActive, moveTvFocus } from './tv-nav.js';
import { activateAtCursor, isPointerMode, movePointer, setPointerMode } from './pointer-nav.js';

/** Long-press threshold distinguishing OK click from pointer-mode toggle. */
const OK_LONG_PRESS_MS = 700;

interface OkPress {
  el: Element;
  timer: ReturnType<typeof setTimeout>;
}

let _okPending: OkPress | null = null;
let _okLongFired = false;
let _pointerStreak = 0;
let _pointerLastMove = 0;

function clearOkPending(): void {
  if (_okPending) {
    clearTimeout(_okPending.timer);
    _okPending = null;
  }
}

/** True for the remote OK key in all its browser spellings. */
function isOkKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

/**
 * Intercept OK in TV mode: hold to toggle pointer mode, tap to activate.
 * Returns true when the event was consumed. Non-TV behavior is untouched.
 */
function beginOkPress(e: KeyboardEvent): boolean {
  if (e.repeat) {
    return true;
  }
  if (_okLongFired && !_okPending) {
    // A previous keyup was never observed (lost on real remotes too);
    // treat this press as fresh instead of sticking.
    _okLongFired = false;
  }
  if (_okPending || _okLongFired) {
    return true;
  }
  if (isPointerMode()) {
    e.preventDefault();
    clearOkPending();
    _okPending = {
      el: document.body,
      timer: setTimeout(() => {
        _okLongFired = true;
        _okPending = null;
        setPointerMode(false);
      }, OK_LONG_PRESS_MS),
    };
    return true;
  }
  const t = e.target as HTMLElement | null;
  const actionable =
    t &&
    t !== document.body &&
    (t.tagName === 'BUTTON' ||
      t.tagName === 'A' ||
      (typeof t.hasAttribute === 'function' && t.hasAttribute('tabindex')));
  if (!actionable) {
    return false;
  }
  e.preventDefault();
  clearOkPending();
  _okPending = {
    el: t,
    timer: setTimeout(() => {
      _okLongFired = true;
      _okPending = null;
      setPointerMode(true);
    }, OK_LONG_PRESS_MS),
  };
  return true;
}

/** Resolve a pending OK press on key release: click on tap, nothing on hold. */
function endOkPress(): void {
  if (_okLongFired) {
    _okLongFired = false;
    return;
  }
  const pending = _okPending;
  clearOkPending();
  if (!pending) {
    return;
  }
  if (isPointerMode()) {
    activateAtCursor();
    return;
  }
  if (pending.el instanceof HTMLElement) {
    pending.el.click();
  }
}

/** Advance the acceleration streak and move the pointer one step. */
function pointerMove(direction: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): void {
  const now = Date.now();
  _pointerStreak = now - _pointerLastMove < 300 ? _pointerStreak + 1 : 0;
  _pointerLastMove = now;
  movePointer(direction, _pointerStreak);
}

/**
 * Initialize global keyboard shortcut listeners.
 * Binds keydown events for playback, navigation, toggles, and Escape dismissal.
 * Should be called once during app startup.
 *
 * @example
 * initKeyboardShortcuts(); // call after cacheDom()
 */
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
        if (target && typeof target.blur === 'function') {
          target.blur();
        }
        if (dom.searchResults) {
          dom.searchResults.style.display = 'none';
        }
      }
      // In TV mode the remote has no cursor keys: vertical arrows leave text
      // fields toward neighboring controls (e.g. down to the on-screen
      // keyboard), while horizontal arrows keep native caret movement and
      // SELECT popups stay fully native for the system picker.
      if (
        isTvNavActive() &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        (e.target as HTMLElement).tagName !== 'SELECT'
      ) {
        e.preventDefault();
        moveTvFocus(e.key === 'ArrowUp' ? 'ArrowUp' : 'ArrowDown');
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
      case 'Enter':
        if (isTvNavActive() && beginOkPress(e)) {
          break;
        }
        if (e.key === ' ') {
          e.preventDefault();
          togglePlayPause();
        }
        break;
      case 'ArrowLeft':
        if (isTvNavActive()) {
          e.preventDefault();
          if (isPointerMode()) {
            pointerMove('ArrowLeft');
          } else {
            moveTvFocus('ArrowLeft');
          }
          break;
        }
        prevAyah();
        break;
      case 'ArrowRight':
        if (isTvNavActive()) {
          e.preventDefault();
          if (isPointerMode()) {
            pointerMove('ArrowRight');
          } else {
            moveTvFocus('ArrowRight');
          }
          break;
        }
        nextAyah(false);
        break;
      case 'ArrowUp':
        if (isTvNavActive()) {
          e.preventDefault();
          if (isPointerMode()) {
            pointerMove('ArrowUp');
          } else {
            moveTvFocus('ArrowUp');
          }
        }
        break;
      case 'ArrowDown':
        if (isTvNavActive()) {
          e.preventDefault();
          if (isPointerMode()) {
            pointerMove('ArrowDown');
          } else {
            moveTvFocus('ArrowDown');
          }
        }
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
        import('./features/mushaf/mushaf.js').then((m: { toggleMushafMode: () => void }) => m.toggleMushafMode());
        break;
      case 'p':
      case 'P':
        if (state.presentationMode) {
          import('./features/presentation/presentation.js')
            .then((m: { closePresentation: () => void }) => m.closePresentation())
            .catch(() => {
              /* noop */
            });
        } else {
          import('./features/presentation/presentation.js')
            .then((m: { openPresentation: () => void }) => m.openPresentation())
            .catch(() => {
              /* noop */
            });
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
        // Pointer mode exits first — it is a transient cursor state, not content.
        if (isPointerMode()) {
          setPointerMode(false);
          break;
        }
        // If presentation mode is active, let the presentation's own handler manage Escape
        if (state.presentationMode) {
          return;
        }
        closeSettings();
        closeFavorites();
        if (dom.surahSecretsOverlay) {
          dom.surahSecretsOverlay.classList.add('hidden');
          dom.surahSecretsOverlay.style.display = 'none';
        }
        if (dom.searchResults) {
          dom.searchResults.style.display = 'none';
        }
        closeTafsir();
        if (dom.player && !dom.player.classList.contains('collapsed')) {
          collapsePlayer();
        }
        break;
      default:
        break;
    }
  });
  document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (isTvNavActive() && isOkKey(e.key)) {
      endOkPress();
    }
  });
}
