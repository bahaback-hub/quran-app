/**
 * API Fallback — local JSON caching for offline/degraded operation.
 *
 * When external APIs (AlQuran.cloud, Aladhan, mp3quran.net) are
 * unreachable or return malformed data, this module provides local
 * fallbacks from the bundled JSON files in public/data/:
 *
 *   - surah-list.json       — 114 surah metadata entries
 *   - quran-uthmani.json    — full Quran text (all 114 surahs, Uthmani)
 *   - muyassar-tafsir.json  — Tafsir Al-Muyassar (Arabic)
 *   - tajweed.json          — Tajweed annotation data
 *   - translations/en.sahih.json — Sahih International English translation
 *     (all 114 surahs), fetched verbatim from the same AlQuran.cloud endpoint
 *     the app uses at runtime
 *
 * The fallbacks are loaded via jsonFetch('data/...') which uses the
 * same safeFetch infrastructure (timeout, retry, dedup) as remote
 * API calls. Because these files are bundled with the app (PWA
 * precaches them), they are always available — even fully offline
 * after the first visit.
 *
 * Usage pattern (in surah-loader.ts, tafsir.ts, etc.):
 *   try {
 *     const data = await apiFetch(`https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`);
 *     return data;
 *   } catch (e) {
 *     return await loadLocalSurahText(n);  // fallback
 *   }
 */

import { jsonFetch } from './api-client.js';
import type { SurahData, AyahEntry } from './types.js';
import type { SurahInfo } from './state.js';

/** Local surah text data shape (matches AlQuran.cloud response). */
interface LocalQuranData {
  data: {
    surahs: Array<{
      number: number;
      name: string;
      englishName: string;
      englishNameTranslation?: string;
      revelationType?: string;
      numberOfAyahs: number;
      ayahs: Array<{
        number: number;
        text: string;
        numberInSurah: number;
        juz?: number;
        page?: number;
        sajda?: boolean | { id: number; recommended: boolean };
        audio?: string;
      }>;
    }>;
  };
}

/** Cache for the full local Quran text (loaded once, reused). */
let _localQuranCache: LocalQuranData | null = null;

/**
 * Load the full local Quran text from public/data/quran-uthmani.json.
 * The result is cached so subsequent calls are instant.
 *
 * @returns The full local Quran data, or null if the file could not be loaded.
 */
async function loadLocalQuran(): Promise<LocalQuranData | null> {
  if (_localQuranCache) {
    return _localQuranCache;
  }
  try {
    const data = (await jsonFetch('data/quran-uthmani.json', {
      silent: true,
      timeout: 10000,
    })) as LocalQuranData;
    // Accept any non-empty surahs array — the bundled file has 114, but
    // we don't hard-fail on a different count (allows partial fallbacks).
    if (data?.data?.surahs?.length && data.data.surahs.length > 0) {
      _localQuranCache = data;
      return data;
    }
  } catch {
    /* local file not available — should not happen in production */
  }
  return null;
}

/**
 * Fallback: load a single surah's text from the local bundled JSON.
 * Use this when the remote AlQuran.cloud API is unreachable.
 *
 * @param surahNum Surah number (1..114)
 * @returns SurahData with ayahs, or null if not found locally
 */
export async function loadLocalSurahText(surahNum: number): Promise<SurahData | null> {
  const quran = await loadLocalQuran();
  if (!quran) {
    return null;
  }
  const surah = quran.data.surahs.find((s) => s.number === surahNum);
  if (!surah) {
    return null;
  }
  // Guard against a partially-corrupt local bundle: a surah without a valid
  // ayahs array cannot be adapted and would break the offline reader.
  if (!Array.isArray(surah.ayahs) || surah.ayahs.length === 0) {
    return null;
  }
  // Adapt the local shape to match the SurahData interface expected by the app
  const ayahs: AyahEntry[] = surah.ayahs.map((a) => ({
    number: a.number,
    text: a.text,
    numberInSurah: a.numberInSurah,
    juz: a.juz,
    page: a.page,
    sajda: a.sajda,
    audio: a.audio,
  }));
  return {
    number: surah.number,
    name: surah.name,
    englishName: surah.englishName,
    englishNameTranslation: surah.englishNameTranslation ?? '',
    revelationType: surah.revelationType ?? 'Meccan',
    numberOfAyahs: surah.numberOfAyahs,
    ayahs,
  } as SurahData;
}

/**
 * Fallback: load the surah list from the local bundled JSON.
 * Use this when the remote AlQuran.cloud /surah endpoint is unreachable.
 *
 * @returns Array of 114 SurahInfo entries, or null if not found locally
 */
