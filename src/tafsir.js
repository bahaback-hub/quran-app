import { CONFIG } from './config.js';
import { dom } from './dom.js';
import { storage } from './storage.js';
import { escapeHtml } from './utils.js';

/* ===================== TAFSIR INDEXEDDB CACHE ===================== */

function openTafsirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QuranTafsirDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tafsir')) {
        db.createObjectStore('tafsir', { keyPath: 'key' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
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
  } catch (e) { }
}

async function fetchTafsirFromAPI(edition, surahNum, ayahNum) {
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  const url = `${CONFIG.TAFSIR_API}/${edition}/${surahNum}/${ayahNum}.json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const text = data?.tafsir?.text || data?.text || 'لا يوجد تفسير متاح';
    await saveTafsirToDB(cacheKey, text);
    return text;
  } catch {
    return null;
  }
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

export async function loadTafsirForCurrentAyah() {
  if (!state.surahData) return;
  const a = state.surahData.ayahs[state.currentAyahIndex];
  if (!a || !dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition;
  const cacheKey = getTafsirCacheKey(edition, state.currentSurah, a.numberInSurah);
  setTafsirHeader(state.surahData.name, a.numberInSurah);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) { renderTafsirContent(cached, a.text, state.surahData.name, a.numberInSurah); return; }
  showTafsirLoading();
  const text = await fetchTafsirFromAPI(edition, state.currentSurah, a.numberInSurah);
  if (text) renderTafsirContent(text, a.text, state.surahData.name, a.numberInSurah);
  else showTafsirError();
}

export async function loadTafsirForSurahAyah(surahNum, ayahNum) {
  if (!dom.tafsirCurtainBody || !dom.tafsirCurtainHeader) return;
  const edition = state.currentTafsirEdition || CONFIG.DEFAULT_TAFSIR;
  const surahInfo = state.surahList.find(s => s.number === surahNum);
  const surahName = surahInfo ? surahInfo.name : `سورة ${surahNum}`;
  const cacheKey = getTafsirCacheKey(edition, surahNum, ayahNum);
  setTafsirHeader(surahName, ayahNum);
  const cached = await getTafsirFromDB(cacheKey);
  if (cached) { dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(cached)}</p>`; dom.tafsirCurtain?.classList.add('open'); return; }
  showTafsirLoading();
  dom.tafsirCurtain?.classList.add('open');
  const text = await fetchTafsirFromAPI(edition, surahNum, ayahNum);
  if (text) dom.tafsirCurtainBody.innerHTML = `<p>${escapeHtml(text)}</p>`;
  else showTafsirError();
}

export function openTafsir() {
  if (!dom.tafsirCurtain) return;
  dom.tafsirCurtain.classList.add('open');
  dom.tafsirCurtainHandle?.classList.add('open');
  loadTafsirForCurrentAyah();
}

export function closeTafsir() {
  dom.tafsirCurtain?.classList.remove('open');
  dom.tafsirCurtainHandle?.classList.remove('open');
}

export function toggleTafsir() {
  if (!dom.tafsirCurtain) return;
  dom.tafsirCurtain.classList.contains('open') ? closeTafsir() : openTafsir();
}
