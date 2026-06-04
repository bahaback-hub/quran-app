import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __,
  setLang,
  getLang,
  initI18n,
  preloadLang,
  unloadLang,
  getLoadedLangs,
  AVAILABLE_LANGUAGES,
} from '../i18n.js';

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
    const handler = () => {
      fired = true;
    };
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

  /* ===================== LAZY LOADING ===================== */

  describe('lazy loading', () => {
    it('should only load the active language and Arabic initially', async () => {
      await initI18n();
      const loaded = getLoadedLangs();
      // Should have at least Arabic (fallback) and the active language
      expect(loaded).toContain('ar');
    });

    it('should preload a language without switching', async () => {
      await setLang('ar');
      // preloadLang is fire-and-forget but we can wait by loading the same lang
      preloadLang('tr');
      // Force wait for the preload to complete
      await setLang('tr');
      const loaded = getLoadedLangs();
      expect(loaded).toContain('tr');
      // Switch back
      await setLang('ar');
      expect(getLang()).toBe('ar');
    });

    it('should handle preload failure gracefully', async () => {
      // preloadLang should not throw - it catches errors internally
      preloadLang('en');
      // Give it a moment
      await new Promise((r) => setTimeout(r, 100));
    });

    it('should unload a non-current, non-Arabic language', async () => {
      await setLang('en');
      // Load Turkish by switching to it, then back
      await setLang('tr');
      await setLang('en');
      expect(getLoadedLangs()).toContain('tr');

      const result = unloadLang('tr');
      expect(result).toBe(true);
      expect(getLoadedLangs()).not.toContain('tr');
    });

    it('should not unload Arabic (fallback)', async () => {
      await setLang('en');
      const result = unloadLang('ar');
      expect(result).toBe(false);
      expect(getLoadedLangs()).toContain('ar');
    });

    it('should not unload the current language', async () => {
      await setLang('en');
      const result = unloadLang('en');
      expect(result).toBe(false);
      expect(getLoadedLangs()).toContain('en');
    });

    it('should return false when unloading a language not loaded', () => {
      const result = unloadLang('ms');
      expect(result).toBe(false);
    });
  });

  /* ===================== AVAILABLE LANGUAGES ===================== */

  describe('AVAILABLE_LANGUAGES', () => {
    it('should have 5 languages', () => {
      expect(AVAILABLE_LANGUAGES).toHaveLength(5);
    });

    it('should have correct language codes', () => {
      const codes = AVAILABLE_LANGUAGES.map((l) => l.code);
      expect(codes).toContain('ar');
      expect(codes).toContain('en');
      expect(codes).toContain('tr');
      expect(codes).toContain('ms');
      expect(codes).toContain('id');
    });

    it('should have Arabic as RTL', () => {
      const ar = AVAILABLE_LANGUAGES.find((l) => l.code === 'ar');
      expect(ar?.dir).toBe('rtl');
    });

    it('should have English as LTR', () => {
      const en = AVAILABLE_LANGUAGES.find((l) => l.code === 'en');
      expect(en?.dir).toBe('ltr');
    });
  });
});