export async function loadLocalSurahList(): Promise<SurahInfo[] | null> {
  try {
    const data = (await jsonFetch('data/surah-list.json', {
      silent: true,
      timeout: 10000,
    })) as SurahInfo[];
    if (data && data.length === 114) {
      return data;
    }
  } catch {
    /* local file not available */
  }
  return null;
}

/**
 * Fallback: load Tafsir Al-Muyassar for a surah from the local bundled JSON.
 * Use this when the remote Tafsir API (jsDelivr) is unreachable.
 *
 * The local file contains tafsir for all ayahs of all surahs in a single
 * JSON object keyed by `${surahNum}:${ayahNum}`.
 *
 * @param surahNum Surah number (1..114)
 * @returns A map of ayahNum → tafsir text, or null if not found locally
 */
export async function loadLocalTafsirMuyassar(surahNum: number): Promise<Record<number, string> | null> {
  try {
    const data = (await jsonFetch('data/muyassar-tafsir.json', {
      silent: true,
      timeout: 10000,
    })) as Record<string, string>;
    if (!data || typeof data !== 'object') {
      return null;
    }
    // Filter entries matching the requested surah
    const result: Record<number, string> = {};
    const prefix = `${surahNum}:`;
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(prefix)) {
        const ayahNum = parseInt(key.split(':')[1] ?? '0', 10);
        if (ayahNum > 0 && typeof value === 'string') {
          result[ayahNum] = value;
        }
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Translation editions with a bundled full-Quran file.
 *
 * Only editions listed here can be served without any network. An edition that
 * is not listed has no local file, and asking for it returns null rather than
 * guessing — serving another edition's text under the wrong name would be worse
 * than serving Arabic alone.
 */
const BUNDLED_TRANSLATIONS: Record<string, string> = {
  'en.sahih': 'data/translations/en.sahih.json',
};

/** Shape of one surah inside a bundled full-edition translation file. */
interface LocalTranslationSurah {
  number: number;
  name: string;
  englishName: string;
  ayahs: Array<{ number: number; text: string; numberInSurah: number }>;
}

/** Cache for bundled translation files, one entry per edition. */
const _localTranslationCache = new Map<string, LocalTranslationSurah[]>();

/**
 * Fallback: load one surah's translation from a local bundled file.
 * Use this when the remote AlQuran.cloud edition endpoint is unreachable.
 *
 * The returned shape matches the `.data` of an AlQuran.cloud
 * `/surah/{n}/{edition}` response, so callers use it exactly like the API
 * result — no special-casing at the call site.
 *
 * @param surahNum Surah number (1..114)
 * @param edition Translation edition id, e.g. 'en.sahih'
 * @returns The surah's translation data, or null when the edition has no
 *   bundled file, the surah is missing, or any ayah text is empty
 */
export async function loadLocalTranslation(
  surahNum: number,
  edition: string,
): Promise<{
  number: number;
  name: string;
  englishName: string;
  ayahs: Array<{ number: number; text: string; numberInSurah: number }>;
} | null> {
  const path = BUNDLED_TRANSLATIONS[edition];
  if (!path) {
    return null;
  }
  try {
    let surahs = _localTranslationCache.get(edition);
    if (!surahs) {
      const data = (await jsonFetch(path, {
        silent: true,
        timeout: 10000,
      })) as { data?: { surahs?: LocalTranslationSurah[] } };
      surahs = data?.data?.surahs;
      if (!Array.isArray(surahs) || surahs.length === 0) {
        return null;
      }
      _localTranslationCache.set(edition, surahs);
    }
    const surah = surahs.find((s) => s.number === surahNum);
    if (!surah || !Array.isArray(surah.ayahs) || surah.ayahs.length === 0) {
      return null;
    }
    // Every ayah must carry real text. A partially-present translation would
    // render some verses translated and others blank with no explanation, so a
    // gap anywhere in the surah disqualifies the whole surah.
    const ayahs = surah.ayahs.map((a) => ({
      number: a.number,
      text: typeof a.text === 'string' ? a.text : '',
      numberInSurah: a.numberInSurah,
    }));
    if (ayahs.some((a) => a.text.trim().length === 0)) {
      return null;
    }
    return {
      number: surah.number,
      name: surah.name,
      englishName: surah.englishName,
      ayahs,
    };
  } catch {
    /* bundled translation file unreadable — fall through to null, caller renders without translation */
    return null;
  }
}

/**
 * Check if the local fallback files are available.
 * Useful for displaying an "offline mode" indicator to the user.
 *
 * @returns true if the local Quran text file is accessible
 */
export async function isLocalFallbackAvailable(): Promise<boolean> {
  const quran = await loadLocalQuran();
  return quran !== null;
}

/**
 * Clear the local Quran cache. Useful for testing or when the user
 * requests a fresh load (e.g., after a PWA update).
 */
export function clearLocalFallbackCache(): void {
  _localQuranCache = null;
  _localTranslationCache.clear();
}
