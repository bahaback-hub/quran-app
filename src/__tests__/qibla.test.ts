import { describe, it, expect } from 'vitest';
import { calculateQibla, circularQiblaDifference, getWebQiblaHeading, normalizeQiblaAngle } from '../prayer.js';

describe('calculateQibla', () => {
  it('should return ~0° for Mecca (from Mecca)', () => {
    const angle = calculateQibla(21.4225, 39.8262);
    expect(angle).toBeCloseTo(0, 0);
  });

  it('should return ~180° for location north of Mecca', () => {
    const angle = calculateQibla(40, 39.8262);
    expect(angle).toBeGreaterThan(150);
    expect(angle).toBeLessThan(210);
  });

  it('should return a value between 0 and 360', () => {
    const angle = calculateQibla(48.8566, 2.3522);
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThanOrEqual(360);
  });

  it('should handle southern hemisphere', () => {
    const angle = calculateQibla(-33.8688, 151.2093);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(360);
  });
});

describe('Qibla heading normalization', () => {
  it('normalizes negative and overflowing angles', () => {
    expect(normalizeQiblaAngle(-10)).toBe(350);
    expect(normalizeQiblaAngle(725)).toBe(5);
  });

  it('keeps the shortest difference across the north wraparound', () => {
    expect(circularQiblaDifference(359, 1)).toBe(2);
    expect(circularQiblaDifference(90, 270)).toBe(180);
  });

  it('prefers the explicit iOS compass heading', () => {
    const heading = getWebQiblaHeading({ webkitCompassHeading: 90 } as DeviceOrientationEvent);
    expect(heading).toBe(90);
  });

  it('converts absolute Android alpha to conventional clockwise compass heading', () => {
    const heading = getWebQiblaHeading({ alpha: 90, absolute: true } as DeviceOrientationEvent);
    expect(heading).toBe(270);
  });

  it('refuses alpha when the browser cannot assert an earth-referenced frame', () => {
    const heading = getWebQiblaHeading({ alpha: 90, absolute: false } as DeviceOrientationEvent);
    expect(heading).toBeNull();
  });
});
