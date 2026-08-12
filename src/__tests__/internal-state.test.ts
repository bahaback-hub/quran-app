/**
 * Tests for internal-state.ts — Internal (private) state getters, setters, and operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Unmock internal-state since it's the module under test
// (setup-i18n.ts mocks it with only resetInternalState)
vi.unmock('../internal-state.js');

import {
  getAdhkarAudioCtx,
  setAdhkarAudioCtx,
  getSelectMode,
  setSelectMode,
  toggleSelectMode,
  getSelectedAyahs,
  setSelectedAyahs,
  pushSelectedAyah,
  filterSelectedAyahs,
  getVoiceListening,
  setVoiceListening,
  getVoiceRecognition,
  setVoiceRecognition,
  getSmartTvState,
  setSmartTvState,
  getSmartTvAudioSrc,
  setSmartTvAudioSrc,
  getUpdateReadingProgress,
  setUpdateReadingProgress,
  getAllSearchMatches,
  setAllSearchMatches,
  getSearchResultsPage,
  setSearchResultsPage,
  getEditPersonalAdhkarId,
  setEditPersonalAdhkarId,
  getAdhkarNotificationTimer,
  setAdhkarNotificationTimer,
  getAdhkarIntervalId,
  setAdhkarIntervalId,
  resetInternalState,
} from '../internal-state.js';
import type { SelectedAyah, QuranTextEntry } from '../state.js';

describe('internal-state', () => {
  beforeEach(() => {
    resetInternalState();
  });

  /* ===================== AdhkarAudioCtx ===================== */

  describe('adhkarAudioCtx', () => {
    it('should return null by default', () => {
      expect(getAdhkarAudioCtx()).toBeNull();
    });

    it('should set and get an AudioContext', () => {
      const ctx = {} as AudioContext;
      setAdhkarAudioCtx(ctx);
      expect(getAdhkarAudioCtx()).toBe(ctx);
    });

    it('should clear AudioContext with null', () => {
      const ctx = {} as AudioContext;
      setAdhkarAudioCtx(ctx);
      setAdhkarAudioCtx(null);
      expect(getAdhkarAudioCtx()).toBeNull();
    });
  });

  /* ===================== SelectMode ===================== */

  describe('selectMode', () => {
    it('should return false by default', () => {
      expect(getSelectMode()).toBe(false);
    });

    it('should set and get select mode', () => {
      setSelectMode(true);
      expect(getSelectMode()).toBe(true);
      setSelectMode(false);
      expect(getSelectMode()).toBe(false);
    });
  });

  describe('toggleSelectMode', () => {
    it('should toggle from false to true and return new state', () => {
      expect(getSelectMode()).toBe(false);
      const result = toggleSelectMode();
      expect(result).toBe(true);
      expect(getSelectMode()).toBe(true);
    });

    it('should toggle from true to false and return new state', () => {
      setSelectMode(true);
      const result = toggleSelectMode();
      expect(result).toBe(false);
      expect(getSelectMode()).toBe(false);
    });

    it('should toggle multiple times', () => {
      expect(toggleSelectMode()).toBe(true);
      expect(toggleSelectMode()).toBe(false);
      expect(toggleSelectMode()).toBe(true);
    });
  });

  /* ===================== SelectedAyahs ===================== */

  describe('selectedAyahs', () => {
    it('should return empty array by default', () => {
      expect(getSelectedAyahs()).toEqual([]);
    });

    it('should set and get selected ayahs', () => {
      const ayahs: SelectedAyah[] = [{ surah: 1, ayah: 1, text: 'text', surahName: 'الفاتحة', index: 0 }];
      setSelectedAyahs(ayahs);
      expect(getSelectedAyahs()).toEqual(ayahs);
    });

    it('should replace entire list on set', () => {
      const first: SelectedAyah[] = [{ surah: 1, ayah: 1, text: 'a', surahName: 'الفاتحة', index: 0 }];
      const second: SelectedAyah[] = [{ surah: 2, ayah: 5, text: 'b', surahName: 'البقرة', index: 4 }];
      setSelectedAyahs(first);
      setSelectedAyahs(second);
      expect(getSelectedAyahs()).toEqual(second);
    });
  });

  describe('pushSelectedAyah', () => {
    it('should add an ayah to the list', () => {
      const ayah: SelectedAyah = { surah: 1, ayah: 1, text: 'text', surahName: 'الفاتحة', index: 0 };
      pushSelectedAyah(ayah);
      expect(getSelectedAyahs()).toHaveLength(1);
      expect(getSelectedAyahs()[0]).toEqual(ayah);
    });

    it('should add multiple ayahs immutably', () => {
      const a1: SelectedAyah = { surah: 1, ayah: 1, text: 'a', surahName: 'الفاتحة', index: 0 };
      const a2: SelectedAyah = { surah: 2, ayah: 1, text: 'b', surahName: 'البقرة', index: 0 };
      pushSelectedAyah(a1);
      pushSelectedAyah(a2);
      expect(getSelectedAyahs()).toHaveLength(2);
      expect(getSelectedAyahs()[0]).toEqual(a1);
      expect(getSelectedAyahs()[1]).toEqual(a2);
    });

    it('should not mutate existing array reference (immutable push)', () => {
      const a1: SelectedAyah = { surah: 1, ayah: 1, text: 'a', surahName: 'الفاتحة', index: 0 };
      pushSelectedAyah(a1);
      const beforePush = getSelectedAyahs();
      const a2: SelectedAyah = { surah: 2, ayah: 1, text: 'b', surahName: 'البقرة', index: 0 };
      pushSelectedAyah(a2);
      // The old reference should still have length 1
      expect(beforePush).toHaveLength(1);
      expect(getSelectedAyahs()).toHaveLength(2);
    });
  });

  describe('filterSelectedAyahs', () => {
    beforeEach(() => {
      setSelectedAyahs([
        { surah: 1, ayah: 1, text: 'a', surahName: 'الفاتحة', index: 0 },
        { surah: 2, ayah: 1, text: 'b', surahName: 'البقرة', index: 0 },
        { surah: 1, ayah: 5, text: 'c', surahName: 'الفاتحة', index: 4 },
      ]);
    });

    it('should filter ayahs by predicate', () => {
      filterSelectedAyahs((a) => a.surah === 1);
      expect(getSelectedAyahs()).toHaveLength(2);
      expect(getSelectedAyahs().every((a) => a.surah === 1)).toBe(true);
    });

    it('should return empty array if all filtered out', () => {
      filterSelectedAyahs(() => false);
      expect(getSelectedAyahs()).toEqual([]);
    });

    it('should keep all if predicate always true', () => {
      filterSelectedAyahs(() => true);
      expect(getSelectedAyahs()).toHaveLength(3);
    });
  });

  /* ===================== VoiceListening ===================== */

  describe('voiceListening', () => {
    it('should return false by default', () => {
      expect(getVoiceListening()).toBe(false);
    });

    it('should set and get voice listening', () => {
      setVoiceListening(true);
      expect(getVoiceListening()).toBe(true);
      setVoiceListening(false);
      expect(getVoiceListening()).toBe(false);
    });
  });

  /* ===================== VoiceRecognition ===================== */

  describe('voiceRecognition', () => {
    it('should return null by default', () => {
      expect(getVoiceRecognition()).toBeNull();
    });

    it('should set and get voice recognition', () => {
      const mockRecognition = { start: vi.fn() };
      setVoiceRecognition(mockRecognition);
      expect(getVoiceRecognition()).toBe(mockRecognition);
    });

    it('should clear with undefined', () => {
      setVoiceRecognition({});
      setVoiceRecognition(null);
      expect(getVoiceRecognition()).toBeNull();
    });
  });

  /* ===================== SmartTvState ===================== */

  describe('smartTvState', () => {
    it('should return 0 by default', () => {
      expect(getSmartTvState()).toBe(0);
    });

    it('should set and get smart tv state', () => {
      setSmartTvState(5);
      expect(getSmartTvState()).toBe(5);
    });
  });

  /* ===================== SmartTvAudioSrc ===================== */

  describe('smartTvAudioSrc', () => {
    it('should return empty string by default', () => {
      expect(getSmartTvAudioSrc()).toBe('');
    });

    it('should set and get smart tv audio source', () => {
      setSmartTvAudioSrc('https://example.com/audio.mp3');
      expect(getSmartTvAudioSrc()).toBe('https://example.com/audio.mp3');
    });
  });

  /* ===================== UpdateReadingProgress ===================== */

  describe('updateReadingProgress', () => {
    it('should return null by default', () => {
      expect(getUpdateReadingProgress()).toBeNull();
    });

    it('should set and get callback', () => {
      const fn = () => {};
      setUpdateReadingProgress(fn);
      expect(getUpdateReadingProgress()).toBe(fn);
    });

    it('should clear callback with null', () => {
      setUpdateReadingProgress(() => {});
      setUpdateReadingProgress(null);
      expect(getUpdateReadingProgress()).toBeNull();
    });
  });

  /* ===================== AllSearchMatches ===================== */

  describe('allSearchMatches', () => {
    it('should return null by default', () => {
      expect(getAllSearchMatches()).toBeNull();
    });

    it('should set and get search matches', () => {
      const matches: QuranTextEntry[] = [{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'text', normalized: 'text' }];
      setAllSearchMatches(matches);
      expect(getAllSearchMatches()).toEqual(matches);
    });

    it('should clear with null', () => {
      setAllSearchMatches([{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'a', normalized: 'a' }]);
      setAllSearchMatches(null);
      expect(getAllSearchMatches()).toBeNull();
    });
  });

  /* ===================== SearchResultsPage ===================== */

  describe('searchResultsPage', () => {
    it('should return 1 by default', () => {
      expect(getSearchResultsPage()).toBe(1);
    });

    it('should set and get search results page', () => {
      setSearchResultsPage(3);
      expect(getSearchResultsPage()).toBe(3);
    });
  });

  /* ===================== EditPersonalAdhkarId ===================== */

  describe('editPersonalAdhkarId', () => {
    it('should return null by default', () => {
      expect(getEditPersonalAdhkarId()).toBeNull();
    });

    it('should set and get edit personal adhkar id', () => {
      setEditPersonalAdhkarId('abc123');
      expect(getEditPersonalAdhkarId()).toBe('abc123');
    });

    it('should clear with null', () => {
      setEditPersonalAdhkarId('abc123');
      setEditPersonalAdhkarId(null);
      expect(getEditPersonalAdhkarId()).toBeNull();
    });
  });

  /* ===================== AdhkarNotificationTimer ===================== */

  describe('adhkarNotificationTimer', () => {
    it('should return null by default', () => {
      expect(getAdhkarNotificationTimer()).toBeNull();
    });

    it('should set and get timer', () => {
      const timer = setTimeout(() => {}, 10000) as unknown as ReturnType<typeof setTimeout>;
      setAdhkarNotificationTimer(timer);
      expect(getAdhkarNotificationTimer()).toBe(timer);
      clearTimeout(timer);
    });

    it('should clear with null', () => {
      setAdhkarNotificationTimer(123 as any);
      setAdhkarNotificationTimer(null);
      expect(getAdhkarNotificationTimer()).toBeNull();
    });
  });

  /* ===================== AdhkarIntervalId ===================== */

  describe('adhkarIntervalId', () => {
    it('should return null by default', () => {
      expect(getAdhkarIntervalId()).toBeNull();
    });

    it('should set and get interval id', () => {
      const id = setInterval(() => {}, 30000) as unknown as ReturnType<typeof setInterval>;
      setAdhkarIntervalId(id);
      expect(getAdhkarIntervalId()).toBe(id);
      clearInterval(id);
    });

    it('should clear with null', () => {
      setAdhkarIntervalId(456 as any);
      setAdhkarIntervalId(null);
      expect(getAdhkarIntervalId()).toBeNull();
    });
  });

  /* ===================== resetInternalState ===================== */

  describe('resetInternalState', () => {
    it('should reset all state to defaults', () => {
      // Set non-default values
      setAdhkarAudioCtx({ close: vi.fn() } as any);
      setSelectMode(true);
      setSelectedAyahs([{ surah: 1, ayah: 1, text: 'a', surahName: 'الفاتحة', index: 0 }]);
      setVoiceListening(true);
      setVoiceRecognition({ start: vi.fn() });
      setSmartTvState(5);
      setSmartTvAudioSrc('https://example.com/audio.mp3');
      setUpdateReadingProgress(() => {});
      setAllSearchMatches([{ surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'a', normalized: 'a' }]);
      setSearchResultsPage(5);
      setEditPersonalAdhkarId('xyz');
      setAdhkarNotificationTimer(123 as any);
      setAdhkarIntervalId(456 as any);

      resetInternalState();

      expect(getAdhkarAudioCtx()).toBeNull();
      expect(getSelectMode()).toBe(false);
      expect(getSelectedAyahs()).toEqual([]);
      expect(getVoiceListening()).toBe(false);
      expect(getVoiceRecognition()).toBeNull();
      expect(getSmartTvState()).toBe(0);
      expect(getSmartTvAudioSrc()).toBe('');
      expect(getUpdateReadingProgress()).toBeNull();
      expect(getAllSearchMatches()).toBeNull();
      expect(getSearchResultsPage()).toBe(1);
      expect(getEditPersonalAdhkarId()).toBeNull();
      expect(getAdhkarNotificationTimer()).toBeNull();
      expect(getAdhkarIntervalId()).toBeNull();
    });

    it('should close AudioContext before clearing reference', () => {
      const mockClose = vi.fn();
      setAdhkarAudioCtx({ close: mockClose } as any);
      resetInternalState();
      expect(mockClose).toHaveBeenCalled();
      expect(getAdhkarAudioCtx()).toBeNull();
    });

    it('should handle AudioContext.close() throwing', () => {
      const mockClose = vi.fn(() => {
        throw new Error('already closed');
      });
      setAdhkarAudioCtx({ close: mockClose } as any);
      expect(() => resetInternalState()).not.toThrow();
      expect(getAdhkarAudioCtx()).toBeNull();
    });

    it('should be safe to call resetInternalState when already at defaults', () => {
      expect(() => resetInternalState()).not.toThrow();
    });
  });
});
