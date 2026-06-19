/**
 * Tests for adhkar-notifications.ts — Notification scheduling, timer management, and adhkar time checking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AdhkarCategorySettings, PersonalAdhkarEntry } from '../types.js';

// Mock dependencies
vi.mock('../state.js', () => ({
  state: {
    adhkarSettings: null as any,
    firedAdhkarToday: new Set(), firedAdhkarDate: null,
  },
}));

vi.mock('../dom.js', () => ({
  dom: {
    adhkarNotification: null as HTMLElement | null,
    adhkarNotifIcon: null as HTMLElement | null,
    adhkarNotifTitle: null as HTMLElement | null,
    adhkarNotifText: null as HTMLElement | null,
    adhkarNotifProgress: null as HTMLElement | null,
    adhkarNotifShareBtn: null as HTMLElement | null,
  },
}));

vi.mock('../ui.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('../i18n.js', () => ({
  __: (key: string) => key,
}));

vi.mock('../adhkar-data.js', () => ({
  ADHKAR_DATA: {
    categories: [
      {
        id: 'morning',
        icon: '🌅',
        name: 'أذكار الصباح',
        defaultTime: '05:00',
        defaultDuration: 1,
        items: [
          { id: 'm1', text: 'آية الكرسي', count: 1, reference: 'البقرة 255' },
          { id: 'm2', text: 'قل هو الله أحد', count: 3, reference: 'الإخلاص' },
        ],
      },
      {
        id: 'evening',
        icon: '🌙',
        name: 'أذكار المساء',
        defaultTime: '17:00',
        defaultDuration: 1,
        items: [
          { id: 'e1', text: 'أعوذ بكلمات الله', count: 3, reference: 'البخاري' },
        ],
      },
    ],
  },
}));

vi.mock('../internal-state.js', () => {
  let _timer: ReturnType<typeof setTimeout> | null = null;
  let _interval: ReturnType<typeof setInterval> | null = null;
  let _audioCtx: AudioContext | null = null;
  return {
    getAdhkarNotificationTimer: vi.fn(() => _timer),
    setAdhkarNotificationTimer: vi.fn((val) => { _timer = val; }),
    getAdhkarIntervalId: vi.fn(() => _interval),
    setAdhkarIntervalId: vi.fn((val) => { _interval = val; }),
    getAdhkarAudioCtx: vi.fn(() => _audioCtx),
    setAdhkarAudioCtx: vi.fn((val) => { _audioCtx = val; }),
  };
});

import { state } from '../state.js';
import { dom } from '../dom.js';
import { showToast } from '../ui.js';
import { copyToClipboard } from '../utils.js';
import {
  getAdhkarNotificationTimer,
  setAdhkarNotificationTimer,
  getAdhkarIntervalId,
  setAdhkarIntervalId,
  getAdhkarAudioCtx,
  setAdhkarAudioCtx,
} from '../internal-state.js';
import {
  checkAdhkarNotifications,
  showAdhkarNotification,
  dismissAdhkarNotification,
  renderNotifAdhkarText,
  startAdhkarNotificationScheduler,
  stopAdhkarNotificationScheduler,
} from '../adhkar-notifications.js';

describe('adhkar-notifications', () => {
  let clearTimeoutSpy: any;
  let clearIntervalSpy: any;
  let setIntervalSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset state
    state.adhkarSettings = null;
    state.firedAdhkarToday = new Set(); state.firedAdhkarDate = null;
    // Reset dom mocks
    (dom as any).adhkarNotification = null;
    (dom as any).adhkarNotifIcon = null;
    (dom as any).adhkarNotifTitle = null;
    (dom as any).adhkarNotifText = null;
    (dom as any).adhkarNotifProgress = null;
    (dom as any).adhkarNotifShareBtn = null;
    // Spy on timer functions
    clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
  });

  afterEach(() => {
    vi.useRealTimers();
    clearTimeoutSpy?.mockRestore();
    clearIntervalSpy?.mockRestore();
    setIntervalSpy?.mockRestore();
  });

  /* ===================== checkAdhkarNotifications ===================== */

  describe('checkAdhkarNotifications', () => {
    it('should return early when adhkarSettings is null', () => {
      state.adhkarSettings = null;
      checkAdhkarNotifications();
      expect(dom.adhkarNotification).toBeNull();
    });

    it('should return early when adhkar_enabled is false', () => {
      state.adhkarSettings = { adhkar_enabled: false } as any;
      checkAdhkarNotifications();
      expect(dom.adhkarNotification).toBeNull();
    });

    it('should skip categories that are not enabled', () => {
      const now = new Date();
      now.setHours(5, 0, 0, 0);
      vi.setSystemTime(now);

      state.adhkarSettings = {
        adhkar_enabled: true,
        morning: { enabled: false },
      } as any;
      checkAdhkarNotifications();
      // FIX: Set-based tracking — should be empty (no fire)
      expect(state.firedAdhkarToday.size).toBe(0);
    });

    it('should fire notification when time matches for enabled category', () => {
      const now = new Date();
      now.setHours(5, 0, 0, 0);
      vi.setSystemTime(now);

      state.adhkarSettings = {
        adhkar_enabled: true,
        morning: { enabled: true, time: '05:00', duration: 1 },
        adhkar_sound: false,
      } as any;

      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {},
        dataset: {},
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} };

      checkAdhkarNotifications();
      // FIX: Set-based tracking — should contain morning key
      expect([...state.firedAdhkarToday].some((k) => k.includes('morning'))).toBe(true);
    });

    it('should not fire again for the same category on the same day', () => {
      const now = new Date();
      now.setHours(5, 0, 0, 0);
      vi.setSystemTime(now);

      state.adhkarSettings = {
        adhkar_enabled: true,
        morning: { enabled: true, time: '05:00', duration: 1 },
        adhkar_sound: false,
      } as any;

      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {},
        dataset: {},
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} };

      checkAdhkarNotifications();
      const firstSize = state.firedAdhkarToday.size;
      const firstKeys = [...state.firedAdhkarToday];

      checkAdhkarNotifications();
      // FIX: Set should not grow on second check (no duplicate fire)
      expect(state.firedAdhkarToday.size).toBe(firstSize);
      expect([...state.firedAdhkarToday]).toEqual(firstKeys);
    });

    it('should check personal adhkar entries', () => {
      const now = new Date();
      now.setHours(7, 30, 0, 0);
      vi.setSystemTime(now);

      state.adhkarSettings = {
        adhkar_enabled: true,
        morning: { enabled: false },
        evening: { enabled: false },
        personal_adhkar: [
          { id: 'p1', text: 'My adhkar', time: '07:30', duration: 1, count: 1 },
        ],
        adhkar_sound: false,
      } as any;

      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {},
        dataset: {},
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} };

      checkAdhkarNotifications();
      expect([...state.firedAdhkarToday].some((k) => k.includes('personal_p1'))).toBe(true);
    });

    it('should skip personal adhkar without a time', () => {
      const now = new Date();
      now.setHours(7, 30, 0, 0);
      vi.setSystemTime(now);

      state.adhkarSettings = {
        adhkar_enabled: true,
        morning: { enabled: false },
        evening: { enabled: false },
        personal_adhkar: [
          { id: 'p1', text: 'My adhkar', time: null, duration: 1, count: 1 },
        ],
      } as any;

      checkAdhkarNotifications();
      // FIX: Set should be empty (personal adhkar without time is skipped)
      expect(state.firedAdhkarToday.size).toBe(0);
    });

    it('FIX #1: should fire BOTH morning and evening when both are due (no early return)', () => {
      const now = new Date();
      now.setHours(17, 0, 0, 0); // 5 PM — past both 05:00 and 16:30
      vi.setSystemTime(now);

      state.adhkarSettings = {
        adhkar_enabled: true,
        morning: { enabled: true, time: '05:00', duration: 1 },
        evening: { enabled: true, time: '16:30', duration: 1 },
        adhkar_sound: false,
      } as any;

      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {},
        dataset: {},
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} };

      checkAdhkarNotifications();
      // FIX #2: Both morning AND evening should fire in single check (no early return)
      expect(state.firedAdhkarToday.size).toBe(2);
      expect([...state.firedAdhkarToday].some((k) => k.startsWith('morning_'))).toBe(true);
      expect([...state.firedAdhkarToday].some((k) => k.startsWith('evening_'))).toBe(true);
    });

    it('FIX #1: should NOT re-fire on subsequent 30s checks (the main bug)', () => {
      const now = new Date();
      now.setHours(17, 0, 0, 0);
      vi.setSystemTime(now);

      state.adhkarSettings = {
        adhkar_enabled: true,
        morning: { enabled: true, time: '05:00', duration: 1 },
        evening: { enabled: true, time: '16:30', duration: 1 },
        adhkar_sound: false,
      } as any;

      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {},
        dataset: {},
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} };

      // First check — both fire
      checkAdhkarNotifications();
      expect(state.firedAdhkarToday.size).toBe(2);

      // Simulate 30s passing (scheduler interval)
      vi.advanceTimersByTime(30_000);

      // Second check — should NOT fire again (the bug was: it WOULD re-fire alternating)
      checkAdhkarNotifications();
      expect(state.firedAdhkarToday.size).toBe(2);

      // Third check — still 2
      vi.advanceTimersByTime(30_000);
      checkAdhkarNotifications();
      expect(state.firedAdhkarToday.size).toBe(2);

      // After 1 minute total — still 2 (no duplicates)
      vi.advanceTimersByTime(60_000);
      checkAdhkarNotifications();
      expect(state.firedAdhkarToday.size).toBe(2);
    });

    it('FIX #3: should fire personal adhkar in same check as categories (no delay)', () => {
      const now = new Date();
      now.setHours(7, 30, 0, 0);
      vi.setSystemTime(now);

      state.adhkarSettings = {
        adhkar_enabled: true,
        morning: { enabled: true, time: '05:00', duration: 1 },
        evening: { enabled: false },
        personal_adhkar: [
          { id: 'p1', text: 'Personal 1', time: '07:30', duration: 1, count: 1 },
          { id: 'p2', text: 'Personal 2', time: '07:30', duration: 1, count: 1 },
        ],
        adhkar_sound: false,
      } as any;

      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {},
        dataset: {},
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} };

      checkAdhkarNotifications();
      // FIX #3: morning + p1 + p2 all fire in single check (no 30s delay between)
      expect(state.firedAdhkarToday.size).toBe(3);
    });

    it('FIX #1: should reset fired set on a new day', () => {
      const day1 = new Date();
      day1.setHours(5, 0, 0, 0);
      vi.setSystemTime(day1);

      state.adhkarSettings = {
        adhkar_enabled: true,
        morning: { enabled: true, time: '05:00', duration: 1 },
        adhkar_sound: false,
      } as any;

      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {},
        dataset: {},
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} };

      // Day 1 — fire
      checkAdhkarNotifications();
      expect(state.firedAdhkarToday.size).toBe(1);

      // Advance to next day
      const day2 = new Date(day1);
      day2.setDate(day2.getDate() + 1);
      day2.setHours(5, 0, 0, 0);
      vi.setSystemTime(day2);

      // Day 2 — Set should reset and fire again
      checkAdhkarNotifications();
      expect(state.firedAdhkarToday.size).toBe(1);
      expect([...state.firedAdhkarToday][0]).toContain(day2.toDateString());
    });
  });

  /* ===================== showAdhkarNotification ===================== */

  describe('showAdhkarNotification', () => {
    beforeEach(() => {
      state.adhkarSettings = {
        adhkar_enabled: true,
        adhkar_sound: false,
        item_m1: 0,
        item_m2: 0,
      } as any;
    });

    it('should return early when adhkarNotification dom element is null', () => {
      (dom as any).adhkarNotification = null;
      showAdhkarNotification({ id: 'morning', icon: '🌅', name: 'أذكار الصباح' });
    });

    it('should show notification and set properties', () => {
      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {} as any,
        dataset: {} as any,
      };
      const iconEl = { textContent: '' };
      const titleEl = { textContent: '' };
      const textEl = { textContent: '' };
      const progressEl = { textContent: '' };
      const shareBtn = { style: {} as any, onclick: null as any };

      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifIcon = iconEl;
      (dom as any).adhkarNotifTitle = titleEl;
      (dom as any).adhkarNotifText = textEl;
      (dom as any).adhkarNotifProgress = progressEl;
      (dom as any).adhkarNotifShareBtn = shareBtn;

      showAdhkarNotification({ id: 'morning', icon: '🌅', name: 'أذكار الصباح' });

      expect(iconEl.textContent).toBe('🌅');
      expect(titleEl.textContent).toBe('🕌 أذكار الصباح');
      expect(notifEl.classList.remove).toHaveBeenCalledWith('hidden');
      expect(notifEl.style.display).toBe('flex');
    });

    it('should clear existing timer before setting new one', () => {
      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {} as any,
        dataset: {} as any,
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} as any };

      const fakeTimer = setTimeout(() => {}, 99999) as unknown as ReturnType<typeof setTimeout>;
      (getAdhkarNotificationTimer as any).mockReturnValue(fakeTimer);

      showAdhkarNotification({ id: 'morning', icon: '🌅', name: 'أذكار الصباح' });
      expect(clearTimeoutSpy).toHaveBeenCalledWith(fakeTimer);
    });

    it('should auto-hide notification after duration', () => {
      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {} as any,
        dataset: {} as any,
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} as any };

      showAdhkarNotification({ id: 'morning', icon: '🌅', name: 'أذكار الصباح' }, 1);

      vi.advanceTimersByTime(60_000);

      expect(notifEl.classList.add).toHaveBeenCalledWith('hidden');
      expect(notifEl.style.display).toBe('none');
    });

    it('should play notification sound when adhkar_sound is enabled', () => {
      state.adhkarSettings = {
        adhkar_enabled: true,
        adhkar_sound: true,
        item_m1: 0,
        item_m2: 0,
      } as any;

      const notifEl = {
        classList: { remove: vi.fn(), add: vi.fn() },
        style: {} as any,
        dataset: {} as any,
      };
      (dom as any).adhkarNotification = notifEl;
      (dom as any).adhkarNotifText = { textContent: '' };
      (dom as any).adhkarNotifProgress = { textContent: '' };
      (dom as any).adhkarNotifShareBtn = { style: {} as any };

      // Mock AudioContext as a constructor function
      const mockOscillator = {
        type: '',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      const mockGain = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      const mockCtx = {
        currentTime: 0,
        createOscillator: vi.fn(() => mockOscillator),
        createGain: vi.fn(() => mockGain),
        destination: {},
        close: vi.fn(),
      };

      (getAdhkarAudioCtx as any).mockReturnValue(null);
      // Use a function declaration so it can be called with `new`
      const MockAudioContext = vi.fn(function (this: any) {
        return mockCtx;
      });
      (window as any).AudioContext = MockAudioContext;
      (window as any).webkitAudioContext = MockAudioContext;

      showAdhkarNotification({ id: 'morning', icon: '🌅', name: 'أذكار الصباح' });

      expect(MockAudioContext).toHaveBeenCalled();
      expect(setAdhkarAudioCtx).toHaveBeenCalled();
    });
  });

  /* ===================== dismissAdhkarNotification ===================== */

  describe('dismissAdhkarNotification', () => {
    it('should hide notification element', () => {
      const notifEl = {
        classList: { add: vi.fn() },
        style: {} as any,
      };
      (dom as any).adhkarNotification = notifEl;

      dismissAdhkarNotification();
      expect(notifEl.classList.add).toHaveBeenCalledWith('hidden');
      expect(notifEl.style.display).toBe('none');
    });

    it('should clear timer and set to null', () => {
      const fakeTimer = setTimeout(() => {}, 99999) as unknown as ReturnType<typeof setTimeout>;
      (getAdhkarNotificationTimer as any).mockReturnValue(fakeTimer);

      dismissAdhkarNotification();
      expect(clearTimeoutSpy).toHaveBeenCalledWith(fakeTimer);
      expect(setAdhkarNotificationTimer).toHaveBeenCalledWith(null);
    });

    it('should handle null timer gracefully', () => {
      (getAdhkarNotificationTimer as any).mockReturnValue(null);
      expect(() => dismissAdhkarNotification()).not.toThrow();
    });

    it('should handle null dom.adhkarNotification gracefully', () => {
      (dom as any).adhkarNotification = null;
      (getAdhkarNotificationTimer as any).mockReturnValue(null);
      expect(() => dismissAdhkarNotification()).not.toThrow();
    });
  });

  /* ===================== renderNotifAdhkarText ===================== */

  describe('renderNotifAdhkarText', () => {
    it('should return early when adhkarNotifText is null', () => {
      (dom as any).adhkarNotifText = null;
      expect(() => renderNotifAdhkarText({ id: 'morning', icon: '🌅', name: 'أذكار الصباح' })).not.toThrow();
    });

    it('should render personal adhkar text directly', () => {
      const textEl = { textContent: '' };
      const progressEl = { textContent: '' };
      const shareBtn = { style: {} as any, onclick: null as any };

      (dom as any).adhkarNotifText = textEl;
      (dom as any).adhkarNotifProgress = progressEl;
      (dom as any).adhkarNotifShareBtn = shareBtn;

      renderNotifAdhkarText({ id: 'personal', icon: '📝', name: 'My custom adhkar' });

      expect(textEl.textContent).toBe('My custom adhkar');
      expect(progressEl.textContent).toBe('');
    });

    it('should render category items with incomplete counts', () => {
      // Item counters at top level of adhkarSettings
      state.adhkarSettings = {
        item_m1: 0,  // 0 < 1 → incomplete
        item_m2: 0,  // 0 < 3 → incomplete
      } as any;

      const textEl = { textContent: '' };
      const progressEl = { textContent: '' };
      const shareBtn = { style: {} as any, onclick: null as any };

      (dom as any).adhkarNotifText = textEl;
      (dom as any).adhkarNotifProgress = progressEl;
      (dom as any).adhkarNotifShareBtn = shareBtn;

      renderNotifAdhkarText({ id: 'morning', icon: '🌅', name: 'أذكار الصباح' });

      expect(textEl.textContent).toContain('آية الكرسي');
      expect(textEl.textContent).toContain('قل هو الله أحد');
      expect(progressEl.textContent).toBe('📖 2/2');
    });

    it('should show adhkar_done when all items complete', () => {
      // Item counters are stored at the top level of adhkarSettings
      state.adhkarSettings = {
        item_m1: 1,  // m1 count is 1, so 1 >= 1 → complete
        item_m2: 3,  // m2 count is 3, so 3 >= 3 → complete
      } as any;

      const textEl = { textContent: '' };
      const progressEl = { textContent: '' };
      const shareBtn = { style: { display: '' } as any, onclick: null as any };

      (dom as any).adhkarNotifText = textEl;
      (dom as any).adhkarNotifProgress = progressEl;
      (dom as any).adhkarNotifShareBtn = shareBtn;

      renderNotifAdhkarText({ id: 'morning', icon: '🌅', name: 'أذكار الصباح' });

      expect(textEl.textContent).toBe('adhkar_done');
      expect(shareBtn.style.display).toBe('none');
    });

    it('should return early for unknown category id', () => {
      const textEl = { textContent: '' };
      (dom as any).adhkarNotifText = textEl;

      renderNotifAdhkarText({ id: 'unknown', icon: '❓', name: 'Unknown' });

      expect(textEl.textContent).toBe('');
    });

    it('should set share button display to inline-block when items incomplete', () => {
      state.adhkarSettings = {
        item_m1: 0,
        item_m2: 0,
      } as any;

      const textEl = { textContent: '' };
      const progressEl = { textContent: '' };
      const shareBtn = { style: {} as any, onclick: null as any };

      (dom as any).adhkarNotifText = textEl;
      (dom as any).adhkarNotifProgress = progressEl;
      (dom as any).adhkarNotifShareBtn = shareBtn;

      renderNotifAdhkarText({ id: 'morning', icon: '🌅', name: 'أذكار الصباح' });

      expect(shareBtn.style.display).toBe('inline-block');
    });
  });

  /* ===================== startAdhkarNotificationScheduler ===================== */

  describe('startAdhkarNotificationScheduler', () => {
    it('should clear existing interval before starting new one', () => {
      const fakeInterval = setInterval(() => {}, 99999) as unknown as ReturnType<typeof setInterval>;
      (getAdhkarIntervalId as any).mockReturnValue(fakeInterval);

      startAdhkarNotificationScheduler();
      expect(clearIntervalSpy).toHaveBeenCalledWith(fakeInterval);
    });

    it('should call checkAdhkarNotifications immediately and set interval', () => {
      (getAdhkarIntervalId as any).mockReturnValue(null);
      startAdhkarNotificationScheduler();
      expect(setAdhkarIntervalId).toHaveBeenCalled();
    });

    it('should set up a 30-second interval', () => {
      (getAdhkarIntervalId as any).mockReturnValue(null);
      startAdhkarNotificationScheduler();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);
    });
  });

  /* ===================== stopAdhkarNotificationScheduler ===================== */

  describe('stopAdhkarNotificationScheduler', () => {
    it('should clear interval and set to null', () => {
      const fakeInterval = setInterval(() => {}, 99999) as unknown as ReturnType<typeof setInterval>;
      (getAdhkarIntervalId as any).mockReturnValue(fakeInterval);

      stopAdhkarNotificationScheduler();
      expect(clearIntervalSpy).toHaveBeenCalledWith(fakeInterval);
      expect(setAdhkarIntervalId).toHaveBeenCalledWith(null);
    });

    it('should do nothing when interval id is null', () => {
      (getAdhkarIntervalId as any).mockReturnValue(null);
      stopAdhkarNotificationScheduler();
      expect(clearIntervalSpy).not.toHaveBeenCalled();
    });
  });
});
