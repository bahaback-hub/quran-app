import { state } from "./state.js";
import { CONFIG } from "./config.js";
import { dom } from "./dom.js";
import { storage } from "./storage.js";
import { showToast } from "./ui.js";
import { hapticFeedback } from "./utils.js";
import { highlightCurrentAyah } from "./surah-loader.js";
import { getReciterById } from "./reciters.js";
import { startVisualizer, stopVisualizer } from "./audio-visualizer.js";

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
export function setLoadSurah(fn: LoadSurahFn): void { _loadSurah = fn; }

let _mp3quranUrl: string | null = null;
let _autoAdvancing = false;
let _sleepTimer: ReturnType<typeof setTimeout> | null = null;
let _sleepTimerMinutes = 0;

export function prepareAudioForNewSurah(): void {
  _mp3quranUrl = null;
  _autoAdvancing = false;
  _cachedWordEls = null;
  _cachedWordAyahIndex = -1;
  clearWordWeightsCache();
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
    showToast('لا توجد روابط صوت لهذه السورة', 'error');
    return;
  }
  const url = state.ayahsAudios[state.currentAyahIndex];
  if (!url) {
    showToast('لا يوجد صوت لهذه الآية', 'error');
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
    dom.audioPlayer.addEventListener('loadedmetadata', function onMeta(): void {
      dom.audioPlayer!.removeEventListener('loadedmetadata', onMeta);
      dom.audioPlayer!.currentTime = _getAyahStartTime();
      dom.audioPlayer!.play().catch((e: unknown) => console.warn(e));
    }, { once: true });
  } else {
    dom.audioPlayer.src = url;
    dom.audioPlayer.play().catch((e: unknown) => console.warn(e));
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
    const letters = (w.textContent?.match(/[\u0621-\u064A\u0660-\u0669]/g) || []);
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
      _autoAdvancing = true;
      if (state.currentAyahIndex < state.ayahsAudios.length - 1) {
        nextAyah(true);
      } else {
        onAudioEnded();
      }
      _autoAdvancing = false;
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
    if (currentTime >= startTimes[i]) { wordIndex = i; break; }
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
      state.currentAyahIndex = 0;
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
    navigator.mediaSession.setActionHandler('play', () => { togglePlayPause(); });
    navigator.mediaSession.setActionHandler('pause', () => { togglePlayPause(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { prevAyah(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { nextAyah(false); });
  }
}

function onAudioPlay(): void {
  state.isPlaying = true;
  updatePlayPauseBtn();
  const vizCanvas = document.getElementById('audioVisualizer');
  if (vizCanvas) startVisualizer(vizCanvas as unknown as HTMLCanvasElement);
  if ('mediaSession' in navigator && state.surahData) {
    const surahData = state.surahData as { ayahs?: { numberInSurah: number }[]; name?: string };
    const ayah = surahData.ayahs?.[state.currentAyahIndex];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: ayah ? `آية ${ayah.numberInSurah}` : '',
      artist: surahData.name || 'القرآن الكريم',
      album: 'القرآن الكريم'
    });
  }
}

function onAudioPause(): void {
  state.isPlaying = false;
  updatePlayPauseBtn();
  stopVisualizer();
}

function onAudioError(): void {
  _mp3quranUrl = null;
  state.isPlaying = false;
  stopWordTracking();
  stopVisualizer();
  updatePlayPauseBtn();
  showToast('⚠️ تعذّر تشغيل الصوت، حاول آية أخرى', 'error');
}

export function updatePlayPauseBtn(): void {
  if (dom.playPauseBtn) {
    dom.playPauseBtn.textContent = state.isPlaying ? '⏸ إيقاف' : '⏯ تشغيل';
  }
}

function onAudioEnded(): void {
  _mp3quranUrl = null;
  if (!state.surahData || !state.ayahsAudios) return;
  stopWordTracking();

  if (state.repeatMode) {
    const surahData = state.surahData as { ayahs: { numberInSurah: number }[] };
    const currentNum = surahData.ayahs[state.currentAyahIndex].numberInSurah;
    if (currentNum === state.repeatTo) {
      state.repeatCounter++;
      if (state.repeatCounter >= state.repeatTimes) {
        state.repeatMode = false;
        state.repeatCounter = 0;
        dom.repeatBtn?.classList.remove('active');
        if (dom.repeatControls) dom.repeatControls.style.display = 'none';
        showToast('✅ انتهى التكرار', 'success');
        return;
      }
      const startIdx = surahData.ayahs.findIndex((a: { numberInSurah: number }) => a.numberInSurah === state.repeatFrom);
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

  const surahData = state.surahData as { name: string };
  if (state.currentAyahIndex === state.ayahsAudios.length - 1) {
    showToast(`✅ انتهت سورة ${surahData.name}`, 'success');
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
      state.isPlaying = false;
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
  showToast(state.hifdhMode ? '🧠 وضع الحفظ مفعّل' : 'وضع الحفظ مغلق', state.hifdhMode ? 'success' : '');
}

/** Toggle repeat mode. */
export function toggleRepeat(): void {
  hapticFeedback();
  state.repeatMode = !state.repeatMode;
  state.repeatCounter = 0;
  dom.repeatBtn?.classList.toggle('active', state.repeatMode);
  if (dom.repeatControls) dom.repeatControls.style.display = state.repeatMode ? 'flex' : 'none';
  if (state.repeatMode && state.surahData) {
    const surahData = state.surahData as { ayahs: { numberInSurah: number }[] };
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
        if (state.repeatFrom > state.repeatTo) { state.repeatTo = state.repeatFrom; dom.repeatTo!.value = String(state.repeatTo); }
        state.repeatCounter = 0;
      };
      dom.repeatTo.onchange = () => {
        state.repeatTo = parseInt(dom.repeatTo!.value, 10);
        if (state.repeatTo < state.repeatFrom) { state.repeatFrom = state.repeatTo; dom.repeatFrom!.value = String(state.repeatFrom); }
        state.repeatCounter = 0;
      };
      dom.repeatTimes.onchange = () => { state.repeatTimes = parseInt(dom.repeatTimes!.value, 10); state.repeatCounter = 0; };
    }
    showToast('🔁 وضع التكرار مفعّل', 'success');
  } else {
    showToast('التكرار مغلق', '');
  }
}

/* ===================== SLEEP TIMER ===================== */

/** Set a sleep timer to pause audio after N minutes. */
export function setSleepTimer(minutes: number): void {
  clearSleepTimer();
  if (minutes <= 0) {
    showToast('تم إلغاء مؤقت النوم', '');
    return;
  }
  _sleepTimerMinutes = minutes;
  _sleepTimer = setTimeout(() => {
    if (dom.audioPlayer && !dom.audioPlayer.paused) {
      dom.audioPlayer.pause();
      state.isPlaying = false;
      updatePlayPauseBtn();
    }
    showToast(`⏰ تم إيقاف الصوت بعد ${minutes} دقيقة`, 'success');
    _sleepTimerMinutes = 0;
  }, minutes * 60 * 1000);
  showToast(`⏰ مؤقت النوم: ${minutes} دقيقة`, 'success');
}

/** Clear the active sleep timer. */
export function clearSleepTimer(): void {
  if (_sleepTimer) {
    clearTimeout(_sleepTimer);
    _sleepTimer = null;
  }
  _sleepTimerMinutes = 0;
}

/** Get remaining sleep timer minutes (approximate). */
export function getSleepTimerMinutes(): number {
  return _sleepTimerMinutes;
}
