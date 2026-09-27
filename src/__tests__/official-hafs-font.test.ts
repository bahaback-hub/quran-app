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

  it('uses font-display swap so slow WebViews (Android TV) still apply it', () => {
    const fontCss = readFileSync(fontCssPath, 'utf8');
    const kfgBlock = fontCss.slice(fontCss.indexOf("'KFGQPC HAFS Uthmanic Script'"));
    expect(kfgBlock).toContain('font-display: swap');
    expect(kfgBlock).not.toContain('font-display: optional');
  });

  it('loads fonts.css through a base-relative URL so Capacitor can resolve it', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html).toContain('href="%BASE_URL%fonts/fonts.css"');
    expect(html).not.toContain('href="/fonts/fonts.css"');
    // Any reference to the font that does appear in the shell must be
    // base-relative, because the Capacitor WebView serves from its own root.
    for (const ref of html.match(/href="[^"]*UthmanicHafs[^"]*"/g) ?? []) {
      expect(ref).toContain('%BASE_URL%');
    }
  });

  it('keeps the Quran-script font off the critical path', () => {
    // 'KFGQPC HAFS Uthmanic Script' is a 291KB TTF, and the only CSS that asks
    // for it is src/css/hifz-room.css — a panel that sits off-screen at
    // translateX(-110%) and is closed on arrival. Preloading it from index.html
    // put 144KB on the critical path of every visit for glyphs nobody could
    // see, which is nearly four times what the whole stylesheet costs on the
    // wire. The @font-face stays, so the browser fetches it when the room is
    // actually built, and font-display: swap covers the gap.
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html).not.toMatch(/<link[^>]+UthmanicHafs[^>]*>/);
    // The body font is used on the first screen, so it stays preloaded.
    expect(html).toContain('href="%BASE_URL%fonts/amiri-regular-400.woff2"');
  });

  it('is the only family that needs the TTF, and it is the room', () => {
    // If a second stylesheet starts asking for this family, the preload
    // decision above no longer holds and this is the test that should say so.
    const hifzRoom = readFileSync(resolve(root, 'src/css/hifz-room.css'), 'utf8');
    expect(hifzRoom).toContain('KFGQPC HAFS Uthmanic Script');
    for (const rel of [
      'src/css/layout.css',
      'src/css/surah.css',
      'src/css/variables.css',
      'src/css/panels.css',
      'src/css/modals.css',
    ]) {
      expect(readFileSync(resolve(root, rel), 'utf8')).not.toContain('KFGQPC HAFS Uthmanic Script');
    }
  });

  it('does not reference the dead Uthmanic Hafs Official alias', () => {
    for (const rel of ['src/css/hifz-room.css', 'src/features/presentation/presentation-share.ts']) {
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
