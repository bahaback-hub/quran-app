import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

/**
 * N-01 regression guard — the static pages lost their frame-busting protection
 * when src/framebust.ts replaced public/framebust.js but the static pages kept
 * referencing the deleted file (silent 404 => no protection at all, on a host
 * that also ignores public/_headers). These assertions keep every statically
 * deployed page wired to a guard that actually ships.
 */
describe('static-page framebust wiring (N-01)', () => {
  const guardPath = resolve(root, 'public/framebust.js');
  const guard = readFileSync(guardPath, 'utf8');

  it('ships a classic guard that busts frames before first paint', () => {
    // Classic on purpose: a deferred module would let the frame paint first.
    expect(guard).not.toContain('import');
    expect(guard).not.toContain('export');
    expect(guard).toContain('window.top');
    expect(guard).toContain('window.self');
    // Cross-origin embedders cannot be navigated: the guard must blank the
    // document instead so clickjacking has no visible UI to target.
    expect(guard).toContain("document.documentElement.style.display = 'none'");
  });

  it('references the guard from every statically deployed page', () => {
    const pages = ['offline.html', 'privacy-policy.html', '404.html'];
    for (const page of pages) {
      const html = readFileSync(resolve(root, 'public', page), 'utf8');
      expect(html, page).toContain('<script src="framebust.js"></script>');
    }
  });

  it('lets each static page run the guard under its own CSP', () => {
    // 404.html used to ship `default-src 'none'` with no script-src, which
    // would silently block the guard it now references.
    const csp404 = readFileSync(resolve(root, 'public/404.html'), 'utf8');
    expect(csp404).toMatch(/script-src 'self'/);
    for (const page of ['offline.html', 'privacy-policy.html']) {
      const html = readFileSync(resolve(root, 'public', page), 'utf8');
      expect(html, page).toMatch(/script-src 'self'/);
    }
  });

  it('keeps the app shell on the same classic guard, not a deferred module', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html).toContain('<script src="%BASE_URL%framebust.js"></script>');
    expect(html).not.toContain('framebust.ts');
  });
});
