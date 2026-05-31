/** Cached DOM element references. */
export const dom = {};

const DOM_IDS = [
  'cityName', 'nextPrayerName', 'nextPrayerTime', 'countdownDisplay',
  'hijriDateDisplay', 'weekdayDisplay', 'gregorianDateDisplay',
  'prayerTimesRows', 'prayerCountdown', 'bigClockTime', 'bigClockDate',
  'bigClockHijri', 'settingsPanel', 'settingsCloseBtn', 'settingsToggleBtn',
  'themeToggle', 'surahSelect', 'reciterSelect', 'searchInput',
  'searchBtn', 'clearSearchBtn', 'searchResults', 'surahContent',
  'cityInput', 'countryInput', 'methodSelect', 'cityQuickSelect',
  'saveLocationBtn', 'azanToggle', 'azanFajrToggle', 'testAzanBtn',
  'fontSizeSelect', 'autoSaveToggle', 'resetSettingsBtn',
  'favoritesPanel', 'favoritesCloseBtn', 'favoritesList', 'favoritesOpenBtn',
  'player', 'collapsePlayerBtn', 'collapsedExpandBtn', 'playPauseBtn',
  'collapsedPlayBtn', 'playerSurahName', 'playerReciterName',
  'collapsedContent',
  'playerCurrentAyah', 'collapsedInfo',
  'audioPlayer', 'speedSelect', 'prevAyahBtn', 'nextAyahBtn',
  'prevSurahBtn', 'nextSurahBtn', 'hifdhBtn', 'repeatBtn', 'bookmarkBtn',
  'favoriteBtn', 'shareBtn',
  'repeatControls', 'repeatFrom', 'repeatTo', 'repeatTimes', 'shareMenu',
  'azanPlayer', 'toast', 'collapseBarBtn', 'expandBarBtn',
  'prayerBar',
  'tafsirCurtainHandle', 'tafsirCurtain', 'tafsirCurtainHeader',
  'tafsirCurtainBody', 'tafsirSelect', 'bgSelect', 'loadingProgress',
  'modeToggleBtn', 'pageSelect', 'pageIndicator', 'surahModeControls',
  'azanNotification', 'azanNotifPrayer', 'azanNotifStopBtn',
  'mushafSurahOverlay', 'mushafSurahOverlayClose',
   'mushafSurahOverlayList', 'pageSlider', 'voiceSearchBtn', 'kbdToggleBtn',
  'langSelect',
  'translationSelect', 'translationToggle', 'translationPanel',
  'welcomeScreen', 'welcomeDismissBtn',
  'adhkarBtn', 'adhkarPanel', 'adhkarCloseBtn', 'adhkarTabs', 'adhkarContent',
  'adhkarEnabledToggle', 'adhkarSoundToggle', 'adhkarSettingsList',
  'adhkarNotification', 'adhkarNotifIcon', 'adhkarNotifTitle',
  'adhkarNotifText', 'adhkarNotifProgress', 'adhkarNotifShareBtn',
  'adhkarNotifOpenBtn', 'adhkarNotifDismissBtn',
  'adhkarAddOverlay', 'adhkarAddCloseBtn', 'adhkarAddText',
  'adhkarAddCount', 'adhkarAddTime', 'adhkarAddDuration', 'adhkarAddSaveBtn',
  'surahSecretsOverlay', 'surahSecretsCloseBtn', 'surahSecretsBody', 'surahSecretsTitle', 'surahSecretsSurahName',
  // Presentation mode
  'presentationOverlay', 'presentationBody', 'presentationAyahText',
  'presentationAyahNum', 'presentationTitle', 'presentationCloseBtn',
  'presentationPrevBtn', 'presentationNextBtn', 'presentationCounter',
   'presentationTranslation',
   'viewSurahBtn', 'viewMushafBtn', 'viewPresBtn',
   // Qibla
   'qiblaOverlay', 'qiblaCompass', 'qiblaAngle', 'qiblaDirection', 'qiblaCloseBtn',
   // Reading stats
   'readingStatsPanel', 'readingStatsContent', 'readingStatsCloseBtn',
   // Header menu
   'headerMenuBtn', 'headerDropdown',
   // Search toggle
   'searchToggleBtn', 'searchInputGroup',
   // Player more
   'playerMoreBtn', 'playerMoreRow'
];

/** Cache all DOM element references by ID. */
export function cacheDom() {
  for (const id of DOM_IDS) {
    dom[id] = document.getElementById(id);
  }
}
