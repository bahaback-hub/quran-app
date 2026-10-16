/**
 * Audio Player Module for Quran App.
 *
 * Manages all audio playback functionality including:
 *   - Per-ayah audio files and MP3 Quran (single-file with timing offsets)
 *   - Word-by-word highlighting synced to audio position
 *   - Automatic ayah/surah advancement with configurable repeat modes
 *   - Hifdh (memorization) mode that blurs ayah text for recall practice
 *   - Sleep timer with countdown display
 *   - MediaSession API integration for lock-screen controls
 *   - Audio error auto-retry (up to 2 attempts) with skip-on-failure
 *
 * Architecture note: setLoadSurah() is called by app.ts during initialization
 * to inject the surah-loading callback, avoiding circular imports.
 *
 * Structure: word-by-word sync (audio-word-tracking.ts), the sleep timer
 * (audio-sleep-timer.ts), and the repeat-mode UI (audio-repeat-ui.ts) live in
 * sibling modules and are re-exported here, so existing callers keep importing
 * from this module.
 */

import { applyPlaybackRate, prepareElementForUrl } from './audio-pitch.js';
export {
  applyPlaybackRate,
  ensureAudioGraph,
  getEffectiveRate,
  getPitchFreq,
  pitchRatio,
  prepareElementForUrl,
  setPitchFreq,
  syncPitchControls,
  _resetPitchForTests,
} from './audio-pitch.js';

import {
  clearWordWeightsCache,
  initWordTrackingHost,
  onSeeking,
  onTimeUpdate,
  resetWordTrackingDomCache,
  startWordTracking,
  stopWordTracking,
} from './audio-word-tracking.js';
export { clearWordWeightsCache } from './audio-word-tracking.js';

import { initSleepTimerHost, updateSleepTimerDisplay } from './audio-sleep-timer.js';
export {
  clearSleepTimer,
  cleanupSleepTimerInterval,
  getSleepTimerMinutes,
  getSleepTimerRemaining,
  setSleepTimer,
} from './audio-sleep-timer.js';

import { resetRepeatUI } from './audio-repeat-ui.js';
export {
  applyRepeatUI,
  getDefaultRepeatRange,
  populateRepeatUI,
  resetRepeatUI,
  toggleRepeat,
} from './audio-repeat-ui.js';

import { state } from '../../state.js';
import { dom } from '../../dom.js';
import { requireDom } from '../../dom-require.js';
import { storage } from '../../storage.js';
import { showToast } from '../../ui.js';
import { hapticFeedback } from '../../utils.js';
import { __ } from '../../i18n.js';
import { getCachedAudioUrl } from './audio-cache.js';
import type { SurahData } from '../../types.js';

/* ===================== INTERFACES ===================== */

import type { LoadSurahFn, ReloadAudioFn } from './audio-types.js';
export type { RepeatRange } from './audio-types.js';

/* ===================== MODULE STATE ===================== */

/** Inject the loadSurah callback from app.ts (avoids circular import). */
let _loadSurah: LoadSurahFn | null = null;

/** Inject the reloadCurrentSurahAudio callback from app.ts (avoids circular import). */
let _reloadSurahAudio: ReloadAudioFn | null = null;

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
 * Inject the reloadCurrentSurahAudio callback from app.ts.
 * Required to avoid circular imports — app.ts calls this during initialization.
 *
 * @param fn The function to call when reloading current surah audio
 */
export function setReloadAudio(fn: ReloadAudioFn): void {
  _reloadSurahAudio = fn;
}

/** Injectable highlightCurrentAyah callback (avoids circular import). */
let _highlightAyah: (() => void) | null = null;

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
function highlightCurrentAyah(): void {
  _highlightAyah?.();
}

let _mp3quranUrl: string | null = null;
let _autoAdvancing = false;
let _audioRetryCount = 0;
/** True while an on-demand audio-list reload is in flight (re-entrancy guard). */
let _audioReloading = false;
const MAX_AUDIO_RETRIES = 2;
const PLAY_START_TIMEOUT_MS = 10000;
/** Watchdog for playback requests that never start (silent network hangs). */
let _playWatchdog: ReturnType<typeof setTimeout> | null = null;
/** Pending mp3quran metadata listener, tracked so a timeout can detach it. */
let _pendingMetaHandler: (() => void) | null = null;
let _autoAdvanceSafetyTimer: ReturnType<typeof setTimeout> | null = null;
const EXPAND_HINT_KEY = 'player_expand_hint_seen';
const PLAYER_HINT_DURATION = 6000;

