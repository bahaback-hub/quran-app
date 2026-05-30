import { describe, it, expect, beforeEach } from 'vitest';
import { PRAYER_ORDER, PRAYER_NAMES_AR } from '../config.js';
import { timeStrToMinutes, formatTime12 } from '../utils.js';
import { getNextPrayerKey } from '../prayer.js';
import { state } from '../state.js';

describe('PRAYER_ORDER', () => {
  it('should have 5 prayers in order', () => {
    expect(PRAYER_ORDER).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  });
});

describe('PRAYER_NAMES_AR', () => {
  it('should have Arabic names for all prayers', () => {
    expect(PRAYER_NAMES_AR.Fajr).toBe('الفجر');
    expect(PRAYER_NAMES_AR.Dhuhr).toBe('الظهر');
    expect(PRAYER_NAMES_AR.Asr).toBe('العصر');
    expect(PRAYER_NAMES_AR.Maghrib).toBe('المغرب');
    expect(PRAYER_NAMES_AR.Isha).toBe('العشاء');
  });
});

describe('getNextPrayerKey', () => {
  beforeEach(() => {
    state.prayerTimes = null;
  });

  it('should return null for no prayerTimes', () => {
    expect(getNextPrayerKey()).toBeNull();
  });

  it('should return a valid prayer key', () => {
    state.prayerTimes = {
      Fajr: '05:00 AM',
      Dhuhr: '12:30 PM',
      Asr: '03:45 PM',
      Maghrib: '06:20 PM',
      Isha: '07:50 PM'
    };
    const result = getNextPrayerKey();
    expect(PRAYER_ORDER).toContain(result);
  });
});

describe('formatTime12Local', () => {
  it('should format morning time', () => {
    expect(formatTime12('05:00')).toBe('5:00 ص');
  });

  it('should format afternoon time', () => {
    expect(formatTime12('13:30')).toBe('1:30 م');
  });

  it('should handle noon', () => {
    expect(formatTime12('12:00')).toBe('12:00 م');
  });

  it('should handle midnight', () => {
    expect(formatTime12('00:00')).toBe('12:00 ص');
  });

  it('should return em dash for empty', () => {
    expect(formatTime12('')).toBe('—');
    expect(formatTime12(null)).toBe('—');
  });
});

describe('timeStrToMinutes', () => {
  it('should convert time to minutes', () => {
    expect(timeStrToMinutes('01:00')).toBe(60);
    expect(timeStrToMinutes('02:30')).toBe(150);
    expect(timeStrToMinutes('24:00')).toBe(1440);
  });

  it('should return 0 for empty input', () => {
    expect(timeStrToMinutes('')).toBe(0);
    expect(timeStrToMinutes(null)).toBe(0);
  });
});
