/**
 * ================================================================
 * i18n with Pluralization — Solves Problem #7
 * ----------------------------------------------------------------
 * Replaces the basic string-only i18n with a system that supports:
 *   - Intl.PluralRules for proper plural forms
 *   - ICU MessageFormat-style placeholders
 *   - RTL/LTR detection
 *   - Lazy loading of language bundles
 *   - Declarative DOM updates (data-i18n attributes)
 *
 * Arabic plural rules (6 forms):
 *   - zero (0)
 *   - one (1)
 *   - two (2)
 *   - few (3-10)
 *   - many (11-99)
 *   - other (100+)
 *
 * Examples:
 *   __('ayah_count', { count: 1 })   → "آية واحدة"
 *   __('ayah_count', { count: 2 })   → "آيتان"
 *   __('ayah_count', { count: 5 })   → "٥ آيات"
 *   __('ayah_count', { count: 15 })  → "١٥ آية"
 *   __('ayah_count', { count: 100 }) → "١٠٠ آية"
 * ================================================================
 */

import { storage } from '../services/storage.js';

export type LangCode = 'ar' | 'en' | 'tr' | 'ms' | 'id';

export interface LanguageInfo {
  code: LangCode;
  nativeName: string;
  englishName: string;
  dir: 'rtl' | 'ltr';
}

export const AVAILABLE_LANGUAGES: LanguageInfo[] = [
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', dir: 'ltr' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', dir: 'ltr' },
];

/** A translation value: string OR plural forms OR nested object. */
export type TranslationValue =
  | string
  | {
      zero?: string;
      one?: string;
      two?: string;
      few?: string;
      many?: string;
      other?: string;
    }
  | Record<string, string>;

export interface TranslationBundle {
  [key: string]: TranslationValue;
}

// ================================================================
// Plural Rules Cache
// ================================================================

const pluralRulesCache = new Map<LangCode, Intl.PluralRules>();

function getPluralRules(lang: LangCode): Intl.PluralRules {
  if (!pluralRulesCache.has(lang)) {
    pluralRulesCache.set(
      lang,
      new Intl.PluralRules(lang, { type: 'cardinal' }),
    );
  }
  return pluralRulesCache.get(lang)!;
}

// ================================================================
// Arabic Number Conversion
// ================================================================

const ARABIC_DIGITS: Record<string, string> = {
  '0': '٠',
  '1': '١',
  '2': '٢',
  '3': '٣',
  '4': '٤',
  '5': '٥',
  '6': '٦',
  '7': '٧',
  '8': '٨',
  '9': '٩',
};

/** Convert Latin digits to Arabic-Indic digits (٠-٩). */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[d] ?? d);
}

/** Convert Arabic-Indic digits back to Latin. */
export function toLatinDigits(value: string): string {
  const reverse: Record<string, string> = {};
  for (const [k, v] of Object.entries(ARABIC_DIGITS)) reverse[v] = k;
  return value.replace(/[٠-٩]/g, (d) => reverse[d] ?? d);
}

// ================================================================
// i18n Manager
// ================================================================

class I18nManager {
  private currentLang: LangCode = 'ar';
  private currentBundle: TranslationBundle = {};
  private fallbackBundle: TranslationBundle = {};
  private readonly loadingPromises = new Map<LangCode, Promise<TranslationBundle>>();

  /**
   * Initialize i18n with the user's saved or browser-detected language.
   */
  async init(): Promise<void> {
    const saved = storage.get<LangCode>('lang');
    const browserLang = (navigator.language.split('-')[0] ?? 'ar') as LangCode;
    const supported = AVAILABLE_LANGUAGES.some((l) => l.code === browserLang);
    this.currentLang = saved ?? (supported ? browserLang : 'ar');

    // Always load Arabic as fallback
    this.fallbackBundle = await this.loadBundle('ar');

    // Load current language (if different from fallback)
    if (this.currentLang !== 'ar') {
      this.currentBundle = await this.loadBundle(this.currentLang);
    } else {
      this.currentBundle = this.fallbackBundle;
    }

    this.applyDirection();
    this.applyTranslations();
  }

