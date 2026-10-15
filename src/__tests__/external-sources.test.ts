import { describe, expect, it } from 'vitest';
import {
  MUSHAF_QCF4_COMMIT,
  QURAN_COM_API_BASE,
  SHARE_TELEGRAM_BASE,
  SHARE_WHATSAPP_BASE,
  mushafPageLayoutUrls,
} from '../external-sources.js';

describe('external-sources', () => {
  it('exposes the quran.com API base without a trailing path', () => {
    expect(QURAN_COM_API_BASE).toBe('https://api.quran.com/api/v4');
  });

  it('lists mushaf page mirrors in preference order with raw last', () => {
    const urls = mushafPageLayoutUrls(1);
    expect(urls).toHaveLength(4);
    expect(urls[0]).toContain('cdn.jsdelivr.net');
    expect(urls[urls.length - 1]).toContain('raw.githubusercontent.com');
  });

  it('zero-pads page numbers in every mirror URL', () => {
    for (const url of mushafPageLayoutUrls(7)) {
      expect(url).toContain('007.json');
    }
  });

  it('pins every mirror to the immutable commit, never a moving branch (SEC-06)', () => {
    const urls = mushafPageLayoutUrls(1);
    expect(MUSHAF_QCF4_COMMIT).toBe('5130511027e769f0a8f4eeb7f00f46bde3788d60');
    for (const url of urls) {
      expect(url).toContain(MUSHAF_QCF4_COMMIT);
      expect(url).not.toMatch(/@main\/|quran-qcf4\/main\//);
    }
  });

  it('exposes share endpoint bases', () => {
    expect(SHARE_WHATSAPP_BASE).toBe('https://wa.me');
    expect(SHARE_TELEGRAM_BASE).toBe('https://t.me/share/url');
  });
});
