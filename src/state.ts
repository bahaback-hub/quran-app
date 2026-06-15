/**
 * Reactive State Management for Quran App.
 *
 * Features:
 *   1. Proxy-based reactivity — `state.xxx = yyy` automatically notifies subscribers
 *   2. `setState(partial)` — batch update with change event emission
 *   3. `subscribe(key, callback)` — react to specific state changes (type-safe)
 *   4. `subscribeAll(callback)` — react to any state change
 *   5. `batch(fn)` — defer notifications until fn completes
 *   6. `resetState()` — clean reset to defaults
 *   7. Backward compatible — all existing code works unchanged
 *   8. Dev-mode logging — warns about missed notifications in development
 *   9. Typed subscriptions — subscribe<K> gets (newVal: AppState[K], oldVal: AppState[K])
 *
 * Usage:
 *   import { state, setState, subscribe, batch } from './state.js';
 *   state.isPlaying = true;          // ← automatically notifies subscribers
 *   setState({ isPlaying: true });   // ← equivalent, also notifies
 *   subscribe('isPlaying', (newVal, oldVal) => { ... });  // ← typed callback
 *   batch(() => {
 *     state.currentSurah = 5;
 *     state.currentAyahIndex = 0;
 *   }); // ← subscribers notified once per key after batch completes
 */

import type { SurahData, PrayerTimes, AdhkarSettings } from './types.js';
import type { PageLayoutData } from './mushaf-renderer.js';
import { CONFIG } from './config.js';
import { resetInternalState } from './internal-state.js';

/* ===================== INTERFACES ===================== */

