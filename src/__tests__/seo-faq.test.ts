/**
 * Guard: the FAQ pages must stay real, complete and consistent.
 *
 * A FAQ is the easiest kind of page to get quietly wrong. If the copy and the
 * structured data drift apart, the page is still 200, the badge may still show,
 * and crawlers are told one thing while readers see another. And an answer that
 * overstates what the app does is worse than no answer at all, so the wording is
 * checked against the app rather than trusted.
 *
 * Both pages are static HTML with no JavaScript, so all of this is string and
 * JSON work.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const BASE_URL = 'https://bahaback-hub.github.io/quran-app';
const GENERATOR = join(ROOT, 'scripts', 'generate-faq-pages.mjs');
const LOCALES = [
  { code: 'ar', dir: join(DIST, 'faq'), url: `${BASE_URL}/faq/`, app: '..' },
  { code: 'en', dir: join(DIST, 'en', 'faq'), url: `${BASE_URL}/en/faq/`, app: '../..' },
];

interface Copy {
  title: string;
  subtitle: string;
  intro: string;
  questions: { q: string; a: string }[];
}

const copies = new Map<string, Copy>();
let pages = new Map<string, string>();

beforeAll(() => {
  for (const { code } of LOCALES) {
    copies.set(code, JSON.parse(readFileSync(join(ROOT, 'scripts', `seo-faq.${code}.json`), 'utf8')) as Copy);
  }
  execFileSync(process.execPath, [GENERATOR], { encoding: 'utf8' });
  for (const { code, dir } of LOCALES) {
    const file = join(dir, 'index.html');
    if (existsSync(file)) pages.set(code, readFileSync(file, 'utf8'));
  }
}, 60_000);

const unescape = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

describe('FAQ pages', () => {
  it('emits one page per locale', () => {
    for (const { code, dir } of LOCALES) {
      expect(pages.has(code), `${code} page missing at ${dir}`).toBe(true);
    }
  });

  it('declares its own language and the same set of alternates', () => {
    for (const { code, url } of LOCALES) {
      const html = pages.get(code)!;
      expect(html).toContain(`<html lang="${code}"`);
      expect(html).toContain(`<link rel="canonical" href="${url}"`);
      const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)];
      expect(alts.map((a) => a[1]).sort()).toEqual(['ar', 'en']);
      for (const [, hreflang, href] of alts) {
        expect(href).toBe(hreflang === 'en' ? `${BASE_URL}/en/faq/` : `${BASE_URL}/faq/`);
      }
    }
  });

  it('shows every question as a heading, once, in the copy order', () => {
    for (const { code } of LOCALES) {
      const copy = copies.get(code)!;
      const html = pages.get(code)!;
      const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => unescape(m[1] ?? ''));
      expect(headings, `${code} heading count`).toHaveLength(copy.questions.length);
      expect(headings, `${code} headings must match the copy in order`).toEqual(copy.questions.map((q) => q.q));
    }
  });

  it('describes the same questions in its structured data', () => {
    for (const { code } of LOCALES) {
      const copy = copies.get(code)!;
      const html = pages.get(code)!;
      const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1];
      const graph = JSON.parse(raw)['@graph'] as { '@type': string; mainEntity?: unknown[] }[];
      const faq = graph.find((n) => n['@type'] === 'FAQPage')!;
      expect(faq, `${code} has no FAQPage`).toBeDefined();
      expect(faq.mainEntity).toHaveLength(copy.questions.length);
      const named = (faq.mainEntity as { name: string; acceptedAnswer: { text: string } }[]).map((q) => [
        q.name,
        q.acceptedAnswer.text,
      ]);
      expect(named).toEqual(copy.questions.map((q) => [q.q, q.a]));
    }
  });

  it('has one h1 and no scripts beyond its JSON-LD', () => {
    for (const { code } of LOCALES) {
      const html = pages.get(code)!;
      expect(html.match(/<h1[\s>]/g), `${code} h1 count`).toHaveLength(1);
      const scripts = [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]);
      expect(scripts, `${code} scripts`).toHaveLength(1);
      expect(scripts[0]).toContain('application/ld+json');
    }
  });

  it('answers every question with a real sentence, not a stub', () => {
    for (const { code } of LOCALES) {
      for (const item of copies.get(code)!.questions) {
        expect(item.a.length, `${code}: "${item.q}" answer is ${item.a.length} chars`).toBeGreaterThan(50);
        expect(
          item.q.trim().endsWith('?') || item.q.trim().endsWith('؟'),
          `${code}: "${item.q}" is not a question`,
        ).toBe(true);
      }
    }
  });

  it('keeps the two locales in step about what the app does', () => {
    // The same count on both sides, so one language cannot quietly gain or lose
    // a claim the other still makes.
    expect(copies.get('ar')!.questions).toHaveLength(copies.get('en')!.questions.length);
    expect(copies.get('ar')!.questions.length).toBeGreaterThanOrEqual(12);
  });

  it('links back to the app and the surah index at the right depth', () => {
    for (const { code, app } of LOCALES) {
      const html = pages.get(code)!;
      expect(html, `${code} app link`).toContain(`href="${app}/index.html"`);
      expect(html, `${code} index link`).toContain(`href="${app}/quran/"`);
    }
  });

  it('has no encoding junk in either page', () => {
    // The guillemets and the Arabic punctuation legitimately sit in the Latin-1
    // range, so they are excluded before the mojibake check rather than after.
    const allowed = new Set([0xab, 0xbb, 0x60c, 0x61f, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026, 0x2039]);
    for (const { code } of LOCALES) {
      const html = pages.get(code)!;
      const junk = [...html].filter((c) => {
        const cp = c.codePointAt(0)!;
        if (allowed.has(cp)) return false;
        return (cp >= 0x80 && cp <= 0x9f) || (cp >= 0xa0 && cp <= 0xbf);
      });
      expect(
        junk.map((c) => c.codePointAt(0)?.toString(16) ?? '?'),
        `${code} junk chars`,
      ).toEqual([]);
    }
  });

  it('keeps the Arabic copy inside the Arabic script', () => {
    const isArabic = (cp: number) =>
      (cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff);
    const strip = (s: string) => s.replace(/\{[a-zA-Z]+\}/g, '');
    const allowed = new Set([...' -().,:;%', 0xab, 0xbb, 0x60c, 0x61f, 0x2014, 0x2039, 0x27, 0x22, 0x2f, 0x26, 0x2b]);
    const copy = copies.get('ar')!;
    const offenders: string[] = [];
    for (const [i, item] of copy.questions.entries()) {
      for (const s of [item.q, item.a]) {
        for (const c of strip(s)) {
          const cp = c.codePointAt(0)!;
          if (!isArabic(cp) && !allowed.has(cp) && !(cp >= 0x20 && cp <= 0x7e)) {
            offenders.push(`q${i}: ${c}=U+${cp.toString(16)}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
