/**
 * Hifz Room — setup form controls.
 *
 * Owns the plan form's DOM lookups plus the population of its selects and the
 * surah name search. These are pure view helpers: they read the shared surah
 * list and write DOM options, so the session/playback half of the room can stay
 * in hifz-room.ts without importing form internals back and forth.
 */

import { getSurahName, PLAYBACK_SPEEDS } from './hifz-room-plan.js';
import { getReciterDisplayName, RECITERS } from './reciters.js';
import { state } from './state.js';

export interface HifzRoomControls {
  surah: HTMLSelectElement;
  surahSearch: HTMLInputElement;
  from: HTMLSelectElement;
  to: HTMLSelectElement;
  repeat: HTMLInputElement;
  reviewAt: HTMLInputElement;
  summary: HTMLElement;
  status: HTMLElement;
  start: HTMLButtonElement;
  download: HTMLButtonElement;
  downloadStatus: HTMLElement;
}

export interface SurahEntry {
  value: number;
  label: string;
}

export function getControls(room: HTMLElement): HifzRoomControls | null {
  const surah = room.querySelector<HTMLSelectElement>('#hifzRoomSurah');
  const surahSearch = room.querySelector<HTMLInputElement>('#hifzRoomSurahSearch');
  const from = room.querySelector<HTMLSelectElement>('#hifzRoomFrom');
  const to = room.querySelector<HTMLSelectElement>('#hifzRoomTo');
  const repeat = room.querySelector<HTMLInputElement>('#hifzRoomCustomRepeat');
  const reviewAt = room.querySelector<HTMLInputElement>('#hifzRoomReviewAt');
  const summary = room.querySelector<HTMLElement>('#hifzRoomSummary');
  const status = room.querySelector<HTMLElement>('#hifzRoomStatus');
  const start = room.querySelector<HTMLButtonElement>('#hifzRoomStart');
  const download = room.querySelector<HTMLButtonElement>('#hifzRoomDownload');
  const downloadStatus = room.querySelector<HTMLElement>('#hifzRoomDownloadStatus');
  return surah &&
    surahSearch &&
    from &&
    to &&
    repeat &&
    reviewAt &&
    summary &&
    status &&
    start &&
    download &&
    downloadStatus
    ? { surah, surahSearch, from, to, repeat, reviewAt, summary, status, start, download, downloadStatus }
    : null;
}

function getSurahEntries(selected: number): SurahEntry[] {
  const entries = state.surahList.map((item) => ({ value: item.number, label: getSurahName(item.number) }));
  if (!entries.length) {
    const mainSelect = document.getElementById('surahSelect') as HTMLSelectElement | null;
    entries.push(
      ...(mainSelect
        ? Array.from(mainSelect.options)
            .map((option) => ({ value: parseInt(option.value, 10), label: option.textContent || option.value }))
            .filter((option) => Number.isInteger(option.value) && option.value > 0)
        : [{ value: selected, label: getSurahName(selected) }]),
    );
  }
  if (!entries.some((entry) => entry.value === selected)) {
    entries.push({ value: selected, label: getSurahName(selected) });
  }
  return entries;
}

export function fillSurahOptions(select: HTMLSelectElement, selected: number): void {
  const entries = getSurahEntries(selected);
  select.replaceChildren(
    ...entries.map((entry) => {
      const option = document.createElement('option');
      option.value = String(entry.value);
      option.textContent = entry.label;
      return option;
    }),
  );
  select.value = String(selected);
}

function normalizeSurahSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLocaleLowerCase();
}

export function syncSurahSearch(room: HTMLElement, selected: number): void {
  const controls = getControls(room);
  const list = room.querySelector<HTMLDataListElement>('#hifzRoomSurahOptions');
  if (!controls || !list) {
    return;
  }
  const entries = getSurahEntries(selected);
  list.replaceChildren(
    ...entries.map((entry) => {
      const option = document.createElement('option');
      option.value = entry.label;
      option.label = `${entry.value}. ${entry.label}`;
      return option;
    }),
  );
  controls.surahSearch.value = entries.find((entry) => entry.value === selected)?.label || getSurahName(selected);
}

export function selectSurahFromSearch(room: HTMLElement): void {
  const controls = getControls(room);
  if (!controls) {
    return;
  }
  const query = normalizeSurahSearch(controls.surahSearch.value);
  if (!query) {
    return;
  }
  const matches = getSurahEntries(parseInt(controls.surah.value, 10)).filter((entry) => {
    const normalizedName = normalizeSurahSearch(entry.label);
    return normalizedName === query || normalizedName.startsWith(query) || String(entry.value) === query;
  });
  const exact = matches.find((entry) => normalizeSurahSearch(entry.label) === query || String(entry.value) === query);
  const selected = exact || (matches.length === 1 ? matches[0] : null);
  if (!selected || controls.surah.value === String(selected.value)) {
    return;
  }
  controls.surah.value = String(selected.value);
  controls.surah.dispatchEvent(new Event('change', { bubbles: true }));
}

export function fillAyahOptions(select: HTMLSelectElement, count: number, selected: number): void {
  select.replaceChildren(
    ...Array.from({ length: count }, (_, index) => {
      const option = document.createElement('option');
      option.value = String(index + 1);
      option.textContent = String(index + 1);
      return option;
    }),
  );
  select.value = String(Math.min(Math.max(1, selected), count));
}

export function fillReciterOptions(select: HTMLSelectElement, selected: string): void {
  select.replaceChildren(
    ...RECITERS.map((reciter) => {
      const option = document.createElement('option');
      option.value = reciter.id;
      option.textContent = getReciterDisplayName(reciter);
      return option;
    }),
  );
  select.value = RECITERS.some((reciter) => reciter.id === selected) ? selected : RECITERS[0]!.id;
}

export function fillSpeedOptions(select: HTMLSelectElement, selected: number): void {
  select.replaceChildren(
    ...PLAYBACK_SPEEDS.map((speed) => {
      const option = document.createElement('option');
      option.value = String(speed);
      option.textContent = `${speed}×`;
      return option;
    }),
  );
  select.value = String(PLAYBACK_SPEEDS.includes(selected) ? selected : 1);
}
