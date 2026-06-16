# Quran App — Project Guide for AI Agents

> **Honest snapshot of the codebase as of v1.5.0.** Read this BEFORE making changes.

## Commands
- `npm run dev` — Start Vite dev server
- `npm run build` — Vite production build (with code splitting, tree shaking)
- `npm test` — Run all Vitest unit tests
- `npm test -- --coverage` — Run tests with coverage report
- `npm run test:e2e` — Run Playwright E2E tests (chromium)
- `npm run test:a11y` — Run accessibility audit (builds + serves + axe-core)
- `npm run typecheck` — TypeScript type check (`tsc --noEmit -p tsconfig.ci.json`)
- `npm run lint` — ESLint check
- `npm run lint:fix` — ESLint auto-fix
- `npm run format` — Prettier format
- `npm run docs` — Generate TypeDoc API documentation
- `npm run android:build` — Build web + sync with Capacitor
- `npm run android:open` — Open Android Studio
- `npm run android:run` — Build, sync, and run on connected device

## Architecture

### Build & Module System
- **Vite 8 + LightningCSS** for production builds, with `manualChunks` code-splitting
  (vendor, i18n, mushaf, presentation, tajweed, search, prayer).
- **PWA**: `vite-plugin-pwa` (Workbox) with `registerType: 'prompt'`,
  CacheFirst for Quran/Tafsir/Audio/Fonts, StaleWhileRevalidate for APIs,
  `share_target`, `shortcuts`, `screenshots`.
- **Android (Capacitor 8)**: `android/` dir wraps the web app as a native APK/AAB.
  When running inside Capacitor, the Service Worker is **explicitly disabled**
  (it breaks WebView) and any previously-registered SW is unregistered.
- **Web Deployment**: GitHub Actions → `actions/deploy-pages@v4` from `dist/`.
  User must enable "GitHub Pages → GitHub Actions" in repo settings.

### Three-Phase Bootstrap (`src/app.ts`)
1. **Critical path**: state init → DOM cache → settings → surah list → load first surah
2. **Event binding**: navigation, keyboard, a11y, i18n
3. **Deferred tasks** (via `requestIdleCallback`): clock, prayer, adhkar, favorites, modals, search index

### Reactive State (`src/state.ts`) — **Proxy-based, no framework**
- `state` is a `Proxy`-wrapped typed object (`AppState` interface)
- `state.xxx = yyy` automatically notifies subscribers
- `setState(partial)` — batch update
- `subscribe<K>(key, callback)` — type-safe per-key subscription
- `subscribeAll(callback)` — react to any change
- `batch(fn)` — defer notifications until fn completes
- `resetState()` — clean reset to defaults
- **NaN-safe**: uses `Object.is()` instead of `===` for change detection
- Dev-mode logging warns about missed notifications

**Important**: This is NOT `export let state = {}` anymore — it is a Proxy.
Do NOT reassign `state`; mutate its properties.

## TypeScript Configuration (`tsconfig.json`)

**Strict mode is maxed out.** The project does NOT use `allowJs` or `checkJs`:

```jsonc
{
  "compilerOptions": {
    "allowJs": false,
    "checkJs": false,
    "strict": true,
    "noImplicitAny": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "exactOptionalPropertyTypes": false  // only option relaxed
  }
}
```

- Type-check with `npm run typecheck` — must pass with 0 errors
- Global type declarations in `src/global.d.ts`
- The `AppState` interface in `src/state.ts` enumerates all reactive properties

## Module Files (`src/`)

There are **~56 TypeScript source files** (excluding tests and translations).
Key modules:

| File | Purpose |
|------|---------|
| `main.ts` | Entry point — error boundary, SW registration, Capacitor init |
| `app.ts` | 3-phase bootstrap orchestrator + `initApp()` |
| `app-events.ts` | Event bindings (separated from `app.ts`) |
| `state.ts` | Reactive `state` Proxy + `subscribe`/`batch`/`setState` |
| `internal-state.ts` | Non-reactive internal counters/flags |
| `api-client.ts` | Unified HTTP client: timeout (15s), retry (2x on 5xx), dedup, AbortController, Arabic error classification |
| `error-boundary.ts` | Global error handler + error log persistence |
| `dom.ts` | Cached DOM element references via `cacheDom()` |
| `ui.ts` / `ui-extras.ts` | Toast, loading bar, UI utilities |
| `utils.ts` | `escapeHtml`, `toArabicNumeral`, etc. |
| `storage.ts` | Safe `localStorage` wrapper |
| `config.ts` | Constants (API URLs, defaults) |
| `i18n.ts` | Internationalization (ar/en/tr/ms/id) + RTL/LTR dynamic switching |
| `templates.ts` | **Large file (~53KB)** — XSS-safe HTML templates |
| `overlays.ts` | Lazy template injection before `cacheDom()` |
| `surah-loader.ts` | **Large file (~42KB)** — surah loading, rendering, caching, offsets |
| `surahs-data.ts` | Static surah metadata (~50KB) |
| `audio.ts` | Advanced audio player (~29KB) — word tracking, hifdh, repeat, sleep timer |
| `audio-cache.ts` | IndexedDB audio cache with LRU eviction (200MB cap) |
| `audio-visualizer.ts` | Canvas-based audio visualizer |
| `mushaf.ts` / `mushaf-renderer.ts` | Mushaf mode (QCF V4 Canvas, 604 pages) |
| `presentation.ts` / `pres-backgrounds.ts` | Presentation mode + Canvas backgrounds |
| `search-core.ts` / `search-ui.ts` | Trie-based search engine + UI |
| `prayer.ts` / `prayer-local.ts` | Prayer times (Aladhan API + local `adhan` lib) + Qibla compass |
| `tafsir.ts` | 6 tafsirs with 3-tier loading (local → IDB → API) |
| `tajweed.ts` / `tajweed-data.ts` | 18 tajweed color rules |
| `reciters.ts` | +30 reciters catalog |
| `adhkar.ts` / `adhkar-data.ts` / `adhkar-notifications.ts` | Adhkar panel, data, scheduled notifications |
| `favorites.ts` | Favorites + bookmarks + export (.txt/.json) |
| `settings.ts` | Settings panel + import/export with type validation |
| `keyboard.ts` | Keyboard shortcuts + on-screen Arabic keyboard |
| `navigation.ts` | Navigation system |
| `a11y.ts` | Accessibility utilities (focus trap, ARIA live, reduced-motion) |
| `ayah-modal.ts` / `ayah-click.ts` | Ayah detail modal + click handling |
| `capacitor-back.ts` | Android back-button handling |
| `onboarding.ts` | First-run onboarding |

