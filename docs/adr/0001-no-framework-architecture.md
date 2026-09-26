# ADR 0001: No-Framework Architecture (Vanilla TypeScript + Custom Proxy)

- **Status:** Accepted
- **Date:** 2026-05-31 (initial release v1.0.0)
- **Last reviewed:** 2026-09-21 (v3.1.20)
- **Supersedes:** —
- **Superseded by:** —

---

## Context

The Quran App is a feature-rich Progressive Web App (PWA) that also ships as
an Android application via Capacitor. It offers reading, audio playback,
search, tafsir, prayer times, adhkar, mushaf mode, and presentation mode —
all within a single client-side bundle.

When the project was initiated, the team evaluated three approaches:

1. **React / Vue / Svelte** — component-based frameworks with virtual DOM.
2. **Lit / Web Components** — lightweight custom-element libraries.
3. **Vanilla TypeScript + Custom Proxy** — no framework, direct DOM
   manipulation with a custom reactive state layer.

### Driving Forces

| Factor                          | Framework                                            | Vanilla TS                                   |
| ------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| Initial bundle size             | 40–60 KB+ runtime (React DOM)                        | 0 KB runtime overhead                        |
| Performance budget              | Must keep gzip < 300 KB                              | Easier to stay under budget                  |
| First Contentful Paint          | Framework hydration adds latency                     | Direct DOM render is immediate               |
| Offline-first / PWA             | Extra weight in precache                             | Smaller precache (17 MB → 0.56 MB in v2.1.0) |
| Capacitor WebView               | Framework runtime consumes memory on low-end devices | Minimal memory footprint                     |
| Full control over render timing | Frameworks schedule renders                          | Direct control via `requestIdleCallback`     |
| Dependency surface              | React + ReactDOM + potential ecosystem deps          | Zero framework dependencies                  |

### Constraints

- The app targets low-end Android devices via Capacitor — memory and CPU are
  constrained.
- The performance budget (`performance-budget.json`) enforces a 300 KB gzip
  threshold on the initial bundle.
- Lighthouse CI enforces performance thresholds: FCP ≤ 3000 ms, LCP ≤ 4000 ms,
  TBT ≤ 600 ms (informational), accessibility ≥ 90 (mandatory).
- The project uses Vite 8 with `manualChunks` code-splitting — frameworks
  add a large `vendor` chunk that is harder to split.

---

## Decision

**We chose Vanilla TypeScript + a Custom Proxy-based reactive state system.**

The application is built entirely with:

- **TypeScript 5.9** in strict mode (`strict: true`, `noImplicitAny`,
  `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`).
- **Direct DOM manipulation** — elements are cached in a `dom` object via
  `cacheDom()` (see `src/dom.ts`). No virtual DOM diffing.
- **A custom reactive `Proxy`** (see ADR 0002) that provides type-safe
  subscriptions, batching, and immutable updates — the same primitives a
  framework offers, but without the runtime cost.
- **XSS-safe HTML templates** — all dynamic text passes through
  `escapeHtml()` before insertion (see `src/templates.ts` and
  `src/utils.ts`). This replaces JSX's built-in escaping.
- **Lazy overlay injection** — large templates (settings, player, keyboard,
  help) are injected via JavaScript before `cacheDom()` to reduce initial
  HTML by ~375 lines (see `src/overlays.ts`).

### What We Gave Up

| Framework Feature              | Our Replacement                                       |
| ------------------------------ | ----------------------------------------------------- |
| JSX / template syntax          | Template literal strings + `escapeHtml()`             |
| Virtual DOM diffing            | Direct DOM updates via `subscribe()` callbacks        |
| Component lifecycle hooks      | Explicit init functions in 3-phase bootstrap          |
| React.lazy / Suspense          | Dynamic `import()` + `requestIdleCallback`            |
| React DevTools                 | Custom `state/devtools.ts` with `window.__quranState` |
| Ecosystem (React Router, etc.) | Custom navigation, keyboard, a11y modules             |

### Build Configuration

Vite handles code-splitting without a framework's automatic chunking:

```js
// vite.config.js — manualChunks splits by feature, not by component tree
manualChunks(id) {
  if (id.includes('/features/mushaf/')) return 'feature-mushaf';
  if (id.includes('/features/presentation/')) return 'feature-presentation';
  if (id.includes('/tajweed')) return 'feature-tajweed';
  if (id.includes('/search-')) return 'feature-search';
  // ...
}
```