/**
 * Reset audio state when switching surahs.
 * Stops playback, clears caches, and resets audio elements.
 */
export function prepareAudioForNewSurah(): void {
  _mp3quranUrl = null;
  _autoAdvancing = false;
  if (_autoAdvanceSafetyTimer) {
    clearTimeout(_autoAdvanceSafetyTimer);
    _autoAdvanceSafetyTimer = null;
  }
  resetWordTrackingDomCache();
  clearWordWeightsCache();
  state.isPlaying = false;
  resetAudioPlayerUI();
  resetAudioElement(dom.audioPlayer);
  resetAudioElement(dom.audioPlayer2);
}

/**
 * Reset the audio player UI to the stopped state.
 * Separated from prepareAudioForNewSurah for testability.
 */
export function resetAudioPlayerUI(): void {
  document.body.classList.remove('audio-playing');
  updatePlayPauseBtn();
}

/**
 * Reset a single audio element — pause, remove src, and reload.
 * Pure DOM operation, separated for testability.
 *
 * Revokes any blob: URL currently assigned to the player's src before clearing
 * it, to prevent Blob memory leaks when switching surahs while audio is loaded
 * from the offline cache (resolveAudioUrl returns blob: URLs).
 */
export function resetAudioElement(player: HTMLAudioElement | null): void {
  if (!player) {
    return;
  }
  const oldSrc = player.src;
  if (oldSrc && oldSrc.startsWith('blob:')) {
    URL.revokeObjectURL(oldSrc);
  }
  player.pause();
  player.removeAttribute('src');
  player.load();
}

/* ===================== MP3QURAN SEEK HELPERS ===================== */

function _getAyahStartTime(): number {
  if (!state.ayahTimings?.length || !dom.audioPlayer?.duration || !isFinite(dom.audioPlayer.duration)) {
    return 0;
  }
  return (state.ayahTimings[state.currentAyahIndex] || 0) * dom.audioPlayer.duration;
}

function _getAyahEndTime(): number {
  if (!state.ayahTimings?.length || !dom.audioPlayer?.duration || !isFinite(dom.audioPlayer.duration)) {
    return dom.audioPlayer?.duration || 0;
  }
  const next = state.ayahTimings[state.currentAyahIndex + 1];
  return (next !== undefined ? next : 1) * dom.audioPlayer.duration;
}

/**
 * Handle the mp3quran ayah boundary detected by the word-tracking module:
 * pause, then let repeat mode take over or advance to the next ayah / end of
 * surah. Guarded by _autoAdvancing so later timeupdate ticks cannot re-enter
 * while a transition is in flight; a safety timer clears a stuck guard after
 * five seconds.
 */
function handleAyahBoundary(): void {
  if (_autoAdvancing) {
    return;
  }
  _autoAdvancing = true;
  dom.audioPlayer?.pause();
  try {
    if (handleRepeatOnEnd()) {
      // Repeat playback takes over immediately; do not leave the guard set
      // or later timeupdate events would be suppressed for five seconds.
      _autoAdvancing = false;
      return;
    }
    if (state.currentAyahIndex < state.ayahsAudios.length - 1) {
      nextAyah(true);
    } else {
      onAudioEnded();
    }
  } catch (e) {
    console.warn('[Audio] Error during auto-advance:', e);
    _autoAdvancing = false;
  }
  _autoAdvanceSafetyTimer = setTimeout(() => {
    if (_autoAdvancing) {
      console.warn('[Audio] Auto-advance safety timeout — resetting stuck state');
      _autoAdvancing = false;
    }
  }, 5000);
}

/* ===================== PLAYBACK STATE HELPERS ===================== */

/** Set playback state to playing and update UI. */
function setPlayingState(): void {
  state.isPlaying = true;
  document.body.classList.add('audio-playing');
  updatePlayPauseBtn();
}

