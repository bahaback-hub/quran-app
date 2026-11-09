/** Behavior of the paint-aware scheduling helpers. */

import { describe, it, expect, vi } from 'vitest';
import { afterFirstPaint, scheduleAfterPaint } from '../scheduler.js';

describe('scheduleAfterPaint', () => {
  it('never runs the task synchronously', () => {
    const task = vi.fn();

    scheduleAfterPaint(task);

    expect(task).not.toHaveBeenCalled();
  });

  it('runs the task on a later turn', async () => {
    const task = vi.fn();

    scheduleAfterPaint(task);
    await afterFirstPaint();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('still resolves without requestAnimationFrame', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const task = vi.fn();

    scheduleAfterPaint(task);
    await afterFirstPaint();

    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe('afterFirstPaint', () => {
  it('resolves after the current synchronous work', async () => {
    let resolved = false;

    const pending = afterFirstPaint().then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);

    await pending;
    expect(resolved).toBe(true);
  });
});
