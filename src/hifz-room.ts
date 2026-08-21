/**
 * Hifz Room — web-only side space for the approved Rawdah-inspired design.
 * It stores the plan locally and reuses current player controls only after an
 * explicit user action, without changing the reader layout or Android.
 */

import { __ } from './i18n.js';
import { loadSurah } from './surah-loader.js';
import { state } from './state.js';
import { storage } from './storage.js';

const BACKGROUND_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663901108942/aQJlASvxkRWbBYrT.png';
const ROOM_ID = 'hifzRoom';
const TOGGLE_ID = 'hifzRoomToggle';
const PLAN_STORAGE_KEY = 'hifz_plan_v1';
const REPEAT_COUNTS = [2, 3, 5, 10, 20];

type ReviewChoice = 'today' | 'tomorrow' | 'later';

interface HifzPlan {
  version: 1;
  surah: number;
  from: number;
  to: number;
  times: number;
  review: ReviewChoice;
  updatedAt: number;
}

interface HifzRoomControls {
  surah: HTMLSelectElement;
  from: HTMLSelectElement;
  to: HTMLSelectElement;
  summary: HTMLElement;
  status: HTMLElement;
  start: HTMLButtonElement;
}

function label(key: string, ...args: string[]): string {
  return __(key, ...args);
}

function isNativeContainer(): boolean {
  return document.documentElement.classList.contains('capacitor-native') || document.body.classList.contains('capacitor-native');
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
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
  const storedName = state.surahList.find((item) => item.number === surah)?.name;
  if (storedName) {
    return storedName;
  }
  if (state.currentSurah === surah && state.surahData?.name) {
    return state.surahData.name;
  }
  const mainOption = (document.getElementById('surahSelect') as HTMLSelectElement | null)?.querySelector(`option[value="${surah}"]`);
  return mainOption?.textContent?.replace(/^\d+\.\s*/, '') || String(surah);
}

function normalizePlan(candidate: Omit<HifzPlan, 'updatedAt'> & Partial<Pick<HifzPlan, 'updatedAt'>>): HifzPlan {
  const surah = Math.min(Math.max(1, candidate.surah), 114);
  const count = getAyahCount(surah);
  const from = Math.min(Math.max(1, candidate.from), count);
  const to = Math.min(Math.max(from, candidate.to), count);
  return {
    version: 1,
    surah,
    from,
    to,
    times: REPEAT_COUNTS.includes(candidate.times) ? candidate.times : 5,
    review: candidate.review === 'tomorrow' || candidate.review === 'later' ? candidate.review : 'today',
    updatedAt: candidate.updatedAt || Date.now(),
  };
}

function getDefaultPlan(): HifzPlan {
  const stored = storage.get<HifzPlan>(PLAN_STORAGE_KEY);
  if (stored?.version === 1 && Number.isInteger(stored.surah) && Number.isInteger(stored.from) && Number.isInteger(stored.to)) {
    return normalizePlan(stored);
  }
  const from = getCurrentAyah();
  return normalizePlan({ version: 1, surah: state.currentSurah || 1, from, to: from + 4, times: 5, review: 'today' });
}

function savePlan(plan: HifzPlan): void {
  storage.set(PLAN_STORAGE_KEY, { ...plan, updatedAt: Date.now() });
}

function getControls(room: HTMLElement): HifzRoomControls | null {
  const surah = room.querySelector<HTMLSelectElement>('#hifzRoomSurah');
  const from = room.querySelector<HTMLSelectElement>('#hifzRoomFrom');
  const to = room.querySelector<HTMLSelectElement>('#hifzRoomTo');
  const summary = room.querySelector<HTMLElement>('#hifzRoomSummary');
  const status = room.querySelector<HTMLElement>('#hifzRoomStatus');
  const start = room.querySelector<HTMLButtonElement>('#hifzRoomStart');
  return surah && from && to && summary && status && start ? { surah, from, to, summary, status, start } : null;
}

