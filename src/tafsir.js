import { state } from './state.js';
import { CONFIG } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { escapeHtml } from './utils.js';
import { tafsirFetch } from './api-client.js';

/* ===================== LOCAL MUYASSAR TAFSIR ===================== */

/** @type {Object<number, {ayahs: Array<{ayah: number, text: string}>}>|null} */
let _localMuyassar = null;

/** Load the local Muyassar tafsir file once. */
async function loadLocalMuyassar() {
  if (_localMuyassar) return _localMuyassar;
  try {
    const res = await fetch('data/muyassar-tafsir.json');
    if (!res.ok) return null;
    _localMuyassar = await res.json();
    return _localMuyassar;
  } catch {
    return null;
  }
}

/** Get tafsir text from local Muyassar file (instant, no API needed). */
function getLocalMuyassarAyah(surahNum, ayahNum) {
  if (!_localMuyassar) return null;
  const surah = _localMuyassar[surahNum];
  if (!surah) return null;
  // Handle both {ayahs: [...]} and direct array formats
  const ayahs = surah.ayahs || (Array.isArray(surah) ? surah : null);
  if (!ayahs) return null;
  const ayah = ayahs.find(a => a.ayah === ayahNum);
  return ayah?.text || null;
}

/* ===================== TAFSIR INDEXEDDB CACHE ===================== */

/** @type {IDBDatabase|null} */
let _tafsirDb = null;

function openTafsirDB() {
  if (_tafsirDb) return Promise.resolve(_tafsirDb);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QuranTafsirDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tafsir')) {
        db.createObjectStore('tafsir', { keyPath: 'key' });
      }
    };
    request.onsuccess = (e) => {
      _tafsirDb = /** @type {IDBRequest} */ (e.target).result;
      resolve(_tafsirDb);
    };
    request.onerror = (e) => reject(/** @type {IDBRequest} */ (e.target).error);
  });
}

function getTafsirCacheKey(edition, surahNum, ayahNum) {
  return `tafsir_${edition}_${surahNum}_${ayahNum}`;
}

async function getTafsirFromDB(key) {
  try {
    const db = await openTafsirDB();
    return new Promise((resolve) => {
      const tx = db.transaction('tafsir', 'readonly');
      const store = tx.objectStore('tafsir');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.text : null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function saveTafsirToDB(key, text) {
  try {
    const db = await openTafsirDB();
    const tx = db.transaction('tafsir', 'readwrite');
    tx.objectStore('tafsir').put({ key, text });
  } catch (e) { console.warn('Failed to cache tafsir:', e); }
}

async function fetchTafsirFromAPI(edition, surahNum, ayahNum) {
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  try {
    const data = await tafsirFetch(`/${edition}/${surahNum}/${ayahNum}.json`, { silent: true });
    const text = data?.tafsir?.text || data?.text || 'لا يوجد تفسير متاح';
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
async function getTafsirText(edition, surahNum, ayahNum) {
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

function renderTafsirContent(text, ayahText, surahName, ayahNum) {
  dom.tafsirCurtainHeader.textContent = `تفسير: ${surahName} — آية ${ayahNum}`;
  dom.tafsirCurtainBody.replaceChildren();
  dom.tafsirCurtainBody.scrollTop = 0;
  const titleEl = document.createElement('div');
  titleEl.className = 'tafsir-ayah-title';
  titleEl.textContent = `﴿${ayahText}﴾`;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'tafsir-text';
  bodyEl.textContent = text;
  dom.tafsirCurtainBody.appendChild(titleEl);
  dom.tafsirCurtainBody.appendChild(bodyEl);
}

function setTafsirHeader(surahName, ayahNum) {
  dom.tafsirCurtainHeader.textContent = `تفسير: ${surahName} — آية ${ayahNum}`;
}

function showTafsirLoading() {
  dom.tafsirCurtainBody.innerHTML = '<p class="tafsir-loading">⏳ جاري تحميل التفسير...</p>';
  dom.tafsirCurtainBody.scrollTop = 0;
}

function showTafsirError() {
  dom.tafsirCurtainBody.innerHTML = '<p class="tafsir-error">⚠️ تعذّر تحميل التفسير</p>';
  dom.tafsirCurtainBody.scrollTop = 0;
}

/** Load & render tafsir for the currently-selected ayah. @returns {Promise<void>} */
export async function loadTafsirForCurrentAyah() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a || !dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition;
  setTafsirHeader(state.surahData.name, a.numberInSurah);
  // Try instant local first for Muyassar
  if (edition === 'ar-tafsir-muyassar') {
    const local = await loadLocalMuyassar();
    const localText = local ? getLocalMuyassarAyah(state.currentSurah, a.numberInSurah) : null;
    if (localText) { renderTafsirContent(localText, a.text, state.surahData.name, a.numberInSurah); return; }
  }
  // Fall back to cache/API
  const cacheKey = getTafsirCacheKey(edition, state.currentSurah, a.numberInSurah);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) { renderTafsirContent(cached, a.text, state.surahData.name, a.numberInSurah); return; }
  showTafsirLoading();
  const text = await fetchTafsirFromAPI(edition, state.currentSurah, a.numberInSurah);
  if (text) renderTafsirContent(text, a.text, state.surahData.name, a.numberInSurah);
  else showTafsirError();
}

/** @param {number} surahNum @param {number} ayahNum @returns {Promise<void>} */
export async function loadTafsirForSurahAyah(surahNum, ayahNum) {
  if (!dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition || CONFIG.DEFAULT_TAFSIR;
  const surahInfo = state.surahList.find(s => s.number === surahNum);
  const surahName = surahInfo ? surahInfo.name : `سورة ${surahNum}`;
  setTafsirHeader(surahName, ayahNum);
  // Try instant local first for Muyassar
  if (edition === 'ar-tafsir-muyassar') {
    const local = await loadLocalMuyassar();
    const localText = local ? getLocalMuyassarAyah(surahNum, ayahNum) : null;
    if (localText) { dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(localText)}</p>`; dom.tafsirCurtain?.classList.add('open'); return; }
  }
  // Fall back to cache/API
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) { dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(cached)}</p>`; dom.tafsirCurtain?.classList.add('open'); return; }
  showTafsirLoading();
  dom.tafsirCurtain?.classList.add('open');
  const text = await fetchTafsirFromAPI(edition, surahNum, ayahNum);
  if (text) dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(text)}</p>`;
  else showTafsirError();
}

/** Open the tafsir curtain and load tafsir for current ayah. */
export function openTafsir() {
  if (!dom.tafsirCurtain) return;
  dom.tafsirCurtain.classList.add('open');
  dom.tafsirCurtainHandle?.classList.add('open');
  loadTafsirForCurrentAyah();
}

/** Close the tafsir curtain. */
export function closeTafsir() {
  dom.tafsirCurtain?.classList.remove('open');
  dom.tafsirCurtainHandle?.classList.remove('open');
}

/** Toggle the tafsir curtain open/closed. */
export function toggleTafsir() {
  dom.tafsirCurtain.classList.contains('open') ? closeTafsir() : openTafsir();
}

/** Fetch tafsir text using hybrid strategy (local → cache → API). */
export async function fetchTafsirText(edition, surahNum, ayahNum) {
  if (!edition || !surahNum || !ayahNum) return null;
  return await getTafsirText(edition, surahNum, ayahNum);
}
