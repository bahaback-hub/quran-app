import { describe, it, expect, beforeEach } from 'vitest';
import { showToast, loadingBar } from '../ui.js';
import { dom } from '../dom.js';

beforeEach(() => {
  dom.toast = document.createElement('div');
  document.body.appendChild(dom.toast);
});

describe('showToast', () => {
  it('should set toast text', () => {
    showToast('test message');
    expect(dom.toast.textContent).toBe('test message');
  });

  it('should add show class', () => {
    showToast('test');
    expect(dom.toast.classList.contains('show')).toBe(true);
  });

  it('should add type class', () => {
    showToast('test', 'error');
    expect(dom.toast.classList.contains('error')).toBe(true);
  });

  it('should handle missing toast element', () => {
    dom.toast = null;
    expect(() => showToast('test')).not.toThrow();
  });
});

describe('loadingBar', () => {
  beforeEach(() => {
    loadingBar.el = null;
    loadingBar.timer = null;
  });

  it('should init loading bar', () => {
    loadingBar.init();
    expect(loadingBar.el).toBeTruthy();
  });

  it('should show loading bar', () => {
    loadingBar.init();
    loadingBar.show('loading...');
    expect(loadingBar.el.classList.contains('active')).toBe(true);
    expect(loadingBar.el.textContent).toBe('loading...');
  });

  it('should hide loading bar', () => {
    loadingBar.init();
    loadingBar.show('loading...');
    loadingBar.hide();
    expect(loadingBar.el.classList.contains('active')).toBe(false);
  });
});
