/**
 * Guard: every host that Quran audio can arrive from must be in the CSP —
 * in every copy of it.
 *
 * mp3quran.net answers audio requests with a 301 redirect from the per-reciter
 * server (server6..13) to cdn.mp3quran.net. A redirect target outside media-src
 * is blocked by the browser, and the same files fetched for the offline pack or
 * timings need connect-src too — so the player shows an audio error while every
 * URL involved looks correct in isolation.
 *
 * The policy lives in three places — the meta tag in index.html, the
 * Content-Security-Policy header in public/_headers, and the template in
 * scripts/generate-csp-hashes.mjs — and a browser enforces each applied copy
 * independently. Allowing a host in one copy but not the others mutes reciters
 * on any hosting that applies the stricter copy, so this test pins all three
 * together: a future edit that drops a host anywhere fails loudly instead of
 * muting reciters.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RECITERS } from '../reciters.js';

vi.mock('../i18n.js', () => ({
  getReciterName: (id: string) => id,
}));

const root = resolve(import.meta.dirname, '../..');

function directiveHosts(csp: string, name: string): string[] {
  const m = csp.match(new RegExp(`${name}([^;]*)`));
  return (m?.[1] ?? '')
    .split(/\s+/)
    .filter((t) => t.startsWith('https://'))
    .map((u) => new URL(u).host);
}

describe('audio CSP allowlist', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  // The meta tag spans several lines, so match across whitespace rather than
  // assuming one tag per line.
  const csp = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/)?.[1] ?? '';
  const headers = readFileSync(resolve(root, 'public/_headers'), 'utf8');
  const generator = readFileSync(resolve(root, 'scripts/generate-csp-hashes.mjs'), 'utf8');
  const copies: Array<[string, string]> = [
    ['index.html meta tag', csp],
    ['public/_headers', headers],
    ['generate-csp-hashes.mjs template', generator],
  ];

  it('declares a CSP on the app shell', () => {
    expect(csp.length).toBeGreaterThan(0);
  });

  it('allows the mp3quran CDN redirect target for playback and fetching, in every copy', () => {
    // Verified live: every mp3quran.net reciter server 301-redirects audio to
    // cdn.mp3quran.net. Without this host the redirect is blocked and every
    // mp3quran reciter fails with an audio error.
    for (const [name, text] of copies) {
      expect(directiveHosts(text, 'media-src'), `${name} media-src`).toContain('cdn.mp3quran.net');
      expect(directiveHosts(text, 'connect-src'), `${name} connect-src`).toContain('cdn.mp3quran.net');
    }
  });

  it('keeps the same media/connect hosts in every copy', () => {
    // The three copies must agree host-for-host: a browser enforces each applied
    // copy on its own, so a host present in one and missing in another is still
    // blocked wherever the stricter copy applies.
    for (const directive of ['media-src', 'connect-src']) {
      const sets = copies.map(([, text]) => [...new Set(directiveHosts(text, directive))].sort().join(','));
      const labeled = copies.map(([name], i) => `${name}: ${sets[i]}`);
      expect(new Set(sets).size, `${directive} differs between copies:\n${labeled.join('\n')}`).toBe(1);
    }
  });

  it('allows every configured mp3quran reciter server', () => {
    const media = directiveHosts(csp, 'media-src');
    const connect = directiveHosts(csp, 'connect-src');
    const mp3 = RECITERS.filter((r) => r.source === 'mp3quran' && r.server);
    expect(mp3.length).toBeGreaterThan(0);
    for (const r of mp3) {
      const host = new URL(r.server!).host;
      expect(media, `${r.id} playback`).toContain(host);
      expect(connect, `${r.id} fetching`).toContain(host);
    }
  });
});
