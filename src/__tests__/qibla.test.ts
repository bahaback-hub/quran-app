import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const {
  trapFocusMock,
  manageFocusMock,
  restoreFocusMock,
  i18nMock,
  capacitorMock,
  startNativeMock,
  declinationMock,
  geoMock,
} = vi.hoisted(() => ({
  trapFocusMock: vi.fn(() => vi.fn()),
  manageFocusMock: vi.fn(),
  restoreFocusMock: vi.fn(),
  i18nMock: vi.fn((k: string, ...a: string[]) => (a.length ? `${k}:${a.join(',')}` : k)),
  capacitorMock: { getPlatform: vi.fn(() => 'web'), isNativePlatform: vi.fn(() => false) },
  startNativeMock: vi.fn(),
  declinationMock: vi.fn(() => 0),
  geoMock: { requestPermissions: vi.fn(), getCurrentPosition: vi.fn() },
}));

vi.mock('../a11y.js', () => ({
  trapFocus: trapFocusMock,
  manageFocusOnPanelOpen: manageFocusMock,
  restoreFocusOnPanelClose: restoreFocusMock,
}));
vi.mock('../i18n.js', () => ({ __: (...a: any[]) => (i18nMock as any)(...a) }));
vi.mock('@capacitor/core', () => ({ Capacitor: capacitorMock }));
vi.mock('../features/prayer/qibla-compass.js', () => ({
  startNativeQiblaCompass: (...a: any[]) => (startNativeMock as any)(...a),
}));
vi.mock('../features/prayer/magnetic-declination.js', () => ({
  getMagneticDeclination: (...a: any[]) => (declinationMock as any)(...a),
}));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: geoMock }));

import {
  normalizeQiblaAngle,
  circularQiblaDifference,
  getWebQiblaHeading,
  calculateQibla,
  showQiblaCompass,
  hideQiblaCompass,
} from '../features/prayer/qibla.js';

function setupDom() {
  document.body.innerHTML = `
    <div id="qiblaOverlay" class="hidden" style="display:none">
      <div id="qiblaCompass"><div class="qibla-needle"></div></div>
      <div id="qiblaDirection"></div>
      <div id="qiblaAngle"></div>
      <div id="qiblaStatus"></div>
    </div>`;
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

describe('qibla', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDom();
    capacitorMock.getPlatform.mockReturnValue('web');
    capacitorMock.isNativePlatform.mockReturnValue(false);
    declinationMock.mockReturnValue(0);
    (navigator as any).geolocation = {
      getCurrentPosition: vi.fn((ok: any) => ok({ coords: { latitude: 21.4225, longitude: 39.8262, altitude: 0 } })),
    };
    (window as any).DeviceOrientationEvent = class {
      static requestPermission?: any;
    };
    delete (window.DeviceOrientationEvent as any).requestPermission;
  });

  afterEach(() => {
    hideQiblaCompass();
    document.body.innerHTML = '';
  });

  it('normalizes angles and computes circular difference and qibla bearing', () => {
    expect(normalizeQiblaAngle(370)).toBe(10);
    expect(normalizeQiblaAngle(-10)).toBe(350);
    expect(circularQiblaDifference(350, 10)).toBe(20);
    expect(circularQiblaDifference(10, 190)).toBe(180);
    const bearing = calculateQibla(21.4225, 39.8262); // at Kaaba-ish
    expect(Number.isFinite(bearing)).toBe(true);
  });

  it('gets web heading from webkitCompassHeading or absolute alpha', () => {
    expect(getWebQiblaHeading({ webkitCompassHeading: 370 } as any, false)).toBe(10);
    expect(getWebQiblaHeading({ alpha: 90, absolute: true } as any, false)).toBe(270);
    expect(getWebQiblaHeading({ alpha: 90 } as any, true)).toBe(270);
    expect(getWebQiblaHeading({ alpha: 90 } as any, false)).toBeNull();
  });

  it('shows overlay on web, handles orientation events and no-DeviceOrientation fallback', async () => {
    showQiblaCompass();
    await flush();
    const overlay = document.getElementById('qiblaOverlay')!;
    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(document.body.classList.contains('qibla-curtain-active')).toBe(true);

    const ev = new Event('deviceorientationabsolute') as any;
    ev.alpha = 0;
    ev.absolute = true;
    window.dispatchEvent(ev);
    await flush();
    expect(document.getElementById('qiblaStatus')?.textContent).toContain('qibla_compass');

    hideQiblaCompass();
    expect(overlay.classList.contains('hidden')).toBe(true);
    expect(document.body.classList.contains('qibla-curtain-active')).toBe(false);
  });

  it('handles web permission request granted/denied and missing geolocation', async () => {
    (window.DeviceOrientationEvent as any).requestPermission = vi.fn().mockResolvedValue('granted');
    showQiblaCompass();
    await flush();
    expect((window.DeviceOrientationEvent as any).requestPermission).toHaveBeenCalled();

    hideQiblaCompass();
    setupDom();
    (window.DeviceOrientationEvent as any).requestPermission = vi.fn().mockResolvedValue('denied');
    showQiblaCompass();
    await flush();
    expect(document.getElementById('qiblaStatus')?.textContent).toContain('qibla_compass_unavailable');

    hideQiblaCompass();
    setupDom();
    (navigator as any).geolocation = undefined;
    showQiblaCompass();
    await flush();
    expect(document.getElementById('qiblaDirection')?.textContent).toContain('location_not_supported');
  });

  it('handles android native path and geolocation failure', async () => {
    capacitorMock.getPlatform.mockReturnValue('android');
    capacitorMock.isNativePlatform.mockReturnValue(true);
    geoMock.requestPermissions.mockResolvedValue({ location: 'granted' });
    geoMock.getCurrentPosition.mockResolvedValue({ coords: { latitude: 24, longitude: 46, altitude: 10 } });
    startNativeMock.mockResolvedValue(vi.fn().mockResolvedValue(undefined));

    showQiblaCompass();
    await flush();
    expect(startNativeMock).toHaveBeenCalled();

    hideQiblaCompass();
    setupDom();
    startNativeMock.mockRejectedValueOnce(new Error('nope'));
    showQiblaCompass();
    await flush();
    expect(document.getElementById('qiblaStatus')?.textContent).toContain('qibla_compass_unavailable');

    hideQiblaCompass();
    setupDom();
    geoMock.requestPermissions.mockResolvedValue({ location: 'denied' });
    showQiblaCompass();
    await flush();
    expect(document.getElementById('qiblaDirection')?.textContent).toContain('qibla_location_failed');
  });
});
