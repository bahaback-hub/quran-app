import { describe, it, expect, beforeEach } from 'vitest';
import { calculateQibla } from '../prayer.js';

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
