/**
 * Type definitions for the reactive state system.
 *
 * Extracted from `state.ts` for clarity. Re-exported by `state.ts` for
 * backward compatibility — existing imports of `./state.js` continue to work.
 */

import type { SurahData, PrayerTimes, AdhkarSettings } from '../types.js';
import type { PageLayoutData } from '../mushaf-renderer.js';
import { CONFIG } from '../config.js';

/* ===================== DOMAIN ENTRY INTERFACES ===================== */

export interface SurahInfo {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

export interface FavoriteEntry {
  key: string;
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  timestamp: number;
}

export interface BookmarkEntry {
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  timestamp: number;
}

export interface QuranTextEntry {
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  normalized: string;
}

export interface SelectedAyah {
  surah: number;
  ayah: number;
  text: string;
  surahName: string;
  index: number;
}

export interface SurahOffset {
  surahNum: number;
  startAbs: number;
  count: number;
  name: string;
}

export interface BackgroundEntry {
  id: string;
  name: string;
  type?: string;
  css?: string;
  cssBlock?: string;
}

export interface SearchWord {
  word: string;
  count: number;
}

/* ===================== DOMAIN SLICE INTERFACES ===================== */

export interface AudioStateSlice {
  currentReciter: string;
  ayahsAudios: string[];
  isPlaying: boolean;
  hifdhMode: boolean;
  repeatMode: boolean;
  autoPlayNext: boolean;
  repeatFrom: number;
  repeatTo: number;
  repeatTimes: number;
  repeatCounter: number;
  playerCollapsed: boolean;
  azanPlaying: boolean;
  ayahTimings: number[];
}

export interface PrayerStateSlice {
  azanEnabled: boolean;
  azanFajrEnabled: boolean;
  city: string;
  country: string;
  method: string;
  prayerTimes: PrayerTimes | null;
  lastAzanFired: string | null;
}

export interface SurahStateSlice {
  currentSurah: number;
  currentAyahIndex: number;
  currentTafsirEdition: string;
  surahData: SurahData | null;
  surahList: SurahInfo[];
  surahCache: Map<string, import('../surah-cache.js').CachedSurahEntry>;
  loadingSurah: number | null;
  pendingTafsirAfterLoad: string | null;
}

export interface UIStateSlice {
  fontSize: number;
  nightMode: boolean;
  sepiaMode: boolean;
  autoSave: boolean;
  barCollapsed: boolean;
  fontType: string;
  lineSpacing: string;
  tajweedEnabled: boolean;
}

export interface MushafStateSlice {
  mushafMode: boolean;
  currentPage: number;
  currentPageLayout: PageLayoutData | null;
  surahOffsets: SurahOffset[] | null;
  presentationMode: boolean;
  presBgMode: 'plain' | 'nature' | 'singleNature' | 'auto' | 'animated' | 'scene';
  presBgScene: string;
  presBgNature: string;
}

export interface SearchStateSlice {
  fullQuranText: QuranTextEntry[] | null;
  fullQuranLoaded: boolean;
  searchWords: SearchWord[];
  searchTrie: Record<string, unknown> | null;
  searchPrefixMap: Map<string, unknown> | null;
  translationEnabled: boolean;
  currentTranslation: string | null;
  translationData: Record<string, unknown> | null;
}

export interface AdhkarStateSlice {
  adhkarSettings: AdhkarSettings | null;
  adhkarPanelOpen: boolean;
  adhkarActiveTab: string | null;
  firedAdhkarToday: Set<string>;
  firedAdhkarDate: string | null;
}

/* ===================== COMPOSITE APP STATE ===================== */

export interface AppState {
  currentSurah: number;
  currentAyahIndex: number;
  currentReciter: string;
  currentTafsirEdition: string;
  surahData: SurahData | null;
  surahList: SurahInfo[];
  surahCache: Map<string, import('../surah-cache.js').CachedSurahEntry>;
  ayahsAudios: string[];
  isPlaying: boolean;
  hifdhMode: boolean;
  repeatMode: boolean;
  autoPlayNext: boolean;
  repeatFrom: number;
  repeatTo: number;
  repeatTimes: number;
  repeatCounter: number;
  fontSize: number;
  nightMode: boolean;
  sepiaMode: boolean;
  autoSave: boolean;
  azanEnabled: boolean;
  azanFajrEnabled: boolean;
  city: string;
  country: string;
  method: string;
  prayerTimes: PrayerTimes | null;
  lastAzanFired: string | null;
  favorites: FavoriteEntry[];
  bookmark: BookmarkEntry | null;
  pendingTafsirAfterLoad: string | null;
  playerCollapsed: boolean;
  barCollapsed: boolean;
  azanPlaying: boolean;
  loadingSurah: number | null;
  mushafMode: boolean;
  currentPage: number;
  fullQuranText: QuranTextEntry[] | null;
  fullQuranLoaded: boolean;
  searchWords: SearchWord[];
  searchTrie: Record<string, unknown> | null;
  ayahWordElements: HTMLElement[] | null;
  translationEnabled: boolean;
  currentTranslation: string | null;
  translationData: Record<string, unknown> | null;
  adhkarSettings: AdhkarSettings | null;
  adhkarPanelOpen: boolean;
  adhkarActiveTab: string | null;
  firedAdhkarToday: Set<string>;
  firedAdhkarDate: string | null;
  surahOffsets: SurahOffset[] | null;
  ayahTimings: number[];
  presentationMode: boolean;
  currentPageLayout: PageLayoutData | null;
  searchPrefixMap: Map<string, unknown> | null;
  fontType: string;
  lineSpacing: string;
  tajweedEnabled: boolean;
  presBgMode: 'plain' | 'nature' | 'singleNature' | 'auto' | 'animated' | 'scene';
  presBgScene: string;
  presBgNature: string;
}

/* ===================== DEFAULT STATE FACTORY ===================== */

export function createDefaultState(): AppState {
  return {
    currentSurah: 1,
    currentAyahIndex: 0,
    currentReciter: 'ar.alafasy',
    currentTafsirEdition: 'ar-tafsir-muyassar',
    surahData: null,
    surahList: [],
    surahCache: new Map(),
    ayahsAudios: [],
    isPlaying: false,
    hifdhMode: false,
    repeatMode: false,
    autoPlayNext: false,
    repeatFrom: 1,
    repeatTo: 1,
    repeatTimes: 3,
    repeatCounter: 0,
    fontSize: 28,
    nightMode: false,
    sepiaMode: false,
    autoSave: true,
    azanEnabled: false,
    azanFajrEnabled: false,
    city: CONFIG.DEFAULT_CITY,
    country: 'SA',
    method: '4',
    prayerTimes: null,
    lastAzanFired: null,
    favorites: [],
    bookmark: null,
    pendingTafsirAfterLoad: null,
    playerCollapsed: false,
    barCollapsed: true,
    azanPlaying: false,
    loadingSurah: null,
    mushafMode: false,
    currentPage: 1,
    fullQuranText: null,
    fullQuranLoaded: false,
    searchWords: [],
    searchTrie: null,
    ayahWordElements: null,
    translationEnabled: false,
    currentTranslation: null,
    translationData: null,
    adhkarSettings: null,
    adhkarPanelOpen: false,
    adhkarActiveTab: null,
    firedAdhkarToday: new Set<string>(),
    firedAdhkarDate: null,
    surahOffsets: null,
    ayahTimings: [],
    presentationMode: false,
    currentPageLayout: null,
    searchPrefixMap: null,
    fontType: 'amiri',
    lineSpacing: '1.8',
    tajweedEnabled: true,
    presBgMode: 'plain',
    presBgScene: 'stars',
    presBgNature: 'dawn',
  };
}

export interface PendingChange {
  key: string;
  newValue: unknown;
  oldValue: unknown;
}
