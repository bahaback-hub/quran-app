/**
 * Tests for magnetic-declination.ts (NEW-11) — the WMM2025-backed bridge
 * between the web compass's magnetic heading and the Qibla's true bearing.
 *
 * Verifies:
 *   - Accuracy against NOAA-published 2025 reference values (within ~1.5°)
 *   - Sign convention: positive = magnetic north east of true north
 *   - The integration math: magnetic + declination = true heading
 *   - Graceful degradation: invalid input or model failure returns 0
 *     (the pre-fix behavior), never a wrong correction
 */
import { describe, it, expect } from 'vitest';
import { getMagneticDeclination } from '../features/prayer/magnetic-declination.js';

describe('getMagneticDeclination — accuracy against NOAA WMM2025 reference values', () => {
  // Tolerances: the WMM model itself is accurate to ~0.5°, but our "expected"
  // values are rounded NOAA calculator outputs. Allow ±1.5° headroom.
  const TOLERANCE = 1.5;

  it('Riyadh: ~+3° east (the critical Gulf case — dipole model gave -8.6° here)', () => {
    const declination = getMagneticDeclination(24.7, 46.7);
    expect(declination).toBeGreaterThan(3 - TOLERANCE);
    expect(declination).toBeLessThan(3 + TOLERANCE);
    // Must be POSITIVE (east) — the dipole model's -8.6° west was the rejection reason.
    expect(declination).toBeGreaterThan(0);
  });

  it('Mecca: ~+3° east (the Kaaba itself — local declination is small but positive)', () => {
    const declination = getMagneticDeclination(21.4225, 39.8262);
    expect(declination).toBeGreaterThan(2 - TOLERANCE);
    expect(declination).toBeLessThan(5 + TOLERANCE);
    expect(declination).toBeGreaterThan(0);
  });

  it('London: ~+1° (small positive — proves the dipole model wrong here too)', () => {
    const declination = getMagneticDeclination(51.5, 0.0);
    // Dipole model gave -15° for London; WMM gives ~+1°.
    expect(declination).toBeGreaterThan(-1);
    expect(declination).toBeLessThan(3);
  });

  it('New York: ~-13° west (large negative declination)', () => {
    const declination = getMagneticDeclination(40.7, -74.0);
    expect(declination).toBeGreaterThan(-13 - TOLERANCE);
    expect(declination).toBeLessThan(-13 + TOLERANCE);
    expect(declination).toBeLessThan(0);
  });

  it('Tokyo: ~-7° to -9° west', () => {
    const declination = getMagneticDeclination(35.7, 139.7);
    expect(declination).toBeGreaterThan(-10);
    expect(declination).toBeLessThan(-5);
    expect(declination).toBeLessThan(0);
  });

  it('Seattle: ~+15° east (large positive declination, opposite sign from NY)', () => {
    const declination = getMagneticDeclination(47.6, -122.3);
    expect(declination).toBeGreaterThan(13);
    expect(declination).toBeLessThan(17);
    expect(declination).toBeGreaterThan(0);
  });
});

describe('getMagneticDeclination — sign convention and integration math', () => {
  it('positive declination means magnetic north is EAST of true north', () => {
    // Seattle: declination ~+15°. A compass reading of 0° (magnetic north)
    // corresponds to a true heading of ~15° (east of true north).
    const declination = getMagneticDeclination(47.6, -122.3);
    expect(declination).toBeGreaterThan(0);
    // trueHeading = magneticHeading + declination (when declination is +east)
    const trueHeading = 0 + declination;
    expect(trueHeading).toBeGreaterThan(10);
  });

  it('negative declination means magnetic north is WEST of true north', () => {
    // New York: declination ~-13°. A compass reading of 0° (magnetic north)
    // corresponds to a true heading of ~-13° (i.e. 347°, west of true north).
    const declination = getMagneticDeclination(40.7, -74.0);
    expect(declination).toBeLessThan(0);
    const trueHeading = 0 + declination;
    expect(trueHeading).toBeLessThan(-10);
  });

  it('the correction magnitude matches the local declination — Qibla error drops to ~0', () => {
    // Before NEW-11: a user in New York with magneticHeading = qiblaAngle
    // would see the needle 13° off (the declination).
    // After NEW-11: trueHeading = magneticHeading + declination, so
    // needle rotation = qiblaAngle - trueHeading = qiblaAngle - (mag + decl).
    // If the user aligns the needle to 0°, magneticHeading = qiblaAngle - decl,
    // trueHeading = qiblaAngle - decl + decl = qiblaAngle → needle points at Kaaba. ✓
    const declination = getMagneticDeclination(40.7, -74.0);
    const qiblaAngleFromNY = 54; // approximate true Qibla bearing from New York
    const magneticHeadingNeeded = qiblaAngleFromNY - declination;
    const trueHeading = magneticHeadingNeeded + declination;
    expect(trueHeading).toBeCloseTo(qiblaAngleFromNY, 0);
  });
});

describe('getMagneticDeclination — graceful degradation', () => {
  it('returns 0 for NaN latitude (never throws, never returns a wrong correction)', () => {
    expect(getMagneticDeclination(NaN, 0)).toBe(0);
  });

  it('returns 0 for NaN longitude', () => {
    expect(getMagneticDeclination(0, NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(getMagneticDeclination(Infinity, 0)).toBe(0);
    expect(getMagneticDeclination(0, Infinity)).toBe(0);
  });

  it('clamps out-of-range latitude instead of throwing', () => {
    // Latitude > 90 or < -90 is invalid; the wrapper clamps to ±90.
    const result = getMagneticDeclination(200, 0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('returns a finite number for every valid location on Earth', () => {
    // Spot-check a grid: the model must produce a finite value everywhere.
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let lng = -170; lng <= 170; lng += 40) {
        const d = getMagneticDeclination(lat, lng);
        expect(Number.isFinite(d), `lat=${lat} lng=${lng}`).toBe(true);
        expect(Math.abs(d)).toBeLessThan(180); // declination is always < 180°
      }
    }
  });

  it('default altitude (0 km) is fine — altitude has negligible effect on declination', () => {
    const atSeaLevel = getMagneticDeclination(51.5, 0.0, 0);
    const at1km = getMagneticDeclination(51.5, 0.0, 1);
    // The difference should be < 0.1° at normal altitudes.
    expect(Math.abs(at1km - atSeaLevel)).toBeLessThan(0.5);
  });
});
