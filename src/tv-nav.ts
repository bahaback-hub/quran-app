/**
 * TV / remote-control spatial navigation.
 *
 * On televisions the remote (arrows + OK + Back) is the only hand: touch,
 * mouse and physical keyboards do not exist. The app's arrow keys are
 * otherwise bound to ayah flipping, which makes every remote press do the
 * wrong thing. When TV mode is active, arrows move the DOM focus
 * spatially (nearest visible control in the pressed direction, YouTube
 * style) and OK/Enter activates the focused control natively.
 *
 * Auto-enables on TV-shaped devices (native app without touch, or a TV
 * user agent); a manual switch in Settings always wins and is persisted.
 */

import { state } from './state.js';
import { storage } from './storage.js';

export type TvDirection = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

const TV_MODE_CLASS = 'tv-nav';
const TV_MODE_KEY = 'tv_mode';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Minimal box shape so the targeting algorithm is unit-testable without a DOM. */
export interface TvBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TvCandidate {
  el: Element;
  box: TvBox;
}

/** True on television devices: TV user agents, or a touchless native app. */
export function isTvDevice(): boolean {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/TV|Tizen|WebOS|SmartTV|BRAVIA|AFT|Philips|GoogleTV|HbbTV|NetCast|Roku|Vizio|TCL/i.test(ua)) {
    return true;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  const native =
    document.documentElement.classList.contains('capacitor-native') ||
    document.body.classList.contains('capacitor-native');
  return native && navigator.maxTouchPoints === 0;
}

/** Whether spatial remote navigation is currently active. */
export function isTvNavActive(): boolean {
  return state.tvMode === true;
}

/** Focus the most sensible starting control (the play button when present). */
export function focusTvDefault(): void {
  const play = document.getElementById('playPauseBtn');
  if (play && isTvVisible(play)) {
    (play as HTMLElement).focus({ preventScroll: true });
    scrollTvIntoView(play);
    return;
  }
  const first = listTvFocusables()[0];
  first?.focus({ preventScroll: true });
  if (first) {
    scrollTvIntoView(first);
  }
}

/**
 * Enable or disable TV mode: body class for the strong focus ring,
 * persisted preference, and an initial focus when turning on.
 */
export function setTvMode(on: boolean): void {
  state.tvMode = on;
  document.body.classList.toggle(TV_MODE_CLASS, on);
  storage.set(TV_MODE_KEY, on);
  if (on) {
    focusTvDefault();
    return;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur?.();
  }
}

/**
 * Apply the stored preference, falling back to auto-detection when the
 * user never chose. Called once during startup.
 */
export function initTvMode(): void {
  const stored = storage.get<boolean>(TV_MODE_KEY);
  const on = stored ?? isTvDevice();
  state.tvMode = on;
  document.body.classList.toggle(TV_MODE_CLASS, on);
}

/** Move DOM focus to the nearest visible control in `direction`. */
export function moveTvFocus(direction: TvDirection): boolean {
  const active = document.activeElement as HTMLElement | null;
  const fromEl = active && active !== document.body && isTvVisible(active) ? active : null;
  const fromBox = fromEl ? toTvBox(fromEl.getBoundingClientRect()) : null;
  const candidates = listTvFocusables()
    .filter((el) => el !== fromEl)
    .map((el) => ({ el, box: toTvBox(el.getBoundingClientRect()) }));
  const target = pickTvTarget(fromEl, fromBox, direction, candidates);
  if (!target) {
    return false;
  }
  (target as HTMLElement).focus({ preventScroll: true });
  scrollTvIntoView(target);
  return true;
}

function scrollTvIntoView(el: Element): void {
  if (typeof (el as HTMLElement).scrollIntoView === 'function') {
    (el as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function toTvBox(r: { x: number; y: number; width: number; height: number }): TvBox {
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

function listTvFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isTvVisible);
}

function isTvVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) {
    return false;
  }
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

/**
 * Pick the best focus target: with no current focus, the topmost-leftmost
 * control; otherwise the nearest control strictly beyond the pressed edge,
 * penalizing off-axis distance so straight lines win over diagonals.
 */
export function pickTvTarget(
  fromEl: Element | null,
  from: TvBox | null,
  direction: TvDirection,
  candidates: TvCandidate[],
): Element | null {
  if (candidates.length === 0) {
    return null;
  }
  const rest = fromEl ? candidates.filter((c) => c.el !== fromEl) : candidates;
  if (!from) {
    let top: TvCandidate | null = null;
    for (const c of rest) {
      if (!top || c.box.y < top.box.y - 2 || (Math.abs(c.box.y - top.box.y) <= 2 && c.box.x < top.box.x)) {
        top = c;
      }
    }
    return top ? top.el : null;
  }
  const fx = from.x + from.width / 2;
  const fy = from.y + from.height / 2;
  let best: Element | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const c of rest) {
    const cx = c.box.x + c.box.width / 2;
    const cy = c.box.y + c.box.height / 2;
    const dx = cx - fx;
    const dy = cy - fy;
    let primary = 0;
    let secondary = 0;
    if (direction === 'ArrowUp') {
      if (cy >= fy - 2) {
        continue;
      }
      primary = fy - cy;
      secondary = Math.abs(dx);
    } else if (direction === 'ArrowDown') {
      if (cy <= fy + 2) {
        continue;
      }
      primary = cy - fy;
      secondary = Math.abs(dx);
    } else if (direction === 'ArrowLeft') {
      if (cx >= fx - 2) {
        continue;
      }
      primary = fx - cx;
      secondary = Math.abs(dy);
    } else {
      if (cx <= fx + 2) {
        continue;
      }
      primary = cx - fx;
      secondary = Math.abs(dy);
    }
    const score = primary + secondary * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = c.el;
    }
  }
  return best;
}
