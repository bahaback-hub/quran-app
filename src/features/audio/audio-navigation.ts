/**
 * Audio navigation — next/prev ayah and surah transitions.
 * Extracted from features/audio/audio.ts. The engine injects its actions
 * (playCurrentAyah / setStoppedState) via initAudioNavigationHost because this
 * module must not import the engine (circular import).
 */
import { state } from '../../state.js';
import { dom } from '../../dom.js';
import type { LoadSurahFn } from './audio-types.js';

/** Inject the loadSurah callback from app.ts (avoids circular import). */
let _loadSurah: LoadSurahFn | null = null;

/** Injectable highlightCurrentAyah callback (avoids circular import). */
let _highlightAyah: (() => void) | null = null;

/**
 * Inject the loadSurah callback from app.ts.
 * Required to avoid circular imports — app.ts calls this during initialization.
 *
 * @param fn The function to call when loading a new surah
 */
export function setLoadSurah(fn: LoadSurahFn): void {
  _loadSurah = fn;
}

/**
 * Inject the highlightCurrentAyah callback from app.ts.
 * Required to avoid circular imports — app.ts calls this during initialization.
 *
 * @param fn The function to call to highlight the current ayah in the reader
 */
export function setHighlightAyah(fn: () => void): void {
  _highlightAyah = fn;
}

/** Highlight the current ayah via the injected reader callback (safe no-op). */
export function highlightCurrentAyah(): void {
  _highlightAyah?.();
}

/** Engine actions injected by audio.ts at module scope (importing them back would cycle). */
let _playCurrentAyah: (() => Promise<void>) | null = null;
let _setStoppedState: (() => void) | null = null;

export function initAudioNavigationHost(host: {
  playCurrentAyah: () => Promise<void>;
  setStoppedState: () => void;
}): void {
  _playCurrentAyah = host.playCurrentAyah;
  _setStoppedState = host.setStoppedState;
}

/**
 * Advance to the next ayah, or the next surah if at the end.
 * @param autoFromRepeat Whether this was triggered automatically by repeat mode
 */
export function nextAyah(autoFromRepeat: boolean): void {
  if (!state.surahData) {
    return;
  }
  if (!state.ayahsAudios?.length) {
    // The boot-time audio fetch can still be in flight while the user taps
    // "next": swallowing the click silently left the label unchanged for
    // seconds (observed as an E2E flake on loaded CI runners). Advance the
    // highlight against the surah's text length instead; playback resumes
    // once the audio list arrives.
    const total = state.surahData.ayahs.length;
    if (total > 0 && state.currentAyahIndex < total - 1) {
      state.currentAyahIndex++;
      highlightCurrentAyah();
    }
    return;
  }
  if (state.currentAyahIndex < state.ayahsAudios.length - 1) {
    state.currentAyahIndex++;
    highlightCurrentAyah();
    if (autoFromRepeat || state.isPlaying) {
      _playCurrentAyah?.();
    }
  } else if (state.currentSurah < 114) {
    if (state.mushafMode) {
      dom.audioPlayer?.pause();
      _setStoppedState?.();
      return;
    }
    nextSurah();
  }
}

/**
 * Go to the previous ayah, or the previous surah if at the beginning.
 * Automatically starts playback if currently playing.
 */
export function prevAyah(): void {
  if (!state.surahData) {
    return;
  }
  if (state.currentAyahIndex > 0) {
    state.currentAyahIndex--;
    highlightCurrentAyah();
    if (state.isPlaying) {
      _playCurrentAyah?.();
    }
  } else if (state.currentSurah > 1) {
    prevSurah();
  }
}

/**
 * Load the next surah, preserving current playback state.
 * Calls the injected loadSurah callback with autoPlay = state.isPlaying.
 */
export function nextSurah(): void {
  if (state.currentSurah < 114) {
    _loadSurah?.(state.currentSurah + 1, { autoPlay: state.isPlaying });
  }
}

/**
 * Load the previous surah, preserving current playback state.
 * Calls the injected loadSurah callback with autoPlay = state.isPlaying.
 */
export function prevSurah(): void {
  if (state.currentSurah > 1) {
    _loadSurah?.(state.currentSurah - 1, { autoPlay: state.isPlaying });
  }
}
