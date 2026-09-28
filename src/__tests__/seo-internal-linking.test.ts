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
import { join, resolve, dirname, relative } from 'node:path';

const ROOT = process.cwd();
const GENERATOR = join(ROOT, 'scripts', 'generate-seo-pages.mjs');
const DIST = join(ROOT, 'dist');
const BASE_URL = 'https://bahaback-hub.github.io/quran-app';
/** Every locale the generator publishes, with its dist root and app depth. */
const LOCALE_ROOTS = [
  { lang: 'ar', dir: join(DIST, 'quran'), prefix: '', depth: 2 },
  { lang: 'en', dir: join(DIST, 'en', 'quran'), prefix: '/en', depth: 3 },
];

const read = (p: string) => readFileSync(p, 'utf8');

const slugsByLocale = new Map<string, string[]>();

beforeAll(() => {
  // The generator resolves its paths from its own location, so it does not need
  // a particular cwd. It writes into ./dist alongside whatever `vite build`
  // produced - and on CI there may be no build at all, which is why nothing
  // below may assume dist/index.html exists.
  execFileSync(process.execPath, [GENERATOR], { encoding: 'utf8' });
  for (const { lang, dir } of LOCALE_ROOTS) {
    slugsByLocale.set(
      lang,
      readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name),
    );
  }
}, 180_000);

const surahHtml = (dir: string, slug: string) => read(join(dir, slug, 'index.html'));
const indexHtml = (dir: string) => read(join(dir, 'index.html'));
const pageFiles = (dir: string, slugs: string[]) => [
  ...slugs.map((s) => join(dir, s, 'index.html')),
  join(dir, 'index.html'),
];
/** The one path that points out of the generated tree, at the app shell. */
const appHref = (depth: number, isIndex: boolean) =>
  '../'.repeat(depth - (isIndex ? 1 : 0)).replace(/\/$/, '') + '/index.html';

