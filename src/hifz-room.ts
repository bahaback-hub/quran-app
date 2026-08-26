/**
 * Hifz Room — web-only side space for the approved Rawdah-inspired design.
 * It stores the plan locally and reuses current player controls only after an
 * explicit user action, without changing the reader layout or Android.
 */

import { __ } from './i18n.js';
import { playCurrentAyah, togglePlayPause } from './audio.js';
import { cacheSurahAudio, isSurahCached } from './audio-cache.js';
import { getReciterDisplayName, RECITERS } from './reciters.js';
import { highlightCurrentAyah, loadAudioUrlsForSession, loadSurah } from './surah-loader.js';
import { state } from './state.js';
import { storage } from './storage.js';

const ROOM_ID = 'hifzRoom';
const TOGGLE_ID = 'hifzRoomToggle';
const STAGE_ID = 'hifzRoomStage';
const PLAN_STORAGE_KEY = 'hifz_plan_v1';
const CURTAIN_REVEAL_STORAGE_KEY = 'hifz_curtain_reveal';
const DOWNLOAD_STORAGE_KEY = 'hifz_session_downloads_v1';
const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5];
const FOCUSED_CONTROLS_AUTO_HIDE_MS = 3_000;

let focusedControlsHideTimer: number | null = null;

type ReviewChoice = 'today' | 'tomorrow' | 'later' | 'custom';

interface HifzPlan {
  version: 1;
  surah: number;
  from: number;
  to: number;
  times: number;
  review: ReviewChoice;
  reviewAt?: string;
  reciter: string;
  speed: number;
  updatedAt: number;
}

interface HifzRoomControls {
  surah: HTMLSelectElement;
  surahSearch: HTMLInputElement;
  from: HTMLSelectElement;
  to: HTMLSelectElement;
  repeat: HTMLInputElement;
  reviewAt: HTMLInputElement;
  summary: HTMLElement;
  status: HTMLElement;
  start: HTMLButtonElement;
  download: HTMLButtonElement;
  downloadStatus: HTMLElement;
}

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

interface SessionDownloadRecord {
  urls: string[];
  downloadedAt: number;
}

function label(key: string, ...args: string[]): string {
  return __(key, ...args);
}

function isNativeContainer(): boolean {
  return (
    document.documentElement.classList.contains('capacitor-native') ||
    document.body.classList.contains('capacitor-native')
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  );
}

function getAyahCount(surah: number): number {
  if (state.currentSurah === surah && state.surahData?.ayahs.length) {
    return state.surahData.ayahs.length;
  }
  return state.surahList.find((item) => item.number === surah)?.numberOfAyahs || 1;
}

function getCurrentAyah(): number {
  return state.surahData?.ayahs[state.currentAyahIndex]?.numberInSurah || Math.max(1, state.currentAyahIndex + 1);
}

function getSurahName(surah: number): string {
  const item = state.surahList.find((entry) => entry.number === surah);
  const isArabicInterface = document.documentElement.lang === 'ar' || !document.documentElement.lang;
  const storedName = isArabicInterface ? item?.name : item?.englishName || item?.name;
  if (storedName) {
    return storedName;
  }
  if (state.currentSurah === surah && state.surahData?.name) {
    return state.surahData.name;
  }
  const mainOption = (document.getElementById('surahSelect') as HTMLSelectElement | null)?.querySelector(
    `option[value="${surah}"]`,
  );
  return mainOption?.textContent?.replace(/^\d+\.\s*/, '') || String(surah);
}

function normalizeRepeatCount(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(1, Math.trunc(value))) : 5;
}

function normalizeReviewAt(value?: string): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value : undefined;
}

function normalizePlan(
  candidate: Omit<HifzPlan, 'updatedAt' | 'reciter' | 'speed'> &
    Partial<Pick<HifzPlan, 'updatedAt' | 'reciter' | 'speed'>>,
): HifzPlan {
  const surah = Math.min(Math.max(1, candidate.surah), 114);
  const count = getAyahCount(surah);
  const from = Math.min(Math.max(1, candidate.from), count);
  const to = Math.min(Math.max(from, candidate.to), count);
  const reviewAt = normalizeReviewAt(candidate.reviewAt);
  return {
    version: 1,
    surah,
    from,
    to,
    times: normalizeRepeatCount(candidate.times),
    review: reviewAt
      ? 'custom'
      : candidate.review === 'tomorrow' || candidate.review === 'later'
        ? candidate.review
        : 'today',
    reviewAt,
    reciter: RECITERS.some((reciter) => reciter.id === candidate.reciter) ? candidate.reciter! : state.currentReciter,
    speed: PLAYBACK_SPEEDS.includes(candidate.speed || 1) ? candidate.speed || 1 : 1,
    updatedAt: candidate.updatedAt || Date.now(),
  };
}

