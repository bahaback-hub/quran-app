/**
 * DOM Cache Module for Quran App.
 *
 * Provides a centralized, type-safe cache of all DOM element references
 * used throughout the application. Elements are looked up once by ID
 * during initialization (cacheDom) and stored in a typed proxy object.
 *
 * This approach:
 *   - Eliminates repeated document.getElementById() calls at runtime
 *   - Provides TypeScript type narrowing (HTMLSelectElement vs HTMLElement)
 *   - Serves as a single source of truth for all DOM IDs
 *   - Makes DOM refactoring safer (compile-time errors on typos)
 *
 * IMPORTANT: cacheDom() must be called AFTER injectOverlays() in the
 * app initialization sequence, otherwise dynamically injected elements
 * won't be found.
 */

/** Map of DOM IDs to their element types — each property is nullable until cacheDom() runs. */
interface DomMap {
  nextPrayerName: HTMLElement | null;
  nextPrayerTime: HTMLElement | null;
  countdownDisplay: HTMLElement | null;
  prayerTimesRows: HTMLElement | null;
  prayerCountdown: HTMLElement | null;
  bigClockTime: HTMLElement | null;
  bigClockTime2: HTMLElement | null;
  bigClockDate: HTMLElement | null;
  bigClockHijri: HTMLElement | null;
  settingsPanel: HTMLElement | null;
  settingsCloseBtn: HTMLElement | null;
  settingsToggleBtn: HTMLElement | null;
  themeToggle: HTMLElement | null;
  surahSelect: HTMLSelectElement | null;
  reciterSelect: HTMLSelectElement | null;
  searchInput: HTMLInputElement | null;
  searchBtn: HTMLElement | null;

  searchResults: HTMLElement | null;
  surahContent: HTMLElement | null;
  cityInput: HTMLInputElement | null;
  countryInput: HTMLInputElement | null;
  methodSelect: HTMLSelectElement | null;
  cityQuickSelect: HTMLSelectElement | null;
  saveLocationBtn: HTMLElement | null;
  azanToggle: HTMLInputElement | null;
  azanFajrToggle: HTMLInputElement | null;
  testAzanBtn: HTMLElement | null;
  fontSizeSelect: HTMLSelectElement | null;
  autoSaveToggle: HTMLInputElement | null;
  resetSettingsBtn: HTMLElement | null;
  favoritesPanel: HTMLElement | null;
  favoritesCloseBtn: HTMLElement | null;
  favoritesList: HTMLElement | null;
  favoritesOpenBtn: HTMLElement | null;
  player: HTMLElement | null;
  collapsePlayerBtn: HTMLElement | null;
  playPauseBtn: HTMLElement | null;
  collapsedPlayBtn: HTMLElement | null;
  playerSurahName: HTMLElement | null;
  playerReciterName: HTMLElement | null;
  collapsedContent: HTMLElement | null;
  playerCurrentAyah: HTMLElement | null;
  collapsedInfo: HTMLElement | null;
  audioPlayer: HTMLAudioElement | null;
  audioPlayer2: HTMLAudioElement | null;
  speedSelect: HTMLSelectElement | null;
  prevAyahBtn: HTMLElement | null;
  nextAyahBtn: HTMLElement | null;
  prevSurahBtn: HTMLElement | null;
  nextSurahBtn: HTMLElement | null;
  hifdhBtn: HTMLElement | null;
  repeatBtn: HTMLElement | null;
  bookmarkBtn: HTMLElement | null;
  favoriteBtn: HTMLElement | null;
  shareBtn: HTMLElement | null;
  repeatControls: HTMLElement | null;
  repeatFrom: HTMLSelectElement | null;
  repeatTo: HTMLSelectElement | null;
  repeatTimes: HTMLSelectElement | null;
  shareMenu: HTMLElement | null;
  azanPlayer: HTMLAudioElement | null;
  toast: HTMLElement | null;
  collapseBarBtn: HTMLElement | null;
  expandBarBtn: HTMLElement | null;
  prayerBar: HTMLElement | null;
  tafsirCurtainHandle: HTMLElement | null;
  tafsirCurtain: HTMLElement | null;
  tafsirCurtainHeader: HTMLElement | null;
  tafsirCurtainBody: HTMLElement | null;
  tafsirSelect: HTMLSelectElement | null;
  loadingProgress: HTMLElement | null;
  pageSelect: HTMLSelectElement | null;
  pageIndicator: HTMLElement | null;
  azanNotification: HTMLElement | null;
  azanNotifPrayer: HTMLElement | null;
  azanNotifStopBtn: HTMLElement | null;
  mushafSurahOverlay: HTMLElement | null;
  mushafSurahOverlayClose: HTMLElement | null;
  mushafSurahOverlayList: HTMLElement | null;
  pageSlider: HTMLInputElement | null;
  voiceSearchBtn: HTMLElement | null;
  kbdToggleBtn: HTMLElement | null;
  langSelect: HTMLSelectElement | null;
  translationSelect: HTMLSelectElement | null;
  translationToggle: HTMLElement | null;
  adhkarBtn: HTMLElement | null;
  qiblaBtn: HTMLElement | null;
  adhkarPanel: HTMLElement | null;
  adhkarCloseBtn: HTMLElement | null;
  adhkarTabs: HTMLElement | null;
  adhkarContent: HTMLElement | null;
  adhkarEnabledToggle: HTMLInputElement | null;
  adhkarSoundToggle: HTMLInputElement | null;
  adhkarSettingsList: HTMLElement | null;
  adhkarNotification: HTMLElement | null;
  adhkarNotifIcon: HTMLElement | null;
  adhkarNotifTitle: HTMLElement | null;
  adhkarNotifText: HTMLElement | null;
  adhkarNotifProgress: HTMLElement | null;
  adhkarNotifShareBtn: HTMLElement | null;
  adhkarNotifOpenBtn: HTMLElement | null;
  adhkarNotifDismissBtn: HTMLElement | null;
  adhkarAddOverlay: HTMLElement | null;
  adhkarAddCloseBtn: HTMLElement | null;
  adhkarAddText: HTMLInputElement | null;
  adhkarAddCount: HTMLInputElement | null;
  adhkarAddTime: HTMLInputElement | null;
  adhkarAddDuration: HTMLInputElement | null;
  adhkarAddSaveBtn: HTMLElement | null;
  surahSecretsOverlay: HTMLElement | null;
  surahSecretsCloseBtn: HTMLElement | null;
  surahSecretsBody: HTMLElement | null;
  surahSecretsTitle: HTMLElement | null;
  surahSecretsSurahName: HTMLElement | null;
  presentationOverlay: HTMLElement | null;
  presentationBody: HTMLElement | null;
  presentationAyahText: HTMLElement | null;
  presentationAyahNum: HTMLElement | null;
  presentationTitle: HTMLElement | null;
  presentationCloseBtn: HTMLElement | null;
  presentationPrevBtn: HTMLElement | null;
  presentationNextBtn: HTMLElement | null;
  presentationCounter: HTMLElement | null;
  presentationTranslation: HTMLElement | null;
  presPlayPauseBtn: HTMLElement | null;
  presTajweedBtn: HTMLElement | null;
  presFullscreenBtn: HTMLElement | null;
  viewSurahBtn: HTMLElement | null;
  viewMushafBtn: HTMLElement | null;
  viewPresBtn: HTMLElement | null;
  qiblaOverlay: HTMLElement | null;
  qiblaCompass: HTMLElement | null;
  qiblaAngle: HTMLElement | null;
  qiblaDirection: HTMLElement | null;
  qiblaCloseBtn: HTMLElement | null;
  readingStatsPanel: HTMLElement | null;
  readingStatsContent: HTMLElement | null;
  readingStatsCloseBtn: HTMLElement | null;

