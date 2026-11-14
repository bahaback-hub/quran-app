import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTO_UPDATE_CHECK_INTERVAL_MS,
  CHECK_UPDATES_EVENT,
  UPDATE_AVAILABLE_EVENT,
  checkForAppUpdates,
  checkForUpdatesOnResume,
  resetAutoUpdateCheckClock,
} from '../app-updates.js';

function stubServiceWorker(value: unknown): void {
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value,
    configurable: true,
    writable: true,
  });
}

function clearServiceWorkerStub(): void {
  const nav = window.navigator as unknown as { serviceWorker?: unknown };
  if ('serviceWorker' in nav) {
    // jsdom has no serviceWorker by default; remove our stub to restore that.
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete nav.serviceWorker;
  }
}

describe('app-updates', () => {
  afterEach(() => {
    clearServiceWorkerStub();
    vi.restoreAllMocks();
  });

  it('exposes stable event names for settings and the banner', () => {
    expect(CHECK_UPDATES_EVENT).toBe('app:check-updates');
    expect(UPDATE_AVAILABLE_EVENT).toBe('app:update-available');
  });

  it('reports unsupported when service workers are unavailable', async () => {
    clearServiceWorkerStub();
    const status = document.createElement('p');
    const result = await checkForAppUpdates(status);
    expect(result).toBe('unsupported');
    expect(status.textContent).toBe('');
  });

  it('reports up-to-date when nothing is registered', async () => {
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(null) });
    const status = document.createElement('p');
    const result = await checkForAppUpdates(status);
    expect(result).toBe('up-to-date');
    expect(status.textContent).toBeTruthy();
  });

  it('fires the banner event when a waiting worker exists', async () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    stubServiceWorker({
      getRegistration: vi.fn().mockResolvedValue({ waiting: {}, installing: null, update: vi.fn() }),
    });
    const result = await checkForAppUpdates(document.createElement('p'));
    expect(result).toBe('updated');
    const names = dispatch.mock.calls.map((call) => (call[0] as Event).type);
    expect(names).toContain(UPDATE_AVAILABLE_EVENT);
  });

  it('reports failed when the check throws', async () => {
    stubServiceWorker({
      getRegistration: vi.fn().mockRejectedValue(new Error('offline')),
    });
    const status = document.createElement('p');
    const result = await checkForAppUpdates(status);
    expect(result).toBe('failed');
    expect(status.textContent).toBeTruthy();
  });

  it('reports up-to-date when no worker is waiting or installing', async () => {
    stubServiceWorker({
      getRegistration: vi.fn().mockResolvedValue({ waiting: null, installing: null, update: vi.fn() }),
    });
    const status = document.createElement('p');
    const result = await checkForAppUpdates(status);
    expect(result).toBe('up-to-date');
    expect(status.textContent).toBeTruthy();
  });

  it('reports updated when the installing worker is already installed', async () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    stubServiceWorker({
      getRegistration: vi.fn().mockResolvedValue({ waiting: {}, update: vi.fn(), installing: { state: 'installed' } }),
    });
    const result = await checkForAppUpdates(document.createElement('p'));
    expect(result).toBe('updated');
    const names = dispatch.mock.calls.map((call) => (call[0] as Event).type);
    expect(names).toContain(UPDATE_AVAILABLE_EVENT);
  });

  it('reports updated once a downloading worker transitions to installed', async () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const handlers: Record<string, () => void> = {};
    const installer = {
      state: 'installing',
      addEventListener: (type: string, cb: () => void) => {
        handlers[type] = cb;
      },
    };
    const registration = { waiting: null, update: vi.fn(), installing: installer };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(registration) });
    const pending = checkForAppUpdates(document.createElement('p'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    (registration as { waiting: unknown }).waiting = {};
    installer.state = 'installed';
    handlers.statechange();
    const result = await pending;
    expect(result).toBe('updated');
    const names = dispatch.mock.calls.map((call) => (call[0] as Event).type);
    expect(names).toContain(UPDATE_AVAILABLE_EVENT);
  });

  it('reports up-to-date when the installing worker becomes redundant', async () => {
    const handlers: Record<string, () => void> = {};
    const installer = {
      state: 'installing',
      addEventListener: (type: string, cb: () => void) => {
        handlers[type] = cb;
      },
    };
    stubServiceWorker({
      getRegistration: vi.fn().mockResolvedValue({ waiting: null, update: vi.fn(), installing: installer }),
    });
    const pending = checkForAppUpdates(document.createElement('p'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    installer.state = 'redundant';
    handlers.statechange();
    const result = await pending;
    expect(result).toBe('up-to-date');
  });

  describe('on resume', () => {
    const base = 1_700_000_000_000;

    it('runs the first check after the window and then skips requests inside it', async () => {
      resetAutoUpdateCheckClock(base);
      const getRegistration = vi.fn().mockResolvedValue({ waiting: null, installing: null, update: vi.fn() });
      stubServiceWorker({ getRegistration });

      expect(await checkForUpdatesOnResume(base + AUTO_UPDATE_CHECK_INTERVAL_MS)).toBe('up-to-date');
      expect(getRegistration).toHaveBeenCalledTimes(1);

      expect(await checkForUpdatesOnResume(base + AUTO_UPDATE_CHECK_INTERVAL_MS + 5 * 60 * 1000)).toBe('skipped');
      expect(getRegistration).toHaveBeenCalledTimes(1);
    });

    it('checks again once the interval has elapsed and reuses the banner event', async () => {
      resetAutoUpdateCheckClock(base);
      const dispatch = vi.spyOn(window, 'dispatchEvent');
      stubServiceWorker({
        getRegistration: vi.fn().mockResolvedValue({ waiting: {}, installing: null, update: vi.fn() }),
      });

      const result = await checkForUpdatesOnResume(base + AUTO_UPDATE_CHECK_INTERVAL_MS);
      expect(result).toBe('updated');
      const names = dispatch.mock.calls.map((call) => (call[0] as Event).type);
      expect(names).toContain(UPDATE_AVAILABLE_EVENT);
    });

    it('reports unsupported without a service worker', async () => {
      resetAutoUpdateCheckClock(base);
      clearServiceWorkerStub();
      expect(await checkForUpdatesOnResume(base + AUTO_UPDATE_CHECK_INTERVAL_MS)).toBe('unsupported');
    });
  });
});