function getDefaultPlan(): HifzPlan {
  const stored = storage.get<HifzPlan>(PLAN_STORAGE_KEY);
  if (
    stored?.version === 1 &&
    Number.isInteger(stored.surah) &&
    Number.isInteger(stored.from) &&
    Number.isInteger(stored.to)
  ) {
    return normalizePlan(stored);
  }
  const from = getCurrentAyah();
  const savedSpeed = parseFloat(storage.get<string>('playback_speed') || '1');
  return normalizePlan({
    version: 1,
    surah: state.currentSurah || 1,
    from,
    to: from + 4,
    times: 5,
    review: 'today',
    reciter: state.currentReciter,
    speed: PLAYBACK_SPEEDS.includes(savedSpeed) ? savedSpeed : 1,
  });
}

function savePlan(plan: HifzPlan): void {
  storage.set(PLAN_STORAGE_KEY, { ...plan, updatedAt: Date.now() });
}

function getControls(room: HTMLElement): HifzRoomControls | null {
  const surah = room.querySelector<HTMLSelectElement>('#hifzRoomSurah');
  const surahSearch = room.querySelector<HTMLInputElement>('#hifzRoomSurahSearch');
  const from = room.querySelector<HTMLSelectElement>('#hifzRoomFrom');
  const to = room.querySelector<HTMLSelectElement>('#hifzRoomTo');
  const repeat = room.querySelector<HTMLInputElement>('#hifzRoomCustomRepeat');
  const reviewAt = room.querySelector<HTMLInputElement>('#hifzRoomReviewAt');
  const summary = room.querySelector<HTMLElement>('#hifzRoomSummary');
  const status = room.querySelector<HTMLElement>('#hifzRoomStatus');
  const start = room.querySelector<HTMLButtonElement>('#hifzRoomStart');
  const download = room.querySelector<HTMLButtonElement>('#hifzRoomDownload');
  const downloadStatus = room.querySelector<HTMLElement>('#hifzRoomDownloadStatus');
  return surah &&
    surahSearch &&
    from &&
    to &&
    repeat &&
    reviewAt &&
    summary &&
    status &&
    start &&
    download &&
    downloadStatus
    ? { surah, surahSearch, from, to, repeat, reviewAt, summary, status, start, download, downloadStatus }
    : null;
}

interface SurahEntry {
  value: number;
  label: string;
}

function getSurahEntries(selected: number): SurahEntry[] {
  const entries = state.surahList.map((item) => ({ value: item.number, label: getSurahName(item.number) }));
  if (!entries.length) {
    const mainSelect = document.getElementById('surahSelect') as HTMLSelectElement | null;
    entries.push(
      ...(mainSelect
        ? Array.from(mainSelect.options)
            .map((option) => ({ value: parseInt(option.value, 10), label: option.textContent || option.value }))
            .filter((option) => Number.isInteger(option.value) && option.value > 0)
        : [{ value: selected, label: getSurahName(selected) }]),
    );
  }
  if (!entries.some((entry) => entry.value === selected)) {
    entries.push({ value: selected, label: getSurahName(selected) });
  }
  return entries;
}

function fillSurahOptions(select: HTMLSelectElement, selected: number): void {
  const entries = getSurahEntries(selected);
  select.replaceChildren(
    ...entries.map((entry) => {
      const option = document.createElement('option');
      option.value = String(entry.value);
      option.textContent = entry.label;
      return option;
    }),
  );
  select.value = String(selected);
}

function normalizeSurahSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLocaleLowerCase();
}