/** Set playback state to stopped and update UI. */
export function setStoppedState(): void {
  endPlaybackWatchdog();
  state.isPlaying = false;
  document.body.classList.remove('audio-playing');
  updatePlayPauseBtn();
}

/**
 * Mark the play button as busy and arm a watchdog while a fresh playback
 * request is loading. If playback never starts within the timeout (silent
 * network hang), the watchdog stops the attempt and surfaces an error toast.
 */
function beginPlaybackWatchdog(): void {
  endPlaybackWatchdog();
  dom.playPauseBtn?.classList.add('is-loading');
  dom.playPauseBtn?.setAttribute('aria-busy', 'true');
  _playWatchdog = setTimeout(() => {
    _playWatchdog = null;
    if (_pendingMetaHandler && dom.audioPlayer) {
      dom.audioPlayer.removeEventListener('loadedmetadata', _pendingMetaHandler);
    }
    _pendingMetaHandler = null;
    try {
      dom.audioPlayer?.pause();
    } catch (e) {
      console.warn(e);
    }
    setStoppedState();
    showToast(__('audio_error'), 'error');
  }, PLAY_START_TIMEOUT_MS);
}

/** Clear the busy indicator and cancel any pending playback watchdog. */
function endPlaybackWatchdog(): void {
  if (_playWatchdog) {
    clearTimeout(_playWatchdog);
    _playWatchdog = null;
  }
  if (_pendingMetaHandler && dom.audioPlayer) {
    dom.audioPlayer.removeEventListener('loadedmetadata', _pendingMetaHandler);
  }
  _pendingMetaHandler = null;
  dom.playPauseBtn?.classList.remove('is-loading');
  dom.playPauseBtn?.removeAttribute('aria-busy');
}

/* ===================== PLAYER ===================== */

/**
 * Resolve an audio URL, checking the offline cache first.
 * Returns a cached Object URL if available, otherwise the original URL.
 * Object URLs from the cache must be revoked after use to free memory.
 */
async function resolveAudioUrl(originalUrl: string): Promise<string> {
  try {
    const cachedUrl = await getCachedAudioUrl(originalUrl);
    if (cachedUrl) {
      return cachedUrl;
    }
  } catch {
    // Cache lookup failed — fall through to original URL
  }
  return originalUrl;
}

/**
 * Play the current ayah audio.
 * Supports two modes: per-ayah files and MP3 Quran (single file with timing offsets).
 * Applies saved playback speed and starts word-by-word tracking.
 * Checks the offline audio cache first — if a cached version exists, it is used
 * instead of the network URL, enabling offline playback.
 */
