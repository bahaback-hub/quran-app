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
import { activateAtCursor, activateEl, isPointerMode, movePointer, setPointerMode } from './pointer-nav.js';

/** Long-press threshold distinguishing OK click from pointer-mode toggle. */
const OK_LONG_PRESS_MS = 1000;

interface OkPress {
  el: Element;
  timer: ReturnType<typeof setTimeout>;
  /** True when the press started outside an actionable control: a tap must
      stay a no-op (previous behavior) while a long-press still enters
      pointer mode (e.g. while reading ayah text with focus on body). */
  tapNoop: boolean;
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
  const t = e.target as HTMLElement | null;
  if (e.repeat) {
    // A held OK key must not keep re-activating a focused control through
    // the native default (e.g. the covered shortcut button re-opening the
    // presentation while the long-press is still building). Text fields and
    // selects keep their native caret/space repeat untouched.
    if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'SELECT' && t.tagName !== 'TEXTAREA')) {
      e.preventDefault();
    }
    return true;
  }
  if (_okLongFired && !_okPending) {
    // A previous keyup was never observed (lost on real remotes too);
    // treat this press as fresh instead of sticking.
    _okLongFired = false;
  }
  if (_okPending || _okLongFired) {
    if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'SELECT' && t.tagName !== 'TEXTAREA')) {
      e.preventDefault();
    }
    return true;
  }
  if (isPointerMode()) {
    e.preventDefault();
    clearOkPending();
    _okPending = {
      el: document.body,
      tapNoop: false,
      timer: setTimeout(() => {
        _okLongFired = true;
        _okPending = null;
        setPointerMode(false);
      }, OK_LONG_PRESS_MS),
    };
    return true;
  }
  const actionable =
    t &&
    t !== document.body &&
    (t.tagName === 'BUTTON' ||
      t.tagName === 'A' ||
      (typeof t.hasAttribute === 'function' && t.hasAttribute('tabindex')));
  if (!t || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') {
    return false;
  }
  if (!actionable && e.key === ' ') {
    // Legacy: a Space tap with unfocused content toggles playback via the
    // switch below — only Enter (the remote OK key) gets the relaxed entry.
    return false;
  }
  // A long-press enters pointer mode from anywhere readable (ayah text,
  // body, plain containers) — not only actionable controls. A tap on a
  // non-actionable target stays a no-op via tapNoop. (Editable fields and
  // native selects return earlier above, so reaching here is always safe.)
  e.preventDefault();
  clearOkPending();
  _okPending = {
    el: actionable ? t : document.body,
    tapNoop: !actionable,
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
  if (!pending || pending.tapNoop) {
    return;
  }
  if (isPointerMode()) {
    activateAtCursor();
    return;
  }
  activateEl(pending.el);
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
