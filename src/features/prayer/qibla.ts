/**
 * Qibla compass — web/Capacitor orientation handling for the Qibla overlay.
 * Extracted from prayer.ts; the names keep the same public surface (re-exported
 * by prayer.ts for backwards compatibility at call sites).
 */
import { trapFocus, manageFocusOnPanelOpen, restoreFocusOnPanelClose } from '../../a11y.js';
import { __ } from '../../i18n.js';
import { Capacitor } from '@capacitor/core';
import { startNativeQiblaCompass } from './qibla-compass.js';
import { Geolocation } from '@capacitor/geolocation';

/** DeviceOrientationEvent with iOS-specific webkitCompassHeading. */
interface DeviceOrientationEventiOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

interface QiblaCoordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
}

/* ===================== QIBLA COMPASS ===================== */

/** Stored reference to the deviceorientation handler so it can be removed. */
let _qiblaOrientationHandler: ((ev: DeviceOrientationEvent) => void) | null = null;
let _stopNativeQiblaCompass: (() => Promise<void>) | null = null;
const QIBLA_ORIENTATION_EVENTS = ['deviceorientationabsolute', 'deviceorientation'] as const;

/** Keep headings in the conventional 0°–359.999° clockwise-from-north range. */
export function normalizeQiblaAngle(angle: number): number {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/** Return the smallest angular separation, preserving the 359° → 0° wraparound. */
export function circularQiblaDifference(first: number, second: number): number {
  const difference = Math.abs(normalizeQiblaAngle(first) - normalizeQiblaAngle(second));
  return difference > 180 ? 360 - difference : difference;
}

/**
 * Derive a usable web heading only from an explicit compass value or absolute
 * orientation. Android's raw alpha runs counter to conventional compass
 * heading, hence the 360 - alpha conversion used by mature web compasses.
 */
export function getWebQiblaHeading(event: DeviceOrientationEventiOS, isAbsoluteEvent: boolean = false): number | null {
  if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading)) {
    return normalizeQiblaAngle(event.webkitCompassHeading);
  }
  if ((event.absolute === true || isAbsoluteEvent) && typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
    const screenAngle = window.screen?.orientation?.angle ?? 0;
    return normalizeQiblaAngle(360 - event.alpha + screenAngle);
  }
  return null;
}

function removeQiblaSources(): void {
  if (_qiblaOrientationHandler) {
    for (const eventName of QIBLA_ORIENTATION_EVENTS) {
      window.removeEventListener(eventName, _qiblaOrientationHandler);
    }
    _qiblaOrientationHandler = null;
  }
  if (_stopNativeQiblaCompass) {
    void _stopNativeQiblaCompass().catch((error: unknown) =>
      console.warn('[Qibla] Native compass stop failed:', error),
    );
    _stopNativeQiblaCompass = null;
  }
}

/** Calculate Qibla direction from a given latitude/longitude. */
export function calculateQibla(lat: number, lng: number): number {
  const kaabaLat = (21.4225 * Math.PI) / 180;
  const kaabaLng = (39.8262 * Math.PI) / 180;
  const userLat = (lat * Math.PI) / 180;
  const userLng = (lng * Math.PI) / 180;
  const dLng = kaabaLng - userLng;
  const y = Math.sin(dLng);
  const x = Math.cos(userLat) * Math.tan(kaabaLat) - Math.sin(userLat) * Math.cos(dLng);
  return normalizeQiblaAngle((Math.atan2(y, x) * 180) / Math.PI);
}

/** Request coordinates through Capacitor's native Android permission flow. */
async function getNativeQiblaCoordinates(): Promise<QiblaCoordinates> {
  const permissions = await Geolocation.requestPermissions({ permissions: ['location'] });
  if (permissions.location !== 'granted') {
    throw new Error('Location permission was not granted');
  }
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    enableLocationFallback: true,
    timeout: 20_000,
    maximumAge: 60_000,
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude ?? 0,
  };
}

/** Cleanup for the focus trap installed while the Qibla overlay is open. */
let _qiblaTrapCleanup: (() => void) | null = null;

