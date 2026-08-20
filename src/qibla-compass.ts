import { registerPlugin } from '@capacitor/core';

export type QiblaCompassAccuracy = 'high' | 'medium' | 'low' | 'unreliable';

interface QiblaCompassStartOptions {
  latitude: number;
  longitude: number;
  altitude?: number;
}

interface HeadingChangeEvent {
  heading: number;
  magneticHeading: number;
  declination: number;
  accuracy: QiblaCompassAccuracy;
  isReliable: boolean;
}

interface AccuracyChangeEvent {
  accuracy: QiblaCompassAccuracy;
  isReliable: boolean;
}

interface QiblaCompassPlugin {
  start(options: QiblaCompassStartOptions): Promise<{ source: string; declination: number }>;
  stop(): Promise<void>;
  addListener(
    eventName: 'headingChange',
    listenerFunc: (event: HeadingChangeEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'accuracyChange',
    listenerFunc: (event: AccuracyChangeEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const NativeQiblaCompass = registerPlugin<QiblaCompassPlugin>('QiblaCompass');

export interface NativeQiblaCompassCallbacks {
  onHeading: (event: HeadingChangeEvent) => void;
  onAccuracy: (event: AccuracyChangeEvent) => void;
}

/** Start the Android true-north stream and return one cleanup function. */
export async function startNativeQiblaCompass(
  options: QiblaCompassStartOptions,
  callbacks: NativeQiblaCompassCallbacks,
): Promise<() => Promise<void>> {
  const headingHandle = await NativeQiblaCompass.addListener('headingChange', callbacks.onHeading);
  const accuracyHandle = await NativeQiblaCompass.addListener('accuracyChange', callbacks.onAccuracy);

  try {
    await NativeQiblaCompass.start(options);
  } catch (error) {
    await headingHandle.remove();
    await accuracyHandle.remove();
    throw error;
  }

  return async () => {
    await Promise.allSettled([headingHandle.remove(), accuracyHandle.remove(), NativeQiblaCompass.stop()]);
  };
}
