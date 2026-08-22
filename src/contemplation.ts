/**
 * Design reminder: quiet, local-only contemplation beside the existing ayah actions.
 * The feature presents three stored questions and never collects, sends, or saves user input.
 */

import { __ } from './i18n.js';
import { AL_FATIHAH_CONTEMPLATION_SAMPLE } from './contemplation-questions.sample.js';

interface ContemplationEntry {
  id: string;
  surah: number;
  ayah: number;
  questions: [string, string, string];
}

type Checkpoint = Record<string, ContemplationEntry[]>;

let questionIndex: Map<string, ContemplationEntry> | null = null;
let loadingIndex: Promise<Map<string, ContemplationEntry>> | null = null;
let sheet: HTMLElement | null = null;
let reference: HTMLElement | null = null;
let questionsList: HTMLOListElement | null = null;
let closeButton: HTMLButtonElement | null = null;
let title: HTMLElement | null = null;
let hint: HTMLElement | null = null;

function entryKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

async function getQuestionIndex(): Promise<Map<string, ContemplationEntry>> {
  if (questionIndex) {
    return questionIndex;
  }
  if (loadingIndex) {
    return loadingIndex;
  }

  loadingIndex = fetch('data/contemplation-questions.partial.json')
    .then((response) => {
      if (!response.ok) {
        throw new Error('Contemplation data unavailable');
      }
      return response.json() as Promise<Checkpoint>;
    })
    .then((checkpoint) => {
      const index = new Map<string, ContemplationEntry>();
      for (const entries of Object.values(checkpoint)) {
        for (const entry of entries) {
          if (
            typeof entry?.surah === 'number' &&
            typeof entry?.ayah === 'number' &&
            Array.isArray(entry.questions) &&
            entry.questions.length === 3 &&
            entry.questions.every((question) => typeof question === 'string' && question.trim().length > 0)
          ) {
            index.set(entryKey(entry.surah, entry.ayah), entry);
          }
        }
      }
      // The reviewed Al-Fatihah sample is deliberately preferred over the
      // generated draft stored in the temporary checkpoint.
      for (const entry of AL_FATIHAH_CONTEMPLATION_SAMPLE) {
        index.set(entryKey(entry.surah, entry.ayah), {
          id: `reviewed-${entry.surah}-${entry.ayah}`,
          surah: entry.surah,
          ayah: entry.ayah,
          questions: [...entry.questions] as [string, string, string],
        });
      }
      questionIndex = index;
      return index;
    })
    .catch((error) => {
      loadingIndex = null;
      throw error;
    });

  return loadingIndex;
}

export async function hasContemplation(surah: number, ayah: number): Promise<boolean> {
  try {
    return (await getQuestionIndex()).has(entryKey(surah, ayah));
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
  sheet?.setAttribute('aria-label', __('contemplation_title'));
  title && (title.textContent = __('contemplation_title'));
  hint && (hint.textContent = __('contemplation_hint'));
  closeButton?.setAttribute('aria-label', __('close'));

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
}

export async function syncContemplationAction(button: HTMLElement, surah: number, ayah: number): Promise<void> {
  button.hidden = true;
  const available = await hasContemplation(surah, ayah);
  button.hidden = !available;
}

export async function openContemplation(surah: number, ayah: number, surahName: string): Promise<void> {
  if (!sheet || !reference || !questionsList) {
    return;
  }
  const entry = (await getQuestionIndex()).get(entryKey(surah, ayah));
  if (!entry) {
    return;
  }

  reference.textContent = `${surahName} — ${__('ayah')} ${ayah}`;
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

export function closeContemplation(): void {
  if (!sheet) {
    return;
  }
  sheet.classList.add('hidden');
  sheet.style.display = 'none';
  document.body.style.overflow = '';
}
