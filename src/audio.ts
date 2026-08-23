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
 *   - Audio visualization via canvas-based waveform renderer
 *
 * Architecture note: setLoadSurah() is called by app.ts during initialization
 * to inject the surah-loading callback, avoiding circular imports.
 */

import { state } from './state.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { hapticFeedback } from './utils.js';
import { highlightCurrentAyah } from './surah-loader.js';
import { __ } from './i18n.js';
import { getCachedAudioUrl } from './audio-cache.js';
import type { SurahData } from './types.js';

/* ===================== INTERFACES ===================== */

/** Options for loading a surah (used by setLoadSurah callback). */
interface LoadSurahOptions {
  startAyah?: number;
  autoPlay?: boolean;
}

/** Type for the loadSurah callback injected via setLoadSurah. */
type LoadSurahFn = (surahNum: number, opts?: LoadSurahOptions) => void;

/** Cached word-weight data for word-by-word tracking. */
interface WordWeightsResult {
  wordCount: number;
  startTimes: number[];
}

/** Repeat range configuration — extracted from toggleRepeat for clarity. */
export interface RepeatRange {
  from: number;
  to: number;
  times: number;
}

/* ===================== MODULE STATE ===================== */

/** Inject the loadSurah callback from app.ts (avoids circular import). */
let _loadSurah: LoadSurahFn | null = null;

/**
 * Inject the loadSurah callback from app.ts.
 * Required to avoid circular imports — app.ts calls this during initialization.
 *
 * @param fn The function to call when loading a new surah
 */
export function setLoadSurah(fn: LoadSurahFn): void {
  _loadSurah = fn;
}

let _mp3quranUrl: string | null = null;
let _autoAdvancing = false;
let _sleepTimer: ReturnType<typeof setTimeout> | null = null;
let _sleepTimerMinutes = 0;
let _sleepTimerStart: number = 0;
let _audioRetryCount = 0;
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
  _cachedWordEls = null;
  _cachedWordAyahIndex = -1;
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

/* ===================== PLAYBACK STATE HELPERS ===================== */

/** Set playback state to playing and update UI. */
function setPlayingState(): void {
  state.isPlaying = true;
  document.body.classList.add('audio-playing');
  updatePlayPauseBtn();
}

/** Set playback state to stopped and update UI. */
function setStoppedState(): void {
  state.isPlaying = false;
  document.body.classList.remove('audio-playing');
  updatePlayPauseBtn();
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
  if (!state.surahData || !state.ayahsAudios?.length) {
    showToast(__('no_audio'), 'error');
    return;
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
    dom.audioPlayer.play().catch((e: unknown) => console.warn(e));
    setPlayingState();
    startWordTracking();
    return;
  }

  _mp3quranUrl = isMp3quran ? url : null;

  // Resolve the audio URL — check offline cache first
  const resolvedUrl = await resolveAudioUrl(url);

  // Revoke previous Object URL to prevent memory leak
  const oldSrc = dom.audioPlayer.src;
  if (oldSrc && oldSrc.startsWith('blob:')) {
    URL.revokeObjectURL(oldSrc);
  }

  if (isMp3quran) {
    dom.audioPlayer.src = resolvedUrl;
    dom.audioPlayer.addEventListener(
      'loadedmetadata',
      function onMeta(): void {
        dom.audioPlayer!.removeEventListener('loadedmetadata', onMeta);
        dom.audioPlayer!.currentTime = _getAyahStartTime();
        dom.audioPlayer!.play().catch((e: unknown) => console.warn(e));
      },
      { once: true },
    );
  } else {
    dom.audioPlayer.src = resolvedUrl;
    dom.audioPlayer.play().catch((e: unknown) => console.warn(e));
  }

  // Apply saved playback rate when starting a new audio source
  const savedSpeed = storage.get<string>('playback_speed');
  if (savedSpeed) {
    dom.audioPlayer.playbackRate = parseFloat(savedSpeed);
  }

  setPlayingState();
  startWordTracking();
  if (!isMp3quran) {
    preloadNextAyah();
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
      dom.audioPlayer2.src = nextUrl;
      dom.audioPlayer2.load();
    }
  }
}

/* ===================== WORD-BY-WORD TRACKING ===================== */

let wordTrackingActive = false;
const _wordWeightsCache = new Map<number, WordWeightsResult>();

function startWordTracking(): void {
  wordTrackingActive = true;
}