/** Surah list entry shape. */
export interface SurahInfo {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

/** Favorite ayah entry. */
export interface FavoriteEntry {
  key: string;
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  timestamp: number;
}

/** Bookmark entry. */
export interface BookmarkEntry {
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  timestamp: number;
}

/** Full Quran text entry (for search index). */
export interface QuranTextEntry {
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  normalized: string;
}

/** Selected ayah entry (select mode). */
export interface SelectedAyah {
  surah: number;
  ayah: number;
  text: string;
  surahName: string;
  index: number;
}

/** Surah offset entry (for mushaf navigation). */
export interface SurahOffset {
  surahNum: number;
  startAbs: number;
  count: number;
  name: string;
}

/** Background entry. */
export interface BackgroundEntry {
  id: string;
  name: string;
  type?: string;
  css?: string;
  cssBlock?: string;
}

/** Search word entry. */
export interface SearchWord {
  word: string;
  count: number;
}

/* ===================== DOMAIN SUB-INTERFACES ===================== */

/**
 * Audio & playback state — properties related to audio playback, recitation, and repeat.
 * Extracted for documentation clarity; AppState composes these flat (no nesting).
 */
export interface AudioStateSlice {
  currentReciter: string;
  ayahsAudios: string[];
  isPlaying: boolean;
  hifdhMode: boolean;
  repeatMode: boolean;
  repeatFrom: number;
  repeatTo: number;
  repeatTimes: number;
  repeatCounter: number;
  playerCollapsed: boolean;
  azanPlaying: boolean;
  ayahTimings: number[];
}

/**
 * Prayer & location state — properties related to prayer times, azan, and location.
 */
export interface PrayerStateSlice {
  azanEnabled: boolean;
  azanFajrEnabled: boolean;
  city: string;
  country: string;
  method: string;
  prayerTimes: PrayerTimes | null;
  lastAzanFired: string | null;
}

/**
 * Surah navigation state — properties for surah browsing and content.
 */
export interface SurahStateSlice {
  currentSurah: number;
  currentAyahIndex: number;
  currentTafsirEdition: string;
  surahData: SurahData | null;
  surahList: SurahInfo[];
  /** Cache of previously loaded surahs, keyed by surah number. */
  surahCache: Map<string, import('./surah-cache.js').CachedSurahEntry>;
  loadingSurah: number | null;
  pendingTafsirAfterLoad: string | null;
}

/**
 * UI & display state — properties controlling appearance and UI behavior.
 */
export interface UIStateSlice {
  fontSize: number;
  nightMode: boolean;
  sepiaMode: boolean;
  autoSave: boolean;
  barCollapsed: boolean;
  fontType: string;
  lineSpacing: string;
  tajweedEnabled: boolean;
}

/**
 * Mushaf & presentation state — properties for mushaf mode and presentation mode.
 */
export interface MushafStateSlice {
  mushafMode: boolean;
  currentPage: number;
  currentPageLayout: PageLayoutData | null;
  surahOffsets: SurahOffset[] | null;
  presentationMode: boolean;
  presBgMode: 'plain' | 'nature' | 'singleNature' | 'auto' | 'animated' | 'scene';
  presBgScene: string;
  presBgNature: string;
}

/**
 * Search & translation state — properties for search functionality and translations.
 */
export interface SearchStateSlice {
  fullQuranText: QuranTextEntry[] | null;
  fullQuranLoaded: boolean;
  searchWords: SearchWord[];
  searchTrie: Record<string, unknown> | null;
  searchPrefixMap: Map<string, unknown> | null;
  translationEnabled: boolean;
  currentTranslation: string | null;
  translationData: Record<string, unknown> | null;
}

/**
 * Adhkar state — properties for adhkar (remembrances) feature.
 */
export interface AdhkarStateSlice {
  adhkarSettings: AdhkarSettings | null;
  adhkarPanelOpen: boolean;
  adhkarActiveTab: string | null;
  lastAdhkarFired: string | null;
}

/** Application state — shared across all modules. Composes all domain slices flat. */
export interface AppState {
  currentSurah: number;
  currentAyahIndex: number;
  currentReciter: string;
  currentTafsirEdition: string;
  surahData: SurahData | null;
  surahList: SurahInfo[];
  /** Cache of previously loaded surahs, keyed by surah number. */
  surahCache: Map<string, import('./surah-cache.js').CachedSurahEntry>;
  ayahsAudios: string[];
  isPlaying: boolean;
  hifdhMode: boolean;
  repeatMode: boolean;
  repeatFrom: number;
  repeatTo: number;
  repeatTimes: number;
  repeatCounter: number;
  fontSize: number;
  nightMode: boolean;
  sepiaMode: boolean;
  autoSave: boolean;
  azanEnabled: boolean;
  azanFajrEnabled: boolean;
  city: string;
  country: string;
  method: string;
  prayerTimes: PrayerTimes | null;
  lastAzanFired: string | null;
  favorites: FavoriteEntry[];
  bookmark: BookmarkEntry | null;
  pendingTafsirAfterLoad: string | null;
  playerCollapsed: boolean;
  barCollapsed: boolean;
  azanPlaying: boolean;
  loadingSurah: number | null;
  mushafMode: boolean;
  currentPage: number;
  fullQuranText: QuranTextEntry[] | null;
  fullQuranLoaded: boolean;
  searchWords: SearchWord[];
  searchTrie: Record<string, unknown> | null;
  ayahWordElements: HTMLElement[] | null;
  translationEnabled: boolean;
  currentTranslation: string | null;
  translationData: Record<string, unknown> | null;
  adhkarSettings: AdhkarSettings | null;
  adhkarPanelOpen: boolean;
  adhkarActiveTab: string | null;
  lastAdhkarFired: string | null;

