import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../storage.js';

// Mock localStorage
const store = {};
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  globalThis.localStorage = {
    getItem: (key) => store[key] === undefined ? null : store[key],
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
});

describe('storage', () => {
  it('should store and retrieve values', () => {
    storage.set('test_key', { a: 1, b: 'hello' });
    expect(storage.get('test_key')).toEqual({ a: 1, b: 'hello' });
  });

  it('should return default for missing keys', () => {
    expect(storage.get('nonexistent')).toBeNull();
    expect(storage.get('nonexistent', 42)).toBe(42);
  });

  it('should remove values', () => {
    storage.set('temp', 'value');
    expect(storage.get('temp')).toBe('value');
    storage.remove('temp');
    expect(storage.get('temp')).toBeNull();
  });

  it('should prefix keys', () => {
    storage.set('key', 'val');
    expect(store['quran_app_key']).toBe('"val"');
  });
});
