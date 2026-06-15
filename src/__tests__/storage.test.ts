/**
 * Tests for storage.ts — localStorage wrapper with JSON serialization and prefix.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Override the setup mock so we get the actual storage module
vi.unmock('../storage.js');

import { storage } from '../storage.js';

describe('storage.get', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return parsed value when key exists', () => {
    localStorage.setItem('quran_app_test_key', JSON.stringify('hello'));
    expect(storage.get('test_key')).toBe('hello');
  });

  it('should return parsed number value', () => {
    localStorage.setItem('quran_app_count', JSON.stringify(42));
    expect(storage.get('count')).toBe(42);
  });

  it('should return parsed boolean value', () => {
    localStorage.setItem('quran_app_flag', JSON.stringify(true));
    expect(storage.get('flag')).toBe(true);
  });

  it('should return parsed object value', () => {
    const obj = { name: 'test', value: 123 };
    localStorage.setItem('quran_app_data', JSON.stringify(obj));
    expect(storage.get('data')).toEqual(obj);
  });

  it('should return parsed array value', () => {
    const arr = [1, 2, 3];
    localStorage.setItem('quran_app_items', JSON.stringify(arr));
    expect(storage.get('items')).toEqual(arr);
  });

  it('should return null when key does not exist and no default provided', () => {
    expect(storage.get('nonexistent')).toBeNull();
  });

  it('should return default value when key does not exist', () => {
    expect(storage.get('nonexistent', 'fallback')).toBe('fallback');
  });

  it('should return default value when key does not exist (number default)', () => {
    expect(storage.get('nonexistent', 0)).toBe(0);
  });

  it('should return default value when key does not exist (object default)', () => {
    const defaultObj = { a: 1 };
    expect(storage.get('nonexistent', defaultObj)).toEqual(defaultObj);
  });

  it('should return null when default is explicitly null', () => {
    expect(storage.get('nonexistent', null)).toBeNull();
  });

  it('should prefix keys with quran_app_', () => {
    localStorage.setItem('quran_app_mykey', JSON.stringify('value'));
    expect(storage.get('mykey')).toBe('value');
    // Without prefix in raw localStorage, should not be found
    localStorage.setItem('mykey', JSON.stringify('nope'));
    // This should still find the prefixed version
    expect(storage.get('mykey')).toBe('value');
  });

  it('should return default on JSON parse error', () => {
    localStorage.setItem('quran_app_bad_json', '{invalid json}');
    expect(storage.get('bad_json', 'default')).toBe('default');
  });

  it('should return null on JSON parse error when no default provided', () => {
    localStorage.setItem('quran_app_bad_json', '{invalid json}');
    expect(storage.get('bad_json')).toBeNull();
  });

  it('should return default when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage error');
    });
    expect(storage.get('any_key', 'fallback')).toBe('fallback');
    spy.mockRestore();
  });

  it('should warn on console when JSON parse fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('quran_app_bad', 'not json');
    storage.get('bad');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[storage]'),
      expect.anything()
    );
    warnSpy.mockRestore();
  });
});

describe('storage.set', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should store a string value with prefix', () => {
    const result = storage.set('name', 'value');
    expect(result).toBe(true);
    expect(localStorage.getItem('quran_app_name')).toBe(JSON.stringify('value'));
  });

  it('should store a number value', () => {
    storage.set('count', 42);
    expect(localStorage.getItem('quran_app_count')).toBe('42');
  });

  it('should store a boolean value', () => {
    storage.set('active', true);
    expect(localStorage.getItem('quran_app_active')).toBe('true');
  });

  it('should store an object value', () => {
    const obj = { a: 1, b: 'test' };
    storage.set('data', obj);
    expect(localStorage.getItem('quran_app_data')).toBe(JSON.stringify(obj));
  });

  it('should store null value', () => {
    storage.set('nullable', null);
    expect(localStorage.getItem('quran_app_nullable')).toBe('null');
  });

  it('should store an array value', () => {
    const arr = [1, 'two', false];
    storage.set('items', arr);
    expect(localStorage.getItem('quran_app_items')).toBe(JSON.stringify(arr));
  });

  it('should return true on success', () => {
    expect(storage.set('key', 'value')).toBe(true);
  });

  it('should return false when localStorage.setItem throws (quota exceeded)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    expect(storage.set('key', 'value')).toBe(false);
    spy.mockRestore();
  });

  it('should warn on console when write fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Write failed');
    });
    storage.set('key', 'value');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[storage]'),
      expect.anything()
    );
    spy.mockRestore();
    warnSpy.mockRestore();
  });

  it('should overwrite existing values', () => {
    storage.set('key', 'first');
    storage.set('key', 'second');
    expect(localStorage.getItem('quran_app_key')).toBe(JSON.stringify('second'));
  });
});

describe('storage.remove', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should remove a stored value', () => {
    storage.set('key', 'value');
    expect(storage.get('key')).toBe('value');

    storage.remove('key');
    expect(storage.get('key')).toBeNull();
  });

  it('should not throw when removing a non-existent key', () => {
    expect(() => storage.remove('nonexistent')).not.toThrow();
  });

  it('should remove with prefixed key from localStorage', () => {
    localStorage.setItem('quran_app_mykey', JSON.stringify('test'));
    storage.remove('mykey');
    expect(localStorage.getItem('quran_app_mykey')).toBeNull();
  });

  it('should not affect keys without the prefix', () => {
    localStorage.setItem('quran_app_prefixed', JSON.stringify('yes'));
    localStorage.setItem('unprefixed', JSON.stringify('no'));
    storage.remove('prefixed');
    expect(localStorage.getItem('quran_app_prefixed')).toBeNull();
    expect(localStorage.getItem('unprefixed')).toBe(JSON.stringify('no'));
  });

  it('should warn on console when removeItem throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Remove failed');
    });
    storage.remove('key');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[storage]'),
      expect.anything()
    );
    spy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('storage prefix behavior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should use quran_app_ prefix for all operations', () => {
    storage.set('test', 'value');
    // Raw localStorage should have the prefixed key
    expect(localStorage.getItem('quran_app_test')).toBe(JSON.stringify('value'));
    // Getting with the module should work with unprefixed key
    expect(storage.get('test')).toBe('value');
  });

  it('should not cross-contaminate keys with different prefixes', () => {
    localStorage.setItem('other_prefix_key', JSON.stringify('other'));
    localStorage.setItem('quran_app_key', JSON.stringify('ours'));

    expect(storage.get('key')).toBe('ours');
  });
});

describe('storage round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should survive a set-get round trip for strings', () => {
    storage.set('key', 'hello world');
    expect(storage.get('key')).toBe('hello world');
  });

  it('should survive a set-get round trip for numbers', () => {
    storage.set('num', 3.14);
    expect(storage.get('num')).toBeCloseTo(3.14);
  });

  it('should survive a set-get round trip for objects', () => {
    const obj = { nested: { deep: true }, arr: [1, 2] };
    storage.set('obj', obj);
    expect(storage.get('obj')).toEqual(obj);
  });

  it('should survive a set-remove-get cycle', () => {
    storage.set('temp', 'data');
    expect(storage.get('temp')).toBe('data');
    storage.remove('temp');
    expect(storage.get('temp')).toBeNull();
  });
});
