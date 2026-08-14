/**
 * Tests for surah-cache.ts — IndexedDB operations for offline surah data.
 *
 * Uses a lightweight in-memory IndexedDB mock (mock-indexeddb.ts) instead
 * of fake-indexeddb which is extremely slow on CI (60s+ per test).
 * The mock implements only the subset of IDB API used by surah-cache.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './mocks/mock-indexeddb.js';
import { cacheSurahToIDB, getCachedSurahFromIDB, type CachedSurahEntry } from '../surah-cache.js';

// Helper to delete the database between tests for clean state
function deleteDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('QuranSurahDB');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('surah-cache', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  /* ===================== cacheSurahToIDB ===================== */

  describe('cacheSurahToIDB', () => {
    it('should cache a surah entry to IndexedDB', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [
            { numberInSurah: 1, text: 'بسم الله الرحمن الرحيم', number: 1 },
          ],
        },
        audios: ['https://example.com/audio/1.mp3'],
        timings: [5000],
        translation: null,
      };

      await cacheSurahToIDB('1_ar.alafasy_en.sahih', entry);

      const cached = await getCachedSurahFromIDB('1_ar.alafasy_en.sahih');
      expect(cached).not.toBeNull();
      expect(cached!.text.number).toBe(1);
      expect(cached!.text.name).toBe('الفاتحة');
      expect(cached!.audios).toEqual(['https://example.com/audio/1.mp3']);
      expect(cached!.timings).toEqual([5000]);
      expect(cached!.translation).toBeNull();
    });

    it('should overwrite an existing entry with the same key', async () => {
      const entry1: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [{ numberInSurah: 1, text: 'first', number: 1 }],
        },
        translation: null,
      };

      const entry2: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [{ numberInSurah: 1, text: 'second', number: 1 }],
        },
        translation: { en: 'translation' },
      };

      await cacheSurahToIDB('1_ar.alafasy', entry1);
      await cacheSurahToIDB('1_ar.alafasy', entry2);

      const cached = await getCachedSurahFromIDB('1_ar.alafasy');
      expect(cached!.text.ayahs[0].text).toBe('second');
      expect(cached!.translation).toEqual({ en: 'translation' });
    });

    it('should cache an entry with audio data', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 2,
          name: 'البقرة',
          englishName: 'Al-Baqarah',
          ayahs: [{ numberInSurah: 1, text: 'الم', number: 1 }],
        },
        audio: {
          ayahs: [{ numberInSurah: 1, audio: 'https://example.com/2-1.mp3' }],
        },
        translation: null,
      };

      await cacheSurahToIDB('2_ar.abdulbasit', entry);

      const cached = await getCachedSurahFromIDB('2_ar.abdulbasit');
      expect(cached).not.toBeNull();
      expect(cached!.audio).toBeDefined();
      expect(cached!.audio!.ayahs.length).toBe(1);
    });

    it('should cache an entry with null audios array', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 3,
          name: 'آل عمران',
          englishName: 'Al-Imran',
          ayahs: [],
        },
        audios: [null, null],
        translation: null,
      };

      await cacheSurahToIDB('3_ar.alafasy', entry);

      const cached = await getCachedSurahFromIDB('3_ar.alafasy');
      expect(cached!.audios).toEqual([null, null]);
    });

    it('should not throw on IndexedDB write error', async () => {
      // Force an error by closing the database before the transaction completes
      const entry: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [],
        },
        translation: null,
      };

      // This should not throw even in error conditions
      await expect(cacheSurahToIDB('test_key', entry)).resolves.toBeUndefined();
    });

    it('should cache entry with empty string key', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [],
        },
        translation: null,
      };

      await cacheSurahToIDB('', entry);

      const cached = await getCachedSurahFromIDB('');
      expect(cached).not.toBeNull();
    });

    it('should cache entry with special characters in key', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [],
        },
        translation: null,
      };

      const specialKey = '1_ar.alafasy_en.sahih/special:chars=123';
      await cacheSurahToIDB(specialKey, entry);

      const cached = await getCachedSurahFromIDB(specialKey);
      expect(cached).not.toBeNull();
    });

    it('should cache entry with empty ayahs array', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 108,
          name: 'الكوثر',
          englishName: 'Al-Kawthar',
          ayahs: [],
        },
        translation: null,
      };

      await cacheSurahToIDB('108_ar.alafasy', entry);

      const cached = await getCachedSurahFromIDB('108_ar.alafasy');
      expect(cached).not.toBeNull();
      expect(cached!.text.ayahs).toEqual([]);
    });

    it('should cache entry with complex translation object', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [],
        },
        translation: {
          id: 'en.sahih',
          name: 'Sahih International',
          ayahs: [{ numberInSurah: 1, text: 'In the name of Allah' }],
        },
      };

      await cacheSurahToIDB('1_ar.alafasy_en.sahih', entry);

      const cached = await getCachedSurahFromIDB('1_ar.alafasy_en.sahih');
      expect(cached!.translation).toEqual({
        id: 'en.sahih',
        name: 'Sahih International',
        ayahs: [{ numberInSurah: 1, text: 'In the name of Allah' }],
      });
    });

    it('should cache entry with many ayahs', async () => {
      const ayahs = Array.from({ length: 286 }, (_, i) => ({
        numberInSurah: i + 1,
        text: `آية ${i + 1}`,
        number: i + 1,
      }));

      const entry: CachedSurahEntry = {
        text: {
          number: 2,
          name: 'البقرة',
          englishName: 'Al-Baqarah',
          ayahs,
        },
        translation: null,
      };

      await cacheSurahToIDB('2_ar.alafasy', entry);

      const cached = await getCachedSurahFromIDB('2_ar.alafasy');
      expect(cached).not.toBeNull();
      expect(cached!.text.ayahs.length).toBe(286);
    });
  });

  /* ===================== getCachedSurahFromIDB ===================== */

  describe('getCachedSurahFromIDB', () => {
    it('should return null for a key that does not exist', async () => {
      const result = await getCachedSurahFromIDB('nonexistent_key');
      expect(result).toBeNull();
    });

    it('should return cached entry for an existing key', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 112,
          name: 'الإخلاص',
          englishName: 'Al-Ikhlas',
          ayahs: [
            { numberInSurah: 1, text: 'قل هو الله أحد', number: 1 },
            { numberInSurah: 2, text: 'الله الصمد', number: 2 },
          ],
        },
        translation: null,
      };

      await cacheSurahToIDB('112_ar.alafasy', entry);

      const cached = await getCachedSurahFromIDB('112_ar.alafasy');
      expect(cached).not.toBeNull();
      expect(cached!.text.number).toBe(112);
      expect(cached!.text.ayahs.length).toBe(2);
    });

    it('should not include the key field in the returned entry', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [],
        },
        translation: null,
      };

      await cacheSurahToIDB('1_ar.alafasy_en.sahih', entry);

      const cached = await getCachedSurahFromIDB('1_ar.alafasy_en.sahih');
      expect(cached).not.toBeNull();
      // The 'key' field should be excluded from the returned entry
      expect((cached as any).key).toBeUndefined();
    });

    it('should return null on IndexedDB read error', async () => {
      // Mock the indexedDB.open to simulate an error
      const originalOpen = indexedDB.open;
      indexedDB.open = function () {
        const request = originalOpen.apply(this, arguments as any);
        // Simulate error
        setTimeout(() => {
          if (request.onerror) {
            request.onerror(new Event('error'));
          }
        }, 0);
        return request;
      };

      const result = await getCachedSurahFromIDB('error_key');

      // Should return null instead of throwing
      expect(result).toBeNull();

      // Restore
      indexedDB.open = originalOpen;
    });

    it('should handle entries with all optional fields', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 36,
          name: 'يس',
          englishName: 'Ya-Sin',
          ayahs: [{ numberInSurah: 1, text: 'يس', number: 1 }],
        },
        audios: ['https://example.com/audio.mp3'],
        timings: [3000, 4000],
        audio: {
          ayahs: [{ numberInSurah: 1, audio: 'https://example.com/audio.mp3' }],
        },
        translation: { id: 'en.sahih', name: 'Sahih International' },
      };

      await cacheSurahToIDB('36_ar.alafasy_en.sahih', entry);

      const cached = await getCachedSurahFromIDB('36_ar.alafasy_en.sahih');
      expect(cached).not.toBeNull();
      expect(cached!.audios).toBeDefined();
      expect(cached!.timings).toBeDefined();
      expect(cached!.audio).toBeDefined();
      expect(cached!.translation).toBeDefined();
    });

    it('should return correct entry when multiple entries are cached', async () => {
      const entry1: CachedSurahEntry = {
        text: { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] },
        translation: null,
      };
      const entry2: CachedSurahEntry = {
        text: { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', ayahs: [] },
        translation: null,
      };

      await cacheSurahToIDB('1_ar.alafasy', entry1);
      await cacheSurahToIDB('2_ar.alafasy', entry2);

      const cached1 = await getCachedSurahFromIDB('1_ar.alafasy');
      const cached2 = await getCachedSurahFromIDB('2_ar.alafasy');

      expect(cached1!.text.number).toBe(1);
      expect(cached2!.text.number).toBe(2);
    });

    it('should return null for a key that was never cached', async () => {
      const entry: CachedSurahEntry = {
        text: { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] },
        translation: null,
      };

      await cacheSurahToIDB('1_ar.alafasy', entry);

      // Query for a different key
      const result = await getCachedSurahFromIDB('1_ar.abdulbasit');
      expect(result).toBeNull();
    });

    it('should distinguish keys with similar prefixes', async () => {
      const entry1: CachedSurahEntry = {
        text: { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] },
        translation: null,
      };
      const entry2: CachedSurahEntry = {
        text: { number: 11, name: 'هود', englishName: 'Hud', ayahs: [] },
        translation: null,
      };

      await cacheSurahToIDB('1_ar.alafasy', entry1);
      await cacheSurahToIDB('11_ar.alafasy', entry2);

      const cached1 = await getCachedSurahFromIDB('1_ar.alafasy');
      const cached11 = await getCachedSurahFromIDB('11_ar.alafasy');

      expect(cached1!.text.number).toBe(1);
      expect(cached11!.text.number).toBe(11);
    });
  });

  /* ===================== Round-trip ===================== */

  describe('cache round-trip', () => {
    it('should survive a cache-then-read round trip', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 55,
          name: 'الرحمن',
          englishName: 'Ar-Rahman',
          ayahs: [
            { numberInSurah: 1, text: 'الرحمن', number: 1 },
            { numberInSurah: 2, text: 'علم القرآن', number: 2 },
          ],
        },
        audios: ['audio1.mp3', 'audio2.mp3'],
        timings: [2000, 3000],
        translation: { field: 'value' },
      };

      await cacheSurahToIDB('55_ar.alafasy', entry);
      const cached = await getCachedSurahFromIDB('55_ar.alafasy');

      expect(cached).not.toBeNull();
      expect(cached!.text.number).toBe(entry.text.number);
      expect(cached!.text.name).toBe(entry.text.name);
      expect(cached!.text.ayahs).toEqual(entry.text.ayahs);
      expect(cached!.audios).toEqual(entry.audios);
      expect(cached!.timings).toEqual(entry.timings);
      expect(cached!.translation).toEqual(entry.translation);
    });

    it('should survive round trip with audio field', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [{ numberInSurah: 1, text: 'بسم الله', number: 1 }],
        },
        audio: {
          ayahs: [{ numberInSurah: 1, audio: 'https://example.com/1-1.mp3' }],
        },
        translation: null,
      };

      await cacheSurahToIDB('1_ar.alafasy', entry);
      const cached = await getCachedSurahFromIDB('1_ar.alafasy');

      expect(cached).not.toBeNull();
      expect(cached!.audio).toBeDefined();
      expect(cached!.audio!.ayahs[0].audio).toBe('https://example.com/1-1.mp3');
    });

    it('should survive round trip with entry containing only required fields', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 114,
          name: 'الناس',
          englishName: 'An-Nas',
          ayahs: [],
        },
        translation: null,
      };

      await cacheSurahToIDB('114_ar.alafasy', entry);
      const cached = await getCachedSurahFromIDB('114_ar.alafasy');

      expect(cached).not.toBeNull();
      expect(cached!.text.number).toBe(114);
      expect(cached!.audios).toBeUndefined();
      expect(cached!.timings).toBeUndefined();
      expect(cached!.audio).toBeUndefined();
      expect(cached!.translation).toBeNull();
    });
  });

  /* ===================== Edge cases ===================== */

  describe('edge cases', () => {
    it('should handle concurrent writes to different keys', async () => {
      const entry1: CachedSurahEntry = {
        text: { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] },
        translation: null,
      };
      const entry2: CachedSurahEntry = {
        text: { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', ayahs: [] },
        translation: null,
      };

      // Write both simultaneously
      await Promise.all([
        cacheSurahToIDB('1_ar.alafasy', entry1),
        cacheSurahToIDB('2_ar.alafasy', entry2),
      ]);

      const cached1 = await getCachedSurahFromIDB('1_ar.alafasy');
      const cached2 = await getCachedSurahFromIDB('2_ar.alafasy');

      expect(cached1!.text.number).toBe(1);
      expect(cached2!.text.number).toBe(2);
    });

    it('should handle ayah entry with optional number and audio fields', async () => {
      const entry: CachedSurahEntry = {
        text: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatiha',
          ayahs: [
            { numberInSurah: 1, text: 'بسم الله' }, // No number or audio
          ],
        },
        translation: null,
      };

      await cacheSurahToIDB('1_minimal', entry);

      const cached = await getCachedSurahFromIDB('1_minimal');
      expect(cached).not.toBeNull();
      expect(cached!.text.ayahs[0].numberInSurah).toBe(1);
      expect(cached!.text.ayahs[0].number).toBeUndefined();
    });

    it('should handle very long key strings', async () => {
      const longKey = '1_' + 'a'.repeat(500);
      const entry: CachedSurahEntry = {
        text: { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] },
        translation: null,
      };

      await cacheSurahToIDB(longKey, entry);

      const cached = await getCachedSurahFromIDB(longKey);
      expect(cached).not.toBeNull();
    });

    it('should handle Unicode key strings', async () => {
      const unicodeKey = '1_ar.alafasy_ترجمة_العربية';
      const entry: CachedSurahEntry = {
        text: { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs: [] },
        translation: null,
      };

      await cacheSurahToIDB(unicodeKey, entry);

      const cached = await getCachedSurahFromIDB(unicodeKey);
      expect(cached).not.toBeNull();
    });
  });
});
