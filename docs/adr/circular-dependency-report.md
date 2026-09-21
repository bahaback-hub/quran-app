# Circular Dependency Report — quran-app

**Generated:** 2026-09-21
**Tool:** madge 8.0.0
**Command:** `npm run check:circular`
**Files processed:** 254

---

## Summary

| Metric | Count |
|--------|-------|
| Total circular dependencies | 16 |
| Type-only cycles (safe) | 5 |
| Runtime cycles (should resolve) | 11 |

---

## All Detected Cycles

### Type-Only Cycles (Safe — `import type` erased at compile time)

#### 1. api-client.ts → providers/prayer.ts → providers/types.ts

- **Cause:** `providers/prayer.ts` imports `type { FetchOptions }` from `api-client.ts` (line 11) and `type { JsonFetch, JsonProvider }` from `providers/types.ts`.
- **Risk:** None — `import type` is erased by the TypeScript compiler. No runtime circular dependency.
- **Fix:** Move `FetchOptions` interface to `providers/types.ts` or a shared `types/api.ts` file. This would eliminate the import from `api-client.ts`.

#### 2. api-client.ts → providers/tafsir.ts

- **Cause:** `providers/tafsir.ts` imports `type { FetchOptions }` from `api-client.ts` (line 11).
- **Risk:** None — type-only import.
- **Fix:** Same as #1 — move `FetchOptions` to a shared types file.

#### 3. internal-state.ts → state.ts → state/devtools.ts → state/proxy.ts

- **Cause:** `state/proxy.ts` imports `resetInternalState` from `internal-state.ts` (line 10). `internal-state.ts` may import from `state.ts` barrel. `state.ts` re-exports from `state/devtools.ts`. `state/devtools.ts` imports from `state/proxy.ts`.
- **Risk:** Low — the `state.ts` barrel file creates an indirect cycle. The actual runtime dependency is `state/proxy.ts → internal-state.ts`, which is one-directional.
- **Fix:** Have `internal-state.ts` import directly from `state/subscriptions.ts` or `state/types.ts` instead of the `state.ts` barrel.

#### 4. state.ts → state/devtools.ts → state/proxy.ts → state/subscriptions.ts → state/types.ts → features/mushaf/mushaf-renderer.ts

- **Cause:** The `state.ts` barrel re-exports from `state/devtools.ts`, which imports from `state/proxy.ts`, etc. `state/types.ts` exports types that `features/mushaf/mushaf-renderer.ts` imports, and that module may import back from `state.ts` barrel.
- **Risk:** Low — barrel file cycle. Types are erased at compile time.
- **Fix:** Import from specific submodules (`state/types.ts`) instead of the barrel (`state.ts`).

#### 5. state.ts → state/devtools.ts → state/proxy.ts → state/subscriptions.ts → state/types.ts → features/mushaf/mushaf-renderer.ts → tajweed-data.ts

- **Cause:** Same barrel file chain as #4, extended through `mushaf-renderer.ts → tajweed-data.ts`.
- **Risk:** Low — barrel + type cycle.
- **Fix:** Same as #4.

---

### Runtime Cycles (Should Resolve)

#### 6. app-events.ts → ayah-modal.ts → app.ts

- **Cause:** `app-events.ts` imports from `ayah-modal.ts`, which imports from `app.ts` (for `loadSurah` re-export). `app.ts` imports from `app-events.ts` (for `bindAllEvents`).
- **Risk:** Medium — `app.ts` re-exports `loadSurah` from `surah-loader.ts`, and `ayah-modal.ts` uses it. The re-export creates an unnecessary dependency on `app.ts`.
- **Fix:** `ayah-modal.ts` should import `loadSurah` directly from `surah-loader.ts` instead of from `app.ts`.

#### 7. ayah-modal.ts → app.ts

- **Cause:** Same as #6 — `ayah-modal.ts` imports from `app.ts`.
- **Risk:** Medium — same fix applies.

#### 8. surah-loader.ts → features/audio/audio.ts

- **Cause:** `surah-loader.ts` imports `prepareAudioForNewSurah` and `playCurrentAyah` from `features/audio/audio.ts`. `features/audio/audio.ts` may import back from `surah-loader.ts` (e.g., for surah data or types).
- **Risk:** Medium — audio and surah loading are tightly coupled.
- **Fix:** Extract a shared interface (e.g., `AudioSurahBridge`) that both modules import, removing the direct dependency.

#### 9. ayah-modal.ts → app.ts → capacitor-back.ts → favorites.ts → surah-loader.ts → surah-render.ts

