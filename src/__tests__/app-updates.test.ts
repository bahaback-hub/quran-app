import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHECK_UPDATES_EVENT, UPDATE_AVAILABLE_EVENT, checkForAppUpdates } from '../app-updates.js';

function stubServiceWorker(value: unknown): void {
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value,
    configurable: true,
    writable: true,
  });
}

function clearServiceWorkerStub(): void {
  const nav = window.navigator as Navigator & { serviceWorker?: unknown };
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
});
