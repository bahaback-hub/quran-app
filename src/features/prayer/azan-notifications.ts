/**
 * Native azan notifications.
 *
 * The azan alert used to rely on the Web `Notification` API, which an Android
 * WebView does not expose, and on an in-page banner that only exists while the
 * app is open. On a phone that meant: no banner in the shade, and nothing at
 * all once the app was closed. This module schedules real Android
 * notifications through @capacitor/local-notifications so a prayer time
 * arrives even when the app is not running.
 *
 * Every entry point is a no-op on the web, where the existing Notification API
 * and in-page banner already work, so behaviour there is unchanged.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { warnRecoverable } from '../../error-boundary.js';

const PRAYER_ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

/** Android 13+ requires an explicit runtime grant before any notification shows. */
let permissionRequested = false;

const CHANNEL_ID = 'azan';
const SMALL_ICON = 'ic_stat_azan';
let channelReady = false;

/**
 * Create the azan channel once.
 *
 * A notification aimed at a channel that does not exist is dropped by Android,
 * and the importance/sound defaults are only settable at creation time.
 */
async function ensureAzanChannel(): Promise<void> {
  if (channelReady) {
    return;
  }
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Prayer times',
      description: 'Alerts at each prayer time',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'default',
    });
    channelReady = true;
  } catch (err: unknown) {
    warnRecoverable('azan notification channel creation failed', err);
  }
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Strip the API's timezone suffix: "04:55 (EEST)" -> "04:55". */
function toMinutes(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const [h, m] = value.trim().split(' ')[0]?.split(':') ?? [];
  const hours = Number(h);
  const minutes = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function nextOccurrence(time: string | undefined, from: Date): Date | null {
  const minutes = toMinutes(time);
  if (minutes === null) {
    return null;
  }
  const at = new Date(from);
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (at.getTime() <= from.getTime()) {
    at.setDate(at.getDate() + 1);
  }
  return at;
}

/**
 * Ask for notification permission once per app session.
 *
 * Android 13+ denies notifications by default for freshly installed apps, so
 * without this every scheduled prayer would be silently dropped.
 */
export async function ensureAzanNotificationPermission(): Promise<boolean> {
  if (!isNative()) {
    return false;
  }
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') {
      return true;
    }
    if (permissionRequested && current.display === 'denied') {
      return false;
    }
    permissionRequested = true;
    const asked = await LocalNotifications.requestPermissions();
    return asked.display === 'granted';
  } catch (err: unknown) {
    warnRecoverable('azan notification permission request failed', err);
    return false;
  }
}

/** Fire a notification immediately — used by the prayer timer and the test button. */
export async function notifyAzanNow(title: string, body: string): Promise<void> {
  if (!isNative()) {
    return;
  }
  if (!(await ensureAzanNotificationPermission())) {
    return;
  }
  try {
    await ensureAzanChannel();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2_000_000_000),
          title,
          body,
          smallIcon: SMALL_ICON,
          channelId: CHANNEL_ID,
          extra: { kind: 'azan' },
        },
      ],
    });
  } catch (err: unknown) {
    warnRecoverable('azan notification failed', err);
  }
}

export interface AzanScheduleInput {
  /** Prayer name -> "HH:MM" as rendered by the prayer-times source. */
  times: Record<string, string | undefined>;
  /** Localised prayer name resolver. */
  label: (key: string) => string;
  title: string;
  /** Fajr can be opted out of independently. */
  includeFajr: boolean;
}

/**
 * Replace the pending azan notifications with one per upcoming prayer.
 *
 * Uses `replace: true` so a location or method change cannot leave a stale
 * notification queued for the old times.
 */
export async function scheduleAzanNotifications(input: AzanScheduleInput): Promise<void> {
  if (!isNative()) {
    return;
  }
  if (!(await ensureAzanNotificationPermission())) {
    return;
  }

  const now = new Date();
  const pending = await LocalNotifications.getPending();
  const mine = pending.notifications.filter((n) => n.extra?.['kind'] === 'azan');
  const mineIds = new Set(mine.map((n) => n.id));

  const wanted: Array<{ id: number; at: Date; key: string }> = [];
  let slot = 0;
  for (const key of PRAYER_ORDER) {
    if (key === 'Sunrise') {
      continue;
    }
    if (key === 'Fajr' && !input.includeFajr) {
      continue;
    }
    const at = nextOccurrence(input.times[key], now);
    if (at) {
      // Stable, collision-free ids: keep any existing azan id that maps to the
      // same prayer so Android updates it instead of stacking a duplicate.
      wanted.push({ id: 9_000_000 + slot * 97 + key.length, at, key });
      slot++;
    }
  }

  try {
    const staleIds = [...mineIds].filter((id) => !wanted.some((w) => w.id === id));
    if (staleIds.length > 0) {
      await LocalNotifications.cancel({ notifications: staleIds.map((id) => ({ id })) });
    }
    if (wanted.length === 0) {
      return;
    }
    await ensureAzanChannel();
    await LocalNotifications.schedule({
      notifications: wanted.map(({ id, at, key }) => ({
        id,
        title: input.title,
        body: input.label(key),
        schedule: { at, allowWhileIdle: true },
        smallIcon: SMALL_ICON,
        channelId: CHANNEL_ID,
        extra: { kind: 'azan', prayer: key },
      })),
    });
  } catch (err: unknown) {
    warnRecoverable('azan notification scheduling failed', err);
  }
}

/** Drop every pending azan notification — used when the user turns azan off. */
export async function cancelAzanNotifications(): Promise<void> {
  if (!isNative()) {
    return;
  }
  try {
    const pending = await LocalNotifications.getPending();
    const mine = pending.notifications.filter((n) => n.extra?.['kind'] === 'azan');
    if (mine.length === 0) {
      return;
    }
    await LocalNotifications.cancel({ notifications: mine.map((n) => ({ id: n.id })) });
  } catch (err: unknown) {
    warnRecoverable('azan notification cancel failed', err);
  }
}
