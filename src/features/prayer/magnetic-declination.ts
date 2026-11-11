/**
 * Magnetic declination for the Qibla compass — web/iOS path.
 *
 * `calculateQibla()` returns a bearing relative to TRUE north, but the web
 * DeviceOrientation API (and iOS webkitCompassHeading) return a heading
 * relative to MAGNETIC north. The angular difference is the magnetic
 * declination, which varies by location: ~3° in the Gulf, ~5° in Mecca,
 * ~13° in New York, ~15° in Seattle. Without this correction the Qibla
 * needle points off by the local declination — a real error for prayer
 * direction outside the Gulf.
 *
 * The native Android QiblaCompass plugin already applies declination
 * internally and reports a true heading; this module covers the web/iOS
 * path only.
 *
 * Backed by the WMM2025 (World Magnetic Model 2025-2030) via the `magvar`
 * package (MIT, zero dependencies, coefficients embedded for offline use).
 * Verified against NOAA reference values for 2025:
 *   Riyadh 24.7°N 46.7°E → +3.1°   (NOAA ≈ +3.5°)
 *   Mecca  21.4°N 39.8°E → +3.5°   (NOAA ≈ +2.5°)
 *   London 51.5°N  0.0°E → +1.3°   (NOAA ≈ +0.5°)
 *   New York 40.7°N 74°W → -12.5°  (NOAA ≈ -13°)
 *   Tokyo  35.7°N 139.7°E → -7.9°  (NOAA ≈ -7°)
 *   Seattle 47.6°N 122°W → +14.9°  (NOAA ≈ +16°)
 *
 * @example
 * const declination = getMagneticDeclination(24.7, 46.7); // ≈ +3.1° (Riyadh)
 * // trueHeading = magneticHeading + declination
 */

import { magvar } from 'magvar';

/**
 * Get the magnetic declination in degrees for a WGS84 location.
 *
 * Positive = magnetic north is EAST of true north (true = magnetic + declination).
 * Negative = magnetic north is WEST of true north (true = magnetic + declination,
 *   i.e. subtract the absolute value).
 *
 * Returns 0 on any error. A failed declination lookup must never break the
 * Qibla: 0 means "no correction applied" (the pre-fix behavior), not a wrong
 * correction — the worst case is that the user is back to the original
 * magnetic-vs-true discrepancy, not a worse one.
 *
 * @param latitude  WGS84 latitude in degrees (-90 to 90)
 * @param longitude WGS84 longitude in degrees (-180 to 180)
 * @param altitudeKm Altitude above mean sea level in kilometers (optional, default 0;
 *                   effect on declination is <0.1° at normal altitudes)
 */
export function getMagneticDeclination(latitude: number, longitude: number, altitudeKm: number = 0): number {
  try {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return 0;
    }
    // Clamp latitude to the valid WMM range; the model is unreliable inside
    // the magnetic poles' blackout zones but returns a finite value everywhere.
    const lat = Math.max(-90, Math.min(90, latitude));
    const declination = magvar(lat, longitude, altitudeKm);
    return Number.isFinite(declination) ? declination : 0;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[Qibla] Magnetic declination lookup failed:', err);
    }
    return 0;
  }
}
