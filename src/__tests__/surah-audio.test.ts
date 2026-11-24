import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, immutableMapSet } from '../state.js';
import { apiFetch, jsonFetch } from '../api-client.js';
import { getOfflinePackAudioUrls } from '../offline-pack.js';
import { getReciterById, buildAudioUrl, getTimingApiId } from '../reciters.js';
import {
  calculateAyahTimings,
  loadMp3quranAudio,
  loadApiAudio,
  getOfflinePackAudioResult,
  loadAudioUrlsForSession,
  reloadCurrentSurahAudio,
  findFallbackAudio,
  setSurahCacheEntry,
  nextLoadGeneration,
  isCurrentLoad,
  markCurrentAudio,
  currentAudioMarkers,
} from '../surah-audio.js';

vi.mock('../api-client.js', () => ({
  apiFetch: vi.fn(),
  jsonFetch: vi.fn(),
}));

vi.mock('../offline-pack.js', () => ({
  getOfflinePackAudioUrls: vi.fn(),
}));

vi.mock('../reciters.js', () => ({
  getReciterById: vi.fn(),
  buildAudioUrl: vi.fn(),
  getTimingApiId: vi.fn(),
}));

vi.mock('../i18n.js', () => ({
  __: (k: string) => k,
}));

vi.mock('../external-sources.js', () => ({
  QURAN_COM_API_BASE: 'https://api.quran.test',
}));

