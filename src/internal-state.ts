/**
 * Internal (private) state — module-level variables that don't belong
 * in the public AppState interface. These are implementation details,
 * timers, and internal flags that should not be exposed to consumers.
 *
 * Each variable has a getter and setter for controlled access.
 */

import type { SelectedAyah, QuranTextEntry } from './state.js';

/* ===================== INTERNAL STATE VARIABLES ===================== */

/** AudioContext for adhkar notification sounds. */
let _adhkarAudioCtx: AudioContext | null = null;

/** Whether multi-ayah select mode is active. */
let _selectMode: boolean = false;

/** Currently selected ayahs in select mode. */
let _selectedAyahs: SelectedAyah[] = [];

/** Whether voice search is currently listening. */
let _voiceListening: boolean = false;

/** SpeechRecognition instance for voice search. */
let _voiceRecognition: unknown = null;

/** Smart TV navigation state. */
let _smartTvState: number = 0;

/** Smart TV audio source URL. */
let _smartTvAudioSrc: string = '';

/** Callback for updating reading progress (set from ui-extras). */
let _updateReadingProgress: (() => void) | null = null;

/** All search matches from a search query (before pagination). */
let _allSearchMatches: QuranTextEntry[] | null = null;

/** Current search results page number (1-based). */
let _searchResultsPage: number = 1;

/** ID of personal adhkar entry currently being edited. */
let _editPersonalAdhkarId: string | null = null;

/* ===================== GETTERS & SETTERS ===================== */

// --- _adhkarAudioCtx ---
export function getAdhkarAudioCtx(): AudioContext | null {
  return _adhkarAudioCtx;
}
export function setAdhkarAudioCtx(ctx: AudioContext | null): void {
  _adhkarAudioCtx = ctx;
}

// --- _selectMode ---
export function getSelectMode(): boolean {
  return _selectMode;
}
export function setSelectMode(mode: boolean): void {
  _selectMode = mode;
}
export function toggleSelectMode(): boolean {
  _selectMode = !_selectMode;
  return _selectMode;
}

// --- _selectedAyahs ---
export function getSelectedAyahs(): SelectedAyah[] {
  return _selectedAyahs;
}
export function setSelectedAyahs(ayahs: SelectedAyah[]): void {
  _selectedAyahs = ayahs;
}
export function pushSelectedAyah(ayah: SelectedAyah): void {
  _selectedAyahs = [..._selectedAyahs, ayah];
}
export function filterSelectedAyahs(predicate: (a: SelectedAyah) => boolean): void {
  _selectedAyahs = _selectedAyahs.filter(predicate);
}

// --- _voiceListening ---
export function getVoiceListening(): boolean {
  return _voiceListening;
}
export function setVoiceListening(listening: boolean): void {
  _voiceListening = listening;
}

// --- _voiceRecognition ---
export function getVoiceRecognition(): unknown {
  return _voiceRecognition;
}
export function setVoiceRecognition(recognition: unknown): void {
  _voiceRecognition = recognition;
}

// --- _smartTvState ---
export function getSmartTvState(): number {
  return _smartTvState;
}
export function setSmartTvState(s: number): void {
  _smartTvState = s;
}

// --- _smartTvAudioSrc ---
export function getSmartTvAudioSrc(): string {
  return _smartTvAudioSrc;
}
export function setSmartTvAudioSrc(src: string): void {
  _smartTvAudioSrc = src;
}

// --- _updateReadingProgress ---
export function getUpdateReadingProgress(): (() => void) | null {
  return _updateReadingProgress;
}
export function setUpdateReadingProgress(fn: (() => void) | null): void {
  _updateReadingProgress = fn;
}

// --- _allSearchMatches ---
export function getAllSearchMatches(): QuranTextEntry[] | null {
  return _allSearchMatches;
}
export function setAllSearchMatches(matches: QuranTextEntry[] | null): void {
  _allSearchMatches = matches;
}

// --- _searchResultsPage ---
export function getSearchResultsPage(): number {
  return _searchResultsPage;
}
export function setSearchResultsPage(page: number): void {
  _searchResultsPage = page;
}

// --- _editPersonalAdhkarId ---
export function getEditPersonalAdhkarId(): string | null {
  return _editPersonalAdhkarId;
}
export function setEditPersonalAdhkarId(id: string | null): void {
  _editPersonalAdhkarId = id;
}

/* ===================== RESET ===================== */

/** Reset all internal state to defaults. Called during state reset. */
export function resetInternalState(): void {
  _adhkarAudioCtx = null;
  _selectMode = false;
  _selectedAyahs = [];
  _voiceListening = false;
  _voiceRecognition = null;
  _smartTvState = 0;
  _smartTvAudioSrc = '';
  _updateReadingProgress = null;
  _allSearchMatches = null;
  _searchResultsPage = 1;
  _editPersonalAdhkarId = null;
}
