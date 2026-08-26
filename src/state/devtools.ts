/**
 * State DevTools — development-mode debugging utilities for the reactive state.
 *
 * Extracted from `state.ts` for clarity.
 */

import { subscribeAll, clearSubscribers } from './subscriptions.js';
import { resetState, _getRawState } from './proxy.js';

interface StateSnapshot {
  timestamp: number;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  stack?: string;
}

const MAX_SNAPSHOTS = 50;
const _snapshots: StateSnapshot[] = [];
let _devtoolsInstalled = false;
let _devLoggingEnabled = false;

export function installStateDevTools(): void {
  if (_devtoolsInstalled) {
    return;
  }
  _devtoolsInstalled = true;

  const isDev =
    typeof import.meta !== 'undefined' &&
    import.meta.env != null &&
    (import.meta.env as { DEV?: boolean }).DEV === true;

  if (!isDev) {
    console.warn('[State DevTools] Skipped in production build.');
    return;
  }

  _devLoggingEnabled = true;

  subscribeAll((newValue, oldValue, key) => {
    recordSnapshot(key, oldValue, newValue);
  });

  if (typeof window !== 'undefined') {
    (window as unknown as { __quranState?: unknown }).__quranState = {
      inspect: () => {
        console.warn('[State DevTools] Current state:', _getRawState());
        return _getRawState();
      },
      history: (): StateSnapshot[] => {
        console.warn('[State DevTools] History (last 50 changes):');
        for (const snap of _snapshots) {
          const time = new Date(snap.timestamp).toLocaleTimeString();
          console.warn(`[State DevTools] ${time} ${snap.key}:`, snap.oldValue, '→', snap.newValue);
        }
        return [..._snapshots];
      },
      getSnapshot: (index: number): StateSnapshot | null => {
        return _snapshots[index] ?? null;
      },
      subscribe: (callback: (newValue: unknown, oldValue: unknown, key: string) => void): (() => void) => {
        return subscribeAll(callback);
      },
      reset: () => {
        resetState();
        _snapshots.length = 0;
        console.warn('[State DevTools] State reset to defaults.');
      },
      clearHistory: () => {
        _snapshots.length = 0;
        console.warn('[State DevTools] History cleared.');
      },
      toggleLogging: (): boolean => {
        _devLoggingEnabled = !_devLoggingEnabled;
        console.warn(`[State DevTools] Logging ${_devLoggingEnabled ? 'enabled' : 'disabled'}.`);
        return _devLoggingEnabled;
      },
      getState: () => {
        return { ..._getRawState() };
      },
    };
    console.warn('[State DevTools] Available at window.__quranState');
    console.warn('[State DevTools] Try: __quranState.inspect() or __quranState.history()');
  }
}

function recordSnapshot(key: string, oldValue: unknown, newValue: unknown): void {
  const snapshot: StateSnapshot = {
    timestamp: Date.now(),
    key,
    oldValue,
    newValue,
    stack: new Error().stack?.split('\n').slice(2, 6).join('\n'),
  };
  _snapshots.push(snapshot);
  if (_snapshots.length > MAX_SNAPSHOTS) {
    _snapshots.shift();
  }

  if (_devLoggingEnabled) {
    const isPrimitive = typeof newValue !== 'object' || newValue === null;
    const displayNew = isPrimitive ? newValue : '[object]';
    const displayOld = typeof oldValue !== 'object' || oldValue === null ? oldValue : '[object]';
    console.warn(`[State] ${key}:`, displayOld, '→', displayNew);
  }
}

export function getStateHistory(): StateSnapshot[] {
  return [..._snapshots];
}

export function clearStateHistory(): void {
  _snapshots.length = 0;
}

export function isDevToolsInstalled(): boolean {
  return _devtoolsInstalled;
}

export function _resetDevToolsForTests(): void {
  _snapshots.length = 0;
  _devtoolsInstalled = false;
  _devLoggingEnabled = false;
  clearSubscribers();
}
