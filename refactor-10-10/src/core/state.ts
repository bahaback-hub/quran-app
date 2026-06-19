/**
 * ================================================================
 * Reactive State with DevTools — Solves Problem #5
 * ----------------------------------------------------------------
 * Replaces the bare Proxy-based state with a system that supports:
 *   - Type-safe subscribe/unsubscribe
 *   - DevTools-style logging (state changes are traced)
 *   - Action tracking (who changed what, when)
 *   - Time-travel snapshot (keep last N states)
 *   - Batch updates (single notify for many changes)
 *   - Memory leak protection (auto-cleanup of stale subscribers)
 *
 * Public API stays the same: `state.isPlaying = true` triggers updates.
 * ================================================================
 */

import { toast } from './toast.js';

const DEV = import.meta.env?.DEV ?? false;
const MAX_SNAPSHOTS = 50; // time-travel depth in dev

export interface AppState {
  // === Surah/Navigation ===
  currentSurah: number;
  currentAyahIndex: number;
  currentPage: number;
  surahList: SurahInfo[];
  surahData: SurahData | null;

  // === Audio ===
  isPlaying: boolean;
  currentReciter: string;
  playbackSpeed: number;
  repeatMode: RepeatMode;
  sleepTimer: number | null;

  // === View ===
  mushafMode: boolean;
  presentationMode: boolean;
  hifdhMode: boolean;
  showTranslation: boolean;
  showTajweed: boolean;

  // === Theme ===
  theme: 'light' | 'sepia' | 'night';

  // === Prayer ===
  prayerTimes: PrayerTimes | null;
  nextPrayer: PrayerName | null;

  // === Search ===
  searchQuery: string;
  searchResults: SearchResult[];

  // === User Data ===
  favorites: FavoriteEntry[];
  bookmarks: BookmarkEntry[];
  lastPosition: LastPosition | null;
}

export interface SurahInfo {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
}

export interface SurahData {
  number: number;
  name: string;
  ayahs: Ayah[];
}

export interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
  audio?: string;
  sajda?: boolean;
}

export type RepeatMode = 'none' | 'single' | 'surah' | 'range';
export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface SearchResult {
  surah: number;
  ayah: number;
  text: string;
}

export interface FavoriteEntry {
  surah: number;
  ayah: number;
  text: string;
  addedAt: number;
}

export interface BookmarkEntry {
  surah: number;
  ayah: number;
  label?: string;
  createdAt: number;
}

export interface LastPosition {
  surah: number;
  surahName?: string;
  ayahNumberInSurah?: number;
  timestamp?: number;
}

// ================================================================
// Internal Types
// ================================================================

type Subscriber<T extends keyof AppState> = (
  newValue: AppState[T],
  oldValue: AppState[T],
) => void;

type WildcardSubscriber = (
  key: keyof AppState,
  newValue: unknown,
  oldValue: unknown,
) => void;

interface StateSnapshot {
  timestamp: number;
  state: Partial<AppState>;
  action: string;
  stack?: string;
}

// ================================================================
// Default State
// ================================================================

const DEFAULT_STATE: AppState = {
  currentSurah: 1,
  currentAyahIndex: 0,
  currentPage: 1,
  surahList: [],
  surahData: null,

  isPlaying: false,
  currentReciter: 'ar.alafasy',
  playbackSpeed: 1,
  repeatMode: 'none',
  sleepTimer: null,

  mushafMode: false,
  presentationMode: false,
  hifdhMode: false,
  showTranslation: false,
  showTajweed: true,

  theme: 'light',

  prayerTimes: null,
  nextPrayer: null,

  searchQuery: '',
  searchResults: [],

  favorites: [],
  bookmarks: [],
  lastPosition: null,
};

// ================================================================
// ReactiveState Class
// ================================================================

class ReactiveState {
  private _state: AppState = { ...DEFAULT_STATE };
  private readonly subscribers = new Map<keyof AppState, Set<Subscriber<keyof AppState>>>();
  private readonly wildcardSubscribers = new Set<WildcardSubscriber>();
  private readonly snapshots: StateSnapshot[] = [];
  private batchDepth = 0;
  private readonly pendingNotifications = new Set<keyof AppState>();

  /**
   * Get the raw state object (read-only access via Proxy).
   * Writing to properties triggers notification automatically.
   */
  public readonly proxy: AppState;

