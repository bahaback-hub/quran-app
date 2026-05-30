import { describe, it, expect } from 'vitest';
import { CONFIG, PRAYER_NAMES_AR, PRAYER_ORDER, ARABIC_WEEKDAYS, JUZ_PAGES, TRANSLATION_EDITIONS } from '../config.js';

describe('CONFIG', () => {
  it('should have API_BASE', () => {
    expect(CONFIG.API_BASE).toBeTruthy();
  });

  it('should have SURAH_COUNT of 114', () => {
    expect(CONFIG.SURAH_COUNT).toBe(114);
  });

  it('should have STORAGE_PREFIX', () => {
    expect(CONFIG.STORAGE_PREFIX).toBeTruthy();
  });

  it('should have DEFAULT_RECITER', () => {
    expect(CONFIG.DEFAULT_RECITER).toBeTruthy();
  });
});

describe('PRAYER_NAMES_AR', () => {
  it('should have 6 prayer names', () => {
    expect(Object.keys(PRAYER_NAMES_AR).length).toBe(6);
  });
});

describe('PRAYER_ORDER', () => {
  it('should have 5 prayers', () => {
    expect(PRAYER_ORDER.length).toBe(5);
  });

  it('should start with Fajr', () => {
    expect(PRAYER_ORDER[0]).toBe('Fajr');
  });
});

describe('ARABIC_WEEKDAYS', () => {
  it('should have 7 days', () => {
    expect(ARABIC_WEEKDAYS.length).toBe(7);
  });
});

describe('JUZ_PAGES', () => {
  it('should have 30 entries', () => {
    expect(JUZ_PAGES.length).toBe(30);
  });

  it('should start with page 1', () => {
    expect(JUZ_PAGES[0]).toBe(1);
  });
});

describe('TRANSLATION_EDITIONS', () => {
  it('should have at least 3 editions', () => {
    expect(Object.keys(TRANSLATION_EDITIONS).length).toBeGreaterThanOrEqual(3);
  });

  it('should have Sahih International', () => {
    expect(TRANSLATION_EDITIONS['en.sahih']).toBeTruthy();
    expect(TRANSLATION_EDITIONS['en.sahih'].name).toBe('Sahih International');
  });
});
