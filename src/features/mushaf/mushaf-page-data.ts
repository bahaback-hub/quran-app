/**
 * Mushaf page layout data pipeline — per-page QCF4 layout fetching with an
 * in-memory LRU cache, browser CacheStorage reuse, and SEC-06 integrity
 * verification. Extracted from mushaf-renderer.ts; mushaf-renderer re-exports
 * loadPageData so all existing import sites keep working.
 */
import { mushafPageLayoutUrls } from '../../external-sources.js';
import { getMushafPageLayout, verifyMushafLayoutBytes } from './mushaf-data-pack.js';
import type { PageLayoutData } from './mushaf-layout-data.js';

const LAYOUT_CACHE_MAX = 50; // LRU cache limit to prevent unbounded memory growth
const layoutCache = new Map<string, PageLayoutData>();

/** Cache name for page layout JSONs rendered once, then reused offline. */
const LAYOUT_CACHE_NAME = 'qcf4-page-layouts';

/** Read a previously rendered page layout straight from the browser cache. */
async function cachedPageLayoutData(pageNum: number): Promise<PageLayoutData | null> {
  if (typeof globalThis.caches === 'undefined') {
    return null;
  }
  try {
    const cache = await globalThis.caches.open(LAYOUT_CACHE_NAME);
    for (const url of mushafPageLayoutUrls(pageNum)) {
      const res = await cache.match(url);
      if (res && res.ok) {
        return (await res.json()) as PageLayoutData;
      }
    }
  } catch {
    /* cache is best-effort — fall through to the network */
  }
  return null;
}

/** Fetch a page layout from any available source with a per-source timeout. */
async function fetchPageLayoutFromNetwork(pageNum: number): Promise<PageLayoutData | null> {
  const urls = mushafPageLayoutUrls(pageNum);
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        continue; // a mirror answered negative — try the next source
      }
      // Real Response objects always expose arrayBuffer(); verification needs
      // the raw bytes, so read the body once before parsing.
      const raw = typeof res.arrayBuffer === 'function' ? await res.arrayBuffer() : null;
      if (raw) {
        // SEC-06: never trust a CDN-served layout blindly — check it against
        // the verified manifest hash before parsing or caching it.
        if (!(await verifyMushafLayoutBytes(pageNum, raw))) {
          console.warn(`[Mushaf] Integrity check failed for page ${pageNum} from ${url}`);
          continue; // try the next source
        }
      }
      const data = (raw ? JSON.parse(new TextDecoder().decode(raw)) : await res.json()) as PageLayoutData;
      if (typeof globalThis.caches !== 'undefined') {
        try {
          const cache = await globalThis.caches.open(LAYOUT_CACHE_NAME);
          await cache.put(
            url,
            new Response(JSON.stringify(data), {
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        } catch {
          /* persistent caching is best-effort */
        }
      }
      return data;
    } catch {
      if (url === urls[urls.length - 1]) {
        console.warn(`[Mushaf] Failed to load page data for page ${pageNum} from all sources`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function loadPageData(pageNum: number): Promise<PageLayoutData | null> {
  const key = `qcf4-${pageNum}`;
  if (layoutCache.has(key)) {
    return layoutCache.get(key)!;
  }
  try {
    // A verified, user-installed data pack has priority and supports offline
    // page rendering. The remote fixed source remains the fallback until the
    // optional MIT-licensed layout data pack is installed.
    const installedData = await getMushafPageLayout(pageNum);
    const data = installedData
      ? (installedData as PageLayoutData)
      : ((await cachedPageLayoutData(pageNum)) ?? (await fetchPageLayoutFromNetwork(pageNum)));
    if (!data) {
      return null;
    }
    // Evict oldest entry if cache is full (LRU policy)
    if (layoutCache.size >= LAYOUT_CACHE_MAX) {
      const firstKey = layoutCache.keys().next().value;
      if (firstKey !== undefined) {
        layoutCache.delete(firstKey);
      }
    }
    layoutCache.set(key, data);
    return data;
  } catch (e: unknown) {
    console.warn('[Mushaf] Failed to load page data:', e);
    return null;
  }
}
