/**
 * Hifz Room curtain — reveal/overlay dragging on the room's edge handle.
 * Extracted from hifz-room.ts. The engine injects its open/close/open-state
 * actions via initHifzCurtainHost because this module must not import the
 * engine (circular import).
 */
import { storage } from './storage.js';

const CURTAIN_REVEAL_STORAGE_KEY = 'hifz_curtain_reveal';

/** Engine actions injected by hifz-room.ts at module scope (importing them back would cycle). */
let _isHifzRoomOpen: () => boolean = () => false;
let _openHifzRoom: (restoreReveal?: boolean) => void = () => {};
let _closeHifzRoom: (returnFocus: boolean) => void = () => {};

export function initHifzCurtainHost(host: {
  isHifzRoomOpen: () => boolean;
  openHifzRoom: (restoreReveal?: boolean) => void;
  closeHifzRoom: (returnFocus: boolean) => void;
}): void {
  _isHifzRoomOpen = host.isHifzRoomOpen;
  _openHifzRoom = host.openHifzRoom;
  _closeHifzRoom = host.closeHifzRoom;
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

/**
 * N-04: the LTR room slides out from the left edge (dragging the handle right
 * widens the reveal), while the RTL room is anchored to the right edge (its
 * handle sits on the room's left edge and the natural "open" gesture drags it
 * left, toward the reader). updateDirection() keeps room.dir authoritative;
 * fall back to the document direction for rooms that never had it set.
 */
function isCurtainRtl(room: HTMLElement): boolean {
  if (room.dir === 'rtl' || room.dir === 'ltr') {
    return room.dir === 'rtl';
  }
  return document.documentElement.dir === 'rtl';
}

function applyHifzCurtainReveal(room: HTMLElement, reveal: number, persist = true): void {
  const nextReveal = Math.round(clamp(reveal, 0, getHifzCurtainRevealLimit(room)));
  document.documentElement.style.setProperty('--hifz-curtain-reveal', `${nextReveal}px`);
  if (persist) {
    storage.set(CURTAIN_REVEAL_STORAGE_KEY, nextReveal);
  }
}

export function syncHifzCurtainReveal(room: HTMLElement): void {
  const savedReveal = storage.get<number>(CURTAIN_REVEAL_STORAGE_KEY);
  applyHifzCurtainReveal(room, typeof savedReveal === 'number' ? savedReveal : getHifzCurtainWidth(room), false);
}

export function attachCurtainDrag(room: HTMLElement, handle: HTMLButtonElement): void {
  let pointerId: number | null = null;
  let startX = 0;
  let startReveal = 0;
  let dragIsRtl = false;
  let dragged = false;
  let suppressClick = false;
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') {
      return;
    }
    event.preventDefault();
    pointerId = event.pointerId;
    startX = event.clientX;
    startReveal = _isHifzRoomOpen() ? readHifzCurtainReveal(getHifzCurtainWidth(room)) : 0;
    dragIsRtl = isCurtainRtl(room);
    dragged = false;
    handle.setPointerCapture(event.pointerId);
    room.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    const distance = event.clientX - startX;
    // N-04: mirror the drag in RTL so pulling the handle toward the reader
    // opens the curtain in both directions instead of collapsing it in Arabic.
    const directedDistance = dragIsRtl ? -distance : distance;
    if (Math.abs(distance) > 5) {
      dragged = true;
    }
    if (dragged && !_isHifzRoomOpen()) {
      applyHifzCurtainReveal(room, 0, false);
      _openHifzRoom(false);
    }
    applyHifzCurtainReveal(room, startReveal + directedDistance, false);
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
      _closeHifzRoom(false);
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
    if (_isHifzRoomOpen()) {
      _closeHifzRoom(true);
    } else {
      _openHifzRoom();
    }
  });
}