  searchToggleBtn: HTMLElement | null;
  searchInputGroup: HTMLElement | null;
  playerMoreBtn: HTMLElement | null;
  playerMoreRow: HTMLElement | null;
  fontTypeSelect: HTMLSelectElement | null;
  lineSpacingSelect: HTMLSelectElement | null;
  tajweedToggle: HTMLInputElement | null;
  presBgSelect: HTMLSelectElement | null;
  presBgSceneSelect: HTMLSelectElement | null;
  presBgSceneRow: HTMLElement | null;
  presBgNatureSelect: HTMLSelectElement | null;
  presBgNatureRow: HTMLElement | null;
  installBtn: HTMLElement | null;
  sleepTimerBtn: HTMLElement | null;
  downloadAudioBtn: HTMLElement | null;
  autoPlayNextBtn: HTMLElement | null;
  helpToggleBtn: HTMLElement | null;
  helpPanel: HTMLElement | null;
  helpCloseBtn: HTMLElement | null;
  networkBanner: HTMLElement | null;
  controls: HTMLElement | null;
}

/**
 * All DOM IDs to cache — single source of truth for both initialization and cacheDom.
 * Order matches the DOM structure for readability; new elements should be appended.
 */
const DOM_IDS: (keyof DomMap)[] = [
  'nextPrayerName',
  'nextPrayerTime',
  'countdownDisplay',
  'prayerTimesRows',
  'prayerCountdown',
  'bigClockTime',
  'bigClockTime2',
  'bigClockDate',
  'bigClockHijri',
  'settingsPanel',
  'settingsCloseBtn',
  'settingsToggleBtn',
  'themeToggle',
  'surahSelect',
  'reciterSelect',
  'searchInput',
  'searchBtn',
  'searchResults',
  'surahContent',
  'cityInput',
  'countryInput',
  'methodSelect',
  'cityQuickSelect',
  'saveLocationBtn',
  'azanToggle',
  'azanFajrToggle',
  'testAzanBtn',
  'fontSizeSelect',
  'autoSaveToggle',
  'resetSettingsBtn',
  'favoritesPanel',
  'favoritesCloseBtn',
  'favoritesList',
  'favoritesOpenBtn',
  'player',
  'collapsePlayerBtn',
  'playPauseBtn',
  'collapsedPlayBtn',
  'playerSurahName',
  'playerReciterName',
  'collapsedContent',
  'playerCurrentAyah',
  'collapsedInfo',
  'audioPlayer',
  'audioPlayer2',
  'speedSelect',
  'prevAyahBtn',
  'nextAyahBtn',
  'prevSurahBtn',
  'nextSurahBtn',
  'hifdhBtn',
  'repeatBtn',
  'bookmarkBtn',
  'favoriteBtn',
  'shareBtn',
  'repeatControls',
  'repeatFrom',
  'repeatTo',
  'repeatTimes',
  'shareMenu',
  'azanPlayer',
  'toast',
  'collapseBarBtn',
  'expandBarBtn',
  'prayerBar',
  'tafsirCurtainHandle',
  'tafsirCurtain',
  'tafsirCurtainHeader',
  'tafsirCurtainBody',
  'tafsirSelect',
  'loadingProgress',
  'pageSelect',
  'pageIndicator',
  'azanNotification',
  'azanNotifPrayer',
  'azanNotifStopBtn',
  'mushafSurahOverlay',
  'mushafSurahOverlayClose',
  'mushafSurahOverlayList',
  'pageSlider',
  'voiceSearchBtn',
  'kbdToggleBtn',
  'langSelect',
  'translationSelect',
  'translationToggle',
  'adhkarBtn',
  'qiblaBtn',
  'adhkarPanel',
  'adhkarCloseBtn',
  'adhkarTabs',
  'adhkarContent',
  'adhkarEnabledToggle',
  'adhkarSoundToggle',
  'adhkarSettingsList',
  'adhkarNotification',
  'adhkarNotifIcon',
  'adhkarNotifTitle',
  'adhkarNotifText',
  'adhkarNotifProgress',
  'adhkarNotifShareBtn',
  'adhkarNotifOpenBtn',
  'adhkarNotifDismissBtn',
  'adhkarAddOverlay',
  'adhkarAddCloseBtn',
  'adhkarAddText',
  'adhkarAddCount',
  'adhkarAddTime',
  'adhkarAddDuration',
  'adhkarAddSaveBtn',
  'surahSecretsOverlay',
  'surahSecretsCloseBtn',
  'surahSecretsBody',
  'surahSecretsTitle',
  'surahSecretsSurahName',
  'presentationOverlay',
  'presentationBody',
  'presentationAyahText',
  'presentationAyahNum',
  'presentationTitle',
  'presentationCloseBtn',
  'presentationPrevBtn',
  'presentationNextBtn',
  'presentationCounter',
  'presentationTranslation',
  'presPlayPauseBtn',
  'presTajweedBtn',
  'presFullscreenBtn',
  'viewSurahBtn',
  'viewMushafBtn',
  'viewPresBtn',
  'qiblaOverlay',
  'qiblaCompass',
  'qiblaAngle',
  'qiblaDirection',
  'qiblaCloseBtn',
  'readingStatsPanel',
  'readingStatsContent',
  'readingStatsCloseBtn',
  'searchToggleBtn',
  'searchInputGroup',
  'playerMoreBtn',
  'playerMoreRow',
  'fontTypeSelect',
  'lineSpacingSelect',
  'tajweedToggle',
  'presBgSelect',
  'presBgSceneSelect',
  'presBgSceneRow',
  'presBgNatureSelect',
  'presBgNatureRow',
  'installBtn',
  'sleepTimerBtn',
  'downloadAudioBtn',
  'autoPlayNextBtn',
  'helpToggleBtn',
  'helpPanel',
  'helpCloseBtn',
  'networkBanner',
  'controls',
];

/**
 * Create a fully-typed DOM map with all properties initialized to null.
 * This avoids the unsafe `{} as DomMap` cast by providing a proper default
 * with all keys explicitly set, ensuring no undefined access surprises.
 */
function createEmptyDomMap(): DomMap {
  const empty = {} as Record<string, HTMLElement | null>;
  for (const id of DOM_IDS) {
    empty[id] = null;
  }
  return empty as unknown as DomMap;
}

/** Cached DOM element references — all initialized to null, populated by cacheDom(). */
export const dom: DomMap = createEmptyDomMap();

/**
 * Cache all DOM element references by ID.
 *
 * Iterates over DOM_IDS, looks up each element via document.getElementById(),
 * and stores the result in the typed `dom` object. Called once during app
 * initialization, after injectOverlays() has injected dynamic panels.
 *
 * Elements not found in the DOM will remain null in the dom object.
 */
export function cacheDom(): void {
  for (const id of DOM_IDS) {
    // Dynamic property assignment on typed DOM map — cast required for indexed access
    (dom as unknown as Record<string, HTMLElement | null>)[id] = document.getElementById(id);
  }
}
