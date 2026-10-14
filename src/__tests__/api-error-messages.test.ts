/**
 * Regression test for QUA-01 — network error toasts must show translated
 * text, never raw i18n keys.
 *
 * The bug: ERROR_MESSAGES called __() at module evaluation, which runs before
 * initI18n(), so every toast showed "error_no_connection" forever, in every
 * language. The existing api-client tests mock __() as identity (key → key),
 * which reproduces the bug shape and can never catch it — so this file
 * deliberately unmocks i18n and uses the real bundles.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use the REAL i18n module (the global setup file mocks it everywhere else).
vi.unmock('../i18n.js');

import { apiFetch } from '../api-client.js';
import { initI18n, setLang } from '../i18n.js';
import { showToast } from '../ui.js';

describe('api error toasts speak the active language (QUA-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(showToast).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function failNextFetch(): Promise<void> {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  }

  it('shows translated Arabic, not the raw key, on network failure', async () => {
    await initI18n();
    await setLang('ar');
    await failNextFetch();

    await expect(apiFetch('/qua01-ar', { retries: 0 })).rejects.toThrow();

    expect(showToast).toHaveBeenCalledTimes(1);
    const [message] = vi.mocked(showToast).mock.calls[0] as [string, string?];
    expect(message).not.toBe('error_server_unreachable');
    expect(message).toBe('خادم غير متاح');
  });

  it('follows language switches instead of freezing the boot language', async () => {
    await initI18n();
    await setLang('ar');
    await failNextFetch();
    await expect(apiFetch('/qua01-switch-ar', { retries: 0 })).rejects.toThrow();
    const [arabic] = vi.mocked(showToast).mock.calls[0] as [string, string?];

    vi.mocked(showToast).mockClear();
    await setLang('en');
    await failNextFetch();
    await expect(apiFetch('/qua01-switch-en', { retries: 0 })).rejects.toThrow();
    const [english] = vi.mocked(showToast).mock.calls[0] as [string, string?];

    expect(arabic).not.toBe('error_server_unreachable');
    expect(english).toBe('Server unreachable');
    expect(english).not.toBe(arabic);
  });
});