  surahOffsets: SurahOffset[] | null;
  ayahTimings: number[];
  presentationMode: boolean;
  currentPageLayout: PageLayoutData | null;
  searchPrefixMap: Map<string, unknown> | null;
  fontType: string;
  lineSpacing: string;
  tajweedEnabled: boolean;
  presBgMode: 'plain' | 'nature' | 'singleNature' | 'auto' | 'animated' | 'scene';
  presBgScene: string;
  presBgNature: string;
}

/** Pending change entry for batch mode. */
interface PendingChange {
  key: string;
  newValue: unknown;
  oldValue: unknown;
}

/* ===================== DEFAULT VALUES ===================== */

/** Factory function that creates a fresh AppState with all defaults. */
export function createDefaultState(): AppState {
  return {
    currentSurah: 1,
    currentAyahIndex: 0,
    currentReciter: 'ar.alafasy',
    currentTafsirEdition: 'ar-tafsir-muyassar',
    surahData: null,
    surahList: [],
    surahCache: new Map(),
    ayahsAudios: [],
    isPlaying: false,
    hifdhMode: false,
    repeatMode: false,
    repeatFrom: 1,
    repeatTo: 1,
    repeatTimes: 3,
    repeatCounter: 0,
    fontSize: 28,
    nightMode: false,
    sepiaMode: false,
    autoSave: true,
    azanEnabled: false,
    azanFajrEnabled: false,
    city: CONFIG.DEFAULT_CITY,
    country: 'SA',
    method: '4',
    prayerTimes: null,
    lastAzanFired: null,
    favorites: [],
    bookmark: null,
    pendingTafsirAfterLoad: null,
    playerCollapsed: false,
    barCollapsed: true,
    azanPlaying: false,
    loadingSurah: null,
    mushafMode: false,
    currentPage: 1,
    fullQuranText: null,
    fullQuranLoaded: false,
    searchWords: [],
    searchTrie: null,
    ayahWordElements: null,
    translationEnabled: false,
    currentTranslation: null,
    translationData: null,
    adhkarSettings: null,
    adhkarPanelOpen: false,
    adhkarActiveTab: null,
    lastAdhkarFired: null,

    surahOffsets: null,
    ayahTimings: [],
    presentationMode: false,
    currentPageLayout: null,
    searchPrefixMap: null,
    fontType: 'amiri',
    lineSpacing: '1.8',
    tajweedEnabled: true,
    presBgMode: 'plain',
    presBgScene: 'stars',
    presBgNature: 'dawn',
  };
}

/* ===================== INTERNAL STATE ===================== */

/** The raw (un-proxied) state object — used internally for direct access. */
const _rawState: AppState = createDefaultState();

/** Whether we are currently inside a batch() call. */
let _batchDepth = 0;

/** Changes accumulated during a batch, keyed by property name. */
let _pendingChanges: Map<string, PendingChange> = new Map();

/* ===================== SUBSCRIPTION SYSTEM ===================== */

/** Untyped callback — used internally for storage. */
type StateChangeCallback = (newValue: unknown, oldValue: unknown, key: string) => void;

/**
 * Typed callback for a specific state key K.
 * The callback receives (newValue, oldValue) both typed as AppState[K].
 *
 * @typeParam K - A key of AppState to watch.
 */
export type TypedStateChangeCallback<K extends keyof AppState> = (
  newValue: AppState[K],
  oldValue: AppState[K]
) => void;

/** Map of key → array of callbacks. */
const subscribers = new Map<string, StateChangeCallback[]>();

/** Wildcard subscribers (notified on any change). */
const wildcardSubscribers: StateChangeCallback[] = [];

/**
 * Subscribe to changes on a specific state key.
 *
 * When called with a literal key (e.g. `'isPlaying'`), the callback
 * parameters are automatically typed to match the state property type.
 *
 * @typeParam K - The specific key of AppState being watched.
 * @param key The state property name to watch
 * @param callback Called with (newValue, oldValue) when the value changes
 * @returns Unsubscribe function
 *
 * @example
 *   // Typed: newVal and oldVal are both `boolean`
 *   subscribe('isPlaying', (newVal, oldVal) => {
 *     console.log(newVal); // boolean
 *   });
 *
 *   // Untyped: for dynamic keys
 *   subscribe(someKey, (newVal, oldVal, key) => {
 *     console.log(key, newVal);
 *   });
 */
export function subscribe<K extends keyof AppState>(
  key: K,
  callback: TypedStateChangeCallback<K>
): () => void;
export function subscribe(key: string, callback: StateChangeCallback): () => void;
export function subscribe(key: string, callback: StateChangeCallback | TypedStateChangeCallback<keyof AppState>): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, []);
  }
  // Wrap typed callback to match internal signature
  const wrapped: StateChangeCallback =
    'length' in callback && callback.length <= 2
      ? (nv: unknown, ov: unknown, _k: string) => (callback as TypedStateChangeCallback<keyof AppState>)(nv as AppState[keyof AppState], ov as AppState[keyof AppState])
      : callback as StateChangeCallback;

  subscribers.get(key)!.push(wrapped);

  // Return unsubscribe function
  return () => {
    const list = subscribers.get(key);
    if (list) {
      const idx = list.indexOf(wrapped);
      if (idx !== -1) list.splice(idx, 1);
    }
  };
}

