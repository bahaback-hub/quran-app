/**
 * Guard: every host that Quran audio can arrive from must be in the CSP.
 *
 * mp3quran.net answers audio requests with a 301 redirect from the per-reciter
 * server (server6..13) to cdn.mp3quran.net. A redirect target outside media-src
 * is blocked by the browser, and the same files fetched for the offline pack or
 * timings need connect-src too — so the player shows an audio error while every
 * URL involved looks correct in isolation. This test pins both directives, so a
 * future edit that drops the CDN host fails loudly instead of muting reciters.
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

  it('declares a CSP on the app shell', () => {
    expect(csp.length).toBeGreaterThan(0);
  });

  it('allows the mp3quran CDN redirect target for playback and fetching', () => {
    // Verified live: every mp3quran.net reciter server 301-redirects audio to
    // cdn.mp3quran.net. Without this host the redirect is blocked and every
    // mp3quran reciter fails with an audio error.
    expect(directiveHosts(csp, 'media-src')).toContain('cdn.mp3quran.net');
    expect(directiveHosts(csp, 'connect-src')).toContain('cdn.mp3quran.net');
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
