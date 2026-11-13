/**
 * Focused hifz session runtime and room/session control helpers.
 *
 * Extracted from `hifz-room.ts`; behavior unchanged.
 */
import { toLatinDigits } from './i18n.js';
import {
  currentPlanAyah,
  getAyahCount,
  getCurrentAyah,
  getDefaultPlan,
  getPlanAyahs,
  getSavedSessionDownload,
  getSurahName,
  label,
  normalizePlan,
  normalizeReviewAt,
  savePlan,
  saveSessionDownload,
  type HifzPlan,
  type ReviewChoice,
} from './hifz-room-plan.js';
import {
  fillAyahOptions,
  fillReciterOptions,
  fillSpeedOptions,
  fillSurahOptions,
  getControls,
  syncSurahSearch,
} from './hifz-room-form.js';
import {
  getDownloadButtons,
  hydrateDownloadedSessionAudio,
  resolveSessionAudioUrls,
  setSessionDownloadBusy,
  setSessionDownloadStatus,
  setSessionReadyStatus,
} from './hifz-room-download.js';
import { playCurrentAyah } from './features/audio/audio.js';
import { cacheSurahAudio, isSurahCached } from './features/audio/audio-cache.js';
import { highlightCurrentAyah, loadSurah } from './surah-loader.js';
import { state } from './state.js';
import { storage } from './storage.js';

const STAGE_ID = 'hifzRoomStage';

export interface FocusedSessionControls {
  stage: HTMLElement;
  stageMeta: HTMLElement;
  stageText: HTMLElement;
  reciter: HTMLSelectElement;
  speed: HTMLSelectElement;
  play: HTMLButtonElement;
  restart: HTMLButtonElement;
  repeat: HTMLElement;
  hideText: HTMLButtonElement;
  toggleRange: HTMLButtonElement;
  download: HTMLButtonElement;
  downloadStatus: HTMLElement;
  end: HTMLButtonElement;
}

export function getFocusedControls(room: HTMLElement): FocusedSessionControls | null {
  const stage = document.getElementById(STAGE_ID);
  const stageMeta = stage?.querySelector<HTMLElement>('#hifzRoomStageMeta');
  const stageText = stage?.querySelector<HTMLElement>('#hifzRoomStageText');
  const reciter = room.querySelector<HTMLSelectElement>('#hifzRoomReciter');
  const speed = room.querySelector<HTMLSelectElement>('#hifzRoomSpeed');
  const play = room.querySelector<HTMLButtonElement>('#hifzRoomPlay');
  const restart = room.querySelector<HTMLButtonElement>('#hifzRoomRestart');
  const repeat = room.querySelector<HTMLElement>('#hifzRoomRepeatProgress');
  const hideText = room.querySelector<HTMLButtonElement>('#hifzRoomHideText');
  const toggleRange = room.querySelector<HTMLButtonElement>('#hifzRoomToggleRange');
  const download = room.querySelector<HTMLButtonElement>('#hifzRoomFocusDownload');
  const downloadStatus = room.querySelector<HTMLElement>('#hifzRoomFocusDownloadStatus');
  const end = room.querySelector<HTMLButtonElement>('#hifzRoomEnd');
  return stage &&
    stageMeta &&
    stageText &&
    reciter &&
    speed &&
    play &&
    restart &&
    repeat &&
    hideText &&
    toggleRange &&
    download &&
    downloadStatus &&
    end
    ? {
        stage,
        stageMeta,
        stageText,
        reciter,
        speed,
        play,
        restart,
        repeat,
        hideText,
        toggleRange,
        download,
        downloadStatus,
        end,
      }
    : null;
}

export function readPlan(room: HTMLElement): HifzPlan | null {
  const controls = getControls(room);
  if (!controls) {
    return null;
  }
  const repeat = room.querySelector<HTMLButtonElement>('[data-hifz-repeat][aria-pressed="true"]');
  const review = room.querySelector<HTMLButtonElement>('[data-hifz-review][aria-pressed="true"]');
  const reviewAt = normalizeReviewAt(controls.reviewAt.value);
  return normalizePlan({
    version: 1,
    surah: parseInt(controls.surah.value, 10),
    from: parseInt(controls.from.value, 10),
    to: parseInt(controls.to.value, 10),
    times: parseInt(toLatinDigits(controls.repeat.value || repeat?.dataset['hifzRepeat'] || '5'), 10),
    review: reviewAt ? 'custom' : (review?.dataset['hifzReview'] as ReviewChoice | undefined) || 'today',
    reviewAt,
  });
}

