/**
 * Reactive Proxy implementation for the application state.
 *
 * Extracted from `state.ts` for clarity.
 */

import type { AppState } from './types.js';
import { createDefaultState } from './types.js';
import { recordChange, enterBatch, exitBatch, flushPendingChanges } from './subscriptions.js';
import { resetInternalState } from '../internal-state.js';

const _rawState: AppState = createDefaultState();

function createReactiveProxy(): AppState {
  return new Proxy(_rawState, {
    set(target: AppState, property: string, newValue: unknown): boolean {
      const key = property as keyof AppState;
      const oldValue = Reflect.get(target, key) as unknown;

      if (Object.is(oldValue, newValue)) {
        return true;
      }

      if (!(property in _rawState)) {
        console.warn(`[State] Setting unknown property "${property}" on state. Consider adding it to AppState.`);
      }

      Reflect.set(target, key, newValue);
      recordChange(key, newValue, oldValue);

      return true;
    },

    get(target: AppState, property: string): unknown {
      return Reflect.get(target, property);
    },
  });
}

export const state: AppState = createReactiveProxy();

export function setState<K extends keyof AppState>(partial: Pick<AppState, K>): void {
  for (const [key, newValue] of Object.entries(partial)) {
    Reflect.set(state, key, newValue);
  }
}

export function batch<T>(fn: () => T): T {
  enterBatch();
  try {
    return fn();
  } finally {
    exitBatch();
  }
}

export function resetState(): void {
  const defaults = createDefaultState();
  batch(() => {
    for (const [key, value] of Object.entries(defaults)) {
      Reflect.set(state, key, value);
    }
  });
  resetInternalState();
}

export function _flushForTests(): void {
  flushPendingChanges();
}

export function _getRawState(): AppState {
  return _rawState;
}
