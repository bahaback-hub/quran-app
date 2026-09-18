/**
 * Deep-link parser unit tests.
 *
 * The parser must accept the exact formats emitted by the SEO pages and the
 * app's share links (#surah=N, #surah=N/A, #page=P) and reject everything else
 * (manifest shortcuts like #prayer, junk, out-of-range numbers).
 */

import { describe, expect, it } from 'vitest';
import { parseDeepLink, MAX_SURAH, MAX_PAGE } from '../deep-link.js';

describe('parseDeepLink', () => {
  it('accepts a plain surah hash', () => {
    expect(parseDeepLink('#surah=2')).toEqual({ kind: 'surah', number: 2, startAyah: undefined });
  });

  it('accepts a surah + ayah hash', () => {
    expect(parseDeepLink('#surah=2/255')).toEqual({ kind: 'surah', number: 2, startAyah: 255 });
    expect(parseDeepLink('#surah=18/10')).toEqual({ kind: 'surah', number: 18, startAyah: 10 });
  });

  it('accepts a mushaf page hash', () => {
    expect(parseDeepLink('#page=42')).toEqual({ kind: 'page', page: 42 });
    expect(parseDeepLink(`#page=${MAX_PAGE}`)).toEqual({ kind: 'page', page: 604 });
  });

  it('accepts boundary surah numbers', () => {
    expect(parseDeepLink('#surah=1')).toEqual({ kind: 'surah', number: 1, startAyah: undefined });
    expect(parseDeepLink(`#surah=${MAX_SURAH}`)).toEqual({ kind: 'surah', number: 114, startAyah: undefined });
  });

  it('rejects out-of-range surah/page numbers', () => {
    expect(parseDeepLink('#surah=0')).toBeNull();
    expect(parseDeepLink('#surah=115')).toBeNull();
    expect(parseDeepLink('#page=0')).toBeNull();
    expect(parseDeepLink('#page=605')).toBeNull();
  });

  it('rejects non-numeric or zero ayah references', () => {
    expect(parseDeepLink('#surah=2/abc')).toBeNull();
    expect(parseDeepLink('#surah=2/0')).toEqual({ kind: 'surah', number: 2, startAyah: undefined });
  });

  it('rejects unrelated hashes (manifest shortcuts, diag, empty)', () => {
    expect(parseDeepLink('')).toBeNull();
    expect(parseDeepLink('#')).toBeNull();
    expect(parseDeepLink('#prayer')).toBeNull();
    expect(parseDeepLink('#audio')).toBeNull();
    expect(parseDeepLink('#diag=response')).toBeNull();
    expect(parseDeepLink('surah=2')).toBeNull();
  });

  it('is strict about the prefix (no surah=2 anywhere in the hash)', () => {
    expect(parseDeepLink('#foo/2/surah=2')).toBeNull();
  });
});
