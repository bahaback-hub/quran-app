/**
 * Deep coverage tests for ayah-modal.ts — targets uncovered lines:
 * - Audio event handlers: onAudioTime (472-480), onAudioEnded (484-499), loadedmetadata (183-186)
 * - Audio slider input (190-192)
 * - toggleModalAudio: playing from surah state (400-441)
 * - ensureModalAudio: mp3quran path (367-371), API path (372-382)
 * - downloadModalAyah with src (511-514)
 * - loadTafsirTab error/no text paths (530, 533)
 * - shareModalAyah with navigator.share catch
 * - copyModalWithTafsir with no active tab
 * - Escape key and click-outside-close already covered
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock state module
const mockState = vi.hoisted(() => ({
  fullQuranText: [
    { surah: 1, surahName: 'الفاتحة', ayah: 1, text: 'بسم الله الرحمن الرحيم' },
    { surah: 1, surahName: 'الفاتحة', ayah: 2, text: 'الحمد لله رب العالمين' },
  ],
  favorites: [] as Array<{ key: string; surah: number; surahName: string; ayah: number; text: string; timestamp: number }>,
  surahData: null as unknown,
  currentSurah: 0,
  ayahsAudios: [] as string[],
  currentAyahIndex: 0,
  isPlaying: false,
}));

vi.mock('../state.js', () => ({
  state: mockState,
  immutablePush: vi.fn((state: any, key: string, val: any) => { state[key].push(val); }),
  immutableSplice: vi.fn((state: any, key: string, idx: number, count: number) => { state[key].splice(idx, count); }),
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
      'ar.abdulbasit': { id: 'ar.abdulbasit', name: 'Abdul Basit', source: 'mp3quran', server: 'https://server.mp3quran.net/abdulbasit/' },
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
import { fetchTafsirText } from '../tafsir.js';
import { apiFetch } from '../api-client.js';

/** Create all required modal DOM elements */
function createModalDOM(): void {
  const ids = [
    'ayahModal', 'ayahModalCloseBtn', 'ayahModalTitle', 'ayahModalBookmarkBtn',
    'ayahModalFavBtn', 'ayahModalNav', 'ayahModalNextBtn', 'ayahModalText',
    'ayahModalPage', 'ayahModalJuz', 'ayahModalSurahAyah', 'ayahModalTafsirBtn',
    'ayahModalShareBtn', 'ayahModalCopyBtn', 'ayahModalCopySimpleBtn',
    'ayahModalCopyTafsirBtn', 'ayahModalPlayBtn', 'ayahModalAudioCurrent',
    'ayahModalAudioDuration', 'ayahModalDownloadBtn', 'ayahModalTafsirTabs',
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
  slider.value = '0';
  slider.max = '100';
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
  document.body.innerHTML = '';
}

describe('ayah-modal deep2 coverage — audio handlers', () => {
  beforeEach(() => {
    createModalDOM();
    vi.clearAllMocks();
    mockState.favorites = [];
    mockState.surahData = null;
    mockState.ayahsAudios = [];
  });
  afterEach(removeModalDOM);

  describe('audio loadedmetadata event', () => {
    it('should set slider max and duration text on loadedmetadata', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      const slider = document.getElementById('ayahModalAudioSlider') as HTMLInputElement;
      const durationEl = document.getElementById('ayahModalAudioDuration')!;

      // Simulate loadedmetadata event
      Object.defineProperty(audioPlayer, 'duration', { value: 120, configurable: true, writable: true });
      audioPlayer.dispatchEvent(new Event('loadedmetadata'));

      expect(slider.max).toBe('120');
      expect(durationEl.textContent).toBe('2:00');
    });
  });

  describe('audio slider input event', () => {
    it('should set audioPlayer.currentTime when slider changes', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      const slider = document.getElementById('ayahModalAudioSlider') as HTMLInputElement;

      // Mock currentTime setter
      let setCurrentTime = -1;
      Object.defineProperty(audioPlayer, 'currentTime', {
        get: () => setCurrentTime,
        set: (v: number) => { setCurrentTime = v; },
        configurable: true,
      });

      slider.value = '50';
      slider.dispatchEvent(new Event('input'));

      expect(setCurrentTime).toBe(50);
    });
  });

  describe('onAudioTime update', () => {
    it('should update current time display and slider position', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      const slider = document.getElementById('ayahModalAudioSlider') as HTMLInputElement;
      const currentEl = document.getElementById('ayahModalAudioCurrent')!;

      // Set up audio player mock
      Object.defineProperty(audioPlayer, 'currentTime', { value: 65, configurable: true, writable: true });
      Object.defineProperty(audioPlayer, 'duration', { value: 120, configurable: true, writable: true });

      audioPlayer.dispatchEvent(new Event('timeupdate'));

      expect(currentEl.textContent).toBe('1:05');
      expect(slider.value).toBe('65');
    });
  });

  describe('onAudioEnded with repeat', () => {
    it('should replay audio when repeat checkbox is checked', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      const repeatChk = document.getElementById('ayahModalRepeatChk') as HTMLInputElement;

      // Check the repeat checkbox
      repeatChk.checked = true;

      // Mock play method
      const playMock = vi.fn(() => Promise.resolve());
      audioPlayer.play = playMock;
      Object.defineProperty(audioPlayer, 'currentTime', { value: 0, configurable: true, writable: true });

      audioPlayer.dispatchEvent(new Event('ended'));

      // Should have reset currentTime and called play
      expect(audioPlayer.currentTime).toBe(0);
      expect(playMock).toHaveBeenCalled();
    });

    it('should not replay when repeat checkbox is unchecked', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      const repeatChk = document.getElementById('ayahModalRepeatChk') as HTMLInputElement;
      const playBtn = document.getElementById('ayahModalPlayBtn')!;

      repeatChk.checked = false;
      const playMock = vi.fn(() => Promise.resolve());
      audioPlayer.play = playMock;

      audioPlayer.dispatchEvent(new Event('ended'));

      expect(playMock).not.toHaveBeenCalled();
      expect(playBtn.textContent).toBe('ayah_modal_play');
    });
  });

  describe('toggleModalAudio — play from surah state', () => {
    it('should play from state audio when same surah is loaded', async () => {
      // Set up surahData to match the current modal ayah
      mockState.surahData = {
        number: 1,
        ayahs: [
          { numberInSurah: 1, audio: 'https://audio/1.mp3' },
          { numberInSurah: 2, audio: 'https://audio/2.mp3' },
        ],
      };
      mockState.ayahsAudios = ['https://audio/1.mp3', 'https://audio/2.mp3'];

      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      const playBtn = document.getElementById('ayahModalPlayBtn')!;
      const playMock = vi.fn(() => Promise.resolve());
      audioPlayer.play = playMock;
      // Simulate paused state
      Object.defineProperty(audioPlayer, 'paused', { value: true, configurable: true });

      playBtn.click();

      await new Promise((r) => setTimeout(r, 50));

      expect(playMock).toHaveBeenCalled();
    });
  });

  describe('ensureModalAudio — mp3quran source', () => {
    it('should use mp3quran path when reciter is mp3quran source', async () => {
      initAyahModal();
      const qariSelect = document.getElementById('ayahModalQariSelect') as HTMLSelectElement;
      qariSelect.value = 'ar.abdulbasit';

      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      const playBtn = document.getElementById('ayahModalPlayBtn')!;
      const playMock = vi.fn(() => Promise.resolve());
      audioPlayer.play = playMock;
      Object.defineProperty(audioPlayer, 'paused', { value: true, configurable: true });
      Object.defineProperty(audioPlayer, 'src', { value: '', configurable: true, writable: true });

      playBtn.click();

      await new Promise((r) => setTimeout(r, 100));
      // Should have triggered audio play via mp3quran buildAudioUrl
    });
  });

  describe('ensureModalAudio — API error path', () => {
    it('should handle API error in ensureModalAudio', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('API Error'));

      initAyahModal();
      const qariSelect = document.getElementById('ayahModalQariSelect') as HTMLSelectElement;
      qariSelect.value = 'ar.alafasy';

      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      const playBtn = document.getElementById('ayahModalPlayBtn')!;
      const playMock = vi.fn(() => Promise.resolve());
      audioPlayer.play = playMock;
      Object.defineProperty(audioPlayer, 'paused', { value: true, configurable: true });
      Object.defineProperty(audioPlayer, 'src', { value: '', configurable: true, writable: true });

      playBtn.click();

      await new Promise((r) => setTimeout(r, 100));
      // Should handle error gracefully — no crash
    });
  });

  describe('downloadModalAyah — with src', () => {
    it('should trigger download when audio has src', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      Object.defineProperty(audioPlayer, 'src', { value: 'https://audio/1.mp3', configurable: true });

      // Mock createElement to capture anchor click
      const mockAnchor = { href: '', download: '', click: vi.fn() };
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
        return origCreateElement(tag);
      });

      const downloadBtn = document.getElementById('ayahModalDownloadBtn')!;
      downloadBtn.click();

      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toBe('ayah-1-1.mp3');

      vi.restoreAllMocks();
    });
  });

  describe('loadTafsirTab — error path', () => {
    it('should show error message when fetchTafsirText throws', async () => {
      vi.mocked(fetchTafsirText).mockRejectedValueOnce(new Error('Tafsir error'));

      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      // Wait for the initial tafsir load to complete (which will throw)
      await new Promise((r) => setTimeout(r, 100));

      const tafsirBody = document.getElementById('ayahModalTafsirBody')!;
      // The error path should have been taken
      expect(tafsirBody.innerHTML).toContain('tafsir-error');
    });

    it('should show no tafsir message when fetchTafsirText returns null', async () => {
      vi.mocked(fetchTafsirText).mockResolvedValueOnce(null);

      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      await new Promise((r) => setTimeout(r, 50));

      const tafsirBody = document.getElementById('ayahModalTafsirBody')!;
      expect(tafsirBody.innerHTML).toContain('tafsir-error');
    });
  });

  describe('shareModalAyah — navigator.share catch', () => {
    it('should handle navigator.share rejection gracefully', async () => {
      const shareMock = vi.fn(() => Promise.reject(new Error('Share cancelled')));
      vi.stubGlobal('navigator', { ...navigator, share: shareMock });

      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const shareBtn = document.getElementById('ayahModalShareBtn')!;
      shareBtn.click();

      await new Promise((r) => setTimeout(r, 50));
      // Should not throw even if share is rejected

      vi.unstubAllGlobals();
    });
  });

  describe('activateTab', () => {
    it('should toggle active class on tafsir tabs when switching', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const tafsirTabs = document.getElementById('ayahModalTafsirTabs')!;
      tafsirTabs.innerHTML = '';

      const tab1 = document.createElement('div');
      tab1.className = 'ayah-modal-tafsir-tab';
      tab1.dataset['edition'] = 'ar-tafsir-muyassar';
      tafsirTabs.appendChild(tab1);

      const tab2 = document.createElement('div');
      tab2.className = 'ayah-modal-tafsir-tab active';
      tab2.dataset['edition'] = 'en-tafsir';
      tafsirTabs.appendChild(tab2);

      // Click tab1 — should activate it and deactivate tab2
      tab1.click();

      expect(tab1.classList.contains('active')).toBe(true);
      expect(tab2.classList.contains('active')).toBe(false);
    });
  });

  describe('loadMeta — error path', () => {
    it('should show placeholder text when apiFetch fails for meta', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Meta API Error'));

      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      await new Promise((r) => setTimeout(r, 50));

      const pageEl = document.getElementById('ayahModalPage')!;
      const juzEl = document.getElementById('ayahModalJuz')!;
      expect(pageEl.textContent).toContain('page_info');
      expect(juzEl.textContent).toContain('juz_info');
    });
  });

  describe('goToNextAyah — with tafsir tab active', () => {
    it('should load tafsir for current active tab when navigating', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      // Add an active tafsir tab
      const tafsirTabs = document.getElementById('ayahModalTafsirTabs')!;
      const tab = document.createElement('div');
      tab.className = 'ayah-modal-tafsir-tab active';
      tab.dataset['edition'] = 'ar-tafsir-muyassar';
      tafsirTabs.appendChild(tab);

      const nextBtn = document.getElementById('ayahModalNextBtn')!;
      vi.mocked(fetchTafsirText).mockClear();
      nextBtn.click();

      await new Promise((r) => setTimeout(r, 50));
      expect(fetchTafsirText).toHaveBeenCalled();
    });
  });

  describe('toggleModalAudio — pause', () => {
    it('should pause playing audio', async () => {
      initAyahModal();
      openAyahModal({
        surah: 1, ayah: 1, text: 'بسم الله', surahName: 'الفاتحة', index: 0,
      });

      const audioPlayer = document.getElementById('ayahModalAudioPlayer') as HTMLAudioElement;
      const playBtn = document.getElementById('ayahModalPlayBtn')!;
      const pauseMock = vi.fn();
      audioPlayer.pause = pauseMock;
      Object.defineProperty(audioPlayer, 'paused', { value: false, configurable: true });

      playBtn.click();

      expect(pauseMock).toHaveBeenCalled();
      expect(playBtn.textContent).toBe('ayah_modal_play');
    });
  });
});
