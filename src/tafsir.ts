import { state } from './state.js';
import { CONFIG } from './config.js';
import { dom } from './dom.js';
import { escapeHtml } from './utils.js';
import { tafsirFetch } from './api-client.js';
import { __ } from './i18n.js';

/* ===================== LOCAL TYPES ===================== */

/** A single ayah entry in the local Muyassar tafsir. */
interface MuyassarAyah {
  ayah: number;
  text: string;
}

/** A surah entry in the local Muyassar file — either an object with an `ayahs` array or a bare array. */
type MuyassarSurah = MuyassarAyah[] | { ayahs: MuyassarAyah[] };

/** The full local Muyassar tafsir structure: surah number → surah data. */
type LocalMuyassar = Record<number, MuyassarSurah> | null;

/** Shape of surahData when accessed in tafsir functions. */
interface SurahAyahData {
  numberInSurah: number;
  text: string;
}

interface SurahDataLike {
  name: string;
  ayahs: SurahAyahData[];
}

/** Shape of an entry stored in the IndexedDB tafsir object store. */
interface TafsirCacheEntry {
  key: string;
  text: string;
}

/** Shape of the API response from the tafsir endpoint. */
interface TafsirApiResponse {
  tafsir?: { text: string };
  text?: string;
}

/* ===================== LOCAL MUYASSAR TAFSIR ===================== */

let _localMuyassar: LocalMuyassar = null;

/** Load the local Muyassar tafsir file once. */
async function loadLocalMuyassar(): Promise<LocalMuyassar> {
  if (_localMuyassar) return _localMuyassar;
  try {
    const res = await fetch('data/muyassar-tafsir.json');
    if (!res.ok) return null;
    _localMuyassar = (await res.json()) as LocalMuyassar;
    return _localMuyassar;
  } catch {
    return null;
  }
}

/** Get tafsir text from local Muyassar file (instant, no API needed). */
function getLocalMuyassarAyah(surahNum: number, ayahNum: number): string | null {
  if (!_localMuyassar) return null;
  const surah = _localMuyassar[surahNum];
  if (!surah) return null;
  // Handle both {ayahs: [...]} and direct array formats
  const ayahs: MuyassarAyah[] | null = Array.isArray(surah) ? surah : surah.ayahs;
  if (!ayahs) return null;
  const ayah = ayahs.find((a: MuyassarAyah) => a.ayah === ayahNum);
  return ayah?.text || null;
}

/* ===================== TAFSIR INDEXEDDB CACHE ===================== */

let _tafsirDb: IDBDatabase | null = null;

function openTafsirDB(): Promise<IDBDatabase> {
  if (_tafsirDb) return Promise.resolve(_tafsirDb);
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
  } catch (_e: unknown) {
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
    const data = (await tafsirFetch(`/${edition}/${surahNum}/${ayahNum}.json`, { silent: true })) as TafsirApiResponse;
    const text = data?.tafsir?.text || data?.text || __('no_tafsir_available');
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
    const local = await loadLocalMuyassar();
    if (local) {
      const text = getLocalMuyassarAyah(surahNum, ayahNum);
      if (text) return text;
    }
  }
  // Strategy 2: IndexedDB cache
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) return cached;
  // Strategy 3: API + cache
  return await fetchTafsirFromAPI(edition, surahNum, ayahNum);
}

/* ===================== TAFSIR UI ===================== */

function renderTafsirContent(text: string, ayahText: string, surahName: string, ayahNum: number): void {
  dom.tafsirCurtainHeader!.textContent = `${__('tafsir')}: ${surahName} — ${__('ayah')} ${ayahNum}`;
  dom.tafsirCurtainBody!.replaceChildren();
  dom.tafsirCurtainBody!.scrollTop = 0;
  const titleEl = document.createElement('div');
  titleEl.className = 'tafsir-ayah-title';
  titleEl.textContent = `﴿${ayahText}﴾`;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'tafsir-text';
  bodyEl.textContent = text;
  dom.tafsirCurtainBody!.appendChild(titleEl);
  dom.tafsirCurtainBody!.appendChild(bodyEl);
}

