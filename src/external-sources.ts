/**
 * Central registry of third-party endpoints (CDN mirrors, data APIs, share targets).
 *
 * Rule: no module may hard-code an external host. Import it from here so a
 * future source change (as happened with raw.githubusercontent.com) is a
 * one-line edit instead of a codebase-wide search.
 */

/** Read an optional build-time override, falling back to the default. */
function env(key: string, fallback: string): string {
  try {
    return import.meta.env[key] || fallback;
  } catch {
    return fallback;
  }
}

/** Base URL of the quran.com v4 API (word timings, recitations). */
export const QURAN_COM_API_BASE: string = env('VITE_QURAN_COM_API_BASE', 'https://api.quran.com/api/v4');

/**
 * Ordered mirrors serving the quran-qcf4 page-layout JSONs. The first
 * reachable source wins; raw.githubusercontent.com is intentionally last
 * because it is unreachable from several networks.
 */
const MUSHAF_PAGE_SOURCES: readonly string[] = Object.freeze([
  'https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/pages/',
  'https://fastly.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/pages/',
  'https://gcore.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main/pages/',
  'https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/main/pages/',
]);

/**
 * Full download URLs for one mushaf page layout, in preference order.
 * A comma-separated `VITE_MUSHAF_PAGE_SOURCES` override replaces the list.
 */
export function mushafPageLayoutUrls(pageNum: number): string[] {
  const padded = String(pageNum).padStart(3, '0');
  const override = env('VITE_MUSHAF_PAGE_SOURCES', '');
  const bases = override
    ? override
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : MUSHAF_PAGE_SOURCES;
  return bases.map((base) => `${base}${padded}.json`);
}

/** Base endpoint for sharing text via WhatsApp. */
export const SHARE_WHATSAPP_BASE: string = 'https://wa.me';

/** Base endpoint for sharing a link via Telegram. */
export const SHARE_TELEGRAM_BASE: string = 'https://t.me/share/url';
