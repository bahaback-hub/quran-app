/**
 * Audio playback event handlers and end-of-ayah transitions.
 *
 * Extracted from `audio.ts` to isolate DOM event wiring and repeat/end logic.
 * The engine injects shared mutable playback state and callbacks via
 * `initAudioEventsHost` to avoid a circular import.
 */
import { state } from '../../state.js';
import { dom } from '../../dom.js';
import { showToast } from '../../ui.js';
import { __ } from '../../i18n.js';
import { resetRepeatUI } from './audio-repeat-ui.js';
import { updateSleepTimerDisplay } from './audio-sleep-timer.js';
import { highlightCurrentAyah, nextAyah, nextSurah, prevAyah } from './audio-navigation.js';
import { onSeeking, onTimeUpdate, stopWordTracking } from './audio-word-tracking.js';
import { endPlaybackWatchdog, maybeShowExpandHint, setPlayingState, setStoppedState } from './audio-player-ui.js';
import type { SurahData } from '../../types.js';

export interface AudioEventsHost {
  isAutoAdvancing(): boolean;
  setAutoAdvancing(v: boolean): void;
  getAutoAdvanceSafetyTimer(): ReturnType<typeof setTimeout> | null;
  setAutoAdvanceSafetyTimer(v: ReturnType<typeof setTimeout> | null): void;
  setMp3quranUrl(v: string | null): void;
  getAudioRetryCount(): number;
  setAudioRetryCount(v: number): void;
  getAudioRetryTimer(): ReturnType<typeof setTimeout> | null;
  setAudioRetryTimer(v: ReturnType<typeof setTimeout> | null): void;
  maxAudioRetries: number;
  playCurrentAyah(): Promise<void>;
  togglePlayPause(): void;
}

let _host: AudioEventsHost | null = null;

export function initAudioEventsHost(host: AudioEventsHost): void {
  _host = host;
}

function host(): AudioEventsHost {
  if (!_host) {
    throw new Error('Audio events host not initialized');
  }
  return _host;
}

/** Find the array index of an ayah by its numberInSurah. */
function findAyahIndex(surahData: SurahData, ayahNum: number): number {
  return surahData.ayahs.findIndex((a: { numberInSurah: number }) => a.numberInSurah === ayahNum);
}

/** Complete repeat mode — reset state and stop playback. */
function completeRepeat(): void {
  state.repeatMode = false;
  state.repeatCounter = 0;
  resetRepeatUI();
  showToast(__('repeat_complete'), 'success');
  setStoppedState();
}

/**
 * Handle repeat mode logic when an ayah ends.
 * Returns true if repeat logic handled the transition (caller should not advance further).
 */
function handleRepeatOnEnd(): boolean {
  if (!state.repeatMode || !state.surahData) {
    return false;
  }

  const surahData: SurahData = state.surahData;
  const currentNum = surahData.ayahs[state.currentAyahIndex]!.numberInSurah;

  // Check if we've reached the end of the repeat range
  if (currentNum === state.repeatTo) {
    state.repeatCounter++;
    if (state.repeatCounter >= state.repeatTimes) {
      completeRepeat();
      return true;
    }
    // Jump back to repeatFrom
    const startIdx = findAyahIndex(surahData, state.repeatFrom);
    if (startIdx !== -1) {
      state.currentAyahIndex = startIdx;
      highlightCurrentAyah();
      void host().playCurrentAyah();
      return true;
    }
  }

  // If current ayah is before repeatFrom, jump to repeatFrom
  if (currentNum < state.repeatFrom) {
    const startIdx = findAyahIndex(surahData, state.repeatFrom);
    if (startIdx !== -1) {
      state.currentAyahIndex = startIdx;
      highlightCurrentAyah();
      void host().playCurrentAyah();
      return true;
    }
  }

  return false;
}

/**
 * Handle the mp3quran ayah boundary detected by the word-tracking module:
 * pause, then let repeat mode take over or advance to the next ayah / end of
 * surah. Guarded by autoAdvancing so later timeupdate ticks cannot re-enter
 * while a transition is in flight; a safety timer clears a stuck guard after
 * five seconds.
 */
export function handleAyahBoundary(): void {
  const h = host();
  if (h.isAutoAdvancing()) {
    return;
  }
  h.setAutoAdvancing(true);
  dom.audioPlayer?.pause();
  try {
    if (handleRepeatOnEnd()) {
      // Repeat playback takes over immediately; do not leave the guard set
      // or later timeupdate events would be suppressed for five seconds.
      h.setAutoAdvancing(false);
      return;
    }
    if (state.currentAyahIndex < state.ayahsAudios.length - 1) {
      nextAyah(true);
    } else {
      onAudioEnded();
    }
  } catch (e) {
    console.warn('[Audio] Error during auto-advance:', e);
    h.setAutoAdvancing(false);
  }
  const timer = setTimeout(() => {
    if (h.isAutoAdvancing()) {
      console.warn('[Audio] Auto-advance safety timeout — resetting stuck state');
      h.setAutoAdvancing(false);
    }
  }, 5000);
  h.setAutoAdvanceSafetyTimer(timer);
}

