/**
 * Compliance guard for the bundled Arabic text fonts.
 *
 * `public/fonts/scheherazade-*.woff2` are *subsets* of SIL's Scheherazade New.
 * OFL 1.1 forbids Modified Versions from using a Reserved Font Name, so those
 * two files were renamed to the family "Mushaf Naskh" with the copyright and
 * license notices left intact inside the font (see scripts/lib/font-name.mjs).
 *
 * These tests lock the approved bytes and stop the reserved name from creeping
 * back into any CSS `font-family` declaration.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY_QURAN_FONT_FAMILY, QURAN_FONT_FAMILY, QURAN_FONT_STACK, migrateFontFamily } from '../font-family.js';

const root = resolve(import.meta.dirname, '../..');
const fontsCss = readFileSync(resolve(root, 'public/fonts/fonts.css'), 'utf8');
const settingsTemplate = readFileSync(resolve(root, 'src/templates/panels/settings-panel.ts'), 'utf8');
const notice = readFileSync(resolve(root, 'NOTICE.md'), 'utf8');

/** SHA-256 of the renamed subset files — regenerate only with `npm run fonts:subset`. */
const APPROVED_FONTS: Record<string, string> = {
  'scheherazade-regular-400.woff2': '8eb2083d42ee84a8d7054b72a0c3d7847233ee5cf18f75719738b4954bc5b263',
  'scheherazade-bold-700.woff2': '64e8e1d5586cd721c6f3e4a72f42303335eeee7e902b0523130a7f46c1edb8a6',
};

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : cssFiles(full);
    }
    return entry.name.endsWith('.css') ? [full] : [];
  });
}

describe('Mushaf Naskh font family (OFL reserved-name compliance)', () => {
  it('declares the renamed family for both weights', () => {
    expect(QURAN_FONT_FAMILY).toBe('Mushaf Naskh');
    expect(fontsCss.match(new RegExp(`font-family: '${QURAN_FONT_FAMILY}';`, 'g'))?.length).toBe(2);
    expect(fontsCss).toContain("src: url('./scheherazade-regular-400.woff2')");
    expect(fontsCss).toContain("src: url('./scheherazade-bold-700.woff2')");
  });

  it('never presents the reserved name as a CSS family', () => {
    const reserved = new RegExp(`font-family:[^;{}]*${LEGACY_QURAN_FONT_FAMILY}`, 'i');
    const offenders = [...cssFiles(resolve(root, 'src')), resolve(root, 'public/fonts/fonts.css')].filter((file) =>
      reserved.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('offers the new stack in the display settings picker', () => {
    expect(QURAN_FONT_STACK).toBe("'Mushaf Naskh','Traditional Arabic',serif");
    expect(settingsTemplate).toContain('${QURAN_FONT_STACK}');
    expect(settingsTemplate).not.toContain(LEGACY_QURAN_FONT_FAMILY);
  });

  it('ships the exact approved (client-generated) subset bytes', () => {
    for (const [file, digest] of Object.entries(APPROVED_FONTS)) {
      const hash = createHash('sha256')
        .update(readFileSync(resolve(root, 'public/fonts', file)))
        .digest('hex');
      expect(hash, `${file} changed — rerun npm run fonts:subset and update this digest`).toBe(digest);
    }
  });

  it('documents the rename and keeps the SIL attribution', () => {
    expect(notice).toContain('Mushaf Naskh');
    expect(notice).toContain('reserves the names');
    expect(notice).toContain('OFL 1.1, © SIL Global');
    expect(readFileSync(resolve(root, 'public/fonts/OFL-Scheherazade.txt'), 'utf8')).toContain(
      'Reserved Font Names "Scheherazade" and "SIL"',
    );
  });
});

describe('migrateFontFamily', () => {
  it('rewrites the legacy single-quoted stack', () => {
    expect(migrateFontFamily("'Scheherazade New','Traditional Arabic',serif")).toBe(
      "'Mushaf Naskh','Traditional Arabic',serif",
    );
  });

  it('rewrites unquoted and double-quoted variants', () => {
    expect(migrateFontFamily('Scheherazade New, serif')).toBe("'Mushaf Naskh', serif");
    expect(migrateFontFamily('"Scheherazade New", serif')).toBe("'Mushaf Naskh', serif");
  });

  it('handles the older "Scheherazade" spelling without the "New" suffix', () => {
    expect(migrateFontFamily("'Scheherazade', serif")).toBe("'Mushaf Naskh', serif");
  });

  it('leaves every other family untouched', () => {
    for (const value of [
      "'Amiri','Traditional Arabic',serif",
      "'Traditional Arabic',serif",
      '',
      "'KFGQPC HAFS Uthmanic Script',serif",
    ]) {
      expect(migrateFontFamily(value)).toBe(value);
    }
  });

  it('is idempotent', () => {
    const once = migrateFontFamily("'Scheherazade New', 'Traditional Arabic', serif");
    expect(migrateFontFamily(once)).toBe(once);
  });
});