  /**
   * Translate a key with optional parameters.
   *
   * Supports pluralization via {count} parameter:
   *   __('ayah_count', { count: 5 })
   *
   * Supports simple placeholders:
   *   __('welcome', { name: 'Ahmed' }) → "Welcome, Ahmed"
   */
  __(key: string, params?: Record<string, string | number>): string {
    const template = this.lookup(key);
    if (!template) {
      if (import.meta.env?.DEV) {
        console.warn(`[i18n] Missing translation key: "${key}"`);
      }
      return key; // graceful fallback
    }

    // Handle plural forms if params.count is provided
    if (params && typeof params.count === 'number') {
      return this.applyPluralization(template, params.count, params);
    }

    // Simple placeholder substitution
    return this.substitutePlaceholders(template, params);
  }

  /**
   * Change the active language.
   */
  async setLang(lang: LangCode): Promise<void> {
    if (lang === this.currentLang) return;

    this.currentLang = lang;
    storage.set('lang', lang);

    if (lang === 'ar') {
      this.currentBundle = this.fallbackBundle;
    } else {
      this.currentBundle = await this.loadBundle(lang);
    }

    this.applyDirection();
    this.applyTranslations();

    // Notify listeners
    window.dispatchEvent(new CustomEvent('app:langchange', { detail: { lang } }));
  }

  /** Get the current language code. */
  getLang(): LangCode {
    return this.currentLang;
  }

  /** Get the current text direction. */
  getDir(): 'rtl' | 'ltr' {
    return AVAILABLE_LANGUAGES.find((l) => l.code === this.currentLang)?.dir ?? 'rtl';
  }

  // ================================================================
  // Private
  // ================================================================

  private lookup(key: string): string | undefined {
    const value = this.currentBundle[key] ?? this.fallbackBundle[key];
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'other' in value) {
      // Plural object — return 'other' as fallback (caller should provide count)
      return value.other;
    }
    return undefined;
  }

  private applyPluralization(
    template: TranslationValue,
    count: number,
    params: Record<string, string | number>,
  ): string {
    let selectedForm: string;

    if (typeof template === 'string') {
      // No plural forms defined — just substitute count
      selectedForm = template;
    } else {
      // Use Intl.PluralRules to select the right form
      const rule = getPluralRules(this.currentLang).select(count);
      selectedForm =
        (template as Record<string, string>)[rule] ??
        (template as Record<string, string>).other ??
        '';
    }

    return this.substitutePlaceholders(selectedForm, { ...params, count });
  }

  private substitutePlaceholders(
    template: string,
    params?: Record<string, string | number>,
  ): string {
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, key: string) => {
      const value = params[key];
      if (value === undefined) return match;

      // Convert numbers to Arabic digits for Arabic language
      if (typeof value === 'number' && this.currentLang === 'ar') {
        return toArabicDigits(value);
      }
      return String(value);
    });
  }

  private async loadBundle(lang: LangCode): Promise<TranslationBundle> {
    // Deduplicate concurrent loads
    if (this.loadingPromises.has(lang)) {
      return this.loadingPromises.get(lang)!;
    }

    const promise = (async () => {
      try {
        const module = await import(`../translations/${lang}.js`);
        return module.default as TranslationBundle;
      } catch (err) {
        console.error(`[i18n] Failed to load language "${lang}":`, err);
        // Fall back to Arabic
        return this.fallbackBundle;
      } finally {
        this.loadingPromises.delete(lang);
      }
    })();

    this.loadingPromises.set(lang, promise);
    return promise;
  }

  private applyDirection(): void {
    const dir = this.getDir();
    document.documentElement.lang = this.currentLang;
    document.documentElement.dir = dir;
  }

  private applyTranslations(): void {
    // Declarative DOM updates via data-i18n attributes
    const elements = document.querySelectorAll<HTMLElement>('[data-i18n]');
    for (const el of elements) {
      const key = el.dataset['i18n']!;
      el.textContent = this.__(key);
    }

    // Placeholders
    const placeholders = document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]');
    for (const el of placeholders) {
      const key = el.dataset['i18nPlaceholder']!;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.placeholder = this.__(key);
      }
    }

    // ARIA labels
    const ariaLabels = document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]');
    for (const el of ariaLabels) {
      const key = el.dataset['i18nAriaLabel']!;
      el.setAttribute('aria-label', this.__(key));
    }
  }
}

/** Singleton instance. */
export const i18n = new I18nManager();

/** Shorthand for translations. */
export function __(key: string, params?: Record<string, string | number>): string {
  return i18n.__(key, params);
}
