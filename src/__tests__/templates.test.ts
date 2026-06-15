/**
 * Tests for templates.ts — centralized HTML template functions.
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
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
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

  it('surahListOptions should generate options for all surahs', () => {
    const list = [mockSurah, { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', numberOfAyahs: 286 }];
    const result = surahListOptions(list, 2);
    expect(result).toContain('value="1"');
    expect(result).toContain('value="2"');
    expect(result).toContain('البقرة');
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

  it('emptyFavoritesMessage should contain empty message', () => {
    expect(emptyFavoritesMessage()).toContain('no_favorites');
  });

  it('favoritesEmptyMessage should contain empty message', () => {
    expect(favoritesEmptyMessage()).toContain('no_favorites');
  });

  it('favoriteMeta should contain surah name and ayah number', () => {
    const result = favoriteMeta('الفاتحة', 5);
    expect(result).toContain('الفاتحة');
    expect(result).toContain('5');
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

  it('searchResultCard should support highlighted text', () => {
    const result = searchResultCard({
      surah: 2,
      surahName: 'البقرة',
      ayah: 255,
      text: 'الله لا إله إلا هو',
      highlight: '<mark>الله</mark> لا إله إلا هو',
    });
    expect(result).toContain('<mark>الله</mark>');
  });

  it('searchEmptyResults should contain no results message', () => {
    expect(searchEmptyResults()).toContain('no_results');
  });

  it('searchResultsHeader should contain count', () => {
    const result = searchResultsHeader(42);
    expect(result).toContain('42');
    expect(result).toContain('search-header');
  });

  it('searchLoadMoreButton should contain load more text', () => {
    expect(searchLoadMoreButton()).toContain('load_more');
  });

  it('searchHistoryItem should contain query text', () => {
    const result = searchHistoryItem('بسم الله', 0);
    expect(result).toContain('بسم الله');
    expect(result).toContain('data-index="0"');
  });

  it('searchAutocompleteItem should contain word and count', () => {
    const result = searchAutocompleteItem('الرحمن', 15);
    expect(result).toContain('الرحمن');
    expect(result).toContain('(15)');
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
});

describe('Error templates', () => {
  it('errorOverlay should contain error message', () => {
    const result = errorOverlay('Something went wrong');
    expect(result).toContain('Something went wrong');
    expect(result).toContain('error-overlay');
  });

  it('errorRecoveryOverlay should contain reload button', () => {
    const result = errorRecoveryOverlay('Test error', 'Stack trace here');
    expect(result).toContain('Test error');
    expect(result).toContain('location.reload()');
    expect(result).toContain('errorCopyBtn');
    expect(result).toContain('Stack trace here');
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
});

describe('Tafsir templates', () => {
  it('tafsirLoading should contain loading message', () => {
    expect(tafsirLoading()).toContain('tafsir_loading');
  });

  it('tafsirContent should contain the text', () => {
    const result = tafsirContent('تفسير الآية');
    expect(result).toContain('تفسير الآية');
    expect(result).toContain('tafsir-text');
  });

  it('tafsirErrorMessage with custom message', () => {
    expect(tafsirErrorMessage('خطأ مخصص')).toContain('خطأ مخصص');
  });

  it('tafsirErrorMessage without message should use default', () => {
    expect(tafsirErrorMessage()).toContain('no_tafsir_available');
  });
});

describe('Ayah modal templates', () => {
  it('qariOption should generate option element', () => {
    const result = qariOption({ id: 'ar.alafasy', name: 'العفاسي' });
    expect(result).toContain('ar.alafasy');
    expect(result).toContain('العفاسي');
    expect(result).not.toContain('selected');
  });

  it('qariOption with selected should include selected attribute', () => {
    const result = qariOption({ id: 'ar.alafasy', name: 'العفاسي' }, true);
    expect(result).toContain('selected');
  });
});

describe('Mushaf templates', () => {
  it('mushafLoadingState should contain spinner', () => {
    const result = mushafLoadingState();
    expect(result).toContain('mushaf-loading-state');
    expect(result).toContain('mushaf-spinner');
  });

  it('surahLoadingMessage should contain loading text', () => {
    const result = surahLoadingMessage();
    expect(result).toContain('loading');
  });

  it('mushafHeaderRow should contain surah names and juz info', () => {
    const result = mushafHeaderRow('الفاتحة', 'الجزء 1');
    expect(result).toContain('الفاتحة');
    expect(result).toContain('الجزء 1');
    expect(result).toContain('mushaf-header-row');
  });

  it('mushafErrorFallback should contain retry button', () => {
    const result = mushafErrorFallback();
    expect(result).toContain('mushaf-error-title');
    expect(result).toContain('mushafRetryBtn');
  });

  it('mushafSurahNameSpan should contain the name', () => {
    const result = mushafSurahNameSpan('البقرة');
    expect(result).toContain('البقرة');
    expect(result).toContain('mushaf-surah-name');
  });

  it('surahSecretsBody should contain secret text', () => {
    const result = surahSecretsBody('سر السورة', 'المصدر');
    expect(result).toContain('سر السورة');
    expect(result).toContain('المصدر');
  });

  it('surahSecretsBody without sources should not render sources', () => {
    const result = surahSecretsBody('سر السورة', '');
    expect(result).not.toContain('surah-secret-sources');
  });
});

describe('PWA update template', () => {
  it('updateBanner should contain update message and button', () => {
    const result = updateBanner();
    expect(result).toContain('update_available');
    expect(result).toContain('update_now');
    expect(result).toContain('location.reload()');
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

  it('adhkarCategoryTitle should contain icon and name', () => {
    const result = adhkarCategoryTitle('أذكار الصباح', '🌅');
    expect(result).toContain('أذكار الصباح');
    expect(result).toContain('🌅');
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
});

describe('Loading skeleton', () => {
  it('loadingSkeleton should generate specified number of lines', () => {
    const result = loadingSkeleton(3);
    expect(result).toContain('loading-skeleton');
    // Count skeleton-line occurrences
    const matches = result.match(/skeleton-line/g);
    expect(matches).toHaveLength(3);
  });

  it('loadingSkeleton default should be 5 lines', () => {
    const result = loadingSkeleton();
    const matches = result.match(/skeleton-line/g);
    expect(matches).toHaveLength(5);
  });
});
