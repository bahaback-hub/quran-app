import { state, QuranTextEntry, SearchWord } from './state.js';
import { CONFIG } from './config.js';
import { storage } from './storage.js';
import { showToast } from './ui.js';
import { normalizeExactText, normalizeRelaxed } from './utils.js';

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_SEARCH_HISTORY = 10;
export const SEARCH_PAGE_SIZE = 50;

/** Raw Quran API response shape. */
interface QuranApiResponse {
  data: {
    surahs: Array<{
      number: number;
      name: string;
      ayahs: Array<{
        text: string;
        numberInSurah: number;
      }>;
    }>;
  };
}

function openQuranDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('QuranAppDB', 1);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('fullText')) db.createObjectStore('fullText', { keyPath: 'id' });
    };
    request.onsuccess = (e: Event) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(new Error('Failed to open QuranAppDB'));
  });
}

async function loadFromIndexedDB(db: IDBDatabase): Promise<QuranTextEntry[] | null> {
  return new Promise((resolve) => {
    const tx = db.transaction('fullText', 'readonly');
    const store = tx.objectStore('fullText');
    const getReq = store.get('fullQuran');
    getReq.onsuccess = () => resolve((getReq.result as { data?: QuranTextEntry[] } | undefined)?.data || null);
    getReq.onerror = () => resolve(null);
  });
}

async function fetchQuranText(): Promise<QuranApiResponse> {
  let res = await fetch('data/quran-uthmani.json').catch(() => null);
  if (!res || !res.ok) {
    res = await fetch(`${CONFIG.API_BASE}/quran/quran-uthmani`);
  }
  const data: QuranApiResponse = await res.json();
  if (!data?.data?.surahs) throw new Error('بيانات غير صالحة');
  return data;
}

function stripBasmala(text: string, surahNum: number, ayahNum: number): string {
  if (surahNum === 1 || surahNum === 9 || ayahNum !== 1) return text;
  return text.replace(/^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u, '');
}

function flattenAyahs(data: QuranApiResponse): QuranTextEntry[] {
  const ayahs: QuranTextEntry[] = [];
  for (const surah of data.data.surahs) {
    for (const ayah of surah.ayahs) {
      const ayahText = stripBasmala(ayah.text, surah.number, ayah.numberInSurah);
      ayahs.push({
        surah: surah.number,
        surahName: surah.name,
        ayah: ayah.numberInSurah,
        text: ayahText,
        normalized: normalizeExactText(ayahText)
      });
    }
  }
  return ayahs;
}

function cacheInIndexedDB(db: IDBDatabase, ayahs: QuranTextEntry[]): void {
  try {
    const tx = db.transaction('fullText', 'readwrite');
    tx.objectStore('fullText').put({ id: 'fullQuran', data: ayahs });
  } catch (err) { console.warn('Failed to cache full Quran text:', err); }
}

export async function loadFullQuranText(): Promise<void> {
  if (state.fullQuranLoaded) return;
  try {
    const db = await openQuranDB();
    const cached = await loadFromIndexedDB(db);
    if (cached) {
      const needsNormalize = cached.length > 0 && !cached[0].normalized;
      if (needsNormalize) {
        for (const a of cached) {
          a.normalized = normalizeExactText(a.text);
        }
        cacheInIndexedDB(db, cached);
      }
      state.fullQuranText = cached;
      state.fullQuranLoaded = true;
      if (typeof requestIdleCallback === 'function') requestIdleCallback(() => buildSearchWords(), { timeout: 3000 });
      else setTimeout(buildSearchWords, 1000);
      return;
    }
    showToast('جاري تحميل قاعدة القرآن (مرة واحدة فقط)...', 'success');
    const data = await fetchQuranText();
    const ayahs = flattenAyahs(data);
    for (const a of ayahs) {
      a.normalized = normalizeExactText(a.text);
    }
    state.fullQuranText = ayahs;
    state.fullQuranLoaded = true;
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => buildSearchWords(), { timeout: 3000 });
    else setTimeout(buildSearchWords, 1000);
    cacheInIndexedDB(db, ayahs);
    showToast('✅ قاعدة القرآن جاهزة', 'success');
  } catch (err) {
    console.error('Failed to load full Quran text:', err);
    showToast('❌ فشل تحميل قاعدة القرآن', 'error');
  }
}

function generateArabicVariants(normQuery: string): string[] {
  const variants = [normQuery];
  if (normQuery.startsWith('ال') && normQuery.length > 3) {
    variants.push(normQuery.slice(2));
  }
  return [...new Set(variants)];
}

export function performSearch(query: string): QuranTextEntry[] {
  const normQuery = normalizeExactText(query.trim());
  const relaxedQuery = normalizeRelaxed(query.trim());
  const exactVariants = generateArabicVariants(normQuery);
  const relaxedVariants = generateArabicVariants(relaxedQuery);
  let matches = state.fullQuranText!.filter(ayah =>
    exactVariants.some(q => ayah.normalized.includes(q))
  );
  if (!matches.length) {
    matches = state.fullQuranText!.filter(ayah =>
      relaxedVariants.some(q => normalizeRelaxed(ayah.text).includes(q))
    );
  }
  return matches;
}

export function buildSearchWords(): void {
  if (!state.fullQuranText || state.searchWords?.length) return;
  const freq = new Map<string, number>();
  for (const ayah of state.fullQuranText) {
    const words = ayah.normalized.split(/\s+/);
    for (const w of words) {
      if (w.length < 2) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  state.searchWords = [...freq.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));

  const prefixMap = new Map<string, SearchWord[]>();
  const MAX_SUGGESTIONS = 8;
  const MAX_PREFIX_LEN = 5;
  for (const entry of state.searchWords) {
    const word = entry.word;
    for (let len = 1; len <= Math.min(word.length, MAX_PREFIX_LEN); len++) {
      const prefix = word.slice(0, len);
      let list = prefixMap.get(prefix);
      if (!list) { list = []; prefixMap.set(prefix, list); }
      if (list.length < MAX_SUGGESTIONS) list.push(entry);
    }
  }
  state.searchPrefixMap = prefixMap as unknown as Map<string, unknown>;
}

export function addToSearchHistory(query: string): void {
  const history = getSearchHistory().filter(h => h !== query);
  history.unshift(query);
  if (history.length > MAX_SEARCH_HISTORY) history.length = MAX_SEARCH_HISTORY;
  storage.set(SEARCH_HISTORY_KEY, history);
}

export function getSearchHistory(): string[] {
  return storage.get<string[]>(SEARCH_HISTORY_KEY, []) ?? [];
}

export function clearSearchHistory(): void {
  storage.remove(SEARCH_HISTORY_KEY);
  showToast('تم مسح سجل البحث', '');
}
