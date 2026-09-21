# ADR 0004: Four-Tier Data Loading and Offline-First Strategy

- **Status:** Accepted
- **Date:** 2026-06-17 (v1.5.4 — offline fallback integration)
- **Last reviewed:** 2026-09-21 (v3.1.20)
- **Supersedes:** —
- **Superseded by:** —

---

## Context

The Quran App depends on five external APIs for its content:

| API | Purpose |
|-----|---------|
| AlQuran.cloud | Quran text (Uthmani), surah metadata, translations |
| Aladhan | Prayer times, Hijri date |
| mp3quran.net | Full-surah audio per reciter |
| quran.com | Per-ayah audio timestamps (word-by-word highlighting) |
| Tafsir API (jsDelivr) | 6 tafsirs (Muyassar, Ibn Kathir, Tabari, etc.) |

### Problems with Naive API Calls

1. **Network failures** — a reader on a train, in a tunnel, or in a region
   with unreliable connectivity would see blank surahs, broken audio, and
   "Server error" toasts.
2. **Latency** — fetching the full Quran text (1.7 MB) from the API on
   every visit is wasteful and slow.
3. **Offline use** — the app is a PWA and an Android app. Readers expect
   offline capability after the first visit.
4. **Storage limits** — IndexedDB has quotas. Caching all 30+ reciters'
   audio for all 114 surahs would exceed any reasonable storage budget.
5. **Data integrity** — cached data must be verifiable (checksums) and
   trustworthy.

### Prior State

Before v1.5.4, the app fetched directly from APIs with no caching layer
beyond the Service Worker's `StaleWhileRevalidate`. There was no local
fallback — if the API was down, the app was broken.

---

## Decision

**We implemented a four-tier data loading strategy with an offline-first
philosophy.**

```
Tier 1: IndexedDB Cache      (instant, offline)
Tier 2: External API          (fresh, requires network)
Tier 3: In-Memory Search     (preloaded, instant)
Tier 4: Local JSON Fallback   (bundled, always available)
```

### Tier 1: IndexedDB Cache

Three separate databases isolate concerns and respect quota:

| Database | Store | Content | Max Size |
|----------|-------|---------|----------|
| `QuranAppDB` | surah-cache | Surah text, translations, tajweed | — |
| `QuranAudioCacheDB` | audio-blobs | Audio MP3 blobs per surah/reciter | 200 MB (LRU eviction) |
| `QuranTafsirDB` | tafsir-cache | Tafsir text per ayah | — |
| `QuranExternalDataDB` | responses | Bounded JSON response cache (API resilience) | 40 entries |

**LRU eviction** (audio): when the 200 MB cap is reached, the
least-recently-used audio blobs are evicted automatically. This prevents
quota errors and keeps the cache bounded.

**Honest status:** `offline-pack.ts` reports installation status honestly —
if any part of the offline pack (text, translation, tajweed, audio) fails
to download, the status reflects the partial state rather than claiming
success.

### Tier 2: External API (via `safeFetch`)

All API calls go through `api-client.ts` → `safeFetch()`, which provides:

- **Timeout** (default 15 s) via `AbortController`.
- **Retry** (default 1, configurable up to 2) on 5xx, 429, and network
  errors — not on 4xx, aborts, or parse errors.
- **Deduplication** — concurrent identical requests share a single
  in-flight Promise.
- **Error classification** — Arabic-friendly messages: offline, timeout,
  network, server, parse, default.
- **Offline fallback** — `fetchJsonWithOfflineFallback()` tries the network
  first, then falls back to the `QuranExternalDataDB` cache.

```typescript
// api-client.ts — composition root
registerProvider(createTafsirProvider((url, opts) => cachedJsonRequest(url, opts)));
registerProvider(createPrayerProvider((url, opts) => cachedJsonRequest(url, opts)));
```

The **provider registry** (`src/providers/`) allows swapping any API
endpoint at runtime via `overrideProvider(id, provider)` — used in tests
and future API migrations.

### Tier 3: In-Memory Search Index

For search, the full Quran text (6,236 ayahs) is loaded into memory as a
Trie-based index (`src/features/search/search-core.ts`). This enables:

- **Instant search** — no network round-trip for each query.
- **Diacritic-smart matching** — matches text with or without tashkeel.
- **Autocomplete** — prefix index with occurrence counts.

The index is loaded:
- **Offline:** synchronously during Phase 1 of the bootstrap.
- **Online:** lazily when the reader opens the search panel.

### Tier 4: Local JSON Fallback

Bundled in `public/data/` and always available after the first PWA install:

| File | Size | Content |
|------|------|---------|
| `quran-uthmani.json` | ~1.7 MB | Full Quran text, all 114 surahs |
| `surah-list.json` | ~15 KB | 114 surah metadata entries |
| `muyassar-tafsir.json` | ~3 MB | Tafsir Al-Muyassar for all ayahs |
| `tajweed.json` | ~2 MB | Tajweed annotation data |

`src/api-fallback.ts` provides:
- `loadLocalSurahText(n)` — returns a single surah from the bundled JSON.
- `loadLocalSurahList()` — returns 114 `SurahInfo` entries.
- `loadLocalTafsirMuyassar(n)` — returns ayah→tafsir map for a surah.
- `isLocalFallbackAvailable()` — checks if the local file is accessible.

### Loading Order (per surah request)

```
1. getCachedSurahFromIDB(surahNum)  → Tier 1 (IndexedDB)
2. apiFetch(`/surah/${n}/quran-uthmani`)  → Tier 2 (API)
3. loadLocalSurahText(n)  → Tier 4 (local fallback)
```

If Tier 1 has the data, Tiers 2 and 4 are skipped. If Tier 1 is empty and
Tier 2 fails, Tier 4 is used. If all three fail, the error boundary shows
a user-friendly message.

### Offline Pack (`offline-pack.ts`)

For readers who want full offline capability, a one-tap "Download
Everything" button downloads:

1. Full Quran text (all surahs)
2. All translations (5 editions)
3. Tafsir Al-Muyassar (already bundled, but also cached for IDB access)
4. Tajweed rules data
5. Optionally: audio for a chosen reciter

Progress is reported via `onProgress` callback with phase, percentage,
message, and completed/total counts. The result includes success/failure
counts, total bytes, and elapsed time.

### Service Worker Caching (Workbox)

The SW provides a second layer of caching for runtime requests:

| Pattern | Strategy | Cache Name | TTL |
|---------|----------|------------|-----|
| Self-hosted fonts (`/fonts/*.ttf`) | CacheFirst | `app-fonts-v3` | 1 year |
| App data (`/data/*.json`) | CacheFirst | `app-data-v3` | 30 days |
| AlQuran.cloud (full text) | CacheFirst | `quran-full-text-v3` | 1 year |
| AlQuran.cloud (other) | StaleWhileRevalidate | `quran-api-v3` | 30 days |
| Aladhan API | StaleWhileRevalidate | `prayer-api-v3` | 1 hour |
| Tafsir API | CacheFirst | `tafsir-api-v3` | 1 year |
| mp3quran.net audio | CacheFirst | `quran-audio-v3` | 1 year |
| QCF4 mushaf layouts | CacheFirst | `mushaf-layout-v3` | 1 year |

**Capacitor exception:** in the Android app, the Service Worker is
**disabled** entirely — it breaks the WebView's file loading. Any
previously-registered SW is unregistered on app launch.

### Data Integrity (v3.1.19+)

For the Mushaf offline data pack (604 page layouts), each file is
verified via SHA-256 checksum before storage in IndexedDB. The data source
is pinned to a specific commit (`5130511...` of
`MohamadHajjRabee/quran-qcf4`) with an MIT license.

---

## Consequences

### Positive

- **True offline** — after downloading the offline pack, the reader can
  use the entire app (text, audio, tafsir, tajweed, mushaf) without any
  network connection.
- **Resilience** — the four-tier fallback chain means a single API failure
  doesn't break the experience. The external data cache
  (`QuranExternalDataDB`) keeps the last successful response for
  degraded-mode operation.
- **Bounded storage** — the 200 MB audio LRU and 40-entry JSON cache
  prevent unbounded growth.
- **Provider swappability** — the registry pattern means a future API
  migration (e.g., AlQuran.cloud → quran.com API) is a single
  `overrideProvider()` call, not a codebase-wide refactor.
