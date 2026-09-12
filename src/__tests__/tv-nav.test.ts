import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTvDevice, isTvNavActive, moveTvFocus, pickTvTarget, setTvMode } from '../tv-nav.js';
import { state } from '../state.js';

function box(x: number, y: number, w = 40, h = 40) {
  return { x, y, width: w, height: h };
}

function elAt(
  x: number,
  y: number,
  w = 40,
  h = 40,
): { el: Element; box: { x: number; y: number; width: number; height: number } } {
  const el = document.createElement('button');
  el.getBoundingClientRect = () =>
    ({ x, y, width: w, height: h, top: y, left: x, right: x + w, bottom: y + h }) as DOMRect;
  document.body.append(el);
  return { el, box: box(x, y, w, h) };
}

describe('tv-nav targeting', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    state.tvMode = false;
    document.body.classList.remove('tv-nav');
    vi.restoreAllMocks();
  });

  it('returns null with no candidates', () => {
    expect(pickTvTarget(null, null, 'ArrowDown', [])).toBeNull();
  });

  it('picks the topmost-leftmost control with no current focus', () => {
    const a = elAt(200, 300);
    const b = elAt(50, 100);
    const c = elAt(50, 300);
    const all = [a, b, c];
    expect(pickTvTarget(null, null, 'ArrowDown', all)).toBe(b.el);
  });

  it('moves down to the nearest control below', () => {
    const from = elAt(100, 100);
    const near = elAt(100, 200);
    const far = elAt(100, 500);
    const all = [from, near, far];
    expect(pickTvTarget(from.el, from.box, 'ArrowDown', all)).toBe(near.el);
  });

  it('moves up, ignoring controls below', () => {
    const from = elAt(100, 300);
    const above = elAt(100, 100);
    const below = elAt(100, 500);
    const all = [from, above, below];
    expect(pickTvTarget(from.el, from.box, 'ArrowUp', all)).toBe(above.el);
  });

  it('prefers straight lines over diagonals', () => {
    const from = elAt(100, 100);
    const straight = elAt(300, 105);
    const diagonal = elAt(250, 300);
    const all = [from, straight, diagonal];
    expect(pickTvTarget(from.el, from.box, 'ArrowRight', all)).toBe(straight.el);
  });

  it('moves left and right physically (no RTL flip)', () => {
    const from = elAt(300, 200);
    const left = elAt(100, 200);
    const right = elAt(500, 200);
    const all = [from, left, right];
    expect(pickTvTarget(from.el, from.box, 'ArrowLeft', all)).toBe(left.el);
    expect(pickTvTarget(from.el, from.box, 'ArrowRight', all)).toBe(right.el);
  });

  it('returns null when nothing lies in that direction', () => {
    const from = elAt(100, 100);
    const below = elAt(100, 300);
    expect(pickTvTarget(from.el, from.box, 'ArrowUp', [from, below])).toBeNull();
  });
});

describe('tv-nav mode', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    state.tvMode = false;
    document.body.classList.remove('tv-nav');
    vi.restoreAllMocks();
  });

  it('detects TV user agents', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android TV) Chrome/120');
    expect(isTvDevice()).toBe(true);
  });

  it('does not treat desktop browsers as TVs', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120');
    expect(isTvDevice()).toBe(false);
  });

  it('setTvMode toggles state, class and storage', () => {
    setTvMode(true);
    expect(isTvNavActive()).toBe(true);
    expect(document.body.classList.contains('tv-nav')).toBe(true);
    setTvMode(false);
    expect(isTvNavActive()).toBe(false);
    expect(document.body.classList.contains('tv-nav')).toBe(false);
  });

  it('moveTvFocus moves focus between buttons', () => {
    const top = document.createElement('button');
    top.textContent = 'top';
    top.getBoundingClientRect = () =>
      ({ x: 100, y: 50, width: 60, height: 30, top: 50, left: 100, right: 160, bottom: 80 }) as DOMRect;
    const bottom = document.createElement('button');
    bottom.textContent = 'bottom';
    bottom.getBoundingClientRect = () =>
      ({ x: 100, y: 200, width: 60, height: 30, top: 200, left: 100, right: 160, bottom: 230 }) as DOMRect;
    document.body.append(top, bottom);
    top.focus();
    expect(moveTvFocus('ArrowDown')).toBe(true);
    expect(document.activeElement).toBe(bottom);
    expect(moveTvFocus('ArrowDown')).toBe(false);
  });
});