const ayahs = [
  { numberInSurah: 1, text: 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ الْحَمْدُ لِلَّهِ' },
  { numberInSurah: 2, text: 'رَبِّ الْعَالَمِينَ' },
];

describe('surah-audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.surahCache.clear();
    state.currentReciter = 'ar.alafasy';
    state.currentSurah = 1;
    state.surahData = { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', ayahs } as any;
    state.ayahsAudios = [];
    state.ayahTimings = [];
    (getReciterById as any).mockReturnValue({ id: 'ar.alafasy', name: 'Alafasy', source: 'api' });
    (buildAudioUrl as any).mockReturnValue('https://audio.test/1.mp3');
    (getTimingApiId as any).mockReturnValue(null);
  });

  it('tracks load generation and audio markers', () => {
    const g = nextLoadGeneration();
    expect(isCurrentLoad(g)).toBe(true);
    expect(isCurrentLoad(g - 1)).toBe(false);
    markCurrentAudio(2, 'ar.husary');
    expect(currentAudioMarkers()).toEqual({ surah: 2, reciter: 'ar.husary' });
  });

  it('calculateAyahTimings handles normal, fatiha, and empty-char cases', () => {
    const timings = calculateAyahTimings(ayahs, 2);
    expect(timings).toHaveLength(2);
    expect(timings[0]).toBeGreaterThanOrEqual(0);
    expect(timings[1]).toBeGreaterThan(timings[0]!);

    const fatiha = calculateAyahTimings([{ numberInSurah: 1, text: 'abc' } as any], 1);
    expect(fatiha).toEqual([0]);

    const empty = calculateAyahTimings([{ numberInSurah: 1, text: '---' } as any, { numberInSurah: 2, text: '...' } as any], 1);
    expect(empty).toHaveLength(2);
  });

  it('loadMp3quranAudio returns urls and fallback timings', async () => {
    const gen = nextLoadGeneration();
    const res = await loadMp3quranAudio(2, { ayahs } as any, { id: 'r', name: 'R', source: 'mp3quran' } as any, gen);
    expect(res?.audios).toEqual(['https://audio.test/1.mp3', 'https://audio.test/1.mp3']);
    expect(res?.timings.length).toBe(2);
  });

  it('loadMp3quranAudio returns null when load is stale', async () => {
    const gen = nextLoadGeneration();
    nextLoadGeneration();
    const res = await loadMp3quranAudio(2, { ayahs } as any, { id: 'r', name: 'R', source: 'mp3quran' } as any, gen);
    expect(res).toBeNull();
  });

  it('loadMp3quranAudio uses timing API when available', async () => {
    (getTimingApiId as any).mockReturnValue(7);
    (jsonFetch as any).mockResolvedValue({
      audio_file: {
        timestamps: [
          { timestamp_from: 0, timestamp_to: 1000 },
          { timestamp_from: 1000, timestamp_to: 2000 },
        ],
      },
    });
    const gen = nextLoadGeneration();
    const res = await loadMp3quranAudio(2, { ayahs } as any, { id: 'r', name: 'R', source: 'mp3quran' } as any, gen);
    expect(res?.timings).toEqual([0, 0.5]);
  });

  it('loadApiAudio returns audios and handles stale/no-data/error', async () => {
    const gen = nextLoadGeneration();
    (apiFetch as any).mockResolvedValue({ data: { ayahs: [{ audio: 'a1' }, { audio: null }] } });
    const res = await loadApiAudio(1, 'ar.alafasy', gen, new AbortController().signal);
    expect(res).toEqual({ audios: ['a1', null], timings: [] });

    const staleGen = nextLoadGeneration();
    nextLoadGeneration();
    (apiFetch as any).mockResolvedValue({ data: { ayahs: [{ audio: 'a1' }] } });
    expect(await loadApiAudio(1, 'ar.alafasy', staleGen, new AbortController().signal)).toBeNull();

    (apiFetch as any).mockResolvedValue({ data: { ayahs: [] } });
    expect(await loadApiAudio(1, 'ar.alafasy', nextLoadGeneration(), new AbortController().signal)).toBeNull();

    (apiFetch as any).mockRejectedValue(new Error('boom'));
    expect(await loadApiAudio(1, 'ar.alafasy', nextLoadGeneration(), new AbortController().signal)).toBeNull();
  });

  it('getOfflinePackAudioResult handles single, exact, and invalid url sets', async () => {
    (getOfflinePackAudioUrls as any).mockResolvedValue(['https://offline/full.mp3']);
    const single = await getOfflinePackAudioResult(2, { ayahs } as any);
    expect(single?.audios).toEqual(['https://offline/full.mp3', 'https://offline/full.mp3']);
    expect(single?.timings.length).toBe(2);

    (getOfflinePackAudioUrls as any).mockResolvedValue(['u1', 'u2']);
    expect(await getOfflinePackAudioResult(2, { ayahs } as any)).toEqual({ audios: ['u1', 'u2'], timings: [] });

    (getOfflinePackAudioUrls as any).mockResolvedValue(['u1']);
    const singleAyah = await getOfflinePackAudioResult(2, { ayahs: [ayahs[0]] } as any);
    expect(singleAyah?.audios).toEqual(['u1']);
    expect(singleAyah?.timings).toHaveLength(1);
    expect(typeof singleAyah?.timings[0]).toBe('number');

    (getOfflinePackAudioUrls as any).mockResolvedValue(['u1', 'u2', 'u3']);
    expect(await getOfflinePackAudioResult(2, { ayahs } as any)).toBeNull();

    (getOfflinePackAudioUrls as any).mockResolvedValue([]);
    expect(await getOfflinePackAudioResult(2, { ayahs } as any)).toBeNull();
  });

  it('loadAudioUrlsForSession supports mp3quran, api, and error fallback', async () => {
    (getReciterById as any).mockReturnValue({ id: 'm', name: 'M', source: 'mp3quran' });
    (buildAudioUrl as any).mockReturnValue('https://m/1.mp3');
    expect(await loadAudioUrlsForSession(1, 'm', 3)).toEqual(['https://m/1.mp3', 'https://m/1.mp3', 'https://m/1.mp3']);

    (buildAudioUrl as any).mockReturnValue('');
    expect(await loadAudioUrlsForSession(1, 'm', 3)).toEqual([]);

    (getReciterById as any).mockReturnValue({ id: 'a', name: 'A', source: 'api' });
    (apiFetch as any).mockResolvedValue({ data: { ayahs: [{ audio: 'a1' }, { audio: '' }] } });
    expect(await loadAudioUrlsForSession(1, 'a', 2)).toEqual(['a1', '']);

    (apiFetch as any).mockRejectedValue(new Error('net'));
    expect(await loadAudioUrlsForSession(1, 'a', 2)).toEqual([]);
  });

  it('reloadCurrentSurahAudio reloads mp3quran and api reciters', async () => {
    state.currentSurah = 2;
    state.currentReciter = 'ar.husary';
    state.surahData = { number: 2, ayahs } as any;
    (getReciterById as any).mockReturnValue({ id: 'ar.husary', name: 'Husary', source: 'mp3quran' });
    (buildAudioUrl as any).mockReturnValue('https://m/2.mp3');
    (getTimingApiId as any).mockReturnValue(null);
    await expect(reloadCurrentSurahAudio()).resolves.toBe(true);
    expect(state.ayahsAudios).toEqual(['https://m/2.mp3', 'https://m/2.mp3']);

    (buildAudioUrl as any).mockReturnValue('');
    await expect(reloadCurrentSurahAudio()).resolves.toBe(false);

    (getReciterById as any).mockReturnValue({ id: 'ar.alafasy', name: 'Alafasy', source: 'api' });
    state.currentReciter = 'ar.alafasy';
    (apiFetch as any).mockResolvedValue({ data: { ayahs: [{ audio: 'x' }, { audio: 'y' }] } });
    await expect(reloadCurrentSurahAudio()).resolves.toBe(true);
    expect(state.ayahsAudios).toEqual(['x', 'y']);

    (apiFetch as any).mockResolvedValue({ data: { ayahs: [] } });
    await expect(reloadCurrentSurahAudio()).resolves.toBe(false);

    state.surahData = null as any;
    await expect(reloadCurrentSurahAudio()).resolves.toBe(false);
  });

  it('findFallbackAudio finds cached audios by prefix', () => {
    immutableMapSet(state, 'surahCache', '2_ar.alafasy_en', { audios: ['a1', null], timings: [0, 0.5] } as any);
    expect(findFallbackAudio(2, 'ar.alafasy')).toEqual({ audios: ['a1', ''], timings: [0, 0.5] });
    expect(findFallbackAudio(3, 'ar.alafasy')).toBeNull();
  });

  it('setSurahCacheEntry refreshes recency', () => {
    setSurahCacheEntry('k1', { text: 1 } as any);
    setSurahCacheEntry('k2', { text: 2 } as any);
    setSurahCacheEntry('k1', { text: 3 } as any);
    expect(Array.from(state.surahCache.keys())).toEqual(['k2', 'k1']);
  });
});
