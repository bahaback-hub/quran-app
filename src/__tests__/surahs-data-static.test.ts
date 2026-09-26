/**
 * Static coverage for surahs-data.ts — v8 coverage in Vitest 5 does not
 * always track dynamic-import re-exports, so we add a static-import test
 * that exercises both SURAH_SECRETS and SURAH_SECRETS_AUTH_KEYS top-level
 * constants and guards their structural contract.
 */
import { describe, it, expect } from 'vitest';
import { SURAH_SECRETS, SURAH_SECRETS_AUTH_KEYS } from '../surahs-data.js';

describe('surahs-data — static exports', () => {
  it('SURAH_SECRETS is a Record<number, string> with 114 entries', () => {
    expect(SURAH_SECRETS).toBeTypeOf('object');
    expect(Object.keys(SURAH_SECRETS).length).toBe(114);
    for (const [key, value] of Object.entries(SURAH_SECRETS)) {
      expect(Number(key)).toBeGreaterThanOrEqual(1);
      expect(Number(key)).toBeLessThanOrEqual(114);
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('SURAH_SECRETS_AUTH_KEYS is a Record<number, string[]> mirroring SURAH_SECRETS keys', () => {
    expect(SURAH_SECRETS_AUTH_KEYS).toBeTypeOf('object');
    const secretKeys = new Set(Object.keys(SURAH_SECRETS));
    const authKeys = Object.keys(SURAH_SECRETS_AUTH_KEYS);
    expect(authKeys.length).toBeGreaterThanOrEqual(0);
    for (const key of authKeys) {
      expect(secretKeys.has(key)).toBe(true);
      expect(Array.isArray(SURAH_SECRETS_AUTH_KEYS[Number(key)])).toBe(true);
      for (const v of SURAH_SECRETS_AUTH_KEYS[Number(key)]) {
        expect(typeof v).toBe('string');
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });
});
