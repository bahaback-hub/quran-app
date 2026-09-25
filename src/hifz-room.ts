/**
 * Hifz Room — web-only side space for the approved Rawdah-inspired design.
 * It stores the plan locally and reuses current player controls only after an
 * explicit user action, without changing the reader layout or Android.
 */

import {
  fillAyahOptions,
  fillReciterOptions,
  fillSpeedOptions,
  fillSurahOptions,
  getControls,
  selectSurahFromSearch,
  syncSurahSearch,
} from './hifz-room-form.js';

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
  normalizeRepeatCount,
  normalizeReviewAt,
  savePlan,
  saveSessionDownload,
  type HifzPlan,
  type ReviewChoice,
} from './hifz-room-plan.js';
import { playCurrentAyah, togglePlayPause } from './features/audio/audio.js';
import { cacheSurahAudio, isSurahCached } from './features/audio/audio-cache.js';
import { highlightCurrentAyah, loadAudioUrlsForSession, loadSurah } from './surah-loader.js';
import { state } from './state.js';
import { storage } from './storage.js';
import { closeTafsir } from './tafsir.js';
import { closeAdhkarPanel } from './adhkar.js';
import { closeFavorites } from './favorites.js';
import { closeSettings } from './settings.js';
import { trapFocus, manageFocusOnPanelOpen, restoreFocusOnPanelClose } from './a11y.js';
import { hideQiblaCompass, togglePrayerBar } from './features/prayer/prayer.js';

const ROOM_ID = 'hifzRoom';
const TOGGLE_ID = 'hifzRoomToggle';
const STAGE_ID = 'hifzRoomStage';
const CURTAIN_REVEAL_STORAGE_KEY = 'hifz_curtain_reveal';

interface FocusedSessionControls {
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

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  );
}

function getFocusedControls(room: HTMLElement): FocusedSessionControls | null {
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

function readPlan(room: HTMLElement): HifzPlan | null {
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

function setChoice(room: HTMLElement, selector: string, value: string): void {
  room.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    const selected = button.dataset['hifzRepeat'] === value || button.dataset['hifzReview'] === value;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('is-selected', selected);
  });
}

