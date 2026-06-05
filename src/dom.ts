/** Cached DOM element references. */

/** Map of DOM IDs to their element types. */
interface DomMap {
  cityName: HTMLElement | null;
  nextPrayerName: HTMLElement | null;
  nextPrayerTime: HTMLElement | null;
  countdownDisplay: HTMLElement | null;
  hijriDateDisplay: HTMLElement | null;
  weekdayDisplay: HTMLElement | null;
  gregorianDateDisplay: HTMLElement | null;
  prayerTimesRows: HTMLElement | null;
  prayerCountdown: HTMLElement | null;
  bigClockTime: HTMLElement | null;
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
  clearSearchBtn: HTMLElement | null;
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
  repeatFrom: HTMLInputElement | null;
  repeatTo: HTMLInputElement | null;
  repeatTimes: HTMLInputElement | null;
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
  headerMenuBtn: HTMLElement | null;
  headerDropdown: HTMLElement | null;
  searchToggleBtn: HTMLElement | null;
  searchInputGroup: HTMLElement | null;
  playerMoreBtn: HTMLElement | null;
  playerMoreRow: HTMLElement | null;
  fontTypeSelect: HTMLSelectElement | null;
  lineSpacingSelect: HTMLSelectElement | null;
  tajweedToggle: HTMLInputElement | null;
  installBtn: HTMLElement | null;
  sleepTimerBtn: HTMLElement | null;
  networkBanner: HTMLElement | null;
  controls: HTMLElement | null;
}

export const dom: DomMap = {} as DomMap;

const DOM_IDS: (keyof DomMap)[] = [
  'cityName',
  'nextPrayerName',
  'nextPrayerTime',
  'countdownDisplay',
  'hijriDateDisplay',
  'weekdayDisplay',
  'gregorianDateDisplay',
  'prayerTimesRows',
  'prayerCountdown',
  'bigClockTime',
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
  'clearSearchBtn',
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
  'headerMenuBtn',
  'headerDropdown',
  'searchToggleBtn',
  'searchInputGroup',
  'playerMoreBtn',
  'playerMoreRow',
  'fontTypeSelect',
  'lineSpacingSelect',
  'tajweedToggle',
  'installBtn',
  'sleepTimerBtn',
  'networkBanner',
  'controls',
];

/** Cache all DOM element references by ID. */
export function cacheDom(): void {
  for (const id of DOM_IDS) {
    (dom as unknown as Record<string, HTMLElement | null>)[id] = document.getElementById(id);
  }
}
