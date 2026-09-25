/**
 * Hifz Room — session audio download.
 *
 * Owns the offline-download half of a hifz session: the download buttons and
 * their status text, resolving the ayah audio URLs for the planned range, and
 * hydrating cached audio back into the player. Plan reading stays in
 * hifz-room.ts, so the two plan-aware entry points there pass the plan in.
 */

import { getAyahCount, getSavedSessionDownload, getSurahName, label, type HifzPlan } from './hifz-room-plan.js';
import { isSurahCached } from './features/audio/audio-cache.js';
import { loadAudioUrlsForSession } from './surah-loader.js';
import { state } from './state.js';

export function getDownloadButtons(room: HTMLElement): HTMLButtonElement[] {
  return [
    room.querySelector<HTMLButtonElement>('#hifzRoomDownload'),
    room.querySelector<HTMLButtonElement>('#hifzRoomFocusDownload'),
  ].filter((button): button is HTMLButtonElement => button !== null);
}

export function setSessionDownloadStatus(room: HTMLElement, key: string, stateName = 'idle', ...args: string[]): void {
  room.querySelectorAll<HTMLElement>('#hifzRoomDownloadStatus, #hifzRoomFocusDownloadStatus').forEach((status) => {
    status.textContent = label(key, ...args);
    status.dataset['state'] = stateName;
  });
}

export function setSessionReadyStatus(room: HTMLElement, plan: HifzPlan, alreadySaved = false): void {
  const primary = label(alreadySaved ? 'hifz_room_download_cached' : 'hifz_room_download_ready');
  const detail = label('hifz_room_download_ready_detail', getSurahName(plan.surah), String(plan.from), String(plan.to));
  setSessionDownloadStatus(room, `${primary} ${detail}`, 'ready');
}

export function setSessionDownloadBusy(room: HTMLElement, busy: boolean): void {
  getDownloadButtons(room).forEach((button) => {
    button.disabled = busy;
    button.textContent = label(busy ? 'hifz_room_download_working' : 'hifz_room_download');
  });
}

export async function resolveSessionAudioUrls(plan: HifzPlan): Promise<string[]> {
  const expectedCount = plan.to - plan.from + 1;
  if (
    state.currentSurah === plan.surah &&
    state.currentReciter === plan.reciter &&
    state.ayahsAudios.length >= plan.to
  ) {
    const currentUrls = state.ayahsAudios.slice(plan.from - 1, plan.to).filter((url): url is string => Boolean(url));
    if (currentUrls.length === expectedCount) {
      return currentUrls;
    }
  }
  const allUrls = await loadAudioUrlsForSession(plan.surah, plan.reciter, getAyahCount(plan.surah));
  const rangeUrls = allUrls.slice(plan.from - 1, plan.to).filter((url): url is string => Boolean(url));
  if (rangeUrls.length !== expectedCount) {
    throw new Error('Session audio URLs are unavailable');
  }
  return rangeUrls;
}

export async function hydrateDownloadedSessionAudio(plan: HifzPlan): Promise<void> {
  const record = getSavedSessionDownload(plan);
  if (!record || !state.surahData || state.currentSurah !== plan.surah || !(await isSurahCached(record.urls))) {
    return;
  }
  const hydrated = Array.from({ length: state.surahData.ayahs.length }, (_, index) => state.ayahsAudios[index] || '');
  record.urls.forEach((url, index) => {
    hydrated[plan.from - 1 + index] = url;
  });
  state.ayahsAudios = hydrated;
}