function stopWordTracking(): void {
  wordTrackingActive = false;
  document.querySelectorAll('.word.current-word').forEach((el: Element) => el.classList.remove('current-word'));
}

function getCachedWordWeights(ayahIndex: number): WordWeightsResult | null {
  const cached = _wordWeightsCache.get(ayahIndex);
  if (cached) {
    return cached;
  }
  const ayahEl = document.querySelector(`.ayah[data-index="${ayahIndex}"]`);
  if (!ayahEl) {
    return null;
  }
  const words = ayahEl.querySelectorAll('.word');
  if (words.length === 0) {
    return null;
  }
  const weights: number[] = [];
  for (const w of words) {
    const letters = w.textContent?.match(/[\u0621-\u064A\u0660-\u0669]/g) || [];
    weights.push(Math.max(1, letters.length));
  }
  const totalWeight = weights.reduce((a: number, b: number) => a + b, 0);
  const preferredPauseRatio = words.length <= 3 ? 0.06 : words.length <= 8 ? 0.04 : 0.025;
  // Reserve at least 30% of the ayah duration for speech. A fixed pause per word
  // otherwise makes speechRatio negative in long ayahs and reverses word timing.
  const pauseRatio = Math.min(preferredPauseRatio, 0.7 / Math.max(1, words.length - 1));
  const speechRatio = 1 - pauseRatio * (words.length - 1);
  let cumTime = 0;
  const startTimes: number[] = [];
  for (let i = 0; i < words.length; i++) {
    startTimes.push(cumTime);
    cumTime += (weights[i]! / totalWeight) * speechRatio + pauseRatio;
  }
  const result: WordWeightsResult = { wordCount: words.length, startTimes };
  _wordWeightsCache.set(ayahIndex, result);
  return result;
}

function clearWordWeightsCache(): void {
  _wordWeightsCache.clear();
}

let _cachedWordEls: NodeListOf<Element> | null = null;
let _cachedWordAyahIndex = -1;

function onTimeUpdate(): void {
  if (_autoAdvancing || !wordTrackingActive || !dom.audioPlayer || !state.surahData) {
    return;
  }
  let duration = dom.audioPlayer.duration;
  if (!duration || !isFinite(duration)) {
    return;
  }
  let currentTime = dom.audioPlayer.currentTime;

  const isMp3quran = state.ayahTimings?.length > 0;

  if (isMp3quran) {
    const endTime = _getAyahEndTime();
    if (currentTime >= endTime - 0.15) {
      if (_autoAdvancing) {
        return;
      }
      _autoAdvancing = true;
      dom.audioPlayer.pause();
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
      return;
    }
    const ayahStart = _getAyahStartTime();
    currentTime -= ayahStart;
    duration = endTime - ayahStart;
    if (currentTime < 0) {
      currentTime = 0;
    }
  }

  const wordData = getCachedWordWeights(state.currentAyahIndex);
  if (!wordData) {
    return;
  }

  const startTimes = wordData.startTimes.map((t: number) => t * duration);
  let wordIndex = wordData.wordCount - 1;
  for (let i = wordData.wordCount - 1; i >= 0; i--) {
    if (currentTime >= startTimes[i]!) {
      wordIndex = i;
      break;
    }
  }

  if (state.currentAyahIndex !== _cachedWordAyahIndex) {
    _cachedWordEls = document.querySelectorAll(`.ayah[data-index="${state.currentAyahIndex}"] .word`);
    _cachedWordAyahIndex = state.currentAyahIndex;
  }
  if (!_cachedWordEls) {
    return;
  }
  for (let i = 0; i < _cachedWordEls.length; i++) {
    _cachedWordEls[i]!.classList.toggle('current-word', i <= wordIndex);
  }
}