/** Show the Qibla compass overlay. */
export function showQiblaCompass(): void {
  const overlay = document.getElementById('qiblaOverlay');
  if (!overlay) {
    return;
  }
  overlay.classList.remove('hidden');
  overlay.style.display = 'flex';
  document.body.classList.add('qibla-curtain-active');
  // Confine Tab + TV-remote focus inside the overlay (same pattern as panels).
  const trigger = document.activeElement as HTMLElement | undefined;
  _qiblaTrapCleanup?.();
  _qiblaTrapCleanup = trapFocus(overlay);
  manageFocusOnPanelOpen(overlay, trigger);

  const compass = document.getElementById('qiblaCompass');
  const needle = compass?.querySelector<HTMLElement>('.qibla-needle') || null;
  const direction = document.getElementById('qiblaDirection');
  const angleDisplay = document.getElementById('qiblaAngle');
  const status = document.getElementById('qiblaStatus');

  const applyCoordinates = ({ latitude, longitude, altitude = 0 }: QiblaCoordinates): void => {
    const qiblaAngle = calculateQibla(latitude, longitude);

    const setNeedle = (heading: number): void => {
      if (needle) {
        needle.style.transform = `translateX(-50%) rotate(${normalizeQiblaAngle(qiblaAngle - heading)}deg)`;
      }
    };
    const showStaticBearing = (message: string): void => {
      setNeedle(0);
      if (status) {
        status.textContent = message;
      }
    };

    // Keep the North/East/South/West dial fixed. Only rotate the needle so it
    // points to the Kaaba rather than making the full compass look northbound.
    if (compass) {
      compass.style.transform = '';
    }
    setNeedle(0);
    if (angleDisplay) {
      angleDisplay.textContent = `${Math.round(qiblaAngle)}°`;
    }

    removeQiblaSources();

    const handleOrientation = (e: DeviceOrientationEventiOS): void => {
      const heading = getWebQiblaHeading(e, e.type === 'deviceorientationabsolute');
      if (heading === null) {
        showStaticBearing(__('qibla_static_mode'));
        return;
      }
      setNeedle(heading);
      if (status) {
        const iOSAccuracy = e.webkitCompassAccuracy;
        status.textContent =
          typeof iOSAccuracy === 'number' && iOSAccuracy > 20
            ? __('qibla_calibration_required')
            : __('qibla_compass_active');
      }
    };

    if (direction) {
      const dirs = [
        __('prayer_dirs'),
        __('prayer_dirs_ne'),
        __('prayer_dirs_e'),
        __('prayer_dirs_se'),
        __('prayer_dirs_s'),
        __('prayer_dirs_sw'),
        __('prayer_dirs_w'),
        __('prayer_dirs_nw'),
      ];
      const idx = Math.round(qiblaAngle / 45) % 8;
      direction.textContent = `${__('qibla_direction', dirs[idx]!, String(Math.round(qiblaAngle)))}`;
    }

    if (Capacitor.getPlatform() === 'android') {
      if (status) {
        status.textContent = __('qibla_compass_starting');
      }
      void startNativeQiblaCompass(
        { latitude, longitude, altitude },
        {
          onHeading: ({ heading, isReliable }) => {
            setNeedle(heading);
            if (status) {
              status.textContent = isReliable ? __('qibla_compass_active') : __('qibla_calibration_required');
            }
          },
          onAccuracy: ({ isReliable }) => {
            if (status) {
              status.textContent = isReliable ? __('qibla_compass_active') : __('qibla_calibration_required');
            }
          },
        },
      )
        .then((stop) => {
          _stopNativeQiblaCompass = stop;
        })
        .catch((error: unknown) => {
          console.warn('[Qibla] Native compass could not start:', error);
          showStaticBearing(__('qibla_compass_unavailable'));
        });
      return;
    }

    if (!window.DeviceOrientationEvent) {
      showStaticBearing(__('qibla_static_mode'));
      return;
    }

    _qiblaOrientationHandler = handleOrientation as (ev: DeviceOrientationEvent) => void;
    const DOE = DeviceOrientationEvent as unknown as import('../../types.js').WebkitDeviceOrientationEvent;
    if (typeof DOE.requestPermission === 'function') {
      void DOE.requestPermission()
        .then((permState: string) => {
          if (permState === 'granted') {
            for (const eventName of QIBLA_ORIENTATION_EVENTS) {
              window.addEventListener(eventName, _qiblaOrientationHandler!);
            }
            if (status) {
              status.textContent = __('qibla_compass_starting');
            }
          } else {
            showStaticBearing(__('qibla_compass_unavailable'));
          }
        })
        .catch(() => showStaticBearing(__('qibla_compass_unavailable')));
    } else {
      for (const eventName of QIBLA_ORIENTATION_EVENTS) {
        window.addEventListener(eventName, _qiblaOrientationHandler);
      }
      if (status) {
        status.textContent = __('qibla_compass_starting');
      }
    }
  };
  const showLocationFailure = (error: unknown): void => {
    console.warn('[Qibla] Unable to get location:', error);
    if (direction) {
      direction.textContent = __('qibla_location_failed');
    }
    if (status) {
      status.textContent = '';
    }
  };

  if (Capacitor.isNativePlatform()) {
    void getNativeQiblaCoordinates().then(applyCoordinates).catch(showLocationFailure);
    return;
  }
  if (!navigator.geolocation) {
    if (direction) {
      direction.textContent = __('location_not_supported');
    }
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) =>
      applyCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude ?? 0,
      }),
    showLocationFailure,
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
  );
}

/** Hide the Qibla compass overlay and remove the orientation listener. */
export function hideQiblaCompass(): void {
  const overlay = document.getElementById('qiblaOverlay');
  _qiblaTrapCleanup?.();
  _qiblaTrapCleanup = null;
  if (overlay) {
    restoreFocusOnPanelClose(undefined, overlay);
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
  }
  document.body.classList.remove('qibla-curtain-active');
  removeQiblaSources();
}