export async function playCurrentAyah(): Promise<void> {
  if (!state.surahData) {
    showToast(__('no_audio'), 'error');
    return;
  }
  try {
    if (!state.ayahsAudios?.length) {
      // The boot-time audio fetch may have failed (API rate-limit burst on page
      // load): retry on demand so pressing play recovers instead of silence.
      if (!_audioReloading) {
        _audioReloading = true;
        try {
          showToast(__('loading_surah'), 'info');
          if (_reloadSurahAudio) {
            await _reloadSurahAudio();
          }
        } finally {
          _audioReloading = false;
        }
      }
      if (!state.ayahsAudios?.length) {
        // A reload in flight empties the audio list momentarily: tell the truth
        // (still loading) instead of the misleading "no audio" error.
        showToast(state.loadingSurah ? __('loading_surah') : __('no_audio'), state.loadingSurah ? 'info' : 'error');
        return;
      }
    }

    // تأكد من صلاحية فهرس الآية حتى وإن لم يقم المستخدم بتحديد آية معينة
    if (
      typeof state.currentAyahIndex !== 'number' ||
      state.currentAyahIndex < 0 ||
      state.currentAyahIndex >= state.ayahsAudios.length
    ) {
      state.currentAyahIndex = 0;
    }

    const url = state.ayahsAudios[state.currentAyahIndex];
    if (!url) {
      showToast(__('no_audio_ayah'), 'error');
      return;
    }
    if (!dom.audioPlayer) {
      return;
    }

    const isMp3quran = state.ayahTimings?.length > 0;

    if (isMp3quran && _mp3quranUrl === url && dom.audioPlayer.readyState >= 2) {
      dom.audioPlayer.currentTime = _getAyahStartTime();
      setPlayingState();
      dom.audioPlayer.play().catch((e: unknown) => {
        console.warn(e);
        // Rejected (e.g. autoplay policy) — don't leave the button stuck on pause.
        setStoppedState();
        showToast(__('audio_error'), 'error');
      });
      startWordTracking();
      return;
    }

    beginPlaybackWatchdog();
    _mp3quranUrl = isMp3quran ? url : null;

    // Resolve the audio URL — check offline cache first
    const resolvedUrl = await resolveAudioUrl(url);

    // Match CORS mode / graph routing to the host BEFORE src is assigned
    // (crossOrigin only takes effect on the fetch that starts after it).
    await prepareElementForUrl(resolvedUrl);

    // أوقف أي تشغيل سابق ونظّف الحالة قبل تغيير المصدر
    const oldSrc = dom.audioPlayer.src;
    if (oldSrc && oldSrc.startsWith('blob:')) {
      URL.revokeObjectURL(oldSrc);
    }
    // أوقف التشغيل الحالي بأمان لتجنب أي استثناء أو رفض غير معالج
    try {
      if (!dom.audioPlayer.paused) {
        dom.audioPlayer.pause();
      }
    } catch {
      /* ignore pause errors */
    }

    if (isMp3quran) {
      dom.audioPlayer.src = resolvedUrl;
      const onMeta = function onMeta(): void {
        requireDom('audioPlayer').removeEventListener('loadedmetadata', onMeta);
        _pendingMetaHandler = null;
        requireDom('audioPlayer').currentTime = _getAyahStartTime();
        requireDom('audioPlayer')
          .play()
          .catch((e: unknown) => {
            console.warn(e);
            setStoppedState();
            showToast(__('audio_error'), 'error');
          });
      };
      _pendingMetaHandler = onMeta;
      dom.audioPlayer.addEventListener('loadedmetadata', onMeta, { once: true });
    } else {
      dom.audioPlayer.src = resolvedUrl;
      dom.audioPlayer.play().catch((e: unknown) => {
        console.warn(e);
        setStoppedState();
        showToast(__('audio_error'), 'error');
      });
    }

    // Apply saved playback speed × pitch reference when starting a new source
    applyPlaybackRate();

    setPlayingState();
    startWordTracking();
    if (!isMp3quran) {
      preloadNextAyah();
    }
  } catch (err) {
    console.warn('[Audio] playCurrentAyah error:', err);
    setStoppedState();
    showToast(__('audio_error'), 'error');
  }
}

function preloadNextAyah(): void {
  if (!state.ayahsAudios) {
    return;
  }
  const nextIdx = state.currentAyahIndex + 1;
  if (nextIdx < state.ayahsAudios.length) {
    const nextUrl = state.ayahsAudios[nextIdx];
    if (nextUrl) {
      if (!dom.audioPlayer2) {
        const a2 = document.createElement('audio') as HTMLAudioElement;
        a2.id = 'audioPlayer2';
        a2.preload = 'auto';
        a2.style.display = 'none';
        document.body.appendChild(a2);
        dom.audioPlayer2 = a2;
      }
      // Prefer the offline-cached blob URL when the file is already stored
      // locally — this avoids a redundant network fetch for audio we already
      // have. resolveAudioUrl() falls back to the original network URL.
      void resolveAudioUrl(nextUrl).then((resolved) => {
        if (!dom.audioPlayer2) {
          return;
        }
        // Revoke the previously-preloaded blob URL (if any) before replacing
        // it, so we never accumulate leaked object URLs while browsing.
        const oldSrc = dom.audioPlayer2.src;
        if (oldSrc && oldSrc.startsWith('blob:') && oldSrc !== resolved) {
          URL.revokeObjectURL(oldSrc);
        }
        requireDom('audioPlayer2').src = resolved;
        requireDom('audioPlayer2').load();
      });
    }
  }
}

/* ===================== AUDIO EVENTS ===================== */

/**
 * Expand the collapsed audio player and persist the preference to localStorage.
 * Removes the 'collapsed' CSS class from the player element.
 */
