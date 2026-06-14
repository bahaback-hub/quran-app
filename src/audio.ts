import { state } from './state.js';
import { CONFIG } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { hapticFeedback } from './utils.js';
import { highlightCurrentAyah } from './surah-loader.js';
import { getReciterById } from './reciters.js';
import { startVisualizer, stopVisualizer } from './audio-visualizer.js';
import { __ } from './i18n.js';
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

/* ===================== MODULE STATE ===================== */

let _loadSurah: LoadSurahFn | null = null;
export function setLoadSurah(fn: LoadSurahFn): void {
  _loadSurah = fn;
}

let _mp3quranUrl: string | null = null;
let _autoAdvancing = false;
let _sleepTimer: ReturnType<typeof setTimeout> | null = null;
let _sleepTimerMinutes = 0;
let _sleepTimerStart: number = 0; // timestamp when timer was set
let _audioRetryCount = 0;
const MAX_AUDIO_RETRIES = 2;
let _autoAdvanceSafetyTimer: ReturnType<typeof setTimeout> | null = null;

export function prepareAudioForNewSurah(): void {
  _mp3quranUrl = null;
  _autoAdvancing = false;
  _cachedWordEls = null;
  _cachedWordAyahIndex = -1;
  clearWordWeightsCache();
  state.isPlaying = false;
  document.body.classList.remove('audio-playing');
  updatePlayPauseBtn();
  if (dom.audioPlayer) {
    dom.audioPlayer.pause();
    dom.audioPlayer.removeAttribute('src');
    dom.audioPlayer.load();
  }
  if (dom.audioPlayer2) {
    dom.audioPlayer2.pause();
    dom.audioPlayer2.removeAttribute('src');
    dom.audioPlayer2.load();
  }
}

/* ===================== MP3QURAN SEEK HELPERS ===================== */

function _getAyahStartTime(): number {
  if (!state.ayahTimings?.length || !dom.audioPlayer?.duration) return 0;
  return (state.ayahTimings[state.currentAyahIndex] || 0) * dom.audioPlayer.duration;
}

function _getAyahEndTime(): number {
  if (!state.ayahTimings?.length || !dom.audioPlayer?.duration) return dom.audioPlayer?.duration || 0;
  const next = state.ayahTimings[state.currentAyahIndex + 1];
  return (next !== undefined ? next : 1) * dom.audioPlayer.duration;
}

/* ===================== PLAYER ===================== */

/** Play the current ayah audio. */
export function playCurrentAyah(): void {
  if (!state.surahData || !state.ayahsAudios?.length) {
    showToast(__('no_audio'), 'error');
    return;
  }
  const url = state.ayahsAudios[state.currentAyahIndex];
  if (!url) {
    showToast(__('no_audio_ayah'), 'error');
    return;
  }
  if (!dom.audioPlayer) return;

  const isMp3quran = state.ayahTimings?.length > 0;

  if (isMp3quran && _mp3quranUrl === url && dom.audioPlayer.readyState >= 2) {
    dom.audioPlayer.currentTime = _getAyahStartTime();
    dom.audioPlayer.play().catch((e: unknown) => console.warn(e));
    state.isPlaying = true;
    startWordTracking();
    return;
  }

  _mp3quranUrl = isMp3quran ? url : null;

  if (isMp3quran) {
    dom.audioPlayer.src = url;
    dom.audioPlayer.addEventListener(
      'loadedmetadata',
      function onMeta(): void {
        dom.audioPlayer!.removeEventListener('loadedmetadata', onMeta);
        dom.audioPlayer!.currentTime = _getAyahStartTime();
        dom.audioPlayer!.play().catch((e: unknown) => console.warn(e));
      },
      { once: true }
    );
  } else {
    dom.audioPlayer.src = url;
    dom.audioPlayer.play().catch((e: unknown) => console.warn(e));
  }

  // Apply saved playback rate when starting a new audio source
  const savedSpeed = storage.get<string>('playback_speed');
  if (savedSpeed) {
    dom.audioPlayer.playbackRate = parseFloat(savedSpeed);
  }

  state.isPlaying = true;
  startWordTracking();
  if (!isMp3quran) preloadNextAyah();
}

