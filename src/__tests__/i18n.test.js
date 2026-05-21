import { describe, it, expect, beforeEach } from 'vitest';
import { __, setLang, getLang } from '../i18n.js';

describe('i18n', () => {
  it('should default to Arabic', () => {
    expect(getLang()).toBe('ar');
  });

  it('should switch to English', () => {
    setLang('en');
    expect(getLang()).toBe('en');
    expect(__('app_title')).toBe('The Noble Quran');
  });

  it('should return key if translation is missing entirely', () => {
    setLang('en');
    const result = __('nonexistent_key_xyz');
    expect(result).toBe('nonexistent_key_xyz');
  });

  it('should set html lang and dir attributes', () => {
    setLang('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');

    setLang('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('should dispatch languagechange event', () => {
    let fired = false;
    const handler = () => { fired = true; };
    window.addEventListener('languagechange', handler);
    setLang('en');
    expect(fired).toBe(true);
    window.removeEventListener('languagechange', handler);
  });
});