function syncSurahSearch(room: HTMLElement, selected: number): void {
  const controls = getControls(room);
  const list = room.querySelector<HTMLDataListElement>('#hifzRoomSurahOptions');
  if (!controls || !list) {
    return;
  }
  const entries = getSurahEntries(selected);
  list.replaceChildren(
    ...entries.map((entry) => {
      const option = document.createElement('option');
      option.value = entry.label;
      option.label = `${entry.value}. ${entry.label}`;
      return option;
    }),
  );
  controls.surahSearch.value = entries.find((entry) => entry.value === selected)?.label || getSurahName(selected);
}

function selectSurahFromSearch(room: HTMLElement): void {
  const controls = getControls(room);
  if (!controls) {
    return;
  }
  const query = normalizeSurahSearch(controls.surahSearch.value);
  if (!query) {
    return;
  }
  const matches = getSurahEntries(parseInt(controls.surah.value, 10)).filter((entry) => {
    const normalizedName = normalizeSurahSearch(entry.label);
    return normalizedName === query || normalizedName.startsWith(query) || String(entry.value) === query;
  });
  const exact = matches.find((entry) => normalizeSurahSearch(entry.label) === query || String(entry.value) === query);
  const selected = exact || (matches.length === 1 ? matches[0] : null);
  if (!selected || controls.surah.value === String(selected.value)) {
    return;
  }
  controls.surah.value = String(selected.value);
  controls.surah.dispatchEvent(new Event('change', { bubbles: true }));
}

function fillAyahOptions(select: HTMLSelectElement, count: number, selected: number): void {
  select.replaceChildren(
    ...Array.from({ length: count }, (_, index) => {
      const option = document.createElement('option');
      option.value = String(index + 1);
      option.textContent = String(index + 1);
      return option;
    }),
  );
  select.value = String(Math.min(Math.max(1, selected), count));
}

function fillReciterOptions(select: HTMLSelectElement, selected: string): void {
  select.replaceChildren(
    ...RECITERS.map((reciter) => {
      const option = document.createElement('option');
      option.value = reciter.id;
      option.textContent = getReciterDisplayName(reciter);
      return option;
    }),
  );
  select.value = RECITERS.some((reciter) => reciter.id === selected) ? selected : RECITERS[0]!.id;
}

