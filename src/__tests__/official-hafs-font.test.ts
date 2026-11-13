import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const fontPath = resolve(root, 'public/fonts/official/UthmanicHafs_V22.ttf');
const fontCssPath = resolve(root, 'public/fonts/fonts.css');
const templatePath = resolve(root, 'src/templates/panels/settings-panel.ts');
const noticePath = resolve(root, 'NOTICE.md');
const rightsPath = resolve(root, 'public/fonts/official/UTHMANIC-HAFS-USAGE-RIGHTS.ar.md');
const OFFICIAL_HAFS_SHA256 = 'aa68bffce289b4c0ebac68e90502eb69e42356abcd1603cb2b8e99c2c723f145';

/**
 * fonts.css is hand-minified (one line) to keep the render-blocking sheet small,
 * so these assertions compare declarations rather than formatting. Whitespace
 * and the space after a colon carry no meaning in CSS.
 */
const normalizeCss = (css: string): string => css.replace(/\s+/g, ' ').replace(/\s*:\s*/g, ': ');

describe('official Uthmanic Hafs font', () => {
  it('ships the original approved font binary without transformation', () => {
    const digest = createHash('sha256').update(readFileSync(fontPath)).digest('hex');
    expect(digest).toBe(OFFICIAL_HAFS_SHA256);
  });

  it('declares the font as a self-hosted reading font and exposes it in display settings', () => {
    const fontCss = normalizeCss(readFileSync(fontCssPath, 'utf8'));
    const template = readFileSync(templatePath, 'utf8');

    expect(fontCss).toContain("font-family: 'KFGQPC HAFS Uthmanic Script'");
    expect(fontCss).toContain("src: url('./official/UthmanicHafs_V22.ttf') format('truetype')");
    expect(template).toContain("value=\"'KFGQPC HAFS Uthmanic Script','Traditional Arabic',serif\"");
  });

  it('uses font-display swap so slow WebViews (Android TV) still apply it', () => {
    const fontCss = readFileSync(fontCssPath, 'utf8');
    const kfgBlock = normalizeCss(fontCss.slice(fontCss.indexOf("'KFGQPC HAFS Uthmanic Script'")));
    expect(kfgBlock).toContain('font-display: swap');
    expect(kfgBlock).not.toContain('font-display: optional');
  });

  it('loads fonts.css through a document-relative URL so web and Capacitor can resolve it', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    // N-01: the framebust guard ships from public/ as a classic
    // parser-blocking script (see static-page-framebust.test.ts).
    expect(html).toContain('<script src="%BASE_URL%framebust.js"></script>');
    expect(html).not.toContain('src/framebust.ts');
    expect(html).toContain('href="fonts/fonts.css" fetchpriority="high" vite-ignore');
    expect(html).not.toContain('href="/fonts/fonts.css"');
    // Any reference to the font that does appear in the shell must be
    // document-relative, because the Capacitor WebView serves from its own root.
    for (const ref of html.match(/href="[^"]*UthmanicHafs[^"]*"/g) ?? []) {
      expect(ref).not.toMatch(/^href="\//);
    }
  });

  it('keeps the Quran-script font off the critical path', () => {
    // The reading view now asks for this face, but it is only fetched once the
    // reader opens. Preloading the 291KB TTF from index.html would put it on
    // the critical path of every visit — including the home screen, which uses
    // the small Amiri subset — so the preload list stays as it is.
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html).not.toMatch(/<link[^>]+UthmanicHafs[^>]*>/);
    // The body font is used on the first screen, so it stays preloaded.
    expect(html).toContain('href="fonts/amiri-regular-400.woff2"');
  });

  it('is the default face of the Quran text, so the reader matches the printed mushaf', () => {
    const surahCss = readFileSync(resolve(root, 'src/css/surah.css'), 'utf8');
    expect(surahCss).toMatch(/\.ayahs-container \{[^}]*font-family: 'KFGQPC HAFS Uthmanic Script'/);
    expect(surahCss).toMatch(/\.bismillah \{[^}]*font-family: 'KFGQPC HAFS Uthmanic Script'/);

    const template = readFileSync(templatePath, 'utf8');
    expect(template).toMatch(/value="'KFGQPC HAFS Uthmanic Script','Traditional Arabic',serif" selected/);

    const stateTypes = readFileSync(resolve(root, 'src/state/types.ts'), 'utf8');
    expect(stateTypes).toContain("fontType: \"'KFGQPC HAFS Uthmanic Script','Traditional Arabic',serif\"");
  });

  it('does not reference the dead Uthmanic Hafs Official alias', () => {
    for (const rel of [
      'src/css/hifz-room.css',
      'src/features/presentation/presentation-share.ts',
      'src/features/presentation/presentation-share-export.ts',
    ]) {
      const content = readFileSync(resolve(root, rel), 'utf8');
      expect(content).not.toContain('Uthmanic Hafs Official');
    }
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