describe('surah pages are internally linked', () => {
  it('emits all 114 surah pages plus the index in every locale', () => {
    for (const { lang, dir } of LOCALE_ROOTS) {
      expect(slugsByLocale.get(lang), `${lang} surah dirs`).toHaveLength(114);
      expect(existsSync(join(dir, 'index.html')), `${lang} index`).toBe(true);
    }
  });

  it('has an index page linking every surah', () => {
    for (const { lang, dir } of LOCALE_ROOTS) {
      const slugs = slugsByLocale.get(lang) ?? [];
      const html = indexHtml(dir);
      const links = new Set([...html.matchAll(/href="([a-z0-9-]+)\/"/g)].map((m) => m[1]));
      for (const slug of slugs) {
        expect(links.has(slug), `${lang} index must link ${slug}`).toBe(true);
      }
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
      expect((html.match(/<h2[\s>]/g) ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('lists the surahs under Meccan and Medinan headings', () => {
    for (const { lang, dir } of LOCALE_ROOTS) {
      const html = indexHtml(dir);
      const headings = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]);
      expect(headings, lang).toHaveLength(2);
      expect(html, `${lang} ItemList`).toMatch(/"numberOfItems":114/);
    }
    expect(indexHtml(join(DIST, 'quran'))).toContain('سور مكية');
    expect(indexHtml(join(DIST, 'quran'))).toContain('سور مدنية');
    expect(indexHtml(join(DIST, 'en', 'quran'))).toContain('Meccan surahs');
    expect(indexHtml(join(DIST, 'en', 'quran'))).toContain('Medinan surahs');
  });

  it('links each surah to its neighbours and to the index', () => {
    // Second surah has both neighbours, so check it and the two ends.
    for (const { lang, dir } of LOCALE_ROOTS) {
      const slugs = slugsByLocale.get(lang) ?? [];
      for (const slug of [slugs[1], slugs[0], slugs[113]]) {
        const html = surahHtml(dir, slug);
        expect(html, `${lang}/${slug} must reach the index`).toContain('href="../index.html"');
        expect(html, `${lang}/${slug} must offer a sibling`).toMatch(/href="\.\.\/[a-z0-9-]+\/"/);
      }
    }
  });

  it('resolves every relative link that stays inside the generated tree', () => {
    // The link up to the app shell is excluded: the app is written by
    // `vite build`, and this suite runs in CI where no build has happened, so
    // dist/index.html legitimately does not exist yet. It resolves *into* dist
    // rather than above it, so the guard has to name that exact file - checking
    // only for "escapes dist" misses it and reports 690 false positives.
    // Asserting the file existed made this test pass only on a machine that had
    // just built, which is what let it fail in CI. Those links are checked for
    // depth in the next test instead.
    const APP_SHELL = join(DIST, 'index.html');
    const broken: string[] = [];
    for (const { lang, dir } of LOCALE_ROOTS) {
      const slugs = slugsByLocale.get(lang) ?? [];
      for (const file of pageFiles(dir, slugs)) {
        const html = read(file);
        const from = dirname(file);
        for (const m of html.matchAll(/href="([^"]+)"/g)) {
          const href = m[1];
          if (/^(https?:|mailto:|#)/.test(href)) continue;
          const path = href.split('#')[0];
          if (!path) continue;
          const target = resolve(from, path);
          if (target === APP_SHELL) continue;
          if (relative(DIST, target).startsWith('..')) {
            broken.push(`${lang}: ${file} -> ${href} leaves dist`);
            continue;
          }
          const ok = path.endsWith('/') ? existsSync(join(target, 'index.html')) : existsSync(target);
          if (!ok) broken.push(`${lang}: ${file} -> ${href}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('climbs out to the app shell at the right depth from each page', () => {
    for (const { lang, dir, depth } of LOCALE_ROOTS) {
      const slugs = slugsByLocale.get(lang) ?? [];
      for (const slug of slugs) {
        const html = surahHtml(dir, slug);
        expect(html, `${lang}/${slug} must link the surah index`).toContain('href="../index.html"');
        expect(html, `${lang}/${slug} must link the app shell`).toContain(`href="${appHref(depth, false)}`);
      }
      const html = indexHtml(dir);
      // The index sits one level higher, so its link up must be one shorter.
      expect(html, `${lang} index app href`).toContain(`href="${appHref(depth, true)}`);
    }
  });

  it('declares its own language and links every other locale', () => {
    for (const { lang, dir } of LOCALE_ROOTS) {
      const slugs = slugsByLocale.get(lang) ?? [];
      for (const [file, tail] of [
        [surahHtml(dir, slugs[1]), `${slugs[1]}/`],
        [indexHtml(dir), ''],
      ] as [string, string][]) {
        expect(file, `${lang} html lang`).toContain(`<html lang="${lang}"`);
        const alts = [...file.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)];
        expect(alts.map((a) => a[1]).sort(), `${lang} hreflang set`).toEqual(['ar', 'en']);
        // Reciprocity: the page must be listed under its own language, and every
        // alternate must point at the same page in the other locale - differing
        // only by the /en prefix, not by being a copy of this URL.
        expect(
          alts.some((a) => a[1] === lang),
          `${lang} must declare itself`,
        ).toBe(true);
        for (const [, hreflang, href] of alts) {
          expect(href, `${lang} -> ${hreflang}`).toBe(`${BASE_URL}${hreflang === 'en' ? '/en' : ''}/quran/${tail}`);
        }
      }
    }
  });

  it('marks the Quranic text as Arabic on every locale', () => {
    for (const { lang, dir } of LOCALE_ROOTS) {
      const slugs = slugsByLocale.get(lang) ?? [];
      expect(surahHtml(dir, slugs[1]), `${lang} article lang`).toContain('<article lang="ar" dir="rtl">');
    }
  });

  it('gives every page a breadcrumb in markup and in structured data', () => {
    for (const { lang, dir } of LOCALE_ROOTS) {
      const slugs = slugsByLocale.get(lang) ?? [];
      for (const file of [surahHtml(dir, slugs[0]), indexHtml(dir)]) {
        expect(file, `${lang} breadcrumb markup`).toContain('class="seo-breadcrumb"');
        expect(file, `${lang} BreadcrumbList`).toContain('BreadcrumbList');
        // Breadcrumb URLs must be absolute and must not introduce a second
        // spelling of a URL the site declares as a directory elsewhere.
        expect(file).not.toMatch(/"item":"[^"]*index\.html"/);
        expect(file).toContain(`"item":"${BASE_URL}/`);
      }
    }
  });

  it('gives each surah page subheadings a reader and a crawler can use', () => {
    const slugs = slugsByLocale.get('en') ?? [];
    const html = surahHtml(join(DIST, 'en', 'quran'), slugs[1]);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    const h2 = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1].trim());
    expect(h2).toEqual(['About this surah', 'Surah text', 'Browse surahs']);
  });

  it('keeps the pages crawl-safe: no scripts beyond JSON-LD', () => {
    for (const { lang, dir } of LOCALE_ROOTS) {
      const slugs = slugsByLocale.get(lang) ?? [];
      for (const slug of [slugs[0], slugs[1]]) {
        const scripts = [...surahHtml(dir, slug).matchAll(/<script[^>]*>/g)].map((m) => m[0]);
        expect(scripts, `${lang}/${slug}`).toHaveLength(1);
        expect(scripts[0]).toContain('application/ld+json');
      }
    }
  });

  it('lists every locale and the privacy policy in the sitemap', () => {
    const sitemap = read(join(DIST, 'sitemap.xml'));
    expect(sitemap).toContain(`<loc>${BASE_URL}/quran/</loc>`);
    expect(sitemap).toContain(`<loc>${BASE_URL}/en/quran/</loc>`);
    expect(sitemap).toContain(`<loc>${BASE_URL}/privacy-policy.html</loc>`);
    const slugs = slugsByLocale.get('ar') ?? [];
    for (const slug of [slugs[0], slugs[113]]) {
      expect(sitemap).toContain(`<loc>${BASE_URL}/quran/${slug}/</loc>`);
      expect(sitemap).toContain(`<loc>${BASE_URL}/en/quran/${slug}/</loc>`);
    }
    // Every surah URL must carry both alternates, or hreflang is not reciprocal.
    const enEntry = sitemap.split('\n').find((l) => l.includes(`/en/quran/${slugs[0]}/</loc>`));
    expect(enEntry).toContain('hreflang="ar"');
    expect(enEntry).toContain('hreflang="en"');
  });
});
