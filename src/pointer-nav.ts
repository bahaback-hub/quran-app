/**
 * Pointer mode for TV remotes without a mouse cursor.
 *
 * Focus-jumping (tv-nav.ts) is fast for button grids but cannot reach tiny
 * targets precisely. Pointer mode shows a free cursor dot moved by the
 * arrows (accelerating while held); a short OK press clicks whatever is
 * under the cursor, and scrolling happens automatically at screen edges.
 * Toggled by long-pressing OK, or from Settings. Focus-jumping stays the
 * default; the cursor itself signals which mode is active.
 */

import { state } from './state.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { __ } from './i18n.js';
import type { TvDirection } from './tv-nav.js';

const POINTER_MODE_CLASS = 'tv-pointer';
const POINTER_MODE_KEY = 'pointer_mode';
const POINTER_HINT_KEY = 'pointer_hint_seen';
const POINTER_ID = 'tvPointerCursor';

const BASE_STEP = 32;
const MAX_STEP = 160;
const EDGE_MARGIN = 6;
const EDGE_SCROLL = 180;

export interface PointerPos {
  x: number;
  y: number;
}

/** Step size grows while arrows are held, so long lists stay reachable. */
export function computePointerStep(streak: number): number {
  if (streak <= 0) {
    return BASE_STEP;
  }
  return Math.min(BASE_STEP + streak * 16, MAX_STEP);
}

/** Whether pointer mode is currently active (TV mode must be on too). */
export function isPointerMode(): boolean {
  return state.pointerMode === true;
}

function cursorEl(): HTMLElement | null {
  return document.getElementById(POINTER_ID);
}

function ensureCursor(): HTMLElement {
  let el = cursorEl();
  if (!el) {
    el = document.createElement('div');
    el.id = POINTER_ID;
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
  }
  return el;
}

function readPos(): PointerPos {
  const el = cursorEl();
  if (el && el.dataset['x'] !== undefined) {
    return { x: Number(el.dataset['x']), y: Number(el.dataset['y']) };
  }
  return { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
}

function writePos(pos: PointerPos): void {
  const el = ensureCursor();
  el.dataset['x'] = String(pos.x);
  el.dataset['y'] = String(pos.y);
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
}

/**
 * Enable or disable pointer mode. Enabling centers the cursor and shows a
 * one-time hint; disabling removes the cursor and returns to focus jumping.
 */
export function setPointerMode(on: boolean): void {
  state.pointerMode = on;
  document.body.classList.toggle(POINTER_MODE_CLASS, on);
  storage.set(POINTER_MODE_KEY, on);
  if (on) {
    writePos({ x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) });
    if (!storage.get<boolean>(POINTER_HINT_KEY)) {
      storage.set(POINTER_HINT_KEY, true);
      showToast(__('pointer_hint'), 'info');
    }
  } else {
    cursorEl()?.remove();
  }
}

/** Move the cursor one step in `direction`, scrolling content past screen edges. */
export function movePointer(direction: TvDirection, streak = 0): PointerPos {
  const step = computePointerStep(streak);
  const pos = readPos();
  const maxX = window.innerWidth - 1;
  const maxY = window.innerHeight - 1;
  if (direction === 'ArrowUp') {
    pos.y -= step;
  } else if (direction === 'ArrowDown') {
    pos.y += step;
  } else if (direction === 'ArrowLeft') {
    pos.x -= step;
  } else {
    pos.x += step;
  }
  if (pos.x < EDGE_MARGIN) {
    pos.x = EDGE_MARGIN;
    window.scrollBy({ left: -EDGE_SCROLL, behavior: 'instant' as ScrollBehavior });
  } else if (pos.x > maxX - EDGE_MARGIN) {
    pos.x = maxX - EDGE_MARGIN;
    window.scrollBy({ left: EDGE_SCROLL, behavior: 'instant' as ScrollBehavior });
  }
  if (pos.y < EDGE_MARGIN) {
    pos.y = EDGE_MARGIN;
    window.scrollBy({ top: -EDGE_SCROLL, behavior: 'instant' as ScrollBehavior });
  } else if (pos.y > maxY - EDGE_MARGIN) {
    pos.y = maxY - EDGE_MARGIN;
    window.scrollBy({ top: EDGE_SCROLL, behavior: 'instant' as ScrollBehavior });
  }
  writePos(pos);
  return pos;
}

const CLICKABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Click whatever sits under the cursor. Returns false when nothing clickable is there. */
export function activateAtCursor(): boolean {
  const pos = readPos();
  const el = document.elementFromPoint(pos.x, pos.y);
  if (!el) {
    return false;
  }
  const target = el.closest(CLICKABLE_SELECTOR) ?? el;
  if (target instanceof HTMLElement && typeof target.click === 'function') {
    target.click();
    return true;
  }
  return false;
}
