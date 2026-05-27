# Quran App — Project Guide

## Commands
- `npm run concat` — Build `app.bundle.js` from `src/` files (must run before dev)
- `npm run dev` — Run `concat` then start Vite dev server
- `npm run build` — Run `concat` then Vite production build
- `npm test` — Run all Vitest tests
- `npm run typecheck` — TypeScript type check (`tsc --noEmit`)

## Architecture
- **Single-file app**: `index.html` loads `app.bundle.js` (not a module script)
- **Concat build**: `scripts/concat.cjs` concatenates `src/*.js`, strips `import`/`export`
- **Vite**: Only used for `vite build` of non-JS assets (CSS, images); JS comes from concat

## Code Conventions
- All functions must be `function` declarations (not arrow/const) — hoisting needed across concat boundaries
- `state` is a single global object: `export let state = {}` in `src/app.js`, shared via script scope
- No `initXxxState` pattern — modules reference `state` directly
- Cross-module functions used in concat scope (no imports needed at runtime)

## Module Files (`src/`)
| File | Purpose |
|------|---------|
| `app.js` | Main orchestrator: state, initApp, loadSurah, renderSurah, event bindings |
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

## Concat File Order (`scripts/concat.cjs`)
1. Utility files (config, storage, dom, ui, utils, i18n, adhkar-data)
2. `app.js` (defines `state`)
3. Module files (prayer, tafsir, favorites, share, settings, adhkar, audio, search, mushaf)
4. `main.js`

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
- `tsconfig.json` with `allowJs: true`, `checkJs: false`
- Global type declarations in `src/global.d.ts`
- Type check with `npm run typecheck`
