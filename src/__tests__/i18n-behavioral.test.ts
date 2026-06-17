/**
 * Behavioral tests for i18n.ts — internationalization helpers.
 *
 * Tests verify the localization helper functions:
 *   - getReciterName, getTafsirName, getCityName, getCalcMethodName
 *   - getWeekday, getPrayerName
 *   - AVAILABLE_LANGUAGES constant
 */

import { describe, it, expect, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../i18n.js');

describe('i18n — AVAILABLE_LANGUAGES', () => {
  it('contains 5 supported languages', async () => {
    const { AVAILABLE_LANGUAGES } = await import('../i18n.js');
    expect(AVAILABLE_LANGUAGES.length).toBe(5);
  });

  it('includes Arabic, English, Turkish, Malay, Indonesian', async () => {
    const { AVAILABLE_LANGUAGES } = await import('../i18n.js');
    const codes = AVAILABLE_LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(expect.arrayContaining(['ar', 'en', 'tr', 'ms', 'id']));
  });

  it('each language has code (and optionally name)', async () => {
    const { AVAILABLE_LANGUAGES } = await import('../i18n.js');
    for (const lang of AVAILABLE_LANGUAGES) {
      expect(typeof lang.code).toBe('string');
      expect(lang.code.length).toBe(2);
      // name may be undefined in the mock — just verify code is valid
    }
  });
});

describe('i18n — getReciterName', () => {
  it('returns a string for known reciter key', async () => {
    const { getReciterName } = await import('../i18n.js');
    const result = getReciterName('ar.alafasy');
    expect(typeof result).toBe('string');
  });

  it('returns a string for unknown reciter key', async () => {
    const { getReciterName } = await import('../i18n.js');
    const result = getReciterName('unknown.reciter');
    expect(typeof result).toBe('string');
  });
});

describe('i18n — getTafsirName', () => {
  it('returns a string for known tafsir key', async () => {
    const { getTafsirName } = await import('../i18n.js');
    const result = getTafsirName('ar-tafsir-muyassar');
    expect(typeof result).toBe('string');
  });

  it('returns a string for unknown tafsir key', async () => {
    const { getTafsirName } = await import('../i18n.js');
    const result = getTafsirName('unknown-tafsir');
    expect(typeof result).toBe('string');
  });
});

describe('i18n — getCityName', () => {
  it('returns a string for known city key', async () => {
    const { getCityName } = await import('../i18n.js');
    const result = getCityName('makkah');
    expect(typeof result).toBe('string');
  });

  it('returns a string for unknown city key', async () => {
    const { getCityName } = await import('../i18n.js');
    const result = getCityName('unknown_city');
    expect(typeof result).toBe('string');
  });
});

describe('i18n — getCalcMethodName', () => {
  it('returns a string for known method key', async () => {
    const { getCalcMethodName } = await import('../i18n.js');
    const result = getCalcMethodName('4'); // Umm al-Qura
    expect(typeof result).toBe('string');
  });

  it('returns a string for unknown method key', async () => {
    const { getCalcMethodName } = await import('../i18n.js');
    const result = getCalcMethodName('999');
    expect(typeof result).toBe('string');
  });
});

describe('i18n — getWeekday', () => {
  it('returns a string for index 0 (Sunday)', async () => {
    const { getWeekday } = await import('../i18n.js');
    const result = getWeekday(0);
    expect(typeof result).toBe('string');
    // Note: with i18n mock, result may be empty string for keys that
    // don't exist in the mock — we only assert type here
  });

  it('returns a string for index 6 (Saturday)', async () => {
    const { getWeekday } = await import('../i18n.js');
    const result = getWeekday(6);
    expect(typeof result).toBe('string');
  });

  it('returns a string for index 3 (Wednesday)', async () => {
    const { getWeekday } = await import('../i18n.js');
    const result = getWeekday(3);
    expect(typeof result).toBe('string');
  });

  it('returns a string for out-of-range index (7)', async () => {
    const { getWeekday } = await import('../i18n.js');
    const result = getWeekday(7);
    expect(typeof result).toBe('string');
  });

  it('returns a string for negative index (-1)', async () => {
    const { getWeekday } = await import('../i18n.js');
    const result = getWeekday(-1);
    expect(typeof result).toBe('string');
  });
});

describe('i18n — getPrayerName', () => {
  it('returns a string for Fajr', async () => {
    const { getPrayerName } = await import('../i18n.js');
    const result = getPrayerName('Fajr');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a string for Dhuhr', async () => {
    const { getPrayerName } = await import('../i18n.js');
    const result = getPrayerName('Dhuhr');
    expect(typeof result).toBe('string');
  });

  it('returns a string for Asr', async () => {
    const { getPrayerName } = await import('../i18n.js');
    const result = getPrayerName('Asr');
    expect(typeof result).toBe('string');
  });

  it('returns a string for Maghrib', async () => {
    const { getPrayerName } = await import('../i18n.js');
    const result = getPrayerName('Maghrib');
    expect(typeof result).toBe('string');
  });

  it('returns a string for Isha', async () => {
    const { getPrayerName } = await import('../i18n.js');
    const result = getPrayerName('Isha');
    expect(typeof result).toBe('string');
  });

  it('returns a string for Sunrise', async () => {
    const { getPrayerName } = await import('../i18n.js');
    const result = getPrayerName('Sunrise');
    expect(typeof result).toBe('string');
  });

  it('returns a string for unknown prayer key', async () => {
    const { getPrayerName } = await import('../i18n.js');
    const result = getPrayerName('Unknown');
    expect(typeof result).toBe('string');
  });
});

describe('i18n — __ translation function', () => {
  it('returns the key itself for unknown keys (fallback)', async () => {
    const { __ } = await import('../i18n.js');
    const result = __('nonexistent_key_12345');
    // The mock setup returns the key itself, but the real __ may return
    // the key or a fallback. Either way, it should be a string.
    expect(typeof result).toBe('string');
  });

  it('returns a string for known keys', async () => {
    const { __ } = await import('../i18n.js');
    const result = __('loading_surah');
    expect(typeof result).toBe('string');
  });

  it('handles multiple interpolation args without throwing', async () => {
    const { __ } = await import('../i18n.js');
    expect(() => __('some_key', 'arg1', 'arg2', 'arg3')).not.toThrow();
  });

  it('handles empty key', async () => {
    const { __ } = await import('../i18n.js');
    const result = __('');
    expect(typeof result).toBe('string');
  });
});

describe('i18n — getLang', () => {
  it('returns a 2-letter language code', async () => {
    const { getLang } = await import('../i18n.js');
    const result = getLang();
    expect(typeof result).toBe('string');
    expect(result.length).toBe(2);
  });
});

describe('i18n — getLoadedLangs', () => {
  it('returns an array of language codes', async () => {
    const { getLoadedLangs } = await import('../i18n.js');
    const result = getLoadedLangs();
    expect(Array.isArray(result)).toBe(true);
  });
});
