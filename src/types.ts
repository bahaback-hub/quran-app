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
  englishNameTranslation?: string;
  numberOfAyahs?: number;
  revelationType?: string;
  ayahs: AyahEntry[];
}

/* ===================== API RESPONSE TYPES ===================== */

/** Standard AlQuran.cloud API response wrapper. */
export interface QuranApiResponse<T> {
  code: number;
  status: string;
  data: T;
}

/** Surah list response from AlQuran.cloud. */
export interface SurahListResponse {
  code: number;
  status: string;
  data: SurahData[];
}

/** Prayer times response from Aladhan API. */
export interface AladhanTimingsResponse {
  code: number;
  status: string;
  data: {
    timings: Record<string, string>;
    date: {
      hijri: { date: string; day: string; month: { number: number; en: string; ar: string }; year: string };
      readable: string;
      gregorian: { date: string; day: string; month: { number: number; en: string }; year: string };
    };
    meta: { method: { id: number; name: string } };
  };
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
      exitApp?: () => void;
    };
  };
}

/**
 * Type guard: check if a value is valid SurahData.
 * Validates required fields: number (number), name (string), englishName (string), ayahs (array).
 *
 * @param value The value to check
 * @returns True if value is a valid SurahData object
 */
export function isSurahData(value: unknown): value is SurahData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['number'] === 'number' &&
    typeof obj['name'] === 'string' &&
    typeof obj['englishName'] === 'string' &&
    Array.isArray(obj['ayahs'])
  );
}

/**
 * Type guard: check if a value is a valid PrayerTimes object.
 * Validates that Fajr and Maghrib fields are strings.
 *
 * @param value The value to check
 * @returns True if value has Fajr and Maghrib as strings
 */
export function isPrayerTimes(value: unknown): value is Record<string, string | undefined> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj['Fajr'] === 'string' && typeof obj['Maghrib'] === 'string';
}

/**
 * Type guard: check if a value is a non-null object with specific keys.
 * Useful for validating API response shapes at runtime.
 *
 * @typeParam K - The keys to check for
 * @param value The value to check
 * @param keys The keys that must exist on the object
 * @returns True if value is an object containing all specified keys
 */
export function hasKeys<K extends string>(value: unknown, ...keys: K[]): value is Record<K, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return keys.every((key) => key in obj);
}

/* ===================== CAPACITOR UTILITIES ===================== */

/**
 * Safely access the Capacitor global object.
 * Checks both globalThis and window for the Capacitor namespace.
 *
 * @returns The Capacitor global object, or undefined if not running on Capacitor
 */
export function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof globalThis !== 'undefined' && 'Capacitor' in globalThis) {
    return (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  }
  if (typeof window !== 'undefined' && 'Capacitor' in window) {
    return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  }
  return undefined;
}

/**
 * Check if the app is running on a Capacitor native platform (Android/iOS).
 * Uses isNativePlatform() method if available, falls back to isNative flag.
 *
 * @returns True if running as a native Capacitor app
 */
export function isCapacitorNative(): boolean {
  const cap = getCapacitor();
  if (!cap) {
    return false;
  }
  if (typeof cap.isNativePlatform === 'function') {
    return cap.isNativePlatform();
  }
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

/**
 * Check if currently in fullscreen mode.
 * Handles both standard and webkit-prefixed fullscreen APIs.
 *
 * @returns True if any element is currently in fullscreen
 */
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

/* ===================== PRAYER TIMES ===================== */

/** Prayer times from Aladhan API. */
export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  Imsak?: string;
  Midnight?: string;
  [key: string]: string | undefined; // Allow additional prayer names
}

/* ===================== ADHKAR ===================== */

/** Settings for a single adhkar category (toggle, time, duration). */
export interface AdhkarCategorySettings {
  enabled: boolean;
  time: string;
  duration: number;
}

/** A personal adhkar entry created by the user. */
export interface PersonalAdhkarEntry {
  id: string;
  text: string;
  count: number;
  time: string | null;
  duration: number;
}

/** The full adhkar settings object stored in state. */
export interface AdhkarSettings {
  adhkar_enabled: boolean;
  adhkar_sound: boolean;
  _resetDate: string;
  personal_adhkar: PersonalAdhkarEntry[];
  [key: string]: unknown;
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
    exitApp?: () => void;
  };
  SplashScreen?: {
    hide?: (opts?: { fadeOutDuration?: number }) => void;
  };
}
