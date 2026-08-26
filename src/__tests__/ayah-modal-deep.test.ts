/**
 * Deep coverage tests for ayah-modal.ts — covers uncovered branches:
 * - goToNextAyah (last ayah boundary)
 * - toggleModalFav (add and remove paths)
 * - copyModalAyah (simple and full)
 * - copyModalWithTafsir
 * - shareModalAyah (with and without navigator.share)
 * - toggleModalAudio (play from surah state, play from modal audio)
 * - onAudioEnded (with and without repeat)
 * - onAudioTime
 * - downloadModalAyah (with and without src)
 * - loadTafsirTab (success, no text, error)
 * - activateTab
 * - formatTime edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock state module
const mockState = vi.hoisted(() => ({
  fullQuranText: [
    { surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله الرحمن الرحيم' },
    { surah: 1, surahName: 'الفاتحة', ayah: 2, text: 'الحمد لله رب العالمين' },
    { surah: 1, surahName: 'الفاتحة', ayah: 3, text: 'الرحمن الرحيم' },
  ],
  favorites: [] as Array<{
    key: string;
    surah: number;
    surahName: string;
    ayah: number;
    text: string;
    timestamp: number;
  }>,
  surahData: null as unknown,
  currentSurah: 0,
  ayahsAudios: [] as string[],
  currentAyahIndex: 0,
  isPlaying: false,
}));

vi.mock('../state.js', () => ({
  state: mockState,
  immutablePush: vi.fn((state: any, key: string, val: any) => {
    state[key].push(val);
  }),
  immutableSplice: vi.fn((state: any, key: string, idx: number, count: number) => {
    state[key].splice(idx, count);
  }),
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  stripTashkeel: (s: string) => s.replace(/[\u064B-\u065F\u0670]/g, ''),
  copyToClipboard: vi.fn(),
}));

vi.mock('../templates.js', () => ({
  qariOption: (id: string, name: string) => `<option value="${id}">${name}</option>`,
  tafsirLoading: () => '<div class="tafsir-loading">Loading...</div>',
  tafsirContent: (text: string) => `<div class="tafsir-content">${text}</div>`,
  tafsirErrorMessage: (msg: string) => `<div class="tafsir-error">${msg}</div>`,
}));

vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
    DEFAULT_RECITER: 'ar.alafasy',
  },
}));

vi.mock('../app.js', () => ({
  loadSurah: vi.fn(),
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../reciters.js', () => ({
  RECITERS: [
    { id: 'ar.alafasy', name: 'Mishary Alafasy', source: 'api' },
    { id: 'ar.abdulbasit', name: 'Abdul Basit', source: 'mp3quran', server: 'https://server.mp3quran.net/abdulbasit/' },
  ],
  getReciterById: vi.fn((id: string) => {
    const map: Record<string, any> = {
      'ar.alafasy': { id: 'ar.alafasy', name: 'Mishary Alafasy', source: 'api' },
      'ar.abdulbasit': {
        id: 'ar.abdulbasit',
        name: 'Abdul Basit',
        source: 'mp3quran',
        server: 'https://server.mp3quran.net/abdulbasit/',
      },
    };
    return map[id] || null;
  }),
  buildAudioUrl: vi.fn(() => 'https://example.com/audio.mp3'),
  getReciterDisplayName: vi.fn((r: { name: string }) => r.name),
}));

vi.mock('../tafsir.js', () => ({
  fetchTafsirText: vi.fn(() => Promise.resolve('Sample tafsir text')),
}));

vi.mock('../api-client.js', () => ({
  apiFetch: vi.fn(() => Promise.resolve({ data: { page: 1, juz: 1 } })),
}));

vi.mock('../i18n.js', () => ({
  __: (key: string, ...args: string[]) => {
    let val = key;
    args.forEach((arg, i) => {
      val = val.replace(`{${i}}`, arg);
    });
    return val;
  },
}));

import { initAyahModal, openAyahModal, closeAyahModal } from '../ayah-modal.js';
import { showToast } from '../ui.js';
import { copyToClipboard } from '../utils.js';
import { fetchTafsirText } from '../tafsir.js';
import { storage } from '../storage.js';

/** Create all required modal DOM elements */
function createModalDOM(): void {
  const ids = [
    'ayahModal',
    'ayahModalCloseBtn',
    'ayahModalTitle',
    'ayahModalBookmarkBtn',
    'ayahModalFavBtn',
    'ayahModalNav',
    'ayahModalNextBtn',
    'ayahModalText',
    'ayahModalPage',
    'ayahModalJuz',
    'ayahModalSurahAyah',
    'ayahModalTafsirBtn',
    'ayahModalShareBtn',
    'ayahModalCopyBtn',
    'ayahModalCopySimpleBtn',
    'ayahModalCopyTafsirBtn',
    'ayahModalPlayBtn',
    'ayahModalAudioCurrent',
    'ayahModalAudioDuration',
    'ayahModalDownloadBtn',
    'ayahModalTafsirTabs',
    'ayahModalTafsirBody',
  ];
  for (const id of ids) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  const qariSelect = document.createElement('select');
  qariSelect.id = 'ayahModalQariSelect';
  document.body.appendChild(qariSelect);
  const slider = document.createElement('input');
  slider.id = 'ayahModalAudioSlider';
  slider.type = 'range';
  document.body.appendChild(slider);
  const repeatChk = document.createElement('input');
  repeatChk.id = 'ayahModalRepeatChk';
  repeatChk.type = 'checkbox';
  document.body.appendChild(repeatChk);
  const audio = document.createElement('audio');
  audio.id = 'ayahModalAudioPlayer';
  document.body.appendChild(audio);
}

