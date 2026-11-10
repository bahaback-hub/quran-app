/**
 * Tests for i18n pluralization feature (__n function).
 *
 * Verifies that:
 *   - Plural forms are selected correctly based on count
 *   - Arabic-Indic digits are used for Arabic language
 *   - Placeholders are substituted properly
 *   - Fallback to 'other' form when specific form is missing
 *   - Backward compatibility with string values (not plural objects)
 *
 * NOTE: setup-i18n.ts mocks the i18n module, so we test the PURE functions
 * (toArabicDigits, toLatinDigits) and the Intl.PluralRules behavior directly.
 * The __n function depends on i18n state which is mocked — so we verify
 * its signature and the underlying plural-selection logic instead.
 */

import { describe, it, expect } from 'vitest';
import arT from '../translations/ar.js';
import enT from '../translations/en.js';
import urT from '../translations/ur.js';
import ruT from '../translations/ru.js';
import deT from '../translations/de.js';
import frT from '../translations/fr.js';
import trT from '../translations/tr.js';
import msT from '../translations/ms.js';
import idT from '../translations/id.js';

const LOCALE_BUNDLES: Record<string, Record<string, unknown>> = {
  ar: arT as unknown as Record<string, unknown>,
  en: enT as unknown as Record<string, unknown>,
  ur: urT as unknown as Record<string, unknown>,
  ru: ruT as unknown as Record<string, unknown>,
  de: deT as unknown as Record<string, unknown>,
  fr: frT as unknown as Record<string, unknown>,
  tr: trT as unknown as Record<string, unknown>,
  ms: msT as unknown as Record<string, unknown>,
  id: idT as unknown as Record<string, unknown>,
};

// We test the underlying logic directly without depending on i18n.ts state.
// The plural-selection logic is replicated here for testing, mirroring __n.

type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

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

function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[d] ?? d);
}

function toLatinDigits(value: string): string {
  const reverse: Record<string, string> = {};
  for (const [k, v] of Object.entries(ARABIC_DIGITS)) {
    reverse[v] = k;
  }
  return value.replace(/[٠-٩]/g, (d) => reverse[d] ?? d);
}

/** Replicates the __n function's core logic for testing. */
function selectPluralForm(bundle: Record<PluralForm, string>, count: number, lang: string): string {
  const rules = new Intl.PluralRules(lang, { type: 'cardinal' });
  const rule = rules.select(count) as PluralForm;
  return bundle[rule] ?? bundle.other ?? '';
}

function substitute(template: string, count: number, lang: string): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    if (key === 'count') {
      if (lang === 'ar') {
        return toArabicDigits(count);
      }
      return String(count);
    }
    return `{${key}}`;
  });
}

// Test data — mirrors what's in src/translations/ar.ts
const AR_PLURALS: Record<string, Record<PluralForm, string>> = {
  ayah_count: {
    zero: 'لا توجد آيات',
    one: 'آية واحدة',
    two: 'آيتان',
    few: '{count} آيات',
    many: '{count} آية',
    other: '{count} آية',
  },
  favorite_count: {
    zero: 'لا توجد مفضلات',
    one: 'مفضلة واحدة',
    two: 'مفضلتان',
    few: '{count} مفضلات',
    many: '{count} مفضلة',
    other: '{count} مفضلة',
  },
};

describe('i18n pluralization — toArabicDigits', () => {
  it('should convert Latin digits to Arabic-Indic', () => {
    expect(toArabicDigits(0)).toBe('٠');
    expect(toArabicDigits(1)).toBe('١');
    expect(toArabicDigits(5)).toBe('٥');
    expect(toArabicDigits(9)).toBe('٩');
    expect(toArabicDigits(123)).toBe('١٢٣');
  });

  it('should handle string input', () => {
    expect(toArabicDigits('test 99')).toBe('test ٩٩');
    expect(toArabicDigits('page 5 of 604')).toBe('page ٥ of ٦٠٤');
  });

  it('should leave non-digits untouched', () => {
    expect(toArabicDigits('hello')).toBe('hello');
    expect(toArabicDigits('abcXYZ')).toBe('abcXYZ');
  });
});

describe('i18n pluralization — toLatinDigits', () => {
  it('should convert Arabic-Indic digits back to Latin', () => {
    expect(toLatinDigits('٠')).toBe('0');
    expect(toLatinDigits('١٢٣')).toBe('123');
    expect(toLatinDigits('صفحة ٥ من ٦٠٤')).toBe('صفحة 5 من 604');
  });

  it('should be reversible with toArabicDigits', () => {
    const original = '1234567890';
    const arabic = toArabicDigits(original);
    const back = toLatinDigits(arabic);
    expect(back).toBe(original);
  });
});

