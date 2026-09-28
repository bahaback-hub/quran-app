/**
 * Guard: the 114 surah pages must stay reachable from each other.
 *
 * Every surah page used to be an island. Its only outbound links were to itself
 * and to the app, so the set was only discoverable through sitemap.xml - and the
 * starter guide is explicit that Google finds pages mainly through links on
 * pages it has already crawled, and that a sitemap is not a required step. A
 * change to this generator can silently take the internal linking away again,
 * and nothing else in the suite would notice, so it is pinned here.
 *
 * These tests run the real generator against a temp dist and check the
 * structure it produced. The pages are static HTML with no JavaScript, so the
 * whole check is string and filesystem work.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const GENERATOR = join(ROOT, 'scripts', 'generate-seo-pages.mjs');
const QURAN_DIST = join(ROOT, 'dist', 'quran');
const BASE_URL = 'https://bahaback-hub.github.io/quran-app';
/** The one path that points out of the generated tree, at the app shell. */
const APP_ROOT = '../../index.html';
const APP_ROOT_FROM_INDEX = '../index.html';
const INDEX_FROM_SURAH = '../index.html';

const read = (p: string) => readFileSync(p, 'utf8');

let slugs: string[] = [];

beforeAll(() => {
  // The generator resolves its paths from its own location, so it does not need
  // a particular cwd. It writes into ./dist alongside whatever `vite build`
  // produced - and on CI there may be no build at all, which is why nothing
  // below may assume dist/index.html exists.
  execFileSync(process.execPath, [GENERATOR], { encoding: 'utf8' });
  slugs = readdirSync(QURAN_DIST, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}, 120_000);

const surahHtml = (slug: string) => read(join(QURAN_DIST, slug, 'index.html'));
const indexHtml = () => read(join(QURAN_DIST, 'index.html'));
const pageFiles = () => [...slugs.map((s) => join(QURAN_DIST, s, 'index.html')), join(QURAN_DIST, 'index.html')];

describe('surah pages are internally linked', () => {
  it('emits all 114 surah pages plus the index', () => {
    expect(slugs).toHaveLength(114);
    expect(existsSync(join(QURAN_DIST, 'index.html'))).toBe(true);
  });

  it('has an index page linking every surah', () => {
    const html = indexHtml();
    const links = new Set([...html.matchAll(/href="([a-z0-9-]+)\/"/g)].map((m) => m[1]));
    for (const slug of slugs) {
      expect(links.has(slug), `index must link ${slug}`).toBe(true);
    }
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect((html.match(/<h2[\s>]/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('lists the surahs under Meccan and Medinan headings', () => {
    const html = indexHtml();
    expect(html).toContain('سور مكية');
    expect(html).toContain('سور مدنية');
    expect(html).toMatch(/"numberOfItems":114/);
  });

  it('links each surah to its neighbours and to the index', () => {
    // Second surah has both neighbours, so check it and the two ends.
    for (const slug of [slugs[1], slugs[0], slugs[113]]) {
      const html = surahHtml(slug);
      expect(html, `${slug} must reach the index`).toContain('href="../index.html"');
      expect(html, `${slug} must offer a previous/next sibling`).toMatch(/href="\.\.\/[a-z0-9-]+\/"/);
    }
  });

  it('resolves every relative link that stays inside the generated tree', () => {
    // Links that climb out to the app shell (../../index.html) are excluded:
    // the app is written by `vite build`, and this suite runs in CI where no
    // build has happened, so that file legitimately does not exist yet.
    // Asserting it existed made this test pass only on a machine that had just
    // built, which is exactly the assumption that let it fail in CI. Those links
    // are checked for shape in the next test instead.
    const broken: string[] = [];
    for (const file of pageFiles()) {
      const html = read(file);
      const from = dirname(file);
      for (const m of html.matchAll(/href="([^"]+)"/g)) {
        const href = m[1];
        if (/^(https?:|mailto:|#)/.test(href)) continue;
        const path = href.split('#')[0];
        if (path === APP_ROOT || path === '../index.html') continue;
        const target = resolve(from, path);
        const ok = path.endsWith('/') ? existsSync(join(target, 'index.html')) : existsSync(target);
        if (!ok) broken.push(`${file} -> ${href}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('climbs out to the app shell at the right depth from each page', () => {
    // Two different index.html links exist and both are correct at their own
    // depth: from dist/quran/{slug}/ the surah index is one level up and the
    // app shell is two; from dist/quran/ the app shell is one.
    for (const slug of slugs) {
      const html = surahHtml(slug);
      expect(html, `${slug} must link the surah index`).toContain(`href="${INDEX_FROM_SURAH}"`);
      expect(html, `${slug} must link the app shell`).toContain(`href="${APP_ROOT}`);
    }
    const html = indexHtml();
    expect(html).toContain(`href="${APP_ROOT_FROM_INDEX}"`);
    expect(html).toContain('href="../index.html');
  });

  it('gives every page a breadcrumb in markup and in structured data', () => {
    for (const file of [surahHtml(slugs[0]), indexHtml()]) {
      expect(file).toContain('class="seo-breadcrumb"');
      expect(file).toContain('BreadcrumbList');
      // Breadcrumb URLs must be absolute and must not introduce a second
      // spelling of a URL the site declares as a directory elsewhere.
      expect(file).not.toMatch(/"item":"[^"]*index\.html"/);
      expect(file).toContain(`"item":"${BASE_URL}/`);
    }
  });

  it('gives each surah page subheadings a reader and a crawler can use', () => {
    const html = surahHtml(slugs[1]);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    const h2 = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1].trim());
    expect(h2).toEqual(['معلومات السورة', 'نص السورة', 'تصفح السور']);
  });

  it('keeps the pages crawl-safe: no scripts beyond JSON-LD', () => {
    for (const slug of [slugs[0], slugs[1]]) {
      const scripts = [...surahHtml(slug).matchAll(/<script[^>]*>/g)].map((m) => m[0]);
      expect(scripts).toHaveLength(1);
      expect(scripts[0]).toContain('application/ld+json');
    }
  });

  it('lists the index in the sitemap', () => {
    const sitemap = read(join(ROOT, 'dist', 'sitemap.xml'));
    expect(sitemap).toContain(`<loc>${BASE_URL}/quran/</loc>`);
    for (const slug of [slugs[0], slugs[113]]) {
      expect(sitemap).toContain(`<loc>${BASE_URL}/quran/${slug}/</loc>`);
    }
  });
});
