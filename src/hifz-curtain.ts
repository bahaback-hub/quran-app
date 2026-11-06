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
    if (dragged && !_isHifzRoomOpen()) {
      applyHifzCurtainReveal(room, 0, false);
      _openHifzRoom(false);
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
