/**
 * Tests for templates.ts — centralized HTML template functions.
 * Comprehensive tests covering all exported template functions.
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  surahOption,
  surahListOptions,
  favoriteItem,
  emptyFavoritesMessage,
  searchResultItem,
  searchResultCard,
  prayerTimeRow,
  prayerTimesRows,
  errorOverlay,
  loadingSkeleton,
  adhkarItem,
  surahSelectLoading,
  surahSelectError,
  surahSelectDefault,
  reciterOptions,
  skeletonLoading,
  surahLoadError,
  surahContentShell,
  collapsedPlayerInfo,
  favoritesEmptyMessage,
  favoriteMeta,
  searchEmptyResults,
  searchResultsHeader,
  searchLoadMoreButton,
  searchHistoryItem,
  searchAutocompleteItem,
  tafsirLoading,
  tafsirContent,
  tafsirErrorMessage,
  qariOption,
  mushafLoadingState,
  surahLoadingMessage,
  mushafHeaderRow,
  mushafErrorFallback,
  mushafSurahNameSpan,
  surahSecretsBody,
  updateBanner,
  adhkarTab,
  adhkarCategoryTitle,
  adhkarItemCard,
  adhkarSettingRow,
  readingStatsGrid,
  errorRecoveryOverlay,
  // New template functions
  settingsPanelHTML,
  floatingPlayerHTML,
  arabicKeyboardHTML,
  ayahElement,
  mushafSurahItem,
} from '../templates.js';

describe('escapeHtml', () => {
  it('should escape ampersands', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('should escape angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('should escape quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('should handle empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should return plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('should escape a full XSS payload', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should return empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('should handle multiple ampersands', () => {
    expect(escapeHtml('a&b&c')).toBe('a&amp;b&amp;c');
  });

  it('should handle mixed special characters', () => {
    expect(escapeHtml('<a href="x">&amp;</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;amp;&lt;/a&gt;');
  });
});

describe('Surah templates', () => {
  const mockSurah = { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 };

  it('surahOption should generate correct HTML', () => {
    const result = surahOption(mockSurah);
    expect(result).toContain('value="1"');
    expect(result).toContain('الفاتحة');
    expect(result).not.toContain('selected');
  });

  it('surahOption with selected=true should include selected attribute', () => {
    const result = surahOption(mockSurah, true);
    expect(result).toContain('selected');
  });

  it('surahOption with selected=false should not include selected attribute', () => {
    const result = surahOption(mockSurah, false);
    expect(result).not.toContain('selected');
  });

  it('surahOption should escape special chars in name', () => {
    const surah = { number: 1, name: '<script>', englishName: 'Test', numberOfAyahs: 1 };
    const result = surahOption(surah);
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('surahListOptions should generate options for all surahs', () => {
    const list = [mockSurah, { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', numberOfAyahs: 286 }];
    const result = surahListOptions(list, 2);
    expect(result).toContain('value="1"');
    expect(result).toContain('value="2"');
    expect(result).toContain('البقرة');
  });

  it('surahListOptions should mark the current surah as selected', () => {
    const list = [mockSurah, { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', numberOfAyahs: 286 }];
    const result = surahListOptions(list, 1);
    // First surah should be selected
    expect(result).toContain('value="1" selected');
  });

  it('surahSelectLoading should contain loading message', () => {
    expect(surahSelectLoading()).toContain('loading_surah_list');
  });

  it('surahSelectError should contain error message', () => {
    expect(surahSelectError()).toContain('error_unexpected');
  });

  it('surahSelectDefault should contain select message', () => {
    expect(surahSelectDefault()).toContain('select_surah');
  });

  it('reciterOptions should generate correct options', () => {
    const reciters = [
      { id: 'ar.alafasy', name: 'مشاري العفاسي' },
      { id: 'ar.abdulbasit', name: 'عبد الباسط' },
    ];
    const result = reciterOptions(reciters, 'ar.alafasy');
    expect(result).toContain('ar.alafasy');
    expect(result).toContain('مشاري العفاسي');
    expect(result).toContain('selected');
  });

  it('reciterOptions should not select non-matching id', () => {
    const reciters = [
      { id: 'ar.alafasy', name: 'مشاري العفاسي' },
      { id: 'ar.abdulbasit', name: 'عبد الباسط' },
    ];
    const result = reciterOptions(reciters, 'ar.husary');
    // First option should not have selected
    expect(result).not.toContain('selected');
  });

  it('skeletonLoading should return skeleton div', () => {
    const result = skeletonLoading();
    expect(result).toContain('skeleton-loading');
    expect(result).toContain('skeleton-line');
  });

  it('surahLoadError should contain error message', () => {
    expect(surahLoadError()).toContain('failed_load_surah');
  });

  it('surahContentShell should contain surah title and bismillah', () => {
    const result = surahContentShell('الفاتحة', 'بسم الله الرحمن الرحيم');
    expect(result).toContain('الفاتحة');
    expect(result).toContain('بسم الله الرحمن الرحيم');
    expect(result).toContain('surah-title');
    expect(result).toContain('ayahs-container');
  });

  it('collapsedPlayerInfo should contain surah name and ayah info', () => {
    const result = collapsedPlayerInfo('الفاتحة', 'آية 1');
    expect(result).toContain('الفاتحة');
    expect(result).toContain('آية 1');
    expect(result).toContain('fi-surah');
  });
});

describe('mushafSurahItem', () => {
  it('should generate a button with surah data', () => {
    const surah = { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 };
    const result = mushafSurahItem(surah);
    expect(result).toContain('mushaf-surah-item');
    expect(result).toContain('data-surah="1"');
    expect(result).toContain('الفاتحة');
    expect(result).toContain('7');
    expect(result).toContain('mushaf-surah-num');
    expect(result).toContain('mushaf-surah-name');
    expect(result).toContain('mushaf-surah-count');
  });

  it('should escape special characters in name', () => {
    const surah = { number: 1, name: '<b>test</b>', englishName: 'Test', numberOfAyahs: 5 };
    const result = mushafSurahItem(surah);
    expect(result).toContain('&lt;b&gt;test&lt;/b&gt;');
    expect(result).not.toContain('<b>');
  });
});

describe('ayahElement', () => {
  it('should generate an ayah div with text and number', () => {
    const ayah = { numberInSurah: 1, text: 'بسم الله الرحمن الرحيم' };
    const result = ayahElement(ayah, 0);
    expect(result).toContain('data-index="0"');
    expect(result).toContain('data-ayah="1"');
    expect(result).toContain('ayah-text');
    expect(result).toContain('ayah-number');
    expect(result).toContain('﴿1﴾');
  });

  it('should include word spans by default', () => {
    const ayah = { numberInSurah: 1, text: 'بسم الله' };
    const result = ayahElement(ayah, 0);
    expect(result).toContain('span class="word"');
  });

  it('should not include word spans when includeWordSpans is false', () => {
    const ayah = { numberInSurah: 1, text: 'بسم الله' };
    const result = ayahElement(ayah, 0, { includeWordSpans: false });
    expect(result).not.toContain('span class="word"');
  });

  it('should add hifdh-mode class when hifdhMode is true', () => {
    const ayah = { numberInSurah: 1, text: 'بسم الله' };
    const result = ayahElement(ayah, 0, { hifdhMode: true });
    expect(result).toContain('hifdh-mode');
  });

  it('should not add hifdh-mode class when hifdhMode is false', () => {
    const ayah = { numberInSurah: 1, text: 'بسم الله' };
    const result = ayahElement(ayah, 0, { hifdhMode: false });
    expect(result).not.toContain('hifdh-mode');
  });

  it('should use plain text when tajweedEnabled is true', () => {
    const ayah = { numberInSurah: 1, text: 'بسم الله' };
    const result = ayahElement(ayah, 0, { tajweedEnabled: true });
    // Should use escaped text, not word spans
    expect(result).not.toContain('span class="word"');
    expect(result).toContain('بسم الله');
  });

  it('should handle tajweed text with <tajweed> tags', () => {
    const ayah = { numberInSurah: 1, text: '<tajweed class="hamza">بسم</tajweed> الله' };
    const result = ayahElement(ayah, 0, { includeWordSpans: true, tajweedEnabled: false });
    // Tajweed text should be returned as-is (not split into word spans)
    expect(result).toContain('<tajweed');
  });

  it('should escape text when includeWordSpans is false', () => {
    const ayah = { numberInSurah: 1, text: '<script>alert("xss")</script>' };
    const result = ayahElement(ayah, 0, { includeWordSpans: false });
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });
});

describe('Favorite templates', () => {
  const mockFavorite = {
    key: '1-1',
    surah: 1,
    surahName: 'الفاتحة',
    ayah: 1,
    text: 'بسم الله الرحمن الرحيم',
    timestamp: Date.now(),
  };

  it('favoriteItem should generate correct HTML', () => {
    const result = favoriteItem(mockFavorite);
    expect(result).toContain('fav-item');
    expect(result).toContain('بسم الله الرحمن الرحيم');
    expect(result).toContain('الفاتحة');
    expect(result).toContain('data-surah="1"');
  });

  it('favoriteItem should contain goto and remove buttons', () => {
    const result = favoriteItem(mockFavorite);
    expect(result).toContain('fav-goto-btn');
    expect(result).toContain('fav-remove-btn');
  });

  it('favoriteItem should escape special characters', () => {
    const fav = {
      key: '<script>',
      surah: 1,
      surahName: 'الفاتحة',
      ayah: 1,
      text: '<b>test</b>',
      timestamp: Date.now(),
    };
    const result = favoriteItem(fav);
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&lt;b&gt;test&lt;/b&gt;');
  });

  it('emptyFavoritesMessage should contain empty message', () => {
    expect(emptyFavoritesMessage()).toContain('no_favorites');
  });

  it('favoritesEmptyMessage should contain empty message', () => {
    expect(favoritesEmptyMessage()).toContain('no_favorites');
    expect(favoritesEmptyMessage()).toContain('favorites-empty');
  });

  it('favoriteMeta should contain surah name and ayah number', () => {
    const result = favoriteMeta('الفاتحة', 5);
    expect(result).toContain('الفاتحة');
    expect(result).toContain('5');
  });

  it('favoriteMeta should escape surah name', () => {
    const result = favoriteMeta('<script>', 5);
    expect(result).toContain('&lt;script&gt;');
  });

  it('favoriteMeta should handle string ayah', () => {
    const result = favoriteMeta('الفاتحة', '1');
    expect(result).toContain('الفاتحة');
    expect(result).toContain('1');
  });
});

describe('Search templates', () => {
  it('searchResultItem should generate correct HTML', () => {
    const result = searchResultItem({
      surah: 1,
      surahName: 'الفاتحة',
      ayah: 1,
      text: 'بسم الله',
    });
    expect(result).toContain('search-result');
    expect(result).toContain('data-surah="1"');
  });

  it('searchResultItem should use highlight when provided', () => {
    const result = searchResultItem({
      surah: 1,
      surahName: 'الفاتحة',
      ayah: 1,
      text: 'بسم الله',
      highlight: '<mark>بسم</mark> الله',
    });
    expect(result).toContain('<mark>بسم</mark>');
  });

  it('searchResultCard should support highlighted text', () => {
    const result = searchResultCard({
      surah: 2,
      surahName: 'البقرة',
      ayah: 255,
      fulltextIndex: 0,
      highlighted: '<mark>الله</mark> لا إله إلا هو',
    });
    expect(result).toContain('<mark>الله</mark>');
    expect(result).toContain('search-result-item');
    expect(result).toContain('data-surah="2"');
  });

  it('searchResultCard should contain action buttons', () => {
    const result = searchResultCard({
      surah: 2,
      surahName: 'البقرة',
      ayah: 255,
      fulltextIndex: 0,
      highlighted: 'test',
    });
    expect(result).toContain('search-play');
    expect(result).toContain('search-copy');
    expect(result).toContain('search-share');
    expect(result).toContain('search-goto');
  });

  it('searchEmptyResults should contain no results message', () => {
    expect(searchEmptyResults()).toContain('no_results');
  });

  it('searchResultsHeader should contain count', () => {
    const result = searchResultsHeader(42);
    expect(result).toContain('42');
    expect(result).toContain('search-results-header');
  });

  it('searchResultsHeader should contain close button', () => {
    const result = searchResultsHeader(5);
    expect(result).toContain('closeSearchResultsBtn');
  });

  it('searchLoadMoreButton should contain load more text', () => {
    expect(searchLoadMoreButton()).toContain('load_more');
  });

  it('searchLoadMoreButton with remaining count', () => {
    const result = searchLoadMoreButton(10);
    expect(result).toContain('loadMoreSearchBtn');
  });

  it('searchHistoryItem should contain query text', () => {
    const result = searchHistoryItem('بسم الله', 0);
    expect(result).toContain('بسم الله');
    expect(result).toContain('data-index="0"');
    expect(result).toContain('search-history-remove');
  });

  it('searchAutocompleteItem should contain word and count', () => {
    const result = searchAutocompleteItem('الرحمن', 15, 0);
    expect(result).toContain('الرحمن');
    expect(result).toContain('15');
    expect(result).toContain('data-index="0"');
  });
});

describe('Prayer templates', () => {
  it('prayerTimeRow should generate correct HTML', () => {
    const result = prayerTimeRow('الفجر', '04:30', true);
    expect(result).toContain('الفجر');
    expect(result).toContain('04:30');
    expect(result).toContain('prayer-next');
  });

  it('prayerTimeRow without isNext should not have highlight class', () => {
    const result = prayerTimeRow('الظهر', '12:00');
    expect(result).not.toContain('prayer-next');
  });

  it('prayerTimeRow with isNext=false should not have highlight class', () => {
    const result = prayerTimeRow('الظهر', '12:00', false);
    expect(result).not.toContain('prayer-next');
  });

  it('prayerTimesRows should generate multiple rows', () => {
    const times = [
      { name: 'الفجر', time: '04:30', isNext: true },
      { name: 'الظهر', time: '12:00', isNext: false },
    ];
    const result = prayerTimesRows(times);
    expect(result).toContain('الفجر');
    expect(result).toContain('الظهر');
    expect(result).toContain('prayer-next');
  });

  it('prayerTimesRows with empty array should return empty string', () => {
    const result = prayerTimesRows([]);
    expect(result).toBe('');
  });

  it('prayerTimeRow should escape special characters', () => {
    const result = prayerTimeRow('<script>', '04:30');
    expect(result).toContain('&lt;script&gt;');
  });
});

describe('Error templates', () => {
  it('errorOverlay should contain error message', () => {
    const result = errorOverlay('Something went wrong');
    expect(result).toContain('Something went wrong');
    expect(result).toContain('error-overlay');
  });

  it('errorOverlay should contain reload and home buttons', () => {
    const result = errorOverlay('Test');
    expect(result).toContain('location.reload()');
    expect(result).toContain("location.href='/'");
    expect(result).toContain('errorCopyBtn');
  });

  it('errorOverlay should escape special characters in message', () => {
    const result = errorOverlay('<script>alert("x")</script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>alert');
  });

  it('errorRecoveryOverlay should contain reload button', () => {
    const result = errorRecoveryOverlay('Test error', 'Stack trace here');
    expect(result).toContain('Test error');
    expect(result).toContain('location.reload()');
    expect(result).toContain('errorCopyBtn');
    expect(result).toContain('Stack trace here');
  });

  it('errorRecoveryOverlay should have details section', () => {
    const result = errorRecoveryOverlay('Error msg', 'Details');
    expect(result).toContain('error-details');
    expect(result).toContain('error-overlay-card');
    expect(result).toContain('error-overlay-backdrop');
  });

  it('errorRecoveryOverlay should escape special chars', () => {
    const result = errorRecoveryOverlay('<b>err</b>', '<script>stack</script>');
    expect(result).toContain('&lt;b&gt;err&lt;/b&gt;');
    expect(result).toContain('&lt;script&gt;stack&lt;/script&gt;');
  });
});

describe('Reading stats templates', () => {
  it('readingStatsGrid should generate stat cards', () => {
    const stats = [
      { icon: '📖', label: 'آيات مقروءة', value: 150 },
      { icon: '⏱', label: 'وقت القراءة', value: '45 دقيقة' },
    ];
    const result = readingStatsGrid(stats);
    expect(result).toContain('reading-stats-grid');
    expect(result).toContain('150');
    expect(result).toContain('45 دقيقة');
    expect(result).toContain('stat-card');
  });

  it('readingStatsGrid with empty stats should still have grid', () => {
    const result = readingStatsGrid([]);
    expect(result).toContain('reading-stats-grid');
  });
});

describe('Tafsir templates', () => {
  it('tafsirLoading should contain loading message', () => {
    expect(tafsirLoading()).toContain('tafsir_loading');
    expect(tafsirLoading()).toContain('tafsir-loading');
  });

  it('tafsirContent should contain the text', () => {
    const result = tafsirContent('تفسير الآية');
    expect(result).toContain('تفسير الآية');
    expect(result).toContain('tafsir-text');
  });

  it('tafsirContent should escape special chars', () => {
    const result = tafsirContent('<script>alert(1)</script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('tafsirErrorMessage with custom message', () => {
    expect(tafsirErrorMessage('خطأ مخصص')).toContain('خطأ مخصص');
  });

  it('tafsirErrorMessage without message should use default', () => {
    const result = tafsirErrorMessage();
    expect(result).toContain('tafsir-error');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('Ayah modal templates', () => {
  it('qariOption should generate option element', () => {
    const result = qariOption('ar.alafasy', 'العفاسي');
    expect(result).toContain('ar.alafasy');
    expect(result).toContain('العفاسي');
    expect(result).not.toContain('selected');
  });

  it('qariOption should escape special characters', () => {
    const result = qariOption('<script>', '<b>test</b>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&lt;b&gt;test&lt;/b&gt;');
  });
});

describe('Mushaf templates', () => {
  it('mushafLoadingState should contain loading state', () => {
    const result = mushafLoadingState();
    expect(result).toContain('mushaf-loading-state');
    expect(result).toContain('mushaf-loading-icon');
  });

  it('mushafLoadingState should contain loading text', () => {
    const result = mushafLoadingState();
    expect(result).toContain('mushaf_loading_title');
    expect(result).toContain('mushaf_loading_subtitle');
  });

  it('surahLoadingMessage should contain loading text', () => {
    const result = surahLoadingMessage();
    expect(result).toContain('loading');
    expect(result).toContain('loading_surah');
  });

  it('mushafHeaderRow should contain juz info', () => {
    const result = mushafHeaderRow('الجزء 1');
    expect(result).toContain('الجزء 1');
    expect(result).toContain('mushaf-header-row');
    expect(result).toContain('mushaf-surah-names');
  });

  it('mushafErrorFallback should contain retry button', () => {
    const result = mushafErrorFallback();
    expect(result).toContain('mushaf-error-title');
    expect(result).toContain('mushaf-error-retry-btn');
    expect(result).toContain('location.reload()');
  });

  it('mushafErrorFallback should contain error messages', () => {
    const result = mushafErrorFallback();
    expect(result).toContain('mushaf_load_failed');
    expect(result).toContain('mushaf_check_connection');
    expect(result).toContain('mushaf_retry_reload');
  });

  it('mushafSurahNameSpan should contain the name', () => {
    const result = mushafSurahNameSpan('البقرة');
    expect(result).toContain('البقرة');
    expect(result).toContain('mushaf-surah-name');
  });

  it('mushafSurahNameSpan should escape special chars', () => {
    const result = mushafSurahNameSpan('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('surahSecretsBody should contain secret text', () => {
    const result = surahSecretsBody('سر السورة', ['المصدر']);
    expect(result).toContain('سر السورة');
    expect(result).toContain('المصدر');
    expect(result).toContain('secret-source');
  });

  it('surahSecretsBody without sources should not render sources', () => {
    const result = surahSecretsBody('سر السورة');
    expect(result).toContain('سر السورة');
    expect(result).not.toContain('secret-source');
  });

  it('surahSecretsBody with empty sources array should not render sources', () => {
    const result = surahSecretsBody('سر السورة', []);
    expect(result).not.toContain('secret-source');
  });

  it('surahSecretsBody should escape special chars', () => {
    const result = surahSecretsBody('<b>secret</b>');
    expect(result).toContain('&lt;b&gt;secret&lt;/b&gt;');
  });
});

describe('PWA update template', () => {
  it('updateBanner should contain update message and button', () => {
    const result = updateBanner();
    expect(result).toContain('update_available');
    expect(result).toContain('update_now');
    expect(result).toContain('location.reload()');
  });

  it('updateBanner should have update-banner-btn class', () => {
    const result = updateBanner();
    expect(result).toContain('update-banner-btn');
  });
});

describe('Adhkar templates', () => {
  it('adhkarTab should generate tab button', () => {
    const result = adhkarTab('morning', 'أذكار الصباح', true);
    expect(result).toContain('أذكار الصباح');
    expect(result).toContain('data-tab="morning"');
    expect(result).toContain('active');
  });

  it('adhkarTab without active should not have active class', () => {
    const result = adhkarTab('evening', 'أذكار المساء');
    expect(result).not.toContain('active');
  });

  it('adhkarTab with active=false should not have active class', () => {
    const result = adhkarTab('evening', 'أذكار المساء', false);
    expect(result).not.toContain('active');
  });

  it('adhkarCategoryTitle should contain icon and name', () => {
    const result = adhkarCategoryTitle('أذكار الصباح', '🌅');
    expect(result).toContain('أذكار الصباح');
    expect(result).toContain('🌅');
    expect(result).toContain('adhkar-category-title');
  });

  it('adhkarItemCard should show progress', () => {
    const result = adhkarItemCard('سبحان الله', 10, 33);
    expect(result).toContain('سبحان الله');
    expect(result).toContain('10 / 33');
    expect(result).toContain('adhkar-progress-fill');
  });

  it('adhkarItemCard when completed should have completed class', () => {
    const result = adhkarItemCard('سبحان الله', 33, 33);
    expect(result).toContain('adhkar-completed');
  });

  it('adhkarItemCard with reference should show reference', () => {
    const result = adhkarItemCard('سبحان الله', 10, 33, 'رواه مسلم');
    expect(result).toContain('adhkar-ref');
    expect(result).toContain('رواه مسلم');
  });

  it('adhkarItemCard without reference should not show reference div', () => {
    const result = adhkarItemCard('سبحان الله', 10, 33);
    expect(result).not.toContain('adhkar-ref');
  });

  it('adhkarItem (deprecated) should work', () => {
    const result = adhkarItem('سبحان الله', 10, 33);
    expect(result).toContain('سبحان الله');
    expect(result).toContain('10 / 33');
  });

  it('adhkarItem (deprecated) when completed should have completed class', () => {
    const result = adhkarItem('سبحان الله', 33, 33);
    expect(result).toContain('adhkar-completed');
  });

  it('adhkarSettingRow should generate toggle and inputs', () => {
    const result = adhkarSettingRow('morning', 'أذكار الصباح', true, '05:00', 5);
    expect(result).toContain('أذكار الصباح');
    expect(result).toContain('checked');
    expect(result).toContain('05:00');
    expect(result).toContain('value="5"');
  });

  it('adhkarSettingRow without time should not render time input', () => {
    const result = adhkarSettingRow('morning', 'أذكار الصباح', false);
    expect(result).not.toContain('adhkar-setting-time');
  });

  it('adhkarSettingRow without duration should not render duration input', () => {
    const result = adhkarSettingRow('morning', 'أذكار الصباح', false, '05:00');
    expect(result).not.toContain('adhkar-setting-duration');
  });

  it('adhkarSettingRow with duration should render duration input', () => {
    const result = adhkarSettingRow('morning', 'أذكار الصباح', true, '05:00', 10);
    expect(result).toContain('adhkar-setting-duration');
    expect(result).toContain('value="10"');
  });

  it('adhkarSettingRow when not enabled should not have checked', () => {
    const result = adhkarSettingRow('morning', 'أذكار الصباح', false);
    expect(result).not.toContain('checked');
  });
});

describe('Loading skeleton', () => {
  it('loadingSkeleton should generate specified number of lines', () => {
    const result = loadingSkeleton(3);
    expect(result).toContain('loading-skeleton');
    const matches = result.match(/skeleton-line/g);
    expect(matches).toHaveLength(3);
  });

  it('loadingSkeleton default should be 5 lines', () => {
    const result = loadingSkeleton();
    const matches = result.match(/skeleton-line/g);
    expect(matches).toHaveLength(5);
  });

  it('loadingSkeleton with 0 lines should have no skeleton-line divs', () => {
    const result = loadingSkeleton(0);
    const matches = result.match(/skeleton-line/g);
    expect(matches).toBeNull();
  });

  it('loadingSkeleton with 1 line', () => {
    const result = loadingSkeleton(1);
    const matches = result.match(/skeleton-line/g);
    expect(matches).toHaveLength(1);
  });
});

describe('settingsPanelHTML', () => {
  it('should return a non-empty string', () => {
    const result = settingsPanelHTML();
    expect(result.length).toBeGreaterThan(100);
  });

  it('should contain the settings panel aside element', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('settings-panel');
    expect(result).toContain('id="settingsPanel"');
  });

  it('should contain the settings header', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('settings-header');
    expect(result).toContain('settingsCloseBtn');
  });

  it('should contain the big clock display', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('big-clock');
    expect(result).toContain('bigClockTime2');
    expect(result).toContain('bigClockDate');
    expect(result).toContain('bigClockHijri');
  });

  it('should contain all settings tabs', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('data-tab="prayer"');
    expect(result).toContain('data-tab="display"');
    expect(result).toContain('data-tab="azan"');
    expect(result).toContain('data-tab="adhkar"');
    expect(result).toContain('data-tab="language"');
    expect(result).toContain('data-tab="tools"');
  });

  it('should contain prayer time settings', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('prayerTimesRows');
    expect(result).toContain('cityInput');
    expect(result).toContain('countryInput');
    expect(result).toContain('methodSelect');
    expect(result).toContain('saveLocationBtn');
  });

  it('should contain city quick select', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('cityQuickSelect');
    expect(result).toContain('مكة المكرمة');
  });

  it('should contain display settings', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('fontSizeSelect');
    expect(result).toContain('fontTypeSelect');
    expect(result).toContain('lineSpacingSelect');
    expect(result).toContain('tajweedToggle');
  });

  it('should contain azan settings', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('azanToggle');
    expect(result).toContain('azanFajrToggle');
    expect(result).toContain('testAzanBtn');
  });

  it('should contain adhkar settings', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('adhkarEnabledToggle');
    expect(result).toContain('adhkarSoundToggle');
    expect(result).toContain('adhkarSettingsList');
  });

  it('should contain language settings', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('langSelect');
    expect(result).toContain('value="ar"');
    expect(result).toContain('value="en"');
  });

  it('should contain tools settings', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('exportSettingsBtn');
    expect(result).toContain('importSettingsBtn');
    expect(result).toContain('resetSettingsBtn');
  });

  it('should contain presentation background settings', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('presBgSelect');
    expect(result).toContain('presBgNatureSelect');
    expect(result).toContain('presBgSceneSelect');
  });

  it('should contain translation select', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('translationSelect');
  });

  it('should contain auto save toggle', () => {
    const result = settingsPanelHTML();
    expect(result).toContain('autoSaveToggle');
  });
});

describe('floatingPlayerHTML', () => {
  it('should return a non-empty string', () => {
    const result = floatingPlayerHTML();
    expect(result.length).toBeGreaterThan(100);
  });

  it('should contain the player div', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('id="player"');
    expect(result).toContain('class="player collapsed"');
  });

  it('should contain collapsed content', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('collapsedContent');
    expect(result).toContain('collapsedPlayBtn');
    expect(result).toContain('collapsedInfo');
  });

  it('should contain expanded content header', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('playerReciterName');
    expect(result).toContain('playerSurahName');
    expect(result).toContain('collapsePlayerBtn');
  });

  it('should contain audio player element', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('id="audioPlayer"');
  });

  it('should contain player navigation buttons', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('prevSurahBtn');
    expect(result).toContain('prevAyahBtn');
    expect(result).toContain('playPauseBtn');
    expect(result).toContain('nextAyahBtn');
    expect(result).toContain('nextSurahBtn');
  });

  it('should contain player more row', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('playerMoreBtn');
    expect(result).toContain('hifdhBtn');
    expect(result).toContain('repeatBtn');
    expect(result).toContain('bookmarkBtn');
    expect(result).toContain('favoriteBtn');
    expect(result).toContain('shareBtn');
  });

  it('should contain speed control', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('speedSelect');
  });

  it('should contain sleep timer button', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('sleepTimerBtn');
    expect(result).toContain('sleepTimerDisplay');
  });

  it('should contain audio visualizer', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('audioVisualizer');
  });

  it('should contain select mode bar', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('selectModeBar');
    expect(result).toContain('selectCount');
  });

  it('should contain repeat controls', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('repeatControls');
    expect(result).toContain('repeatFrom');
    expect(result).toContain('repeatTo');
    expect(result).toContain('repeatTimes');
  });

  it('should contain share menu', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('shareMenu');
    expect(result).toContain('data-share="native"');
    expect(result).toContain('data-share="copy"');
    expect(result).toContain('data-share="whatsapp"');
    expect(result).toContain('data-share="telegram"');
  });

  it('should contain current ayah display', () => {
    const result = floatingPlayerHTML();
    expect(result).toContain('playerCurrentAyah');
  });
});

describe('arabicKeyboardHTML', () => {
  it('should return a non-empty string', () => {
    const result = arabicKeyboardHTML();
    expect(result.length).toBeGreaterThan(100);
  });

  it('should contain the keyboard container', () => {
    const result = arabicKeyboardHTML();
    expect(result).toContain('id="arabicKeyboard"');
    expect(result).toContain('arabic-keyboard');
  });

  it('should be LTR', () => {
    const result = arabicKeyboardHTML();
    expect(result).toContain('dir="ltr"');
  });

  it('should contain keyboard rows', () => {
    const result = arabicKeyboardHTML();
    expect(result).toContain('kbd-row');
  });

  it('should contain Arabic letters', () => {
    const result = arabicKeyboardHTML();
    expect(result).toContain('data-key="ض"');
    expect(result).toContain('data-key="ص"');
    expect(result).toContain('data-key="ا"');
    expect(result).toContain('data-key="ل"');
  });

  it('should contain number keys', () => {
    const result = arabicKeyboardHTML();
    expect(result).toContain('data-key="١"');
    expect(result).toContain('data-key="٠"');
  });

  it('should contain modifier keys', () => {
    const result = arabicKeyboardHTML();
    expect(result).toContain('data-key="shift"');
    expect(result).toContain('data-key="space"');
    expect(result).toContain('data-key="backspace"');
    expect(result).toContain('data-key="clear"');
  });

  it('should contain kbd-key class on all keys', () => {
    const result = arabicKeyboardHTML();
    const matches = result.match(/class="kbd-key/g);
    expect(matches!.length).toBeGreaterThan(10);
  });
});