export function setChoice(room: HTMLElement, selector: string, value: string): void {
  room.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    const selected = button.dataset['hifzRepeat'] === value || button.dataset['hifzReview'] === value;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('is-selected', selected);
  });
}

export function updateSummary(room: HTMLElement): void {
  const plan = readPlan(room);
  const controls = getControls(room);
  if (plan && controls) {
    controls.summary.textContent = label(
      'hifz_room_summary',
      getSurahName(plan.surah),
      String(plan.from),
      String(plan.to),
      String(plan.times),
    );
  }
}

export function readSessionPlan(room: HTMLElement): HifzPlan | null {
  const plan = readPlan(room);
  const focused = getFocusedControls(room);
  if (!plan || !focused) {
    return plan;
  }
  return normalizePlan({
    ...plan,
    reciter: focused.reciter.value,
    speed: parseFloat(focused.speed.value),
  });
}

export async function refreshSessionDownloadStatus(room: HTMLElement, plan = readSessionPlan(room)): Promise<void> {
  if (!plan) {
    return;
  }
  getDownloadButtons(room).forEach((button) => {
    if (!button.disabled) {
      button.textContent = label('hifz_room_download');
    }
  });
  const record = getSavedSessionDownload(plan);
  if (!record || !(await isSurahCached(record.urls))) {
    setSessionDownloadStatus(room, 'hifz_room_download_hint');
    return;
  }
  setSessionReadyStatus(room, plan, true);
}

export async function downloadSessionAudio(room: HTMLElement): Promise<void> {
  const plan = readSessionPlan(room);
  if (!plan) {
    return;
  }
  setSessionDownloadBusy(room, true);
  setSessionDownloadStatus(room, 'hifz_room_download_preparing', 'working');
  try {
    const playbackUrls = await resolveSessionAudioUrls(plan);
    if (await isSurahCached(playbackUrls)) {
      saveSessionDownload(plan, playbackUrls);
      setSessionReadyStatus(room, plan, true);
      return;
    }
    const uniqueUrls = [...new Set(playbackUrls)];
    await cacheSurahAudio(uniqueUrls, plan.surah, plan.reciter, (_surah, _reciter, current, total) => {
      setSessionDownloadStatus(room, 'hifz_room_download_progress', 'working', String(current), String(total));
    });
    if (!(await isSurahCached(playbackUrls))) {
      throw new Error('Session audio cache is incomplete');
    }
    saveSessionDownload(plan, playbackUrls);
    setSessionReadyStatus(room, plan);
  } catch {
    setSessionDownloadStatus(room, 'hifz_room_download_failed', 'error');
  } finally {
    setSessionDownloadBusy(room, false);
  }
}

export function updateFocusedSession(room: HTMLElement, plan: HifzPlan): void {
  const controls = getFocusedControls(room);
  if (!controls) {
    return;
  }
  const textHidden = room.classList.contains('hifz-room-text-hidden');
  const showRange = room.classList.contains('hifz-room-show-range');
  const ayahs = getPlanAyahs(plan);
  const visibleAyahs = showRange
    ? ayahs
    : [currentPlanAyah(plan)].filter((ayah): ayah is { numberInSurah: number; text: string } => ayah !== null);
  controls.stageMeta.textContent = `${getSurahName(plan.surah)} — ${label('hifz_room_ayahs', String(plan.from), String(plan.to))}`;
  controls.stageText.textContent = textHidden
    ? '۞'
    : visibleAyahs.map((ayah) => `${ayah.text} ﴿${ayah.numberInSurah}﴾`).join('   ');
  controls.stage.classList.toggle('is-text-hidden', textHidden);
  controls.stage.classList.toggle('is-range-view', showRange);
  applyReaderAyahDisplay(room);
  controls.play.textContent = label(state.isPlaying ? 'pause' : 'play');
  controls.restart.textContent = label('hifz_room_restart');
  controls.repeat.textContent = label(
    'hifz_room_repeat_progress',
    String(Math.min(state.repeatCounter + 1, plan.times)),
    String(plan.times),
  );
  controls.hideText.textContent = label(textHidden ? 'hifz_room_show_text' : 'hifz_room_hide_text');
  controls.toggleRange.textContent = label(showRange ? 'hifz_room_show_one' : 'hifz_room_show_range');
  controls.end.textContent = label('hifz_room_end');
  fillReciterOptions(controls.reciter, plan.reciter);
  fillSpeedOptions(controls.speed, plan.speed);
}

