/**
 * Behavior of the pre-paint launcher guard.
 *
 * The static launcher hero in index.html is only correct if returning readers
 * (saved position or deep link) get the hiding class before the first paint.
 * These tests exercise the real module against localStorage/hash state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// The shared setup mocks the storage wrapper; this module's whole job is
// reading the real saved position, so exercise the real implementation.
vi.unmock('../storage.js');

const HIDE_CLASS = 'home-preload-hide';

async function runBoot(): Promise<boolean> {
  vi.resetModules();
  await import('../home-boot.js');
  return document.documentElement.classList.contains(HIDE_CLASS);
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.lang = '';
  document.documentElement.dir = '';
  document.body.className = '';
  document.body.removeAttribute('style');
  window.history.replaceState({}, '', '/');
});

describe('home-boot pre-paint guard', () => {
  it('hides the static hero when a reading position is saved', async () => {
    localStorage.setItem('quran_app_last_position', JSON.stringify({ surah: 2, ayahNumberInSurah: 255 }));

    await expect(runBoot()).resolves.toBe(true);
  });

  it('hides the static hero for a deep link', async () => {
    window.history.replaceState({}, '', '/#surah=18/10');

    await expect(runBoot()).resolves.toBe(true);
  });

  it('keeps the static hero visible on a genuine first visit', async () => {
    await expect(runBoot()).resolves.toBe(false);
  });

  it('does not hide anything when storage holds malformed data', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('quran_app_last_position', '{not json');

    await expect(runBoot()).resolves.toBe(false);
    warn.mockRestore();
  });

  it('applies the saved night palette before paint', async () => {
    localStorage.setItem('quran_app_night_mode', 'true');

    await runBoot();

    expect(document.body.classList.contains('night-mode')).toBe(true);
  });

  it('applies the saved deep-night palette before paint', async () => {
    localStorage.setItem('quran_app_night_mode', 'true');
    localStorage.setItem('quran_app_deep_night_mode', 'true');

    await runBoot();

    expect(document.body.classList.contains('night-mode')).toBe(true);
    expect(document.body.classList.contains('deep-night-mode')).toBe(true);
  });

  it('applies the saved sepia palette before paint', async () => {
    localStorage.setItem('quran_app_sepia_mode', 'true');

    await runBoot();

    expect(document.body.classList.contains('sepia-mode')).toBe(true);
  });

  it('follows the OS dark preference when no palette was chosen', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));

    await runBoot();

    expect(document.body.classList.contains('night-mode')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('keeps an explicit light choice over the OS dark preference', async () => {
    localStorage.setItem('quran_app_night_mode', 'false');
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));

    await runBoot();

    expect(document.body.classList.contains('night-mode')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('restores the saved language direction before paint', async () => {
    localStorage.setItem('quran_app_lang', '"en"');

    await runBoot();

    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('keeps the saved right-to-left language', async () => {
    localStorage.setItem('quran_app_lang', '"ur"');

    await runBoot();

    expect(document.documentElement.dir).toBe('rtl');
  });

  it('falls back to the browser language for an unknown saved value', async () => {
    localStorage.setItem('quran_app_lang', '"xx"');
    const original = navigator.language;
    Object.defineProperty(window.navigator, 'language', { value: 'ar-EG', configurable: true });

    await runBoot();

    expect(document.documentElement.dir).toBe('rtl');
    Object.defineProperty(window.navigator, 'language', { value: original, configurable: true });
  });
});
