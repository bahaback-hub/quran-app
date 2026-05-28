import { state } from "./state.js";
import { CONFIG } from "./config.js";
import { dom } from "./dom.js";
import { storage } from "./storage.js";
import { showToast } from "./ui.js";
import { loadSurah, highlightCurrentAyah } from "./app.js";
import { getReciterById } from "./reciters.js";

export function prepareAudioForNewSurah() {
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

/* ===================== PLAYER ===================== */
/** Play the current ayah audio. */
export function playCurrentAyah() {
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
  dom.audioPlayer.src = url;
  dom.audioPlayer.play().catch(e => console.warn(e));
  state.isPlaying = true;
  startWordTracking();
  preloadNextAyah();
}

function preloadNextAyah() {
  if (!state.ayahsAudios) return;
  const nextIdx = state.currentAyahIndex + 1;
  if (nextIdx < state.ayahsAudios.length) {
    const nextUrl = state.ayahsAudios[nextIdx];
    if (nextUrl) {
      if (!dom.audioPlayer2) {
        const a2 = document.createElement('audio');
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

function startWordTracking() {
  wordTrackingActive = true;
}

function stopWordTracking() {
  wordTrackingActive = false;
  document.querySelectorAll('.word.current-word').forEach(el => el.classList.remove('current-word'));
}

function onTimeUpdate() {
  if (!wordTrackingActive || !dom.audioPlayer || !state.surahData) return;
  const duration = dom.audioPlayer.duration;
  if (!duration || !isFinite(duration)) return;
  const currentTime = dom.audioPlayer.currentTime;

  const ayahEl = document.querySelector(`.ayah[data-index="${state.currentAyahIndex}"]`);
  if (!ayahEl) return;

  const words = ayahEl.querySelectorAll('.word');
  if (words.length === 0) return;

  // Weight each word by Arabic letter count (ignore diacritics)
  const weights = [];
  for (const w of words) {
    const letters = (w.textContent.match(/[\u0621-\u064A\u0660-\u0669]/g) || []);
    weights.push(Math.max(1, letters.length));
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const pauseRatio = words.length <= 3 ? 0.06 : words.length <= 8 ? 0.04 : 0.025;
  const speechRatio = 1 - pauseRatio * (words.length - 1);
  let cumTime = 0;
  const startTimes = [];
  for (let i = 0; i < words.length; i++) {
    startTimes.push(cumTime);
    cumTime += (weights[i] / totalWeight) * speechRatio * duration + pauseRatio * duration;
  }
  let wordIndex = words.length - 1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (currentTime >= startTimes[i]) { wordIndex = i; break; }
  }
  words.forEach((w, i) => {
    w.classList.toggle('current-word', i <= wordIndex);
  });
}

function onSeeking() {
  if (!wordTrackingActive) return;
  document.querySelectorAll('.word.current-word').forEach(el => el.classList.remove('current-word'));
}


/* ===================== AUDIO EVENTS ===================== */
export function expandPlayer() {
  dom.player?.classList.remove('collapsed');
  storage.set('player_collapsed', false);
}

/** Toggle play/pause. */
export function togglePlayPause() {
  if (!state.surahData || !dom.audioPlayer) return;
  if (dom.audioPlayer.paused) {
    if (!dom.audioPlayer.src || dom.audioPlayer.ended) {
      state.currentAyahIndex = 0;
      highlightCurrentAyah();
      playCurrentAyah();
    } else {
      dom.audioPlayer.play().catch(e => console.warn(e));
    }
  } else {
    dom.audioPlayer.pause();
  }
}

/** Bind audio player events (ended, play, pause, error). */
export function bindAudioEvents() {
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
}

function onAudioPlay() { state.isPlaying = true; updatePlayPauseBtn(); }
function onAudioPause() { state.isPlaying = false; updatePlayPauseBtn(); }
function onAudioError() {
  state.isPlaying = false;
  updatePlayPauseBtn();
  showToast('⚠️ تعذّر تشغيل الصوت، حاول آية أخرى', 'error');
}

export function updatePlayPauseBtn() {
  if (dom.playPauseBtn) {
    dom.playPauseBtn.textContent = state.isPlaying ? '⏸ إيقاف' : '⏯ تشغيل';
  }
}

function onAudioEnded() {
  if (!state.surahData || !state.ayahsAudios) return;
  stopWordTracking();

  if (state.repeatMode) {
    const currentNum = state.surahData.ayahs[state.currentAyahIndex].numberInSurah;
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
      const startIdx = state.surahData.ayahs.findIndex(a => a.numberInSurah === state.repeatFrom);
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

  if (state.currentAyahIndex === state.ayahsAudios.length - 1) {
    showToast(`✅ انتهت سورة ${state.surahData.name}`, 'success');
  }
  nextAyah(true);
}

/** Go to next ayah (or next surah). */
export function nextAyah(autoFromRepeat) {
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
export function prevAyah() {
  if (!state.surahData) return;
  if (state.currentAyahIndex > 0) {
    state.currentAyahIndex--;
    highlightCurrentAyah();
    if (state.isPlaying) playCurrentAyah();
  } else if (state.currentSurah > 1) {
    prevSurah();
  }
}

export function nextSurah() { if (state.currentSurah < CONFIG.SURAH_COUNT) loadSurah(state.currentSurah + 1, { autoPlay: state.isPlaying }); }
export function prevSurah() { if (state.currentSurah > 1) loadSurah(state.currentSurah - 1, { autoPlay: state.isPlaying }); }


/* ===================== HIFDH & REPEAT ===================== */
/** Toggle hifdh (memorization) mode. */
export function toggleHifdh() {
  state.hifdhMode = !state.hifdhMode;
  dom.hifdhBtn?.classList.toggle('active', state.hifdhMode);
  document.querySelectorAll('.ayah').forEach(el => {
    if (state.hifdhMode) el.classList.add('hifdh-mode');
    else el.classList.remove('hifdh-mode', 'revealed');
  });
  if (state.hifdhMode) highlightCurrentAyah();
  showToast(state.hifdhMode ? '🧠 وضع الحفظ مفعّل' : 'وضع الحفظ مغلق', state.hifdhMode ? 'success' : '');
}

/** Toggle repeat mode. */
export function toggleRepeat() {
  state.repeatMode = !state.repeatMode;
  state.repeatCounter = 0;
  dom.repeatBtn?.classList.toggle('active', state.repeatMode);
  if (dom.repeatControls) dom.repeatControls.style.display = state.repeatMode ? 'flex' : 'none';
  if (state.repeatMode && state.surahData) {
    state.repeatFrom = 1;
    state.repeatTo = state.surahData.ayahs.length;
    state.repeatTimes = 3;
    if (dom.repeatFrom && dom.repeatTo && dom.repeatTimes) {
      dom.repeatFrom.innerHTML = '';
      dom.repeatTo.innerHTML = '';
      for (let i = 1; i <= state.surahData.ayahs.length; i++) {
        dom.repeatFrom.innerHTML += `<option value="${i}">${i}</option>`;
        dom.repeatTo.innerHTML += `<option value="${i}">${i}</option>`;
      }
      dom.repeatFrom.value = state.repeatFrom;
      dom.repeatTo.value = state.repeatTo;
      dom.repeatTimes.value = state.repeatTimes;
      dom.repeatFrom.onchange = () => {
        state.repeatFrom = parseInt(dom.repeatFrom.value, 10);
        if (state.repeatFrom > state.repeatTo) { state.repeatTo = state.repeatFrom; dom.repeatTo.value = state.repeatTo; }
        state.repeatCounter = 0;
      };
      dom.repeatTo.onchange = () => {
        state.repeatTo = parseInt(dom.repeatTo.value, 10);
        if (state.repeatTo < state.repeatFrom) { state.repeatFrom = state.repeatTo; dom.repeatFrom.value = state.repeatFrom; }
        state.repeatCounter = 0;
      };
      dom.repeatTimes.onchange = () => { state.repeatTimes = parseInt(dom.repeatTimes.value, 10); state.repeatCounter = 0; };
    }
    showToast('🔁 وضع التكرار مفعّل', 'success');
  } else {
    showToast('التكرار مغلق', '');
  }
}

