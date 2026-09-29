/**
 * Guard: the sitemap must stay a valid XML document.
 *
 * Google Search Console reported "could not fetch" for this sitemap while every
 * ordinary check passed: 200, application/xml, well-formed, a correct Sitemap:
 * line in robots.txt, and Googlebot able to read it. The usual explanations
 * online - Jekyll hiding the file, the sitemap sitting in the wrong directory,
 * a missing robots.txt entry - were each ruled out by looking at the live site
 * rather than assumed, and this test exists so the remaining possibility, that
 * the document itself is malformed, cannot silently come back.
 *
 * The hreflang upgrade made this worth pinning: the sitemap now carries an
 * xhtml namespace and 230 alternates sets, and a single malformed attribute
 * would make the whole file unreadable, taking the surah pages' discovery with
 * it.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const BASE_URL = 'https://bahaback-hub.github.io/quran-app';
const LOCALES = ['ar', 'en'] as const;

let xml = '';
beforeAll(() => {
  // Runs the real generator, so this checks what is actually published.
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'generate-seo-pages.mjs')], { encoding: 'utf8' });
  xml = readFileSync(resolve(ROOT, 'dist', 'sitemap.xml'), 'utf8');
}, 120_000);

const locs = () => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
const entries = () =>
  xml
    .split('<url>')
    .slice(1)
    .map((chunk) => chunk.split('</url>')[0]!);

describe('sitemap', () => {
  it('is an XML document with the right declaration and namespaces', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.charCodeAt(0), 'must not start with a BOM').not.toBe(0xfeff);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    // The alternates need their own namespace declared, or the file is not
    // parseable as what it claims to be.
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('balances its tags', () => {
    const pairs: [string, string][] = [
      ['<urlset', '</urlset>'],
      ['<url>', '</url>'],
      ['<loc>', '</loc>'],
      ['<lastmod>', '</lastmod>'],
    ];
    for (const [open, close] of pairs) {
      const o = xml.split(open).length - 1;
      const c = xml.split(close).length - 1;
      expect(o, `${open}/${close}`).toBe(c);
    }
  });

  it('lists only absolute https URLs on this site', () => {
    const bad = locs().filter((l) => !new RegExp(`^${BASE_URL}/[^\\s]*$`).test(l));
    expect(bad).toEqual([]);
  });

  it('has no duplicate URLs', () => {
    const list = locs();
    expect(list.filter((l, i) => list.indexOf(l) !== i)).toEqual([]);
  });

  it('dates every entry in the W3C format', () => {
    const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]!);
    expect(dates.length).toBe(entries().length);
    expect(dates.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))).toEqual([]);
  });

  it('gives every localised page a complete, reciprocal alternates set', () => {
    const listed = new Set(locs());
    const localised = entries().filter((c) => c.includes('xhtml:link'));
    expect(localised.length).toBeGreaterThan(200);

    for (const chunk of localised) {
      const self = chunk.match(/<loc>([^<]+)<\/loc>/)![1]!;
      const hreflangs = [...chunk.matchAll(/hreflang="([a-z-]+)"/g)].map((m) => m[1]!).sort();
      expect(hreflangs, `${self} alternates`).toEqual([...LOCALES].sort());
      const hrefs = [...chunk.matchAll(/<xhtml:link[^>]*href="([^"]+)"/g)].map((m) => m[1]!);
      // Reciprocity: the page must appear in its own alternates, and every
      // alternate must also be listed as a page of its own.
      expect(hrefs, `${self} must list itself`).toContain(self);
      for (const href of hrefs) {
        expect(listed.has(href), `${href} should also be a loc`).toBe(true);
      }
    }
  });

  it('covers both locales of every surah page', () => {
    const list = locs();
    for (const [locale, prefix] of [
      ['ar', `${BASE_URL}/quran/`],
      ['en', `${BASE_URL}/en/quran/`],
    ] as const) {
      // 114 surahs plus the index page, so simply everything under the prefix.
      const count = list.filter((l) => l.startsWith(prefix)).length;
      expect(count, `${locale} surah URLs`).toBe(115);
    }
  });

  it('lists the standalone pages that were previously unreachable', () => {
    for (const path of ['/privacy-policy.html', '/faq/', '/en/faq/']) {
      expect(locs(), path).toContain(`${BASE_URL}${path}`);
    }
  });

  it('is pointed at by robots.txt with the same absolute URL', () => {
    const robots = readFileSync(resolve(ROOT, 'dist', 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${BASE_URL}/sitemap.xml`);
    expect(robots).toContain('User-agent: *');
    expect(robots).toMatch(/^Allow: \/$/m);
  });

  it('declares the same alternates on the app shell as the sitemap does', () => {
    // The shell is the one page Google reaches first, so its hreflang has to
    // agree with the sitemap. Disagreeing sets are treated as conflicting
    // signals and both get dropped, which is worse than declaring nothing.
    const head = readFileSync(resolve(ROOT, 'dist', 'index.html'), 'utf8').split('</head>')[0]!;
    const declared = [...head.matchAll(/<link\s+rel="alternate"[^>]*hreflang="([^"]+)"[^>]*>/g)].map((m) => m[1]!);
    expect(declared.sort()).toEqual(['ar', 'en', 'x-default']);

    // Every href must be a real page that the sitemap also lists, and the ar/en
    // pair must point at each other.
    const listed = new Set(locs());
    const hrefOf = (lang: string) => head.match(new RegExp(`hreflang="${lang}"[^>]*href="([^"]+)"`))![1]!;
    for (const lang of ['ar', 'en', 'x-default']) {
      expect(listed.has(hrefOf(lang)), `${lang} href must be a listed page`).toBe(true);
    }
    const arEntry = locs().includes(hrefOf('ar'))
      ? entries().find((c) => c.includes(`<loc>${hrefOf('ar')}</loc>`))!
      : '';
    expect(arEntry, 'ar page must declare en back').toContain(hrefOf('en'));
  });

  it('uses absolute social image URLs, not base-relative ones', () => {
    // Facebook and WhatsApp resolve og:image against the deployment host. A
    // relative path is the single most common reason a share preview is blank,
    // and %BASE_URL% would be published literally if nothing substituted it.
    const head = readFileSync(resolve(ROOT, 'dist', 'index.html'), 'utf8').split('</head>')[0]!;
    for (const prop of ['og:image', 'twitter:image']) {
      const content =
        head.match(new RegExp(`property="${prop}"[^>]*content="([^"]*)"`))?.[1] ??
        head.match(new RegExp(`name="${prop}"[^>]*content="([^"]*)"`))?.[1];
      expect(content, prop).toBeDefined();
      expect(content, `${prop} must be absolute`).toMatch(/^https:\/\//);
      expect(content, `${prop} must not keep the build placeholder`).not.toContain('%');
    }
  });

  it('is advertised by the pages themselves, not only by robots.txt', () => {
    // Search Console fills in "sitemaps discovered" from a rel="sitemap" in the
    // markup. robots.txt alone still requires a manual submit, which is exactly
    // the gap this closes, so every generated page has to carry it.
    const pages = [
      resolve(ROOT, 'dist', 'index.html'),
      resolve(ROOT, 'dist', 'quran', 'index.html'),
      resolve(ROOT, 'dist', 'en', 'quran', 'index.html'),
      resolve(ROOT, 'dist', 'faq', 'index.html'),
      resolve(ROOT, 'dist', 'en', 'faq', 'index.html'),
      resolve(ROOT, 'dist', 'quran', 'al-fatihah', 'index.html'),
    ];
    for (const page of pages) {
      const head = readFileSync(page, 'utf8').split('</head>')[0]!;
      expect(head, page).toContain(`<link rel="sitemap" type="application/xml" href="${BASE_URL}/sitemap.xml" />`);
    }
  });

  it('does not list itself, and advertises a single canonical host', () => {
    // A sitemap is not a page to index, so it should not list itself. What
    // matters instead is that one host is used throughout: a sitemap mixing
    // bahaback-hub.github.io with a custom domain splits the signals.
    expect(locs().some((l) => l.endsWith('/sitemap.xml'))).toBe(false);
    const hosts = new Set(locs().map((l) => new URL(l).host));
    expect([...hosts]).toEqual(['bahaback-hub.github.io']);
  });
});
