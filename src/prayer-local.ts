/**
 * Local Prayer Time Calculation using adhan-js.
 *
 * Provides offline-capable prayer time calculation without depending
 * on the Aladhan API. Falls back gracefully if geolocation is unavailable.
 *
 * This module is used as a primary source by prayer.ts — if local calculation
 * succeeds, no API call is needed. If it fails (e.g., no GPS), the API is used.
 */

import { CalculationMethod, Coordinates, PrayerTimes as AdhanPrayerTimes, Qibla } from 'adhan';
import type { CalculationParameters } from 'adhan';
import type { PrayerTimes } from './types.js';

/* ===================== METHOD MAPPING ===================== */

/**
 * Map Aladhan API method IDs to adhan-js CalculationMethod functions.
 *
 * Aladhan method IDs:
 *   1 = University of Islamic Sciences, Karachi
 *   2 = Islamic Society of North America (ISNA)
 *   3 = Muslim World League
 *   4 = Umm Al-Qura University, Makkah
 *   5 = Egyptian General Authority of Survey
 *   7 = Institute of Geophysics, University of Tehran
 *   8 = Gulf Region (same as Dubai in adhan)
 *   9 = Kuwait
 *  10 = Qatar
 *  11 = Majlis Ugama Islam Singapura
 *  12 = UOIF (France) — falls back to MuslimWorldLeague
 *  13 = Diyanet İşleri Başkanlığı (Turkey)
 *  14 = Spiritual Administration of Muslims of Russia — falls back to MWL
 *  99 = Custom — falls back to MWL
 */
const METHOD_MAP: Record<string, () => CalculationParameters> = {
  '1': () => CalculationMethod.Karachi(),
  '2': () => CalculationMethod.NorthAmerica(),
  '3': () => CalculationMethod.MuslimWorldLeague(),
  '4': () => CalculationMethod.UmmAlQura(),
  '5': () => CalculationMethod.Egyptian(),
  '7': () => CalculationMethod.Tehran(),
  '8': () => CalculationMethod.Dubai(),
  '9': () => CalculationMethod.Kuwait(),
  '10': () => CalculationMethod.Qatar(),
  '11': () => CalculationMethod.Singapore(),
  '12': () => CalculationMethod.MuslimWorldLeague(),
  '13': () => CalculationMethod.Turkey(),
  '14': () => CalculationMethod.MuslimWorldLeague(),
  '99': () => CalculationMethod.MuslimWorldLeague(),
};

/** Get calculation parameters for a given Aladhan method ID. */
function getCalcParams(methodId: string): CalculationParameters {
  const factory = METHOD_MAP[methodId];
  if (factory) {
    return factory();
  }
  // Default to Umm Al Qura (method 4) if unknown
  return CalculationMethod.UmmAlQura();
}

/* ===================== COORDINATE CACHE ===================== */

/** Cached geolocation coordinates to avoid repeated GPS requests. */
interface CachedCoords {
  latitude: number;
  longitude: number;
  timestamp: number;
}

let _cachedCoords: CachedCoords | null = null;
const COORDS_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get the user's current GPS coordinates.
 * Uses cached coordinates if available and fresh (< 30 min).
 *
 * @returns Coordinates or null if geolocation is unavailable/denied.
 */
export function getCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  // Return cached coordinates if fresh
  if (_cachedCoords && Date.now() - _cachedCoords.timestamp < COORDS_TTL) {
    return Promise.resolve({ latitude: _cachedCoords.latitude, longitude: _cachedCoords.longitude });
  }

  if (!navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(null), 10000); // 10s timeout

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeoutId);
        _cachedCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: Date.now(),
        };
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        clearTimeout(timeoutId);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: COORDS_TTL },
    );
  });
}

/* ===================== LOCAL CALCULATION ===================== */

/**
 * Calculate prayer times locally using adhan-js.
 *
 * Requires geolocation coordinates. Returns times in HH:MM format
 * compatible with the Aladhan API response format (without timezone suffix).
 *
 * @param methodId - Aladhan calculation method ID (e.g., "4" for Umm Al Qura)
 * @returns PrayerTimes object or null if coordinates unavailable
 */
export async function calculatePrayerTimesLocally(methodId: string): Promise<PrayerTimes | null> {
  const coords = await getCoordinates();
  if (!coords) {
    return null;
  }

  try {
    const coordinates = new Coordinates(coords.latitude, coords.longitude);
    const date = new Date();
    const params = getCalcParams(methodId);

    const prayerTimes = new AdhanPrayerTimes(coordinates, date, params);

    // Format times as HH:MM (matching Aladhan API format without timezone suffix)
    const result: PrayerTimes = {
      Fajr: formatAdhanTime(prayerTimes.fajr),
      Sunrise: formatAdhanTime(prayerTimes.sunrise),
      Dhuhr: formatAdhanTime(prayerTimes.dhuhr),
      Asr: formatAdhanTime(prayerTimes.asr),
      Maghrib: formatAdhanTime(prayerTimes.maghrib),
      Isha: formatAdhanTime(prayerTimes.isha),
    };

    // Add optional fields if available
    if (prayerTimes.isha) {
      // Calculate Imsak (10 minutes before Fajr)
      const imsakTime = new Date(prayerTimes.fajr.getTime() - 10 * 60 * 1000);
      result.Imsak = formatAdhanTime(imsakTime);
    }

    return result;
  } catch (error) {
    console.warn('[Prayer-Local] Calculation failed:', error);
    return null;
  }
}

/**
 * Format a Date object to HH:MM string.
 * Matches the Aladhan API time format (24-hour, zero-padded).
 */
function formatAdhanTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Calculate Qibla direction locally using adhan-js.
 * Returns the same result as the existing calculateQibla() in prayer.ts
 * but uses the adhan library's implementation.
 *
 * @param latitude - User's latitude
 * @param longitude - User's longitude
 * @returns Qibla direction in degrees from North
 */
export function calculateLocalQibla(latitude: number, longitude: number): number {
  const coords = new Coordinates(latitude, longitude);
  return Qibla(coords);
}
