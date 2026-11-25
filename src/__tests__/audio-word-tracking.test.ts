import { describe, it, expect, beforeEach, vi } from 'vitest';

const { stateMock, domMock } = vi.hoisted(() => ({
  stateMock: { currentAyahIndex: 0, currentReciter: 'ar.alafasy', surahData: { ayahs: [{}] } as any },
  domMock: { audioPlayer: null as any },
}));

vi.mock('../state.js', () => ({ state: stateMock }));
vi.mock('../dom.js', () => ({ dom: domMock }));

import {
  initWordTrackingHost,
  startWordTracking,
  stopWordTracking,
  clearWordWeightsCache,
  resetWordTrackingDomCache,
  onTimeUpdate,
  onSeeking,
} from '../features/audio/audio-word-tracking.js';

function makeHost(overrides: Partial<{ advancing: boolean; timings: boolean; start: number; end: number; onBoundary: any }> = {}) {
  const onBoundary = overrides.onBoundary || vi.fn();
  initWordTrackingHost({
    isAutoAdvancing: () => overrides.advancing ?? false,
    hasTimings: () => overrides.timings ?? false,
    getAyahStartTime: () => overrides.start ?? 0,
    getAyahEndTime: () => overrides.end ?? 10,
    onAyahBoundary: onBoundary,
  });
  return { onBoundary };
}

function setupAyah(words: string[], index = 0) {
  document.body.innerHTML = `<div class="ayah" data-index="${index}">${words.map((w) => `<span class="word">${w}</span>`).join('')}</div>`;
  stateMock.currentAyahIndex = index;
  stateMock.surahData = { ayahs: words.length ? [{}] : [] };
}

describe('audio-word-tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    stateMock.currentAyahIndex = 0;
    stateMock.currentReciter = 'ar.alafasy';
    stateMock.surahData = { ayahs: [{}] } as any;
    domMock.audioPlayer = { currentTime: 0, duration: 10, playbackRate: 1 };
    clearWordWeightsCache();
    resetWordTrackingDomCache();
    stopWordTracking();
    makeHost();
  });

  it('ignores updates when host missing conditions or not active', () => {
    initWordTrackingHost(null as any);
    onTimeUpdate();
    startWordTracking();
    makeHost({ advancing: true });
    onTimeUpdate();
    makeHost();
    domMock.audioPlayer = null;
    onTimeUpdate();
    domMock.audioPlayer = { currentTime: 0, duration: NaN, playbackRate: 1 };
    onTimeUpdate();
    domMock.audioPlayer = { currentTime: 0, duration: 10, playbackRate: 1 };
    stateMock.surahData = null;
    onTimeUpdate();
    expect(document.querySelectorAll('.current-word')).toHaveLength(0);
  });

  it('tracks words and paints diff forward', () => {
    setupAyah(['بِسْمِ', 'اللَّهِ', 'الرَّحْمَنِ', 'الرَّحِيمِ']);
    startWordTracking();
    domMock.audioPlayer.currentTime = 0;
    onTimeUpdate();
    expect(document.querySelectorAll('.current-word').length).toBeGreaterThanOrEqual(1);

    domMock.audioPlayer.currentTime = 9.9;
    onTimeUpdate();
    const words = document.querySelectorAll('.word');
    expect(words[words.length - 1].classList.contains('current-word')).toBe(true);
  });

  it('handles seeking and backward diff', () => {
    setupAyah(['كلمة', 'كلمة', 'كلمة', 'كلمة']);
    startWordTracking();
    domMock.audioPlayer.currentTime = 9;
    onTimeUpdate();
    expect(document.querySelectorAll('.current-word').length).toBe(4);

    domMock.audioPlayer.currentTime = 0;
    onTimeUpdate();
    expect(document.querySelectorAll('.current-word').length).toBeLessThan(4);

    onSeeking();
    expect(document.querySelectorAll('.current-word')).toHaveLength(0);
    onSeeking(); // inactive guard path after stop? no, still active
    stopWordTracking();
    onSeeking(); // should return early when inactive
  });

  it('handles mp3quran timings, boundary, and negative adjusted time', () => {
    setupAyah(['واحد', 'اثنان']);
    const { onBoundary } = makeHost({ timings: true, start: 5, end: 15 });
    startWordTracking();

    domMock.audioPlayer.currentTime = 14.9;
    onTimeUpdate();
    expect(onBoundary).toHaveBeenCalled();

    onBoundary.mockClear();
    domMock.audioPlayer.currentTime = 4; // before ayah start -> adjusted negative
    onTimeUpdate();
    expect(onBoundary).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.current-word').length).toBeGreaterThanOrEqual(1);
  });

  it('returns when no word data and re-queries on detached nodes/cache reset', () => {
    setupAyah([]);
    startWordTracking();
    onTimeUpdate();
    expect(document.querySelectorAll('.current-word')).toHaveLength(0);

    setupAyah(['أ', 'ب', 'ج']);
    domMock.audioPlayer.currentTime = 9;
    onTimeUpdate();
    expect(document.querySelectorAll('.current-word').length).toBe(3);

    // simulate detached/re-rendered nodes with same index
    document.body.innerHTML = `<div class="ayah" data-index="0"><span class="word">أ</span><span class="word">ب</span><span class="word">ج</span></div>`;
    domMock.audioPlayer.currentTime = 0;
    onTimeUpdate();
    expect(document.querySelectorAll('.current-word').length).toBeGreaterThanOrEqual(1);

    resetWordTrackingDomCache();
    clearWordWeightsCache();
    domMock.audioPlayer.currentTime = 5;
    onTimeUpdate();
    expect(document.querySelectorAll('.current-word').length).toBeGreaterThanOrEqual(1);
  });
});
