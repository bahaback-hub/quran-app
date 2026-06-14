# Quran App — Project Guide

## Commands
- `npm run dev` — Start Vite dev server
- `npm run build` — Vite production build (with code splitting, tree shaking)
- `npm test` — Run all Vitest tests
- `npm run typecheck` — TypeScript type check (`tsc --noEmit`)
- `npm run android:build` — Build web + sync with Capacitor
- `npm run android:open` — Open Android Studio
- `npm run android:run` — Build, sync, and run on connected device

## Architecture
- **Vite-based ESM build**: `index.html` loads `src/main.ts` as `<script type="module">`
- **Vite handles all assets**: JS, CSS, images — full bundling with code splitting
- **PWA**: `vite-plugin-pwa` with Workbox — auto-generates SW with precache + runtime caching
- **Android (Capacitor)**: `android/` dir wraps the web app as a native APK/AAB
  - `npm run android:build` copies `dist/` → `android/app/src/main/assets/public`
  - Open with `npm run android:open` → Android Studio → Build APK
- **Web Deployment**: GitHub Actions → `actions/deploy-pages@v4` from `dist/`
  - User must enable "GitHub Pages → GitHub Actions" in repo settings

## Code Conventions
- All functions use `function` declarations (not arrow/const) — hoisting within each module
- Every module has explicit imports for all cross-module functions it uses
- `state` is a single global object in `src/state.ts`: `export let state = {}` — imported by all modules
- All module‑level mutable state is a property of `state` (e.g. `surahOffsets` moved from `app.ts` to `state.surahOffsets`)
- `initState()` uses `Object.assign(state, {...})` not `state = {...}` (imported binding is read-only in ES modules)
- No `initXxxState` pattern — modules reference `state` directly

## Module Files (`src/`)
| File | Purpose |
|------|---------|
| `app.ts` | Main orchestrator: initApp, event bindings, initState, keyboard shortcuts |
| `surah-loader.ts` | Surah data loading, rendering, caching, timing, offsets, translation toggle |
| `state.ts` | Global state object shared by all modules |
| `audio.ts` | Audio player, word tracking, hifdh/repeat modes |
| `search.ts` | Full Quran text search, voice search, Arabic keyboard |
| `mushaf.ts` | Mushaf/pages mode, page navigation, surah overlay |
| `prayer.ts` | Prayer times, clock, azan |
| `tafsir.ts` | Tafsir IndexedDB cache, API fetching, panel UI |
| `favorites.ts` | Favorites & bookmark |
| `share.ts` | Share via native, clipboard, WhatsApp, Telegram |
| `settings.ts` | Font size, night mode, backgrounds, reset |
| `adhkar.ts` | Adhkar panel, counters, notifications |
| `config.ts` | Constants (API URLs, defaults) |
| `dom.ts` | DOM element references |
| `ui.ts` | Toast, loading bar |
| `utils.ts` | escapeHtml, toArabicNumeral, etc. |
| `i18n.ts` | Internationalization (ar/en) |
| `storage.ts` | localStorage wrapper |
| `surahs-data.ts` | Surah secrets data |

## DOM
- All DOM references cached in `dom` object via `cacheDom()` in `src/dom.ts`
- Elements referenced by id matching the property name

## Testing
- Tests in `src/__tests__/` using Vitest + jsdom
- State and DOM must be set up per test (beforeEach)

## CDN
- Mushaf rendered via QCF4 Canvas using fonts + layout JSON from jsDelivr/GitHub
- Runtime caching configured in `vite.config.ts` for offline support

## TypeScript
- `tsconfig.json` with `allowJs: true`, **`checkJs: true`**
- Global type declarations in `src/global.d.ts` (also extends DOM types like Element.dataset, EventTarget.result)
- All JSDoc types in `src/state.ts` define the 71 properties of the global `state` object (including `surahOffsets`)
- **All exported functions across all 11 modules have JSDoc descriptions**
- Type check with `npm run typecheck` (must pass 0 errors)

## Type Fixes for `checkJs: true`
When adding new code that triggers TS errors:
1. **`Element` DOM props** (`dataset`, `style`): already declared in `global.d.ts`
2. **`EventTarget` props** (`result`): already declared in `global.d.ts`
3. **IndexedDB events**: use `/** @type {IDBRequest} */ (e.target).result`
4. **`contains(e.target)`**: use `/** @type {Node} */ (e.target)`
5. **`select.value = number`**: use `String(number)`
6. **New state props**: add property to `src/state.ts` AppState interface
