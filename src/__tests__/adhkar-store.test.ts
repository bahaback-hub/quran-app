import { describe, it, expect, vi, beforeEach } from 'vitest';

const { stateMock, storageSetMock, mockData } = vi.hoisted(() => ({
  stateMock: { adhkarSettings: { adhkar_enabled: true } as any },
  storageSetMock: vi.fn(),
  mockData: {
    categories: [
      { id: 'morning', defaultTime: '06:00', defaultDuration: 1, items: [{ id: 'm1' }, { id: 'm2' }] },
      { id: 'evening', items: [{ id: 'e1' }] },
    ],
  },
}));

vi.mock('../state.js', () => ({ state: stateMock }));
vi.mock('../storage.js', () => ({ storage: { set: (...a: any[]) => (storageSetMock as any)(...a) } }));
vi.mock('../adhkar-data.js', () => ({ ADHKAR_DATA: mockData }));

import { getDefaultAdhkarSettings, cloneAdhkarSettings, saveAdhkarSettings } from '../adhkar-store.js';

describe('adhkar-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateMock.adhkarSettings = { adhkar_enabled: true };
  });

  it('builds default settings from adhkar data', () => {
    const s = getDefaultAdhkarSettings() as any;
    expect(s.adhkar_enabled).toBe(false);
    expect(s.adhkar_sound).toBe(false);
    expect(s.personal_adhkar).toEqual([]);
    expect(s.morning).toEqual({ enabled: true, time: '06:00', duration: 1 });
    expect(s.evening).toEqual({ enabled: true, time: '', duration: 1 });
    expect(s.item_m1).toBe(0);
    expect(s.item_e1).toBe(0);
  });

  it('cloneAdhkarSettings returns default when null and clones when present', () => {
    const def = cloneAdhkarSettings(null) as any;
    expect(def.adhkar_enabled).toBe(false);

    const original = { adhkar_enabled: true, nested: { a: 1 } } as any;
    const cloned = cloneAdhkarSettings(original) as any;
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);

    const oldSC = globalThis.structuredClone;
    // @ts-expect-error testing fallback
    globalThis.structuredClone = undefined;
    const cloned2 = cloneAdhkarSettings(original) as any;
    expect(cloned2).toEqual(original);
    globalThis.structuredClone = oldSC;
  });

  it('saveAdhkarSettings persists current state', () => {
    saveAdhkarSettings();
    expect(storageSetMock).toHaveBeenCalledWith('adhkar_settings', stateMock.adhkarSettings);
  });
});
