# ADR 0003: Three-Phase Bootstrap

- **Status:** Accepted
- **Date:** 2026-05-31 (initial release v1.0.0)
- **Last reviewed:** 2026-09-21 (v3.1.20)
- **Supersedes:** —
- **Superseded by:** —

---

## Context

A Quran application has a tension between two goals:

1. **Show content fast** — the reader should see the first surah as quickly
   as possible after the page loads.
2. **Bind all interactions** — the reader should be able to navigate, play
   audio, search, and use keyboard shortcuts without waiting for every
   feature module to initialize.

If we load everything before showing anything (the "waterfall" approach),
First Contentful Paint (FCP) suffers. If we show content before binding
events (the "render-first" approach), the reader may click a button that
does nothing because the handler is not yet attached — a race condition.

### Specific Challenges

- **Deep links** (`#surah=2/255`) must resolve before the initial surah
  load, but parsing a deep link is synchronous and cheap.
- **Last saved position** — a returning reader expects to land on the
  surah/ayah they were reading, not Al-Fatiha.
- **Offline detection** — if the reader is offline, the search index must
  be preloaded synchronously before any surah load attempt.
- **Event binding races** — E2E tests (Playwright) are deterministic only
  if events are bound before the first surah resolves. A surah-change event
  fired during boot must be handled, not dropped.
- **Feature modules** — Mushaf mode, Presentation mode, and Ayah Modal are
  large (~29 KB each). Loading them synchronously blocks initial render.
- **Capacitor** — on Android, the app boots inside a WebView. The splash
  screen must hide only after the first paint.

---

## Decision

**We use a three-phase bootstrap in `src/app.ts` → `initApp()`.**

```
Phase 1 — Critical Path      (synchronous, blocking)
Phase 2 — Post-render helpers (depends on rendered surah)
Phase 3 — Deferred            (requestIdleCallback)
```

### Phase 1: Critical Path

Everything the reader needs to see and interact with immediately:

```
initState()                    → reset state to defaults
injectOverlays()               → inject overlay HTML (player, settings, help)
cacheDom()                     → cache all DOM element references
applyTranslations()            → apply current language to injected overlays
restoreSettings()              → restore user settings from localStorage
initSystemThemeDetection()     → detect prefers-color-scheme
populateReciterSelect()        → populate reciter dropdown
await loadSurahList()           → fetch 114 surah metadata (or local fallback)
buildSurahOffsets()            → compute absolute ayah offsets for navigation
if (!navigator.onLine)
  await loadFullQuranText()     → preload search index for offline
bindAudioEvents()               → wire audio play/pause/next/prev
bindAllEvents()                 → wire toolbar, navigation, panels
initAutoPlayNextButton()        → wire continuous-play toggle
initNavigation()                → wire surah navigation system
initKeyboardShortcuts()         → wire keyboard shortcuts (Space, arrows, etc.)
parseDeepLink() / loadSurah()   → resolve #surah=N or last_position
preloadTajweedIfNeeded()        → preload current surah's tajweed chunk (no-op if disabled)
```

**Key insight:** Events are bound *before* the first surah load resolves.
This means the reader can navigate the surah dropdown, use keyboard
shortcuts, or click play while the network fetch is still in flight. The
event handler is ready; it simply operates on whatever surah data is
available.

### Phase 2: Post-Render Helpers

Tasks that depend on a rendered surah being in the DOM:

- `hashchange` listener for runtime deep-link navigation.
- `initCapacitorBackButton()` — Android hardware back button.
- `initToggleSwitchAccessibility()` — ARIA for toggle switches.
- `initReducedMotionDetection()` — respect `prefers-reduced-motion`.
- Language switcher initialization.
- Player state restoration (collapsed/expanded).
- Network status monitoring (`online`/`offline`/`visibilitychange`).
- Scroll-linked reading progress bar.

### Phase 3: Deferred (requestIdleCallback)

Tasks that improve the experience but are not needed for first interaction.
Grouped by priority — each group defers to the next idle period:

```
Group 1 (lightweight, no network):
  initAdhkarState()
  loadAdhkarSettings()
  loadFavorites()

Group 2 (lightweight, starts intervals):
  startClock()
  scheduleNextAzanCheck()

Group 3 (network-dependent, non-blocking):
  startAdhkarNotificationScheduler()
  loadPrayerTimes()

Group 4 (heavy feature modules, lazy-imported):
  import('./ayah-modal.js')        → initAyahModal()
  import('./presentation.js')      → initPresentation()
  import('./mushaf.js')            → populateSurahOverlay()
```