function onSeeking(): void {
  if (!wordTrackingActive) {
    return;
  }
  document.querySelectorAll('.word.current-word').forEach((el: Element) => el.classList.remove('current-word'));
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
      playCurrentAyah();
    } else {
      dom.audioPlayer.play().catch((e: unknown) => console.warn(e));
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

function onAudioPlay(): void {
  _autoAdvancing = false;
  _audioRetryCount = 0;
  if (_autoAdvanceSafetyTimer) {
    clearTimeout(_autoAdvanceSafetyTimer);
    _autoAdvanceSafetyTimer = null;
  }
  setPlayingState();
  updateSleepTimerDisplay();
  const vizCanvas = document.getElementById('audioVisualizer');
  if (vizCanvas) {
    startVisualizer(vizCanvas as HTMLCanvasElement);
  }
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

function onAudioPause(): void {
  // When audio ends naturally, the browser fires both 'pause' and 'ended' events.
  // The 'ended' handler manages surah transitions (including autoPlayNext).
  // We must NOT set isPlaying=false here if the audio ended naturally,
  // otherwise nextSurah() will see autoPlay=false and won't auto-play.
  if (dom.audioPlayer?.ended) {
    // Audio ended naturally — let onAudioEnded handle the state transition.
    // Only stop the visualizer; don't change isPlaying.
    stopVisualizer();
    return;
  }
  setStoppedState();
  stopVisualizer();
}

function onAudioError(): void {
  _autoAdvancing = false;
  _mp3quranUrl = null;
  stopWordTracking();
  stopVisualizer();

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
 */
export function updatePlayPauseBtn(): void {
  if (dom.playPauseBtn) {
    dom.playPauseBtn.textContent = state.isPlaying ? __('pause') : __('play');
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

/**
 * Reset the repeat mode UI elements.
 * Separated from completeRepeat for testability.
 */
export function resetRepeatUI(): void {
  dom.repeatBtn?.classList.remove('active');
  if (dom.repeatControls) {
    dom.repeatControls.style.display = 'none';
  }
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

/* ===================== REPEAT UI (separated from logic) ===================== */

/**
 * Compute the default repeat range for the current surah.
 * Pure function — no side effects, easy to test.
 *
 * @param surahData The surah data to compute the default range for
 * @returns A RepeatRange with from=1, to=ayah count, times=3
 */
export function getDefaultRepeatRange(surahData: SurahData): RepeatRange {
  return { from: 1, to: surahData.ayahs.length, times: 3 };
}

/**
 * Apply the repeat mode UI state — toggle button active class and controls visibility.
 * Separated from toggleRepeat for testability — pure DOM operation.
 *
 * @param active Whether repeat mode is currently active
 */
export function applyRepeatUI(active: boolean): void {
  dom.repeatBtn?.classList.toggle('active', active);
  if (dom.repeatControls) {
    // `.hidden` uses `display: none !important`; remove it before showing
    // the range controls or Android will keep them invisible.
    dom.repeatControls.classList.toggle('hidden', !active);
    dom.repeatControls.style.display = active ? 'flex' : 'none';
  }
}

/**
 * Populate repeat range dropdowns in the UI.
 * Separated from toggleRepeat for testability and clarity.
 *
 * @param range The repeat range configuration to populate the UI with
 */
export function populateRepeatUI(range: RepeatRange): void {
  if (!dom.repeatFrom || !dom.repeatTo || !dom.repeatTimes) {
    return;
  }

  // Build option elements once and clone for each dropdown. For long surahs
  // (e.g. Al-Baqarah with 286 ayahs) this halves the number of <option>
  // allocations from 572 to 286 + clones (which are cheap).
  const fromOpts = document.createDocumentFragment();
  const toOpts = document.createDocumentFragment();

  for (let i = 1; i <= range.to; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    // Clone for the "to" dropdown — cloneNode is faster than recreating
    // because it skips attribute parsing.
    fromOpts.appendChild(opt);
    toOpts.appendChild(opt.cloneNode(true));
  }

  dom.repeatFrom.replaceChildren(fromOpts);
  dom.repeatTo.replaceChildren(toOpts);
  dom.repeatFrom.value = String(range.from);
  dom.repeatTo.value = String(range.to);
  dom.repeatTimes.value = String(range.times);

  // Bind change handlers
  dom.repeatFrom.onchange = () => {
    state.repeatFrom = parseInt(dom.repeatFrom!.value, 10);
    if (state.repeatFrom > state.repeatTo) {
      state.repeatTo = state.repeatFrom;
      dom.repeatTo!.value = String(state.repeatTo);
    }
    state.repeatCounter = 0;
  };
  dom.repeatTo.onchange = () => {
    state.repeatTo = parseInt(dom.repeatTo!.value, 10);
    if (state.repeatTo < state.repeatFrom) {
      state.repeatFrom = state.repeatTo;
      dom.repeatFrom!.value = String(state.repeatFrom);
    }
    state.repeatCounter = 0;
  };
  dom.repeatTimes.onchange = () => {
    state.repeatTimes = parseInt(dom.repeatTimes!.value, 10);
    state.repeatCounter = 0;
  };
}

/**
 * Toggle repeat mode on/off.
 * State changes are separated from DOM updates for testability.
 * When enabled, initializes the repeat range to the full surah and populates UI dropdowns.
 */
export function toggleRepeat(): void {
  hapticFeedback();
  state.repeatMode = !state.repeatMode;
  state.repeatCounter = 0;
  applyRepeatUI(state.repeatMode);

  if (state.repeatMode && state.surahData) {
    const range = getDefaultRepeatRange(state.surahData);
    state.repeatFrom = range.from;
    state.repeatTo = range.to;
    state.repeatTimes = range.times;
    populateRepeatUI(range);
    showToast(__('repeat_on'), 'success');
  } else {
    showToast(__('repeat_off'), '');
  }
}

/* ===================== SLEEP TIMER ===================== */

/**
 * Set a sleep timer to pause audio after N minutes.
 * @param minutes Duration in minutes. Set to 0 or negative to cancel.
 */
export function setSleepTimer(minutes: number): void {
  clearSleepTimer();
  if (minutes <= 0) {
    showToast(__('sleep_timer_cancelled'), '');
    return;
  }
  _sleepTimerMinutes = minutes;
  _sleepTimerStart = Date.now();
  _sleepTimer = setTimeout(
    () => {
      if (dom.audioPlayer && !dom.audioPlayer.paused) {
        dom.audioPlayer.pause();
        setStoppedState();
      }
      showToast(__('sleep_timer_stopped', String(minutes)), 'success');
      _sleepTimerMinutes = 0;
      _sleepTimerStart = 0;
      updateSleepTimerDisplay();
    },
    minutes * 60 * 1000,
  );
  showToast(__('sleep_timer_set', String(minutes)), 'success');
  updateSleepTimerDisplay();
  ensureSleepTimerInterval();
}

/**
 * Clear the active sleep timer and reset timer state.
 * Updates the sleep timer display after clearing.
 */
export function clearSleepTimer(): void {
  if (_sleepTimer) {
    clearTimeout(_sleepTimer);
    _sleepTimer = null;
  }
  _sleepTimerMinutes = 0;
  _sleepTimerStart = 0;
  updateSleepTimerDisplay();
}

/**
 * Get the original sleep timer duration in minutes.
 *
 * @returns The timer duration in minutes, or 0 if no timer is active
 */
export function getSleepTimerMinutes(): number {
  return _sleepTimerMinutes;
}

/**
 * Get the remaining time in minutes for the sleep timer, with fractional precision.
 *
 * @returns Remaining minutes (fractional), or 0 if no timer is active
 */
export function getSleepTimerRemaining(): number {
  if (!_sleepTimerMinutes || !_sleepTimerStart) {
    return 0;
  }
  const elapsed = (Date.now() - _sleepTimerStart) / (60 * 1000);
  return Math.max(0, _sleepTimerMinutes - elapsed);
}

/** Update the sleep timer display in the player UI. */
function updateSleepTimerDisplay(): void {
  const el = document.getElementById('sleepTimerDisplay');
  if (!el) {
    return;
  }
  if (!_sleepTimerMinutes || !_sleepTimerStart) {
    el.textContent = '';
    el.style.display = 'none';
    return;
  }
  el.style.display = 'inline';
  const remaining = getSleepTimerRemaining();
  const mins = Math.floor(remaining);
  const secs = Math.floor((remaining - mins) * 60);
  el.textContent = `${__('sleep_timer_remaining') ?? '\u0645\u062a\u0628\u0642\u064a'} ${mins}:${secs.toString().padStart(2, '0')}`;
}

let _sleepTimerInterval: ReturnType<typeof setInterval> | null = null;

function ensureSleepTimerInterval(): void {
  if (_sleepTimerInterval) {
    return;
  }
  _sleepTimerInterval = setInterval(() => {
    if (_sleepTimerMinutes && _sleepTimerStart) {
      updateSleepTimerDisplay();
    }
  }, 15000);
}

/**
 * Stop the sleep timer display interval.
 * Called during test cleanup or app shutdown to prevent memory leaks.
 */
export function cleanupSleepTimerInterval(): void {
  if (_sleepTimerInterval) {
    clearInterval(_sleepTimerInterval);
    _sleepTimerInterval = null;
  }
}

// Re-export for audio-visualizer (avoids circular import)
import { startVisualizer, stopVisualizer } from './audio-visualizer.js';