function updateSummary(room: HTMLElement): void {
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

function readSessionPlan(room: HTMLElement): HifzPlan | null {
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

function getDownloadButtons(room: HTMLElement): HTMLButtonElement[] {
  return [
    room.querySelector<HTMLButtonElement>('#hifzRoomDownload'),
    room.querySelector<HTMLButtonElement>('#hifzRoomFocusDownload'),
  ].filter((button): button is HTMLButtonElement => button !== null);
}

function setSessionDownloadStatus(room: HTMLElement, key: string, stateName = 'idle', ...args: string[]): void {
  room.querySelectorAll<HTMLElement>('#hifzRoomDownloadStatus, #hifzRoomFocusDownloadStatus').forEach((status) => {
    status.textContent = label(key, ...args);
    status.dataset['state'] = stateName;
  });
}

function setSessionReadyStatus(room: HTMLElement, plan: HifzPlan, alreadySaved = false): void {
  const primary = label(alreadySaved ? 'hifz_room_download_cached' : 'hifz_room_download_ready');
  const detail = label('hifz_room_download_ready_detail', getSurahName(plan.surah), String(plan.from), String(plan.to));
  setSessionDownloadStatus(room, `${primary} ${detail}`, 'ready');
}

function setSessionDownloadBusy(room: HTMLElement, busy: boolean): void {
  getDownloadButtons(room).forEach((button) => {
    button.disabled = busy;
    button.textContent = label(busy ? 'hifz_room_download_working' : 'hifz_room_download');
  });
}

async function resolveSessionAudioUrls(plan: HifzPlan): Promise<string[]> {
  const expectedCount = plan.to - plan.from + 1;
  if (
    state.currentSurah === plan.surah &&
    state.currentReciter === plan.reciter &&
    state.ayahsAudios.length >= plan.to
  ) {
    const currentUrls = state.ayahsAudios.slice(plan.from - 1, plan.to).filter((url): url is string => Boolean(url));
    if (currentUrls.length === expectedCount) {
      return currentUrls;
    }
  }
  const allUrls = await loadAudioUrlsForSession(plan.surah, plan.reciter, getAyahCount(plan.surah));
  const rangeUrls = allUrls.slice(plan.from - 1, plan.to).filter((url): url is string => Boolean(url));
  if (rangeUrls.length !== expectedCount) {
    throw new Error('Session audio URLs are unavailable');
  }
  return rangeUrls;
}

async function refreshSessionDownloadStatus(room: HTMLElement, plan = readSessionPlan(room)): Promise<void> {
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

async function hydrateDownloadedSessionAudio(plan: HifzPlan): Promise<void> {
  const record = getSavedSessionDownload(plan);
  if (!record || !state.surahData || state.currentSurah !== plan.surah || !(await isSurahCached(record.urls))) {
    return;
  }
  const hydrated = Array.from({ length: state.surahData.ayahs.length }, (_, index) => state.ayahsAudios[index] || '');
  record.urls.forEach((url, index) => {
    hydrated[plan.from - 1 + index] = url;
  });
  state.ayahsAudios = hydrated;
}

async function downloadSessionAudio(room: HTMLElement): Promise<void> {
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

function updateFocusedSession(room: HTMLElement, plan: HifzPlan): void {
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

function applyReaderAyahDisplay(room: HTMLElement): void {
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

function applySessionAudioPreferences(plan: HifzPlan): void {
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

function enterFocusedSession(room: HTMLElement, plan: HifzPlan): void {
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

function leaveFocusedSession(room: HTMLElement, restoreSetup = true): void {
  const focused = getFocusedControls(room);
  room.classList.remove('hifz-room-focused', 'hifz-room-text-hidden', 'hifz-room-show-range');
  document.body.classList.remove('hifz-room-focused-active', 'hifz-room-tools-hidden');
  room.setAttribute('aria-hidden', 'false');
  room.removeAttribute('inert');
  focused?.stage.setAttribute('aria-hidden', 'true');
  if (restoreSetup) {
    const plan = readSessionPlan(room);
    if (plan) {
      savePlan(plan);
      refreshForm(room, plan);
    }
  }
}

function showFocusedControls(room: HTMLElement): void {
  if (!room.classList.contains('hifz-room-focused')) {
    return;
  }
  document.body.classList.remove('hifz-room-tools-hidden');
  room.setAttribute('aria-hidden', 'false');
  room.removeAttribute('inert');
}

function restartFocusedPortion(room: HTMLElement): void {
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

async function updateFocusedReciter(room: HTMLElement): Promise<void> {
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

function updateFocusedSpeed(room: HTMLElement): void {
  const plan = readSessionPlan(room);
  if (!plan) {
    return;
  }
  applySessionAudioPreferences(plan);
  savePlan(plan);
  updateFocusedSession(room, plan);
}

function refreshForm(room: HTMLElement, plan = getDefaultPlan()): void {
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

function renderRoomText(room: HTMLElement): void {
  room.querySelectorAll<HTMLElement>('[data-hifz-key]').forEach((element) => {
    const key = element.dataset['hifzKey'];
    if (key) {
      element.textContent = label(key);
    }
  });
  room.querySelectorAll<HTMLElement>('[data-hifz-aria-key]').forEach((element) => {
    const key = element.dataset['hifzAriaKey'];
    if (key) {
      element.setAttribute('aria-label', label(key));
    }
  });
  room.setAttribute('aria-label', label('hifz_room'));
  const surahSearch = room.querySelector<HTMLInputElement>('#hifzRoomSurahSearch');
  if (surahSearch) {
    surahSearch.placeholder = label('hifz_room_surah_search_placeholder');
  }
}

function updateDirection(room: HTMLElement, toggle: HTMLButtonElement): void {
  const isRtl = document.documentElement.dir !== 'ltr';
  room.dir = isRtl ? 'rtl' : 'ltr';
  room.classList.toggle('hifz-room--rtl', isRtl);
  toggle.classList.toggle('hifz-room-toggle--rtl', isRtl);
}

export function isHifzRoomOpen(): boolean {
  return document.getElementById(ROOM_ID)?.classList.contains('is-open') ?? false;
}

/** Cleanup for the focus trap installed while the Hifz Room is open. */
let _hifzTrapCleanup: (() => void) | null = null;

export function closeHifzRoom(returnFocus = false): void {
  const room = document.getElementById(ROOM_ID);
  const toggle = document.getElementById(TOGGLE_ID) as HTMLButtonElement | null;
  if (!room) {
    return;
  }
  _hifzTrapCleanup?.();
  _hifzTrapCleanup = null;
  if (returnFocus) {
    restoreFocusOnPanelClose(toggle, room);
  }
  leaveFocusedSession(room, false);
  room.classList.remove('is-open', 'is-dragging');
  room.style.removeProperty('transform');
  room.setAttribute('aria-hidden', 'true');
  room.setAttribute('inert', '');
  document.body.classList.remove('hifz-room-active');
  toggle?.setAttribute('aria-expanded', 'false');
  if (returnFocus) {
    toggle?.focus();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readHifzCurtainReveal(defaultValue: number): number {
  const parsed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hifz-curtain-reveal'));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getHifzCurtainWidth(room: HTMLElement): number {
  const renderedWidth = room.getBoundingClientRect().width;
  return renderedWidth > 0 ? renderedWidth : Math.min(360, Math.round(window.innerWidth * 0.88));
}

function getHifzCurtainRevealLimit(room: HTMLElement): number {
  return Math.min(getHifzCurtainWidth(room), Math.max(220, Math.round(window.innerWidth * 0.45)));
}

function applyHifzCurtainReveal(room: HTMLElement, reveal: number, persist = true): void {
  const nextReveal = Math.round(clamp(reveal, 0, getHifzCurtainRevealLimit(room)));
  document.documentElement.style.setProperty('--hifz-curtain-reveal', `${nextReveal}px`);
  if (persist) {
    storage.set(CURTAIN_REVEAL_STORAGE_KEY, nextReveal);
  }
}

function syncHifzCurtainReveal(room: HTMLElement): void {
  const savedReveal = storage.get<number>(CURTAIN_REVEAL_STORAGE_KEY);
  applyHifzCurtainReveal(room, typeof savedReveal === 'number' ? savedReveal : getHifzCurtainWidth(room), false);
}

/**
 * Close side panels and overlays that would otherwise cover the Hifz Room.
 * Each feature keeps its own cleanup in its exported close helper.
 */
function closeCompetingSideSurfaces(): void {
  closeTafsir();
  closeAdhkarPanel();
  closeFavorites();
  closeSettings();
  hideQiblaCompass();
  if (document.body.classList.contains('prayer-curtain-active')) {
    togglePrayerBar();
  }
}

export function openHifzRoom(restoreReveal = true): void {
  const room = document.getElementById(ROOM_ID);
  const closeButton = document.getElementById('hifzRoomClose') as HTMLButtonElement | null;
  const toggle = document.getElementById(TOGGLE_ID) as HTMLButtonElement | null;
  if (!room) {
    return;
  }
  closeCompetingSideSurfaces();
  if (restoreReveal) {
    syncHifzCurtainReveal(room);
  }
  refreshForm(room);
  room.classList.add('is-open');
  room.style.removeProperty('transform');
  room.setAttribute('aria-hidden', 'false');
  room.removeAttribute('inert');
  document.body.classList.add('hifz-room-active');
  toggle?.setAttribute('aria-expanded', 'true');
  // Confine Tab + TV-remote focus inside the room (same pattern as panels).
  _hifzTrapCleanup?.();
  _hifzTrapCleanup = trapFocus(room);
  manageFocusOnPanelOpen(room, toggle ?? undefined);
  window.setTimeout(() => closeButton?.focus(), 0);
}

function applyExistingRepeatRange(plan: HifzPlan): void {
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

function activateCurrentHifzTools(plan: HifzPlan): void {
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

async function startHifzSession(room: HTMLElement): Promise<void> {
  const controls = getControls(room);
  const plan = readSessionPlan(room);
  if (!controls || !plan) {
    return;
  }
  savePlan(plan);
  controls.start.disabled = true;
  controls.status.textContent = label('hifz_room_loading');
  try {
    await loadSurah(plan.surah, { startAyah: plan.from });
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

function attachCurtainDrag(room: HTMLElement, handle: HTMLButtonElement): void {
  let pointerId: number | null = null;
  let startX = 0;
  let startReveal = 0;
  let dragged = false;
  let suppressClick = false;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') {
      return;
    }
    event.preventDefault();
    pointerId = event.pointerId;
    startX = event.clientX;
    startReveal = isHifzRoomOpen() ? readHifzCurtainReveal(getHifzCurtainWidth(room)) : 0;
    dragged = false;
    handle.setPointerCapture(event.pointerId);
    room.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    const distance = event.clientX - startX;
    if (Math.abs(distance) > 5) {
      dragged = true;
    }
    if (dragged && !isHifzRoomOpen()) {
      applyHifzCurtainReveal(room, 0, false);
      openHifzRoom(false);
    }
    applyHifzCurtainReveal(room, startReveal + distance, false);
  });
  const finishDrag = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    handle.releasePointerCapture?.(event.pointerId);
    pointerId = null;
    room.classList.remove('is-dragging');
    if (!dragged) {
      return;
    }
    if (event.type === 'pointercancel') {
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 100);
      return;
    }
    suppressClick = true;
    const reveal = readHifzCurtainReveal(getHifzCurtainWidth(room));
    if (reveal < 48) {
      storage.remove(CURTAIN_REVEAL_STORAGE_KEY);
      document.documentElement.style.removeProperty('--hifz-curtain-reveal');
      closeHifzRoom(false);
      return;
    }
    applyHifzCurtainReveal(room, reveal);
  };
  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);
  handle.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (isHifzRoomOpen()) {
      closeHifzRoom(true);
    } else {
      openHifzRoom();
    }
  });
}

/** Inject and initialize the web-only Hifz Room. Safe to call more than once. */
export function initHifzRoom(): void {
  if (document.getElementById(ROOM_ID)) {
    return;
  }
  const room = document.createElement('aside');
  room.id = ROOM_ID;
  room.className = 'hifz-room hifz-curtain hifz-room--rtl';
  room.dir = 'rtl';
  room.setAttribute('aria-hidden', 'true');
  room.setAttribute('inert', '');
  room.innerHTML = `
    <div class="hifz-room-scene" aria-hidden="true"></div>
    <section class="hifz-room-panel" aria-labelledby="hifzRoomTitle">
      <header class="hifz-room-header"><div><p class="hifz-room-eyebrow" data-hifz-key="hifz_room_eyebrow"></p><h2 id="hifzRoomTitle" data-hifz-key="hifz_room"></h2></div><button class="hifz-room-close" id="hifzRoomClose" type="button" data-hifz-key="close"></button></header>
      <div class="hifz-room-setup-only">
        <p class="hifz-room-lede" data-hifz-key="hifz_room_tagline"></p>
        <ol class="hifz-room-steps" data-hifz-aria-key="hifz_room_steps_label"><li data-hifz-key="hifz_room_step_portion"></li><li data-hifz-key="hifz_room_step_repeat"></li><li data-hifz-key="hifz_room_step_start"></li></ol>
        <section class="hifz-room-session"><label class="hifz-room-field hifz-room-field-full"><span data-hifz-key="hifz_room_surah"></span><input id="hifzRoomSurahSearch" class="hifz-room-surah-search" type="search" list="hifzRoomSurahOptions" autocomplete="off" spellcheck="false"><datalist id="hifzRoomSurahOptions"></datalist><select id="hifzRoomSurah" class="hifz-room-surah-native"></select></label><div class="hifz-room-range"><label class="hifz-room-field"><span data-hifz-key="hifz_room_from_ayah"></span><select id="hifzRoomFrom"></select></label><label class="hifz-room-field"><span data-hifz-key="hifz_room_to_ayah"></span><select id="hifzRoomTo"></select></label></div></section>
        <section class="hifz-room-repeat" aria-labelledby="hifzRoomRepeatTitle"><p id="hifzRoomRepeatTitle" class="hifz-room-card-label" data-hifz-key="hifz_room_repeat"></p><div class="hifz-room-repeat-options" role="group"><button type="button" data-hifz-repeat="3">3×</button><label class="hifz-room-custom-repeat"><span data-hifz-key="hifz_room_custom_repeat"></span><input id="hifzRoomCustomRepeat" type="number" min="1" max="100" step="1" inputmode="numeric"></label><button type="button" data-hifz-repeat="15">15×</button></div></section>
        <p class="hifz-room-summary" id="hifzRoomSummary"></p><button class="hifz-room-start" id="hifzRoomStart" type="button" data-hifz-key="hifz_room_start"></button><button class="hifz-room-download" id="hifzRoomDownload" type="button" data-hifz-key="hifz_room_download"></button><p class="hifz-room-download-status" id="hifzRoomDownloadStatus" aria-live="polite"></p><button class="hifz-room-return" id="hifzRoomReturn" type="button" data-hifz-key="hifz_room_return_reader"></button><p class="hifz-room-status" id="hifzRoomStatus" aria-live="polite"></p>
        <section class="hifz-room-review" aria-labelledby="hifzRoomReviewTitle"><span class="hifz-room-review-mark" aria-hidden="true"></span><div><p id="hifzRoomReviewTitle" data-hifz-key="hifz_room_review"></p><div class="hifz-room-choice-row hifz-room-review-choices" role="group"><button type="button" data-hifz-review="today" data-hifz-key="hifz_room_review_today"></button><button type="button" data-hifz-review="tomorrow" data-hifz-key="hifz_room_review_tomorrow"></button><button type="button" data-hifz-review="later" data-hifz-key="hifz_room_review_later"></button></div><label class="hifz-room-review-time"><span data-hifz-key="hifz_room_review_custom"></span><input id="hifzRoomReviewAt" type="datetime-local"></label></div></section>
      </div>
      <section class="hifz-room-focus-controls" aria-labelledby="hifzRoomFocusTitle">
        <p id="hifzRoomFocusTitle" class="hifz-room-card-label" data-hifz-key="hifz_room_session_title"></p>
        <div class="hifz-room-audio-grid"><label class="hifz-room-field"><span data-hifz-key="hifz_room_reciter"></span><select id="hifzRoomReciter"></select></label><label class="hifz-room-field"><span data-hifz-key="hifz_room_speed"></span><select id="hifzRoomSpeed"></select></label></div>
        <p id="hifzRoomRepeatProgress" class="hifz-room-repeat-progress" aria-live="polite"></p>
        <div class="hifz-room-focus-actions"><button id="hifzRoomPlay" type="button"></button><button id="hifzRoomRestart" type="button"></button></div>
        <div class="hifz-room-focus-actions hifz-room-focus-actions-secondary"><button id="hifzRoomHideText" type="button"></button><button id="hifzRoomToggleRange" type="button"></button></div>
        <button class="hifz-room-download" id="hifzRoomFocusDownload" type="button" data-hifz-key="hifz_room_download"></button><p class="hifz-room-download-status" id="hifzRoomFocusDownloadStatus" aria-live="polite"></p>
        <button class="hifz-room-return" id="hifzRoomEnd" type="button"></button>
      </section>
    </section>`;
  const toggle = document.createElement('button');
  const backdrop = document.createElement('div');
  backdrop.id = 'hifzRoomBackdrop';
  backdrop.className = 'hifz-room-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  const stage = document.createElement('section');
  stage.id = STAGE_ID;
  stage.className = 'hifz-room-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML =
    '<p id="hifzRoomStageMeta" class="hifz-room-stage-meta"></p><p id="hifzRoomStageText" class="hifz-room-stage-text" aria-live="polite"></p>';
  toggle.id = TOGGLE_ID;
  toggle.className = 'hifz-room-toggle hifz-curtain-handle hifz-room-toggle--rtl prayer-bar reader-side-tool';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', ROOM_ID);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('title', label('hifz_room'));
  toggle.setAttribute('aria-label', label('hifz_room'));
  toggle.innerHTML =
    '<svg class="icon reader-side-tool-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7c0-1.7-3.1-3-7-3V18c3.9 0 7 1.3 7 3 0-1.7 3.1-3 7-3V4c-3.9 0-7 1.3-7 3z"/><path d="M12 7v14"/></svg>' +
    '<span data-hifz-toggle-label></span>';
  document.body.append(backdrop, stage, room);
  const sideTools = document.getElementById('readerSideTools');
  (sideTools || document.body).append(toggle);
  renderRoomText(room);
  const toggleLabel = toggle.querySelector<HTMLElement>('[data-hifz-toggle-label]');
  if (toggleLabel) {
    toggleLabel.textContent = label('hifz_room');
  }
  updateDirection(room, toggle);
  refreshForm(room);
  const closeButton = room.querySelector<HTMLButtonElement>('#hifzRoomClose');
  closeButton?.setAttribute('aria-label', `${label('close')} ${label('hifz_room')}`);
  closeButton?.addEventListener('click', () => closeHifzRoom(true));
  room.querySelector<HTMLButtonElement>('#hifzRoomReturn')?.addEventListener('click', () => closeHifzRoom(false));
  getControls(room)?.start.addEventListener('click', () => void startHifzSession(room));
  getControls(room)?.download.addEventListener('click', () => void downloadSessionAudio(room));
  const focused = getFocusedControls(room);
  if (focused) {
    const refreshFocused = () => {
      const plan = readSessionPlan(room);
      if (plan && room.classList.contains('hifz-room-focused')) {
        updateFocusedSession(room, plan);
      }
    };
    focused.play.addEventListener('click', () => {
      togglePlayPause();
      window.setTimeout(refreshFocused, 0);
    });
    focused.restart.addEventListener('click', () => restartFocusedPortion(room));
    focused.hideText.addEventListener('click', () => {
      room.classList.toggle('hifz-room-text-hidden');
      refreshFocused();
    });
    focused.toggleRange.addEventListener('click', () => {
      room.classList.toggle('hifz-room-show-range');
      refreshFocused();
    });
    focused.end.addEventListener('click', () => leaveFocusedSession(room));
    focused.download.addEventListener('click', () => void downloadSessionAudio(room));
    focused.reciter.addEventListener('change', () => void updateFocusedReciter(room));
    focused.speed.addEventListener('change', () => updateFocusedSpeed(room));
    const audio = document.getElementById('audioPlayer') as HTMLAudioElement | null;
    audio?.addEventListener('play', () => window.setTimeout(refreshFocused, 0));
    audio?.addEventListener('pause', () => window.setTimeout(refreshFocused, 0));
    audio?.addEventListener('ended', () => window.setTimeout(refreshFocused, 0));
  }
  room.querySelector<HTMLSelectElement>('#hifzRoomSurah')?.addEventListener('change', () => {
    const plan = readPlan(room);
    const controls = getControls(room);
    if (!plan || !controls) {
      return;
    }
    const count = getAyahCount(plan.surah);
    fillAyahOptions(controls.from, count, Math.min(plan.from, count));
    fillAyahOptions(controls.to, count, Math.min(Math.max(plan.from, plan.to), count));
    syncSurahSearch(room, plan.surah);
    updateSummary(room);
    void refreshSessionDownloadStatus(room);
  });
  room
    .querySelector<HTMLInputElement>('#hifzRoomSurahSearch')
    ?.addEventListener('input', () => selectSurahFromSearch(room));
  room
    .querySelector<HTMLInputElement>('#hifzRoomSurahSearch')
    ?.addEventListener('change', () => selectSurahFromSearch(room));
  room.querySelectorAll<HTMLSelectElement>('#hifzRoomFrom, #hifzRoomTo').forEach((select) =>
    select.addEventListener('change', () => {
      updateSummary(room);
      void refreshSessionDownloadStatus(room);
    }),
  );
  room.querySelectorAll<HTMLButtonElement>('[data-hifz-repeat]').forEach((button) =>
    button.addEventListener('click', () => {
      const times = normalizeRepeatCount(parseInt(button.dataset['hifzRepeat'] || '5', 10));
      const controls = getControls(room);
      if (controls) {
        controls.repeat.value = String(times);
      }
      setChoice(room, '[data-hifz-repeat]', String(times));
      updateSummary(room);
    }),
  );
  room.querySelector<HTMLInputElement>('#hifzRoomCustomRepeat')?.addEventListener('change', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const times = normalizeRepeatCount(parseInt(toLatinDigits(input.value), 10));
    input.value = String(times);
    setChoice(room, '[data-hifz-repeat]', String(times));
    updateSummary(room);
  });
  room.querySelectorAll<HTMLButtonElement>('[data-hifz-review]').forEach((button) =>
    button.addEventListener('click', () => {
      setChoice(room, '[data-hifz-review]', button.dataset['hifzReview'] || 'today');
      const controls = getControls(room);
      if (controls) {
        controls.reviewAt.value = '';
      }
      const plan = readPlan(room);
      if (plan) {
        savePlan(plan);
      }
    }),
  );
  room.querySelector<HTMLInputElement>('#hifzRoomReviewAt')?.addEventListener('change', () => {
    const controls = getControls(room);
    if (!controls) {
      return;
    }
    setChoice(room, '[data-hifz-review]', controls.reviewAt.value ? 'custom' : 'today');
    const plan = readPlan(room);
    if (plan) {
      savePlan(plan);
    }
  });
  syncHifzCurtainReveal(room);
  attachCurtainDrag(room, toggle);
  window.addEventListener('resize', () => syncHifzCurtainReveal(room), { passive: true });
  document.addEventListener('pointermove', () => showFocusedControls(room), { passive: true });
  document.addEventListener('pointerdown', () => showFocusedControls(room), { passive: true });
  document.addEventListener('focusin', () => showFocusedControls(room));
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && isHifzRoomOpen()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeHifzRoom(true);
        return;
      }
      showFocusedControls(room);
      if (
        event.key.toLowerCase() === 'h' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (isHifzRoomOpen()) {
          closeHifzRoom(true);
        } else {
          openHifzRoom();
        }
      }
    },
    true,
  );
  window.addEventListener('app:langchange', () => {
    const plan = readSessionPlan(room) || getDefaultPlan();
    renderRoomText(room);
    if (toggleLabel) {
      toggleLabel.textContent = label('hifz_room');
    }
    toggle.setAttribute('title', label('hifz_room'));
    toggle.setAttribute('aria-label', label('hifz_room'));
    closeButton?.setAttribute('aria-label', `${label('close')} ${label('hifz_room')}`);
    updateDirection(room, toggle);
    refreshForm(room, plan);
    if (room.classList.contains('hifz-room-focused')) {
      updateFocusedSession(room, plan);
    }
  });
}
