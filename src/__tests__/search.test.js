import { describe, it, expect, vi, beforeEach } from 'vitest';
import { escapeRegExp, normalizeExactText } from '../utils.js';

const ARABIC_KEYBOARD_LAYOUT = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ']
];

describe('escapeRegExp', () => {
  it('should escape regex special chars', () => {
    expect(escapeRegExp('test.')).toBe('test\\.');
    expect(escapeRegExp('(hello)')).toBe('\\(hello\\)');
    expect(escapeRegExp('a+b*c')).toBe('a\\+b\\*c');
  });

  it('should return plain string as-is', () => {
    expect(escapeRegExp('السلام')).toBe('السلام');
  });
});

describe('Arabic keyboard layout', () => {
  it('should have 3 rows', () => {
    expect(ARABIC_KEYBOARD_LAYOUT.length).toBe(3);
  });

  it('should contain common Arabic letters', () => {
    const all = ARABIC_KEYBOARD_LAYOUT.flat();
    expect(all).toContain('ا');
    expect(all).toContain('ب');
    expect(all).toContain('ل');
    expect(all).toContain('م');
  });

  it('first row should have 12 keys', () => {
    expect(ARABIC_KEYBOARD_LAYOUT[0].length).toBe(12);
  });
});

describe('performExactSearch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should search and return matches from fullQuranText', async () => {
    const searchModule = await import('../search.js');
    const { state } = await import('../state.js');
    state.fullQuranLoaded = true;
    state.fullQuranText = [
      { surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', normalized: normalizeExactText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ') },
      { surah: 1, surahName: 'الفاتحة', ayah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', normalized: normalizeExactText('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ') }
    ];
    state._allSearchMatches = null;
    state._searchResultsPage = 1;

    const dom = await import('../dom.js').then(m => m.dom);
    dom.searchResults = document.createElement('div');

    searchModule.performExactSearch('اللَّهِ');
    expect(state._allSearchMatches).toBeTruthy();
    expect(state._allSearchMatches.length).toBeGreaterThan(0);
  });

  it('should show toast for short queries', async () => {
    const searchModule = await import('../search.js');
    const uiModule = await import('../ui.js');
    const toastSpy = vi.spyOn(uiModule, 'showToast');
    searchModule.performExactSearch('a');
    expect(toastSpy).toHaveBeenCalledWith('أدخل حرفين على الأقل', 'error');
  });

  it('should show toast if Quran not loaded', async () => {
    const searchModule = await import('../search.js');
    const { state } = await import('../state.js');
    state.fullQuranLoaded = false;
    const uiModule = await import('../ui.js');
    const toastSpy = vi.spyOn(uiModule, 'showToast');
    searchModule.performExactSearch('الله');
    expect(toastSpy).toHaveBeenCalledWith('⚠️ قاعدة القرآن تُحمَّل، انتظر قليلاً', 'error');
  });
});