Tree-shaking is maximized via `"sideEffects": false` in `package.json` and
`treeshake: { moduleSideEffects: false }` in the Vite config.

---

## Consequences

### Positive

- **Zero framework runtime** — the entire app ships in a fraction of what a
  React equivalent would weigh. Precache was reduced from 17 MB to 0.56 MB
  (97% reduction) in v2.1.0.
- **Full control over rendering** — the 3-phase bootstrap (ADR 0003) can
  bind events before the first surah loads, something frameworks make
  difficult because rendering and event binding are coupled.
- **No framework upgrades** — no React 17→18→19 migration risk. No breaking
  changes from external maintainers.
- **Simpler CI** — no need for framework-specific testing utilities
  (Testing Library, MSW for React, etc.). Vitest + jsdom suffices.
- **Lower memory on mobile** — Capacitor WebView runs without a framework's
  runtime heap. Canvas memory was reduced from 6.6 MB → 2.9 MB on mobile.

### Negative

- **Higher implementation effort for UI** — every DOM update is manual.
  The team must discipline itself to use `subscribe()` callbacks and
  `escapeHtml()` consistently.
- **Large source files** — `templates.ts` (~53 KB), `surah-loader.ts`
  (~42 KB), and `audio.ts` (~29 KB) are larger than equivalent framework
  components because logic and rendering are colocated.
- **No component reuse ecosystem** — we cannot drop in a community component
  (e.g., a date picker). Every UI element is hand-built.
- **Steeper onboarding** — new contributors familiar with React must learn
  the custom state system and template conventions (documented in
  `CONTRIBUTING.md` and `AGENTS.md`).
- **Manual accessibility** — ARIA attributes, focus traps, and screen reader
  support are hand-coded in `src/a11y.ts` rather than inherited from a
  framework's accessibility primitives.

### Mitigations

- `CONTRIBUTING.md` and `AGENTS.md` document the architecture extensively.
- `ESLint` enforces `eqeqeq`, `curly: all`, `no-cond-assign`,
  `default-case`.
- `knip` detects dead code and unused exports.
- 4,018 Vitest cases across 149 files guard against regressions, backed by a
  cross-browser Playwright E2E suite — 441 cases across 28 spec files
  (chromium / firefox / webkit / mobile-chrome).
- `escapeHtml()` is mandatory and enforced by code review.

---

## Alternatives Considered

### React 19 + Vite

- **Pros:** Rich ecosystem, JSX ergonomics, React Server Components,
  concurrent rendering.
- **Cons:** React DOM adds ~40 KB gzip. Hydration latency conflicts with the
  300 KB budget and FCP target. React 19's concurrent features add
  unpredictability to the 3-phase bootstrap timing.
- **Rejected because:** The performance budget and low-end Android target
  made the framework overhead unacceptable.

### Lit (Web Components)

- **Pros:** Smaller runtime (~5 KB), native browser APIs, shadow DOM
  encapsulation.
- **Cons:** Shadow DOM complicates global theming (the app has 4 visual
  themes with CSS variables). Lit's reactive properties overlap with our
  custom Proxy — two reactive systems would conflict.
- **Rejected because:** Shadow DOM's style isolation conflicts with the
  app's global theme system.

### Svelte 5

- **Pros:** Compile-time framework — zero runtime cost. Reactive
  declarations.
- **Cons:** Svelte's compiler would own the reactive system, conflicting
  with our custom Proxy. Svelte's `.svelte` single-file format would require
  migrating all 56 TypeScript modules. SvelteKit adds its own router and
  build pipeline.
- **Rejected because:** Migration cost is high and the reactive model
  overlaps with our existing Proxy system.

---

## References

- [`src/main.ts`](../../src/main.ts) — entry point
- [`src/app.ts`](../../src/app.ts) — 3-phase bootstrap orchestrator
- [`src/state/proxy.ts`](../../src/state/proxy.ts) — Proxy implementation
- [`src/dom.ts`](../../src/dom.ts) — cached DOM references
- [`src/templates.ts`](../../src/templates.ts) — XSS-safe HTML templates
- [`src/overlays.ts`](../../src/overlays.ts) — lazy overlay injection
- [`vite.config.js`](../../vite.config.js) — build configuration
- [`AGENTS.md`](../../AGENTS.md) — AI agent guide
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — contributor guide
- Lighthouse CI (2026-09, GitHub Actions build): Performance 96,
  Accessibility 99, Best Practices 100, SEO 100
