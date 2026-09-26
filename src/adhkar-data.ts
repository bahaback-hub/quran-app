import adhkarData from './data/adhkar.json';

export interface AdhkarItem {
  id: string;
  text: string;
  count: number;
  reference: string;
}

export interface AdhkarCategory {
  id: string;
  icon: string;
  name: string;
  defaultTime: string | null;
  defaultDuration: number;
  items: AdhkarItem[];
}

export interface AdhkarData {
  categories: AdhkarCategory[];
}

export const ADHKAR_DATA = adhkarData as unknown as AdhkarData;

/* ===================== USER CUSTOMIZATIONS ===================== */

/**
 * User customizations to adhkar items.
 * Stored separately from ADHKAR_DATA so user changes persist across
 * app updates (which may add/modify default items).
 *
 * - `customItems` are user-added items appended to a category
 * - `itemOverrides` lets user edit text/count/reference of default items
 * - `hiddenItems` is a set of item IDs the user has deleted (hidden)
 */
export interface AdhkarCustomizations {
  /** User-added items per category: { categoryId: AdhkarItem[] } */
  customItems: Record<string, AdhkarItem[]>;
  /** Edits to default items: { itemId: Partial<AdhkarItem> } */
  itemOverrides: Record<string, Partial<AdhkarItem>>;
  /** IDs of items the user has hidden (deleted from view) */
  hiddenItems: string[];
}

const STORAGE_KEY = 'adhkar_customizations';

/** Load user customizations from localStorage. */
export function loadAdhkarCustomizations(): AdhkarCustomizations {
  try {
    const raw = localStorage.getItem('quran_app_' + STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdhkarCustomizations;
      return {
        customItems: parsed.customItems ?? {},
        itemOverrides: parsed.itemOverrides ?? {},
        hiddenItems: parsed.hiddenItems ?? [],
      };
    }
  } catch (e) {
    console.warn('[AdhkarData] Failed to load customizations:', e);
  }
  return { customItems: {}, itemOverrides: {}, hiddenItems: [] };
}

/** Save user customizations to localStorage. */
export function saveAdhkarCustomizations(custom: AdhkarCustomizations): void {
  try {
    localStorage.setItem('quran_app_' + STORAGE_KEY, JSON.stringify(custom));
  } catch (e) {
    console.warn('[AdhkarData] Failed to save customizations:', e);
  }
}

/** Reset all customizations (restore defaults). */
export function resetAdhkarCustomizations(): AdhkarCustomizations {
  const empty: AdhkarCustomizations = {
    customItems: {},
    itemOverrides: {},
    hiddenItems: [],
  };
  saveAdhkarCustomizations(empty);
  return empty;
}

/**
 * Get the effective list of items for a category, applying user customizations.
 * - Default items with overrides applied
 * - Default items not in hiddenItems
 * - User-added custom items appended at the end
 */
export function getCategoryItems(categoryId: string, custom?: AdhkarCustomizations): AdhkarItem[] {
  const c = custom ?? loadAdhkarCustomizations();
  const category = ADHKAR_DATA.categories.find((cat) => cat.id === categoryId);
  if (!category) {
    return c.customItems[categoryId] ?? [];
  }

  // Start with default items (apply overrides + skip hidden)
  const items: AdhkarItem[] = [];
  for (const item of category.items) {
    if (c.hiddenItems.includes(item.id)) {
      continue;
    }
    const override = c.itemOverrides[item.id];
    items.push(override ? { ...item, ...override } : item);
  }

  // Append user-added custom items
  const userItems = c.customItems[categoryId] ?? [];
  items.push(...userItems);

  return items;
}

/**
 * Get a category with effective items (after applying customizations).
 * Useful for rendering UI.
 */
export function getEffectiveCategory(categoryId: string, custom?: AdhkarCustomizations): AdhkarCategory | null {
  const category = ADHKAR_DATA.categories.find((cat) => cat.id === categoryId);
  if (!category) {
    return null;
  }
  return {
    ...category,
    items: getCategoryItems(categoryId, custom),
  };
}

/**
 * Add a new custom item to a category.
 * Returns the new item with a generated ID.
 */
export function addCustomAdhkarItem(
  categoryId: string,
  text: string,
  count: number,
  reference: string,
  custom?: AdhkarCustomizations,
): AdhkarItem | null {
  if (!text.trim() || count < 1) {
    return null;
  }
  const c = custom ?? loadAdhkarCustomizations();
  const newItem: AdhkarItem = {
    id: 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    text: text.trim(),
    count: Math.max(1, Math.min(999, count)),
    reference: reference.trim() || '—',
  };
  if (!c.customItems[categoryId]) {
    c.customItems[categoryId] = [];
  }
  c.customItems[categoryId].push(newItem);
  saveAdhkarCustomizations(c);
  return newItem;
}

/**
 * Edit an existing item (default or custom).
 * For default items, stores an override.
 * For custom items, modifies in place.
 */
export function editAdhkarItem(
  itemId: string,
  categoryId: string,
  changes: Partial<AdhkarItem>,
  custom?: AdhkarCustomizations,
): boolean {
  const c = custom ?? loadAdhkarCustomizations();

  // Check if it's a custom item
  const customList = c.customItems[categoryId];
  if (customList) {
    const idx = customList.findIndex((i) => i.id === itemId);
    if (idx >= 0) {
      const existing = customList[idx]!;
      customList[idx] = {
        id: itemId,
        text: changes.text ?? existing.text,
        count: changes.count ?? existing.count,
        reference: changes.reference ?? existing.reference,
      };
      saveAdhkarCustomizations(c);
      return true;
    }
  }

  // It's a default item — store override
  c.itemOverrides[itemId] = { ...c.itemOverrides[itemId], ...changes };
  delete c.itemOverrides[itemId]!.id; // never allow ID override
  saveAdhkarCustomizations(c);
  return true;
}

/**
 * Delete (hide) an item from a category.
 * - For default items, adds to hiddenItems (can be restored).
 * - For custom items, removes them permanently.
 */
export function deleteAdhkarItem(itemId: string, categoryId: string, custom?: AdhkarCustomizations): void {
  const c = custom ?? loadAdhkarCustomizations();

  // Check if it's a custom item — permanently delete
  const customList = c.customItems[categoryId];
  if (customList) {
    const idx = customList.findIndex((i) => i.id === itemId);
    if (idx >= 0) {
      customList.splice(idx, 1);
      saveAdhkarCustomizations(c);
      return;
    }
  }

  // Default item — add to hiddenItems
  if (!c.hiddenItems.includes(itemId)) {
    c.hiddenItems.push(itemId);
    saveAdhkarCustomizations(c);
  }
}

/**
 * Restore a previously hidden default item.
 */
export function restoreAdhkarItem(itemId: string, custom?: AdhkarCustomizations): void {
  const c = custom ?? loadAdhkarCustomizations();
  c.hiddenItems = c.hiddenItems.filter((id) => id !== itemId);
  saveAdhkarCustomizations(c);
}