export function applyReaderAyahDisplay(room: HTMLElement): void {
  if (!room.classList.contains('hifz-room-focused')) {
    return;
  }
  const textHidden = room.classList.contains('hifz-room-text-hidden');
  const showRange = room.classList.contains('hifz-room-show-range');
  const ayahs = Array.from(document.querySelectorAll<HTMLElement>('#surahContent .ayah'));
  ayahs.forEach((ayah) => {
    const shouldHide = textHidden || !showRange;
    ayah.classList.toggle('hifdh-mode', shouldHide);
    ayah.classList.remove('revealed');
  });
  if (!textHidden && !showRange) {
    const current = ayahs[state.currentAyahIndex] || ayahs.find((ayah) => ayah.classList.contains('current'));
    current?.classList.add('revealed');
  }
}

export function applySessionAudioPreferences(plan: HifzPlan): void {
  state.currentReciter = plan.reciter;
  storage.set('reciter', plan.reciter);
  storage.set('playback_speed', String(plan.speed));
  const mainReciter = document.getElementById('reciterSelect') as HTMLSelectElement | null;
  const mainSpeed = document.getElementById('speedSelect') as HTMLSelectElement | null;
  const audio = document.getElementById('audioPlayer') as HTMLAudioElement | null;
  if (mainReciter) {
    mainReciter.value = plan.reciter;
  }
  if (mainSpeed) {
    mainSpeed.value = String(plan.speed);
  }
  if (audio) {
    audio.playbackRate = plan.speed;
  }
}

export function enterFocusedSession(room: HTMLElement, plan: HifzPlan): void {
  const focused = getFocusedControls(room);
  if (!focused) {
    return;
  }
  room.classList.add('hifz-room-focused');
  room.classList.remove('hifz-room-text-hidden', 'hifz-room-show-range');
  focused.stage.setAttribute('aria-hidden', 'false');
  document.body.classList.add('hifz-room-focused-active');
  updateFocusedSession(room, plan);
  showFocusedControls(room);
  window.setTimeout(() => focused.play.focus(), 0);
}

