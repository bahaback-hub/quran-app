/**
 * ================================================================
 * Storage Service — Safe localStorage Wrapper
 * ----------------------------------------------------------------
 * - JSON serialization with type safety
 * - Try/catch around all operations (private mode, quota)
 * - Migration support for schema changes
 * ================================================================
 */

import { container, TOKENS, type StorageInterface } from '../core/di-container.js';

class SafeStorage implements StorageInterface {
  private readonly prefix = 'quran_app_';

  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[Storage] Failed to read "${key}":`, err);
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (err) {
      console.error(`[Storage] Failed to write "${key}":`, err);
      // Quota exceeded — try clearing non-essential items
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        this.handleQuotaExceeded(key, value);
      }
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (err) {
      console.error(`[Storage] Failed to remove "${key}":`, err);
    }
  }

  clear(): void {
    try {
      // Only clear items with our prefix
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.prefix)) keys.push(key);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (err) {
      console.error('[Storage] Failed to clear:', err);
    }
  }

  private handleQuotaExceeded<T>(key: string, value: T): void {
    // Try clearing caches first
    const cacheKeys = ['audio_cache_meta', 'tafsir_cache_meta', 'search_history'];
    for (const ck of cacheKeys) {
      this.remove(ck);
    }
    // Retry
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      console.error(`[Storage] Still cannot write "${key}" after clearing caches.`);
    }
  }
}

export const storage = new SafeStorage();
container.registerInstance(TOKENS.Storage, storage);
