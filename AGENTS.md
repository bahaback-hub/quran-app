# Quran App — Project Guide

## Commands
- `npm run dev` — Start Vite dev server
- `npm run build` — Vite production build (with code splitting, tree shaking)
- `npm test` — Run all Vitest tests
- `npm run typecheck` — TypeScript type check (`tsc --noEmit`)

## Architecture
- **Vite-based ESM build**: `index.html` loads `src/main.js` as `<script type="module">`
- **Vite handles all assets**: JS, CSS, images — full bundling with code splitting
- **PWA**: `vite-plugin-pwa` with Workbox only — auto-registers a single Service Worker (no manual `service-worker.js`)
- **Deployment**: GitHub Actions → `actions/deploy-pages@v4` from `dist/`
  - User must enable "GitHub Pages → GitHub Actions" in repo settings

## Code Conventions
- All functions use `function` declarations (not arrow/const) — hoisting within each module
- Every module has explicit imports for all cross-module functions it uses
- `state` is a single global object in `src/state.js`: `export let state = {}` — imported by all modules
- All module‑level mutable state is a property of `state` (e.g. `surahOffsets` moved from `app.js` to `state.surahOffsets`)
- `initState()` uses `Object.assign(state, {...})` not `state = {...}` (imported binding is read-only in ES modules)
- No `initXxxState` pattern — modules reference `state` directly

## Module Files (`src/`)
| File | Purpose |
|------|---------|
| `app.js` | Main orchestrator: initApp, loadSurah, renderSurah, event bindings |
| `state.js` | Global state object shared by all modules |
| `audio.js` | Audio player, word tracking, hifdh/repeat modes |
| `search.js` | Full Quran text search, voice search, Arabic keyboard |
| `mushaf.js` | Mushaf/pages mode, page navigation, surah overlay |
| `prayer.js` | Prayer times, clock, azan |
| `tafsir.js` | Tafsir IndexedDB cache, API fetching, panel UI |
| `favorites.js` | Favorites & bookmark |
| `share.js` | Share via native, clipboard, WhatsApp, Telegram |
| `settings.js` | Font size, night mode, backgrounds, reset |
| `adhkar.js` | Adhkar panel, counters, notifications |
| `config.js` | Constants (API URLs, defaults) |
| `dom.js` | DOM element references |
| `ui.js` | Toast, loading bar |
| `utils.js` | escapeHtml, toArabicNumeral, etc. |
| `i18n.js` | Internationalization (ar/en) |
| `storage.js` | localStorage wrapper |
| `surahs-data.js` | Surah secrets data |

## DOM
- All DOM references cached in `dom` object via `cacheDom()` in `src/dom.js`
- Elements referenced by id matching the property name

## Testing
- Tests in `src/__tests__/` using Vitest + jsdom
- State and DOM must be set up per test (beforeEach)

## CDN
- Mushaf page images served via jsDelivr CDN
- Base URL: `https://cdn.jsdelivr.net/gh/bahaback-hub/quran-app@main/public/pages/`

## TypeScript
- `tsconfig.json` with `allowJs: true`, **`checkJs: true`**
- Global type declarations in `src/global.d.ts` (also extends DOM types like Element.dataset, EventTarget.result)
- All JSDoc types in `src/state.js` define the 51 properties of the global `state` object (including `surahOffsets`)
- **All exported functions across all 11 modules have JSDoc descriptions**
- Type check with `npm run typecheck` (must pass 0 errors)

## Type Fixes for `checkJs: true`
When adding new code that triggers TS errors:
1. **`Element` DOM props** (`dataset`, `style`): already declared in `global.d.ts`
2. **`EventTarget` props** (`result`): already declared in `global.d.ts`
3. **IndexedDB events**: use `/** @type {IDBRequest} */ (e.target).result`
4. **`contains(e.target)`**: use `/** @type {Node} */ (e.target)`
5. **`select.value = number`**: use `String(number)`
6. **New state props**: add JSDoc property to `src/state.js`
