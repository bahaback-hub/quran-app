/**
 * Centralized HTML Template Functions for Quran App.
 *
 * Barrel module: the actual template functions live in small domain files
 * (templates-surah, templates-search, templates-mushaf, templates-favorites,
 * templates-prayer, templates-adhkar, templates-feedback, templates-panels)
 * and are re-exported here so existing imports from './templates.js'
 * continue to work unchanged.
 *
 * Security note: All template functions MUST escape user-provided text
 * using the `escapeHtml` utility to prevent XSS.
 */

// Single source of truth for HTML escaping (prevents XSS). Re-exported so
// existing `./templates.js` importers keep working unchanged.
export { escapeHtml } from './templates/escape.js';

export {
  surahOption,
  surahListOptions,
  mushafSurahItem,
  ayahElement,
  surahSelectLoading,
  surahSelectError,
  surahSelectDefault,
  reciterOptions,
  skeletonLoading,
  surahLoadError,
  surahContentShell,
  collapsedPlayerInfo,
} from './templates-surah.js';

export {
  searchResultItem,
  searchEmptyResults,
  searchResultsHeader,
  searchResultCard,
  searchLoadMoreButton,
  searchHistoryItem,
  searchAutocompleteItem,
} from './templates-search.js';

export {
  mushafLoadingState,
  surahLoadingMessage,
  mushafHeaderRow,
  mushafErrorFallback,
  mushafSurahNameSpan,
  surahSecretsBody,
} from './templates-mushaf.js';

export {
  favoriteItem,
  emptyFavoritesMessage,
  favoritesEmptyMessage,
  favoritesCountMessage,
  favoriteMeta,
} from './templates-favorites.js';

export { prayerTimeRow, prayerTimesRows } from './templates-prayer.js';

export { adhkarItem, adhkarTab, adhkarCategoryTitle, adhkarItemCard, adhkarSettingRow } from './templates-adhkar.js';

export {
  errorOverlay,
  errorRecoveryOverlay,
  loadingSkeleton,
  qariOption,
  tafsirLoading,
  tafsirContent,
  tafsirErrorMessage,
  updateBanner,
  readingStatsGrid,
} from './templates-feedback.js';

// The four large panel templates (settingsPanelHTML, floatingPlayerHTML,
// arabicKeyboardHTML, helpPanelHTML) were extracted to templates-panels.ts.
// They are re-exported here so existing imports from './templates.js'
// continue to work unchanged.
export { settingsPanelHTML, floatingPlayerHTML, arabicKeyboardHTML, helpPanelHTML } from './templates-panels.js';
