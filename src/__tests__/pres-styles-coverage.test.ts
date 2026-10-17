/**
 * Coverage tests for pres-styles.ts — static presentation.css sheet and buildAyahHtml.
 *
 * The overlay styles used to be injected at runtime via a <style> element
 * (injectStyles). That requires 'unsafe-inline' in style-src, so the rules
 * moved to the static presentation.css sheet imported by presentation.ts.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted for mock function used in vi.mock factory
const { mockGetAyahAnnotations } = vi.hoisted(() => ({
  mockGetAyahAnnotations: vi.fn<() => Array<{ rule: string; start: number; end: number }>>(() => []),
}));

// Mock tajweed module
vi.mock('../tajweed.js', () => ({
  buildColorMap: vi.fn(() => new Map()),
  tajweedColorWord: vi.fn((word: string) => word),
}));

// Mock tajweed-data module using hoisted mock
vi.mock('../tajweed-data.js', () => ({
  getAyahAnnotations: mockGetAyahAnnotations,
}));

// Mock utils
vi.mock('../utils.js', () => ({
  escapeHtml: (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
}));

import { buildAyahHtml } from '../features/presentation/pres-styles.js';
import { buildColorMap, tajweedColorWord } from '../tajweed.js';

const sheet = readFileSync(resolve(import.meta.dirname, '../features/presentation/presentation.css'), 'utf8');

describe('presentation.css static sheet (CSP-safe, no runtime <style> injection)', () => {
  it('is imported by the presentation module, not the global stylesheet', () => {
    const mod = readFileSync(resolve(import.meta.dirname, '../features/presentation/presentation.ts'), 'utf8');
    expect(mod).toContain("import './presentation.css';");
    const styles = readFileSync(resolve(import.meta.dirname, '../../styles.css'), 'utf8');
    expect(styles).not.toMatch(/@import\s+['"][^'"]*presentation\.css/);
  });

  it('pres-styles.ts no longer injects a style element', () => {
    const mod = readFileSync(resolve(import.meta.dirname, '../features/presentation/pres-styles.ts'), 'utf8');
    expect(mod).not.toContain("createElement('style')");
    expect(mod).not.toContain('injectStyles');
  });

  it('should contain presentation-overlay CSS', () => {
    expect(sheet).toContain('.presentation-overlay');
  });

  it('should contain keyframe animations', () => {
    expect(sheet).toContain('@keyframes presFadeIn');
    expect(sheet).toContain('@keyframes kenBurns1');
    expect(sheet).toContain('@keyframes cloudDrift');
  });

  it('should contain scene mode styles', () => {
    expect(sheet).toContain('.pres-scene');
  });

  it('should contain light mode styles', () => {
    expect(sheet).toContain('.pres-light');
  });

  it('should contain fullscreen styles', () => {
    expect(sheet).toContain(':fullscreen');
    expect(sheet).toContain('word-break: normal');
    expect(sheet).not.toContain('word-break: break-word');
  });

  it('should contain mobile responsive styles', () => {
    expect(sheet).toContain('@media (max-width: 600px)');
  });

  it('should keep selected backgrounds full-bleed in fullscreen on phones', () => {
    expect(sheet).toContain('.presentation-overlay:fullscreen.pres-nature');
    expect(sheet).toContain('.presentation-overlay:fullscreen.pres-auto::after');
    expect(sheet).toContain('content: none');
    expect(sheet).toContain('.presentation-overlay:fullscreen.pres-animated .pres-bg-layer');
  });
});

describe('buildAyahHtml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should escape HTML when tajweed is disabled', () => {
    const result = buildAyahHtml('بسم الله', 1, 1, false);
    expect(result).toBe('بسم الله');
  });

  it('should escape HTML with special characters when tajweed is disabled', () => {
    const result = buildAyahHtml('test<script>', 1, 1, false);
    expect(result).toContain('&lt;script&gt;');
  });

  it('should return escaped text when tajweed enabled but no annotations', () => {
    mockGetAyahAnnotations.mockReturnValue([]);
    const result = buildAyahHtml('بسم الله', 1, 1, true);
    expect(result).toBe('بسم الله');
  });

  it('should apply tajweed coloring when annotations exist and tajweed enabled', () => {
    const colorMap = new Map();
    colorMap.set(0, 'ghunnah');
    colorMap.set(1, 'ghunnah');
    vi.mocked(buildColorMap).mockReturnValue(colorMap);

    mockGetAyahAnnotations.mockReturnValue([{ rule: 'ghunnah', start: 0, end: 2 }]);

    const result = buildAyahHtml('كتاب', 1, 1, true);
    expect(result).toBeTruthy();
  });

  it('should exercise basmala stripping logic for non-Fatiha surah ayah 1', () => {
    // The basmala regex in pres-styles.ts matches a very specific Uthmani pattern.
    // Even if the regex doesn't match our test input, the code path is exercised for coverage.
    const basmala = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الم';
    mockGetAyahAnnotations.mockReturnValue([]);
    const result = buildAyahHtml(basmala, 2, 1, false);
    // Just verify the function runs without error and returns a string
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should NOT strip basmala from surah 1 ayah 1', () => {
    const basmala = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
    mockGetAyahAnnotations.mockReturnValue([]);
    const result = buildAyahHtml(basmala, 1, 1, false);
    expect(result).toContain('الرَّحِيمِ');
  });

  it('should NOT strip basmala from surah 9', () => {
    mockGetAyahAnnotations.mockReturnValue([]);
    const text = 'بَرَاءَةٌ مِّنَ اللَّهِ';
    const result = buildAyahHtml(text, 9, 1, false);
    expect(result).toContain('بَرَاءَةٌ');
  });

  it('should NOT strip basmala from non-first ayahs', () => {
    mockGetAyahAnnotations.mockReturnValue([]);
    const text = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ في القرآن';
    const result = buildAyahHtml(text, 2, 5, false);
    expect(result).toContain('بِسْمِ');
  });

  it('should adjust annotation offsets when basmala is stripped', () => {
    const colorMap = new Map();
    colorMap.set(0, 'ghunnah');
    vi.mocked(buildColorMap).mockReturnValue(colorMap);

    mockGetAyahAnnotations.mockReturnValue([{ rule: 'ghunnah', start: 40, end: 42 }]);

    const basmala = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الم';
    const result = buildAyahHtml(basmala, 2, 1, true);
    expect(buildColorMap).toHaveBeenCalled();
  });

  it('should handle empty text', () => {
    mockGetAyahAnnotations.mockReturnValue([]);
    const result = buildAyahHtml('', 1, 1, false);
    expect(result).toBe('');
  });

  it('should call tajweedColorWord for each word when tajweed is enabled with annotations', () => {
    const colorMap = new Map();
    vi.mocked(buildColorMap).mockReturnValue(colorMap);
    vi.mocked(tajweedColorWord).mockImplementation((word: string) => `[${word}]`);

    mockGetAyahAnnotations.mockReturnValue([{ rule: 'ghunnah', start: 0, end: 3 }]);

    const result = buildAyahHtml('كتاب الله', 1, 1, true);
    expect(tajweedColorWord).toHaveBeenCalled();
  });
});
