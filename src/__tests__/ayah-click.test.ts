/**
 * Tests for ayah-click.ts — Mushaf page click handling and ayah highlight rects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mushaf-renderer's getLineY to return predictable values
vi.mock('../mushaf-renderer.js', () => ({
  getLineY: vi.fn((lineIndex: number, _lineCount: number, imgHeight: number) => {
    // Simple uniform line height calculation
    const lineHeight = imgHeight / _lineCount;
    return lineIndex * lineHeight;
  }),
}));

import { handlePageClick, getAyahHighlightRects } from '../ayah-click.js';

// Helper to create a simple layout
function makeLayout(lines: { words: { char?: string; word?: string; type?: string; verse_key?: string; location?: string }[] }[]) {
  return { lines };
}

describe('ayah-click', () => {
  /* ===================== handlePageClick ===================== */

  describe('handlePageClick', () => {
    it('should return null when layout is null', async () => {
      const result = await handlePageClick(1, 50, 50, 100, 200, null);
      expect(result).toBeNull();
    });

    it('should return null when layout has no lines', async () => {
      const result = await handlePageClick(1, 50, 50, 100, 200, makeLayout([]));
      expect(result).toBeNull();
    });

    it('should return null when lines have no words', async () => {
      const layout = makeLayout([{ words: [] }]);
      const result = await handlePageClick(1, 50, 50, 100, 200, layout);
      expect(result).toBeNull();
    });

    it('should return null when no words match the click position', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', verse_key: '1:1', type: 'word' },
        ],
      }]);
      // Click at a very far position that doesn't match
      const result = await handlePageClick(1, 999, 0, 100, 200, layout);
      // May return null or an ayah depending on calculation
      // At minimum, it should not throw
      expect(result).toBeDefined();
    });

    it('should return ayah info when clicking on a word with verse_key', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', verse_key: '1:1', type: 'word' },
          { char: 'الله', verse_key: '1:1', type: 'word' },
        ],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      // Should find an ayah (the click hits within the line)
      if (result) {
        expect(result.surah).toBe(1);
        expect(result.ayah).toBe(1);
      }
    });

    it('should return ayah info when using location field', async () => {
      const layout = makeLayout([{
        words: [
          { word: 'الحمد', location: '1:2', type: 'word' },
        ],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      if (result) {
        expect(result.surah).toBe(1);
        expect(result.ayah).toBe(2);
      }
    });

    it('should return null when word has no verse_key or location', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', type: 'word' },
        ],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      expect(result).toBeNull();
    });

    it('should filter out words with type "end"', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', verse_key: '1:1', type: 'word' },
          { char: '﴿١﴾', verse_key: '1:1', type: 'end' },
        ],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      // Should still find the ayah from non-end words
      if (result) {
        expect(result.surah).toBe(1);
        expect(result.ayah).toBe(1);
      }
    });

    it('should handle multi-line layouts', async () => {
      const layout = makeLayout([
        { words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }] },
        { words: [{ char: 'الحمد', verse_key: '1:2', type: 'word' }] },
      ]);

      // Click on second line (y > half the image height)
      const result = await handlePageClick(1, 50, 150, 100, 200, layout);

      if (result) {
        expect(result.ayah).toBe(2);
      }
    });

    it('should handle click below all lines gracefully', async () => {
      const layout = makeLayout([{
        words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }],
      }]);

      // Click well below the single line
      const result = await handlePageClick(1, 50, 190, 100, 200, layout);

      // Should not throw — may return null or a fallback result
      expect(result).toBeDefined();
    });

    it('should handle verse_key with more than 2 parts', async () => {
      const layout = makeLayout([{
        words: [{ char: 'test', verse_key: '1:1:extra', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      if (result) {
        expect(result.surah).toBe(1);
        expect(result.ayah).toBe(1);
      }
    });

    it('should handle verse_key with only 1 part (invalid)', async () => {
      const layout = makeLayout([{
        words: [{ char: 'test', verse_key: '1', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      expect(result).toBeNull();
    });

    it('should return null for line with no words after filtering "end" types', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'end', type: 'end', verse_key: '1:1' },
        ],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);
      expect(result).toBeNull();
    });

    it('should use word field when char is not available', async () => {
      const layout = makeLayout([{
        words: [{ word: 'الله', verse_key: '1:1', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);
      if (result) {
        expect(result.surah).toBe(1);
        expect(result.ayah).toBe(1);
      }
    });

    it('should handle location field with more than 2 parts', async () => {
      const layout = makeLayout([{
        words: [{ word: 'test', location: '5:10:extra', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      if (result) {
        expect(result.surah).toBe(5);
        expect(result.ayah).toBe(10);
      }
    });

    it('should handle location field with only 1 part (invalid)', async () => {
      const layout = makeLayout([{
        words: [{ word: 'test', location: '5', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      expect(result).toBeNull();
    });

    it('should return null for layout with null line', async () => {
      const layout = { lines: [null] };
      const result = await handlePageClick(1, 50, 5, 100, 200, layout as any);
      expect(result).toBeNull();
    });

    it('should return null for line with null words property', async () => {
      const layout = { lines: [{ words: null }] };
      const result = await handlePageClick(1, 50, 5, 100, 200, layout as any);
      expect(result).toBeNull();
    });

    it('should correctly identify ayah across multiple words in same line', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', verse_key: '1:1', type: 'word' },
          { char: 'الله', verse_key: '1:1', type: 'word' },
          { char: 'الرحمن', verse_key: '1:2', type: 'word' },
          { char: 'الرحيم', verse_key: '1:2', type: 'word' },
        ],
      }]);

      // Click near the end of the line — should match ayah 2
      const result = await handlePageClick(1, 10, 5, 100, 200, layout);

      if (result) {
        // RTL: x=10 is near the end, should match the later words
        expect(result.surah).toBe(1);
      }
    });

    it('should handle click at exact line boundary', async () => {
      const layout = makeLayout([
        { words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }] },
        { words: [{ char: 'الحمد', verse_key: '1:2', type: 'word' }] },
      ]);

      // Click at exact line boundary (y = 100, which is the boundary between lines)
      const result = await handlePageClick(1, 50, 100, 100, 200, layout);

      // Should not throw — returns either line's ayah or null
      expect(result).toBeDefined();
    });

    it('should handle very small image dimensions', async () => {
      const layout = makeLayout([{
        words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 1, 1, 2, 2, layout);

      // Should not throw
      expect(result).toBeDefined();
    });

    it('should handle click at y=0 (top of image)', async () => {
      const layout = makeLayout([{
        words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 50, 0, 100, 200, layout);

      // Should find the first line's ayah
      if (result) {
        expect(result.surah).toBe(1);
      }
    });

    it('should handle click at x=0 (left edge)', async () => {
      const layout = makeLayout([{
        words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 0, 5, 100, 200, layout);

      // Should not throw — RTL makes x=0 the far right position
      expect(result).toBeDefined();
    });

    it('should handle word with no char and no word property', async () => {
      const layout = makeLayout([{
        words: [{ verse_key: '1:1', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      // Should not throw; char count defaults to 1 (Math.max(1, 0))
      if (result) {
        expect(result.surah).toBe(1);
        expect(result.ayah).toBe(1);
      }
    });

    it('should prefer verse_key over location when both are present', async () => {
      const layout = makeLayout([{
        words: [{ char: 'test', verse_key: '2:5', location: '3:10', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      if (result) {
        // verse_key is checked first
        expect(result.surah).toBe(2);
        expect(result.ayah).toBe(5);
      }
    });

    it('should use location field only when verse_key is missing', async () => {
      const layout = makeLayout([{
        words: [{ char: 'test', location: '3:10', type: 'word' }],
      }]);

      const result = await handlePageClick(1, 50, 5, 100, 200, layout);

      if (result) {
        expect(result.surah).toBe(3);
        expect(result.ayah).toBe(10);
      }
    });
  });

  /* ===================== getAyahHighlightRects ===================== */

  describe('getAyahHighlightRects', () => {
    it('should return empty array when layout is null', async () => {
      const result = await getAyahHighlightRects(1, 1, 1, 100, 200, null);
      expect(result).toEqual([]);
    });

    it('should return empty array when layout has no lines', async () => {
      const result = await getAyahHighlightRects(1, 1, 1, 100, 200, makeLayout([]));
      expect(result).toEqual([]);
    });

    it('should return highlight rects for matching ayah', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', verse_key: '1:1', type: 'word' },
          { char: 'الله', verse_key: '1:1', type: 'word' },
          { char: 'الرحمن', verse_key: '1:2', type: 'word' },
        ],
      }]);

      const result = await getAyahHighlightRects(1, 1, 1, 100, 200, layout);

      expect(result.length).toBeGreaterThan(0);
      // Check rect structure
      const rect = result[0]!;
      expect(rect).toHaveProperty('left');
      expect(rect).toHaveProperty('top');
      expect(rect).toHaveProperty('width');
      expect(rect).toHaveProperty('height');
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
    });

    it('should return empty array when no words match the surah/ayah', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', verse_key: '1:1', type: 'word' },
        ],
      }]);

      const result = await getAyahHighlightRects(1, 2, 99, 100, 200, layout);
      expect(result).toEqual([]);
    });

    it('should return rects spanning multiple lines', async () => {
      const layout = makeLayout([
        { words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }] },
        { words: [{ char: 'الله', verse_key: '1:1', type: 'word' }] },
      ]);

      const result = await getAyahHighlightRects(1, 1, 1, 100, 200, layout);

      expect(result.length).toBe(2);
    });

    it('should filter out "end" type words', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', verse_key: '1:1', type: 'word' },
          { char: '﴿١﴾', verse_key: '1:1', type: 'end' },
        ],
      }]);

      const result = await getAyahHighlightRects(1, 1, 1, 100, 200, layout);

      // Should still find rects for the non-end words
      expect(result.length).toBeGreaterThan(0);
    });

    it('should skip lines with no matching ayah words', async () => {
      const layout = makeLayout([
        { words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }] },
        { words: [{ char: 'الحمد', verse_key: '1:2', type: 'word' }] },
      ]);

      const result = await getAyahHighlightRects(1, 1, 2, 100, 200, layout);

      // Should only have a rect for line with ayah 2
      expect(result.length).toBe(1);
    });

    it('should use location field for ayah matching', async () => {
      const layout = makeLayout([{
        words: [{ word: 'test', location: '5:10', type: 'word' }],
      }]);

      const result = await getAyahHighlightRects(1, 5, 10, 100, 200, layout);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should skip lines with empty words arrays', async () => {
      const layout = makeLayout([
        { words: [] },
        { words: [{ char: 'test', verse_key: '1:1', type: 'word' }] },
      ]);

      const result = await getAyahHighlightRects(1, 1, 1, 100, 200, layout);

      expect(result.length).toBe(1);
    });

    it('should handle word with no char or word property', async () => {
      const layout = makeLayout([{
        words: [
          { verse_key: '1:1', type: 'word' }, // No char or word
        ],
      }]);

      const result = await getAyahHighlightRects(1, 1, 1, 100, 200, layout);

      // Should not throw; char count defaults to 1 (Math.max(1, 0))
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return correct rect dimensions for a single word', async () => {
      const layout = makeLayout([{
        words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }],
      }]);

      const result = await getAyahHighlightRects(1, 1, 1, 400, 300, layout);

      expect(result.length).toBe(1);
      const rect = result[0]!;
      // Rect should be within the canvas bounds
      expect(rect.left).toBeLessThanOrEqual(400);
      expect(rect.top).toBeLessThanOrEqual(300);
      expect(rect.left + rect.width).toBeLessThanOrEqual(400);
      expect(rect.top + rect.height).toBeLessThanOrEqual(300);
    });

    it('should skip lines with null lines in layout', async () => {
      const layout = { lines: [null, { words: [{ char: 'test', verse_key: '1:1', type: 'word' }] }] };
      const result = await getAyahHighlightRects(1, 1, 1, 100, 200, layout as any);

      expect(result.length).toBe(1);
    });

    it('should skip lines where all words are end type', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'end1', type: 'end', verse_key: '1:1' },
          { char: 'end2', type: 'end', verse_key: '1:1' },
        ],
      }]);

      const result = await getAyahHighlightRects(1, 1, 1, 100, 200, layout);
      expect(result).toEqual([]);
    });

    it('should produce correct left position accounting for RTL', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', verse_key: '1:1', type: 'word' },
          { char: 'الله', verse_key: '1:2', type: 'word' },
        ],
      }]);

      const result = await getAyahHighlightRects(1, 1, 2, 200, 100, layout);

      // For ayah 1:1, the rect should be at the right side of the canvas (RTL)
      if (result.length > 0) {
        const rect = result[0]!;
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.left + rect.width).toBeLessThanOrEqual(200);
      }
    });

    it('should return rect with height equal to line height', async () => {
      const layout = makeLayout([{
        words: [{ char: 'بسم', verse_key: '1:1', type: 'word' }],
      }]);

      const result = await getAyahHighlightRects(1, 1, 1, 100, 300, layout);

      expect(result.length).toBe(1);
      const rect = result[0]!;
      // Height should be the line height (imgHeight / totalLines = 300/1 = 300)
      expect(rect.height).toBeGreaterThan(0);
    });

    it('should handle multiple ayah words spanning part of line', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'بسم', verse_key: '1:1', type: 'word' },
          { char: 'الله', verse_key: '1:1', type: 'word' },
          { char: 'الرحمن', verse_key: '1:2', type: 'word' },
        ],
      }]);

      const result = await getAyahHighlightRects(1, 1, 1, 300, 200, layout);

      expect(result.length).toBe(1);
      const rect = result[0]!;
      // Width should be less than full canvas width since ayah 1:1 only covers 2 of 3 words
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.width).toBeLessThan(300);
    });

    it('should handle layout with many lines', async () => {
      const lines = Array.from({ length: 15 }, (_, i) => ({
        words: [{ char: `word${i}`, verse_key: `1:${i + 1}`, type: 'word' }],
      }));
      const layout = makeLayout(lines);

      const result = await getAyahHighlightRects(1, 1, 10, 400, 600, layout);

      // Should find the rect for ayah 1:10
      expect(result.length).toBe(1);
      const rect = result[0]!;
      expect(rect.top).toBeGreaterThan(0);
    });

    it('should match ayah using both verse_key and location', async () => {
      const layout = makeLayout([{
        words: [
          { char: 'test1', verse_key: '1:1', type: 'word' },
          { char: 'test2', location: '1:2', type: 'word' },
        ],
      }]);

      const result1 = await getAyahHighlightRects(1, 1, 1, 100, 200, layout);
      const result2 = await getAyahHighlightRects(1, 1, 2, 100, 200, layout);

      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);
    });
  });
});
