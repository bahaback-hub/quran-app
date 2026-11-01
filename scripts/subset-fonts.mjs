#!/usr/bin/env node
/**
 * Subset the self-hosted UI fonts (Amiri + Scheherazade New) down to the
 * characters this app can actually render.
 *
 * Why: `vite.config.js` precaches every *.woff2 under public/fonts (except the
 * page-based QCF4 mushaf fonts), so all five faces were ~584KB of service-worker
 * precache for glyphs nobody ever looks at (Cyrillic, Greek, Devanagari, ...).
 *
 * Coverage strategy — the resulting fonts must render EVERY character the app
 * can show, so the glyph set is the union of:
 *   1. every codepoint that appears in src/**, index.html and the bundled
 *      translation JSON files (en/fr/ur — ur is Urdu in the Arabic script);
 *   2. a conservative safety net of blocks (Arabic + presentation forms +
 *      Quranic annotations, Latin-1 supplement and extended-A, punctuation,
 *      currency, geometric shapes and dingbats used by the UI).
 * Anything else is dropped. Run with --dry-run to preview savings.
 *
 * Regenerate: `npm run fonts:subset`
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import subsetFont from 'subset-font';
import { renameWoff2File } from './lib/font-name.mjs';

const { values: args } = parseArgs({
  options: { 'dry-run': { type: 'boolean', default: false } },
  strict: true,
});

const FONT_DIR = 'public/fonts';
const FONTS = [
  'amiri-regular-400.woff2',
  'amiri-bold-700.woff2',
  'scheherazade-regular-400.woff2',
  'scheherazade-bold-700.woff2',
];

/**
 * A subset is a *Modified Version* under the SIL Open Font License, and the
 * Scheherazade license reserves the names "Scheherazade" and "SIL" for the
 * original. So after subsetting, the family is renamed to "Mushaf Naskh" while
 * the copyright and license notices inside the file stay intact
 * (see `scripts/lib/font-name.mjs` and `public/fonts/OFL-Scheherazade.txt`).
 */
const RENAMED_FAMILIES = {
  'scheherazade-regular-400.woff2': {
    family: 'Mushaf Naskh',
    subfamily: 'Regular',
    postscript: 'MushafNaskh-Regular',
    vendor: 'Quran App',
  },
  'scheherazade-bold-700.woff2': {
    family: 'Mushaf Naskh',
    subfamily: 'Bold',
    postscript: 'MushafNaskh-Bold',
    vendor: 'Quran App',
  },
};

/** Unicode blocks kept even when no source file mentions them. */
const SAFETY_BLOCKS = [
  [0x0020, 0x007e], // Basic Latin
  [0x0600, 0x06ff], // Arabic (incl. Quranic annotation signs)
  [0x0750, 0x077f], // Arabic Supplement
  [0x0870, 0x089f], // Arabic Extended-B
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0x2000, 0x206f], // General punctuation (dashes, quotes, ZWJ/ZWNJ)
];

function* walk(dir, extensions) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, extensions);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      yield full;
    }
  }
}

function collectCodepoints() {
  const points = new Set();
  const add = (text) => {
    for (const char of text) {
      const cp = char.codePointAt(0);
      // Lone surrogates and C0/C1 controls are not glyphs.
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) continue;
      points.add(cp);
    }
  };

  for (const file of walk('src', ['.ts', '.js', '.css', '.html'])) add(readFileSync(file, 'utf8'));
  for (const file of ['index.html']) add(readFileSync(file, 'utf8'));
  for (const file of walk('public', ['.html'])) add(readFileSync(file, 'utf8'));

  const translationDir = 'public/data/translations';
  try {
    for (const file of readdirSync(translationDir)) {
      if (file.endsWith('.json')) add(readFileSync(join(translationDir, file), 'utf8'));
    }
  } catch {
    console.warn('[fonts] translation dir not readable — falling back to source inventory only');
  }

  for (const [start, end] of SAFETY_BLOCKS) {
    for (let cp = start; cp <= end; cp += 1) points.add(cp);
  }

  return [...points].sort((a, b) => a - b);
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

async function main() {
  const codepoints = collectCodepoints();
  const text = String.fromCodePoint(...codepoints);
  console.log(
    `[fonts] glyph set: ${codepoints.length} codepoints ` +
      `(0x${codepoints[0].toString(16)}..0x${codepoints[codepoints.length - 1].toString(16)})`,
  );

  let beforeTotal = 0;
  let afterTotal = 0;
  let failures = 0;

  for (const name of FONTS) {
    const path = join(FONT_DIR, name);
    const before = readFileSync(path);
    let after;
    try {
      after = await subsetFont(before, text, { targetFormat: 'woff2' });
    } catch (err) {
      console.error(`[fonts] FAILED ${name}: ${err.message}`);
      failures += 1;
      continue;
    }
    const saved = before.length - after.length;
    const pct = ((saved / before.length) * 100).toFixed(1);
    console.log(`[fonts] ${name}: ${kb(before.length)} -> ${kb(after.length)} ` + `(saved ${kb(saved)}, ${pct}%)`);
    beforeTotal += before.length;
    afterTotal += after.length;
    if (!args['dry-run']) {
      writeFileSync(path, after);
      const rename = RENAMED_FAMILIES[name];
      if (rename) {
        const renamed = await renameWoff2File(path, rename);
        console.log(`[fonts] ${name}: family renamed to "${rename.family}" ` + `(${kb(renamed.after)})`);
      }
    }
  }

  console.log(
    `[fonts] TOTAL ${kb(beforeTotal)} -> ${kb(afterTotal)} ` +
      `(saved ${kb(beforeTotal - afterTotal)}, ${(((beforeTotal - afterTotal) / beforeTotal) * 100).toFixed(1)}%)`,
  );
  if (args['dry-run']) console.log('[fonts] dry run — nothing written');

  if (failures) {
    console.error(`[fonts] ${failures} font(s) could not be subset — check the source files`);
    process.exit(1);
  }
  // Guard against a future config change silently re-precaching huge fonts.
  if (!args['dry-run'] && afterTotal > 400 * 1024) {
    console.warn('[fonts] subsetted set is still over 400KB — review the glyph inventory');
  }
}

main();