/**
 * Subscribe to ALL state changes.
 * @param callback Called with (newValue, oldValue, key) on any change
 * @returns Unsubscribe function
 */
export function subscribeAll(callback: StateChangeCallback): () => void {
  wildcardSubscribers.push(callback);
  return () => {
    const idx = wildcardSubscribers.indexOf(callback);
    if (idx !== -1) wildcardSubscribers.splice(idx, 1);
  };
}

/**
 * Notify subscribers about a state change.
 * @param key The property that changed
 * @param newValue The new value
 * @param oldValue The previous value
 */
function notifySubscribers(key: string, newValue: unknown, oldValue: unknown): void {
  const keySubs = subscribers.get(key);
  if (keySubs) {
    for (const cb of keySubs) {
      try {
        cb(newValue, oldValue, key);
      } catch (e) {
        console.warn(`[State] Subscriber error on "${key}":`, e);
      }
    }
  }
  for (const cb of wildcardSubscribers) {
    try {
      cb(newValue, oldValue, key);
    } catch (e) {
      console.warn(`[State] Wildcard subscriber error:`, e);
    }
  }
}

/**
 * Flush all pending changes from a batch.
 * Notifies subscribers for each unique key that changed.
 */
function flushPendingChanges(): void {
  for (const [, change] of _pendingChanges) {
    notifySubscribers(change.key, change.newValue, change.oldValue);
  }
  _pendingChanges.clear();
}

/**
 * Record a state change — either notify immediately or defer if in batch mode.
 */
function recordChange(key: string, newValue: unknown, oldValue: unknown): void {
  if (_batchDepth > 0) {
    // In batch mode: keep the OLDEST oldValue for this key, update to latest newValue
    const existing = _pendingChanges.get(key);
    if (existing) {
      existing.newValue = newValue;
    } else {
      _pendingChanges.set(key, { key, newValue, oldValue });
    }
  } else {
    notifySubscribers(key, newValue, oldValue);
  }
}

/* ===================== REACTIVE PROXY ===================== */

/**
 * Create a reactive proxy around the raw state object.
 * Any property set (`state.xxx = yyy`) automatically triggers subscribers.
 */
function createReactiveProxy(): AppState {
  return new Proxy(_rawState, {
    set(target: AppState, property: string, newValue: unknown): boolean {
      const key = property as keyof AppState;
      const oldValue = Reflect.get(target, key) as unknown;

      // Skip notification if value hasn't changed (shallow comparison)
      if (oldValue === newValue) return true;

      // Validate that the property exists on AppState (dev-time safety)
      if (!(property in _rawState)) {
        console.warn(`[State] Setting unknown property "${property}" on state. Consider adding it to AppState.`);
      }

      // Apply the change to the raw state using Reflect (type-safe)
      Reflect.set(target, key, newValue);

      // Record the change (immediate notify or defer to batch)
      recordChange(key, newValue, oldValue);

      return true;
    },

    get(target: AppState, property: string): unknown {
      return Reflect.get(target, property);
    },
  });
}

/** Global reactive application state — all property writes notify subscribers. */
export const state: AppState = createReactiveProxy();

/* ===================== CONTROLLED UPDATES ===================== */

/**
 * Batch-update state and notify subscribers.
 * Only notifies for keys whose values actually changed.
 *
 * Note: With the Proxy-based state, `setState({ key: val })` is equivalent
 * to `state.key = val`. Both trigger subscriber notifications. Use `setState`
 * for semantic clarity when setting multiple properties at once.
 *
 * @typeParam K - Union of AppState keys being updated (auto-inferred).
 * @param partial Object with state properties to update
 *
 * @example
 *   setState({ isPlaying: true, currentAyahIndex: 5 });
 *   // Notifies subscribers for 'isPlaying' and 'currentAyahIndex' only
 *
 *   // Type-safe: only valid AppState keys accepted
 *   setState({ invalidKey: true }); // ← TypeScript error
 */
