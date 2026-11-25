import { state, subscribe } from './state.js';

let wakeLock: WakeLockSentinel | null = null;
let guardsInitialized = false;

function hasActiveHifzSession(): boolean {
  return document.getElementById('hifzRoom')?.classList.contains('hifz-room-focused') ?? false;
}

function shouldHoldWakeLock(): boolean {
  return !document.hidden && (state.isPlaying || hasActiveHifzSession());
}

async function releaseWakeLock(): Promise<void> {
  const lock = wakeLock;
  wakeLock = null;
  try {
    await lock?.release();
  } catch {
    /* ignore */
  }
}

async function syncWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) {
    return;
  }
  if (!shouldHoldWakeLock()) {
    await releaseWakeLock();
    return;
  }
  if (wakeLock) {
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

function shouldConfirmExit(): boolean {
  return state.isPlaying || hasActiveHifzSession();
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!shouldConfirmExit()) {
    return;
  }
  event.preventDefault();
  event.returnValue = '';
}

export function initSessionGuards(): void {
  if (guardsInitialized) {
    return;
  }
  guardsInitialized = true;
  subscribe('isPlaying', () => {
    void syncWakeLock();
  });
  document.addEventListener('visibilitychange', () => {
    void syncWakeLock();
  });
  window.addEventListener('beforeunload', onBeforeUnload);
  void syncWakeLock();
}

export async function _resetSessionGuardsForTest(): Promise<void> {
  guardsInitialized = false;
  window.removeEventListener('beforeunload', onBeforeUnload);
  await releaseWakeLock();
}
