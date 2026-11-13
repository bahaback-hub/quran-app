/**
 * Hifz Room — web-only side space for the approved Rawdah-inspired design.
 * It stores the plan locally and reuses current player controls only after an
 * explicit user action, without changing the reader layout or Android.
 */

import './css/hifz-room.css';
import { syncHifzCurtainReveal, attachCurtainDrag, initHifzCurtainHost } from './hifz-curtain.js';

import { fillAyahOptions, getControls, selectSurahFromSearch, syncSurahSearch } from './hifz-room-form.js';

import { toLatinDigits } from './i18n.js';
import { getAyahCount, getDefaultPlan, label, normalizeRepeatCount, savePlan } from './hifz-room-plan.js';
import {
  downloadSessionAudio,
  getFocusedControls,
  leaveFocusedSession,
  readPlan,
  readSessionPlan,
  refreshForm,
  refreshSessionDownloadStatus,
  restartFocusedPortion,
  setChoice,
  showFocusedControls,
  startHifzSession,
  updateFocusedReciter,
  updateFocusedSession,
  updateFocusedSpeed,
  updateSummary,
} from './hifz-room-session.js';
import { togglePlayPause } from './features/audio/audio.js';
import { closeTafsir } from './tafsir.js';
import { closeAdhkarPanel } from './adhkar.js';
import { closeFavorites } from './favorites.js';
import { closeSettings } from './settings.js';
import { trapFocus, manageFocusOnPanelOpen, restoreFocusOnPanelClose } from './a11y.js';
import { hideQiblaCompass, togglePrayerBar } from './features/prayer/prayer.js';
import { setTrustedHtml } from './safe-html.js';

const ROOM_ID = 'hifzRoom';
const TOGGLE_ID = 'hifzRoomToggle';
const STAGE_ID = 'hifzRoomStage';

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  );
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
  setTrustedHtml(
    room,
    `
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
    </section>`,
  );
  const toggle = document.createElement('button');
  const backdrop = document.createElement('div');
  backdrop.id = 'hifzRoomBackdrop';
  backdrop.className = 'hifz-room-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  const stage = document.createElement('section');
  stage.id = STAGE_ID;
  stage.className = 'hifz-room-stage';
  stage.setAttribute('aria-hidden', 'true');
  setTrustedHtml(
    stage,
    '<p id="hifzRoomStageMeta" class="hifz-room-stage-meta"></p><p id="hifzRoomStageText" class="hifz-room-stage-text" aria-live="polite"></p>',
  );
  toggle.id = TOGGLE_ID;
  toggle.className = 'hifz-room-toggle hifz-curtain-handle hifz-room-toggle--rtl prayer-bar reader-side-tool';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', ROOM_ID);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('title', label('hifz_room'));
  toggle.setAttribute('aria-label', label('hifz_room'));
  setTrustedHtml(
    toggle,
    '<svg class="icon reader-side-tool-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7c0-1.7-3.1-3-7-3V18c3.9 0 7 1.3 7 3 0-1.7 3.1-3 7-3V4c-3.9 0-7 1.3-7 3z"/><path d="M12 7v14"/></svg>' +
      '<span data-hifz-toggle-label></span>',
  );
  document.body.append(backdrop, stage, room);
  const sideTools = document.getElementById('readerSideTools');
  const toggleSlot = document.getElementById('hifzRoomToggleSlot');
  if (toggleSlot) {
    toggleSlot.replaceWith(toggle);
  } else {
    (sideTools || document.body).append(toggle);
  }
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

// Curtain engine actions wired after every definition (closures read state lazily).
initHifzCurtainHost({
  isHifzRoomOpen,
  openHifzRoom,
  closeHifzRoom,
});
