/**
 * Tests for src/lang-switcher.ts — the header language dropdown.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const i18nMock = vi.hoisted(() => ({
  currentLang: 'ar',
  getLang: vi.fn(() => i18nMock.currentLang),
  setLang: vi.fn(async (code: string) => {
    i18nMock.currentLang = code;
  }),
  AVAILABLE_LANGUAGES: [
    { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
    { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr' },
    { code: 'zz', nativeName: 'Zebra', englishName: 'Zebra', dir: 'ltr' },
  ],
}));

vi.mock('../i18n.js', () => i18nMock);

function mountHeader(): void {
  document.body.innerHTML = `
    <button id="langToggleBtn" type="button" aria-expanded="false"></button>
    <div id="langDropdown" class="hidden"></div>
    <button id="langCurrentFlag"></button>
    <select id="langSelect"><option value="ar">ar</option><option value="en">en</option></select>
  `;
}

async function initSwitcher(): Promise<{ initLangSwitcher: () => void }> {
  vi.resetModules();
  i18nMock.currentLang = 'ar';
  return import('../lang-switcher.js');
}

describe('lang switcher', () => {
  beforeEach(() => {
    mountHeader();
  });

  it('builds the dropdown once, marks the active language and shows the current flag', async () => {
    i18nMock.setLang.mockClear();
    const { initLangSwitcher } = await initSwitcher();
    initLangSwitcher();

    const options = document.querySelectorAll('#langDropdown .lang-option');
    expect(options).toHaveLength(3);

    document.getElementById('langToggleBtn')!.click();
    const active = document.querySelector('#langDropdown .lang-option.active');
    expect((active as HTMLElement | null)?.dataset['lang']).toBe('ar');
    expect((active as HTMLButtonElement | null)?.getAttribute('aria-selected')).toBe('true');

    expect(document.querySelector('#langCurrentFlag')?.innerHTML).toContain('flags/sa.svg');
    expect(document.querySelector('#langCurrentFlag')?.innerHTML).toContain('🇸🇦');

    const zebra = document.querySelector('#langDropdown .lang-option[data-lang="zz"]');
    expect(zebra?.innerHTML).toContain('🌐');

    document.getElementById('langToggleBtn')!.click();
    initLangSwitcher();
    expect(document.querySelectorAll('#langDropdown .lang-option')).toHaveLength(3);
  });

  it('opens and closes the dropdown from the toggle button', async () => {
    const { initLangSwitcher } = await initSwitcher();
    initLangSwitcher();
    const btn = document.getElementById('langToggleBtn')!;
    const dropdown = document.getElementById('langDropdown')!;

    btn.click();
    expect(dropdown.classList.contains('hidden')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(dropdown.style.left).toBe('8px');

    btn.click();
    expect(dropdown.classList.contains('hidden')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('selects a different language through setLang and skips the same language', async () => {
    const { initLangSwitcher } = await initSwitcher();
    initLangSwitcher();
    const en = document.querySelector<HTMLButtonElement>('#langDropdown .lang-option[data-lang="en"]')!;

    en.click();
    expect(i18nMock.setLang).toHaveBeenCalledWith('en');
    expect(document.getElementById('langToggleBtn')?.getAttribute('aria-expanded')).toBe('false');

    i18nMock.setLang.mockClear();
    i18nMock.currentLang = 'en';
    const btn = document.getElementById('langToggleBtn')!;
    btn.click();
    document.querySelector<HTMLButtonElement>('#langDropdown .lang-option[data-lang="en"]')!.click();
    expect(i18nMock.setLang).not.toHaveBeenCalled();
  });

  it('closes from an outside click, Escape, scroll and resize — and refocuses the button', async () => {
    const { initLangSwitcher } = await initSwitcher();
    initLangSwitcher();
    const btn = document.getElementById('langToggleBtn')!;
    const openAndClose = (close: () => void): void => {
      btn.click();
      expect(document.getElementById('langDropdown')!.classList.contains('hidden')).toBe(false);
      close();
      expect(document.getElementById('langDropdown')!.classList.contains('hidden')).toBe(true);
    };

    openAndClose(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    openAndClose(() => window.dispatchEvent(new Event('scroll')));
    openAndClose(() => window.dispatchEvent(new Event('resize')));

    btn.click();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('langDropdown')!.classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the header flag, dropdown selection and settings select in sync on langchange', async () => {
    const { initLangSwitcher } = await initSwitcher();
    initLangSwitcher();
    i18nMock.currentLang = 'en';
    window.dispatchEvent(new Event('app:langchange'));

    expect(document.querySelector('#langCurrentFlag')?.innerHTML).toContain('flags/gb.svg');
    const active = document.querySelector('#langDropdown .lang-option.active');
    expect((active as HTMLElement | null)?.dataset['lang']).toBe('en');
    expect((document.getElementById('langSelect') as HTMLSelectElement).value).toBe('en');
  });

  it('gracefully handles missing dropdown elements at init and after removal', async () => {
    const { initLangSwitcher } = await initSwitcher();
    mountHeader();
    document.getElementById('langDropdown')!.remove();
    initLangSwitcher();
    expect(() => document.getElementById('langToggleBtn')!.click()).not.toThrow();
    expect(document.getElementById('langToggleBtn')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('is a no-op when the header elements are absent', async () => {
    const { initLangSwitcher } = await initSwitcher();
    document.body.innerHTML = '';
    expect(() => initLangSwitcher()).not.toThrow();
  });
});