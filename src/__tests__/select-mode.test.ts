/**
 * Tests for select-mode.ts — Ayah multi-selection mode.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mocks that can be used in vi.mock factory
const {
  mockToggleInternalSelectMode,
  mockGetSelectMode,
  mockGetSelectedAyahs,
  mockSetSelectedAyahs,
  mockPushSelectedAyah,
  mockFilterSelectedAyahs,
  mockCopyToClipboard,
} = vi.hoisted(() => ({
  mockToggleInternalSelectMode: vi.fn(),
  mockGetSelectMode: vi.fn(() => false),
  mockGetSelectedAyahs: vi.fn(() => []),
  mockSetSelectedAyahs: vi.fn(),
  mockPushSelectedAyah: vi.fn(),
  mockFilterSelectedAyahs: vi.fn(),
  mockCopyToClipboard: vi.fn(),
}));

vi.mock('../internal-state.js', () => ({
  toggleSelectMode: mockToggleInternalSelectMode,
  getSelectMode: mockGetSelectMode,
  getSelectedAyahs: mockGetSelectedAyahs,
  setSelectedAyahs: mockSetSelectedAyahs,
  pushSelectedAyah: mockPushSelectedAyah,
  filterSelectedAyahs: mockFilterSelectedAyahs,
  resetInternalState: vi.fn(),
}));

vi.mock('../utils.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    hapticFeedback: vi.fn(),
    copyToClipboard: mockCopyToClipboard,
  };
});

import {
  toggleSelectMode,
  enterSelectMode,
  exitSelectMode,
  clearSelection,
  shareSelected,
  handleAyahSelect,
} from '../select-mode.js';
import { showToast } from '../ui.js';

describe('select-mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSelectMode.mockReturnValue(false);
    mockGetSelectedAyahs.mockReturnValue([]);
    mockToggleInternalSelectMode.mockReturnValue(true);

    // Clean up DOM
    document.body.innerHTML = '';
  });

  /* ===================== toggleSelectMode ===================== */

  describe('toggleSelectMode', () => {
    it('should toggle internal select mode and return new state', () => {
      mockToggleInternalSelectMode.mockReturnValue(true);
      toggleSelectMode();
      expect(mockToggleInternalSelectMode).toHaveBeenCalled();
    });

    it('should toggle active class on selectModeBtn', () => {
      const btn = document.createElement('button');
      btn.id = 'selectModeBtn';
      document.body.appendChild(btn);

      mockToggleInternalSelectMode.mockReturnValue(true);
      toggleSelectMode();

      expect(btn.classList.contains('active')).toBe(true);
    });

    it('should remove active class from selectModeBtn when toggled off', () => {
      const btn = document.createElement('button');
      btn.id = 'selectModeBtn';
      btn.classList.add('active');
      document.body.appendChild(btn);

      mockToggleInternalSelectMode.mockReturnValue(false);
      toggleSelectMode();

      expect(btn.classList.contains('active')).toBe(false);
    });

    it('should toggle show class on selectModeBar', () => {
      const bar = document.createElement('div');
      bar.id = 'selectModeBar';
      document.body.appendChild(bar);

      mockToggleInternalSelectMode.mockReturnValue(true);
      toggleSelectMode();

      expect(bar.classList.contains('show')).toBe(true);
    });

    it('should remove show class from selectModeBar when toggled off', () => {
      const bar = document.createElement('div');
      bar.id = 'selectModeBar';
      bar.classList.add('show');
      document.body.appendChild(bar);

      mockToggleInternalSelectMode.mockReturnValue(false);
      toggleSelectMode();

      expect(bar.classList.contains('show')).toBe(false);
    });

    it('should clear selection when select mode is turned off', () => {
      mockToggleInternalSelectMode.mockReturnValue(false);

      toggleSelectMode();

      expect(mockSetSelectedAyahs).toHaveBeenCalledWith([]);
    });

    it('should not clear selection when select mode is turned on', () => {
      mockToggleInternalSelectMode.mockReturnValue(true);

      toggleSelectMode();

      // When turning on, clearSelection is not called
      expect(mockSetSelectedAyahs).not.toHaveBeenCalledWith([]);
    });

    it('should update selectable state on ayahs', () => {
      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      document.body.appendChild(ayah);

      mockToggleInternalSelectMode.mockReturnValue(true);
      // updateSelectable calls getSelectMode() — must return true
      mockGetSelectMode.mockReturnValue(true);
      toggleSelectMode();

      expect(ayah.classList.contains('selectable')).toBe(true);
    });

    it('should remove selectable class when select mode is off', () => {
      const ayah = document.createElement('div');
      ayah.className = 'ayah selectable';
      document.body.appendChild(ayah);

      mockToggleInternalSelectMode.mockReturnValue(false);
      toggleSelectMode();

      expect(ayah.classList.contains('selectable')).toBe(false);
    });

    it('should remove selected class from ayahs when turning off', () => {
      const ayah = document.createElement('div');
      ayah.className = 'ayah selectable selected';
      document.body.appendChild(ayah);

      mockToggleInternalSelectMode.mockReturnValue(false);
      toggleSelectMode();

      expect(ayah.classList.contains('selected')).toBe(false);
    });

    it('should handle missing DOM elements gracefully', () => {
      document.body.innerHTML = '';
      expect(() => toggleSelectMode()).not.toThrow();
    });

    it('should handle multiple ayah elements being updated at once', () => {
      const ayah1 = document.createElement('div');
      ayah1.className = 'ayah';
      const ayah2 = document.createElement('div');
      ayah2.className = 'ayah';
      const ayah3 = document.createElement('div');
      ayah3.className = 'ayah selected';
      document.body.appendChild(ayah1);
      document.body.appendChild(ayah2);
      document.body.appendChild(ayah3);

      mockToggleInternalSelectMode.mockReturnValue(false);
      toggleSelectMode();

      expect(ayah1.classList.contains('selectable')).toBe(false);
      expect(ayah2.classList.contains('selectable')).toBe(false);
      expect(ayah3.classList.contains('selected')).toBe(false);
      expect(ayah3.classList.contains('selectable')).toBe(false);
    });

    it('should not affect non-ayah elements when toggling selectable', () => {
      const other = document.createElement('div');
      other.className = 'other-class';
      document.body.appendChild(other);

      mockToggleInternalSelectMode.mockReturnValue(true);
      mockGetSelectMode.mockReturnValue(true);
      toggleSelectMode();

      expect(other.classList.contains('selectable')).toBe(false);
    });
  });

  /* ===================== enterSelectMode ===================== */

  describe('enterSelectMode', () => {
    it('should toggle select mode when not already active', () => {
      mockGetSelectMode.mockReturnValue(false);
      enterSelectMode();
      expect(mockToggleInternalSelectMode).toHaveBeenCalled();
    });

    it('should not toggle select mode when already active', () => {
      mockGetSelectMode.mockReturnValue(true);
      enterSelectMode();
      expect(mockToggleInternalSelectMode).not.toHaveBeenCalled();
    });

    it('should result in select mode being active when entering from inactive', () => {
      mockGetSelectMode.mockReturnValue(false);
      enterSelectMode();
      // The toggle is called which means the mode changes
      expect(mockToggleInternalSelectMode).toHaveBeenCalledTimes(1);
    });
  });

  /* ===================== exitSelectMode ===================== */

  describe('exitSelectMode', () => {
    it('should toggle select mode when currently active', () => {
      mockGetSelectMode.mockReturnValue(true);
      exitSelectMode();
      expect(mockToggleInternalSelectMode).toHaveBeenCalled();
    });

    it('should not toggle select mode when not active', () => {
      mockGetSelectMode.mockReturnValue(false);
      exitSelectMode();
      expect(mockToggleInternalSelectMode).not.toHaveBeenCalled();
    });

    it('should result in select mode being inactive when exiting from active', () => {
      mockGetSelectMode.mockReturnValue(true);
      exitSelectMode();
      expect(mockToggleInternalSelectMode).toHaveBeenCalledTimes(1);
    });
  });

  /* ===================== clearSelection ===================== */

  describe('clearSelection', () => {
    it('should set selected ayahs to empty array', () => {
      clearSelection();
      expect(mockSetSelectedAyahs).toHaveBeenCalledWith([]);
    });

    it('should remove selected class from all ayah elements', () => {
      const ayah1 = document.createElement('div');
      ayah1.className = 'ayah selected';
      const ayah2 = document.createElement('div');
      ayah2.className = 'ayah selected';
      document.body.appendChild(ayah1);
      document.body.appendChild(ayah2);

      clearSelection();

      expect(ayah1.classList.contains('selected')).toBe(false);
      expect(ayah2.classList.contains('selected')).toBe(false);
    });

    it('should not remove non-selected classes from ayah elements', () => {
      const ayah = document.createElement('div');
      ayah.className = 'ayah selectable selected';
      document.body.appendChild(ayah);

      clearSelection();

      expect(ayah.classList.contains('selected')).toBe(false);
      expect(ayah.classList.contains('selectable')).toBe(true);
      expect(ayah.classList.contains('ayah')).toBe(true);
    });

    it('should update the select count display', () => {
      const selectCount = document.createElement('span');
      selectCount.id = 'selectCount';
      selectCount.textContent = '5';
      document.body.appendChild(selectCount);

      mockGetSelectedAyahs.mockReturnValue([]);
      clearSelection();

      expect(selectCount.textContent).toBe('0');
    });

    it('should handle missing selectCount element', () => {
      document.body.innerHTML = '';
      expect(() => clearSelection()).not.toThrow();
    });

    it('should update selectModeBar visibility based on select mode state', () => {
      const bar = document.createElement('div');
      bar.id = 'selectModeBar';
      document.body.appendChild(bar);

      mockGetSelectMode.mockReturnValue(true);
      clearSelection();
      expect(bar.classList.contains('show')).toBe(true);

      mockGetSelectMode.mockReturnValue(false);
      clearSelection();
      expect(bar.classList.contains('show')).toBe(false);
    });

    it('should handle ayah elements that do not have selected class', () => {
      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      document.body.appendChild(ayah);

      expect(() => clearSelection()).not.toThrow();
      expect(ayah.classList.contains('selected')).toBe(false);
    });
  });

  /* ===================== shareSelected ===================== */

  describe('shareSelected', () => {
    it('should show error toast when no ayahs are selected', () => {
      mockGetSelectedAyahs.mockReturnValue([]);
      shareSelected();
      expect(showToast).toHaveBeenCalledWith('select_mode_none', 'error');
    });

    it('should use navigator.share when available', () => {
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0 },
      ]);
      const shareMock = vi.fn().mockResolvedValue(undefined);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });

      shareSelected();

      expect(shareMock).toHaveBeenCalledWith({
        title: 'app_title',
        text: expect.stringContaining('بسم الله'),
      });

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });

    it('should handle navigator.share rejection gracefully', () => {
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0 },
      ]);
      const shareMock = vi.fn().mockRejectedValue(new Error('User cancelled'));
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });

      expect(() => shareSelected()).not.toThrow();

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });

    it('should copy to clipboard when navigator.share is not available', () => {
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0 },
      ]);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

      shareSelected();

      expect(mockCopyToClipboard).toHaveBeenCalled();

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });

    it('should show success toast with count when copying to clipboard', () => {
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0 },
      ]);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

      shareSelected();

      expect(showToast).toHaveBeenCalledWith('select_mode_copied', 'success');

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });

    it('should sort selected ayahs by index before sharing', () => {
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 3, text: 'third', surahName: 'الفاتحة', index: 2 },
        { surah: 1, ayah: 1, text: 'first', surahName: 'الفاتحة', index: 0 },
        { surah: 1, ayah: 2, text: 'second', surahName: 'الفاتحة', index: 1 },
      ]);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

      shareSelected();

      const calls = mockCopyToClipboard.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const copiedText = calls[0][0] as string;
      const firstIdx = copiedText.indexOf('first');
      const secondIdx = copiedText.indexOf('second');
      const thirdIdx = copiedText.indexOf('third');
      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });

    it('should format share text with ornamental brackets', () => {
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0 },
      ]);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

      shareSelected();

      const calls = mockCopyToClipboard.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const copiedText = calls[0][0] as string;
      expect(copiedText).toContain('﴿بسم الله﴾');
      expect(copiedText).toContain('الفاتحة');
      expect(copiedText).toContain('ayah');
      expect(copiedText).toContain('1');

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });

    it('should trim trailing whitespace from share text', () => {
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0 },
      ]);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

      shareSelected();

      const calls = mockCopyToClipboard.mock.calls;
      const copiedText = calls[0][0] as string;
      expect(copiedText.endsWith('\n')).toBe(false);

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });

    it('should include separator between multiple ayahs', () => {
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'first', surahName: 'الفاتحة', index: 0 },
        { surah: 1, ayah: 2, text: 'second', surahName: 'الفاتحة', index: 1 },
      ]);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

      shareSelected();

      const calls = mockCopyToClipboard.mock.calls;
      const copiedText = calls[0][0] as string;
      // Should have double newline between ayahs
      expect(copiedText).toContain('\n\n');

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });

    it('should share with correct title using app_title i18n key', () => {
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0 },
      ]);
      const shareMock = vi.fn().mockResolvedValue(undefined);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });

      shareSelected();

      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'app_title' }),
      );

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });

    it('should handle large number of selected ayahs', () => {
      const manyAyahs = Array.from({ length: 50 }, (_, i) => ({
        surah: 2,
        ayah: i + 1,
        text: `آية ${i + 1}`,
        surahName: 'البقرة',
        index: i,
      }));
      mockGetSelectedAyahs.mockReturnValue(manyAyahs);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

      expect(() => shareSelected()).not.toThrow();
      expect(mockCopyToClipboard).toHaveBeenCalled();

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });
  });

  /* ===================== handleAyahSelect ===================== */

  describe('handleAyahSelect', () => {
    it('should return early when select mode is not active', () => {
      mockGetSelectMode.mockReturnValue(false);
      handleAyahSelect(1, 1, 'text', 'name', 0);
      expect(mockPushSelectedAyah).not.toHaveBeenCalled();
      expect(mockFilterSelectedAyahs).not.toHaveBeenCalled();
    });

    it('should return early when ayah element is not found', () => {
      mockGetSelectMode.mockReturnValue(true);
      document.body.innerHTML = '';
      handleAyahSelect(1, 1, 'text', 'name', 0);
      expect(mockPushSelectedAyah).not.toHaveBeenCalled();
    });

    it('should return early when ayah element exists but with different index', () => {
      mockGetSelectMode.mockReturnValue(true);
      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      ayah.dataset['index'] = '5';
      document.body.appendChild(ayah);

      // Looking for index 0 but the element has index 5
      handleAyahSelect(1, 1, 'text', 'name', 0);
      // Should not find element with data-index="0"
      expect(mockPushSelectedAyah).not.toHaveBeenCalled();
    });

    it('should add ayah to selection when not already selected', () => {
      mockGetSelectMode.mockReturnValue(true);
      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      ayah.dataset['index'] = '0';
      document.body.appendChild(ayah);

      handleAyahSelect(1, 1, 'بسم الله', 'الفاتحة', 0);

      expect(ayah.classList.contains('selected')).toBe(true);
      expect(mockPushSelectedAyah).toHaveBeenCalledWith({
        surah: 1,
        ayah: 1,
        text: 'بسم الله',
        surahName: 'الفاتحة',
        index: 0,
      });
    });

    it('should remove ayah from selection when already selected', () => {
      mockGetSelectMode.mockReturnValue(true);
      const ayah = document.createElement('div');
      ayah.className = 'ayah selected';
      ayah.dataset['index'] = '0';
      document.body.appendChild(ayah);

      handleAyahSelect(1, 1, 'بسم الله', 'الفاتحة', 0);

      expect(ayah.classList.contains('selected')).toBe(false);
      expect(mockFilterSelectedAyahs).toHaveBeenCalled();
    });

    it('should filter out the exact ayah when deselecting', () => {
      mockGetSelectMode.mockReturnValue(true);
      const ayah = document.createElement('div');
      ayah.className = 'ayah selected';
      ayah.dataset['index'] = '0';
      document.body.appendChild(ayah);

      handleAyahSelect(1, 1, 'بسم الله', 'الفاتحة', 0);

      expect(mockFilterSelectedAyahs).toHaveBeenCalledWith(expect.any(Function));
      // Test the filter predicate
      const predicate = mockFilterSelectedAyahs.mock.calls[0][0] as (a: { surah: number; ayah: number }) => boolean;
      expect(predicate({ surah: 1, ayah: 1 })).toBe(false); // Should be filtered out
      expect(predicate({ surah: 1, ayah: 2 })).toBe(true); // Should be kept
      expect(predicate({ surah: 2, ayah: 1 })).toBe(true); // Different surah, should be kept
    });

    it('should update select count after toggling', () => {
      mockGetSelectMode.mockReturnValue(true);
      const selectCount = document.createElement('span');
      selectCount.id = 'selectCount';
      document.body.appendChild(selectCount);

      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      ayah.dataset['index'] = '0';
      document.body.appendChild(ayah);

      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0 },
      ]);

      handleAyahSelect(1, 1, 'بسم الله', 'الفاتحة', 0);

      expect(selectCount.textContent).toBe('1');
    });

    it('should handle ayah with different surah and ayah numbers', () => {
      mockGetSelectMode.mockReturnValue(true);
      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      ayah.dataset['index'] = '5';
      document.body.appendChild(ayah);

      handleAyahSelect(2, 10, 'الم', 'البقرة', 5);

      expect(mockPushSelectedAyah).toHaveBeenCalledWith({
        surah: 2,
        ayah: 10,
        text: 'الم',
        surahName: 'البقرة',
        index: 5,
      });
    });

    it('should update selectModeBar when select count changes', () => {
      mockGetSelectMode.mockReturnValue(true);
      const bar = document.createElement('div');
      bar.id = 'selectModeBar';
      document.body.appendChild(bar);
      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      ayah.dataset['index'] = '0';
      document.body.appendChild(ayah);

      handleAyahSelect(1, 1, 'text', 'name', 0);

      expect(bar.classList.contains('show')).toBe(true);
    });

    it('should handle selecting and then deselecting the same ayah', () => {
      mockGetSelectMode.mockReturnValue(true);
      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      ayah.dataset['index'] = '0';
      document.body.appendChild(ayah);

      // Select
      handleAyahSelect(1, 1, 'text', 'name', 0);
      expect(ayah.classList.contains('selected')).toBe(true);
      expect(mockPushSelectedAyah).toHaveBeenCalled();

      // Deselect
      handleAyahSelect(1, 1, 'text', 'name', 0);
      expect(ayah.classList.contains('selected')).toBe(false);
      expect(mockFilterSelectedAyahs).toHaveBeenCalled();
    });

    it('should handle empty text and surahName', () => {
      mockGetSelectMode.mockReturnValue(true);
      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      ayah.dataset['index'] = '0';
      document.body.appendChild(ayah);

      handleAyahSelect(1, 1, '', '', 0);

      expect(mockPushSelectedAyah).toHaveBeenCalledWith({
        surah: 1,
        ayah: 1,
        text: '',
        surahName: '',
        index: 0,
      });
    });
  });

  /* ===================== Integration-style tests ===================== */

  describe('select mode lifecycle', () => {
    it('should handle full select mode lifecycle: enter → select → share → exit', () => {
      // Enter select mode
      mockGetSelectMode.mockReturnValue(false);
      mockToggleInternalSelectMode.mockReturnValue(true);
      enterSelectMode();

      // Select ayahs
      const ayah = document.createElement('div');
      ayah.className = 'ayah';
      ayah.dataset['index'] = '0';
      document.body.appendChild(ayah);

      mockGetSelectMode.mockReturnValue(true);
      handleAyahSelect(1, 1, 'بسم الله', 'الفاتحة', 0);

      // Share
      mockGetSelectedAyahs.mockReturnValue([
        { surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0 },
      ]);
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      shareSelected();
      expect(mockCopyToClipboard).toHaveBeenCalled();

      // Exit
      mockGetSelectMode.mockReturnValue(true);
      mockToggleInternalSelectMode.mockReturnValue(false);
      exitSelectMode();

      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    });
  });
});
