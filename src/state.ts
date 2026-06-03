/**
 * Lightweight State Management for Quran App.
 *
 * Improvements over raw `let state = {} as AppState`:
 *   1. Proper default values — state is never in an undefined/partial state
 *   2. `setState(partial)` — batch update with change event emission
 *   3. `subscribe(key, callback)` — react to specific state changes
 *   4. `resetState()` — clean reset to defaults
 *   5. Backward compatible — `state.xxx = yyy` still works
 *
 * Usage:
 *   import { state, setState, subscribe, resetState } from './state.js';
 *   setState({ isPlaying: true, currentAyahIndex: 5 });
 *   subscribe('isPlaying', (newVal, oldVal) => { ... });
 */

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

/** Application state — shared across all modules. */
export interface AppState {
  currentSurah: number;
  currentAyahIndex: number;
  currentReciter: string;
  currentTafsirEdition: string;
  surahData: Record<string, unknown> | null;
  surahList: SurahInfo[];
  surahCache: Map<unknown, unknown>;
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
  autoSave: boolean;
  azanEnabled: boolean;
  azanFajrEnabled: boolean;
  city: string;
  country: string;
  method: string;
  prayerTimes: Record<string, unknown> | null;
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
  adhkarSettings: Record<string, unknown> | null;
  adhkarPanelOpen: boolean;
  adhkarActiveTab: string | null;
  lastAdhkarFired: string | null;
  adhkarNotificationTimer: ReturnType<typeof setTimeout> | null;
  adhkarIntervalId: ReturnType<typeof setInterval> | null;
  _adhkarAudioCtx: AudioContext | null;
  _selectMode: boolean;
  _selectedAyahs: SelectedAyah[];
  _voiceListening: boolean;
  _voiceRecognition: unknown;
  _smartTvState: number;
  _smartTvAudioSrc: string;
  surahOffsets: SurahOffset[] | null;
  backgroundsList: BackgroundEntry[] | null;
  ayahTimings: number[];
  presentationMode: boolean;
  _updateReadingProgress: (() => void) | null;
  currentPageLayout: Record<string, unknown> | null;
  _allSearchMatches: QuranTextEntry[] | null;
  _searchResultsPage: number;
  _editPersonalAdhkarId: string | null;
  searchPrefixMap: Map<string, unknown> | null;
  sepiaMode: boolean;
  fontType: string;
  lineSpacing: string;
  tajweedEnabled: boolean;
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
    autoSave: true,
    azanEnabled: true,
    azanFajrEnabled: true,
    city: 'مكة',
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
    adhkarNotificationTimer: null,
    adhkarIntervalId: null,
    _adhkarAudioCtx: null,
    _selectMode: false,
    _selectedAyahs: [],
    _voiceListening: false,
    _voiceRecognition: null,
    _smartTvState: 0,
    _smartTvAudioSrc: '',
    surahOffsets: null,
    backgroundsList: null,
    ayahTimings: [],
    presentationMode: false,
    _updateReadingProgress: null,
    currentPageLayout: null,
    _allSearchMatches: null,
    _searchResultsPage: 1,
    _editPersonalAdhkarId: null,
    searchPrefixMap: null,
    sepiaMode: false,
    fontType: 'amiri',
    lineSpacing: '1.8',
    tajweedEnabled: true,
  };
}

/* ===================== STATE INSTANCE ===================== */

/** Global application state — initialized with all default values. */
export let state: AppState = createDefaultState();

/* ===================== SUBSCRIPTION SYSTEM ===================== */

type StateChangeCallback = (newValue: unknown, oldValue: unknown, key: string) => void;

/** Map of key → array of callbacks. */
const subscribers = new Map<string, StateChangeCallback[]>();

/** Wildcard subscribers (notified on any change). */
const wildcardSubscribers: StateChangeCallback[] = [];

/**
 * Subscribe to changes on a specific state key.
 * @param key The state property name to watch
 * @param callback Called with (newValue, oldValue, key) when the value changes
 * @returns Unsubscribe function
 */
export function subscribe(key: string, callback: StateChangeCallback): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, []);
  }
  subscribers.get(key)!.push(callback);

  // Return unsubscribe function
  return () => {
    const list = subscribers.get(key);
    if (list) {
      const idx = list.indexOf(callback);
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
      try { cb(newValue, oldValue, key); } catch (e) { console.warn(`[State] Subscriber error on "${key}":`, e); }
    }
  }
  for (const cb of wildcardSubscribers) {
    try { cb(newValue, oldValue, key); } catch (e) { console.warn(`[State] Wildcard subscriber error:`, e); }
  }
}

/* ===================== CONTROLLED UPDATES ===================== */

/**
 * Batch-update state and notify subscribers.
 * Only notifies for keys whose values actually changed.
 *
 * @param partial Object with state properties to update
 *
 * @example
 *   setState({ isPlaying: true, currentAyahIndex: 5 });
 *   // Notifies subscribers for 'isPlaying' and 'currentAyahIndex' only
 */
export function setState(partial: Partial<AppState>): void {
  for (const [key, newValue] of Object.entries(partial)) {
    const oldValue = (state as Record<string, unknown>)[key];
    if (oldValue !== newValue) {
      (state as Record<string, unknown>)[key] = newValue;
      notifySubscribers(key, newValue, oldValue);
    }
  }
}

/**
 * Reset state to default values and clear all subscribers.
 * Useful for testing or full app reset.
 */
export function resetState(): void {
  const defaults = createDefaultState();
  for (const [key, value] of Object.entries(defaults)) {
    const oldValue = (state as Record<string, unknown>)[key];
    if (oldValue !== value) {
      (state as Record<string, unknown>)[key] = value;
      notifySubscribers(key, value, oldValue);
    }
  }
}

/**
 * Clear all subscribers. Useful for test cleanup.
 */
export function clearSubscribers(): void {
  subscribers.clear();
  wildcardSubscribers.length = 0;
}