- **Cause:** Long chain starting from `ayah-modal.ts → app.ts` and flowing through capacitor-back, favorites, surah-loader, and surah-render.
- **Risk:** Medium — this is really the `ayah-modal.ts → app.ts` cycle extended.
- **Fix:** Fix #6/#7 first — this chain will collapse.

#### 10. app.ts → capacitor-back.ts → favorites.ts → surah-loader.ts → surah-render.ts → features/mushaf/mushaf.ts

- **Cause:** `surah-render.ts` imports from `features/mushaf/mushaf.ts`, and the chain flows back to `app.ts`.
- **Risk:** Medium — surah rendering depends on mushaf, which depends on settings, which the app initializes.
- **Fix:** Decouple `surah-render.ts` from `features/mushaf/mushaf.ts` via lazy import or event-based communication.

#### 11. features/mushaf/mushaf.ts → settings.ts

- **Cause:** `features/mushaf/mushaf.ts` imports from `settings.ts`, and `settings.ts` may import back (directly or indirectly) through the app initialization chain.
- **Risk:** Medium — settings and mushaf are coupled.
- **Fix:** Extract settings types to a separate file, or use dependency injection.

#### 12. app.ts → capacitor-back.ts → favorites.ts → surah-loader.ts → surah-render.ts → features/mushaf/mushaf.ts → settings.ts → features/presentation/presentation.ts

- **Cause:** Extended chain from #10 through settings to presentation.
- **Risk:** Medium — same root cause as #10.
- **Fix:** Same as #10 — decouple rendering from feature modules.

#### 13. settings.ts → features/presentation/presentation.ts

- **Cause:** `settings.ts` imports from `features/presentation/presentation.ts`, which may import back through the app chain.
- **Risk:** Medium — settings and presentation are coupled.
- **Fix:** Use event-based communication instead of direct imports.

#### 14. surah-loader.ts → surah-render.ts → features/mushaf/mushaf.ts → settings.ts → features/presentation/presentation.ts

- **Cause:** Extended chain from #8 through mushaf and settings to presentation.
- **Risk:** Medium — same root cause.
- **Fix:** Same as #10/#12 — decouple via lazy imports or events.

#### 15. app.ts → features/search/search-ui.ts

- **Cause:** `app.ts` imports `loadFullQuranText` from `features/search/search-ui.ts`, which may import back from `app.ts` (e.g., for `loadSurah`).
- **Risk:** Medium — search and app initialization are coupled.
- **Fix:** `features/search/search-ui.ts` should import `loadSurah` from `surah-loader.ts` directly, not from `app.ts`.

#### 16. ayah-modal.ts → app.ts → features/search/search-ui.ts

- **Cause:** Extended chain from #15 through `ayah-modal.ts → app.ts`.
- **Risk:** Medium — same root cause as #15.
- **Fix:** Same as #15 — fix the `app.ts` re-export pattern.

---

## Root Causes

1. **`app.ts` as a re-export hub** — `app.ts` re-exports `loadSurah`, `renderSurah`, `highlightCurrentAyah`, `updatePlayerInfo`, `buildSurahOffsets`, `loadSurahList` from `surah-loader.ts`. Other modules import these from `app.ts` instead of from `surah-loader.ts` directly, creating cycles through `app.ts`.

2. **Barrel file `state.ts`** — the barrel re-exports from `state/devtools.ts`, `state/proxy.ts`, etc. Modules that import from the barrel and are also imported by state submodules create indirect cycles.

3. **Feature module coupling** — `surah-render.ts` imports from `features/mushaf/mushaf.ts` and `settings.ts`, which import from `features/presentation/presentation.ts`. This creates long dependency chains.

4. **Type imports through implementation files** — `FetchOptions` is defined in `api-client.ts` (an implementation file) but needed by provider modules. Moving it to a types-only file would break the cycle.

---

## Recommended Fix Priority

| Priority | Cycle # | Fix | Effort |
|----------|---------|-----|--------|
| 1 | #6, #7, #9, #15, #16 | Change `ayah-modal.ts` and `search-ui.ts` to import from `surah-loader.ts` directly, not from `app.ts` | Low |
| 2 | #1, #2 | Move `FetchOptions` interface to `providers/types.ts` | Low |
| 3 | #3, #4, #5 | Change `internal-state.ts` to import from specific state submodules, not the barrel | Low |
| 4 | #8 | Extract `AudioSurahBridge` interface | Medium |
| 5 | #10–14 | Decouple `surah-render.ts` from `features/mushaf/` and `settings.ts` via lazy imports or events | High |

Fixing priorities 1–3 would eliminate 11 of the 16 cycles with low effort.
