/**
 * Tests for ayah-modal.ts — Ayah modal open/close, bookmark, favorite,
 * copy, share, audio, tafsir tabs, navigation, and formatTime.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock state module
vi.mock('../state.js', () => ({
  state: {
    fullQuranText: null as Array<{ surah: number; surahName: string; ayah: number; text: string }> | null,
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
  },
  immutablePush: vi.fn(),
  immutableSplice: vi.fn(),
}));

// Mock ui module
vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

// Mock utils module
vi.mock('../utils.js', () => ({
  stripTashkeel: (s: string) => s.replace(/[\u064B-\u065F\u0670]/g, ''),
  copyToClipboard: vi.fn(),
}));

// Mock templates module
vi.mock('../templates.js', () => ({
  qariOption: (id: string, name: string) => `<option value="${id}">${name}</option>`,
  tafsirLoading: () => '<div class="tafsir-loading">Loading...</div>',
  tafsirContent: (text: string) => `<div class="tafsir-content">${text}</div>`,
  tafsirErrorMessage: (msg: string) => `<div class="tafsir-error">${msg}</div>`,
}));

// Mock config module
vi.mock('../config.js', () => ({
  CONFIG: {
    API_BASE: 'https://api.alquran.cloud/v1',
    DEFAULT_RECITER: 'ar.alafasy',
  },
}));

// Mock app module
vi.mock('../app.js', () => ({
  loadSurah: vi.fn(),
}));

// Mock storage module
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock reciters module
vi.mock('../reciters.js', () => ({
  RECITERS: [
    { id: 'ar.alafasy', name: 'Mishary Alafasy', source: 'api' },
    { id: 'ar.abdulbasit', name: 'Abdul Basit', source: 'mp3quran', server: 'https://server.mp3quran.net/abdulbasit/' },
  ],
  getReciterById: vi.fn((id: string) => {
    const map: Record<string, { id: string; name: string; source: string; server?: string }> = {
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

// Mock tafsir module
vi.mock('../tafsir.js', () => ({
  fetchTafsirText: vi.fn(() => Promise.resolve('Sample tafsir text')),
}));

// Mock api-client module
vi.mock('../api-client.js', () => ({
  apiFetch: vi.fn(() => Promise.resolve({ data: { page: 1, juz: 1 } })),
}));

// Mock i18n module
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
import { state } from '../state.js';
import { storage } from '../storage.js';
import { showToast } from '../ui.js';
import { fetchTafsirText } from '../tafsir.js';
import { apiFetch } from '../api-client.js';

/** Helper to create all required modal DOM elements in the document. */
function createModalDOM(): void {
  const modalIds = [
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

  for (const id of modalIds) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }

  // Create select element for qari
  const qariSelect = document.createElement('select');
  qariSelect.id = 'ayahModalQariSelect';
  document.body.appendChild(qariSelect);

  // Create input elements
  const slider = document.createElement('input');
  slider.id = 'ayahModalAudioSlider';
  slider.type = 'range';
  document.body.appendChild(slider);

  const repeatChk = document.createElement('input');
  repeatChk.id = 'ayahModalRepeatChk';
  repeatChk.type = 'checkbox';
  document.body.appendChild(repeatChk);

  // Create audio element
  const audio = document.createElement('audio');
  audio.id = 'ayahModalAudioPlayer';
  document.body.appendChild(audio);
}

/** Remove all modal DOM elements. */
function removeModalDOM(): void {
  const modalIds = [
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
  for (const id of modalIds) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
}

describe('initAyahModal', () => {
  beforeEach(createModalDOM);
  afterEach(removeModalDOM);

  it('should not throw when called with DOM elements present', () => {
    expect(() => initAyahModal()).not.toThrow();
  });

  it('should populate qari select with reciters', () => {
    initAyahModal();
    const qariSelect = document.getElementById('ayahModalQariSelect') as HTMLSelectElement;
    expect(qariSelect.innerHTML).toContain('ar.alafasy');
    expect(qariSelect.innerHTML).toContain('Mishary Alafasy');
  });

  it('should not throw when modal DOM elements are missing', () => {
    removeModalDOM();
    expect(() => initAyahModal()).not.toThrow();
  });
});

describe('openAyahModal', () => {
  beforeEach(() => {
    createModalDOM();
    vi.clearAllMocks();
  });
  afterEach(removeModalDOM);

  it('should not throw with null data', () => {
    initAyahModal();
    expect(() => openAyahModal(null as unknown as Parameters<typeof openAyahModal>[0])).not.toThrow();
  });

  it('should set modal display to flex when opening', () => {
    initAyahModal();
    const modalEl = document.getElementById('ayahModal')!;
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      surahName: 'الفاتحة',
      index: 0,
    });
    expect(modalEl.style.display).toBe('flex');
  });

  it('should remove hidden class from modal element', () => {
    initAyahModal();
    const modalEl = document.getElementById('ayahModal')!;
    modalEl.classList.add('hidden');
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test text',
      surahName: 'الفاتحة',
      index: 0,
    });
    expect(modalEl.classList.contains('hidden')).toBe(false);
  });

  it('should set body overflow to hidden', () => {
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test',
      surahName: 'الفاتحة',
      index: 0,
    });
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should set ayah modal text content', () => {
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'بِسْمِ اللَّهِ',
      surahName: 'الفاتحة',
      index: 0,
    });
    const textEl = document.getElementById('ayahModalText')!;
    expect(textEl.textContent).toBe('بِسْمِ اللَّهِ');
  });

  it('should look up index from fullQuranText when index is -1', () => {
    (state as Record<string, unknown>).fullQuranText = [
      { surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بِسْمِ اللَّهِ' },
      { surah: 1, surahName: 'الفاتحة', ayah: 2, text: 'الْحَمْدُ لِلَّهِ' },
    ];
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 2,
      text: 'الْحَمْدُ لِلَّهِ',
      surahName: 'الفاتحة',
      index: -1,
    });
    const textEl = document.getElementById('ayahModalText')!;
    expect(textEl.textContent).toBe('الْحَمْدُ لِلَّهِ');
  });

  it('should load tafsir when opening', () => {
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test',
      surahName: 'الفاتحة',
      index: 0,
    });
    expect(fetchTafsirText).toHaveBeenCalled();
  });

  it('should call apiFetch for meta information', () => {
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test',
      surahName: 'الفاتحة',
      index: 0,
    });
    expect(apiFetch).toHaveBeenCalled();
  });
});

