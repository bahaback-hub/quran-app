/**
 * Tajweed annotation data loader.
 * Loads pre-computed character-offset tajweed annotations from cpfair/quran-tajweed.
 */

import { state } from './state.js';

/** @type {Map<string, {rule:string, start:number, end:number}[]>|null} */
let _annotations = null;

/**
 * Build a lookup key from surah and ayah numbers.
 * @param {number} surah
 * @param {number} ayah
 * @returns {string}
 */
function key(surah, ayah) {
  return `${surah}:${ayah}`;
}

/**
 * Load the tajweed annotations JSON from the static data file.
 * Data is based on cpfair/quran-tajweed's output.
 * @returns {Promise<Map<string, {rule:string, start:number, end:number}[]>>}
 */
export async function loadTajweedAnnotations() {
  if (_annotations) return _annotations;

  try {
    const res = await fetch('data/tajweed.json');
    const data = await res.json();
    const map = new Map();
    for (const entry of data) {
      map.set(key(entry.surah, entry.ayah), entry.annotations || []);
    }
    _annotations = map;
    return map;
  } catch (e) {
    console.warn('فشل تحميل بيانات التجويد:', e);
    _annotations = new Map();
    return _annotations;
  }
}

/**
 * Get tajweed annotations for a specific ayah.
 * @param {number} surah
 * @param {number} ayah
 * @returns {{rule:string, start:number, end:number}[]}
 */
export function getAyahAnnotations(surah, ayah) {
  if (!_annotations) return [];
  return _annotations.get(key(surah, ayah)) || [];
}

/**
 * Check if annotations are loaded.
 * @returns {boolean}
 */
export function isTajweedDataLoaded() {
  return _annotations !== null;
}

/**
 * Preload annotations if tajweed is enabled.
 * Called early during app init so data is ready when first surah loads.
 */
export async function preloadTajweedIfNeeded() {
  if (state.tajweedEnabled) {
    await loadTajweedAnnotations();
  }
}
