/**
 * Subscription system for the reactive state.
 *
 * Extracted from `state.ts` for clarity.
 */

import type { AppState } from './types.js';
import type { PendingChange } from './types.js';

export type StateChangeCallback = (newValue: unknown, oldValue: unknown, key: string) => void;
export type TypedStateChangeCallback<K extends keyof AppState> = (newValue: AppState[K], oldValue: AppState[K]) => void;

const subscribers = new Map<string, StateChangeCallback[]>();
const wildcardSubscribers: StateChangeCallback[] = [];

let _batchDepth = 0;
const _pendingChanges: Map<string, PendingChange> = new Map();

export function subscribe<K extends keyof AppState>(key: K, callback: TypedStateChangeCallback<K>): () => void;
export function subscribe(key: string, callback: StateChangeCallback): () => void;
export function subscribe(
  key: string,
  callback: StateChangeCallback | TypedStateChangeCallback<keyof AppState>,
): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, []);
  }
  const wrapped: StateChangeCallback =
    'length' in callback && callback.length <= 2
      ? (nv: unknown, ov: unknown, _k: string) =>
          (callback as TypedStateChangeCallback<keyof AppState>)(
            nv as AppState[keyof AppState],
            ov as AppState[keyof AppState],
          )
      : (callback as StateChangeCallback);

  subscribers.get(key)!.push(wrapped);

  return () => {
    const list = subscribers.get(key);
    if (list) {
      const idx = list.indexOf(wrapped);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    }
  };
}

export function subscribeAll(callback: StateChangeCallback): () => void {
  wildcardSubscribers.push(callback);
  return () => {
    const idx = wildcardSubscribers.indexOf(callback);
    if (idx !== -1) {
      wildcardSubscribers.splice(idx, 1);
    }
  };
}

export function notifySubscribers(key: string, newValue: unknown, oldValue: unknown): void {
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

export function flushPendingChanges(): void {
  for (const [, change] of _pendingChanges) {
    notifySubscribers(change.key, change.newValue, change.oldValue);
  }
  _pendingChanges.clear();
}

export function recordChange(key: string, newValue: unknown, oldValue: unknown): void {
  if (_batchDepth > 0) {
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

export function enterBatch(): void {
  _batchDepth++;
}

export function exitBatch(): void {
  _batchDepth--;
  if (_batchDepth === 0) {
    flushPendingChanges();
  }
}

export function getBatchDepth(): number {
  return _batchDepth;
}

export function immutablePush<K extends keyof AppState>(
  target: AppState,
  key: K,
  ...items: AppState[K] extends Array<infer T> ? T[] : never
): void {
  const arr = target[key] as unknown[];
  Reflect.set(target, key, [...arr, ...items]);
}

export function immutableSplice<K extends keyof AppState>(
  target: AppState,
  key: K,
  start: number,
  deleteCount: number = 1,
): void {
  const arr = target[key] as unknown[];
  const next = [...arr];
  next.splice(start, deleteCount);
  Reflect.set(target, key, next);
}

export function immutableMapSet<K extends keyof AppState>(
  target: AppState,
  key: K,
  mapKey: AppState[K] extends Map<infer _MK, infer _MV> ? _MK : never,
  mapValue: AppState[K] extends Map<infer _MK2, infer _MV2> ? _MV2 : never,
): void {
  const map = new Map(target[key] as Map<unknown, unknown>);
  map.set(mapKey, mapValue);
  Reflect.set(target, key, map);
}

export function immutableMapDelete<K extends keyof AppState>(
  target: AppState,
  key: K,
  mapKey: AppState[K] extends Map<infer _MK3, infer _MV3> ? _MK3 : never,
): void {
  const map = new Map(target[key] as Map<unknown, unknown>);
  map.delete(mapKey);
  Reflect.set(target, key, map);
}

export function immutableFilter<K extends keyof AppState>(
  target: AppState,
  key: K,
  predicate: AppState[K] extends Array<infer T> ? (value: T, index: number, array: T[]) => unknown : never,
): void {
  const arr = target[key] as unknown[];
  Reflect.set(target, key, arr.filter(predicate as (value: unknown, index: number, array: unknown[]) => unknown));
}

export function clearSubscribers(): void {
  subscribers.clear();
  wildcardSubscribers.length = 0;
}
