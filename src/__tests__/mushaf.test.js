import { describe, it, expect, beforeEach } from 'vitest';
import { dom } from '../dom.js';
import { getJuzForPage, updatePageIndicator } from '../mushaf.js';

describe('getJuzForPage', () => {
  it('should return juz 1 for page 1', () => {
    expect(getJuzForPage(1)).toBe(1);
  });

  it('should return juz 1 for page 21', () => {
    expect(getJuzForPage(21)).toBe(1);
  });

  it('should return juz 2 for page 22', () => {
    expect(getJuzForPage(22)).toBe(2);
  });

  it('should return juz 30 for page 604', () => {
    expect(getJuzForPage(604)).toBe(30);
  });

  it('should return correct juz for middle pages', () => {
    expect(getJuzForPage(50)).toBe(3);
    expect(getJuzForPage(100)).toBe(5);
    expect(getJuzForPage(200)).toBe(10);
    expect(getJuzForPage(400)).toBe(20);
    expect(getJuzForPage(500)).toBe(25);
  });
});

describe('updatePageIndicator', () => {
  beforeEach(() => {
    dom.pageIndicator = document.createElement('div');
  });

  it('should set page indicator text', () => {
    updatePageIndicator(1);
    expect(dom.pageIndicator.textContent).toContain('mushaf_page_info');
  });

  it('should update to another page', () => {
    updatePageIndicator(50);
    expect(dom.pageIndicator.textContent).toContain('mushaf_page_info');
  });

  it('should do nothing if pageIndicator is falsy', () => {
    dom.pageIndicator = null;
    expect(() => updatePageIndicator(1)).not.toThrow();
  });
});