function fillSurahOptions(select: HTMLSelectElement, selected: number): void {
  const entries = state.surahList.map((item) => ({ value: item.number, label: item.name }));
  if (!entries.length) {
    const mainSelect = document.getElementById('surahSelect') as HTMLSelectElement | null;
    entries.push(...(mainSelect ? Array.from(mainSelect.options)
      .map((option) => ({ value: parseInt(option.value, 10), label: option.textContent || option.value }))
      .filter((option) => Number.isInteger(option.value) && option.value > 0) : [{ value: selected, label: getSurahName(selected) }]));
  }
  if (!entries.some((entry) => entry.value === selected)) {
    entries.push({ value: selected, label: getSurahName(selected) });
  }
  select.replaceChildren(...entries.map((entry) => {
    const option = document.createElement('option');
    option.value = String(entry.value);
    option.textContent = entry.label;
    return option;
  }));
  select.value = String(selected);
}

function fillAyahOptions(select: HTMLSelectElement, count: number, selected: number): void {
  select.replaceChildren(...Array.from({ length: count }, (_, index) => {
    const option = document.createElement('option');
    option.value = String(index + 1);
    option.textContent = String(index + 1);
    return option;
  }));
  select.value = String(Math.min(Math.max(1, selected), count));
}

function readPlan(room: HTMLElement): HifzPlan | null {
  const controls = getControls(room);
  if (!controls) {
    return null;
  }
  const repeat = room.querySelector<HTMLButtonElement>('[data-hifz-repeat][aria-pressed="true"]');
  const review = room.querySelector<HTMLButtonElement>('[data-hifz-review][aria-pressed="true"]');
  return normalizePlan({
    version: 1,
    surah: parseInt(controls.surah.value, 10),
    from: parseInt(controls.from.value, 10),
    to: parseInt(controls.to.value, 10),
    times: parseInt(repeat?.dataset['hifzRepeat'] || '5', 10),
    review: (review?.dataset['hifzReview'] as ReviewChoice | undefined) || 'today',
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
    controls.summary.textContent = label('hifz_room_summary', getSurahName(plan.surah), String(plan.from), String(plan.to), String(plan.times));
  }
}

function refreshForm(room: HTMLElement, plan = getDefaultPlan()): void {
  const controls = getControls(room);
  if (!controls) {
    return;
  }
  const normalized = normalizePlan(plan);
  fillSurahOptions(controls.surah, normalized.surah);
  fillAyahOptions(controls.from, getAyahCount(normalized.surah), normalized.from);
  fillAyahOptions(controls.to, getAyahCount(normalized.surah), normalized.to);
  setChoice(room, '[data-hifz-repeat]', String(normalized.times));
  setChoice(room, '[data-hifz-review]', normalized.review);
  controls.status.textContent = label('hifz_room_session_hint');
  updateSummary(room);
}

function renderRoomText(room: HTMLElement): void {
  room.querySelectorAll<HTMLElement>('[data-hifz-key]').forEach((element) => {
    const key = element.dataset['hifzKey'];
    if (key) {
      element.textContent = label(key);
    }
  });
  room.setAttribute('aria-label', label('hifz_room'));
}

function updateDirection(room: HTMLElement, toggle: HTMLButtonElement): void {
  room.dir = document.documentElement.dir !== 'ltr' ? 'rtl' : 'ltr';
  room.classList.add('hifz-room--rtl');
  toggle.classList.add('hifz-room-toggle--rtl');
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

export function openHifzRoom(): void {
  const room = document.getElementById(ROOM_ID);
  const closeButton = document.getElementById('hifzRoomClose') as HTMLButtonElement | null;
  const toggle = document.getElementById(TOGGLE_ID) as HTMLButtonElement | null;
  if (!room) {
    return;
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
  times.value = String(plan.times);
  times.dispatchEvent(new Event('change', { bubbles: true }));
}

function activateCurrentHifzTools(plan: HifzPlan): void {
  const hifdhButton = document.getElementById('hifdhBtn') as HTMLButtonElement | null;
  const repeatButton = document.getElementById('repeatBtn') as HTMLButtonElement | null;
  if (!hifdhButton?.classList.contains('active')) {
    hifdhButton?.click();
  }
  if (!repeatButton?.classList.contains('active')) {
    repeatButton?.click();
  }
  applyExistingRepeatRange(plan);
  document.getElementById('player')?.classList.remove('collapsed');
  document.body.classList.add('player-expanded');
}

async function startHifzSession(room: HTMLElement): Promise<void> {
  const controls = getControls(room);
  const plan = readPlan(room);
  if (!controls || !plan) {
    return;
  }
  savePlan(plan);
  controls.start.disabled = true;
  controls.status.textContent = label('hifz_room_loading');
  try {
    await loadSurah(plan.surah, { startAyah: plan.from });
    const mainSelect = document.getElementById('surahSelect') as HTMLSelectElement | null;
    if (mainSelect) {
      mainSelect.value = String(plan.surah);
    }
    activateCurrentHifzTools(plan);
    controls.status.textContent = label('hifz_room_session_active');
    room.classList.add('hifz-room-session-active');
  } catch {
    controls.status.textContent = label('hifz_room_load_failed');
  } finally {
    controls.start.disabled = false;
  }
}

function attachMouseDrag(room: HTMLElement, handle: HTMLButtonElement): void {
  let startX: number | null = null;
  let dragged = false;
  handle.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    startX = event.clientX;
    dragged = false;
    handle.setPointerCapture(event.pointerId);
    room.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove', (event) => {
    if (startX === null || event.pointerType !== 'mouse') {
      return;
    }
    const delta = event.clientX - startX;
    if (Math.abs(delta) > 5) {
      dragged = true;
    }
    room.style.transform = `translateX(${Math.max(0, room.getBoundingClientRect().width + delta)}px)`;
  });
  const finishDrag = (event: PointerEvent) => {
    if (startX === null || event.pointerType !== 'mouse') {
      return;
    }
    const shouldOpen = event.clientX - startX < -64;
    startX = null;
    room.classList.remove('is-dragging');
    room.style.removeProperty('transform');
    if (shouldOpen) {
      openHifzRoom();
    } else {
      closeHifzRoom(false);
    }
    window.setTimeout(() => { dragged = false; }, 0);
  };
  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);
  handle.addEventListener('click', () => {
    if (!dragged) {
      if (isHifzRoomOpen()) {
        closeHifzRoom(true);
      } else {
        openHifzRoom();
      }
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
  room.className = 'hifz-room hifz-room--rtl';
  room.dir = 'rtl';
  room.setAttribute('aria-hidden', 'true');
  room.setAttribute('inert', '');
  room.style.setProperty('--hifz-room-background', `url("${BACKGROUND_URL}")`);
  room.innerHTML = `
    <div class="hifz-room-scene" aria-hidden="true"></div>
    <section class="hifz-room-panel" aria-labelledby="hifzRoomTitle">
      <header class="hifz-room-header"><div><p class="hifz-room-eyebrow" data-hifz-key="hifz_room_eyebrow"></p><h2 id="hifzRoomTitle" data-hifz-key="hifz_room"></h2></div><button class="hifz-room-close" id="hifzRoomClose" type="button" data-hifz-key="close"></button></header>
      <p class="hifz-room-lede" data-hifz-key="hifz_room_tagline"></p>
      <ol class="hifz-room-steps" aria-label="خطوات جلسة الحفظ"><li data-hifz-key="hifz_room_step_portion"></li><li data-hifz-key="hifz_room_step_repeat"></li><li data-hifz-key="hifz_room_step_start"></li></ol>
      <section class="hifz-room-session" aria-labelledby="hifzRoomToday"><p id="hifzRoomToday" class="hifz-room-card-label" data-hifz-key="hifz_room_today"></p><label class="hifz-room-field hifz-room-field-full"><span data-hifz-key="hifz_room_surah"></span><select id="hifzRoomSurah"></select></label><div class="hifz-room-range"><label class="hifz-room-field"><span data-hifz-key="hifz_room_from_ayah"></span><select id="hifzRoomFrom"></select></label><label class="hifz-room-field"><span data-hifz-key="hifz_room_to_ayah"></span><select id="hifzRoomTo"></select></label></div></section>
      <section class="hifz-room-repeat" aria-labelledby="hifzRoomRepeatTitle"><p id="hifzRoomRepeatTitle" class="hifz-room-card-label" data-hifz-key="hifz_room_repeat"></p><div class="hifz-room-choice-row" role="group"><button type="button" data-hifz-repeat="3">3×</button><button type="button" data-hifz-repeat="5">5×</button><button type="button" data-hifz-repeat="10">10×</button></div></section>
      <p class="hifz-room-summary" id="hifzRoomSummary"></p><button class="hifz-room-start" id="hifzRoomStart" type="button" data-hifz-key="hifz_room_start"></button><button class="hifz-room-return" id="hifzRoomReturn" type="button" data-hifz-key="hifz_room_return_reader"></button><p class="hifz-room-status" id="hifzRoomStatus" aria-live="polite"></p>
      <section class="hifz-room-review" aria-labelledby="hifzRoomReviewTitle"><span class="hifz-room-review-mark" aria-hidden="true"></span><div><p id="hifzRoomReviewTitle" data-hifz-key="hifz_room_review"></p><div class="hifz-room-choice-row hifz-room-review-choices" role="group"><button type="button" data-hifz-review="today" data-hifz-key="hifz_room_review_today"></button><button type="button" data-hifz-review="tomorrow" data-hifz-key="hifz_room_review_tomorrow"></button><button type="button" data-hifz-review="later" data-hifz-key="hifz_room_review_later"></button></div></div></section>
      <p class="hifz-room-footnote" data-hifz-key="hifz_room_footnote"></p>
    </section>`;
  const toggle = document.createElement('button');
  const backdrop = document.createElement('div');
  backdrop.id = 'hifzRoomBackdrop';
  backdrop.className = 'hifz-room-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.style.setProperty('--hifz-room-background', `url("${BACKGROUND_URL}")`);
  toggle.id = TOGGLE_ID;
  toggle.className = 'hifz-room-toggle hifz-room-toggle--rtl';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', ROOM_ID);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('title', 'H');
  toggle.innerHTML = '<span aria-hidden="true">۞</span><span data-hifz-toggle-label></span>';
  document.body.append(backdrop, room, toggle);
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
  room.querySelector<HTMLSelectElement>('#hifzRoomSurah')?.addEventListener('change', () => {
    const plan = readPlan(room);
    const controls = getControls(room);
    if (!plan || !controls) {
      return;
    }
    const count = getAyahCount(plan.surah);
    fillAyahOptions(controls.from, count, Math.min(plan.from, count));
    fillAyahOptions(controls.to, count, Math.min(Math.max(plan.from, plan.to), count));
    updateSummary(room);
  });
  room.querySelectorAll<HTMLSelectElement>('#hifzRoomFrom, #hifzRoomTo').forEach((select) => select.addEventListener('change', () => updateSummary(room)));
  room.querySelectorAll<HTMLButtonElement>('[data-hifz-repeat]').forEach((button) => button.addEventListener('click', () => {
    setChoice(room, '[data-hifz-repeat]', button.dataset['hifzRepeat'] || '5');
    updateSummary(room);
  }));
  room.querySelectorAll<HTMLButtonElement>('[data-hifz-review]').forEach((button) => button.addEventListener('click', () => {
    setChoice(room, '[data-hifz-review]', button.dataset['hifzReview'] || 'today');
    const plan = readPlan(room);
    if (plan) {
      savePlan(plan);
    }
  }));
  attachMouseDrag(room, toggle);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isHifzRoomOpen()) {
      event.preventDefault(); event.stopImmediatePropagation(); closeHifzRoom(true); return;
    }
    if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditableTarget(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (isHifzRoomOpen()) {
        closeHifzRoom(true);
      } else {
        openHifzRoom();
      }
    }
  }, true);
  window.addEventListener('app:langchange', () => {
    const plan = readPlan(room) || getDefaultPlan();
    renderRoomText(room);
    if (toggleLabel) {
      toggleLabel.textContent = label('hifz_room');
    }
    closeButton?.setAttribute('aria-label', `${label('close')} ${label('hifz_room')}`);
    updateDirection(room, toggle);
    refreshForm(room, plan);
  });
}