function fillSpeedOptions(select: HTMLSelectElement, selected: number): void {
  select.replaceChildren(
    ...PLAYBACK_SPEEDS.map((speed) => {
      const option = document.createElement('option');
      option.value = String(speed);
      option.textContent = `${speed}×`;
      return option;
    }),
  );
  select.value = String(PLAYBACK_SPEEDS.includes(selected) ? selected : 1);
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
    times: parseInt(controls.repeat.value || repeat?.dataset['hifzRepeat'] || '5', 10),
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

function sessionDownloadKey(plan: HifzPlan): string {
  return `${plan.surah}:${plan.from}:${plan.to}:${plan.reciter}`;
}

function getSavedSessionDownload(plan: HifzPlan): SessionDownloadRecord | null {
  const records = storage.get<Record<string, SessionDownloadRecord>>(DOWNLOAD_STORAGE_KEY);
  const record = records?.[sessionDownloadKey(plan)];
  return record && Array.isArray(record.urls) && record.urls.length === plan.to - plan.from + 1 ? record : null;
}

function saveSessionDownload(plan: HifzPlan, urls: string[]): void {
  const records = storage.get<Record<string, SessionDownloadRecord>>(DOWNLOAD_STORAGE_KEY) || {};
  records[sessionDownloadKey(plan)] = { urls, downloadedAt: Date.now() };
  storage.set(DOWNLOAD_STORAGE_KEY, records);
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

function getPlanAyahs(plan: HifzPlan): { numberInSurah: number; text: string }[] {
  if (state.currentSurah !== plan.surah || !state.surahData) {
    return [];
  }
  return state.surahData.ayahs.filter((ayah) => ayah.numberInSurah >= plan.from && ayah.numberInSurah <= plan.to);
}

function currentPlanAyah(plan: HifzPlan): { numberInSurah: number; text: string } | null {
  const ayahs = getPlanAyahs(plan);
  if (!ayahs.length) {
    return null;
  }
  return ayahs.find((ayah) => ayah.numberInSurah === getCurrentAyah()) || ayahs[0]!;
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
  clearFocusedControlsHideTimer();
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

function clearFocusedControlsHideTimer(): void {
  if (focusedControlsHideTimer !== null) {
    window.clearTimeout(focusedControlsHideTimer);
    focusedControlsHideTimer = null;
  }
}

function hideFocusedControls(room: HTMLElement): void {
  if (!room.classList.contains('hifz-room-focused')) {
    return;
  }
  clearFocusedControlsHideTimer();
  document.body.classList.add('hifz-room-tools-hidden');
  room.setAttribute('aria-hidden', 'true');
  room.setAttribute('inert', '');
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur?.();
  }
}

function scheduleFocusedControlsHide(room: HTMLElement): void {
  clearFocusedControlsHideTimer();
  if (room.classList.contains('hifz-room-focused')) {
    focusedControlsHideTimer = window.setTimeout(() => hideFocusedControls(room), FOCUSED_CONTROLS_AUTO_HIDE_MS);
  }
}

function showFocusedControls(room: HTMLElement): void {
  if (!room.classList.contains('hifz-room-focused')) {
    return;
  }
  document.body.classList.remove('hifz-room-tools-hidden');
  room.setAttribute('aria-hidden', 'false');
  room.removeAttribute('inert');
  scheduleFocusedControlsHide(room);
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

export function closeHifzRoom(returnFocus = false): void {
  const room = document.getElementById(ROOM_ID);
  const toggle = document.getElementById(TOGGLE_ID) as HTMLButtonElement | null;
  if (!room) {
    return;
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

export function openHifzRoom(restoreReveal = true): void {
  const room = document.getElementById(ROOM_ID);
  const closeButton = document.getElementById('hifzRoomClose') as HTMLButtonElement | null;
  const toggle = document.getElementById(TOGGLE_ID) as HTMLButtonElement | null;
  if (!room) {
    return;
  }
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
  document.getElementById('player')?.classList.remove('collapsed');
  document.body.classList.add('player-expanded');
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
    const distance = startX - event.clientX;
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
  if (isNativeContainer() || document.getElementById(ROOM_ID)) {
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
        <section class="hifz-room-session"><label class="hifz-room-field hifz-room-field-full"><span data-hifz-key="hifz_room_surah"></span><input id="hifzRoomSurahSearch" class="hifz-room-surah-search" type="search" list="hifzRoomSurahOptions" autocomplete="off" spellcheck="false"><datalist id="hifzRoomSurahOptions"></datalist><select id="hifzRoomSurah" class="hifz-room-surah-native" tabindex="-1" aria-hidden="true"></select></label><div class="hifz-room-range"><label class="hifz-room-field"><span data-hifz-key="hifz_room_from_ayah"></span><select id="hifzRoomFrom"></select></label><label class="hifz-room-field"><span data-hifz-key="hifz_room_to_ayah"></span><select id="hifzRoomTo"></select></label></div></section>
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
  toggle.className = 'hifz-room-toggle hifz-curtain-handle hifz-room-toggle--rtl';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', ROOM_ID);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('title', label('hifz_room'));
  toggle.setAttribute('aria-label', label('hifz_room'));
  toggle.innerHTML = '<span data-hifz-toggle-label></span>';
  document.body.append(backdrop, stage, room, toggle);
  renderRoomText(room);
  const toggleLabel = toggle.querySelector<HTMLElement>('[data-hifz-toggle-label]');
  if (toggleLabel) {
    toggleLabel.textContent = label('hifz_room');
  }
  updateDirection(room, toggle);
  refreshForm(room);
  const closeButton = room.querySelector<HTMLButtonElement>('#hifzRoomClose');
  closeButton?.setAttribute('aria-label', `${label('close')} ${label('hifz_room')}`);
  closeButton?.addEventListener('click', () => {
    if (room.classList.contains('hifz-room-focused')) {
      hideFocusedControls(room);
      return;
    }
    closeHifzRoom(true);
  });
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
    const times = normalizeRepeatCount(parseInt(input.value, 10));
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
        if (room.classList.contains('hifz-room-focused')) {
          hideFocusedControls(room);
        } else {
          closeHifzRoom(true);
        }
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
          if (room.classList.contains('hifz-room-focused')) {
            hideFocusedControls(room);
          } else {
            closeHifzRoom(true);
          }
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
