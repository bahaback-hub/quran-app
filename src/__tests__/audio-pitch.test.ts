/**
 * Behavioral tests for audio-pitch.ts — the reference-frequency (pitch) layer
 * and the lazy Web Audio graph.
 *
 * audio.test.ts already pins the frequency math through the audio.js
 * re-export. These tests cover this module's OWN surface directly, including
 * the CORS probe and graph paths that jsdom cannot reach through the barrel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockStorageGet, mockStorageSet } = vi.hoisted(() => ({
  mockStorageGet: vi.fn(),
  mockStorageSet: vi.fn(),
}));

vi.mock('../storage.js', () => ({
  storage: {
    get: mockStorageGet,
    set: mockStorageSet,
  },
}));

const { dom } = await import('../dom.js');
const {
  applyPlaybackRate,
  ensureAudioGraph,
  getEffectiveRate,
  getPitchFreq,
  pitchRatio,
  prepareElementForUrl,
  setPitchFreq,
  syncPitchControls,
  _resetPitchForTests,
} = await import('../features/audio/audio-pitch.js');

type AudioStub = HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };

function makePlayer(): AudioStub {
  const player = {
    playbackRate: 1,
    crossOrigin: null as string | null,
    attributes: {} as Record<string, string>,
    removeAttribute(name: string) {
      delete this.attributes[name];
    },
  };
  return player as unknown as AudioStub;
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = 'running';
  destination = {};
  resumed = 0;
  sourceCreatedFor: HTMLMediaElement | null = null;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume(): Promise<void> {
    this.resumed++;
    this.state = 'running';
    return Promise.resolve();
  }
  createMediaElementSource(el: HTMLMediaElement) {
    this.sourceCreatedFor = el;
    return { connect: () => {} };
  }
}

describe('audio-pitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageGet.mockReturnValue(undefined);
    dom.audioPlayer = null;
    dom.pitchSelect = null;
    dom.pitchRange = null;
    _resetPitchForTests();
    FakeAudioContext.instances = [];
    (globalThis as unknown as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
  });

  afterEach(() => {
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
    vi.unstubAllGlobals();
  });

  it('persists a clamped frequency and re-applies it live', () => {
    dom.audioPlayer = makePlayer();
    expect(setPitchFreq(700)).toBe(600);
    expect(mockStorageSet).toHaveBeenCalledWith('pitch_freq', 600);
    expect(setPitchFreq(100)).toBe(400);
    expect(setPitchFreq(432)).toBe(432);
  });

  it('getEffectiveRate falls back to speed 1 when storage has no speed', () => {
    expect(getEffectiveRate()).toBe(1);
    mockStorageGet.mockImplementation((key: string) => (key === 'pitch_freq' ? 550 : undefined));
    expect(getEffectiveRate()).toBeCloseTo(1.25, 5);
  });

  it('applyPlaybackRate is a no-op without a player element', () => {
    expect(() => applyPlaybackRate(2, 440)).not.toThrow();
  });

  it('ensureAudioGraph builds the graph once and resumes a suspended context', () => {
    const player = makePlayer();
    dom.audioPlayer = player;

    expect(ensureAudioGraph()).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0]!.sourceCreatedFor).toBe(player);

    FakeAudioContext.instances[0]!.state = 'suspended';
    expect(ensureAudioGraph()).toBe(true);
    expect(FakeAudioContext.instances[0]!.resumed).toBe(1);
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it('ensureAudioGraph reports failure when the context cannot be created', () => {
    class BrokenAudioContext {
      constructor() {
        throw new Error('no audio hardware');
      }
    }
    (globalThis as unknown as { AudioContext?: unknown }).AudioContext = BrokenAudioContext;
    dom.audioPlayer = makePlayer();

    expect(ensureAudioGraph()).toBe(false);
  });

  it('routes same-origin and blob URLs through the graph without probing', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    dom.audioPlayer = makePlayer();

    await prepareElementForUrl('blob:https://app.test/1234');
    await prepareElementForUrl(`${window.location.origin}/media/a.mp3`);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect((dom.audioPlayer as AudioStub).crossOrigin).toBe('anonymous');
  });

  it('probes a cross-origin host once and caches the verdict', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 206 });
    vi.stubGlobal('fetch', fetchSpy);
    dom.audioPlayer = makePlayer();

    await prepareElementForUrl('https://cdn.islamic.network/a.mp3');
    await prepareElementForUrl('https://cdn.islamic.network/b.mp3');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://cdn.islamic.network/a.mp3',
      expect.objectContaining({ headers: { Range: 'bytes=0-0' }, mode: 'cors' }),
    );
  });

  it('keeps the direct playback path when the host probe fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const player = makePlayer();
    dom.audioPlayer = player;

    await prepareElementForUrl('https://unreachable.test/a.mp3');

    expect(player.crossOrigin).toBeNull();
  });

  it('syncPitchControls mirrors the stored frequency into both controls', () => {
    const select = document.createElement('select');
    for (const freq of [432, 440, 480, 528, 550]) {
      const option = document.createElement('option');
      option.value = String(freq);
      select.appendChild(option);
    }
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '400';
    range.max = '600';
    range.step = '1';
    dom.pitchSelect = select;
    dom.pitchRange = range;
    mockStorageGet.mockReturnValue(480);

    syncPitchControls();

    expect(select.value).toBe('480');
    expect(range.value).toBe('480');
  });

  it('pitchRatio is target/440 and getPitchFreq rejects junk', () => {
    expect(pitchRatio(440)).toBe(1);
    expect(pitchRatio(220)).toBeCloseTo(0.5, 5);
    mockStorageGet.mockReturnValue('not-a-number');
    expect(getPitchFreq()).toBe(440);
  });
});