function preloadNextAyah(): void {
  if (!state.ayahsAudios) return;
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
  if (cached) return cached;
  const ayahEl = document.querySelector(`.ayah[data-index="${ayahIndex}"]`);
  if (!ayahEl) return null;
  const words = ayahEl.querySelectorAll('.word');
  if (words.length === 0) return null;
  const weights: number[] = [];
  for (const w of words) {
    const letters = w.textContent?.match(/[\u0621-\u064A\u0660-\u0669]/g) || [];
    weights.push(Math.max(1, letters.length));
  }
  const totalWeight = weights.reduce((a: number, b: number) => a + b, 0);
  const pauseRatio = words.length <= 3 ? 0.06 : words.length <= 8 ? 0.04 : 0.025;
  const speechRatio = 1 - pauseRatio * (words.length - 1);
  let cumTime = 0;
  const startTimes: number[] = [];
  for (let i = 0; i < words.length; i++) {
    startTimes.push(cumTime);
    cumTime += (weights[i] / totalWeight) * speechRatio + pauseRatio;
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
  if (_autoAdvancing || !wordTrackingActive || !dom.audioPlayer || !state.surahData) return;
  let duration = dom.audioPlayer.duration;
  if (!duration || !isFinite(duration)) return;
  let currentTime = dom.audioPlayer.currentTime;

  const isMp3quran = state.ayahTimings?.length > 0;

  if (isMp3quran) {
    const endTime = _getAyahEndTime();
    if (currentTime >= endTime - 0.15) {
      if (_autoAdvancing) return;
      _autoAdvancing = true;
      // Pause to prevent the real 'ended' event from firing after we handle it
      dom.audioPlayer.pause();
      try {
        if (state.currentAyahIndex < state.ayahsAudios.length - 1) {
          nextAyah(true);
        } else {
          onAudioEnded();
        }
      } catch (e) {
        console.warn('[Audio] Error during auto-advance:', e);
        _autoAdvancing = false; // Reset on error to prevent stuck state
      }
      // Safety timeout: if onAudioPlay doesn't fire within 5s, reset _autoAdvancing
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
    if (currentTime < 0) currentTime = 0;
  }

  const wordData = getCachedWordWeights(state.currentAyahIndex);
  if (!wordData) return;

  const startTimes = wordData.startTimes.map((t: number) => t * duration);
  let wordIndex = wordData.wordCount - 1;
  for (let i = wordData.wordCount - 1; i >= 0; i--) {
    if (currentTime >= startTimes[i]) {
      wordIndex = i;
      break;
    }
  }

  if (state.currentAyahIndex !== _cachedWordAyahIndex) {
    _cachedWordEls = document.querySelectorAll(`.ayah[data-index="${state.currentAyahIndex}"] .word`);
    _cachedWordAyahIndex = state.currentAyahIndex;
  }
  if (!_cachedWordEls) return;
  for (let i = 0; i < _cachedWordEls.length; i++) {
    _cachedWordEls[i].classList.toggle('current-word', i <= wordIndex);
  }
}

function onSeeking(): void {
  if (!wordTrackingActive) return;
  document.querySelectorAll('.word.current-word').forEach((el: Element) => el.classList.remove('current-word'));
}

/* ===================== AUDIO EVENTS ===================== */

export function expandPlayer(): void {
  dom.player?.classList.remove('collapsed');
  storage.set('player_collapsed', false);
}

/** Toggle play/pause. */
export function togglePlayPause(): void {
  if (!state.surahData || !dom.audioPlayer) return;
  hapticFeedback();
  if (dom.audioPlayer.paused) {
    if (!dom.audioPlayer.src || dom.audioPlayer.ended) {
      // Replay current ayah instead of resetting to first ayah
      highlightCurrentAyah();
      playCurrentAyah();
    } else {
      dom.audioPlayer.play().catch((e: unknown) => console.warn(e));
    }
  } else {
    dom.audioPlayer.pause();
  }
}

/** Bind audio player events (ended, play, pause, error). */
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
  _audioRetryCount = 0; // Reset retry count on successful play
  if (_autoAdvanceSafetyTimer) {
    clearTimeout(_autoAdvanceSafetyTimer);
    _autoAdvanceSafetyTimer = null;
  }
  state.isPlaying = true;
  document.body.classList.add('audio-playing');
  updatePlayPauseBtn();
  updateSleepTimerDisplay();
  const vizCanvas = document.getElementById('audioVisualizer');
  if (vizCanvas) startVisualizer(vizCanvas as HTMLCanvasElement);
  if ('mediaSession' in navigator && state.surahData) {
    const surahData: SurahData | null = state.surahData;
    if (!surahData) return;
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
  state.isPlaying = false;
  document.body.classList.remove('audio-playing');
  updatePlayPauseBtn();
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
    showToast(`${__('audio_error')} (\u0645\u062d\u0627\u0648\u0644\u0629 ${_audioRetryCount}/${MAX_AUDIO_RETRIES})`, 'error');
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
  state.isPlaying = false;
  document.body.classList.remove('audio-playing');
  updatePlayPauseBtn();
  showToast(__('audio_error'), 'error');
}

export function updatePlayPauseBtn(): void {
  if (dom.playPauseBtn) {
    dom.playPauseBtn.textContent = state.isPlaying ? __('pause') : __('play');
  }
}

function onAudioEnded(): void {
  _mp3quranUrl = null;
  if (!state.surahData) return;
  stopWordTracking();

  if (state.repeatMode) {
    const surahData: SurahData = state.surahData;
    const currentNum = surahData.ayahs[state.currentAyahIndex].numberInSurah;
    if (currentNum === state.repeatTo) {
      state.repeatCounter++;
      if (state.repeatCounter >= state.repeatTimes) {
        state.repeatMode = false;
        state.repeatCounter = 0;
        dom.repeatBtn?.classList.remove('active');
        if (dom.repeatControls) dom.repeatControls.style.display = 'none';
        showToast(__('repeat_complete'), 'success');
        // Stop playback when repeat is complete
        state.isPlaying = false;
        document.body.classList.remove('audio-playing');
        updatePlayPauseBtn();
        return;
      }
      const startIdx = surahData.ayahs.findIndex(
        (a: { numberInSurah: number }) => a.numberInSurah === state.repeatFrom
      );
      if (startIdx !== -1) {
        state.currentAyahIndex = startIdx;
        highlightCurrentAyah();
        playCurrentAyah();
        return;
      }
    }
    // If current ayah is before repeatFrom, jump to repeatFrom instead of advancing
    if (currentNum < state.repeatFrom) {
      const startIdx = surahData.ayahs.findIndex(
        (a: { numberInSurah: number }) => a.numberInSurah === state.repeatFrom
      );
      if (startIdx !== -1) {
        state.currentAyahIndex = startIdx;
        highlightCurrentAyah();
        playCurrentAyah();
        return;
      }
    }
    nextAyah(true);
    return;
  }

  const surahData: SurahData | null = state.surahData;
  if (!surahData) return;
  if (state.currentAyahIndex === state.ayahsAudios.length - 1) {
    // Last ayah of the surah
    if (state.currentSurah >= CONFIG.SURAH_COUNT) {
      // Last surah (114) — stop playback cleanly
      showToast(`✅ ${__('surah_complete')} ${surahData.name}`, 'success');
      state.isPlaying = false;
      document.body.classList.remove('audio-playing');
      updatePlayPauseBtn();
      return;
    }
    showToast(`✅ ${__('surah_complete')} ${surahData.name}`, 'success');
  }
  nextAyah(true);
}

/** Go to next ayah (or next surah). */
export function nextAyah(autoFromRepeat: boolean): void {
  if (!state.surahData || !state.ayahsAudios) return;
  if (state.currentAyahIndex < state.ayahsAudios.length - 1) {
    state.currentAyahIndex++;
    highlightCurrentAyah();
    if (autoFromRepeat || state.isPlaying) playCurrentAyah();
  } else if (state.currentSurah < CONFIG.SURAH_COUNT) {
    if (state.mushafMode) {
      dom.audioPlayer?.pause();
      state.isPlaying = false;
      document.body.classList.remove('audio-playing');
      updatePlayPauseBtn();
      return;
    }
    nextSurah();
  }
}

/** Go to previous ayah (or previous surah). */
export function prevAyah(): void {
  if (!state.surahData) return;
  if (state.currentAyahIndex > 0) {
    state.currentAyahIndex--;
    highlightCurrentAyah();
    if (state.isPlaying) playCurrentAyah();
  } else if (state.currentSurah > 1) {
    prevSurah();
  }
}

export function nextSurah(): void {
  if (state.currentSurah < CONFIG.SURAH_COUNT) _loadSurah?.(state.currentSurah + 1, { autoPlay: state.isPlaying });
}

export function prevSurah(): void {
  if (state.currentSurah > 1) _loadSurah?.(state.currentSurah - 1, { autoPlay: state.isPlaying });
}

/* ===================== HIFDH & REPEAT ===================== */

/** Toggle hifdh (memorization) mode. */
export function toggleHifdh(): void {
  hapticFeedback();
  state.hifdhMode = !state.hifdhMode;
  dom.hifdhBtn?.classList.toggle('active', state.hifdhMode);
  document.querySelectorAll('.ayah').forEach((el: Element) => {
    if (state.hifdhMode) el.classList.add('hifdh-mode');
    else el.classList.remove('hifdh-mode', 'revealed');
  });
  if (state.hifdhMode) highlightCurrentAyah();
  showToast(state.hifdhMode ? __('hifdh_on') : __('hifdh_off'), state.hifdhMode ? 'success' : '');
}

/** Toggle repeat mode. */
export function toggleRepeat(): void {
  hapticFeedback();
  state.repeatMode = !state.repeatMode;
  state.repeatCounter = 0;
  dom.repeatBtn?.classList.toggle('active', state.repeatMode);
  if (dom.repeatControls) dom.repeatControls.style.display = state.repeatMode ? 'flex' : 'none';
  if (state.repeatMode && state.surahData) {
    const surahData: SurahData = state.surahData;
    state.repeatFrom = 1;
    state.repeatTo = surahData.ayahs.length;
    state.repeatTimes = 3;
    if (dom.repeatFrom && dom.repeatTo && dom.repeatTimes) {
      const opts = document.createDocumentFragment();
      const opts2 = document.createDocumentFragment();
      for (let i = 1; i <= surahData.ayahs.length; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = String(i);
        opts.appendChild(opt);
        const opt2 = document.createElement('option');
        opt2.value = String(i);
        opt2.textContent = String(i);
        opts2.appendChild(opt2);
      }
      dom.repeatFrom.replaceChildren(opts);
      dom.repeatTo.replaceChildren(opts2);
      dom.repeatFrom.value = String(state.repeatFrom);
      dom.repeatTo.value = String(state.repeatTo);
      dom.repeatTimes.value = String(state.repeatTimes);
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
    showToast(__('repeat_on'), 'success');
  } else {
    showToast(__('repeat_off'), '');
  }
}

/* ===================== SLEEP TIMER ===================== */

/** Set a sleep timer to pause audio after N minutes. */
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
        state.isPlaying = false;
        document.body.classList.remove('audio-playing');
        updatePlayPauseBtn();
      }
      showToast(__('sleep_timer_stopped', String(minutes)), 'success');
      _sleepTimerMinutes = 0;
      _sleepTimerStart = 0;
      updateSleepTimerDisplay();
    },
    minutes * 60 * 1000
  );
  showToast(__('sleep_timer_set', String(minutes)), 'success');
  updateSleepTimerDisplay();
  ensureSleepTimerInterval();
}