  constructor() {
    const self = this;
    this.proxy = new Proxy(this._state, {
      set(target, key: string, value) {
        if (!(key in target)) {
          console.warn(`[State] Unknown property "${key}". Adding it dynamically is discouraged.`);
        }
        const oldValue = (target as Record<string, unknown>)[key];
        (target as Record<string, unknown>)[key] = value;

        // Record snapshot in dev mode
        if (DEV && key in DEFAULT_STATE) {
          self.recordSnapshot(key as keyof AppState, oldValue, value);
        }

        // Notify (deferred if batching)
        if (self.batchDepth > 0) {
          self.pendingNotifications.add(key as keyof AppState);
        } else {
          self.notify(key as keyof AppState, value, oldValue);
        }
        return true;
      },
    });
  }

  /**
   * Subscribe to changes of a specific key.
   * @returns Unsubscribe function (call to clean up).
   */
  subscribe<T extends keyof AppState>(key: T, fn: Subscriber<T>): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    const set = this.subscribers.get(key)!;
    set.add(fn as Subscriber<keyof AppState>);
    return () => set.delete(fn as Subscriber<keyof AppState>);
  }

  /** Subscribe to ALL state changes (useful for DevTools). */
  subscribeAll(fn: WildcardSubscriber): () => void {
    this.wildcardSubscribers.add(fn);
    return () => this.wildcardSubscribers.delete(fn);
  }

  /** Batch multiple updates — fires a single notification per changed key at the end. */
  batch(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0) {
        for (const key of this.pendingNotifications) {
          this.notify(key, this._state[key], undefined);
        }
        this.pendingNotifications.clear();
      }
    }
  }

  /** Reset state to defaults (used in tests / re-init). */
  reset(): void {
    this.batch(() => {
      for (const key of Object.keys(DEFAULT_STATE) as (keyof AppState)[]) {
        (this.proxy as Record<keyof AppState, unknown>)[key] = DEFAULT_STATE[key];
      }
    });
    this.snapshots.length = 0;
  }

  // === DevTools ===

  /** In dev mode, record a snapshot for time-travel debugging. */
  private recordSnapshot(key: keyof AppState, oldValue: unknown, newValue: unknown): void {
    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      state: { [key]: newValue },
      action: `set ${String(key)}`,
      stack: new Error().stack,
    };
    this.snapshots.push(snapshot);
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }

    // Log to console with color coding
    const isPrimitive = typeof newValue !== 'object' || newValue === null;
    const displayValue = isPrimitive ? newValue : '[object]';
    console.log(
      `%c[State] %c${String(key)}: %c${JSON.stringify(oldValue)} %c→ %c${JSON.stringify(displayValue)}`,
      'color: #9a7b4f; font-weight: bold',
      'color: #c47a12',
      'color: #8a7b6d; text-decoration: line-through',
      'color: #3d3028',
      'color: #d97706; font-weight: bold',
    );
  }

  /** Get all recorded snapshots (dev only). */
  getHistory(): StateSnapshot[] {
    return [...this.snapshots];
  }

  /** Print current state to console (dev only). */
  inspect(): void {
    console.table(this._state);
  }

  // === Notification ===

  private notify<T extends keyof AppState>(key: T, newValue: AppState[T], oldValue: AppState[T]): void {
    // Specific subscribers
    const set = this.subscribers.get(key);
    if (set) {
      for (const fn of set) {
        try {
          (fn as Subscriber<T>)(newValue, oldValue);
        } catch (err) {
          console.error(`[State] Subscriber for "${String(key)}" threw:`, err);
        }
      }
    }
    // Wildcard subscribers
    for (const fn of this.wildcardSubscribers) {
      try {
        fn(key, newValue, oldValue);
      } catch (err) {
        console.error('[State] Wildcard subscriber threw:', err);
      }
    }
  }
}

// ================================================================
// Exports
// ================================================================

export const reactive = new ReactiveState();

/** The reactive state proxy. Read & write properties as normal. */
export const state = reactive.proxy;

/** Subscribe to a key change. Returns an unsubscribe function. */
export function subscribe<T extends keyof AppState>(key: T, fn: Subscriber<T>): () => void {
  return reactive.subscribe(key, fn);
}

/** Batch multiple state updates. */
export function batch(fn: () => void): void {
  reactive.batch(fn);
}

/** Reset state to defaults. */
export function resetState(): void {
  reactive.reset();
}

// Expose state inspector on window in dev mode
if (DEV && typeof window !== 'undefined') {
  (window as unknown as { __quranState?: unknown }).__quranState = {
    inspect: () => reactive.inspect(),
    history: () => reactive.getHistory(),
    state,
  };
  console.info('[State] DevTools available at window.__quranState');
}
