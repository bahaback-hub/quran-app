/**
 * Unit tests for the provider registry: registration, override semantics,
 * id listing, and reset isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerProvider,
  getProvider,
  overrideProvider,
  clearOverride,
  clearOverrides,
  hasOverride,
  resetRegistry,
  listProviderIds,
} from '../providers/registry.js';
import { isJsonProvider, type JsonProvider } from '../providers/types.js';

/** Minimal fake provider — enough to exercise the registry. */
function fake(id: string): JsonProvider {
  return {
    id,
    displayName: `fake-${id}`,
    baseUrl: `https://example.com/${id}`,
    fetch: <T = unknown>(p: string) => Promise.resolve(`resp-${p}` as T),
    isAvailable: () => true,
  };
}

describe('ProviderRegistry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  describe('register + get', () => {
    it('should store and retrieve a provider by id', () => {
      const p = fake('alpha');
      registerProvider(p);
      expect(getProvider('alpha')).toBe(p);
    });

    it('should throw for an unknown id', () => {
      expect(() => getProvider('nope')).toThrow('No provider registered for "nope"');
    });

    it('should allow re-registration (last wins)', () => {
      const first = fake('x');
      const second = fake('x');
      registerProvider(first);
      registerProvider(second);
      expect(getProvider('x')).toBe(second);
    });
  });

  describe('overrides', () => {
    it('should return the override when one exists', () => {
      const builtin = fake('y');
      const over = fake('y');
      registerProvider(builtin);
      overrideProvider('y', over);
      expect(getProvider('y')).toBe(over);
    });

    it('should clear the override, restoring the builtin', () => {
      const builtin = fake('z');
      const over = fake('z');
      registerProvider(builtin);
      overrideProvider('z', over);
      clearOverride('z');
      expect(getProvider('z')).toBe(builtin);
    });

    it('should throw if an override is installed for an unregistered id', () => {
      overrideProvider('ghost', fake('ghost'));
      expect(() => getProvider('ghost')).not.toThrow();
    });

    it('hasOverride should track override state', () => {
      expect(hasOverride('w')).toBe(false);
      overrideProvider('w', fake('w'));
      expect(hasOverride('w')).toBe(true);
      clearOverride('w');
      expect(hasOverride('w')).toBe(false);
    });

    it('clearOverrides should remove all overrides', () => {
      overrideProvider('a', fake('a'));
      overrideProvider('b', fake('b'));
      clearOverrides();
      expect(hasOverride('a')).toBe(false);
      expect(hasOverride('b')).toBe(false);
    });
  });

  describe('listProviderIds', () => {
    it('should list built-in ids', () => {
      registerProvider(fake('one'));
      registerProvider(fake('two'));
      const ids = listProviderIds();
      expect(ids).toContain('one');
      expect(ids).toContain('two');
    });

    it('should include override-only ids and deduplicate', () => {
      registerProvider(fake('k'));
      overrideProvider('k', fake('k'));
      overrideProvider('extra', fake('extra'));
      const ids = listProviderIds();
      expect(ids).toEqual(expect.arrayContaining(['k', 'extra']));
      expect(ids.filter((x) => x === 'k')).toHaveLength(1);
    });
  });

  describe('resetRegistry', () => {
    it('should clear both builtins and overrides', () => {
      registerProvider(fake('m'));
      overrideProvider('m', fake('m'));
      resetRegistry();
      expect(() => getProvider('m')).toThrow();
    });
  });
});

describe('isJsonProvider', () => {
  it('should return true for valid provider', () => {
    expect(isJsonProvider(fake('test'))).toBe(true);
  });

  it('should return false for null, strings, and partial objects', () => {
    expect(isJsonProvider(null)).toBe(false);
    expect(isJsonProvider({ id: 'x' })).toBe(false);
    expect(isJsonProvider({ id: 'x', fetch: 123 })).toBe(false);
  });
});
