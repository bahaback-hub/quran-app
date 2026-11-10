// Window extensions (non-standard browser APIs)
interface Window {
  toastTimeout?: ReturnType<typeof setTimeout>;
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
  webkitAudioContext?: typeof AudioContext;
}
interface Navigator {
  connection?: { effectiveType?: string; saveData?: boolean };
  userLanguage?: string;
}

// DOM type widening — querySelector returns Element, but we use HTMLElement properties
interface Element {
  dataset: DOMStringMap;
  style: CSSStyleDeclaration;
}
interface EventTarget {
  result?: unknown;
  tagName?: string;
  blur?(): void;
}

// Build-time app version injected by Vite (see vite.config.js `define`).
// Single source of truth: package.json "version".
declare const __APP_VERSION__: string;

// Capacitor (Android/iOS) — available via <script> tag at runtime
interface Window {
  Capacitor?: {
    Plugins: {
      App: {
        addListener(event: string, callback: () => void): void;
      };
    };
  };
  installPWA?: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

// Ambient declaration for the `magvar` package (NEW-11: WMM2025 magnetic
// declination). The package ships plain JS without bundled TypeScript types;
// its public surface is a single function. MIT-licensed, zero dependencies.
declare module 'magvar' {
  /**
   * Compute the magnetic declination (variation) in degrees at a WGS84
   * location using the World Magnetic Model 2025-2030.
   *
   * Positive = magnetic north is east of true north.
   * Negative = magnetic north is west of true north.
   *
   * @param latitude  WGS84 latitude, degrees (-90 to 90)
   * @param longitude WGS84 longitude, degrees (-180 to 180)
   * @param altitudeKm Altitude above mean sea level, kilometers (optional, default 0)
   * @returns Declination in degrees (finite; the model covers the whole globe)
   */
  export function magvar(latitude: number, longitude: number, altitudeKm?: number): number;
}
