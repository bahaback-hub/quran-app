import { describe, it, expect, beforeEach } from 'vitest';
import { PRAYER_ORDER, PRAYER_NAMES_AR } from '../config.js';
import { timeStrToMinutes, formatTime12 } from '../utils.js';

function getNextPrayerKey(prayerTimes) {
  if (!prayerTimes) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const key of PRAYER_ORDER) {
    const raw = prayerTimes[key];
    if (!raw) continue;
    if (timeStrToMinutes(raw.split(' ')[0]) > nowMin) return key;
  }
  return 'Fajr';
}

function formatTime12Local(time24) {
  if (!time24) return '—';
  const [h, m] = time24.split(':');
  let hour = parseInt(h, 10);
  const period = hour >= 12 ? 'م' : 'ص';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${period}`;
}

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
  const sampleTimes = {
    Fajr: '05:00',
    Dhuhr: '12:30',
    Asr: '15:45',
    Maghrib: '18:20',
    Isha: '19:50'
  };

  it('should return null for no prayerTimes', () => {
    expect(getNextPrayerKey(null)).toBeNull();
  });

  it('should return a valid prayer key', () => {
    const result = getNextPrayerKey(sampleTimes);
    expect(PRAYER_ORDER).toContain(result);
  });
});

describe('formatTime12Local', () => {
  it('should format morning time', () => {
    expect(formatTime12Local('05:00')).toBe('5:00 ص');
  });

  it('should format afternoon time', () => {
    expect(formatTime12Local('13:30')).toBe('1:30 م');
  });

  it('should handle noon', () => {
    expect(formatTime12Local('12:00')).toBe('12:00 م');
  });

  it('should handle midnight', () => {
    expect(formatTime12Local('00:00')).toBe('12:00 ص');
  });

  it('should return em dash for empty', () => {
    expect(formatTime12Local('')).toBe('—');
    expect(formatTime12Local(null)).toBe('—');
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
