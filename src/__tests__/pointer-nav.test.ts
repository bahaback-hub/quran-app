import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activateAtCursor,
  activateEl,
  computePointerStep,
  isPointerMode,
  movePointer,
  setPointerMode,
} from '../pointer-nav.js';
import { state } from '../state.js';

describe('pointer-nav steps', () => {
  it('starts at a base step and accelerates up to a cap', () => {
    expect(computePointerStep(0)).toBe(32);
    expect(computePointerStep(1)).toBe(48);
    expect(computePointerStep(2)).toBe(64);
    expect(computePointerStep(100)).toBe(160);
  });
});

describe('pointer-nav mode', () => {
  afterEach(() => {
    state.pointerMode = false;
    document.body.classList.remove('tv-pointer');
    document.getElementById('tvPointerCursor')?.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows a centered cursor when enabled and removes it when disabled', () => {
    setPointerMode(true);
    expect(isPointerMode()).toBe(true);
    expect(document.body.classList.contains('tv-pointer')).toBe(true);
    const cursor = document.getElementById('tvPointerCursor');
    expect(cursor).not.toBeNull();
    setPointerMode(false);
    expect(isPointerMode()).toBe(false);
    expect(document.getElementById('tvPointerCursor')).toBeNull();
  });

  it('moves the cursor with arrows and clamps at edges', () => {
    window.scrollBy = vi.fn() as unknown as typeof window.scrollBy;
    setPointerMode(true);
    const cursor = document.getElementById('tvPointerCursor')!;
    const startX = Number(cursor.dataset['x']);
    movePointer('ArrowRight', 0);
    expect(Number(cursor.dataset['x'])).toBeGreaterThan(startX);
    movePointer('ArrowLeft', 0);
    movePointer('ArrowLeft', 50);
    expect(Number(cursor.dataset['x'])).toBeGreaterThanOrEqual(6);
  });

  it('clicks whatever sits under the cursor', () => {
    const btn = document.createElement('button');
    const click = vi.fn();
    btn.addEventListener('click', click);
    document.elementFromPoint = vi.fn().mockReturnValue(btn) as unknown as typeof document.elementFromPoint;
    setPointerMode(true);
    expect(activateAtCursor()).toBe(true);
    expect(click).toHaveBeenCalled();
  });

  it('reports false when nothing clickable is under the cursor', () => {
    document.elementFromPoint = vi.fn().mockReturnValue(null) as unknown as typeof document.elementFromPoint;
    setPointerMode(true);
    expect(activateAtCursor()).toBe(false);
  });

  it('opens native selects via showPicker when available', () => {
    const select = document.createElement('select');
    const picker = vi.fn();
    (select as unknown as Record<string, unknown>)['showPicker'] = picker;
    document.body.append(select);
    expect(activateEl(select)).toBe(true);
    expect(picker).toHaveBeenCalled();
    expect(document.activeElement).toBe(select);
    select.remove();
  });

  it('falls back to click when showPicker is missing or throws', () => {
    const select = document.createElement('select');
    const click = vi.fn();
    select.addEventListener('click', click);
    document.body.append(select);
    expect(activateEl(select)).toBe(true);
    expect(click).toHaveBeenCalled();
    select.remove();
  });

  it('lands focus under the cursor when leaving pointer mode', () => {
    const btn = document.createElement('button');
    btn.textContent = 'under';
    btn.getBoundingClientRect = () =>
      ({ x: 600, y: 400, width: 60, height: 30, top: 400, left: 600, right: 660, bottom: 430 }) as DOMRect;
    document.body.append(btn);
    document.elementFromPoint = vi.fn().mockReturnValue(btn) as unknown as typeof document.elementFromPoint;
    setPointerMode(true);
    // Force the cursor over the button regardless of viewport size.
    const cursor = document.getElementById('tvPointerCursor')!;
    cursor.dataset['x'] = '630';
    cursor.dataset['y'] = '415';
    setPointerMode(false);
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });
});
