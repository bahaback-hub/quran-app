import { CONFIG } from './config.js';

/** localStorage wrapper with JSON serialization and prefix. */
export const storage = {
  /**
   * Get a value from localStorage.
   * @param {string} key - Storage key (will be prefixed).
   * @param {*} def - Default value if key not found.
   * @returns {*} Parsed value or default.
   */
  get(key, def = null) {
    try {
      const v = localStorage.getItem(CONFIG.STORAGE_PREFIX + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) {
      console.warn(`[storage] Failed to read key "${key}":`, e);
      return def;
    }
  },
  /**
   * Set a value in localStorage with JSON serialization.
   * @param {string} key - Storage key (will be prefixed).
   * @param {*} val - Value to store.
   */
  set(key, val) {
    try {
      localStorage.setItem(CONFIG.STORAGE_PREFIX + key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.warn(`[storage] Failed to write key "${key}" (quota exceeded?):`, e);
      return false;
    }
  },
  /**
   * Remove a value from localStorage.
   * @param {string} key - Storage key (will be prefixed).
   */
  remove(key) {
    try { localStorage.removeItem(CONFIG.STORAGE_PREFIX + key); } catch (e) {
      console.warn(`[storage] Failed to remove key "${key}":`, e);
    }
  }
};
