/**
 * Static coverage for surahs-data.ts — v8 coverage in Vitest 5 does not
 * always track dynamic-import re-exports, so we add a static-import test
 * that exercises the SURAH_SECRETS top-level constant and guards its
 * structural contract.
 */
import { describe, it, expect } from 'vitest';
import { SURAH_SECRETS } from '../surahs-data.js';

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
});