Group 4 uses `safeLoad()` from `error-boundary.ts` — a retry mechanism
with user-visible error UI instead of silent `console.error`.

### Non-Critical Modules (from `main.ts`)

In `src/main.ts`, two additional modules are loaded lazily after the
browser is idle:

```
import('./web-vitals.js')     → initWebVitalsMonitoring()
import('./memory-manager.ts') → initMemoryManager()
```

These use `requestIdleCallback` with a 3-second timeout fallback to
`setTimeout(load, 2000)`.

### Fallback for Non-supporting Browsers

```typescript
const scheduleIdle =
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 1);
```

---

## Consequences

### Positive

- **FCP ≤ 0.7 s** (Lighthouse, local build) — Phase 1 is tight and
  synchronous.
- **No event race conditions** — events are bound before the first surah
  resolves, making E2E tests deterministic (a key fix in v3.0.0).
- **INP improvement** — deferring Groups 1–4 to idle periods yields the main
  thread back to the reader immediately.
- **Lazy feature loading** — Mushaf, Presentation, and Ayah Modal (~87 KB
  combined) are only loaded when the browser is idle.
- **Graceful degradation** — `safeLoad()` retry + error UI means a failed
  dynamic import doesn't silently break a feature.

### Negative

- **Phase 1 is long** — it includes `await loadSurahList()` and potentially
  `await loadFullQuranText()`. On a slow network, Phase 1 could take
  several seconds. The loading bar (`loadingBar.init()` in Phase 3) is not
  shown until Phase 3, meaning the reader sees a blank page during Phase 1
  on slow connections.
- **Complexity** — `initApp()` is 250 lines and the ordering is fragile.
  A contributor adding a new feature must understand which phase it belongs
  in. Moving a task from Phase 1 to Phase 3 (or vice versa) without
  understanding dependencies can cause subtle bugs.
- **`requestIdleCallback` is not universally available** — Safari < 17 does
  not support it. The fallback to `setTimeout(cb, 1)` works but is less
  optimal (runs immediately rather than when idle).

### Mitigations

- `AGENTS.md` documents the three phases and lists each file's phase.
- `CONTRIBUTING.md` has a section on "Adding a new feature" with step-by-step
  guidance on which phase to use.
- E2E tests mock all network calls (`e2e/fixtures/mock-network.ts`), so
  Phase 1 timing is deterministic in tests.
- Skeleton loading (`skeletonLoading()` in `templates.ts`) shows a
  placeholder while the surah fetch is in progress.

---

## Alternatives Considered

### Single-phase (load everything, then show)

- **Pros:** Simpler code — one `init()` function.
- **Cons:** FCP would be significantly worse. Loading Mushaf + Presentation +
  Audio + Prayer + Adhkar before showing the first surah would add 2–4
  seconds to first paint.
- **Rejected because:** Lighthouse performance budget and the 300 KB
  bundle threshold require aggressive deferral.

### Render-first (show content, then bind events)

- **Pros:** Fastest possible FCP.
- **Cons:** Race conditions — the reader can interact with the UI before
  events are bound. E2E tests become flaky. A reader clicking "next surah"
  during the 200 ms window between render and event binding would see
  nothing happen.
- **Rejected because:** Deterministic E2E tests (v3.0.0 overhaul) require
  events to be bound before the first surah resolves.

### Framework-driven lifecycle (React useEffect)

- **Pros:** The framework decides when to run effects based on render
  commits.
- **Cons:** We don't use a framework (ADR 0001). Even if we did, React's
  `useEffect` runs after paint, which is equivalent to our Phase 2 — but
  without control over ordering between effects.
- **Rejected because:** Incompatible with the no-framework architecture.

---

## References

- [`src/app.ts`](../../src/app.ts) — `initApp()` implementation (333 lines)
- [`src/main.ts`](../../src/main.ts) — entry point, `loadNonCriticalModules()`
- [`src/app-events.ts`](../../src/app-events.ts) — event bindings
- [`src/overlays.ts`](../../src/overlays.ts) — lazy overlay injection
- [`src/error-boundary.ts`](../../src/error-boundary.ts) — `safeLoad()`
- [`e2e/fixtures/mock-network.ts`](../../e2e/fixtures/mock-network.ts) — network mocking
- [`AGENTS.md`](../../AGENTS.md) — bootstrap documentation
- [`CHANGELOG.md`](../../CHANGELOG.md) — v3.0.0 "Radical E2E Fix"
- [ADR 0001](./0001-no-framework-architecture.md) — no-framework decision