export function expandPlayer(): void {
  dom.player?.classList.remove('collapsed');
  document.body.classList.add('player-expanded');
  storage.set('player_collapsed', false);
}

/** Collapse the player and restore the mobile reading controls around it. */
export function collapsePlayer(): void {
  dom.player?.classList.add('collapsed');
  document.body.classList.remove('player-expanded');
  storage.set('player_collapsed', true);
}

/**
 * Toggle audio play/pause.
 * If no audio source is loaded, starts playback from the current ayah.
 */
export function togglePlayPause(): void {
  if (!state.surahData || !dom.audioPlayer) {
    return;
  }
  hapticFeedback();
  if (dom.audioPlayer.paused) {
    if (!dom.audioPlayer.src || dom.audioPlayer.ended) {
      highlightCurrentAyah();
      playCurrentAyah().catch((e: unknown) => {
        console.warn('[Audio] togglePlayPause error:', e);
        setStoppedState();
        showToast(__('audio_error'), 'error');
      });
    } else {
      // Optimistic: flip the button now; the play event confirms it, and a
      // rejection (e.g. autoplay policy) flips it back — never stuck on play.
      setPlayingState();
      dom.audioPlayer.play().catch((e: unknown) => {
        console.warn(e);
        setStoppedState();
        showToast(__('audio_error'), 'error');
      });
    }
  } else {
    dom.audioPlayer.pause();
  }
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
      togglePlayPause();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      togglePlayPause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      prevAyah();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextAyah(false);
    });
  }
}

/** Show a one-time hint (arrow pulse + message) the first time playback starts. */
function maybeShowExpandHint(): void {
  if (storage.get(EXPAND_HINT_KEY)) {
    return;
  }
  storage.set(EXPAND_HINT_KEY, '1');
  dom.player?.classList.add('first-play-glow');
  const hint = document.getElementById('playerExpandHint');
  if (hint) {
    hint.hidden = false;
  }
  window.setTimeout(() => {
    dom.player?.classList.remove('first-play-glow');
    const el = document.getElementById('playerExpandHint');
    if (el) {
      el.hidden = true;
    }
  }, PLAYER_HINT_DURATION);
}

function onAudioPlay(): void {
  _autoAdvancing = false;
  _audioRetryCount = 0;
  if (_autoAdvanceSafetyTimer) {
    clearTimeout(_autoAdvanceSafetyTimer);
    _autoAdvanceSafetyTimer = null;
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
      artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
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
  endPlaybackWatchdog();
  _autoAdvancing = false;
  _mp3quranUrl = null;
  stopWordTracking();

  // Auto-retry: try the same ayah up to MAX_AUDIO_RETRIES times, then skip
  if (_audioRetryCount < MAX_AUDIO_RETRIES && state.surahData && state.ayahsAudios) {
    _audioRetryCount++;
    console.warn(`[Audio] Retry ${_audioRetryCount}/${MAX_AUDIO_RETRIES} for ayah index ${state.currentAyahIndex}`);
    showToast(
      `${__('audio_error')} (\u0645\u062d\u0627\u0648\u0644\u0629 ${_audioRetryCount}/${MAX_AUDIO_RETRIES})`,
      'error',
    );
    setTimeout(() => playCurrentAyah(), 1500);
    return;
  }

  // Exhausted retries — skip to next ayah if possible
  _audioRetryCount = 0;
  if (state.surahData && state.ayahsAudios && state.currentAyahIndex < state.ayahsAudios.length - 1) {
    showToast(__('audio_error') + ' \u2014 ' + __('next_ayah'), 'error');
    state.currentAyahIndex++;
    highlightCurrentAyah();
    setTimeout(() => playCurrentAyah(), 1000);
    return;
  }

  // Can't skip — full stop
  setStoppedState();
  showToast(__('audio_error'), 'error');
}

/**
 * Update the play/pause button text to reflect current playback state.
 * Reads state.isPlaying and updates the button label accordingly.
 * Also swaps the collapsed floating button icon (it had no pause state).
 */
const PLAY_SVG =
  '<svg class="icon icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>';
const PAUSE_SVG =
  '<svg class="icon icon-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4" height="16" /><rect x="15" y="4" width="4" height="16" /></svg>';
export function updatePlayPauseBtn(): void {
  if (dom.playPauseBtn) {
    dom.playPauseBtn.textContent = state.isPlaying ? __('pause') : __('play');
  }
  if (dom.collapsedPlayBtn) {
    dom.collapsedPlayBtn.innerHTML = state.isPlaying ? PAUSE_SVG : PLAY_SVG;
  }
}

/* ===================== REPEAT LOGIC (extracted from onAudioEnded) ===================== */

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
      playCurrentAyah();
      return true;
    }
  }

  // If current ayah is before repeatFrom, jump to repeatFrom
  if (currentNum < state.repeatFrom) {
    const startIdx = findAyahIndex(surahData, state.repeatFrom);
    if (startIdx !== -1) {
      state.currentAyahIndex = startIdx;
      highlightCurrentAyah();
      playCurrentAyah();
      return true;
    }
  }

  return false;
}