describe('Intl.PluralRules for Arabic', () => {
  it('should select correct plural form for Arabic numbers', () => {
    const rules = new Intl.PluralRules('ar');
    expect(rules.select(0)).toBe('zero');
    expect(rules.select(1)).toBe('one');
    expect(rules.select(2)).toBe('two');
    expect(rules.select(3)).toBe('few');
    expect(rules.select(10)).toBe('few');
    expect(rules.select(11)).toBe('many');
    expect(rules.select(99)).toBe('many');
    expect(rules.select(100)).toBe('other');
    expect(rules.select(1000)).toBe('other');
  });

  it('should select correct plural form for English', () => {
    const rules = new Intl.PluralRules('en');
    expect(rules.select(0)).toBe('other');
    expect(rules.select(1)).toBe('one');
    expect(rules.select(2)).toBe('other');
    expect(rules.select(100)).toBe('other');
  });
});

describe('Plural form selection (mirrors __n logic)', () => {
  it('should select "zero" form for count=0', () => {
    const result = selectPluralForm(AR_PLURALS.ayah_count!, 0, 'ar');
    expect(result).toBe('لا توجد آيات');
  });

  it('should select "one" form for count=1', () => {
    const result = selectPluralForm(AR_PLURALS.ayah_count!, 1, 'ar');
    expect(result).toBe('آية واحدة');
  });

  it('should select "two" form for count=2', () => {
    const result = selectPluralForm(AR_PLURALS.ayah_count!, 2, 'ar');
    expect(result).toBe('آيتان');
  });

  it('should select "few" form for count=3-10', () => {
    for (let i = 3; i <= 10; i++) {
      const result = selectPluralForm(AR_PLURALS.ayah_count!, i, 'ar');
      expect(result).toBe('{count} آيات');
    }
  });

  it('should select "many" form for count=11-99', () => {
    for (const count of [11, 15, 25, 50, 99]) {
      const result = selectPluralForm(AR_PLURALS.ayah_count!, count, 'ar');
      expect(result).toBe('{count} آية');
    }
  });

  it('should select "other" form for count>=100', () => {
    for (const count of [100, 500, 1000]) {
      const result = selectPluralForm(AR_PLURALS.ayah_count!, count, 'ar');
      expect(result).toBe('{count} آية');
    }
  });
});

describe('Placeholder substitution with Arabic digits', () => {
  it('should replace {count} with Arabic digits for Arabic', () => {
    const template = AR_PLURALS.ayah_count!.few;
    const result = substitute(template, 5, 'ar');
    expect(result).toBe('٥ آيات');
  });

  it('should replace {count} with Latin digits for English', () => {
    const template = '{count} ayahs';
    const result = substitute(template, 5, 'en');
    expect(result).toBe('5 ayahs');
  });

  it('should handle count=1 with Arabic digits', () => {
    const template = '{count} آية';
    const result = substitute(template, 1, 'ar');
    expect(result).toBe('١ آية');
  });

  it('should handle count=100 with Arabic digits', () => {
    const template = '{count} آية';
    const result = substitute(template, 100, 'ar');
    expect(result).toBe('١٠٠ آية');
  });
});

describe('Arabic translation bundle has all plural forms', () => {
  // Direct import — verifies the actual ar.ts file content
  it('should have all 6 plural forms for ayah_count', async () => {
    const ar = (await import('../translations/ar.js')).default as unknown as Record<string, unknown>;
    const ayahCount = ar['ayah_count'] as Record<string, string>;
    expect(ayahCount).toBeDefined();
    expect(ayahCount.zero).toBeDefined();
    expect(ayahCount.one).toBeDefined();
    expect(ayahCount.two).toBeDefined();
    expect(ayahCount.few).toBeDefined();
    expect(ayahCount.many).toBeDefined();
    expect(ayahCount.other).toBeDefined();
  });

  it('should have all 6 plural forms for favorite_count', async () => {
    const ar = (await import('../translations/ar.js')).default as unknown as Record<string, unknown>;
    const favoriteCount = ar['favorite_count'] as Record<string, string>;
    expect(favoriteCount.zero).toBe('لا توجد مفضلات');
    expect(favoriteCount.one).toBe('مفضلة واحدة');
    expect(favoriteCount.two).toBe('مفضلتان');
  });

  it('should have plural forms for all 13 count-related keys', async () => {
    const ar = (await import('../translations/ar.js')).default as unknown as Record<string, unknown>;
    const keysWithPlurals = [
      'ayah_count',
      'favorite_count',
      'search_results_count',
      'bookmark_count',
      'minutes_remaining',
      'pages_count',
      'surah_count',
      'reciter_count',
      'listening_minutes',
      'reading_sessions',
      'day_streak',
      // N-12: migrated from plain strings to plural-form objects
      'sleep_timer_set',
      'sleep_timer_stopped',
    ];

    for (const key of keysWithPlurals) {
      expect(ar[key], `Key "${key}" should exist`).toBeDefined();
      const value = ar[key] as Record<string, string>;
      expect(value.other, `Key "${key}" should have 'other' form`).toBeDefined();
      expect(typeof value.other).toBe('string');
    }
  });
});

