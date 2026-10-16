/**
 * Word-by-word highlighting for audio playback.
 *
 * Tracks the media position and paints the `.current-word` class on the
 * matching word inside the current ayah. Also decides when a timed
 * single-file recording (mp3quran) crosses the end of the current ayah —
 * the host performs the actual repeat/advance/stop transition so this
 * module stays independent of the playback engine.
 *
 * Extracted from audio.ts. The engine hooks arrive via initWordTrackingHost()
 * to avoid a circular import back into audio.ts; state/dom are safe to read
 * directly.
 */

import { state } from '../../state.js';
import { dom } from '../../dom.js';
import type { WordWeightsResult } from './audio-types.js';

/* ===================== HOST WIRING ===================== */

/** Playback-engine hooks the tracker needs; injected by audio.ts. */
export interface WordTrackingHost {
  /** True while an automatic ayah transition is already in flight. */
  isAutoAdvancing(): boolean;
  /** True when the current surah plays as one file with ayah timings. */
  hasTimings(): boolean;
  /** Start offset (seconds) of the current ayah in the single-file recording. */
  getAyahStartTime(): number;
  /** End offset (seconds) of the current ayah in the single-file recording. */
  getAyahEndTime(): number;
  /** Hand a crossed ayah boundary to the playback engine (repeat/advance/stop). */
  onAyahBoundary(): void;
}

let _host: WordTrackingHost | null = null;

/** Inject the playback-engine hooks. Called once at module init by audio.ts. */
export function initWordTrackingHost(host: WordTrackingHost): void {
  _host = host;
}

/* ===================== WORD-BY-WORD TRACKING ===================== */

let wordTrackingActive = false;
const _wordWeightsCache = new Map<string, WordWeightsResult>();

function wordWeightsKey(ayahIndex: number): string {
  // The reciter and playback speed change the audio duration, so timings are
  // only valid for that exact combination. Keying on all three avoids stale
  // sync after a reciter/speed change without clearing the whole cache.
  const speed = dom.audioPlayer?.playbackRate ?? 1;
  return `${ayahIndex}|${state.currentReciter}|${speed}`;
}

export function startWordTracking(): void {
  _lastWordIndex = -1;
  wordTrackingActive = true;
}

export function stopWordTracking(): void {
  wordTrackingActive = false;
  _lastWordIndex = -1;
  document.querySelectorAll('.word.current-word').forEach((el: Element) => el.classList.remove('current-word'));
}

function getCachedWordWeights(ayahIndex: number): WordWeightsResult | null {
  const cached = _wordWeightsCache.get(wordWeightsKey(ayahIndex));
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
  _wordWeightsCache.set(wordWeightsKey(ayahIndex), result);
  return result;
}

export function clearWordWeightsCache(): void {
  _wordWeightsCache.clear();
}

let _cachedWordEls: NodeListOf<Element> | null = null;
let _cachedWordAyahIndex = -1;
/** Last word index painted with 'current-word'; -1 means no words painted. */
let _lastWordIndex = -1;

/** Drop the cached word nodes (surah switch / re-render safety). */
export function resetWordTrackingDomCache(): void {
  _cachedWordEls = null;
  _cachedWordAyahIndex = -1;
}

export function onTimeUpdate(): void {
  if (!_host || _host.isAutoAdvancing() || !wordTrackingActive || !dom.audioPlayer || !state.surahData) {
    return;
  }
  let duration = dom.audioPlayer.duration;
  if (!duration || !isFinite(duration)) {
    return;
  }
  let currentTime = dom.audioPlayer.currentTime;

  const isMp3quran = _host.hasTimings();

  if (isMp3quran) {
    const endTime = _host.getAyahEndTime();
    if (currentTime >= endTime - 0.15) {
      _host.onAyahBoundary();
      return;
    }
    const ayahStart = _host.getAyahStartTime();
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

  // Re-query whenever the index changed OR the cached nodes were detached by a
  // surah re-render (translation late-load re-renders keep the same ayah index,
  // which previously left the cache pointing at a replaced, disconnected DOM).
  if (
    state.currentAyahIndex !== _cachedWordAyahIndex ||
    !_cachedWordEls ||
    _cachedWordEls.length === 0 ||
    !document.contains(_cachedWordEls[0]!)
  ) {
    _cachedWordEls = document.querySelectorAll(`.ayah[data-index="${state.currentAyahIndex}"] .word`);
    _cachedWordAyahIndex = state.currentAyahIndex;
    // Fresh nodes (new ayah, or detached by a late translation re-render)
    // start unpainted.
    _lastWordIndex = -1;
  }
  if (!_cachedWordEls) {
    return;
  }
  // ARC-11: paint only the diff since the last tick instead of toggling every
  // word on every timeupdate (~4×/sec). Forward: add the newly covered range.
  // Backward (seek): clear the range we no longer cover.
  if (wordIndex !== _lastWordIndex) {
    if (wordIndex > _lastWordIndex) {
      for (let i = _lastWordIndex + 1; i <= wordIndex; i++) {
        _cachedWordEls[i]?.classList.add('current-word');
      }
    } else {
      for (let i = wordIndex + 1; i <= _lastWordIndex; i++) {
        _cachedWordEls[i]?.classList.remove('current-word');
      }
    }
    _lastWordIndex = wordIndex;
  }
}

export function onSeeking(): void {
  if (!wordTrackingActive) {
    return;
  }
  _lastWordIndex = -1;
  document.querySelectorAll('.word.current-word').forEach((el: Element) => el.classList.remove('current-word'));
}
