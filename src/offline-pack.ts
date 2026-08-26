/**
 * Offline Pack — One-tap "Download Everything for Offline Use" feature.
 *
 * Coordinates downloading all data needed for full offline operation:
 *   1. Full Quran text (Uthmani script)
 *   2. All available translations (5)
 *   3. Tafsir Al-Muyassar (already bundled locally)
 *   4. Tajweed rules data
 *   5. Optionally: audio for a chosen reciter (uses existing audio-cache.ts)
 */

import { CONFIG } from './config.js';
import { cacheSurahAudio, isSurahCached } from './audio-cache.js';
import { cacheExternalData } from './external-data-cache.js';
import { buildAudioUrl, getReciterById } from './reciters.js';

/* ===================== TYPES ===================== */

export interface OfflinePackProgress {
  phase: 'quran' | 'translations' | 'tafsir' | 'tajweed' | 'audio' | 'done';
  percent: number;
  message: string;
  completed: number;
  total: number;
}

export interface DownloadOfflinePackOptions {
  onProgress?: (progress: OfflinePackProgress) => void;
  reciterId?: string;
  audioSurahCount?: number;
  translationEditions?: string[];
}

export interface OfflinePackResult {
  success: boolean;
  succeeded: number;
  failed: number;
  errors: string[];
  totalBytes: number;
  elapsedMs: number;
}

export interface OfflinePackStatus {
  installed: boolean;
  installedAt: string | null;
  itemCount: number;
  sizeBytes: number;
  reciterId: string | null;
}

/* ===================== CONSTANTS ===================== */

const OFFLINE_PACK_KEY = 'offline_pack_status';
const OFFLINE_AUDIO_URLS_KEY = 'offline_pack_audio_urls';

const DEFAULT_TRANSLATIONS = ['en.sahih', 'en.pickthall', 'en.yusufali', 'fr.hamidullah', 'ur.jalandhry'];

const FETCH_TIMEOUT_MS = 30_000;
const TAJWEED_CACHE_NAME = 'app-data-v2';

interface AudioEditionResponse {
  data?: {
    ayahs?: Array<{ audio?: string }>;
  };
}

/* ===================== STATUS MANAGEMENT ===================== */

export function getOfflinePackStatus(): OfflinePackStatus {
  try {
    const raw = localStorage.getItem(OFFLINE_PACK_KEY);
    if (!raw) {
      return {
        installed: false,
        installedAt: null,
        itemCount: 0,
        sizeBytes: 0,
        reciterId: null,
      };
    }
    return JSON.parse(raw) as OfflinePackStatus;
  } catch {
    return {
      installed: false,
      installedAt: null,
      itemCount: 0,
      sizeBytes: 0,
      reciterId: null,
    };
  }
}

function saveOfflinePackStatus(status: OfflinePackStatus): void {
  try {
    localStorage.setItem(OFFLINE_PACK_KEY, JSON.stringify(status));
  } catch (e) {
    console.warn('[offline-pack] Failed to save status:', e);
  }
}

export function clearOfflinePackStatus(): void {
  localStorage.removeItem(OFFLINE_PACK_KEY);
}

type OfflineAudioUrls = Record<string, Record<string, string[]>>;

function saveOfflineAudioUrls(reciterId: string, surahNum: number, urls: string[]): void {
  try {
    const saved = JSON.parse(localStorage.getItem(OFFLINE_AUDIO_URLS_KEY) || '{}') as OfflineAudioUrls;
    const byReciter = saved[reciterId] || {};
    byReciter[String(surahNum)] = urls;
    saved[reciterId] = byReciter;
    localStorage.setItem(OFFLINE_AUDIO_URLS_KEY, JSON.stringify(saved));
  } catch {
    // Metadata is only written after audio persistence succeeds; a later download can restore it.
  }
}

