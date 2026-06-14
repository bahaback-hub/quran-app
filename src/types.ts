/**
 * Shared TypeScript types and interfaces for the Quran App.
 *
 * Centralizing these types eliminates `as any` casts across modules
 * and provides compile-time safety when accessing surah data, page layouts,
 * and other shared structures.
 */

/* ===================== SURAH DATA ===================== */

/** A single ayah entry within surah data (from AlQuran.cloud API). */
export interface AyahEntry {
  numberInSurah: number;
  text: string;
  number?: number;
  audio?: string;
}

/** Full surah data returned from the API and stored in state.surahData. */
export interface SurahData {
  number: number;
  name: string;
  englishName: string;
  ayahs: AyahEntry[];
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
}

/* ===================== CAPACITOR ===================== */

/** Capacitor global interface for native platform detection. */
export interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  isNative?: boolean;
  Plugins?: {
    SplashScreen?: {
      hide?: (opts?: { fadeOutDuration?: number }) => void;
    };
    App?: {
      addListener?: (event: string, callback: () => void) => void;
    };
  };
}

/** Type guard: check if a value is valid SurahData. */
export function isSurahData(value: unknown): value is SurahData {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.number === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.englishName === 'string' &&
    Array.isArray(obj.ayahs)
  );
}

/* ===================== CAPACITOR UTILITIES ===================== */

/** Safely access the Capacitor global object. Returns undefined if not available. */
export function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof globalThis !== 'undefined' && 'Capacitor' in globalThis) {
    return (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  }
  if (typeof window !== 'undefined' && 'Capacitor' in window) {
    return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  }
  return undefined;
}

/** Check if the app is running on a Capacitor native platform. */
export function isCapacitorNative(): boolean {
  const cap = getCapacitor();
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
  return cap.isNative === true;
}

/* ===================== DOM UTILITIES ===================== */

/**
 * Get the current fullscreen element, including webkit-prefixed fallback.
 * Handles cross-browser compatibility for Safari/iOS.
 */
export function getFullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as WebkitDocument).webkitFullscreenElement ?? null;
}

/**
 * Request fullscreen on an element, with webkit prefix fallback.
 */
export async function requestFullscreen(element: Element): Promise<void> {
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  }
  const webkitEl = element as WebkitElement;
  if (webkitEl.webkitRequestFullscreen) {
    return webkitEl.webkitRequestFullscreen();
  }
  throw new Error('Fullscreen API not supported');
}

/**
 * Exit fullscreen, with webkit prefix fallback.
 */
export async function exitFullscreen(): Promise<void> {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  }
  const webkitDoc = document as WebkitDocument;
  if (webkitDoc.webkitExitFullscreen) {
    return webkitDoc.webkitExitFullscreen();
  }
  throw new Error('Fullscreen API not supported');
}

/** Check if currently in fullscreen mode. */
export function isFullscreen(): boolean {
  return !!getFullscreenElement();
}

/* ===================== WEBKIT TYPE AUGMENTATIONS ===================== */

/** Webkit-prefixed Document properties (Safari/iOS compatibility). */
export interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

/** Webkit-prefixed Element properties (Safari/iOS compatibility). */
export interface WebkitElement extends Element {
  webkitRequestFullscreen?: () => Promise<void>;
}

/** Webkit-prefixed DeviceOrientationEvent constructor. */
export interface WebkitDeviceOrientationEvent extends Event {
  requestPermission?: () => Promise<string>;
}

/* ===================== MISC TYPE HELPERS ===================== */

/** Shape of surah data as used in presentation module. */
export interface SurahDataLike {
  number: number;
  name: string;
  englishName: string;
  ayahs: { numberInSurah: number; number: number; audio: string; text: string }[];
}

/** Shape of translation data as used in presentation module. */
export interface TranslationDataLike {
  ayahs: { numberInSurah: number; text: string }[];
}

/** Reciter entry shape used across modules. */
export interface ReciterEntry {
  id: string;
  name: string;
  server?: string;
  rewayah?: string;
}

/** Capacitor plugins interface for native back button handling. */
export interface CapacitorPlugins {
  App?: {
    addListener?: (event: string, callback: () => void) => void;
  };
  SplashScreen?: {
    hide?: (opts?: { fadeOutDuration?: number }) => void;
  };
}
