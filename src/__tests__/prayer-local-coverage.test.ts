/**
 * Coverage tests for prayer-local.ts — covers all calculation methods,
 * coordinate caching, qibla calculation, and edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock geolocation
const mockGetCurrentPosition = vi.fn();
vi.stubGlobal('navigator', {
  geolocation: {
    getCurrentPosition: mockGetCurrentPosition,
    watchPosition: vi.fn(),
  },
  onLine: true,
});

describe('prayer-local coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculatePrayerTimesLocally — all calculation methods', () => {
    const methods = [
      { id: '1', name: 'Karachi' },
      { id: '2', name: 'ISNA' },
      { id: '3', name: 'MuslimWorldLeague' },
      { id: '4', name: 'UmmAlQura' },
      { id: '5', name: 'Egyptian' },
      { id: '7', name: 'Tehran' },
      { id: '8', name: 'Dubai' },
      { id: '9', name: 'Kuwait' },
      { id: '10', name: 'Qatar' },
      { id: '11', name: 'Singapore' },
      { id: '12', name: 'UOIF (MWL fallback)' },
      { id: '13', name: 'Turkey' },
      { id: '14', name: 'Russia (MWL fallback)' },
      { id: '99', name: 'Custom (MWL fallback)' },
    ];

    for (const method of methods) {
      it(`should calculate prayer times using method ${method.id} (${method.name})`, async () => {
        mockGetCurrentPosition.mockImplementation((success: (pos: GeolocationPosition) => void) => {
          success({
            coords: { latitude: 21.4225, longitude: 39.8262, accuracy: 100 },
          } as GeolocationPosition);
        });

        const { calculatePrayerTimesLocally } = await import('../prayer-local.js');
        const result = await calculatePrayerTimesLocally(method.id);
        expect(result).not.toBeNull();
        expect(result).toHaveProperty('Fajr');
        expect(result).toHaveProperty('Dhuhr');
        expect(result).toHaveProperty('Asr');
        expect(result).toHaveProperty('Maghrib');
        expect(result).toHaveProperty('Isha');
        expect(result).toHaveProperty('Sunrise');
        expect(result).toHaveProperty('Imsak'); // Should include Imsak
      });
    }

    it('should fall back to UmmAlQura for unknown method ID', async () => {
      mockGetCurrentPosition.mockImplementation((success: (pos: GeolocationPosition) => void) => {
        success({
          coords: { latitude: 21.4225, longitude: 39.8262, accuracy: 100 },
        } as GeolocationPosition);
      });

      const { calculatePrayerTimesLocally } = await import('../prayer-local.js');
      const result = await calculatePrayerTimesLocally('unknown');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('Fajr');
    });
  });

  describe('getCoordinates', () => {
    it('should return null when geolocation is unavailable', async () => {
      const origGeo = navigator.geolocation;
      vi.stubGlobal('navigator', { geolocation: undefined });

      const { getCoordinates } = await import('../prayer-local.js?_t=' + Date.now());
      const result = await getCoordinates();
      expect(result).toBeNull();

      vi.stubGlobal('navigator', { geolocation: origGeo });
    });

    it('should return null when geolocation is denied', async () => {
      mockGetCurrentPosition.mockImplementation((_success: unknown, error: unknown) => {
        (error as (err: GeolocationPositionError) => void)?.({ code: 1, message: 'Denied' } as GeolocationPositionError);
      });

      const { getCoordinates } = await import('../prayer-local.js?_t2=' + Date.now());
      const result = await getCoordinates();
      expect(result).toBeNull();
    });

    it('should return null on geolocation timeout', async () => {
      mockGetCurrentPosition.mockImplementation((_success: unknown, _error: unknown) => {
        // Do nothing — simulates timeout
      });

      // Override setTimeout behavior for the 10s timeout
      vi.useFakeTimers();
      const { getCoordinates } = await import('../prayer-local.js?_t3=' + Date.now());
      const promise = getCoordinates();

      // Advance past the 10s timeout
      vi.advanceTimersByTime(11000);
      const result = await promise;
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('should return coordinates when geolocation succeeds', async () => {
      mockGetCurrentPosition.mockImplementation((success: (pos: GeolocationPosition) => void) => {
        success({
          coords: { latitude: 24.7136, longitude: 46.6753, accuracy: 100 },
        } as GeolocationPosition);
      });

      const { getCoordinates } = await import('../prayer-local.js?_t4=' + Date.now());
      const result = await getCoordinates();
      expect(result).not.toBeNull();
      expect(result!.latitude).toBe(24.7136);
      expect(result!.longitude).toBe(46.6753);
    });

    it('should use cached coordinates within TTL', async () => {
      mockGetCurrentPosition.mockImplementation((success: (pos: GeolocationPosition) => void) => {
        success({
          coords: { latitude: 21.4225, longitude: 39.8262, accuracy: 100 },
        } as GeolocationPosition);
      });

      const { getCoordinates } = await import('../prayer-local.js?_t5=' + Date.now());

      // First call — should use GPS
      const first = await getCoordinates();
      expect(first).not.toBeNull();

      // Second call — should use cache (same coordinates)
      const second = await getCoordinates();
      expect(second).not.toBeNull();
      expect(second!.latitude).toBe(first!.latitude);
    });
  });

  describe('calculateLocalQibla', () => {
    it('should return a valid angle for Makkah', async () => {
      const { calculateLocalQibla } = await import('../prayer-local.js');
      const result = calculateLocalQibla(21.4225, 39.8262);
      expect(typeof result).toBe('number');
      expect(result).not.toBeNaN();
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(360);
    });

    it('should return different angles for different locations', async () => {
      const { calculateLocalQibla } = await import('../prayer-local.js');
      const makkah = calculateLocalQibla(21.4225, 39.8262);
      const newYork = calculateLocalQibla(40.7128, -74.006);
      expect(makkah).not.toBe(newYork);
    });

    it('should handle extreme coordinates', async () => {
      const { calculateLocalQibla } = await import('../prayer-local.js');
      const result = calculateLocalQibla(0, 0);
      expect(typeof result).toBe('number');
      expect(result).not.toBeNaN();
    });
  });

  describe('calculatePrayerTimesLocally error handling', () => {
    it('should return null when coordinates are unavailable', async () => {
      // Force no geolocation
      vi.stubGlobal('navigator', {
        geolocation: undefined,
        onLine: true,
      });

      const { calculatePrayerTimesLocally } = await import('../prayer-local.js?_t6=' + Date.now());
      const result = await calculatePrayerTimesLocally('4');
      expect(result).toBeNull();
    });
  });
});
