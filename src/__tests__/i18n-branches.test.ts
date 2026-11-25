import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.unmock('../i18n.js');

const store: Record<string, unknown> = {};
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn((key: string) => (key in store ? store[key] : null)),
    set: vi.fn((key: string, val: unknown) => {
      store[key] = val;
      return true;
    }),
    remove: vi.fn((key: string) => {
      delete store[key];
    }),
  },
}));

describe('i18n branches', () => {
  const originalLanguage = navigator.language;

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'language', { value: originalLanguage, configurable: true });
  });

  it('initI18n uses saved language, browser language, and applies direction', async () => {
    store.lang = 'en';
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
    const i18n = await import('../i18n.js');
    await i18n.initI18n();
    expect(i18n.getLang()).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    for (const k of Object.keys(store)) delete store[k];
    vi.resetModules();
    Object.defineProperty(navigator, 'language', { value: 'tr-TR', configurable: true });
    const i18n2 = await import('../i18n.js');
    await i18n2.initI18n();
    expect(i18n2.getLang()).toBe('tr');
  });

  it('initI18n falls back to arabic when browser language unsupported', async () => {
    Object.defineProperty(navigator, 'language', { value: 'xx-YY', configurable: true });
    const i18n = await import('../i18n.js');
    await i18n.initI18n();
    expect(i18n.getLang()).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('applyTranslations updates attributes and handles missing keys safely', async () => {
    const i18n = await import('../i18n.js');
    await i18n.setLang('en');
    document.body.innerHTML = `
      <span id="t" data-i18n="error_title"></span>
      <input id="p" data-i18n-placeholder="error_title" />
      <button id="ti" data-i18n-title="error_title"></button>
      <div id="a" data-i18n-aria-label="error_title"></div>
      <span id="m" data-i18n=""></span>
    `;
    i18n.applyTranslations();
    expect(document.getElementById('t')?.textContent).toBe('An error occurred');
    expect((document.getElementById('p') as HTMLInputElement).placeholder).toBe('An error occurred');
    expect(document.getElementById('ti')?.getAttribute('title')).toBe('An error occurred');
    expect(document.getElementById('a')?.getAttribute('aria-label')).toBe('An error occurred');
    expect(document.getElementById('m')?.textContent).toBe('');
  });

  it('handles pluralization, digit conversion, and interpolation branches', async () => {
    const i18n = await import('../i18n.js');
    await i18n.setLang('ar');
    expect(i18n.toArabicDigits(123)).toBe('١٢٣');
    expect(i18n.toLatinDigits('١٢٣')).toBe('123');
    expect(i18n.__n('missing_plural_key', 2)).toBe('missing_plural_key');
    expect(i18n.__('error_title', 'x')).toBe('حدث خطأ');
  });

  it('exposes preload/unload/getLoadedLangs and prayer/city helpers', async () => {
    const i18n = await import('../i18n.js');
    await i18n.setLang('ar');
    i18n.preloadLang('en');
    await new Promise((r) => setTimeout(r, 0));
    expect(i18n.getLoadedLangs()).toContain('ar');
    expect(i18n.unloadLang('ar')).toBe(false);
    expect(i18n.getPrayerName('Fajr')).toBeTruthy();
    expect(i18n.getCityName('Makkah')).toBeTruthy();
  });
});
