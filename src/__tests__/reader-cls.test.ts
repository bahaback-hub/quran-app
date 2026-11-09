/**
 * Guard: the footer must never be visible while a surah is still loading.
 *
 * The reader holds `.surah-content` at 55vh while the verses stream in, which
 * left the footer at roughly y=544 - inside the viewport on a 412x915 phone.
 * When the text arrived it was pushed thousands of pixels down, and a visible
 * element moving that far is a real layout shift. Measured on a throttled
 * mid-range Android: CLS 0.084, almost all of it that one element, against
 * 0.002 on an unthrottled desktop run where the footer never made it on screen.
 *
 * So the real-user number was an order of magnitude worse than the lab number,
 * and the lab number alone would never have shown it. `.surah-content.is-loading`
 * fills the viewport so the footer starts below the fold and nothing on screen
 * moves.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const surahCss = readFileSync(resolve(ROOT, 'src', 'css', 'surah.css'), 'utf8');
const stylesCss = readFileSync(resolve(ROOT, 'styles.css'), 'utf8');
const readerControlsCss = readFileSync(resolve(ROOT, 'src', 'css', 'reader-controls.css'), 'utf8');
const mushafCss = readFileSync(resolve(ROOT, 'src', 'features', 'mushaf', 'mushaf.css'), 'utf8');
const homeCss = readFileSync(resolve(ROOT, 'src', 'css', 'home.css'), 'utf8');
const layoutCss = readFileSync(resolve(ROOT, 'src', 'css', 'layout.css'), 'utf8');
const readerRailCss = readFileSync(resolve(ROOT, 'src', 'css', 'reader-rail.css'), 'utf8');
const indexHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const hifzRoom = readFileSync(resolve(ROOT, 'src', 'hifz-room.ts'), 'utf8');
const loader = readFileSync(resolve(ROOT, 'src', 'surah-loader.ts'), 'utf8');

function ruleBody(selector: string): string {
  const start = surahCss.indexOf(selector);
  expect(start, `${selector} must exist in src/css/surah.css`).toBeGreaterThan(-1);
  const open = surahCss.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < surahCss.length; i++) {
    if (surahCss[i] === '{') depth++;
    else if (surahCss[i] === '}') {
      depth--;
      if (depth === 0) return surahCss.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated rule for ${selector}`);
}

describe('no layout shift from the loading reader', () => {
  it('loads visible reader controls in the critical stylesheet', () => {
    expect(stylesCss).toContain("@import './src/css/reader-controls.css';");
    expect(readerControlsCss).toContain('.view-mode-btn');
    expect(readerControlsCss).toContain('.surah-reciter-group');
    expect(mushafCss).not.toContain('.view-mode-btn {');
    expect(mushafCss).not.toContain('.surah-reciter-group {');
  });

  it('reserves the side-rail slot before the Hifz Room initializes', () => {
    expect(indexHtml).toContain('id="hifzRoomToggleSlot"');
    expect(hifzRoom).toContain('toggleSlot.replaceWith(toggle)');
  });

  it('reserves first-paint geometry in the entry stylesheet', () => {
    // The geometry used to ship as a second render-blocking stylesheet
    // (public/critical-geometry.css). It is now part of the single entry sheet:
    // every rule below is duplicated in the bundled CSS, so the extra request
    // only delayed first paint.
    expect(indexHtml).not.toContain('critical-geometry.css');
    expect(indexHtml).not.toMatch(/<style[\s>]/i);
    expect(layoutCss).toMatch(/\.reader-command-bar \{[\s\S]*?flex: 1 1 390px/);
    expect(readerControlsCss).toMatch(/\.reader-command-bar \{[\s\S]*?min-height:\s*126px/);
    expect(readerControlsCss).toMatch(/\.reader-context-card \{[\s\S]*?min-height:\s*54px/);
    expect(layoutCss).toMatch(/\.reader-context-card \{[\s\S]*?min-height:\s*54px/);
    expect(layoutCss).toMatch(/\.reader-side-tool-slot \{[\s\S]*?min-height:\s*72px/);
    expect(layoutCss).toMatch(/\.reader-side-tool-slot \{[\s\S]*?flex: 0 0 74px/);
    expect(readerRailCss).toMatch(/#readerSideTools \{[\s\S]*?contain:\s*layout/);
  });

  it('reserves dimensions for every reading-mode preview image', () => {
    expect(indexHtml).toMatch(/reading-mode-surah-logo\.webp[\s\S]*?width="160"[\s\S]*?height="107"/);
    expect(indexHtml).toMatch(/reading-mode-mushaf-logo\.webp[\s\S]*?width="160"[\s\S]*?height="107"/);
    expect(indexHtml).toMatch(/reading-mode-featured-ayah-logo\.webp[\s\S]*?width="160"[\s\S]*?height="60"/);
  });

  it('reserves the first-paint home launcher geometry for the LCP text', () => {
    expect(homeCss).toMatch(/\.home-screen \{[\s\S]*?box-sizing:\s*border-box[\s\S]*?text-align:\s*center/);
    expect(homeCss).toMatch(/\.home-bismillah \{[\s\S]*?min-height:\s*61px/);
    expect(homeCss).toMatch(/\.home-bismillah \{[\s\S]*?font-family:\s*var\(--font-quran, 'Amiri'/);
    expect(homeCss).toMatch(/@media \(max-width: 639px\)[\s\S]*?\.home-bismillah[\s\S]*?min-height:\s*52px/);
  });

  it('fills the viewport while loading so the footer starts below the fold', () => {
    const body = ruleBody('.surah-content.is-loading');
    expect(body).toMatch(/min-height:\s*100dvh/);
    // 100vh first, so an engine without dynamic viewport units still has a
    // full-viewport fallback rather than falling back to the 55vh base rule.
    expect(body.indexOf('min-height: 100vh')).toBeLessThan(body.indexOf('min-height: 100dvh'));
  });

  it('keeps the loaded state tall enough to keep the footer below the fold', () => {
    // The reservation must survive rendering: removing it after the first
    // surah arrives would pull a visible footer into the viewport.
    const body = ruleBody('.surah-content.is-loading');
    expect(body).toContain('cursor: progress');
    expect(ruleBody('.surah-content')).toContain('min-height: max(100vh, clamp(380px, 55vh, 680px))');
    expect(ruleBody('.surah-content')).toContain('min-height: max(100dvh, clamp(380px, 55vh, 680px))');
  });

  it('keeps the loading class on for the whole render', () => {
    // The reservation is worthless if the class is dropped before the verses
    // are in the DOM, so both the add and the remove must exist.
    expect(loader).toMatch(/surahContent\.classList\.add\('is-loading'\)/);
    expect(loader).toMatch(/surahContent\?\.classList\.remove\('is-loading'\)/);
    // renderSurah must run before the class comes off.
    const render = loader.indexOf('renderSurah(cached.text)');
    const remove = loader.indexOf("classList.remove('is-loading')");
    expect(render).toBeGreaterThan(-1);
    expect(remove).toBeGreaterThan(render);
  });
});