- **Search performance** — the in-memory Trie enables instant search across
  6,236 ayahs with diacritic-smart matching.

### Negative

- **Storage complexity** — four IndexedDB databases + Service Worker caches
  + localStorage + in-memory index. The total storage picture is hard to
  explain to a new contributor.
- **1.7 MB fallback file** — `quran-uthmani.json` is bundled with the app,
  adding to the initial download. Workbox's `globIgnores` excludes it from
  precache (it's runtime-cached on demand), but it's still in `public/`.
- **Stale data risk** — `StaleWhileRevalidate` for prayer times means the
  reader might see yesterday's prayer times for a moment before the fresh
  data arrives. The 1-hour TTL mitigates this.
- **QCF4 fonts excluded** — the QCF4 font pack (for Mushaf mode) is not
  bundled due to redistribution restrictions. This means Mushaf mode
  requires a network connection on first use, then fonts are cached.
- **Test complexity** — the four-tier system requires extensive mocking in
  unit tests (`fake-indexeddb`) and E2E tests (`mock-network.ts`). The
  mock network fixture is 250+ lines.

### Mitigations

- `offline-pack.ts` provides a storage statistics panel where readers can
  see exactly how much data is cached and clear specific surahs or all
  data.
- `AGENTS.md` documents the four-tier strategy with file references.
- `EVALUATION_GUIDE.md` includes verification commands for offline
  operation.
- The mock-network fixture (`e2e/fixtures/mock-network.ts`) intercepts all
  external APIs, making E2E tests deterministic.

---

## Alternatives Considered

### Single-tier (API only, no caching)

- **Pros:** Simplest implementation. Always fresh data.
- **Cons:** No offline capability. Every surah switch requires a network
  round-trip. Unacceptable for a Quran app that readers use during travel
  or in areas with poor connectivity.

### Two-tier (API + localStorage)

- **Pros:** Simple, widely supported.
- **Cons:** localStorage has a 5–10 MB limit — insufficient for full Quran
  text (1.7 MB) + translations (2 MB) + tafsir (3 MB) + tajweed (2 MB).
  No binary blob support (can't cache audio).

### IndexedDB-only (no local JSON fallback)

- **Pros:** One less storage mechanism.
- **Cons:** If the reader visits for the first time while offline, there
  is no IndexedDB cache yet. The local JSON fallback (Tier 4) ensures the
  app is *always* usable after the first PWA install, even on the first
  offline visit.

### Service Worker-only (no IndexedDB)

- **Pros:** SW caches are automatic and transparent.
- **Cons:** SW caching is opaque — we can't easily query "is surah 5
  cached?" or display storage statistics. IndexedDB gives us programmatic
  control. Also, SW is disabled in Capacitor (Android), so this would
  leave the Android app without any cache.

---

## References

- [`src/api-client.ts`](../../src/api-client.ts) — `safeFetch()`, provider registry
- [`src/api-fallback.ts`](../../src/api-fallback.ts) — local JSON fallback
- [`src/surah-cache.ts`](../../src/surah-cache.ts) — IndexedDB surah cache
- [`src/features/audio/audio-cache.ts`](../../src/features/audio/audio-cache.ts) — audio cache with LRU
- [`src/external-data-cache.ts`](../../src/external-data-cache.ts) — bounded JSON resilience cache
- [`src/offline-pack.ts`](../../src/offline-pack.ts) — one-tap offline download
- [`src/providers/registry.ts`](../../src/providers/registry.ts) — provider registry
- [`src/providers/tafsir.ts`](../../src/providers/tafsir.ts) — tafsir provider
- [`src/providers/prayer.ts`](../../src/providers/prayer.ts) — prayer provider
- [`src/features/search/search-core.ts`](../../src/features/search/search-core.ts) — Trie search engine
- [`vite.config.js`](../../vite.config.js) — Workbox runtime caching config
- [`public/data/`](../../public/data/) — bundled local fallback files
- [`EVALUATION_GUIDE.md`](../../EVALUATION_GUIDE.md) — verification commands
- [`CHANGELOG.md`](../../CHANGELOG.md) — v1.5.4 "Offline Fallback", v3.1.19 "Verified offline mushaf data"
- [ADR 0003](./0003-three-phase-bootstrap.md) — bootstrap phases
