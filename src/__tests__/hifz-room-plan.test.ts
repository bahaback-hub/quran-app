import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockState, mockStorage, mockData } = vi.hoisted(() => {
  const data = new Map<string, unknown>();
  return {
    mockData: data,
    mockStorage: {
      get: vi.fn((key: string) => data.get(key)),
      set: vi.fn((key: string, value: unknown) => {
        data.set(key, value);
        return true;
      }),
      remove: vi.fn((key: string) => {
        data.delete(key);
      }),
    },
    mockState: {
      currentSurah: 1,
      currentAyahIndex: 0,
      currentReciter: 'ar.alafasy',
      surahData: {
        name: 'الفاتحة',
        ayahs: Array.from({ length: 7 }, (_, index) => ({ numberInSurah: index + 1, text: `آية ${index + 1}` })),
      },
      surahList: [{ number: 1, name: 'الفاتحة', numberOfAyahs: 7 }],
    },
  };
});

vi.mock('../i18n.js', () => ({ __: (key: string) => key }));
vi.mock('../state.js', () => ({ state: mockState }));
vi.mock('../storage.js', () => ({ storage: mockStorage }));
vi.mock('../reciters.js', () => ({ RECITERS: [{ id: 'ar.alafasy' }] }));

import {
  SESSION_PROGRESS_TTL_MS,
  clearSessionProgress,
  getSavedSessionProgress,
  saveSessionProgress,
  type HifzPlan,
} from '../hifz-room-plan.js';

const PROGRESS_KEY = 'hifz_session_progress_v1';

function plan(overrides: Partial<HifzPlan> = {}): HifzPlan {
  return {
    version: 1,
    surah: 1,
    from: 2,
    to: 5,
    times: 3,
    review: 'today',
    reciter: 'ar.alafasy',
    speed: 1,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

beforeEach(() => {
  mockData.clear();
  mockStorage.get.mockClear();
  mockStorage.set.mockClear();
  mockStorage.remove.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hifz session progress', () => {
  it('saves the ayah and completed repeats with the normalized plan', () => {
    saveSessionProgress(plan(), 3, 1);

    const saved = mockData.get(PROGRESS_KEY) as {
      version: number;
      plan: HifzPlan;
      ayah: number;
      repeat: number;
      updatedAt: number;
    };
    expect(saved.version).toBe(1);
    expect(saved.plan).toMatchObject({ surah: 1, from: 2, to: 5, times: 3, reciter: 'ar.alafasy' });
    expect(saved.ayah).toBe(3);
    expect(saved.repeat).toBe(1);
    expect(saved.updatedAt).toBeGreaterThan(0);
  });

  it('keeps the saved position inside the selected range and repeat count', () => {
    saveSessionProgress(plan(), 99, 99);

    const saved = mockData.get(PROGRESS_KEY) as { ayah: number; repeat: number };
    expect(saved.ayah).toBe(5);
    expect(saved.repeat).toBe(2);
  });

  it('returns the saved session while it is fresh', () => {
    saveSessionProgress(plan(), 4, 2);

    const progress = getSavedSessionProgress();
    expect(progress).toMatchObject({ ayah: 4, repeat: 2 });
    expect(progress?.plan).toMatchObject({ surah: 1, from: 2, to: 5, times: 3 });
  });

  it('ignores missing or malformed records', () => {
    expect(getSavedSessionProgress()).toBeNull();

    mockData.set(PROGRESS_KEY, { version: 2, plan: plan(), ayah: 3, repeat: 0, updatedAt: Date.now() });
    expect(getSavedSessionProgress()).toBeNull();

    mockData.set(PROGRESS_KEY, { version: 1, ayah: 3, repeat: 0, updatedAt: Date.now() });
    expect(getSavedSessionProgress()).toBeNull();
  });

  it('expires a session that has not been touched for seven days', () => {
    vi.useFakeTimers();
    const base = 1_700_000_000_000;
    vi.setSystemTime(base);
    saveSessionProgress(plan(), 3, 1);

    expect(getSavedSessionProgress(base + SESSION_PROGRESS_TTL_MS - 1)).not.toBeNull();
    expect(getSavedSessionProgress(base + SESSION_PROGRESS_TTL_MS + 1)).toBeNull();
  });

  it('pulls an out-of-range ayah back into the saved plan', () => {
    mockData.set(PROGRESS_KEY, {
      version: 1,
      plan: plan(),
      ayah: 1,
      repeat: 9,
      updatedAt: Date.now(),
    });

    expect(getSavedSessionProgress()).toMatchObject({ ayah: 2, repeat: 2 });
  });

  it('clears the saved session on request', () => {
    saveSessionProgress(plan(), 3, 0);
    clearSessionProgress();

    expect(mockStorage.remove).toHaveBeenCalledWith(PROGRESS_KEY);
    expect(getSavedSessionProgress()).toBeNull();
  });
});
