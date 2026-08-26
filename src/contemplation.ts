/**
 * Design reminder: quiet, local-only contemplation beside existing ayah actions.
 * Questions are loaded per surah, never collect user input, and are never sent externally.
 */

import { __ } from './i18n.js';
import { AL_FATIHAH_CONTEMPLATION_SAMPLE } from './contemplation-questions.sample.js';

interface ContemplationEntry {
  id: string;
  surah: number;
  ayah: number;
  questions: [string, string, string];
}

interface ContemplationManifestItem {
  surah: number;
  file: string;
}

interface ContemplationManifest {
  schemaVersion: number;
  surahs: ContemplationManifestItem[];
}

interface ActiveContext {
  surah: number;
  ayah: number;
  surahName: string;
}

let manifest: ContemplationManifest | null = null;
let manifestLoading: Promise<ContemplationManifest> | null = null;
const surahIndexes = new Map<number, Map<string, ContemplationEntry>>();
const surahLoads = new Map<number, Promise<Map<string, ContemplationEntry>>>();
let sheet: HTMLElement | null = null;
let reference: HTMLElement | null = null;
let questionsList: HTMLOListElement | null = null;
let closeButton: HTMLButtonElement | null = null;
let title: HTMLElement | null = null;
let hint: HTMLElement | null = null;
let activeContext: ActiveContext | null = null;

function entryKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

function reviewedEntry(surah: number, ayah: number): ContemplationEntry | null {
  const entry = AL_FATIHAH_CONTEMPLATION_SAMPLE.find((sample) => sample.surah === surah && sample.ayah === ayah);
  return entry
    ? {
        id: `reviewed-${entry.surah}-${entry.ayah}`,
        surah: entry.surah,
        ayah: entry.ayah,
        questions: [...entry.questions] as [string, string, string],
      }
    : null;
}

function isValidEntry(entry: unknown): entry is ContemplationEntry {
  const candidate = entry as Partial<ContemplationEntry> | null;
  return Boolean(
    candidate &&
    typeof candidate.surah === 'number' &&
    typeof candidate.ayah === 'number' &&
    Array.isArray(candidate.questions) &&
    candidate.questions.length === 3 &&
    candidate.questions.every((question) => typeof question === 'string' && question.trim().length > 0),
  );
}

async function getManifest(): Promise<ContemplationManifest> {
  if (manifest) {
    return manifest;
  }
  if (!manifestLoading) {
    manifestLoading = fetch('data/contemplation/manifest.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Contemplation manifest unavailable');
        }
        return response.json() as Promise<ContemplationManifest>;
      })
      .then((loadedManifest) => {
        manifest = loadedManifest;
        return loadedManifest;
      })
      .catch((error) => {
        manifestLoading = null;
        throw error;
      });
  }
  return manifestLoading;
}

async function getSurahIndex(surah: number): Promise<Map<string, ContemplationEntry>> {
  const cached = surahIndexes.get(surah);
  if (cached) {
    return cached;
  }
  const loading = surahLoads.get(surah);
  if (loading) {
    return loading;
  }

  const request = getManifest()
    .then(async (loadedManifest) => {
      const descriptor = loadedManifest.surahs.find((item) => item.surah === surah);
      if (!descriptor) {
        return new Map<string, ContemplationEntry>();
      }
      const response = await fetch(`data/contemplation/${descriptor.file}`);
      if (!response.ok) {
        throw new Error('Contemplation surah data unavailable');
      }
      const entries = (await response.json()) as unknown[];
      const index = new Map<string, ContemplationEntry>();
      for (const entry of entries) {
        if (isValidEntry(entry)) {
          index.set(entryKey(entry.surah, entry.ayah), entry);
        }
      }
      surahIndexes.set(surah, index);
      return index;
    })
    .catch((error) => {
      surahLoads.delete(surah);
      throw error;
    });
  surahLoads.set(surah, request);
  return request;
}

async function getEntry(surah: number, ayah: number): Promise<ContemplationEntry | null> {
  const reviewed = reviewedEntry(surah, ayah);
  if (reviewed) {
    return reviewed;
  }
  return (await getSurahIndex(surah)).get(entryKey(surah, ayah)) ?? null;
}

function refreshContemplationText(): void {
  sheet?.setAttribute('aria-label', __('contemplation_title'));
  if (title) {
    title.textContent = __('contemplation_title');
  }
  if (hint) {
    hint.textContent = __('contemplation_hint');
  }
  closeButton?.setAttribute('aria-label', __('close'));
  if (activeContext && reference) {
    reference.textContent = `${activeContext.surahName} — ${__('ayah')} ${activeContext.ayah}`;
  }
}

export async function hasContemplation(surah: number, ayah: number): Promise<boolean> {
  try {
    return Boolean(await getEntry(surah, ayah));
  } catch {
    return false;
  }
}

export function initContemplation(): void {
  sheet = document.getElementById('contemplationSheet');
  reference = document.getElementById('contemplationReference');
  questionsList = document.getElementById('contemplationQuestions') as HTMLOListElement | null;
  closeButton = document.getElementById('contemplationCloseBtn') as HTMLButtonElement | null;
  title = document.getElementById('contemplationTitle');
  hint = document.getElementById('contemplationHint');
  refreshContemplationText();

  closeButton?.addEventListener('click', closeContemplation);
  sheet?.addEventListener('click', (event) => {
    if (event.target === sheet) {
      closeContemplation();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sheet && !sheet.classList.contains('hidden')) {
      closeContemplation();
    }
  });
  window.addEventListener('app:langchange', refreshContemplationText);
}

export async function syncContemplationAction(
  button: HTMLElement,
  status: HTMLElement | null,
  surah: number,
  ayah: number,
): Promise<void> {
  const requestKey = entryKey(surah, ayah);
  button.dataset['contemplationRequest'] = requestKey;
  button.hidden = true;
  if (status) {
    status.hidden = true;
  }

  const available = await hasContemplation(surah, ayah);
  if (button.dataset['contemplationRequest'] !== requestKey) {
    return;
  }
  button.hidden = !available;
  if (status) {
    status.hidden = available;
    status.textContent = available ? '' : __('contemplation_not_ready');
  }
}

export async function openContemplation(surah: number, ayah: number, surahName: string): Promise<void> {
  if (!sheet || !reference || !questionsList) {
    return;
  }
  const entry = await getEntry(surah, ayah);
  if (!entry) {
    return;
  }

  activeContext = { surah, ayah, surahName };
  refreshContemplationText();
  questionsList.replaceChildren(
    ...entry.questions.map((question) => {
      const item = document.createElement('li');
      item.textContent = question;
      return item;
    }),
  );
  sheet.classList.remove('hidden');
  sheet.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  closeButton?.focus();
}

function closeContemplation(): void {
  if (!sheet) {
    return;
  }
  sheet.classList.add('hidden');
  sheet.style.display = 'none';
  document.body.style.overflow = '';
  activeContext = null;
}
