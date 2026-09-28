/**
 * Guard: the Arabic copy must stay real Arabic.
 *
 * The Arabic strings for the static pages were once literals inside
 * scripts/generate-seo-pages.mjs. Every ad-hoc edit of that file re-encoded it
 * as Windows-1252, which turned the text into letter-shuffled mojibake across 18
 * lines - including ARABIC_DIGITS, the ayah ornament and the surah-prefix regex.
 * The pages still built, still returned 200, and every structural test passed,
 * because mojibake is still valid UTF-8. The rendered numbers were broken, the
 * surah names kept their "سورة" prefix, and the headings read as nonsense.
 *
 * Nothing about a green build caught it, so it is caught here instead.
 *
 * Every non-ASCII literal in this file is written as a \u escape on purpose. A
 * check meant to catch an encoding fault cannot afford to contain the kind of
 * literal it is looking for - an invisible or RTL character inside a character
 * class is exactly what a re-encoding pass would corrupt first, and the failure
 * would look like a flaky test rather than a real one.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const generator = readFileSync(resolve(ROOT, 'scripts', 'generate-seo-pages.mjs'), 'utf8');
const arStringsRaw = readFileSync(resolve(ROOT, 'scripts', 'seo-strings.ar.json'), 'utf8');
const arStrings = JSON.parse(arStringsRaw) as Record<string, string>;

/**
 * Arabic script, its presentation forms, and the punctuation the copy uses.
 * Every codepoint is written as a number: a literal string of punctuation in a
 * file whose whole purpose is catching encoding damage is the wrong place to
 * rely on the text surviving intact. An earlier version of this file spelled the
 * punctuation out and the period in it was not U+002E.
 */
const ALLOWED_CODEPOINTS = new Set<number>([
  0x20, // space
  0x2d, // hyphen-minus
  0x28, // (
  0x29, // )
  0x2e, // full stop
  0x2c, // comma
  0x3a, // colon
  0x3b, // semicolon
  0x25, // percent
  0x22, // "
  0x27, // '
  0x2f, // /
  0x26, // &
  0x2b, // +
  0xab, // «
  0xbb, // »
  0x60c, // Arabic comma
  0x61f, // Arabic question mark
  0x2014, // em dash
  0x2039, // single left-pointing angle, the breadcrumb separator
]);

const isArabicScript = (cp: number) =>
  (cp >= 0x0600 && cp <= 0x06ff) || // Arabic
  (cp >= 0x0750 && cp <= 0x077f) || // Arabic Supplement
  (cp >= 0x08a0 && cp <= 0x08ff) || // Arabic Extended-A
  (cp >= 0xfb50 && cp <= 0xfdff) || // Arabic Presentation Forms-A, incl. the ornate brackets
  (cp >= 0xfe70 && cp <= 0xfeff); // Arabic Presentation Forms-B

const isAllowed = (cp: number) => isArabicScript(cp) || ALLOWED_CODEPOINTS.has(cp);

/** {name}-style holes are filled in at build time and are not shipped copy. */
const stripPlaceholders = (s: string) => s.replace(/\{[a-zA-Z]+\}/g, '');

const arabicCount = (s: string) =>
  [...s].filter((c) => c.codePointAt(0)! >= 0x600 && c.codePointAt(0)! <= 0x6ff).length;

const describeBad = (s: string) =>
  [...stripPlaceholders(s)]
    .map((c) => [c, c.codePointAt(0)!] as const)
    .filter(([, cp]) => !isAllowed(cp))
    .map(([c, cp]) => `${c}=U+${cp.toString(16)}`)
    .join(' ');

const entries = Object.entries(arStrings).filter(([k]) => !k.startsWith('_'));

describe('Arabic copy survives encoding', () => {
  it('keeps every Arabic string inside the Arabic script', () => {
    const offenders = entries
      .filter(([, v]) => typeof v === 'string' && describeBad(v) !== '')
      .map(([k, v]) => `${k}: ${describeBad(v as string)}`);
    expect(offenders).toEqual([]);
  });

  it('keeps every Arabic sentence starting with an Arabic letter', () => {
    // Two values are deliberately not sentences: descriptionEnd continues the
    // sentence descriptionStart began, and breadcrumbSep is a single glyph.
    const FRAGMENTS = new Set(['descriptionEnd', 'descriptionReveal', 'breadcrumbSep']);
    const offenders = entries
      .filter(([k]) => !FRAGMENTS.has(k))
      .filter(([, v]) => typeof v === 'string' && !isArabicScript((v as string).codePointAt(0)!))
      .map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it('carries hundreds of real Arabic letters', () => {
    // A file that has been mangled and re-mangled can still hold a few valid
    // characters, so the total count is the real signal, not a boolean.
    expect(arabicCount(arStringsRaw)).toBeGreaterThan(400);
  });

  it('has no Latin-1 or C1 characters in the generator', () => {
    // The generator now carries no Arabic beyond the app's own name inside
    // structured data, so any Latin-1 or C1 character in it is a re-encoding
    // artefact rather than something intentional.
    const offenders = generator
      .split('\n')
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => /[\u0080-\u009F\u00A0-\u00BF]/.test(l))
      .map(([n, l]) => `L${n}: ${l.trim().slice(0, 80)}`);
    expect(offenders).toEqual([]);
  });

  it('has the surah prefix the source data actually uses', () => {
    // Spelled with the same vocalisation marks as quran-uthmani.json, otherwise
    // the strip silently stops matching and every surah keeps its "سورة" prefix.
    const data = JSON.parse(readFileSync(resolve(ROOT, 'public', 'data', 'quran-uthmani.json'), 'utf8')) as {
      data: { surahs: { name: string }[] };
    };
    const first = data.data.surahs[0].name.replace(/^\uFEFF/, '').trim();
    const re = new RegExp(`^${arStrings.surahPrefix.trim()}\\s+`, 'u');
    expect(re.test(first), `surahPrefix must match the start of "${first}"`).toBe(true);
  });

  it('keeps the ayah ornament the right way round', () => {
    // U+FD3F opens on the right-hand side, which is where an ayah number starts
    // in Arabic, and U+FD3E closes it. Swapping them mirrors the brackets.
    expect(arStrings.ayahOpen.codePointAt(0)!.toString(16)).toBe('fd3f');
    expect(arStrings.ayahClose.codePointAt(0)!.toString(16)).toBe('fd3e');
  });

  it('keeps the Arabic-Indic digits for zero through nine', () => {
    const digits = generator.match(/const ARABIC_DIGITS = \[(.*?)\]/s)?.[1] ?? '';
    const parsed = [...digits.matchAll(/'(.)'/g)].map((m) => m[1]);
    expect(parsed).toHaveLength(10);
    expect(parsed.map((d) => d.codePointAt(0))).toEqual([
      0x660, 0x661, 0x662, 0x663, 0x664, 0x665, 0x666, 0x667, 0x668, 0x669,
    ]);
  });
});
