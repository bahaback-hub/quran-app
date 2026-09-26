/**
 * Tests — Native azan notifications.
 *
 * The azan alert previously relied on the Web Notification API, which an
 * Android WebView does not expose, and on an in-page banner that only exists
 * while the app is open. So on a phone there was no notification at all, and
 * nothing once the app was closed. These tests pin the native scheduling that
 * replaced it — including the parts that are easy to get wrong: timezone
 * suffixes in the time strings, skipping a time that already passed today,
 * honouring the independent Fajr opt-out, and never touching the web build.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const isNativePlatform = vi.fn(() => true);
const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const getPending = vi.fn();
const schedule = vi.fn();
const cancel = vi.fn();
const createChannel = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    getPending: () => getPending(),
    schedule: (opts: unknown) => schedule(opts),
    cancel: (opts: unknown) => cancel(opts),
    createChannel: (opts: unknown) => createChannel(opts),
  },
}));

vi.mock('../../error-boundary.js', () => ({
  warnRecoverable: vi.fn(),
}));

type Notification = {
  id: number;
  title: string;
  body: string;
  schedule?: { at: Date; allowWhileIdle: boolean };
  channelId: string;
  smallIcon: string;
  extra?: Record<string, unknown>;
};

function scheduledFrom(mock: typeof schedule): Notification[] {
  const arg = mock.mock.calls.at(-1)?.[0] as { notifications: Notification[] };
  return arg?.notifications ?? [];
}

async function load() {
  return import('../features/prayer/azan-notifications.js');
}

describe('azan notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The module memoises "channel created" and "permission already asked"
    // per session, so each test needs a fresh copy of it.
    vi.resetModules();
    isNativePlatform.mockReturnValue(true);
    checkPermissions.mockResolvedValue({ display: 'granted' });
    getPending.mockResolvedValue({ notifications: [] });
    schedule.mockResolvedValue(undefined);
    cancel.mockResolvedValue(undefined);
    createChannel.mockResolvedValue('azan');
  });

  it('schedules one notification per upcoming prayer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T03:00:00'));
    const mod = await load();

    await mod.scheduleAzanNotifications({
      times: { Fajr: '04:55', Dhuhr: '12:14', Asr: '15:39', Maghrib: '18:15', Isha: '19:45' },
      label: (k) => ` prayer ${k}`,
      title: 'Prayer time',
      includeFajr: true,
    });
    vi.useRealTimers();

    const queued = scheduledFrom(schedule);
    // Sunrise is not a prayer and must never be scheduled.
    expect(queued).toHaveLength(5);
    expect(queued.every((n) => n.schedule?.allowWhileIdle)).toBe(true);
    expect(queued.every((n) => n.channelId === 'azan')).toBe(true);
    expect(queued.every((n) => n.smallIcon === 'ic_stat_azan')).toBe(true);
    expect(queued.every((n) => n.extra?.['kind'] === 'azan')).toBe(true);
  });

  it('rolls a prayer that already passed today over to tomorrow', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T20:00:00'));
    const mod = await load();

    await mod.scheduleAzanNotifications({
      times: { Fajr: '04:55', Dhuhr: '12:14', Asr: '15:39', Maghrib: '18:15', Isha: '19:45' },
      label: (k) => k,
      title: 't',
      includeFajr: true,
    });
    vi.useRealTimers();

    const queued = scheduledFrom(schedule);
    for (const n of queued) {
      expect(n.schedule?.at.getTime()).toBeGreaterThan(Date.now());
    }
    // Isha (19:45) has passed at 20:00, so every remaining prayer is tomorrow.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(queued.find((n) => n.body === 'Isha')?.schedule?.at.getDate()).toBe(tomorrow.getDate());
  });

  it('honours the independent Fajr opt-out', async () => {
    const mod = await load();
    await mod.scheduleAzanNotifications({
      times: { Fajr: '04:55', Dhuhr: '12:14', Asr: '15:39', Maghrib: '18:15', Isha: '19:45' },
      label: (k) => k,
      title: 't',
      includeFajr: false,
    });

    const bodies = scheduledFrom(schedule).map((n) => n.body);
    expect(bodies).not.toContain('Fajr');
    expect(bodies).toHaveLength(4);
  });

  it('tolerates the timezone suffix the sources append to times', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T03:00:00'));
    const mod = await load();

    await mod.scheduleAzanNotifications({
      times: { Fajr: '04:55 (EEST)', Dhuhr: '12:14 +03:00' },
      label: (k) => k,
      title: 't',
      includeFajr: true,
    });
    vi.useRealTimers();

    const fajr = scheduledFrom(schedule).find((n) => n.body === 'Fajr');
    expect(fajr?.schedule?.at.getHours()).toBe(4);
    expect(fajr?.schedule?.at.getMinutes()).toBe(55);
  });

  it('cancels stale pending notifications when the schedule changes', async () => {
    getPending.mockResolvedValue({
      notifications: [{ id: 9_000_000, extra: { kind: 'azan', prayer: 'Isha' } }],
    });
    const mod = await load();

    await mod.scheduleAzanNotifications({
      times: { Dhuhr: '12:14' },
      label: (k) => k,
      title: 't',
      includeFajr: false,
    });

    expect(cancel).toHaveBeenCalledTimes(1);
    const cancelled = (cancel.mock.calls[0]?.[0] as { notifications: { id: number }[] }).notifications;
    expect(cancelled.map((n) => n.id)).toEqual([9_000_000]);
  });

  it('leaves unrelated pending notifications alone', async () => {
    getPending.mockResolvedValue({
      notifications: [{ id: 42, extra: { kind: 'something-else' } }],
    });
    const mod = await load();

    await mod.scheduleAzanNotifications({
      times: { Dhuhr: '12:14' },
      label: (k) => k,
      title: 't',
      includeFajr: false,
    });

    expect(cancel).not.toHaveBeenCalled();
  });

  it('requests permission once and gives up when denied', async () => {
    checkPermissions.mockResolvedValue({ display: 'denied' });
    requestPermissions.mockResolvedValue({ display: 'denied' });
    const mod = await load();

    await mod.notifyAzanNow('t', 'b');
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(schedule).not.toHaveBeenCalled();

    await mod.notifyAzanNow('t', 'b');
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('creates the channel before the first notification', async () => {
    const mod = await load();
    await mod.notifyAzanNow('t', 'b');

    expect(createChannel).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all on the web build', async () => {
    isNativePlatform.mockReturnValue(false);
    const mod = await load();

    await mod.notifyAzanNow('t', 'b');
    await mod.scheduleAzanNotifications({
      times: { Dhuhr: '12:14' },
      label: (k) => k,
      title: 't',
      includeFajr: false,
    });
    await mod.cancelAzanNotifications();

    expect(checkPermissions).not.toHaveBeenCalled();
    expect(createChannel).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('swallows a scheduling failure instead of breaking the prayer timer', async () => {
    schedule.mockRejectedValue(new Error('alarm not permitted'));
    const mod = await load();

    await expect(
      mod.scheduleAzanNotifications({
        times: { Dhuhr: '12:14' },
        label: (k) => k,
        title: 't',
        includeFajr: false,
      }),
    ).resolves.toBeUndefined();
  });
});
