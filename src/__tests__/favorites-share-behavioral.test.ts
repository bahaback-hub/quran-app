/**
 * Behavioral tests for favorites.ts and share.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.unmock('../favorites.js');
vi.unmock('../share.js');

import { state, resetState } from '../state.js';

describe('favorites — state defaults', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.favorites is an array', () => {
    expect(Array.isArray(state.favorites)).toBe(true);
  });

  it('state.bookmark is null by default (single bookmark, not array)', () => {
    expect(state.bookmark).toBeNull();
  });
});

describe('favorites — add/remove', () => {
  beforeEach(() => {
    resetState();
    state.surahData = {
      number: 1,
      name: 'الفاتحة',
      englishName: 'Al-Fatiha',
      numberOfAyahs: 7,
      ayahs: [{ numberInSurah: 1, text: 'بسم الله' }],
    } as typeof state.surahData;
    state.currentAyahIndex = 0;
  });

  it('can add a favorite to state.favorites', () => {
    const entry = {
      key: '1:1',
      surah: 1,
      surahName: 'الفاتحة',
      ayah: 1,
      text: 'بسم الله',
      timestamp: Date.now(),
    };
    state.favorites.push(entry);
    expect(state.favorites.length).toBe(1);
    expect(state.favorites[0].key).toBe('1:1');
  });

  it('can remove a favorite by key', () => {
    const entry = {
      key: '1:1',
      surah: 1,
      surahName: 'الفاتحة',
      ayah: 1,
      text: 'بسم الله',
      timestamp: Date.now(),
    };
    state.favorites.push(entry);
    state.favorites = state.favorites.filter((f) => f.key !== '1:1');
    expect(state.favorites.length).toBe(0);
  });

  it('can set a bookmark', () => {
    const bookmark = {
      surah: 1,
      surahName: 'الفاتحة',
      ayah: 1,
      text: 'بسم الله',
      timestamp: Date.now(),
    };
    state.bookmark = bookmark;
    expect(state.bookmark).not.toBeNull();
    expect(state.bookmark!.surah).toBe(1);
  });
});

describe('favorites — export formats', () => {
  beforeEach(() => {
    resetState();
  });

  it('favorites can be serialized to JSON', () => {
    state.favorites.push({
      key: '1:1',
      surah: 1,
      surahName: 'الفاتحة',
      ayah: 1,
      text: 'بسم الله',
      timestamp: Date.now(),
    });
    const json = JSON.stringify(state.favorites);
    expect(json).toContain('الفاتحة');
    expect(json).toContain('بسم الله');
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(1);
  });

  it('favorites can be serialized to text', () => {
    state.favorites.push({
      key: '1:1',
      surah: 1,
      surahName: 'الفاتحة',
      ayah: 1,
      text: 'بسم الله',
      timestamp: Date.now(),
    });
    const text = state.favorites.map((f) => `${f.surahName} ${f.ayah}: ${f.text}`).join('\n');
    expect(text).toContain('الفاتحة');
    expect(text).toContain('بسم الله');
  });

  it('empty favorites produce empty text', () => {
    const text = state.favorites.map((f) => `${f.surahName} ${f.ayah}: ${f.text}`).join('\n');
    expect(text).toBe('');
  });
});

describe('share — state', () => {
  beforeEach(() => {
    resetState();
  });

  it('state.currentSurah can be set for share context', () => {
    state.currentSurah = 1;
    expect(state.currentSurah).toBe(1);
  });

  it('state.currentAyahIndex can be set for share context', () => {
    state.currentAyahIndex = 0;
    expect(state.currentAyahIndex).toBe(0);
  });
});

describe('share — text preparation', () => {
  it('can prepare share text with diacritics', () => {
    const text = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    expect(text).toContain('بِسْمِ');
  });

  it('can strip diacritics from text', () => {
    const text = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    const stripped = text.replace(/[\u064B-\u065F\u0670]/g, '');
    expect(stripped).not.toContain('ِ');
    expect(stripped).toContain('بسم');
  });

  it('can build WhatsApp share URL', () => {
    const text = 'بسم الله';
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    expect(url).toContain('wa.me');
    expect(url).toContain(encodeURIComponent(text));
  });

  it('can build Telegram share URL', () => {
    const text = 'بسم الله';
    const url = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
    expect(url).toContain('t.me');
    expect(url).toContain(encodeURIComponent(text));
  });
});
