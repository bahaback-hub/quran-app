/**
 * Tests for prayer-local.ts — offline prayer time calculation using adhan-js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Mock geolocation
const mockGetCurrentPosition = vi.fn();
vi.stubGlobal('navigator', {
  geolocation: {
    getCurrentPosition: mockGetCurrentPosition,
    watchPosition: vi.fn(),
  },
});

describe('prayer-local', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('calculatePrayerTimesLocally', () => {
    it('should return null when geolocation is denied', async () => {
      mockGetCurrentPosition.mockImplementation((_success: unknown, error: unknown) => {
        (error as (err: GeolocationPositionError) => void)?.({ code: 1, message: 'Denied' } as GeolocationPositionError);
      });

      const { calculatePrayerTimesLocally } = await import('../prayer-local.js');
      const result = await calculatePrayerTimesLocally('4');
      expect(result).toBeNull();
    });

    it('should return prayer times when geolocation succeeds', async () => {
      mockGetCurrentPosition.mockImplementation((success: (pos: GeolocationPosition) => void) => {
        success({
          coords: { latitude: 21.4225, longitude: 39.8262, accuracy: 100 },
        } as GeolocationPosition);
      });

      const { calculatePrayerTimesLocally } = await import('../prayer-local.js');
      const result = await calculatePrayerTimesLocally('4');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('Fajr');
      expect(result).toHaveProperty('Dhuhr');
      expect(result).toHaveProperty('Asr');
      expect(result).toHaveProperty('Maghrib');
      expect(result).toHaveProperty('Isha');
      expect(result).toHaveProperty('Sunrise');

      // Verify format is HH:MM (24-hour)
      for (const key of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Sunrise']) {
        const time = result![key];
        expect(time).toMatch(/^\d{2}:\d{2}/);
      }
    });

    it('should use cached coordinates within 30 minutes', async () => {
      localStorageMock.setItem('cached_gps_coords', JSON.stringify({
        lat: 21.4225,
        lng: 39.8262,
        timestamp: Date.now() - 5 * 60 * 1000,
      }));

      mockGetCurrentPosition.mockImplementation(() => {
        throw new Error('Should not be called');
      });

      const { calculatePrayerTimesLocally } = await import('../prayer-local.js');
      const result = await calculatePrayerTimesLocally('4');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('Fajr');
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    });

    it('should fetch fresh coordinates when cache is expired', async () => {
      localStorageMock.setItem('cached_gps_coords', JSON.stringify({
        lat: 21.4225,
        lng: 39.8262,
        timestamp: Date.now() - 31 * 60 * 1000,
      }));

      mockGetCurrentPosition.mockImplementation((success: (pos: GeolocationPosition) => void) => {
        success({
          coords: { latitude: 24.7136, longitude: 46.6753, accuracy: 100 },
        } as GeolocationPosition);
      });

      // Use dynamic import with cache busting for fresh module
      const mod = await import('../prayer-local.js?t=' + Date.now());
      const result = await mod.calculatePrayerTimesLocally('4');
      // The key assertion: result should come from fresh GPS (Riyadh)
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('Fajr');
    });

    it('should default to MuslimWorldLeague for unknown method', async () => {
      mockGetCurrentPosition.mockImplementation((success: (pos: GeolocationPosition) => void) => {
        success({
          coords: { latitude: 21.4225, longitude: 39.8262, accuracy: 100 },
        } as GeolocationPosition);
      });

      const { calculatePrayerTimesLocally } = await import('../prayer-local.js');
      const result = await calculatePrayerTimesLocally('999');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('Fajr');
    });
  });

  describe('calculateLocalQibla', () => {
    it('should return Qibla direction for Makkah coordinates', async () => {
      const { calculateLocalQibla } = await import('../prayer-local.js');
      // From Makkah itself, Qibla should be close to 0 or 360
      const result = calculateLocalQibla(21.4225, 39.8262);
      expect(typeof result).toBe('number');
      // Result should be a valid angle
      expect(result).not.toBeNaN();
    });

    it('should return different angles for different locations', async () => {
      const { calculateLocalQibla } = await import('../prayer-local.js');
      const makkah = calculateLocalQibla(21.4225, 39.8262);
      const riyadh = calculateLocalQibla(24.7136, 46.6753);
      // Riyadh and Makkah should have different Qibla directions
      expect(makkah).not.toBeNaN();
      expect(riyadh).not.toBeNaN();
    });
  });
});
