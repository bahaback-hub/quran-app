/**
 * Tajweed annotation data loader.
 * Reader pages load compact per-surah chunks; the explicit offline pack can
 * still hydrate the complete in-memory map when requested.
 */

import { state } from './state.js';

export interface TajweedAnnotation {
  rule: string;
  start: number;
  end: number;
}

interface TajweedJsonEntry {
  surah: number;
  ayah: number;
  annotations: TajweedAnnotation[];
}

interface TajweedManifest {
  version: number;
  rules: string[];
  files: string[];
}

type CompactTajweedEntry = [number, [number, number, number][]];

let _annotations: Map<string, TajweedAnnotation[]> | null = null;
const _surahAnnotations = new Map<number, Map<string, TajweedAnnotation[]>>();
let _manifestPromise: Promise<TajweedManifest | TajweedJsonEntry[]> | null = null;

/**
 * Read a local tajweed file from the network first, then from Cache Storage.
 * This fallback is necessary in Capacitor, where the PWA service worker is
 * deliberately disabled but an explicit offline package remains available.
 */
async function fetchCachedJson<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);
    if (response.ok === false) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json() as T;
  } catch (networkError) {
    if ('caches' in globalThis) {
      try {
        const cached = await caches.match(url);
        if (cached) {
          return await cached.json() as T;
        }
      } catch {
        // Preserve the original network error if Cache Storage is unavailable.
      }
    }
    throw networkError;
  }
}

function key(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

function toAnnotationMap(data: TajweedJsonEntry[]): Map<string, TajweedAnnotation[]> {
  const map = new Map<string, TajweedAnnotation[]>();
  for (const entry of data) {
    map.set(key(entry.surah, entry.ayah), entry.annotations || []);
  }
  return map;
}

async function getManifest(): Promise<TajweedManifest | TajweedJsonEntry[]> {
  if (!_manifestPromise) {
    _manifestPromise = fetchCachedJson<TajweedManifest | TajweedJsonEntry[]>('data/tajweed/manifest.json');
  }
  return _manifestPromise;
}

async function readSurahChunk(surah: number, manifest: TajweedManifest): Promise<TajweedJsonEntry[]> {
  const file = manifest.files.find((item) => item.startsWith(`${String(surah).padStart(3, '0')}.`));
  if (!file) {
    return [];
  }
  const compact = await fetchCachedJson<CompactTajweedEntry[]>(`data/tajweed/${file}`);
  return compact.map(([ayah, annotations]) => ({
    surah,
    ayah,
    annotations: annotations.map(([ruleId, start, end]) => ({ rule: manifest.rules[ruleId] || '', start, end })),
  }));
}

/** Load all annotation chunks only for explicit offline or legacy callers. */
export async function loadTajweedAnnotations(): Promise<Map<string, TajweedAnnotation[]>> {
  if (_annotations) {
    return _annotations;
  }
  try {
    const manifest = await getManifest();
    // Keeps existing test and extension callers compatible with the former full
    // JSON shape while production serves the compact manifest object.
    if (Array.isArray(manifest)) {
      _annotations = toAnnotationMap(manifest);
      return _annotations;
    }
    const chunks = await Promise.all(manifest.files.map((_, index) => readSurahChunk(index + 1, manifest)));
    _annotations = toAnnotationMap(chunks.flat());
    return _annotations;
  } catch (e) {
    console.warn('فشل تحميل بيانات التجويد:', e);
    _annotations = new Map<string, TajweedAnnotation[]>();
    return _annotations;
  }
}

/** Load only the active reader surah, avoiding the full tajweed corpus. */
export async function loadTajweedAnnotationsForSurah(surah: number): Promise<Map<string, TajweedAnnotation[]>> {
  const cached = _surahAnnotations.get(surah);
  if (cached) {
    return cached;
  }
  if (_annotations) {
    const fromFull = new Map<string, TajweedAnnotation[]>();
    for (const [entryKey, value] of _annotations) {
      if (entryKey.startsWith(`${surah}:`)) {
        fromFull.set(entryKey, value);
      }
    }
    _surahAnnotations.set(surah, fromFull);
    return fromFull;
  }
  try {
    const manifest = await getManifest();
    const entries = Array.isArray(manifest)
      ? manifest.filter((entry) => entry.surah === surah)
      : await readSurahChunk(surah, manifest);
    const map = toAnnotationMap(entries);
    _surahAnnotations.set(surah, map);
    return map;
  } catch (e) {
    console.warn(`فشل تحميل بيانات التجويد للسورة ${surah}:`, e);
    const empty = new Map<string, TajweedAnnotation[]>();
    _surahAnnotations.set(surah, empty);
    return empty;
  }
}

export function getAyahAnnotations(surah: number, ayah: number): TajweedAnnotation[] {
  return _surahAnnotations.get(surah)?.get(key(surah, ayah)) || _annotations?.get(key(surah, ayah)) || [];
}

export function isTajweedDataLoaded(): boolean {
  return _annotations !== null || _surahAnnotations.size > 0;
}

/** Preload only the active surah when tajweed is enabled. */
export async function preloadTajweedIfNeeded(): Promise<void> {
  if (!state.tajweedEnabled) {
    return;
  }
  if (state.currentSurah) {
    await loadTajweedAnnotationsForSurah(state.currentSurah);
  } else {
    await loadTajweedAnnotations();
  }
}