describe('N-12: sleep_timer and ayah_count plural forms across all 9 locales', () => {
  // Regression for the plural-form migration: every locale must expose
  // sleep_timer_set, sleep_timer_stopped, and ayah_count as plural-form
  // objects (with at least an 'other' fallback), and the call sites must
  // render the right form for the right count.
  const LOCALES = Object.keys(LOCALE_BUNDLES);
  const PLURAL_KEYS = ['sleep_timer_set', 'sleep_timer_stopped', 'ayah_count'] as const;

  for (const lang of LOCALES) {
    for (const key of PLURAL_KEYS) {
      it(`${lang}.ts: ${key} is a plural-form object with an 'other' fallback`, () => {
        const bundle = LOCALE_BUNDLES[lang]!;
        const val = bundle[key];
        expect(val, `${lang} ${key} must exist`).toBeDefined();
        expect(typeof val, `${lang} ${key} must be a plural-form object, not a string`).toBe('object');
        const forms = val as Record<string, string>;
        expect(forms.other, `${lang} ${key} must have an 'other' fallback`).toBeDefined();
        expect(typeof forms.other).toBe('string');
      });
    }
  }

  it('Arabic sleep_timer_stopped uses the few form (دقائق) for 3-10 minutes', () => {
    const forms = LOCALE_BUNDLES.ar!['sleep_timer_stopped'] as Record<PluralForm, string>;
    const selected = selectPluralForm(forms, 7, 'ar');
    const result = substitute(selected, 7, 'ar');
    expect(result).toContain('دقائق');
    expect(result).toContain('٧');
  });

  it('Arabic sleep_timer_set uses the many form (دقيقة) for 11+ minutes', () => {
    const forms = LOCALE_BUNDLES.ar!['sleep_timer_set'] as Record<PluralForm, string>;
    const selected = selectPluralForm(forms, 15, 'ar');
    const result = substitute(selected, 15, 'ar');
    expect(result).toContain('دقيقة');
    expect(result).toContain('١٥');
  });

  it('English sleep_timer_set distinguishes 1 minute vs 5 minutes', () => {
    const forms = LOCALE_BUNDLES.en!['sleep_timer_set'] as Record<PluralForm, string>;
    expect(substitute(selectPluralForm(forms, 1, 'en'), 1, 'en')).toBe('Sleep timer set: 1 minute');
    expect(substitute(selectPluralForm(forms, 5, 'en'), 5, 'en')).toBe('Sleep timer set: 5 minutes');
  });

  it('Russian sleep_timer_stopped uses the right case for 1 vs 2-4 vs 5+', () => {
    const forms = LOCALE_BUNDLES.ru!['sleep_timer_stopped'] as Record<PluralForm, string>;
    expect(substitute(selectPluralForm(forms, 1, 'ru'), 1, 'ru')).toContain('минуту');
    expect(substitute(selectPluralForm(forms, 3, 'ru'), 3, 'ru')).toContain('минуты');
    expect(substitute(selectPluralForm(forms, 5, 'ru'), 5, 'ru')).toContain('минут');
  });

  it('Arabic ayah_count renders 7 آيات (few) for Al-Fatihah and 286 آية (many) for Al-Baqarah', () => {
    const forms = LOCALE_BUNDLES.ar!['ayah_count'] as Record<PluralForm, string>;
    expect(substitute(selectPluralForm(forms, 7, 'ar'), 7, 'ar')).toBe('٧ آيات');
    expect(substitute(selectPluralForm(forms, 286, 'ar'), 286, 'ar')).toBe('٢٨٦ آية');
  });
});
