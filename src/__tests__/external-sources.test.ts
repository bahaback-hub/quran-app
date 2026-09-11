import { describe, expect, it } from 'vitest';
import {
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

  it('exposes share endpoint bases', () => {
    expect(SHARE_WHATSAPP_BASE).toBe('https://wa.me');
    expect(SHARE_TELEGRAM_BASE).toBe('https://t.me/share/url');
  });
});
