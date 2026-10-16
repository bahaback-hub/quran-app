import { state } from './state.js';
import { CONFIG } from './config.js';
import { dom } from './dom.js';
import { requireDom } from './dom-require.js';
import { tafsirLoading, tafsirErrorMessage } from './templates.js';
import { tafsirFetch } from './api-client.js';
import { loadLocalTafsirMuyassar } from './api-fallback.js';
import { __ } from './i18n.js';
import { tryValidate } from './schemas-validate.js';
import { TafsirApiResponseSchema } from './api-schemas.js';

/* ===================== LOCAL TYPES ===================== */

/** Shape of an entry stored in the IndexedDB tafsir object store. */
interface TafsirCacheEntry {
  key: string;
  text: string;
}

let _tafsirRenderSeq = 0;

/* ===================== TAFSIR INDEXEDDB CACHE ===================== */

let _tafsirDb: IDBDatabase | null = null;

function openTafsirDB(): Promise<IDBDatabase> {
  if (_tafsirDb) {
    return Promise.resolve(_tafsirDb);
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QuranTafsirDB', 1);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBRequest).result as IDBDatabase;
      if (!db.objectStoreNames.contains('tafsir')) {
        db.createObjectStore('tafsir', { keyPath: 'key' });
      }
    };
    request.onsuccess = (e: Event) => {
      _tafsirDb = (e.target as IDBRequest).result as IDBDatabase;
      resolve(_tafsirDb);
    };
    request.onerror = (e: Event) => reject((e.target as IDBRequest).error);
  });
}

function getTafsirCacheKey(edition: string, surahNum: number, ayahNum: number): string {
  return `tafsir_${edition}_${surahNum}_${ayahNum}`;
}

