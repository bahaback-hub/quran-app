/**
 * Tajweed annotation data loader.
 * Loads pre-computed character-offset tajweed annotations from cpfair/quran-tajweed.
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

let _annotations: Map<string, TajweedAnnotation[]> | null = null;

/**
 * Build a lookup key from surah and ayah numbers.
 */
function key(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

/**
 * Load the tajweed annotations JSON from the static data file.
 * Data is based on cpfair/quran-tajweed's output.
 */
export async function loadTajweedAnnotations(): Promise<Map<string, TajweedAnnotation[]>> {
  if (_annotations) return _annotations;

  try {
    const res = await fetch('data/tajweed.json');
    const data: TajweedJsonEntry[] = await res.json();
    const map = new Map<string, TajweedAnnotation[]>();
    for (const entry of data) {
      map.set(key(entry.surah, entry.ayah), entry.annotations || []);
    }
    _annotations = map;
    return map;
  } catch (e) {
    console.warn('فشل تحميل بيانات التجويد:', e);
    _annotations = new Map<string, TajweedAnnotation[]>();
    return _annotations;
  }
}

/**
 * Get tajweed annotations for a specific ayah.
 */
export function getAyahAnnotations(surah: number, ayah: number): TajweedAnnotation[] {
  if (!_annotations) return [];
  return _annotations.get(key(surah, ayah)) || [];
}

/**
 * Check if annotations are loaded.
 */
export function isTajweedDataLoaded(): boolean {
  return _annotations !== null;
}

/**
 * Preload annotations if tajweed is enabled.
 * Called early during app init so data is ready when first surah loads.
 */
export async function preloadTajweedIfNeeded(): Promise<void> {
  if (state.tajweedEnabled) {
    await loadTajweedAnnotations();
  }
}
