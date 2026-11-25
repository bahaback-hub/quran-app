import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { stateMock, subscribeMock } = vi.hoisted(() => ({
  stateMock: { isPlaying: false } as any,
  subscribeMock: vi.fn(),
}));

vi.mock('../state.js', () => ({ state: stateMock, subscribe: subscribeMock }));

import { initSessionGuards, _resetSessionGuardsForTest } from '../session-guards.js';

describe('session-guards', () => {
  let releaseMock: any;
  let requestMock: any;

  beforeEach(async () => {
    await _resetSessionGuardsForTest();
    vi.clearAllMocks();
    stateMock.isPlaying = false;
    document.body.innerHTML = '<div id="hifzRoom"></div>';
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    releaseMock = vi.fn().mockResolvedValue(undefined);
    requestMock = vi.fn().mockResolvedValue({ release: releaseMock, addEventListener: vi.fn() });
    (navigator as any).wakeLock = { request: requestMock };
  });

  afterEach(async () => {
    await _resetSessionGuardsForTest();
  });

  it('acquires and releases wake lock based on playback and hifz focus', async () => {
    stateMock.isPlaying = true;
    initSessionGuards();
    await Promise.resolve();
    await Promise.resolve();
    expect(requestMock).toHaveBeenCalledWith('screen');

    stateMock.isPlaying = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    await Promise.resolve();
    expect(releaseMock).toHaveBeenCalled();
  });

  it('prevents unload when session is active and allows when not', async () => {
    initSessionGuards();
    const ev1 = new Event('beforeunload', { cancelable: true }) as any;
    window.dispatchEvent(ev1);
    expect(ev1.defaultPrevented).toBe(false);

    document.getElementById('hifzRoom')!.classList.add('hifz-room-focused');
    const ev2 = new Event('beforeunload', { cancelable: true }) as any;
    window.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(true);
  });
});
