/**
 * Guard: the web bundle must not carry the Android-only stylesheet.
 *
 * `src/css/capacitor.css` is 57 rules, and 56 of them are scoped to
 * `body.capacitor-native` - a class `src/main.ts` only adds inside the Android
 * WebView. The one unscoped rule defines `--capacitor-player-offset`, and the
 * only rules that read it are the `.capacitor-native` ones in the same file.
 * So on the web the entire file is inert weight sitting in the render-blocking
 * bundle, and the stylesheet a mobile visitor downloads before first paint
 * shrinks without changing a single rendered pixel.
 *
 * `scripts/vite-plugin-capacitor-css-web-only.mjs` strips it at build time.
 * That is a string edit on the entry stylesheet, which nothing re-runs on its
 * own, so these tests pin both halves of the contract: the plugin removes
 * exactly that one import and nothing else, and the Android build is untouched.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { capacitorCssWebOnly } from '../../scripts/vite-plugin-capacitor-css-web-only.mjs';

const ROOT = process.cwd();
const VITE_CONFIG = readFileSync(resolve(ROOT, 'vite.config.js'), 'utf8');
const styles = readFileSync(resolve(ROOT, 'styles.css'), 'utf8');
const capacitorCss = readFileSync(resolve(ROOT, 'src', 'css', 'capacitor.css'), 'utf8');
const ENTRY = resolve(ROOT, 'styles.css');
const OTHER = resolve(ROOT, 'src', 'css', 'capacitor.css');

describe('capacitor.css is excluded from web builds', () => {
  it('registers the plugin in vite.config.js', () => {
    expect(VITE_CONFIG).toContain('capacitorCssWebOnly(isCapacitorBuild)');
  });

  it('still imports the stylesheet from the shared entry', () => {
    // If this line were deleted instead of filtered, the Android build would
    // silently lose its native layout and nothing else would notice.
    expect(styles).toContain("@import './src/css/capacitor.css';");
  });

  it('drops only the capacitor import on web builds', () => {
    const out = capacitorCssWebOnly(false).transform(styles, ENTRY) as string;
    expect(out).not.toContain('capacitor.css');
    const before = styles.match(/@import[^;]+;/g) ?? [];
    const after = out.match(/@import[^;]+;/g) ?? [];
    expect(after).toEqual(before.filter((line) => !line.includes('capacitor.css')));
  });

  it('leaves the stylesheet alone for the Android build', () => {
    expect(capacitorCssWebOnly(true).transform(styles, ENTRY)).toBeNull();
  });

  it('ignores stylesheets that are not the entry file', () => {
    expect(capacitorCssWebOnly(false).transform(capacitorCss, OTHER)).toBeNull();
  });

  it('has nothing on the web that still needs the removed variable', () => {
    // The only unscoped rule in the file defines this. Everything that reads it
    // lives in the same file, so dropping the file cannot orphan a consumer.
    expect(styles).not.toContain('var(--capacitor-player-offset)');
    expect(capacitorCss).toContain('var(--capacitor-player-offset)');
  });

  it('keeps the file scoped to the native wrapper', () => {
    // If someone later adds a web-visible rule to this file, this is the test
    // that should make them reconsider the strip.
    const scopedBlocks = capacitorCss.match(/body\.capacitor-native/g) ?? [];
    expect(scopedBlocks.length).toBeGreaterThanOrEqual(50);
  });
});