### Known Large Files (Refactor Candidates)
These files are large and would benefit from being split by feature:
- `templates.ts` (~53KB)
- `surahs-data.ts` (~50KB) — static data, acceptable
- `surah-loader.ts` (~42KB)
- `adhkar-data.ts` (~31KB) — static data, acceptable
- `audio.ts` (~29KB)
- `mushaf-renderer.ts` (~29KB)
- `pres-backgrounds.ts` (~22KB)

## DOM Conventions
- All DOM references cached in `dom` object via `cacheDom()` in `src/dom.ts`
- Elements referenced by `id` matching the property name
- Heavy templates (settings, player, keyboard, help) are **lazy-injected** via JS
  before `cacheDom()` to reduce initial HTML by ~375 lines

## Code Conventions
- Function declarations (not arrow/const) for hoisting within each module
- Explicit imports for all cross-module functions
- All mutable module state lives on `state` (the Proxy) — not on local `let`s
- All HTML output goes through `escapeHtml()` (XSS-safe)
- No `any` types — strict TS enforced
- ESLint rules: `eqeqeq`, `curly: all`, `no-cond-assign`, `default-case`

## Testing

### Unit Tests (`src/__tests__/`)
- **Vitest 4** + `jsdom` + `fake-indexeddb`
- ~90 test files covering all modules
- **Coverage threshold: ≥ 80% lines** (enforced in CI)
- Per-file coverage gaps are tracked (not just the total)

### Known Test Limitations
- `jsdom` cannot truly exercise `Canvas`, `AudioContext`, `ServiceWorker`,
  `DeviceOrientation`, or `MediaSession` — these features have limited
  behavioral coverage in unit tests. E2E (Playwright) supplements this.

### Coverage Integrity (Important)
- **No "coverage-booster" pattern**: tests must verify behavior, not just
  `typeof === 'function'`. If you need to raise coverage, write real
  behavioral scenarios (load → mutate → assert effect).
- Each test file should be named after the module under test (e.g.
  `audio.test.ts` for `audio.ts`), not after the goal of "boosting coverage".

### E2E Tests (`e2e/`)
- **Playwright 1.60** (chromium) — exercises real browser behavior
- Covers critical paths: navigation, audio playback, search, prayer times

## CDN & External APIs
- **QCF V4 fonts + layout JSON**: jsDelivr / GitHub raw
- **Quran text**: AlQuran.cloud API
- **Audio per-ayah**: quran.com API (with word-level timings)
- **Audio full-surah**: mp3quran.net
- **Tafsir**: Tafsir API (jsDelivr-hosted)
- **Prayer times**: Aladhan API + local `adhan` library (fallback)

All external calls go through `api-client.ts` (`safeFetch`) with timeout,
retry, and dedup. IndexedDB caches reduce network dependence for offline use.

## CI/CD Workflows (`.github/workflows/`)

11 workflows total: `ci.yml`, `e2e.yml`, `codeql.yml`, `security.yml`,
`lighthouse.yml`, `a11y.yml`, `bundle-size.yml`, `release.yml`, `deploy.yml`,
`labeler.yml`, `stale.yml`.

- **CI**: lint + typecheck + unit tests (≥80% coverage) + build + E2E
- **Security**: `npm audit --audit-level=high` (fails build on high/critical)
  + license check
- **CodeQL**: GitHub security analysis (weekly + on push)
- **Lighthouse**: performance budget via LHCI
- **a11y**: axe-core accessibility audit
- **bundle-size**: 300KB gzip threshold

## Documentation Files
- `README.md` — comprehensive bilingual (ar/en) project overview
- `CHANGELOG.md` — Keep a Changelog format, v1.0.0 → v1.5.0
- `CONTRIBUTING.md` — contributor guide
- `SECURITY.md` — security policy
- `CODE_OF_CONDUCT.md` — community code of conduct
- `NOTICE.md` — third-party data sources and their licenses
- `AGENTS.md` — this file