describe('closeAyahModal', () => {
  beforeEach(() => {
    createModalDOM();
    vi.clearAllMocks();
  });
  afterEach(removeModalDOM);

  it('should add hidden class to modal element', () => {
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test',
      surahName: 'الفاتحة',
      index: 0,
    });
    closeAyahModal();
    const modalEl = document.getElementById('ayahModal')!;
    expect(modalEl.classList.contains('hidden')).toBe(true);
  });

  it('should set modal display to none', () => {
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test',
      surahName: 'الفاتحة',
      index: 0,
    });
    closeAyahModal();
    const modalEl = document.getElementById('ayahModal')!;
    expect(modalEl.style.display).toBe('none');
  });

  it('should reset body overflow', () => {
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test',
      surahName: 'الفاتحة',
      index: 0,
    });
    closeAyahModal();
    expect(document.body.style.overflow).toBe('');
  });

  it('should not throw when modalEl is null', () => {
    removeModalDOM();
    expect(() => closeAyahModal()).not.toThrow();
  });
});

describe('formatTime (via audio state display)', () => {
  // formatTime is internal but exercised through resetAudio via openAyahModal
  it('should reset audio time displays to 0:00 on open', () => {
    createModalDOM();
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test',
      surahName: 'الفاتحة',
      index: 0,
    });
    const currentEl = document.getElementById('ayahModalAudioCurrent')!;
    const durationEl = document.getElementById('ayahModalAudioDuration')!;
    expect(currentEl.textContent).toBe('0:00');
    expect(durationEl.textContent).toBe('0:00');
    removeModalDOM();
  });
});

describe('Bookmark functionality', () => {
  beforeEach(() => {
    createModalDOM();
    vi.clearAllMocks();
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test',
      surahName: 'الفاتحة',
      index: 0,
    });
  });
  afterEach(removeModalDOM);

  it('should save bookmark when bookmark button is clicked', () => {
    const bookmarkBtn = document.getElementById('ayahModalBookmarkBtn')!;
    bookmarkBtn.click();
    expect(storage.set).toHaveBeenCalledWith(
      'bookmark',
      expect.objectContaining({
        surah: 1,
        ayah: 1,
      }),
    );
    expect(showToast).toHaveBeenCalledWith('bookmark_position_saved', 'success');
  });
});

describe('Favorite functionality', () => {
  beforeEach(() => {
    createModalDOM();
    vi.clearAllMocks();
    (state as Record<string, unknown>).favorites = [];
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'Test',
      surahName: 'الفاتحة',
      index: 0,
    });
  });
  afterEach(removeModalDOM);

  it('should toggle favorite when fav button is clicked', () => {
    const favBtn = document.getElementById('ayahModalFavBtn')!;
    favBtn.click();
    expect(showToast).toHaveBeenCalled();
  });
});

describe('Copy functionality', () => {
  beforeEach(() => {
    createModalDOM();
    vi.clearAllMocks();
    initAyahModal();
    openAyahModal({
      surah: 1,
      ayah: 1,
      text: 'بِسْمِ اللَّهِ',
      surahName: 'الفاتحة',
      index: 0,
    });
  });
  afterEach(removeModalDOM);

  it('should copy ayah text when copy button is clicked', () => {
    const copyBtn = document.getElementById('ayahModalCopyBtn')!;
    copyBtn.click();
    expect(showToast).toHaveBeenCalled();
  });
});