/** Complete repeat mode — reset state and stop playback. */
function completeRepeat(): void {
  state.repeatMode = false;
  state.repeatCounter = 0;
  resetRepeatUI();
  showToast(__('repeat_complete'), 'success');
  setStoppedState();
}

/** Find the array index of an ayah by its numberInSurah. */
function findAyahIndex(surahData: SurahData, ayahNum: number): number {
  return surahData.ayahs.findIndex((a: { numberInSurah: number }) => a.numberInSurah === ayahNum);
}

/* ===================== AUDIO END HANDLER ===================== */

function onAudioEnded(): void {
  _mp3quranUrl = null;
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

/* ===================== NAVIGATION ===================== */

/**
 * Advance to the next ayah, or the next surah if at the end.
 * @param autoFromRepeat Whether this was triggered automatically by repeat mode
 */
export function nextAyah(autoFromRepeat: boolean): void {
  if (!state.surahData || !state.ayahsAudios) {
    return;
  }
  if (state.currentAyahIndex < state.ayahsAudios.length - 1) {
    state.currentAyahIndex++;
    highlightCurrentAyah();
    if (autoFromRepeat || state.isPlaying) {
      playCurrentAyah();
    }
  } else if (state.currentSurah < 114) {
    if (state.mushafMode) {
      dom.audioPlayer?.pause();
      setStoppedState();
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
      playCurrentAyah();
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

/* ===================== HIFDH & REPEAT ===================== */

/**
 * Apply hifdh mode CSS classes to all ayah elements in the DOM.
 * Separated from toggleHifdh for testability — pure DOM operation.
 * @param enabled Whether hifdh mode is active
 */
export function applyHifdhUI(enabled: boolean): void {
  dom.hifdhBtn?.classList.toggle('active', enabled);
  document.querySelectorAll('.ayah').forEach((el: Element) => {
    if (enabled) {
      el.classList.add('hifdh-mode');
    } else {
      el.classList.remove('hifdh-mode', 'revealed');
    }
  });
}

/**
 * Toggle hifdh (memorization) mode.
 * State change is separated from DOM update for testability.
 */
export function toggleHifdh(): void {
  hapticFeedback();
  state.hifdhMode = !state.hifdhMode;
  applyHifdhUI(state.hifdhMode);
  if (state.hifdhMode) {
    highlightCurrentAyah();
  }
  showToast(state.hifdhMode ? __('hifdh_on') : __('hifdh_off'), state.hifdhMode ? 'success' : '');
}

/* ===================== HOST WIRING ===================== */

// The word-tracking and sleep-timer modules receive the engine actions they
// must not import directly (which would create a circular import). The
// closures read module state lazily, so wiring them here — after every
// definition — is safe.
initWordTrackingHost({
  isAutoAdvancing: () => _autoAdvancing,
  hasTimings: () => (state.ayahTimings?.length ?? 0) > 0,
  getAyahStartTime: _getAyahStartTime,
  getAyahEndTime: _getAyahEndTime,
  onAyahBoundary: handleAyahBoundary,
});

initSleepTimerHost({
  stopPlayback: () => {
    if (dom.audioPlayer && !dom.audioPlayer.paused) {
      dom.audioPlayer.pause();
      setStoppedState();
    }
  },
});
