/**
 * Deep-link parsing for SEO / shareable URLs.
 *
 * The pre-rendered SEO pages (scripts/generate-seo-pages.mjs) link into the SPA
 * with the hash format `#surah=N` or `#surah=N/A`. Manifest shortcuts already
 * reserve other hashes (#prayer, #audio, #search, #favorites, #adhkar), so this
 * parser only reacts to the explicit surah/ayah/page formats and returns `null`
 * for anything else.
 */

export type DeepLink = { kind: 'surah'; number: number; startAyah?: number } | { kind: 'page'; page: number } | null;

export const MAX_SURAH = 114;
export const MAX_PAGE = 604;

/** Parse a location.hash-like string into a DeepLink (null when unrecognized). */
export function parseDeepLink(hash: string): DeepLink {
  if (!hash || hash === '#') {
    return null;
  }

  const surahMatch = hash.match(/^#surah=(\d{1,3})(?:\/(\d{1,3}))?$/);
  if (surahMatch) {
    const number = Number(surahMatch[1]);
    if (number >= 1 && number <= MAX_SURAH) {
      const rawAyah = surahMatch[2] ? Number(surahMatch[2]) : NaN;
      const startAyah = rawAyah >= 1 ? rawAyah : undefined;
      return { kind: 'surah', number, startAyah };
    }
    return null;
  }

  const pageMatch = hash.match(/^#page=(\d{1,3})$/);
  if (pageMatch) {
    const page = Number(pageMatch[1]);
    if (page >= 1 && page <= MAX_PAGE) {
      return { kind: 'page', page };
    }
  }

  return null;
}

/** Strip a handled deep link from the URL (idempotent, keeps other query/hash). */
export function clearDeepLinkHash(keepHash?: string): void {
  const clean = typeof history !== 'undefined' ? (history.replaceState ?? null) : null;
  if (!clean) {
    return;
  }
  const next = location.pathname + location.search + (keepHash && keepHash !== '#' ? keepHash : '');
  clean.call(history, null, '', next);
}
