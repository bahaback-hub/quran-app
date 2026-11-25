import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  stateMock,
  labelMock,
  getAyahCountMock,
  getSurahNameMock,
  getSavedSessionDownloadMock,
  isSurahCachedMock,
  loadAudioUrlsForSessionMock,
} = vi.hoisted(() => ({
  stateMock: {
    currentSurah: 1,
    currentReciter: 'ar.alafasy',
    ayahsAudios: [] as (string | null)[],
    surahData: null as any,
  },
  labelMock: vi.fn((k: string, ...args: string[]) => (args.length ? `${k}:${args.join('|')}` : k)),
  getAyahCountMock: vi.fn(() => 7),
  getSurahNameMock: vi.fn(() => 'Al-Fatiha'),
  getSavedSessionDownloadMock: vi.fn(),
  isSurahCachedMock: vi.fn(),
  loadAudioUrlsForSessionMock: vi.fn(),
}));

vi.mock('../hifz-room-plan.js', () => ({
  label: (...a: any[]) => (labelMock as any)(...a),
  getAyahCount: (...a: any[]) => (getAyahCountMock as any)(...a),
  getSurahName: (...a: any[]) => (getSurahNameMock as any)(...a),
  getSavedSessionDownload: (...a: any[]) => (getSavedSessionDownloadMock as any)(...a),
}));
vi.mock('../features/audio/audio-cache.js', () => ({
  isSurahCached: (...a: any[]) => (isSurahCachedMock as any)(...a),
}));
vi.mock('../surah-loader.js', () => ({
  loadAudioUrlsForSession: (...a: any[]) => (loadAudioUrlsForSessionMock as any)(...a),
}));
vi.mock('../state.js', () => ({ state: stateMock }));

import {
  getDownloadButtons,
  setSessionDownloadStatus,
  setSessionReadyStatus,
  setSessionDownloadBusy,
  resolveSessionAudioUrls,
  hydrateDownloadedSessionAudio,
} from '../hifz-room-download.js';

const plan = {
  version: 1,
  surah: 1,
  from: 1,
  to: 3,
  times: 5,
  review: 'today',
  reciter: 'ar.alafasy',
  speed: 1,
  updatedAt: 0,
} as any;

describe('hifz-room-download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateMock.currentSurah = 1;
    stateMock.currentReciter = 'ar.alafasy';
    stateMock.ayahsAudios = [];
    stateMock.surahData = null;
    document.body.innerHTML = `
      <div id="room">
        <button id="hifzRoomDownload">download</button>
        <button id="hifzRoomFocusDownload">focus</button>
        <span id="hifzRoomDownloadStatus"></span>
        <span id="hifzRoomFocusDownloadStatus"></span>
      </div>`;
  });

  it('finds download buttons and sets status/busy/ready states', () => {
    const room = document.getElementById('room')!;
    expect(getDownloadButtons(room)).toHaveLength(2);

    setSessionDownloadStatus(room, 'hifz_room_download_ready', 'ready', 'x');
    expect(room.querySelector('#hifzRoomDownloadStatus')?.textContent).toBe('hifz_room_download_ready:x');
    expect((room.querySelector('#hifzRoomDownloadStatus') as HTMLElement).dataset['state']).toBe('ready');

    setSessionReadyStatus(room, plan, false);
    expect(room.querySelector('#hifzRoomDownloadStatus')?.textContent).toContain('hifz_room_download_ready');

    setSessionReadyStatus(room, plan, true);
    expect(room.querySelector('#hifzRoomDownloadStatus')?.textContent).toContain('hifz_room_download_cached');

    setSessionDownloadBusy(room, true);
    getDownloadButtons(room).forEach((btn) => {
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toBe('hifz_room_download_working');
    });
    setSessionDownloadBusy(room, false);
    expect(getDownloadButtons(room)[0].disabled).toBe(false);
  });

  it('resolveSessionAudioUrls uses current state when matching, else loads and validates', async () => {
    stateMock.ayahsAudios = ['a1', 'a2', 'a3', 'a4'];
    await expect(resolveSessionAudioUrls(plan)).resolves.toEqual(['a1', 'a2', 'a3']);

    stateMock.currentReciter = 'other';
    loadAudioUrlsForSessionMock.mockResolvedValue(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']);
    await expect(resolveSessionAudioUrls(plan)).resolves.toEqual(['u1', 'u2', 'u3']);

    loadAudioUrlsForSessionMock.mockResolvedValue(['u1', '', 'u3', 'u4', 'u5', 'u6', 'u7']);
    await expect(resolveSessionAudioUrls(plan)).rejects.toThrow('Session audio URLs are unavailable');
  });

  it('hydrateDownloadedSessionAudio hydrates only when record and cache are valid', async () => {
    getSavedSessionDownloadMock.mockReturnValue({ urls: ['d1', 'd2', 'd3'], downloadedAt: 1 });
    stateMock.surahData = { ayahs: [{}, {}, {}, {}] };
    stateMock.ayahsAudios = ['old1', '', 'old3', 'old4'];
    isSurahCachedMock.mockResolvedValue(true);

    await hydrateDownloadedSessionAudio(plan);
    expect(stateMock.ayahsAudios).toEqual(['d1', 'd2', 'd3', 'old4']);

    isSurahCachedMock.mockResolvedValue(false);
    stateMock.ayahsAudios = ['x', 'y', 'z', 'w'];
    await hydrateDownloadedSessionAudio(plan);
    expect(stateMock.ayahsAudios).toEqual(['x', 'y', 'z', 'w']);

    getSavedSessionDownloadMock.mockReturnValue(null);
    await hydrateDownloadedSessionAudio(plan);
    expect(stateMock.ayahsAudios).toEqual(['x', 'y', 'z', 'w']);
  });
});