function onAudioPlay(): void {
  const h = host();
  h.setAutoAdvancing(false);
  h.setAudioRetryCount(0);
  const safety = h.getAutoAdvanceSafetyTimer();
  if (safety) {
    clearTimeout(safety);
    h.setAutoAdvanceSafetyTimer(null);
  }
  // N-11: manual playback within the retry window supersedes the pending
  // automatic attempt; without this clear it would fire a second later.
  const retry = h.getAudioRetryTimer();
  if (retry) {
    clearTimeout(retry);
    h.setAudioRetryTimer(null);
  }
  setPlayingState();
  updateSleepTimerDisplay();
  maybeShowExpandHint();
  if ('mediaSession' in navigator && state.surahData) {
    const surahData: SurahData | null = state.surahData;
    if (!surahData) {
      return;
    }
    const ayah = surahData.ayahs?.[state.currentAyahIndex];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: ayah ? `${__('ayah')} ${ayah.numberInSurah}` : '',
      artist: surahData.name || __('app_title'),
      album: __('app_title'),
      artwork: [{ src: `${import.meta.env.BASE_URL}icon-512.png`, sizes: '512x512', type: 'image/png' }],
    });
  }
}

/** Playback actually started — the load succeeded; stop the watchdog. */
function onAudioPlaying(): void {
  endPlaybackWatchdog();
}

function onAudioPause(): void {
  endPlaybackWatchdog();
  // When audio ends naturally, the browser fires both 'pause' and 'ended' events.
  // The 'ended' handler manages surah transitions (including autoPlayNext).
  // We must NOT set isPlaying=false here if the audio ended naturally,
  // otherwise nextSurah() will see autoPlay=false and won't auto-play.
  if (dom.audioPlayer?.ended) {
    // Audio ended naturally — let onAudioEnded handle the state transition.
    return;
  }
  setStoppedState();
}

function onAudioError(): void {
  const h = host();
  endPlaybackWatchdog();
  h.setAutoAdvancing(false);
  h.setMp3quranUrl(null);
  stopWordTracking();

  // Auto-retry: try the same ayah up to MAX_AUDIO_RETRIES times, then skip
  if (h.getAudioRetryCount() < h.maxAudioRetries && state.surahData && state.ayahsAudios) {
    const nextCount = h.getAudioRetryCount() + 1;
    h.setAudioRetryCount(nextCount);
    console.warn(`[Audio] Retry ${nextCount}/${h.maxAudioRetries} for ayah index ${state.currentAyahIndex}`);
    showToast(`${__('audio_error')} (\u0645\u062d\u0627\u0648\u0644\u0629 ${nextCount}/${h.maxAudioRetries})`, 'error');
    // N-11: keep the handle so prepareAudioForNewSurah() can cancel it.
    const timer = setTimeout(() => {
      h.setAudioRetryTimer(null);
      void h.playCurrentAyah();
    }, 1500);
    h.setAudioRetryTimer(timer);
    return;
  }

  // Exhausted retries — skip to next ayah if possible
  h.setAudioRetryCount(0);
  if (state.surahData && state.ayahsAudios && state.currentAyahIndex < state.ayahsAudios.length - 1) {
    showToast(__('audio_error') + ' \u2014 ' + __('next_ayah'), 'error');
    state.currentAyahIndex++;
    highlightCurrentAyah();
    // N-11: same handle discipline as the retry branch above.
    const timer = setTimeout(() => {
      h.setAudioRetryTimer(null);
      void h.playCurrentAyah();
    }, 1000);
    h.setAudioRetryTimer(timer);
    return;
  }

  // Can't skip — full stop
  setStoppedState();
  showToast(__('audio_error'), 'error');
}

function onAudioEnded(): void {
  host().setMp3quranUrl(null);
  if (!state.surahData) {
    return;
  }
  stopWordTracking();

  // Handle repeat mode (separated for clarity)
  if (handleRepeatOnEnd()) {
    return;
  }

  const surahData: SurahData | null = state.surahData;
  if (!surahData) {
    return;
  }

  if (state.currentAyahIndex === state.ayahsAudios.length - 1) {
    // Last ayah of the surah
    if (state.currentSurah >= 114) {
      // Last surah (114) — stop playback cleanly
      if (state.autoPlayNext) {
        showToast(`${__('surah_complete')} ${surahData.name} — ${__('khatma_complete')}`, 'success');
      } else {
        showToast(`${__('surah_complete')} ${surahData.name}`, 'success');
      }
      setStoppedState();
      return;
    }
    showToast(`${__('surah_complete')} ${surahData.name}`, 'success');

    // Auto-play next surah only if the toggle is enabled
    if (state.autoPlayNext) {
      nextSurah();
      return;
    }

    // Default behavior: stop playback at the end of the surah
    setStoppedState();
    return;
  }
  nextAyah(true);
}

/**
 * Bind all audio player DOM events and MediaSession action handlers.
 * Should be called once during app initialization.
 */
export function bindAudioEvents(): void {
  if (dom.audioPlayer) {
    dom.audioPlayer.removeEventListener('ended', onAudioEnded);
    dom.audioPlayer.addEventListener('ended', onAudioEnded);
    dom.audioPlayer.removeEventListener('play', onAudioPlay);
    dom.audioPlayer.addEventListener('play', onAudioPlay);
    dom.audioPlayer.removeEventListener('playing', onAudioPlaying);
    dom.audioPlayer.addEventListener('playing', onAudioPlaying);
    dom.audioPlayer.removeEventListener('pause', onAudioPause);
    dom.audioPlayer.addEventListener('pause', onAudioPause);
    dom.audioPlayer.removeEventListener('error', onAudioError);
    dom.audioPlayer.addEventListener('error', onAudioError);
    dom.audioPlayer.removeEventListener('timeupdate', onTimeUpdate);
    dom.audioPlayer.addEventListener('timeupdate', onTimeUpdate);
    dom.audioPlayer.removeEventListener('seeking', onSeeking);
    dom.audioPlayer.addEventListener('seeking', onSeeking);
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      host().togglePlayPause();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      host().togglePlayPause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      prevAyah();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextAyah(false);
    });
  }
}