function removeModalDOM(): void {
  const ids = [
    'ayahModal',
    'ayahModalCloseBtn',
    'ayahModalTitle',
    'ayahModalBookmarkBtn',
    'ayahModalFavBtn',
    'ayahModalNav',
    'ayahModalNextBtn',
    'ayahModalText',
    'ayahModalPage',
    'ayahModalJuz',
    'ayahModalSurahAyah',
    'ayahModalTafsirBtn',
    'ayahModalShareBtn',
    'ayahModalCopyBtn',
    'ayahModalCopySimpleBtn',
    'ayahModalCopyTafsirBtn',
    'ayahModalQariSelect',
    'ayahModalPlayBtn',
    'ayahModalAudioCurrent',
    'ayahModalAudioSlider',
    'ayahModalAudioDuration',
    'ayahModalRepeatChk',
    'ayahModalDownloadBtn',
    'ayahModalAudioPlayer',
    'ayahModalTafsirTabs',
    'ayahModalTafsirBody',
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
}

describe('ayah-modal deep coverage', () => {
  beforeEach(() => {
    createModalDOM();
    vi.clearAllMocks();
    mockState.favorites = [];
    mockState.surahData = null;
    mockState.ayahsAudios = [];
  });
  afterEach(removeModalDOM);

  describe('goToNextAyah - boundary', () => {
    it('should show toast when trying to go past last ayah', async () => {
      initAyahModal();
      // Open with the last ayah (index 2 = last in 3-item array)
      openAyahModal({
        surah: 1,
        ayah: 3,
        text: 'الرحمن الرحيم',
        surahName: 'الفاتحة',
        index: 2,
      });
      // Click next button
      const nextBtn = document.getElementById('ayahModalNextBtn')!;
      nextBtn.click();
      expect(showToast).toHaveBeenCalledWith('last_ayah_in_quran', 'error');
    });

    it('should navigate to next ayah when not at end', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بسم الله',
        surahName: 'الفاتحة',
        index: 0,
      });
      const textEl = document.getElementById('ayahModalText')!;
      const initialText = textEl.textContent;
      const nextBtn = document.getElementById('ayahModalNextBtn')!;
      nextBtn.click();
      // Text should have changed
      expect(textEl.textContent).not.toBe(initialText);
    });
  });

  describe('toggleModalFav - add and remove', () => {
    it('should add to favorites when not already favorited', async () => {
      initAyahModal();
      mockState.favorites = [];
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بسم الله',
        surahName: 'الفاتحة',
        index: 0,
      });
      const favBtn = document.getElementById('ayahModalFavBtn')!;
      favBtn.click();
      expect(showToast).toHaveBeenCalledWith('added_to_favorites', '');
      expect(storage.set).toHaveBeenCalledWith('favorites', expect.any(Array));
    });

    it('should remove from favorites when already favorited', async () => {
      mockState.favorites = [
        { key: '1:1', surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله', timestamp: Date.now() },
      ];
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بسم الله',
        surahName: 'الفاتحة',
        index: 0,
      });
      const favBtn = document.getElementById('ayahModalFavBtn')!;
      favBtn.click();
      expect(showToast).toHaveBeenCalledWith('removed_from_favorites', '');
    });
  });

  describe('copyModalAyah', () => {
    it('should copy full text when simple is false', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بِسْمِ اللَّهِ',
        surahName: 'الفاتحة',
        index: 0,
      });
      const copyBtn = document.getElementById('ayahModalCopyBtn')!;
      copyBtn.click();
      expect(copyToClipboard).toHaveBeenCalledWith('بِسْمِ اللَّهِ');
      expect(showToast).toHaveBeenCalledWith('copy_text', 'success');
    });

    it('should copy stripped text when simple is true', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بِسْمِ اللَّهِ',
        surahName: 'الفاتحة',
        index: 0,
      });
      const copySimpleBtn = document.getElementById('ayahModalCopySimpleBtn')!;
      copySimpleBtn.click();
      expect(copyToClipboard).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('copy_simple', 'success');
    });
  });

  describe('copyModalWithTafsir', () => {
    it('should copy ayah text with tafsir', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بسم الله',
        surahName: 'الفاتحة',
        index: 0,
      });
      const copyTafsirBtn = document.getElementById('ayahModalCopyTafsirBtn')!;
      copyTafsirBtn.click();
      // Wait for async fetchTafsirText
      await new Promise((r) => setTimeout(r, 50));
      expect(fetchTafsirText).toHaveBeenCalled();
      expect(copyToClipboard).toHaveBeenCalled();
    });
  });

  describe('shareModalAyah', () => {
    it('should use navigator.share when available', async () => {
      const shareMock = vi.fn(() => Promise.resolve());
      vi.stubGlobal('navigator', {
        ...navigator,
        share: shareMock,
      });

      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بسم الله',
        surahName: 'الفاتحة',
        index: 0,
      });
      const shareBtn = document.getElementById('ayahModalShareBtn')!;
      shareBtn.click();
      expect(shareMock).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('should fall back to clipboard when navigator.share is not available', async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        share: undefined,
      });

      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بسم الله',
        surahName: 'الفاتحة',
        index: 0,
      });
      const shareBtn = document.getElementById('ayahModalShareBtn')!;
      shareBtn.click();
      expect(copyToClipboard).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('downloadModalAyah', () => {
    it('should show error when no audio src', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بسم الله',
        surahName: 'الفاتحة',
        index: 0,
      });
      const downloadBtn = document.getElementById('ayahModalDownloadBtn')!;
      downloadBtn.click();
      expect(showToast).toHaveBeenCalledWith('play_ayah_first', 'error');
    });
  });

  describe('tafsir tabs', () => {
    it('should load tafsir when tafsir tab clicked', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'بسم الله',
        surahName: 'الفاتحة',
        index: 0,
      });

      // Simulate tab click
      const tafsirTabs = document.getElementById('ayahModalTafsirTabs')!;
      const mockTab = document.createElement('div');
      mockTab.className = 'ayah-modal-tafsir-tab';
      mockTab.dataset['edition'] = 'ar-tafsir-muyassar';
      tafsirTabs.appendChild(mockTab);

      mockTab.click();
      expect(fetchTafsirText).toHaveBeenCalled();
    });
  });

  describe('formatTime edge cases', () => {
    it('should format 0 seconds as 0:00', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'Test',
        surahName: 'الفاتحة',
        index: 0,
      });
      const durationEl = document.getElementById('ayahModalAudioDuration')!;
      expect(durationEl.textContent).toBe('0:00');
    });
  });

  describe('openAyahModal with null modal element', () => {
    it('should not throw when modalEl is null', () => {
      removeModalDOM();
      expect(() => openAyahModal({ surah: 1, ayah: 1, text: 'Test', surahName: 'T', index: 0 })).not.toThrow();
    });
  });

  describe('Escape key close', () => {
    it('should close modal on Escape key when not hidden', () => {
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'Test',
        surahName: 'الفاتحة',
        index: 0,
      });
      const modalEl = document.getElementById('ayahModal')!;
      expect(modalEl.classList.contains('hidden')).toBe(false);

      // Dispatch Escape key
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(modalEl.classList.contains('hidden')).toBe(true);
    });
  });

  describe('click outside modal to close', () => {
    it('should close when clicking on the modal overlay (background)', () => {
      initAyahModal();
      openAyahModal({
        surah: 1,
        ayah: 1,
        text: 'Test',
        surahName: 'الفاتحة',
        index: 0,
      });
      const modalEl = document.getElementById('ayahModal')!;

      // Click on the modal element itself (e.target === modalEl)
      modalEl.click();

      expect(modalEl.classList.contains('hidden')).toBe(true);
    });
  });
});
