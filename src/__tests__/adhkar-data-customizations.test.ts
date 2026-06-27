/**
 * Tests for adhkar-data customization system.
 *
 * Verifies:
 *   - Default items load correctly
 *   - Custom items can be added
 *   - Items can be edited (default via override, custom in place)
 *   - Items can be deleted (default → hidden, custom → permanent)
 *   - Hidden items can be restored
 *   - Customizations persist via save/load
 *   - Reset restores defaults
 *   - Effective category merges defaults + customizations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock storage
const mockStorage = new Map<string, string>();
vi.mock('../storage.js', () => ({
  storage: {
    get: vi.fn(<T>(key: string): T | null => {
      const v = mockStorage.get(key);
      return v ? (JSON.parse(v) as T) : null;
    }),
    set: vi.fn((key: string, value: unknown) => {
      mockStorage.set(key, JSON.stringify(value));
    }),
    remove: vi.fn((key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

import {
  ADHKAR_DATA,
  loadAdhkarCustomizations,
  saveAdhkarCustomizations,
  resetAdhkarCustomizations,
  getCategoryItems,
  getEffectiveCategory,
  addCustomAdhkarItem,
  editAdhkarItem,
  deleteAdhkarItem,
  restoreAdhkarItem,
  type AdhkarCustomizations,
} from '../adhkar-data.js';

// Mock localStorage (used directly by adhkar-data for customizations)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('adhkar-data — customization system', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockStorage.clear();
  });

  describe('Default data', () => {
    it('should have multiple categories', () => {
      expect(ADHKAR_DATA.categories.length).toBeGreaterThan(3);
      expect(ADHKAR_DATA.categories.some((c) => c.id === 'morning')).toBe(true);
      expect(ADHKAR_DATA.categories.some((c) => c.id === 'evening')).toBe(true);
    });

    it('should have items in each category', () => {
      for (const cat of ADHKAR_DATA.categories) {
        expect(cat.items.length).toBeGreaterThan(0);
      }
    });
  });

  describe('loadAdhkarCustomizations', () => {
    it('should return empty customizations when nothing stored', () => {
      const c = loadAdhkarCustomizations();
      expect(c.customItems).toEqual({});
      expect(c.itemOverrides).toEqual({});
      expect(c.hiddenItems).toEqual([]);
    });

    it('should load saved customizations', () => {
      const custom: AdhkarCustomizations = {
        customItems: { morning: [{ id: 'x1', text: 'test', count: 1, reference: 'ref' }] },
        itemOverrides: { m1: { count: 5 } },
        hiddenItems: ['m2'],
      };
      saveAdhkarCustomizations(custom);
      const loaded = loadAdhkarCustomizations();
      expect(loaded.customItems.morning?.length).toBe(1);
      expect(loaded.itemOverrides.m1?.count).toBe(5);
      expect(loaded.hiddenItems).toContain('m2');
    });
  });

  describe('getCategoryItems', () => {
    it('should return default items when no customizations', () => {
      const morningItems = getCategoryItems('morning');
      const defaultMorning = ADHKAR_DATA.categories.find((c) => c.id === 'morning')!;
      expect(morningItems.length).toBe(defaultMorning.items.length);
    });

    it('should hide items in hiddenItems', () => {
      const morningItems = getCategoryItems('morning');
      const firstItemId = morningItems[0]!.id;

      const custom: AdhkarCustomizations = {
        customItems: {},
        itemOverrides: {},
        hiddenItems: [firstItemId],
      };
      saveAdhkarCustomizations(custom);

      const filtered = getCategoryItems('morning');
      expect(filtered.some((i) => i.id === firstItemId)).toBe(false);
    });

    it('should apply itemOverrides', () => {
      const morningItems = getCategoryItems('morning');
      const firstItem = morningItems[0]!;
      const originalCount = firstItem.count;

      const custom: AdhkarCustomizations = {
        customItems: {},
        itemOverrides: { [firstItem.id]: { count: 99 } },
        hiddenItems: [],
      };
      saveAdhkarCustomizations(custom);

      const modified = getCategoryItems('morning');
      const modifiedItem = modified.find((i) => i.id === firstItem.id);
      expect(modifiedItem?.count).toBe(99);
      expect(modifiedItem?.count).not.toBe(originalCount);
    });

    it('should append custom items at the end', () => {
      const custom: AdhkarCustomizations = {
        customItems: {
          morning: [
            { id: 'custom_1', text: 'Custom dhikr', count: 3, reference: 'me' },
          ],
        },
        itemOverrides: {},
        hiddenItems: [],
      };
      saveAdhkarCustomizations(custom);

      const items = getCategoryItems('morning');
      const lastItem = items[items.length - 1];
      expect(lastItem?.id).toBe('custom_1');
      expect(lastItem?.text).toBe('Custom dhikr');
    });
  });

  describe('getEffectiveCategory', () => {
    it('should return null for unknown category', () => {
      const cat = getEffectiveCategory('nonexistent');
      expect(cat).toBeNull();
    });

    it('should return category with effective items', () => {
      const cat = getEffectiveCategory('morning');
      expect(cat).not.toBeNull();
      expect(cat!.id).toBe('morning');
      expect(cat!.items.length).toBeGreaterThan(0);
    });
  });

  describe('addCustomAdhkarItem', () => {
    it('should add a new custom item', () => {
      const newItem = addCustomAdhkarItem('morning', 'Test dhikr', 5, 'My ref');
      expect(newItem).not.toBeNull();
      expect(newItem!.text).toBe('Test dhikr');
      expect(newItem!.count).toBe(5);
      expect(newItem!.reference).toBe('My ref');
      expect(newItem!.id).toMatch(/^custom_/);

      // Should appear in category items
      const items = getCategoryItems('morning');
      expect(items.some((i) => i.id === newItem!.id)).toBe(true);
    });

    it('should reject empty text', () => {
      const result = addCustomAdhkarItem('morning', '', 5, 'ref');
      expect(result).toBeNull();
    });

    it('should reject count < 1', () => {
      const result = addCustomAdhkarItem('morning', 'test', 0, 'ref');
      expect(result).toBeNull();
    });

    it('should clamp count to 999 max', () => {
      const newItem = addCustomAdhkarItem('morning', 'test', 9999, 'ref');
      expect(newItem!.count).toBe(999);
    });
  });

  describe('editAdhkarItem', () => {
    it('should edit a default item via override', () => {
      const morningItems = getCategoryItems('morning');
      const firstItem = morningItems[0]!;

      editAdhkarItem(firstItem.id, 'morning', { text: 'Modified text', count: 10 });

      const modified = getCategoryItems('morning');
      const modifiedItem = modified.find((i) => i.id === firstItem.id);
      expect(modifiedItem?.text).toBe('Modified text');
      expect(modifiedItem?.count).toBe(10);
    });

    it('should edit a custom item in place', () => {
      const newItem = addCustomAdhkarItem('morning', 'Original', 1, 'ref');
      editAdhkarItem(newItem!.id, 'morning', { text: 'Edited', count: 7 });

      const items = getCategoryItems('morning');
      const edited = items.find((i) => i.id === newItem!.id);
      expect(edited?.text).toBe('Edited');
      expect(edited?.count).toBe(7);
    });
  });

  describe('deleteAdhkarItem', () => {
    it('should hide a default item (add to hiddenItems)', () => {
      const morningItems = getCategoryItems('morning');
      const firstItem = morningItems[0]!;

      deleteAdhkarItem(firstItem.id, 'morning');

      const after = getCategoryItems('morning');
      expect(after.some((i) => i.id === firstItem.id)).toBe(false);

      // Should be in hiddenItems (can be restored)
      const custom = loadAdhkarCustomizations();
      expect(custom.hiddenItems).toContain(firstItem.id);
    });

    it('should permanently delete a custom item', () => {
      const newItem = addCustomAdhkarItem('morning', 'To delete', 1, 'ref');
      deleteAdhkarItem(newItem!.id, 'morning');

      const after = getCategoryItems('morning');
      expect(after.some((i) => i.id === newItem!.id)).toBe(false);

      // Should NOT be in hiddenItems (permanently deleted)
      const custom = loadAdhkarCustomizations();
      expect(custom.hiddenItems).not.toContain(newItem!.id);
    });
  });

  describe('restoreAdhkarItem', () => {
    it('should restore a previously hidden default item', () => {
      const morningItems = getCategoryItems('morning');
      const firstItem = morningItems[0]!;

      deleteAdhkarItem(firstItem.id, 'morning');
      expect(getCategoryItems('morning').some((i) => i.id === firstItem.id)).toBe(false);

      restoreAdhkarItem(firstItem.id);
      expect(getCategoryItems('morning').some((i) => i.id === firstItem.id)).toBe(true);
    });
  });

  describe('resetAdhkarCustomizations', () => {
    it('should clear all customizations', () => {
      addCustomAdhkarItem('morning', 'Custom', 1, 'ref');
      const morningItems = getCategoryItems('morning');
      editAdhkarItem(morningItems[0]!.id, 'morning', { count: 50 });

      resetAdhkarCustomizations();

      const custom = loadAdhkarCustomizations();
      expect(custom.customItems).toEqual({});
      expect(custom.itemOverrides).toEqual({});
      expect(custom.hiddenItems).toEqual([]);
    });
  });
});