export function setState<K extends keyof AppState>(partial: Pick<AppState, K>): void {
  for (const [key, newValue] of Object.entries(partial)) {
    Reflect.set(state, key, newValue);
    // The Proxy handler will call recordChange automatically
  }
}

/**
 * Execute a function with deferred notifications.
 * All state changes within the function are collected and
 * subscribers are notified only after the function completes.
 *
 * This is useful for making multiple related changes without
 * triggering intermediate renders or side effects.
 *
 * @typeParam T - Return type of the batched function.
 * @param fn Function containing state mutations
 *
 * @example
 *   batch(() => {
 *     state.currentSurah = 5;
 *     state.currentAyahIndex = 0;
 *     state.isPlaying = false;
 *   });
 *   // Subscribers notified once for each changed key AFTER the batch
 */
export function batch<T>(fn: () => T): T {
  _batchDepth++;
  try {
    return fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0) {
      flushPendingChanges();
    }
  }
}

/**
 * Reset state to default values and notify subscribers.
 * Useful for testing or full app reset.
 */
export function resetState(): void {
  const defaults = createDefaultState();
  batch(() => {
    for (const [key, value] of Object.entries(defaults)) {
      Reflect.set(state, key, value);
    }
  });
  resetInternalState();
}

/* ===================== IMMUTABLE HELPERS ===================== */

/**
 * Immutable array push — creates a new array reference so the Proxy detects the change.
 *
 * @example
 *   immutablePush(state, 'favorites', newEntry);
 *   // Equivalent to: state.favorites = [...state.favorites, newEntry]
 */
export function immutablePush<K extends keyof AppState>(
  target: AppState,
  key: K,
  ...items: AppState[K] extends Array<infer T> ? T[] : never
): void {
  const arr = target[key] as unknown[];
  Reflect.set(target, key, [...arr, ...items]);
}

/**
 * Immutable array remove by index — creates a new array reference.
 *
 * @example
 *   immutableSplice(state, 'favorites', idx, 1);
 *   // Equivalent to: state.favorites = state.favorites.filter((_, i) => i !== idx)
 */
export function immutableSplice<K extends keyof AppState>(
  target: AppState,
  key: K,
  start: number,
  deleteCount: number = 1
): void {
  const arr = target[key] as unknown[];
  const next = [...arr];
  next.splice(start, deleteCount);
  Reflect.set(target, key, next);
}

/**
 * Immutable Map set — creates a new Map reference so the Proxy detects the change.
 *
 * @example
 *   immutableMapSet(state, 'surahCache', key, value);
 */
export function immutableMapSet<K extends keyof AppState>(
  target: AppState,
  key: K,
  mapKey: AppState[K] extends Map<infer MK, infer MV> ? MK : never,
  mapValue: AppState[K] extends Map<infer MK, infer MV> ? MV : never
): void {
  const map = new Map(target[key] as Map<unknown, unknown>);
  map.set(mapKey, mapValue);
  Reflect.set(target, key, map);
}

/**
 * Immutable Map delete — creates a new Map reference.
 *
 * @example
 *   immutableMapDelete(state, 'surahCache', key);
 */
export function immutableMapDelete<K extends keyof AppState>(
  target: AppState,
  key: K,
  mapKey: AppState[K] extends Map<infer MK, infer MV> ? MK : never
): void {
  const map = new Map(target[key] as Map<unknown, unknown>);
  map.delete(mapKey);
  Reflect.set(target, key, map);
}

/**
 * Immutable array filter — convenience for removing items by predicate.
 *
 * @example
 *   immutableFilter(state, 'favorites', f => f.key !== targetKey);
 */
export function immutableFilter<K extends keyof AppState>(
  target: AppState,
  key: K,
  predicate: AppState[K] extends Array<infer T> ? (value: T, index: number, array: T[]) => unknown : never
): void {
  const arr = target[key] as unknown[];
  Reflect.set(target, key, arr.filter(predicate as (value: unknown, index: number, array: unknown[]) => unknown));
}

/**
 * Clear all subscribers. Useful for test cleanup.
 */
export function clearSubscribers(): void {
  subscribers.clear();
  wildcardSubscribers.length = 0;
}
