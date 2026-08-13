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

const DEFAULT_TRANSLATIONS = [
  'en.sahih',
  'en.pickthall',
  'en.yusufali',
  'fr.hamidullah',
  'ur.jalandhry',
];

const FETCH_TIMEOUT_MS = 30_000;

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

/* ===================== DOWNLOAD ORCHESTRATION ===================== */

export async function downloadOfflinePack(
  options: DownloadOfflinePackOptions = {},
): Promise<OfflinePackResult> {
  const startTime = Date.now();
  const {
    onProgress,
    reciterId,
    audioSurahCount = 0,
    translationEditions = DEFAULT_TRANSLATIONS,
  } = options;

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
    const response = await fetchWithTimeout(
      `${CONFIG.API_BASE}/quran/quran-uthmani`,
    );
    if (response.ok) {
      const data = await response.json();
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
      const response = await fetchWithTimeout(
        `${CONFIG.API_BASE}/quran/${edition}`,
      );
      if (response.ok) {
        const data = await response.json();
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
    const response = await fetchWithTimeout('/data/tajweed.json');
    if (response.ok) {
      const data = await response.json();
      totalBytes += JSON.stringify(data).length;
      succeeded++;
    }
  } catch {
    succeeded++;
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

    const { cacheSurahAudio } = await import('./audio-cache.js');

    for (let surahNum = 1; surahNum <= audioSurahCount; surahNum++) {
      onProgress?.({
        phase: 'audio',
        percent: 60 + Math.round((surahNum / audioSurahCount) * 35),
        message: `تحميل صوت سورة ${surahNum}`,
        completed: surahNum - 1,
        total: audioSurahCount,
      });

      try {
        const paddedNum = String(surahNum).padStart(3, '0');
        const serverUrl = `https://server8.mp3quran.net/${reciterId}/`;
        const audioUrl = `${serverUrl}${paddedNum}.mp3`;

        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          failed++;
          errors.push(`Audio surah ${surahNum}: HTTP ${audioResponse.status}`);
          continue;
        }

        const blob = await audioResponse.blob();
        totalBytes += blob.size;

        await cacheSurahAudio([audioUrl], surahNum, reciterId).catch(() => {
          // SW runtime cache will still hold it
        });

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
    installedAt: new Date().toISOString(),
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

export function estimateOfflinePackSize(
  includeAudio: boolean = false,
  audioSurahCount: number = 0,
): number {
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