export function leaveFocusedSession(room: HTMLElement, restoreSetup = true): void {
  const focused = getFocusedControls(room);
  room.classList.remove('hifz-room-focused', 'hifz-room-text-hidden', 'hifz-room-show-range');
  document.body.classList.remove('hifz-room-focused-active', 'hifz-room-tools-hidden');
  room.setAttribute('aria-hidden', 'false');
  room.removeAttribute('inert');
  if (focused) {
    focused.stage.setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll<HTMLElement>('#surahContent .ayah').forEach((ayah) => {
    ayah.classList.remove('hifdh-mode', 'revealed');
  });
  if (restoreSetup) {
    const plan = readSessionPlan(room) || getDefaultPlan();
    refreshForm(room, plan);
  }
}

export function showFocusedControls(room: HTMLElement): void {
  if (!room.classList.contains('hifz-room-focused')) {
    return;
  }
  document.body.classList.remove('hifz-room-tools-hidden');
}

export function restartFocusedPortion(room: HTMLElement): void {
  const plan = readSessionPlan(room);
  if (!plan || !state.surahData) {
    return;
  }
  const index = state.surahData.ayahs.findIndex((ayah) => ayah.numberInSurah === plan.from);
  if (index < 0) {
    return;
  }
  state.currentAyahIndex = index;
  state.repeatCounter = 0;
  highlightCurrentAyah();
  void playCurrentAyah().finally(() => updateFocusedSession(room, plan));
}

export async function updateFocusedReciter(room: HTMLElement): Promise<void> {
  const plan = readSessionPlan(room);
  if (!plan || !room.classList.contains('hifz-room-focused')) {
    return;
  }
  applySessionAudioPreferences(plan);
  savePlan(plan);
  const currentAyah = getCurrentAyah();
  await loadSurah(plan.surah, { startAyah: currentAyah });
  activateCurrentHifzTools(plan);
  updateFocusedSession(room, plan);
  void refreshSessionDownloadStatus(room, plan);
}

export function updateFocusedSpeed(room: HTMLElement): void {
  const plan = readSessionPlan(room);
  if (!plan) {
    return;
  }
  applySessionAudioPreferences(plan);
  savePlan(plan);
  updateFocusedSession(room, plan);
}

export function refreshForm(room: HTMLElement, plan = getDefaultPlan()): void {
  const controls = getControls(room);
  if (!controls) {
    return;
  }
  const normalized = normalizePlan(plan);
  fillSurahOptions(controls.surah, normalized.surah);
  syncSurahSearch(room, normalized.surah);
  fillAyahOptions(controls.from, getAyahCount(normalized.surah), normalized.from);
  fillAyahOptions(controls.to, getAyahCount(normalized.surah), normalized.to);
  controls.repeat.value = String(normalized.times);
  controls.reviewAt.value = normalized.reviewAt || '';
  setChoice(room, '[data-hifz-repeat]', String(normalized.times));
  setChoice(room, '[data-hifz-review]', normalized.review);
  controls.status.textContent = label('hifz_room_session_hint');
  const focused = getFocusedControls(room);
  if (focused) {
    fillReciterOptions(focused.reciter, normalized.reciter);
    fillSpeedOptions(focused.speed, normalized.speed);
  }
  updateSummary(room);
  void refreshSessionDownloadStatus(room, normalized);
}

export function applyExistingRepeatRange(plan: HifzPlan): void {
  const from = document.getElementById('repeatFrom') as HTMLSelectElement | null;
  const to = document.getElementById('repeatTo') as HTMLSelectElement | null;
  const times = document.getElementById('repeatTimes') as HTMLSelectElement | null;
  if (!from || !to || !times) {
    return;
  }
  from.value = String(plan.from);
  from.dispatchEvent(new Event('change', { bubbles: true }));
  to.value = String(plan.to);
  to.dispatchEvent(new Event('change', { bubbles: true }));
  if (!Array.from(times.options).some((option) => option.value === String(plan.times))) {
    times.add(new Option(`${plan.times}×`, String(plan.times)));
  }
  times.value = String(plan.times);
  times.dispatchEvent(new Event('change', { bubbles: true }));
}

export function activateCurrentHifzTools(plan: HifzPlan): void {
  const hifdhButton = document.getElementById('hifdhBtn') as HTMLButtonElement | null;
  const repeatButton = document.getElementById('repeatBtn') as HTMLButtonElement | null;
  // A completed prior session can leave the visual button state stale while the
  // actual playback modes were reset. The room must trust its selected plan,
  // including a range ending at the final ayah, rather than that old CSS class.
  if (!state.hifdhMode) {
    hifdhButton?.click();
  }
  if (!state.repeatMode) {
    repeatButton?.click();
  }
  applyExistingRepeatRange(plan);
  // Keep the site-wide player in its normal compact state while Hifz is active.
  document.getElementById('player')?.classList.add('collapsed');
  document.body.classList.remove('player-expanded');
}

/**
 * Prepare the reader for a hifz session without refetching data that is
 * already displayed. This is especially important on WebKit, where waiting
 * for the full text/audio refresh can make the Start action appear stuck.
 */
export async function prepareSurahForHifz(plan: HifzPlan): Promise<void> {
  const currentSurahIsReady =
    state.currentSurah === plan.surah && state.currentReciter === plan.reciter && state.surahData?.ayahs?.length;

  if (currentSurahIsReady) {
    const startIndex = state.surahData!.ayahs.findIndex((ayah) => ayah.numberInSurah === plan.from);
    if (startIndex >= 0) {
      state.currentAyahIndex = startIndex;
      highlightCurrentAyah();
    }
    return;
  }

  await loadSurah(plan.surah, { startAyah: plan.from });
}

export async function startHifzSession(room: HTMLElement): Promise<void> {
  const controls = getControls(room);
  const plan = readSessionPlan(room);
  if (!controls || !plan) {
    return;
  }
  savePlan(plan);
  controls.start.disabled = true;
  controls.status.textContent = label('hifz_room_loading');
  try {
    await prepareSurahForHifz(plan);
    await hydrateDownloadedSessionAudio(plan);
    const mainSelect = document.getElementById('surahSelect') as HTMLSelectElement | null;
    if (mainSelect) {
      mainSelect.value = String(plan.surah);
    }
    applySessionAudioPreferences(plan);
    activateCurrentHifzTools(plan);
    controls.status.textContent = label('hifz_room_session_active');
    room.classList.add('hifz-room-session-active');
    enterFocusedSession(room, plan);
    // The Start button is a user gesture; begin the selected portion immediately.
    await playCurrentAyah();
  } catch {
    controls.status.textContent = label('hifz_room_load_failed');
  } finally {
    controls.start.disabled = false;
  }
}
