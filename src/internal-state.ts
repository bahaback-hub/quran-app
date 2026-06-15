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
/**
 * Get the AudioContext used for adhkar notification sounds.
 *
 * @returns The current AudioContext instance, or null if not initialized
 */
export function getAdhkarAudioCtx(): AudioContext | null {
  return _adhkarAudioCtx;
}

/**
 * Set the AudioContext used for adhkar notification sounds.
 *
 * @param ctx The AudioContext instance to store, or null to clear
 */
export function setAdhkarAudioCtx(ctx: AudioContext | null): void {
  _adhkarAudioCtx = ctx;
}

// --- _selectMode ---

/**
 * Get whether multi-ayah select mode is active.
 *
 * @returns true if select mode is currently enabled
 */
export function getSelectMode(): boolean {
  return _selectMode;
}

/**
 * Set whether multi-ayah select mode is active.
 *
 * @param mode Whether select mode should be enabled
 */
export function setSelectMode(mode: boolean): void {
  _selectMode = mode;
}

/**
 * Toggle multi-ayah select mode on/off.
 *
 * @returns The new state of select mode after toggling
 */
export function toggleSelectMode(): boolean {
  _selectMode = !_selectMode;
  return _selectMode;
}

// --- _selectedAyahs ---

/**
 * Get the list of currently selected ayahs in select mode.
 *
 * @returns A copy of the selected ayahs array
 */
export function getSelectedAyahs(): SelectedAyah[] {
  return _selectedAyahs;
}

/**
 * Replace the entire selected ayahs list.
 *
 * @param ayahs The new array of selected ayahs
 */
export function setSelectedAyahs(ayahs: SelectedAyah[]): void {
  _selectedAyahs = ayahs;
}

/**
 * Add an ayah to the selected ayahs list (immutable push).
 *
 * @param ayah The ayah to add to the selection
 */
export function pushSelectedAyah(ayah: SelectedAyah): void {
  _selectedAyahs = [..._selectedAyahs, ayah];
}

/**
 * Filter the selected ayahs list in place using a predicate.
 *
 * @param predicate A function that returns true for ayahs to keep
 */
export function filterSelectedAyahs(predicate: (a: SelectedAyah) => boolean): void {
  _selectedAyahs = _selectedAyahs.filter(predicate);
}

// --- _voiceListening ---

/**
 * Get whether voice search is currently listening.
 *
 * @returns true if voice recognition is actively listening
 */
export function getVoiceListening(): boolean {
  return _voiceListening;
}

/**
 * Set whether voice search is currently listening.
 *
 * @param listening Whether voice recognition is actively listening
 */
export function setVoiceListening(listening: boolean): void {
  _voiceListening = listening;
}

// --- _voiceRecognition ---

/**
 * Get the SpeechRecognition instance used for voice search.
 *
 * @returns The current SpeechRecognition instance, or null if not initialized
 */
export function getVoiceRecognition(): unknown {
  return _voiceRecognition;
}

/**
 * Set the SpeechRecognition instance for voice search.
 *
 * @param recognition The SpeechRecognition instance to store
 */
export function setVoiceRecognition(recognition: unknown): void {
  _voiceRecognition = recognition;
}

// --- _smartTvState ---

/**
 * Get the current Smart TV navigation state value.
 *
 * @returns The numeric Smart TV navigation state
 */
export function getSmartTvState(): number {
  return _smartTvState;
}

/**
 * Set the Smart TV navigation state value.
 *
 * @param s The new Smart TV navigation state value
 */
export function setSmartTvState(s: number): void {
  _smartTvState = s;
}

// --- _smartTvAudioSrc ---

/**
 * Get the Smart TV audio source URL.
 *
 * @returns The current audio source URL for Smart TV playback
 */
export function getSmartTvAudioSrc(): string {
  return _smartTvAudioSrc;
}

/**
 * Set the Smart TV audio source URL.
 *
 * @param src The audio source URL to use for Smart TV playback
 */
export function setSmartTvAudioSrc(src: string): void {
  _smartTvAudioSrc = src;
}

// --- _updateReadingProgress ---

/**
 * Get the callback for updating reading progress.
 *
 * @returns The current reading progress update callback, or null if not set
 */
export function getUpdateReadingProgress(): (() => void) | null {
  return _updateReadingProgress;
}

/**
 * Set the callback for updating reading progress.
 *
 * @param fn The callback function to invoke on reading progress updates, or null to clear
 */
export function setUpdateReadingProgress(fn: (() => void) | null): void {
  _updateReadingProgress = fn;
}

// --- _allSearchMatches ---

/**
 * Get all search matches from the current search query (before pagination).
 *
 * @returns The full array of search matches, or null if no search has been performed
 */
export function getAllSearchMatches(): QuranTextEntry[] | null {
  return _allSearchMatches;
}

/**
 * Set the full list of search matches for the current query.
 *
 * @param matches The array of search matches, or null to clear
 */
export function setAllSearchMatches(matches: QuranTextEntry[] | null): void {
  _allSearchMatches = matches;
}

// --- _searchResultsPage ---

/**
 * Get the current search results page number (1-based).
 *
 * @returns The current page number in the paginated search results
 */
export function getSearchResultsPage(): number {
  return _searchResultsPage;
}

/**
 * Set the current search results page number.
 *
 * @param page The 1-based page number to set
 */
export function setSearchResultsPage(page: number): void {
  _searchResultsPage = page;
}

// --- _editPersonalAdhkarId ---

/**
 * Get the ID of the personal adhkar entry currently being edited.
 *
 * @returns The adhkar entry ID, or null if not editing
 */
export function getEditPersonalAdhkarId(): string | null {
  return _editPersonalAdhkarId;
}

/**
 * Set the ID of the personal adhkar entry being edited.
 *
 * @param id The adhkar entry ID to edit, or null to clear
 */
export function setEditPersonalAdhkarId(id: string | null): void {
  _editPersonalAdhkarId = id;
}

let _adhkarNotificationTimer: ReturnType<typeof setTimeout> | null = null;
let _adhkarIntervalId: ReturnType<typeof setInterval> | null = null;

// --- _adhkarNotificationTimer ---

/**
 * Get the adhkar notification timer reference.
 *
 * @returns The current timer handle, or null if no timer is active
 */
export function getAdhkarNotificationTimer(): ReturnType<typeof setTimeout> | null {
  return _adhkarNotificationTimer;
}

/**
 * Set the adhkar notification timer reference.
 *
 * @param val The timer handle to store, or null to clear
 */
export function setAdhkarNotificationTimer(val: ReturnType<typeof setTimeout> | null): void {
  _adhkarNotificationTimer = val;
}

// --- _adhkarIntervalId ---

/**
 * Get the adhkar interval timer reference.
 *
 * @returns The current interval handle, or null if no interval is active
 */
export function getAdhkarIntervalId(): ReturnType<typeof setInterval> | null {
  return _adhkarIntervalId;
}

/**
 * Set the adhkar interval timer reference.
 *
 * @param val The interval handle to store, or null to clear
 */
export function setAdhkarIntervalId(val: ReturnType<typeof setInterval> | null): void {
  _adhkarIntervalId = val;
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
  _adhkarNotificationTimer = null;
  _adhkarIntervalId = null;
}