/** Clear the active sleep timer. */
export function clearSleepTimer(): void {
  if (_sleepTimer) {
    clearTimeout(_sleepTimer);
    _sleepTimer = null;
  }
  _sleepTimerMinutes = 0;
  _sleepTimerStart = 0;
  updateSleepTimerDisplay();
}

/** Get the original sleep timer duration in minutes. */
export function getSleepTimerMinutes(): number {
  return _sleepTimerMinutes;
}

/** Get the remaining time in minutes for the sleep timer (with decimal). */
export function getSleepTimerRemaining(): number {
  if (!_sleepTimerMinutes || !_sleepTimerStart) return 0;
  const elapsed = (Date.now() - _sleepTimerStart) / (60 * 1000);
  return Math.max(0, _sleepTimerMinutes - elapsed);
}

/** Update the sleep timer display in the player UI. */
function updateSleepTimerDisplay(): void {
  const el = document.getElementById('sleepTimerDisplay');
  if (!el) return;
  if (!_sleepTimerMinutes || !_sleepTimerStart) {
    el.textContent = '';
    el.style.display = 'none';
    return;
  }
  el.style.display = 'inline';
  const remaining = getSleepTimerRemaining();
  const mins = Math.floor(remaining);
  const secs = Math.floor((remaining - mins) * 60);
  el.textContent = `${__('sleep_timer_remaining') ?? '\\u0645\\u062a\\u0628\\u0642\\u064a'} ${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update the sleep timer countdown every 15 seconds
// Lazy-initialized: only starts the interval when first needed
let _sleepTimerInterval: ReturnType<typeof setInterval> | null = null;

function ensureSleepTimerInterval(): void {
  if (_sleepTimerInterval) return;
  _sleepTimerInterval = setInterval(() => {
    if (_sleepTimerMinutes && _sleepTimerStart) {
      updateSleepTimerDisplay();
    }
  }, 15000);
}

/** Stop the sleep timer display interval (for cleanup in tests or on app shutdown). */
export function cleanupSleepTimerInterval(): void {
  if (_sleepTimerInterval) {
    clearInterval(_sleepTimerInterval);
    _sleepTimerInterval = null;
  }
}
