import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../storage.js';

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  globalThis.localStorage = {
    getItem: (key: string) => (store[key] === undefined ? null : store[key]),
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  } as Storage;
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

describe('storage edge cases', () => {
  it('should handle null values', () => {
    storage.set('null_key', null);
    expect(storage.get('null_key')).toBeNull();
  });

  it('should handle undefined values', () => {
    storage.set('undef_key', undefined);
    // undefined becomes null after JSON round-trip through localStorage
    expect(storage.get('undef_key')).toBeNull();
  });

  it('should handle boolean values', () => {
    storage.set('bool_true', true);
    storage.set('bool_false', false);
    expect(storage.get('bool_true')).toBe(true);
    expect(storage.get('bool_false')).toBe(false);
  });

  it('should handle numeric values including zero', () => {
    storage.set('zero', 0);
    storage.set('negative', -42);
    storage.set('float', 3.14159);
    expect(storage.get('zero')).toBe(0);
    expect(storage.get('negative')).toBe(-42);
    expect(storage.get('float')).toBeCloseTo(3.14159);
  });

  it('should handle empty string', () => {
    storage.set('empty', '');
    expect(storage.get('empty')).toBe('');
  });

  it('should handle very large values', () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => ({ index: i, data: 'test_value_' + i }));
    expect(storage.set('large', largeArray)).toBe(true);
    const result = storage.get<{ index: number; data: string }[]>('large')!;
    expect(result.length).toBe(10000);
    expect(result[0].index).toBe(0);
    expect(result[9999].data).toBe('test_value_9999');
  });

  it('should handle deeply nested objects', () => {
    const deep = { level1: { level2: { level3: { level4: { value: 'deep' } } } } };
    storage.set('deep', deep);
    expect((storage.get('deep') as Record<string, unknown>).level1).toBeTruthy();
  });

  it('should handle arrays with mixed types', () => {
    const mixed = [1, 'two', true, null, { key: 'value' }, [1, 2, 3]];
    storage.set('mixed', mixed);
    expect(storage.get('mixed')).toEqual(mixed);
  });

  it('should handle Arabic/Unicode strings', () => {
    storage.set('arabic', 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
    expect(storage.get('arabic')).toBe('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ');
  });

  it('should handle emoji strings', () => {
    storage.set('emoji', '🕌📖🤲✨');
    expect(storage.get('emoji')).toBe('🕌📖🤲✨');
  });

  it('should return true on successful set', () => {
    expect(storage.set('success_key', 'value')).toBe(true);
  });

  it('should return false when localStorage is full', () => {
    const originalSetItem = globalThis.localStorage.setItem.bind(globalThis.localStorage);
    globalThis.localStorage.setItem = () => {
      throw new DOMException('The quota has been exceeded', 'QuotaExceededError');
    };
    expect(storage.set('overflow', 'value')).toBe(false);
    globalThis.localStorage.setItem = originalSetItem;
  });

  it('should handle corrupt JSON in localStorage gracefully', () => {
    store['quran_app_corrupt'] = '{broken json!!!';
    expect(storage.get('corrupt')).toBeNull();
  });

  it('should return default value when JSON parse fails', () => {
    store['quran_app_bad'] = 'not valid json';
    expect(storage.get('bad', 'default_val')).toBe('default_val');
  });

  it('should handle getItem throwing an error', () => {
    const originalGetItem = globalThis.localStorage.getItem.bind(globalThis.localStorage);
    globalThis.localStorage.getItem = () => {
      throw new Error('Access denied');
    };
    expect(storage.get('denied', 'fallback')).toBe('fallback');
    globalThis.localStorage.getItem = originalGetItem;
  });

  it('should handle removeItem throwing an error gracefully', () => {
    const originalRemoveItem = globalThis.localStorage.removeItem.bind(globalThis.localStorage);
    globalThis.localStorage.removeItem = () => {
      throw new Error('Remove failed');
    };
    expect(() => storage.remove('problem')).not.toThrow();
    globalThis.localStorage.removeItem = originalRemoveItem;
  });

  it('should overwrite existing values', () => {
    storage.set('overwrite', 'first');
    expect(storage.get('overwrite')).toBe('first');
    storage.set('overwrite', 'second');
    expect(storage.get('overwrite')).toBe('second');
  });

  it('should handle removing non-existent key without error', () => {
    expect(() => storage.remove('nonexistent_key_xyz')).not.toThrow();
  });

  it('should clear all values with localStorage.clear', () => {
    storage.set('a', 1);
    storage.set('b', 2);
    globalThis.localStorage.clear();
    expect(storage.get('a')).toBeNull();
    expect(storage.get('b')).toBeNull();
  });
});
