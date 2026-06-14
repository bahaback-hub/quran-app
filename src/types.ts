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