/** Return verified audio URLs from a downloaded offline pack for one reciter and surah. */
export function getOfflinePackAudioUrls(reciterId: string, surahNum: number): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(OFFLINE_AUDIO_URLS_KEY) || '{}') as OfflineAudioUrls;
    const urls = saved[reciterId]?.[String(surahNum)];
    return Array.isArray(urls) ? urls.filter((url): url is string => typeof url === 'string' && url.length > 0) : [];
  } catch {
    return [];
  }
}

/* ===================== INTERNAL FETCH ===================== */

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Store same-origin JSON in Cache Storage for the tajweed loader's offline fallback. */
async function cacheLocalJson(url: string, data: unknown): Promise<void> {
  if (!('caches' in globalThis)) {
    throw new Error('Cache Storage is unavailable');
  }
  const cache = await caches.open(TAJWEED_CACHE_NAME);
  await cache.put(url, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
  if (!(await cache.match(url))) {
    throw new Error(`Failed to persist ${url}`);
  }
}

/** Return the exact audio URLs used by the normal reader for one surah. */
async function getSurahAudioUrls(reciterId: string, surahNum: number): Promise<string[]> {
  const reciter = getReciterById(reciterId);
  const fullSurahUrl = buildAudioUrl(reciter, surahNum);
  if (fullSurahUrl) {
    return [fullSurahUrl];
  }

  const response = await fetchWithTimeout(`${CONFIG.API_BASE}/surah/${surahNum}/${reciter.id}`);
  if (!response.ok) {
    throw new Error(`Audio surah ${surahNum}: HTTP ${response.status}`);
  }
  const data = (await response.json()) as AudioEditionResponse;
  const urls =
    data.data?.ayahs
      ?.map((ayah) => ayah.audio)
      .filter((url): url is string => typeof url === 'string' && url.length > 0) || [];
  if (!urls.length) {
    throw new Error(`Audio surah ${surahNum}: no playable URLs`);
  }
  return urls;
}

/* ===================== DOWNLOAD ORCHESTRATION ===================== */

export async function downloadOfflinePack(options: DownloadOfflinePackOptions = {}): Promise<OfflinePackResult> {
  const startTime = Date.now();
  const { onProgress, reciterId, audioSurahCount = 0, translationEditions = DEFAULT_TRANSLATIONS } = options;

  const errors: string[] = [];
  let succeeded = 0;
  let failed = 0;
  let totalBytes = 0;

  onProgress?.({
    phase: 'quran',
    percent: 0,
    message: 'تحميل نص القرآن الكريم...',
    completed: 0,
    total: 1,
  });

  try {
    const url = `${CONFIG.API_BASE}/quran/quran-uthmani`;
    const response = await fetchWithTimeout(url);
    if (response.ok) {
      const data = await response.json();
      if (!(await cacheExternalData(url, data))) {
        throw new Error('Quran text could not be persisted');
      }
      totalBytes += JSON.stringify(data).length;
      succeeded++;
    } else {
      failed++;
      errors.push(`Quran text: HTTP ${response.status}`);
    }
  } catch (e) {
    failed++;
    errors.push(`Quran text: ${(e as Error).message}`);
  }

  onProgress?.({
    phase: 'quran',
    percent: 20,
    message: 'تم تحميل نص القرآن',
    completed: 1,
    total: 1,
  });

  for (let i = 0; i < translationEditions.length; i++) {
    const edition = translationEditions[i]!;
    onProgress?.({
      phase: 'translations',
      percent: 20 + Math.round(((i + 1) / translationEditions.length) * 30),
      message: `تحميل الترجمة: ${edition}`,
      completed: i,
      total: translationEditions.length,
    });

    try {
      const url = `${CONFIG.API_BASE}/quran/${edition}`;
      const response = await fetchWithTimeout(url);
      if (response.ok) {
        const data = await response.json();
        if (!(await cacheExternalData(url, data))) {
          throw new Error(`Translation ${edition} could not be persisted`);
        }
        totalBytes += JSON.stringify(data).length;
        succeeded++;
      } else {
        failed++;
        errors.push(`Translation ${edition}: HTTP ${response.status}`);
      }
    } catch (e) {
      failed++;
      errors.push(`Translation ${edition}: ${(e as Error).message}`);
    }
  }

  onProgress?.({
    phase: 'tajweed',
    percent: 55,
    message: 'بيانات التجويد...',
    completed: 0,
    total: 1,
  });

  try {
    const manifestResponse = await fetchWithTimeout('/data/tajweed/manifest.json');
    if (manifestResponse.ok) {
      const manifest = (await manifestResponse.json()) as { files?: string[] };
      await cacheLocalJson('/data/tajweed/manifest.json', manifest);
      const files = manifest.files || [];
      for (const [index, file] of files.entries()) {
        const url = `/data/tajweed/${file}`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) {
          throw new Error(`Tajweed ${file}: HTTP ${response.status}`);
        }
        const data = await response.json();
        await cacheLocalJson(url, data);
        totalBytes += JSON.stringify(data).length;
        onProgress?.({
          phase: 'tajweed',
          percent: 55 + Math.round(((index + 1) / files.length) * 5),
          message: 'بيانات التجويد...',
          completed: index + 1,
          total: files.length,
        });
      }
      succeeded++;
    } else {
      throw new Error(`Tajweed manifest: HTTP ${manifestResponse.status}`);
    }
  } catch (e) {
    failed++;
    errors.push(`Tajweed: ${(e as Error).message}`);
  }

  onProgress?.({
    phase: 'tajweed',
    percent: 60,
    message: 'تم تحميل بيانات التجويد',
    completed: 1,
    total: 1,
  });

  if (reciterId && audioSurahCount > 0) {
    onProgress?.({
      phase: 'audio',
      percent: 60,
      message: `تحميل الصوت: ${reciterId}`,
      completed: 0,
      total: audioSurahCount,
    });

    for (let surahNum = 1; surahNum <= audioSurahCount; surahNum++) {
      onProgress?.({
        phase: 'audio',
        percent: 60 + Math.round((surahNum / audioSurahCount) * 35),
        message: `تحميل صوت سورة ${surahNum}`,
        completed: surahNum - 1,
        total: audioSurahCount,
      });

      try {
        const audioUrls = await getSurahAudioUrls(reciterId, surahNum);
        await cacheSurahAudio(audioUrls, surahNum, reciterId);
        if (!(await isSurahCached(audioUrls))) {
          throw new Error(`Audio surah ${surahNum} could not be persisted`);
        }

        saveOfflineAudioUrls(reciterId, surahNum, audioUrls);

        succeeded++;
      } catch (e) {
        failed++;
        errors.push(`Audio surah ${surahNum}: ${(e as Error).message}`);
      }
    }
  }

  onProgress?.({
    phase: 'done',
    percent: 100,
    message: 'اكتمل التحميل',
    completed: succeeded,
    total: succeeded + failed,
  });

  saveOfflinePackStatus({
    installed: failed === 0,
    installedAt: failed === 0 ? new Date().toISOString() : null,
    itemCount: succeeded,
    sizeBytes: totalBytes,
    reciterId: reciterId ?? null,
  });

  return {
    success: failed === 0,
    succeeded,
    failed,
    errors,
    totalBytes,
    elapsedMs: Date.now() - startTime,
  };
}

/* ===================== HELPER UTILITIES ===================== */

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function estimateOfflinePackSize(includeAudio: boolean = false, audioSurahCount: number = 0): number {
  const quranTextBytes = 1_700_000;
  const translationsBytes = 3_000_000;
  const tajweedBytes = 500_000;
  const audioPerSurahBytes = 8_000_000;

  let total = quranTextBytes + translationsBytes + tajweedBytes;
  if (includeAudio) {
    total += audioPerSurahBytes * audioSurahCount;
  }
  return total;
}
