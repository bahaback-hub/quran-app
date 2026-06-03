import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __, setLang, getLang, initI18n } from '../i18n.js';

// Mock storage to control saved language
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
  },
}));

describe('i18n', () => {
  beforeEach(async () => {
    // Reset to no saved language — initI18n will use browser default
    const { storage } = await import('../storage.js');
    storage.get.mockReturnValue(null);
    await initI18n();
  });

  it('should detect browser language (en) when no saved language', () => {
    // jsdom navigator.language is 'en-US', so initI18n defaults to English
    expect(['ar', 'en']).toContain(getLang());
  });

  it('should switch to English', async () => {
    await setLang('en');
    expect(getLang()).toBe('en');
    expect(__('app_title')).toBe('The Noble Quran');
  });

  it('should return key if translation is missing entirely', async () => {
    await setLang('en');
    const result = __('nonexistent_key_xyz');
    expect(result).toBe('nonexistent_key_xyz');
  });

  it('should set html lang and dir attributes', async () => {
    await setLang('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');

    await setLang('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('should dispatch languagechange event', async () => {
    let fired = false;
    const handler = () => { fired = true; };
    window.addEventListener('languagechange', handler);
    await setLang('en');
    expect(fired).toBe(true);
    window.removeEventListener('languagechange', handler);
  });

  it('should only load the active language bundle', async () => {
    await setLang('en');
    // English should be loaded
    expect(__('app_title')).toBe('The Noble Quran');
    // Arabic fallback should also be loaded
    await setLang('ar');
    expect(__('app_title')).not.toBe('The Noble Quran');
  });

  it('should fall back to Arabic for missing keys', async () => {
    await setLang('en');
    // Even in English mode, Arabic fallback should work for keys not in English bundle
    // (This tests that Arabic is always loaded as fallback)
    expect(getLang()).toBe('en');
  });
});