async function getTafsirFromDB(key: string): Promise<string | null> {
  try {
    const db = await openTafsirDB();
    return new Promise((resolve) => {
      const tx = db.transaction('tafsir', 'readonly');
      const store = tx.objectStore('tafsir');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? (req.result as TafsirCacheEntry).text : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveTafsirToDB(key: string, text: string): Promise<void> {
  try {
    const db = await openTafsirDB();
    const tx = db.transaction('tafsir', 'readwrite');
    tx.objectStore('tafsir').put({ key, text } as TafsirCacheEntry);
  } catch (e: unknown) {
    console.warn('Failed to cache tafsir:', e);
  }
}

async function fetchTafsirFromAPI(edition: string, surahNum: number, ayahNum: number): Promise<string | null> {
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  try {
    const raw = await tafsirFetch(`/${edition}/${surahNum}/${ayahNum}.json`, { silent: true });
    // Validate the API response at runtime instead of unsafe `as` cast.
    // If the response shape is unexpected, fall back to a user-friendly message
    // rather than null (which would show no content in the UI).
    const data = tryValidate(raw, TafsirApiResponseSchema);
    if (!data) {
      console.warn('[Tafsir] API response did not match expected schema for', edition, surahNum, ayahNum);
      // Try legacy shape (tafsir.text) before giving up
      const legacy = raw as { tafsir?: { text?: string }; text?: string } | null;
      const legacyText = legacy?.tafsir?.text || legacy?.text;
      if (legacyText) {
        await saveTafsirToDB(cacheKey, legacyText);
        return legacyText;
      }
      // No usable text — return UI fallback only. Caching it would turn a
      // transient API/schema problem into a permanent poisoned cache entry.
      return __('no_tafsir_available');
    }
    // The schema validates `text` field; older API variants use `tafsir.text`.
    const legacy = raw as { tafsir?: { text?: string } } | null;
    const text = legacy?.tafsir?.text || data.text;
    if (!text?.trim()) {
      return __('no_tafsir_available');
    }
    await saveTafsirToDB(cacheKey, text);
    return text;
  } catch {
    return null;
  }
}

/**
 * Get tafsir text using the hybrid strategy:
 * 1. Local Muyassar file (instant, offline)
 * 2. IndexedDB cache (fast, offline after first load)
 * 3. API fetch + cache (online)
 */
async function getTafsirText(edition: string, surahNum: number, ayahNum: number): Promise<string | null> {
  // Strategy 1: Local Muyassar file
  if (edition === 'ar-tafsir-muyassar') {
    const local = await loadLocalTafsirMuyassar(surahNum);
    const text = local?.[ayahNum] ?? null;
    if (text) {
      return text;
    }
  }
  // Strategy 2: IndexedDB cache
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) {
    return cached;
  }
  // Strategy 3: API + cache
  return await fetchTafsirFromAPI(edition, surahNum, ayahNum);
}

/* ===================== TAFSIR UI ===================== */

function renderTafsirContent(text: string, ayahText: string, surahName: string, ayahNum: number): void {
  requireDom('tafsirCurtainHeader').textContent = `${__('tafsir')}: ${surahName} — ${__('ayah')} ${ayahNum}`;
  requireDom('tafsirCurtainBody').replaceChildren();
  requireDom('tafsirCurtainBody').scrollTop = 0;
  const titleEl = document.createElement('div');
  titleEl.className = 'tafsir-ayah-title';
  titleEl.textContent = `﴿${ayahText}﴾`;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'tafsir-text';
  bodyEl.textContent = text;
  requireDom('tafsirCurtainBody').appendChild(titleEl);
  requireDom('tafsirCurtainBody').appendChild(bodyEl);
}

function setTafsirHeader(surahName: string, ayahNum: number): void {
  requireDom('tafsirCurtainHeader').textContent = `${__('tafsir')}: ${surahName} — ${__('ayah')} ${ayahNum}`;
}

function showTafsirLoading(): void {
  requireDom('tafsirCurtainBody').innerHTML = tafsirLoading();
  requireDom('tafsirCurtainBody').scrollTop = 0;
}

function showTafsirError(): void {
  requireDom('tafsirCurtainBody').innerHTML = tafsirErrorMessage(__('tafsir_error'));
  requireDom('tafsirCurtainBody').scrollTop = 0;
}

/** Load & render tafsir for the currently-selected ayah. */
export async function loadTafsirForCurrentAyah(): Promise<void> {
  if (!state.surahData) {
    return;
  }
  const surahData = state.surahData;
  const a = surahData.ayahs[state.currentAyahIndex];
  if (!a || !dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) {
    return;
  }
  const edition = state.currentTafsirEdition;
  const renderSeq = ++_tafsirRenderSeq;
  setTafsirHeader(surahData.name, a.numberInSurah);
  // Try instant local first for Muyassar
  if (edition === 'ar-tafsir-muyassar') {
    const local = await loadLocalTafsirMuyassar(state.currentSurah);
    const localText = local?.[a.numberInSurah] ?? null;
    if (localText) {
      if (renderSeq !== _tafsirRenderSeq) {
        return;
      }
      renderTafsirContent(localText, a.text, surahData.name, a.numberInSurah);
      return;
    }
  }
  // Fall back to cache/API
  const cacheKey = getTafsirCacheKey(edition, state.currentSurah, a.numberInSurah);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) {
    if (renderSeq !== _tafsirRenderSeq) {
      return;
    }
    renderTafsirContent(cached, a.text, surahData.name, a.numberInSurah);
    return;
  }
  showTafsirLoading();
  const text = await fetchTafsirFromAPI(edition, state.currentSurah, a.numberInSurah);
  if (text) {
    if (renderSeq !== _tafsirRenderSeq) {
      return;
    }
    renderTafsirContent(text, a.text, surahData.name, a.numberInSurah);
  } else if (renderSeq === _tafsirRenderSeq) {
    showTafsirError();
  }
}

/** Load & render tafsir for a specific surah/ayah. */
export async function loadTafsirForSurahAyah(surahNum: number, ayahNum: number): Promise<void> {
  if (!dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) {
    return;
  }
  const edition = state.currentTafsirEdition || CONFIG.DEFAULT_TAFSIR;
  const renderSeq = ++_tafsirRenderSeq;
  const surahInfo = state.surahList.find((s) => s.number === surahNum);
  const surahName = surahInfo ? surahInfo.name : `${__('surah')} ${surahNum}`;
  setTafsirHeader(surahName, ayahNum);
  // Find ayah text for header display
  const ayahEntry = (state.fullQuranText || []).find(
    (e: { surah: number; ayah: number }) => e.surah === surahNum && e.ayah === ayahNum,
  );
  const ayahText = (ayahEntry as { text?: string } | undefined)?.text || '';
  // Try instant local first for Muyassar
  if (edition === 'ar-tafsir-muyassar') {
    const local = await loadLocalTafsirMuyassar(surahNum);
    const localText = local?.[ayahNum] ?? null;
    if (localText) {
      if (renderSeq !== _tafsirRenderSeq) {
        return;
      }
      renderTafsirContent(localText, ayahText, surahName, ayahNum);
      return;
    }
  }
  // Fall back to cache/API
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) {
    if (renderSeq !== _tafsirRenderSeq) {
      return;
    }
    renderTafsirContent(cached, ayahText, surahName, ayahNum);
    return;
  }
  showTafsirLoading();
  dom.tafsirCurtain?.classList.add('open');
  dom.tafsirCurtainHandle?.classList.add('open');
  document.body.classList.add('tafsir-curtain-active', 'tafsir-only-open');
  const text = await fetchTafsirFromAPI(edition, surahNum, ayahNum);
  if (text) {
    if (renderSeq !== _tafsirRenderSeq) {
      return;
    }
    renderTafsirContent(text, ayahText, surahName, ayahNum);
  } else if (renderSeq === _tafsirRenderSeq) {
    showTafsirError();
  }
}

/** Open the tafsir curtain and load tafsir for current ayah. */
export function openTafsir(): void {
  if (!dom.tafsirCurtain) {
    return;
  }
  dom.tafsirCurtain.classList.add('open');
  dom.tafsirCurtainHandle?.classList.add('open');
  document.body.classList.add('tafsir-curtain-active', 'tafsir-only-open');
  loadTafsirForCurrentAyah();
}

/** Close the tafsir curtain. */
export function closeTafsir(): void {
  dom.tafsirCurtain?.classList.remove('open');
  dom.tafsirCurtainHandle?.classList.remove('open');
  document.body.classList.remove('tafsir-curtain-active', 'tafsir-only-open');
}

/** Toggle the tafsir curtain open/closed. */
export function toggleTafsir(): void {
  if (requireDom('tafsirCurtain').classList.contains('open')) {
    closeTafsir();
  } else {
    openTafsir();
  }
}

/** Fetch tafsir text using hybrid strategy (local → cache → API). */
export async function fetchTafsirText(edition: string, surahNum: number, ayahNum: number): Promise<string | null> {
  if (!edition || !surahNum || !ayahNum) {
    return null;
  }
  return await getTafsirText(edition, surahNum, ayahNum);
}
