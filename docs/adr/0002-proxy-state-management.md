# ADR 0002: Proxy-Based Reactive State Management

- **Status:** Accepted
- **Date:** 2026-05-31 (initial release v1.0.0)
- **Last reviewed:** 2026-09-21 (v3.1.20)
- **Supersedes:** —
- **Superseded by:** —

---

## Context

A reactive state system is essential for a client-side application. The UI
must update automatically when state changes — the user selects a surah,
presses play, toggles night mode, or the audio playback moves to the next
ayah. Without a framework (see ADR 0001), we needed a mechanism that
provides:

1. **Type-safe subscriptions** — a callback for `isPlaying` should receive
   `boolean`, not `unknown`.
2. **Batching** — multiple state changes should trigger a single
   notification, not N re-renders.
3. **NaN safety** — `NaN !== NaN` in JavaScript. A naive `===` comparison
   would cause infinite notification loops when a computation yields `NaN`.
4. **DevTools** — ability to inspect state history during development.
5. **Zero dependencies** — no external state library (Redux, Zustand,
  Preact Signals, etc.).

### Prior State

Before v1.6.0, the entire state system lived in a single `state.ts` file
(878 lines). It was functionally correct but hard to navigate. In v1.6.0,
the module was split into four focused files under `src/state/`.

---

## Decision

**We implemented a custom reactive state system using JavaScript `Proxy`.**

The system is modular, living in `src/state/`:

| File | Responsibility |
|------|----------------|
| `state/types.ts` | `AppState` interface, `createDefaultState()` factory, domain types |
| `state/subscriptions.ts` | Subscriber registry, `notifySubscribers()`, `batch()`, immutable helpers |
| `state/proxy.ts` | `Proxy` creation, `state` singleton, `setState()`, `resetState()` |
| `state/devtools.ts` | Development-mode inspection (`window.__quranState`) |
| `state.ts` (barrel) | Re-exports everything — existing imports unchanged |

### How It Works

#### 1. Proxy Creation

```typescript
// src/state/proxy.ts
const _rawState: AppState = createDefaultState();

function createReactiveProxy(): AppState {
  return new Proxy(_rawState, {
    set(target, property, newValue): boolean {
      const key = property as keyof AppState;
      const oldValue = Reflect.get(target, key);

      // NaN-safe change detection (Object.is instead of ===)
      if (Object.is(oldValue, newValue)) {
        return true; // No change — skip notification
      }

      Reflect.set(target, key, newValue);
      recordChange(key, newValue, oldValue);
      return true;
    },
    get(target, property): unknown {
      return Reflect.get(target, property);
    },
  });
}

export const state: AppState = createReactiveProxy();
```

#### 2. Type-Safe Subscriptions

```typescript
// Two overloads — typed (2-arg) and untyped (3-arg)
subscribe('isPlaying', (newVal: boolean, oldVal: boolean) => {
  dom.playBtn.textContent = newVal ? '⏸' : '▶';
});
```

The implementation detects whether the callback accepts 2 or 3 arguments
and wraps accordingly. This gives callers type safety without requiring a
generic parameter at the call site.

#### 3. Batching

```typescript
// src/state/subscriptions.ts
let _batchDepth = 0;
const _pendingChanges = new Map<string, PendingChange>();

function recordChange(key, newValue, oldValue): void {
  if (_batchDepth > 0) {
    // Defer — coalesce multiple changes to the same key
    const existing = _pendingChanges.get(key);
    if (existing) {
      existing.newValue = newValue; // Keep latest value
    } else {
      _pendingChanges.set(key, { key, newValue, oldValue });
    }
  } else {
    notifySubscribers(key, newValue, oldValue); // Immediate
  }
}

export function batch<T>(fn: () => T): T {
  enterBatch();
  try {
    return fn();
  } finally {
    exitBatch(); // Decrements depth; flushes when depth reaches 0
  }
}
```

Usage:

```typescript
batch(() => {
  state.currentSurah = 5;
  state.currentAyahIndex = 0;
  state.isPlaying = false;
});
// → Single notification flush after all three changes
```

#### 4. Immutable Update Helpers

Since there is no virtual DOM to diff, array and map mutations must create
new references to trigger Proxy `set`:

```typescript
immutablePush(state, 'favorites', newFavorite); // [...arr, item]
immutableSplice(state, 'favorites', index, 1);  // [...arr].splice(...)
immutableMapSet(state, 'tajweedCache', surahNum, data);
immutableFilter(state, 'favorites', (f) => f.id !== id);
```

#### 5. DevTools

In development mode, `installStateDevTools()` attaches a history tracker
to `window.__quranState`:

- `getStateHistory()` — log of all changes with timestamps.
- `clearStateHistory()` — reset the log.
- Missed-notification warnings — if a state property changes but has no
  subscribers, a console warning is emitted.

---

## Consequences

### Positive

- **Type safety** — `subscribe<K>(key, callback)` enforces that the callback
  receives the correct type for `state[K]`. No `any` casts.
- **NaN safety** — `Object.is(NaN, NaN) === true` prevents infinite loops
  that `===` would cause.
- **Batching** — `batch()` coalesces N changes into a single flush, reducing
  unnecessary DOM updates. Critical for the 3-phase bootstrap (ADR 0003)
  where multiple state properties are set in sequence.
- **Zero dependencies** — the entire system is ~170 lines of TypeScript
  across 4 files. No Redux, Zustand, or Preact Signals.
- **DevTools** — `window.__quranState` provides runtime introspection
  without adding a production dependency.
- **Immutable helpers** — prevent accidental in-place mutation of arrays
  and maps that would bypass the Proxy's `set` trap.

### Negative

- **Manual subscription management** — developers must remember to
  `subscribe()` and unsubscribe. Frameworks handle this via component
  lifecycle. Unsubscribed callbacks can leak.
- **No time-travel debugging** — unlike Redux DevTools, we only log changes
  without the ability to replay or revert.
- **Single global store** — all state lives in one `AppState` object. There
  is no slice-based isolation like Redux Toolkit. The `AppState` interface
  has grown large (~60 properties).
- **Proxy performance on large objects** — deep Proxy nesting is not used;
  only the top-level `AppState` is proxied. Nested objects are not reactive
  by default. This is a deliberate trade-off (simplicity over deep
  reactivity) but means nested mutations require `immutableMapSet()`.

### Mitigations

- The `AppState` interface in `state/types.ts` documents every property.
- `clearSubscribers()` is available for testing teardown.
- `_flushForTests()` and `_getRawState()` are test-only escape hatches.
- ESLint `no-console` in production builds prevents accidental state
  inspection.

---

## Alternatives Considered

### Redux Toolkit

- **Pros:** Mature, widely understood, time-travel DevTools, slice-based
  architecture.
- **Cons:** Adds ~12 KB gzip. Requires action/reducer boilerplate. The
  Proxy system already provides the same primitives (subscribe, batch,
  immutable updates) without the weight. Redux's single-direction data flow
  conflicts with our direct DOM mutation pattern.

### Zustand

- **Pros:** Tiny (~1 KB), hook-based, no boilerplate.
- **Cons:** Designed for React's `useSyncExternalStore`. In a
  non-React app, we'd use its vanilla API, which is essentially what our
  Proxy already provides — but with an extra dependency.

### Preact Signals

- **Pros:** Fine-grained reactivity, very small.
- **Cons:** Signals are a different paradigm (pull-based) from our
  push-based `subscribe()`. Migration would require rewriting all
  subscriber call sites.

### Valtio (Proxy-based)

- **Pros:** Also uses `Proxy` — conceptually identical to our approach.
- **Cons:** Adds a dependency for something we already built. Valtio's
  deep proxy nesting (every object is proxied) adds overhead we avoid by
  only proxying the top level.

---

## References

- [`src/state/proxy.ts`](../../src/state/proxy.ts) — Proxy implementation
- [`src/state/subscriptions.ts`](../../src/state/subscriptions.ts) — subscriber registry
- [`src/state/types.ts`](../../src/state/types.ts) — `AppState` interface
- [`src/state/devtools.ts`](../../src/state/devtools.ts) — DevTools
- [`src/state.ts`](../../src/state.ts) — barrel re-exports
- [`src/internal-state.ts`](../../src/internal-state.ts) — non-reactive internal counters
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — state usage examples
- [ADR 0001](./0001-no-framework-architecture.md) — no-framework decision
