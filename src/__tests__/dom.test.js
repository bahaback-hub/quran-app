import { describe, it, expect, beforeEach } from 'vitest';
import { dom, cacheDom } from '../dom.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('dom', () => {
  it('should be an object', () => {
    expect(typeof dom).toBe('object');
  });
});

describe('cacheDom', () => {
  it('should not throw when no elements exist', () => {
    expect(() => cacheDom()).not.toThrow();
  });

  it('should cache existing elements', () => {
    const div = document.createElement('div');
    div.id = 'toast';
    document.body.appendChild(div);
    cacheDom();
    expect(dom.toast).toBe(div);
  });

  it('should set null for missing elements', () => {
    cacheDom();
    expect(dom.toast).toBeNull();
  });
});
