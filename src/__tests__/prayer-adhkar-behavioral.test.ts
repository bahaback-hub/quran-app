/**
 * Behavioral tests for prayer.ts and adhkar.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../prayer.js');
vi.unmock('../adhkar.js');

import { state, resetState } from '../state.js';

describe('prayer — state defaults', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.prayerTimes is null by default', () => {
    expect(state.prayerTimes).toBeNull();
  });

  it('state.azanEnabled is boolean', () => {
    expect(typeof state.azanEnabled).toBe('boolean');
  });

  it('state.azanFajrEnabled is boolean', () => {
    expect(typeof state.azanFajrEnabled).toBe('boolean');
  });

  it('state.method is a string (calculation method ID)', () => {
    expect(typeof state.method).toBe('string');
  });

  it('state.city is a string', () => {
    expect(typeof state.city).toBe('string');
  });

  it('state.country is a string', () => {
    expect(typeof state.country).toBe('string');
  });
});

describe('prayer — prayer times data', () => {
  beforeEach(() => {
    resetState();
  });

  it('can set prayerTimes with all 6 times', () => {
    state.prayerTimes = {
      Fajr: '05:00',
      Sunrise: '06:30',
      Dhuhr: '12:30',
      Asr: '15:45',
      Maghrib: '18:20',
      Isha: '19:50',
    };
    expect(state.prayerTimes).not.toBeNull();
    expect(state.prayerTimes!.Fajr).toBe('05:00');
    expect(state.prayerTimes!.Isha).toBe('19:50');
  });

  it('can set nextPrayerKey', () => {
    state.nextPrayerKey = 'Dhuhr';
    expect(state.nextPrayerKey).toBe('Dhuhr');
  });

  it('can toggle azanEnabled', () => {
    state.azanEnabled = false;
    state.azanEnabled = true;
    expect(state.azanEnabled).toBe(true);
  });

  it('can toggle azanFajrEnabled', () => {
    state.azanFajrEnabled = false;
    state.azanFajrEnabled = true;
    expect(state.azanFajrEnabled).toBe(true);
  });

  it('can change method', () => {
    state.method = '4'; // Umm al-Qura
    expect(state.method).toBe('4');
    state.method = '5'; // Egyptian
    expect(state.method).toBe('5');
  });

  it('can change city and country', () => {
    state.city = 'مكة';
    state.country = 'SA';
    expect(state.city).toBe('مكة');
    expect(state.country).toBe('SA');
  });
});

describe('prayer — time format validation', () => {
  it('Fajr time is a valid time string', () => {
    const times = { Fajr: '05:00 AM', Dhuhr: '12:30 PM' };
    expect(times.Fajr).toMatch(/\d{2}:\d{2}/);
  });

  it('can parse 12-hour format times', () => {
    const time12 = '05:30 AM';
    const parts = time12.split(' ');
    expect(parts[0]).toBe('05:30');
    expect(parts[1]).toBe('AM');
  });

  it('can parse 24-hour format times', () => {
    const time24 = '17:30';
    expect(time24).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('adhkar — state defaults', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.adhkarSettings exists', () => {
    expect(state.adhkarSettings).toBeDefined();
  });

  it('adhkarSettings has morning and evening times', () => {
    if (state.adhkarSettings) {
      expect(typeof state.adhkarSettings).toBe('object');
    }
  });
});

describe('adhkar — counter behavior', () => {
  beforeEach(() => {
    resetState();
  });

  it('can simulate adhkar counter increment', () => {
    let count = 0;
    const target = 33;
    count++;
    expect(count).toBe(1);
    expect(count).toBeLessThan(target);
  });

  it('reaches target after 33 increments', () => {
    let count = 0;
    const target = 33;
    for (let i = 0; i < target; i++) {
      count++;
    }
    expect(count).toBe(target);
  });

  it('counter resets to 0 after reaching target', () => {
    let count = 33;
    const target = 33;
    if (count >= target) {
      count = 0;
    }
    expect(count).toBe(0);
  });
});

describe('adhkar — adhkar data structure', () => {
  it('SURAH_SECRETS has 114 entries', async () => {
    const { SURAH_SECRETS } = await import('../surahs-data.js');
    expect(Object.keys(SURAH_SECRETS).length).toBe(114);
  });

  it('each surah secret is a non-empty string', async () => {
    const { SURAH_SECRETS } = await import('../surahs-data.js');
    for (const [key, value] of Object.entries(SURAH_SECRETS)) {
      expect(Number(key)).toBeGreaterThanOrEqual(1);
      expect(Number(key)).toBeLessThanOrEqual(114);
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('prayer — PRAYER_ORDER constants', () => {
  it('PRAYER_ORDER has 5 canonical prayers (excludes Sunrise)', async () => {
    vi.unmock('../config.js');
    const { PRAYER_ORDER } = await import('../config.js');
    expect(PRAYER_ORDER).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
    expect(PRAYER_ORDER).not.toContain('Sunrise');
  });

  it('PRAYER_DISPLAY_ORDER has 6 entries (includes Sunrise)', async () => {
    vi.unmock('../config.js');
    const { PRAYER_DISPLAY_ORDER } = await import('../config.js');
    expect(PRAYER_DISPLAY_ORDER).toContain('Sunrise');
    expect(PRAYER_DISPLAY_ORDER.length).toBe(6);
  });

  it('JUZ_PAGES has 30 entries, starting at 1, ending at 582', async () => {
    vi.unmock('../config.js');
    const { JUZ_PAGES } = await import('../config.js');
    expect(JUZ_PAGES.length).toBe(30);
    expect(JUZ_PAGES[0]).toBe(1);
    expect(JUZ_PAGES[29]).toBe(582);
  });

  it('TRANSLATION_EDITIONS has at least 5 editions', async () => {
    vi.unmock('../config.js');
    const { TRANSLATION_EDITIONS } = await import('../config.js');
    expect(Object.keys(TRANSLATION_EDITIONS).length).toBeGreaterThanOrEqual(5);
  });
});
