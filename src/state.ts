/** Surah list entry shape. */
export interface SurahInfo {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

/** Favorite ayah entry. */
export interface FavoriteEntry {
  key: string;
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  timestamp: number;
}

/** Bookmark entry. */
export interface BookmarkEntry {
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  timestamp: number;
}

/** Full Quran text entry (for search index). */
export interface QuranTextEntry {
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  normalized: string;
}

/** Selected ayah entry (select mode). */
export interface SelectedAyah {
  surah: number;
  ayah: number;
  text: string;
  surahName: string;
  index: number;
}

/** Surah offset entry (for mushaf navigation). */
export interface SurahOffset {
  surahNum: number;
  startAbs: number;
  count: number;
  name: string;
}

/** Background entry. */
export interface BackgroundEntry {
  id: string;
  name: string;
  type?: string;
  css?: string;
  cssBlock?: string;
}

/** Search word entry. */
export interface SearchWord {
  word: string;
  count: number;
}

/** Application state — shared across all modules. */
export interface AppState {
  currentSurah: number;
  currentAyahIndex: number;
  currentReciter: string;
  currentTafsirEdition: string;
  surahData: Record<string, unknown> | null;
  surahList: SurahInfo[];
  surahCache: Map<unknown, unknown>;
  ayahsAudios: string[];
  isPlaying: boolean;
  hifdhMode: boolean;
  repeatMode: boolean;
  repeatFrom: number;
  repeatTo: number;
  repeatTimes: number;
  repeatCounter: number;
  fontSize: number;
  nightMode: boolean;
  autoSave: boolean;
  azanEnabled: boolean;
  azanFajrEnabled: boolean;
  city: string;
  country: string;
  method: string;
  prayerTimes: Record<string, unknown> | null;
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
  adhkarSettings: Record<string, unknown> | null;
  adhkarPanelOpen: boolean;
  adhkarActiveTab: string | null;
  lastAdhkarFired: string | null;
  adhkarNotificationTimer: ReturnType<typeof setTimeout> | null;
  adhkarIntervalId: ReturnType<typeof setInterval> | null;
  _adhkarAudioCtx: AudioContext | null;
  _selectMode: boolean;
  _selectedAyahs: SelectedAyah[];
  _voiceListening: boolean;
  _voiceRecognition: unknown;
  _smartTvState: number;
  _smartTvAudioSrc: string;
  surahOffsets: SurahOffset[] | null;
  backgroundsList: BackgroundEntry[] | null;
  ayahTimings: number[];
  presentationMode: boolean;
  _updateReadingProgress: (() => void) | null;
  currentPageLayout: Record<string, unknown> | null;
  _allSearchMatches: QuranTextEntry[] | null;
  _searchResultsPage: number;
  _editPersonalAdhkarId: string | null;
  searchPrefixMap: Map<string, unknown> | null;
  sepiaMode: boolean;
  fontType: string;
  lineSpacing: string;
  tajweedEnabled: boolean;
}

/** @type {AppState} */
export let state: AppState = {} as AppState;
