import { describe, it, expect, vi } from 'vitest';

const flag = vi.hoisted(() => ({ empty: false }));
vi.mock('../i18n.js', () => ({
  __: (k: string) => (flag.empty ? '' : k),
}));
vi.mock('../templates/escape.js', () => ({
  escapeHtml: (s: string) => `ESC(${s})`,
}));

import { errorOverlay, errorRecoveryOverlay, loadingSkeleton, qariOption, tafsirLoading, tafsirContent, tafsirErrorMessage, updateBanner, readingStatsGrid } from '../templates-feedback.js';

describe('templates-feedback', () => {
  it('renders templates with translated strings', () => {
    flag.empty = false;
    expect(errorOverlay('<x>')).toContain('ESC(<x>)');
    expect(errorOverlay('e')).toContain('error_title');
    expect(errorRecoveryOverlay('m', 'd')).toContain('ESC(d)');
    expect(loadingSkeleton(2)).toContain('skeleton-line');
    expect(loadingSkeleton()).toContain('skeleton-line');
    expect(qariOption('id', 'Name')).toContain('ESC(id)');
    expect(tafsirLoading()).toContain('tafsir_loading');
    expect(tafsirContent('t')).toContain('ESC(t)');
    expect(tafsirErrorMessage('msg')).toContain('ESC(msg)');
    expect(updateBanner()).toContain('update_now');
    expect(readingStatsGrid([{ icon: 'i', label: 'l', value: 1 }])).toContain('ESC(1)');
  });

  it('uses fallback strings when translations are empty', () => {
    flag.empty = true;
    expect(errorOverlay('e')).toContain('حدث خطأ');
    expect(errorOverlay('e')).toContain('إعادة تحميل');
    expect(errorRecoveryOverlay('m', 'd')).toContain('الرئيسية');
    expect(errorRecoveryOverlay('m', 'd')).toContain('تفاصيل');
    expect(tafsirErrorMessage()).toContain('التفسير غير متاح');
  });
});
