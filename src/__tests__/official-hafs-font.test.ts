import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const fontPath = resolve(root, 'public/fonts/official/UthmanicHafs_V22.ttf');
const fontCssPath = resolve(root, 'public/fonts/fonts.css');
const templatePath = resolve(root, 'src/templates-panels.ts');
const noticePath = resolve(root, 'NOTICE.md');
const rightsPath = resolve(root, 'public/fonts/official/UTHMANIC-HAFS-USAGE-RIGHTS.ar.md');
const OFFICIAL_HAFS_SHA256 = 'aa68bffce289b4c0ebac68e90502eb69e42356abcd1603cb2b8e99c2c723f145';

describe('official Uthmanic Hafs font', () => {
  it('ships the original approved font binary without transformation', () => {
    const digest = createHash('sha256').update(readFileSync(fontPath)).digest('hex');
    expect(digest).toBe(OFFICIAL_HAFS_SHA256);
  });

  it('declares the font as a self-hosted reading font and exposes it in display settings', () => {
    const fontCss = readFileSync(fontCssPath, 'utf8');
    const template = readFileSync(templatePath, 'utf8');

    expect(fontCss).toContain("font-family: 'KFGQPC HAFS Uthmanic Script'");
    expect(fontCss).toContain("src: url('./official/UthmanicHafs_V22.ttf') format('truetype')");
    expect(template).toContain("value=\"'KFGQPC HAFS Uthmanic Script','Traditional Arabic',serif\"");
  });

  it('preserves the required King Fahd Complex attribution and usage notice', () => {
    const notice = readFileSync(noticePath, 'utf8');
    const rights = readFileSync(rightsPath, 'utf8');

    expect(notice).toContain('King Fahd Glorious Quran Printing Complex');
    expect(notice).toContain('not modified, reprogrammed, or sold');
    expect(rights).toContain('https://fonts.qurancomplex.gov.sa/hafs-reading/');
    expect(rights).toContain(OFFICIAL_HAFS_SHA256);
  });
});
