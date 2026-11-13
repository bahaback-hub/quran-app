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
  resetWordTrackingDomCache,
  startWordTracking,
  stopWordTracking,
} from './audio-word-tracking.js';
export { clearWordWeightsCache } from './audio-word-tracking.js';

import { initSleepTimerHost } from './audio-sleep-timer.js';
export {
  clearSleepTimer,
  cleanupSleepTimerInterval,
  getSleepTimerMinutes,
  getSleepTimerRemaining,
  setSleepTimer,
} from './audio-sleep-timer.js';

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
import { showToast } from '../../ui.js';
import { hapticFeedback } from '../../utils.js';
import { __ } from '../../i18n.js';
import { getCachedAudioUrl } from './audio-cache.js';

/* ===================== INTERFACES ===================== */

import type { ReloadAudioFn } from './audio-types.js';
export type { RepeatRange } from './audio-types.js';

/* ===================== MODULE STATE ===================== */
// Navigation + highlight injection live in ./audio-navigation.ts; re-exported here
// so existing import sites (app.ts, keyboard.ts, navigation.ts, tests) keep working.
import { initAudioNavigationHost, highlightCurrentAyah } from './audio-navigation.js';
import {
  beginPlaybackWatchdog,
  resetAudioElement,
  resetAudioPlayerUI,
  setPendingMetaHandler,
  setPlayingState,
  setStoppedState,
} from './audio-player-ui.js';

export {
  collapsePlayer,
  expandPlayer,
  resetAudioElement,
  resetAudioPlayerUI,
  setStoppedState,
  updatePlayPauseBtn,
} from './audio-player-ui.js';

/** Inject the reloadCurrentSurahAudio callback from app.ts (avoids circular import). */
let _reloadSurahAudio: ReloadAudioFn | null = null;

/**
 * Inject the reloadCurrentSurahAudio callback from app.ts.
 * Required to avoid circular imports — app.ts calls this during initialization.
 *
 * @param fn The function to call when reloading current surah audio
 */
export function setReloadAudio(fn: ReloadAudioFn): void {
  _reloadSurahAudio = fn;
}

let _mp3quranUrl: string | null = null;
let _autoAdvancing = false;
let _audioRetryCount = 0;
/**
 * N-11: pending onAudioError() retry/skip timer. It must be cancelled by
 * prepareAudioForNewSurah() — otherwise switching surahs inside the 1–1.5s
 * window auto-plays the NEW surah with no user gesture (autoplay-policy
 * risk on top of the surprise), because playCurrentAyah() reads whatever
 * state.currentAyahIndex/ayahsAudios point at when it fires.
 */
let _audioRetryTimer: ReturnType<typeof setTimeout> | null = null;
/** True while an on-demand audio-list reload is in flight (re-entrancy guard). */
let _audioReloading = false;
const MAX_AUDIO_RETRIES = 2;
let _autoAdvanceSafetyTimer: ReturnType<typeof setTimeout> | null = null;

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
  // N-11: a retry/skip timer armed by onAudioError() must not survive the
  // switch — it would play the newly loaded surah without a gesture.
  if (_audioRetryTimer) {
    clearTimeout(_audioRetryTimer);
    _audioRetryTimer = null;
  }
  _audioRetryCount = 0;
  resetWordTrackingDomCache();
  stopWordTracking();
  clearWordWeightsCache();
  state.isPlaying = false;
  resetAudioPlayerUI();
  resetAudioElement(dom.audioPlayer);
  resetAudioElement(dom.audioPlayer2);
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
        setPendingMetaHandler(null);
        requireDom('audioPlayer').currentTime = _getAyahStartTime();
        requireDom('audioPlayer')
          .play()
          .catch((e: unknown) => {
            console.warn(e);
            setStoppedState();
            showToast(__('audio_error'), 'error');
          });
      };
      setPendingMetaHandler(onMeta);
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

import { handleAyahBoundary, initAudioEventsHost } from './audio-events.js';

export { bindAudioEvents } from './audio-events.js';
export { applyHifdhUI, toggleHifdh } from './audio-hifdh.js';

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

initAudioEventsHost({
  isAutoAdvancing: () => _autoAdvancing,
  setAutoAdvancing: (v) => {
    _autoAdvancing = v;
  },
  getAutoAdvanceSafetyTimer: () => _autoAdvanceSafetyTimer,
  setAutoAdvanceSafetyTimer: (v) => {
    _autoAdvanceSafetyTimer = v;
  },
  setMp3quranUrl: (v) => {
    _mp3quranUrl = v;
  },
  getAudioRetryCount: () => _audioRetryCount,
  setAudioRetryCount: (v) => {
    _audioRetryCount = v;
  },
  getAudioRetryTimer: () => _audioRetryTimer,
  setAudioRetryTimer: (v) => {
    _audioRetryTimer = v;
  },
  maxAudioRetries: MAX_AUDIO_RETRIES,
  playCurrentAyah,
  togglePlayPause,
});

/* ===================== HOST WIRING ===================== */

// The word-tracking and sleep-timer modules receive the engine actions they
// must not import directly (which would create a circular import). The
// closures read module state lazily, so wiring them here — after every
// definition — is safe.
initAudioNavigationHost({
  playCurrentAyah,
  setStoppedState,
});

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

// Navigation moved to ./audio-navigation.ts — re-exported for existing import sites.
export { setLoadSurah, setHighlightAyah, nextAyah, prevAyah, nextSurah, prevSurah } from './audio-navigation.js';
