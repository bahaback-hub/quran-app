/**
 * Hifz Room — web-only side space for the approved Rawdah-inspired design.
 * Design contract: this module is injected only outside Capacitor, overlays
 * the existing reader without changing its layout, and reuses current player
 * controls only after an explicit user action.
 */

import { __ } from './i18n.js';

const BACKGROUND_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663901108942/aQJlASvxkRWbBYrT.png';
const ROOM_ID = 'hifzRoom';
const TOGGLE_ID = 'hifzRoomToggle';

function isNativeContainer(): boolean {
  return document.documentElement.classList.contains('capacitor-native') || document.body.classList.contains('capacitor-native');
}

function label(key: string): string {
  return __(key);
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
  const isRtl = document.documentElement.dir !== 'ltr';
  room.dir = isRtl ? 'rtl' : 'ltr';
  // The room always enters from the physical right edge, as approved for the
  // Rawdah composition. Language direction only changes its inner typography.
  room.classList.add('hifz-room--rtl');
  toggle.classList.add('hifz-room-toggle--rtl');
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
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

  room.classList.add('is-open');
  room.style.removeProperty('transform');
  room.setAttribute('aria-hidden', 'false');
  room.removeAttribute('inert');
  document.body.classList.add('hifz-room-active');
  toggle?.setAttribute('aria-expanded', 'true');
  window.setTimeout(() => closeButton?.focus(), 0);
}

function startCurrentHifzTools(room: HTMLElement): void {
  const hifdhButton = document.getElementById('hifdhBtn') as HTMLButtonElement | null;
  const repeatButton = document.getElementById('repeatBtn') as HTMLButtonElement | null;
  const player = document.getElementById('player');

  if (!hifdhButton?.classList.contains('active')) {
    hifdhButton?.click();
  }
  if (!repeatButton?.classList.contains('active')) {
    repeatButton?.click();
  }
  player?.classList.remove('collapsed');
  document.body.classList.add('player-expanded');

  const hint = room.querySelector<HTMLElement>('#hifzRoomSessionHint');
  if (hint) {
    hint.textContent = label('hifz_room_session_active');
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
    const width = room.getBoundingClientRect().width;
    const isRtl = room.classList.contains('hifz-room--rtl');
    const delta = event.clientX - startX;
    const offset = isRtl ? Math.max(0, width + delta) : Math.min(0, -width + delta);
    if (Math.abs(delta) > 5) {
      dragged = true;
    }
    room.style.transform = `translateX(${offset}px)`;
  });

  const finishDrag = (event: PointerEvent) => {
    if (startX === null || event.pointerType !== 'mouse') {
      return;
    }
    const isRtl = room.classList.contains('hifz-room--rtl');
    const delta = event.clientX - startX;
    const shouldOpen = isRtl ? delta < -64 : delta > 64;
    startX = null;
    room.classList.remove('is-dragging');
    room.style.removeProperty('transform');
    if (shouldOpen) {
      openHifzRoom();
    } else {
      closeHifzRoom(false);
    }
    window.setTimeout(() => {
      dragged = false;
    }, 0);
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
      <header class="hifz-room-header">
        <div>
          <p class="hifz-room-eyebrow" data-hifz-key="hifz_room_eyebrow"></p>
          <h2 id="hifzRoomTitle" data-hifz-key="hifz_room"></h2>
        </div>
        <button class="hifz-room-close" id="hifzRoomClose" type="button" data-hifz-key="close"></button>
      </header>
      <p class="hifz-room-lede" data-hifz-key="hifz_room_tagline"></p>
      <article class="hifz-room-card">
        <p class="hifz-room-card-label" data-hifz-key="hifz_room_today"></p>
        <p class="hifz-room-card-title" data-hifz-key="hifz_room_current_range"></p>
        <p class="hifz-room-card-meta" data-hifz-key="hifz_room_session_hint"></p>
        <button class="hifz-room-start" id="hifzRoomStart" type="button" data-hifz-key="hifz_room_start"></button>
      </article>
      <section class="hifz-room-review">
        <span class="hifz-room-review-mark" aria-hidden="true"></span>
        <div>
          <p data-hifz-key="hifz_room_review"></p>
          <strong id="hifzRoomSessionHint" data-hifz-key="hifz_room_review_empty"></strong>
        </div>
      </section>
      <p class="hifz-room-footnote" data-hifz-key="hifz_room_footnote"></p>
    </section>
  `;

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

  const closeButton = room.querySelector<HTMLButtonElement>('#hifzRoomClose');
  const startButton = room.querySelector<HTMLButtonElement>('#hifzRoomStart');
  closeButton?.setAttribute('aria-label', `${label('close')} ${label('hifz_room')}`);
  closeButton?.addEventListener('click', () => closeHifzRoom(true));
  startButton?.addEventListener('click', () => startCurrentHifzTools(room));
  attachMouseDrag(room, toggle);

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && isHifzRoomOpen()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeHifzRoom(true);
        return;
      }
      if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditableTarget(event.target)) {
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
    renderRoomText(room);
    if (toggleLabel) {
      toggleLabel.textContent = label('hifz_room');
    }
    closeButton?.setAttribute('aria-label', `${label('close')} ${label('hifz_room')}`);
    updateDirection(room, toggle);
  });
}
