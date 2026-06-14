import { describe, it, expect } from 'vitest';
import { RECITERS, getReciterById, padSurah, buildAudioUrl, hasTimingApi, getTimingApiId, getReciterDisplayName } from '../reciters.js';
import type { Reciter } from '../reciters.js';

describe('RECITERS', () => {
  it('should have at least 10 reciters', () => {
    expect(RECITERS.length).toBeGreaterThanOrEqual(10);
  });

  it('should have api and mp3quran sources', () => {
    const sources = RECITERS.map((r) => r.source);
    expect(sources).toContain('api');
    expect(sources).toContain('mp3quran');
  });

  it('should have i18n keys as name values', () => {
    for (const r of RECITERS) {
      expect(r.name).toMatch(/^reciter_/);
    }
  });
});

describe('getReciterById', () => {
  it('should return reciter by id and resolve display name', () => {
    const r = getReciterById('ar.alafasy');
    expect(r.name).toBe('reciter_alafasy');
    // Resolve display name via i18n (may fall back to key in test env)
    const displayName = getReciterDisplayName(r);
    expect(displayName).toBeTruthy();
  });

  it('should return first reciter for unknown id', () => {
    const r = getReciterById('unknown');
    expect(r.id).toBe(RECITERS[0].id);
  });
});

describe('padSurah', () => {
  it('should pad to 3 digits', () => {
    expect(padSurah(1)).toBe('001');
    expect(padSurah(114)).toBe('114');
    expect(padSurah(42)).toBe('042');
  });
});

describe('buildAudioUrl', () => {
  it('should build mp3quran url', () => {
    const reciter = { source: 'mp3quran' as const, server: 'https://server7.mp3quran.net/s_gmd', id: 'test', name: 'test' };
    const url = buildAudioUrl(reciter, 1);
    expect(url).toBe('https://server7.mp3quran.net/s_gmd/001.mp3');
  });

  it('should return null for api source', () => {
    const reciter = { source: 'api' as const, id: 'test', name: 'test' };
    expect(buildAudioUrl(reciter, 1)).toBeNull();
  });
});

describe('hasTimingApi', () => {
  it('should return true for reciters with timing', () => {
    expect(hasTimingApi('s_gmd')).toBe(true);
  });

  it('should return false for reciters without timing', () => {
    expect(hasTimingApi('ar.alafasy')).toBe(false);
  });
});

describe('getTimingApiId', () => {
  it('should return correct id', () => {
    expect(getTimingApiId('s_gmd')).toBe(13);
  });

  it('should return null for unknown', () => {
    expect(getTimingApiId('unknown')).toBeNull();
  });
});
