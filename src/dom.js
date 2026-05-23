export const dom = {};

const DOM_IDS = [
  'cityName', 'nextPrayerName', 'nextPrayerTime', 'countdownDisplay',
  'hijriDateDisplay', 'weekdayDisplay', 'gregorianDateDisplay',
  'prayerTimesRows', 'prayerCountdown', 'bigClockTime', 'bigClockDate',
  'bigClockHijri', 'settingsPanel', 'settingsCloseBtn', 'settingsToggleBtn',
  'themeToggle', 'surahSelect', 'reciterSelect', 'searchType', 'searchInput',
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
  'azanPlayer', 'toast', 'fontSizeDropdown', 'collapseBarBtn', 'expandBarBtn',
  'prayerBar',
  'tafsirCurtainHandle', 'tafsirCurtain', 'tafsirCurtainHeader',
  'tafsirCurtainBody', 'tafsirSelect', 'bgSelect', 'loadingProgress',
  'modeToggleBtn', 'pageSelect', 'pageIndicator', 'surahModeControls',
  'azanNotification', 'azanNotifStopBtn',
  'mushafSurahOverlay', 'mushafSurahOverlayClose',
   'mushafSurahOverlayList', 'pageSlider', 'voiceSearchBtn', 'kbdToggleBtn',
  'langSelect',
  'translationSelect', 'translationToggle', 'translationPanel',
  'welcomeScreen', 'welcomeDismissBtn'
];

export function cacheDom() {
  for (const id of DOM_IDS) {
    dom[id] = document.getElementById(id);
  }
}
