import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Must set up DOM before importing modules that reference dom
import { dom } from '../dom.js';

Element.prototype.scrollIntoView = function () {};

beforeEach(() => {
  dom.audioPlayer = document.createElement('audio');
  dom.playPauseBtn = document.createElement('button');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('setSleepTimer / clearSleepTimer', () => {
  async function freshMod() {
    vi.useFakeTimers();
    const mod = await import('../audio.js');
    mod.clearSleepTimer();
    dom.audioPlayer = document.createElement('audio');
    dom.playPauseBtn = document.createElement('button');
    return mod;
  }

  it('should set a timer that pauses audio after N minutes', async () => {
    const mod = await freshMod();
    Object.defineProperty(dom.audioPlayer, 'paused', { value: false, writable: true });
    dom.audioPlayer.play = vi.fn();
    dom.audioPlayer.pause = vi.fn();

    mod.setSleepTimer(1);
    expect(mod.getSleepTimerMinutes()).toBe(1);

    vi.advanceTimersByTime(60000);
    expect(dom.audioPlayer.pause).toHaveBeenCalled();
    expect(mod.getSleepTimerMinutes()).toBe(0);
  });

  it('should clear the timer on clearSleepTimer', async () => {
    const mod = await freshMod();
    dom.audioPlayer.pause = vi.fn();

    mod.setSleepTimer(5);
    mod.clearSleepTimer();

    vi.advanceTimersByTime(300000);
    expect(dom.audioPlayer.pause).not.toHaveBeenCalled();
    expect(mod.getSleepTimerMinutes()).toBe(0);
  });

  it('should do nothing for minutes <= 0', async () => {
    const mod = await freshMod();
    dom.audioPlayer.pause = vi.fn();
    mod.setSleepTimer(0);
    expect(mod.getSleepTimerMinutes()).toBe(0);
    expect(dom.audioPlayer.pause).not.toHaveBeenCalled();
  });
});