function setTafsirHeader(surahName: string, ayahNum: number): void {
  dom.tafsirCurtainHeader!.textContent = `${__('tafsir')}: ${surahName} — ${__('ayah')} ${ayahNum}`;
}

function showTafsirLoading(): void {
  dom.tafsirCurtainBody!.innerHTML = `<p class="tafsir-loading">${__('tafsir_loading')}</p>`;
  dom.tafsirCurtainBody!.scrollTop = 0;
}

function showTafsirError(): void {
  dom.tafsirCurtainBody!.innerHTML = `<p class="tafsir-error">${__('tafsir_error')}</p>`;
  dom.tafsirCurtainBody!.scrollTop = 0;
}

/** Load & render tafsir for the currently-selected ayah. */
export async function loadTafsirForCurrentAyah(): Promise<void> {
  if (!state.surahData) return;
  const surahData = state.surahData as unknown as SurahDataLike;
  const a = surahData.ayahs[state.currentAyahIndex];
  if (!a || !dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition;
  setTafsirHeader(surahData.name, a.numberInSurah);
  // Try instant local first for Muyassar
  if (edition === 'ar-tafsir-muyassar') {
    const local = await loadLocalMuyassar();
    const localText = local ? getLocalMuyassarAyah(state.currentSurah, a.numberInSurah) : null;
    if (localText) {
      renderTafsirContent(localText, a.text, surahData.name, a.numberInSurah);
      return;
    }
  }
  // Fall back to cache/API
  const cacheKey = getTafsirCacheKey(edition, state.currentSurah, a.numberInSurah);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) {
    renderTafsirContent(cached, a.text, surahData.name, a.numberInSurah);
    return;
  }
  showTafsirLoading();
  const text = await fetchTafsirFromAPI(edition, state.currentSurah, a.numberInSurah);
  if (text) renderTafsirContent(text, a.text, surahData.name, a.numberInSurah);
  else showTafsirError();
}

/** Load & render tafsir for a specific surah/ayah. */
export async function loadTafsirForSurahAyah(surahNum: number, ayahNum: number): Promise<void> {
  if (!dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition || CONFIG.DEFAULT_TAFSIR;
  const surahInfo = state.surahList.find((s) => s.number === surahNum);
  const surahName = surahInfo ? surahInfo.name : `${__('surah')} ${surahNum}`;
  setTafsirHeader(surahName, ayahNum);
  // Try instant local first for Muyassar
  if (edition === 'ar-tafsir-muyassar') {
    const local = await loadLocalMuyassar();
    const localText = local ? getLocalMuyassarAyah(surahNum, ayahNum) : null;
    if (localText) {
      dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(localText)}</p>`;
      dom.tafsirCurtain?.classList.add('open');
      return;
    }
  }
  // Fall back to cache/API
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) {
    dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(cached)}</p>`;
    dom.tafsirCurtain?.classList.add('open');
    return;
  }
  showTafsirLoading();
  dom.tafsirCurtain?.classList.add('open');
  const text = await fetchTafsirFromAPI(edition, surahNum, ayahNum);
  if (text) dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(text)}</p>`;
  else showTafsirError();
}

/** Open the tafsir curtain and load tafsir for current ayah. */
export function openTafsir(): void {
  if (!dom.tafsirCurtain) return;
  dom.tafsirCurtain.classList.add('open');
  dom.tafsirCurtainHandle?.classList.add('open');
  loadTafsirForCurrentAyah();
}

/** Close the tafsir curtain. */
export function closeTafsir(): void {
  dom.tafsirCurtain?.classList.remove('open');
  dom.tafsirCurtainHandle?.classList.remove('open');
}

/** Toggle the tafsir curtain open/closed. */
export function toggleTafsir(): void {
  dom.tafsirCurtain!.classList.contains('open') ? closeTafsir() : openTafsir();
}

/** Fetch tafsir text using hybrid strategy (local → cache → API). */
export async function fetchTafsirText(edition: string, surahNum: number, ayahNum: number): Promise<string | null> {
  if (!edition || !surahNum || !ayahNum) return null;
  return await getTafsirText(edition, surahNum, ayahNum);
}
