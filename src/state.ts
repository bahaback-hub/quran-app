/**
 * Reactive State Management for Quran App — Barrel Module.
 *
 * This file re-exports everything from the modular state implementation
 * under `src/state/`. All existing imports of `./state.js` continue to
 * work without modification.
 *
 * The implementation is split into four modules for clarity:
 *   - `state/types.ts`         — Domain entry interfaces, AppState, defaults factory
 *   - `state/subscriptions.ts` — Subscriber registry, notification, batch helpers
 *   - `state/proxy.ts`         — Proxy creation, state singleton, setState/batch/resetState
 *   - `state/devtools.ts`      — Development-mode DevTools (window.__quranState)
 */

export type {
  SurahInfo,
  FavoriteEntry,
  BookmarkEntry,
  QuranTextEntry,
  SelectedAyah,
  SurahOffset,
  BackgroundEntry,
  SearchWord,
  AudioStateSlice,
  PrayerStateSlice,
  SurahStateSlice,
  UIStateSlice,
  MushafStateSlice,
  SearchStateSlice,
  AdhkarStateSlice,
  AppState,
  PendingChange,
} from './state/types.js';
export { createDefaultState } from './state/types.js';

export type { StateChangeCallback, TypedStateChangeCallback } from './state/subscriptions.js';
export {
  subscribe,
  subscribeAll,
  immutablePush,
  immutableSplice,
  immutableMapSet,
  immutableMapDelete,
  immutableFilter,
  clearSubscribers,
} from './state/subscriptions.js';

export { state, setState, batch, resetState } from './state/proxy.js';

export { installStateDevTools, getStateHistory, clearStateHistory, isDevToolsInstalled } from './state/devtools.js';
