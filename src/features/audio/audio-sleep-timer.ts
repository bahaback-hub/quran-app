/**
 * Sleep timer for the audio player.
 *
 * Counts down N minutes, then pauses playback and moves the player into its
 * stopped state. Keeps the player UI's remaining-time display fresh via a
 * 15s interval that retires itself once the timer finishes or is cleared.
 *
 * Extracted from audio.ts. The "stop playback" action arrives via
 * initSleepTimerHost() to avoid a circular import back into audio.ts.
 */

import { showToast } from '../../ui.js';
import { __ } from '../../i18n.js';

/* ===================== HOST WIRING ===================== */

/** Playback-engine hook the timer needs; injected by audio.ts. */
export interface SleepTimerHost {
  /** Pause playback and move the player into its stopped state. */
  stopPlayback(): void;
}

let _host: SleepTimerHost | null = null;

/** Inject the playback-engine hook. Called once at module init by audio.ts. */
export function initSleepTimerHost(host: SleepTimerHost): void {
  _host = host;
}

/* ===================== SLEEP TIMER ===================== */

let _sleepTimer: ReturnType<typeof setTimeout> | null = null;
let _sleepTimerMinutes = 0;
let _sleepTimerStart = 0;

/**
 * Set a sleep timer to pause audio after N minutes.
 * @param minutes Duration in minutes. Set to 0 or negative to cancel.
 */
export function setSleepTimer(minutes: number): void {
  clearSleepTimer();
  if (minutes <= 0) {
    showToast(__('sleep_timer_cancelled'), '');
    return;
  }
  _sleepTimerMinutes = minutes;
  _sleepTimerStart = Date.now();
  _sleepTimer = setTimeout(
    () => {
      _host?.stopPlayback();
      showToast(__('sleep_timer_stopped', String(minutes)), 'success');
      _sleepTimerMinutes = 0;
      _sleepTimerStart = 0;
      updateSleepTimerDisplay();
    },
    minutes * 60 * 1000,
  );
  showToast(__('sleep_timer_set', String(minutes)), 'success');
  updateSleepTimerDisplay();
  ensureSleepTimerInterval();
}

/**
 * Clear the active sleep timer and reset timer state.
 * Updates the sleep timer display after clearing.
 */
export function clearSleepTimer(): void {
  if (_sleepTimer) {
    clearTimeout(_sleepTimer);
    _sleepTimer = null;
  }
  _sleepTimerMinutes = 0;
  _sleepTimerStart = 0;
  updateSleepTimerDisplay();
}

/**
 * Get the original sleep timer duration in minutes.
 *
 * @returns The timer duration in minutes, or 0 if no timer is active
 */
export function getSleepTimerMinutes(): number {
  return _sleepTimerMinutes;
}

/**
 * Get the remaining time in minutes for the sleep timer, with fractional precision.
 *
 * @returns Remaining minutes (fractional), or 0 if no timer is active
 */
export function getSleepTimerRemaining(): number {
  if (!_sleepTimerMinutes || !_sleepTimerStart) {
    return 0;
  }
  const elapsed = (Date.now() - _sleepTimerStart) / (60 * 1000);
  return Math.max(0, _sleepTimerMinutes - elapsed);
}

/** Update the sleep timer display in the player UI. */
export function updateSleepTimerDisplay(): void {
  const el = document.getElementById('sleepTimerDisplay');
  if (!el) {
    return;
  }
  if (!_sleepTimerMinutes || !_sleepTimerStart) {
    el.textContent = '';
    el.style.display = 'none';
    return;
  }
  el.style.display = 'inline';
  const remaining = getSleepTimerRemaining();
  const mins = Math.floor(remaining);
  const secs = Math.floor((remaining - mins) * 60);
  el.textContent = `${__('sleep_timer_remaining') ?? '\u0645\u062a\u0628\u0642\u064a'} ${mins}:${secs.toString().padStart(2, '0')}`;
}

let _sleepTimerInterval: ReturnType<typeof setInterval> | null = null;

function ensureSleepTimerInterval(): void {
  if (_sleepTimerInterval) {
    return;
  }
  _sleepTimerInterval = setInterval(() => {
    if (!_sleepTimerMinutes || !_sleepTimerStart) {
      // Timer finished or was cleared — retire the interval instead of
      // polling every 15s forever (background wake-up + DOM churn).
      cleanupSleepTimerInterval();
      return;
    }
    updateSleepTimerDisplay();
  }, 15000);
}

/**
 * Stop the sleep timer display interval.
 * Called during test cleanup or app shutdown to prevent memory leaks.
 */
export function cleanupSleepTimerInterval(): void {
  if (_sleepTimerInterval) {
    clearInterval(_sleepTimerInterval);
    _sleepTimerInterval = null;
  }
}
