/**
 * Lightweight in-memory IndexedDB mock for testing.
 *
 * Replaces fake-indexeddb which is extremely slow on CI (60s+ per test).
 * This mock implements only the subset of IDB used by surah-cache.ts.
 */

interface MockRecord {
  key: unknown;
  value: unknown;
}

class MockObjectStore {
  name: string;
  keyPath: string;
  records: Map<unknown, MockRecord> = new Map();

  constructor(name: string, keyPath: string) {
    this.name = name;
    this.keyPath = keyPath;
  }

  put(value: Record<string, unknown>): MockRequest {
    const key = value[this.keyPath];
    this.records.set(key, { key, value });
    return MockRequest.success(key);
  }

  get(key: unknown): MockRequest {
    const record = this.records.get(key);
    return MockRequest.success(record ? record.value : undefined);
  }

  delete(key: unknown): MockRequest {
    this.records.delete(key);
    return MockRequest.success(undefined);
  }

  clear(): void {
    this.records.clear();
  }
}

class MockRequest {
  result: unknown;
  error: Error | null = null;
  onsuccess: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readyState: 'done' | 'pending' = 'done';

  private constructor(result: unknown) {
    this.result = result;
    Promise.resolve().then(() => {
      if (this.onsuccess) {
        this.onsuccess({ target: { result: this.result } });
      }
    });
  }

  static success(result: unknown): MockRequest {
    return new MockRequest(result);
  }
}

class MockDatabase {
  name: string;
  version: number;
  objectStoreNames: { contains: (name: string) => boolean };
  stores: Map<string, MockObjectStore> = new Map();

  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
    this.objectStoreNames = {
      contains: (name: string) => this.stores.has(name),
    };
  }

  createObjectStore(name: string, options?: { keyPath?: string }): MockObjectStore {
    const store = new MockObjectStore(name, options?.keyPath || 'key');
    this.stores.set(name, store);
    return store;
  }

  transaction(storeNames: string[] | string, _mode?: 'readonly' | 'readwrite'): MockTransaction {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new MockTransaction(names, this.stores);
  }

  close(): void {
    // No-op
  }
}

class MockTransaction {
  stores: Map<string, MockObjectStore>;
  storeNames: string[];
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor(storeNames: string[], stores: Map<string, MockObjectStore>) {
    this.storeNames = storeNames;
    this.stores = stores;
    Promise.resolve().then(() => {
      if (this.oncomplete) {
        this.oncomplete();
      }
    });
  }

  objectStore(name: string): MockObjectStore {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`Object store "${name}" not found`);
    }
    return store;
  }
}

class MockIndexedDB {
  private databases: Map<string, MockDatabase> = new Map();

  open(name: string, version: number = 1): MockOpenRequest {
    let db = this.databases.get(name);
    const needsUpgrade = !db;
    if (!db) {
      db = new MockDatabase(name, version);
      this.databases.set(name, db);
    }
    return new MockOpenRequest(db, needsUpgrade);
  }

  deleteDatabase(name: string): MockRequest {
    this.databases.delete(name);
    return MockRequest.success(undefined);
  }
}

class MockOpenRequest {
  result: MockDatabase;
  error: Error | null = null;
  onsuccess: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onupgradeneeded: ((event: unknown) => void) | null = null;
  readyState: 'done' | 'pending' = 'done';

  constructor(db: MockDatabase, needsUpgrade: boolean) {
    this.result = db;
    Promise.resolve().then(() => {
      if (needsUpgrade && this.onupgradeneeded) {
        this.onupgradeneeded({ target: { result: db } });
      }
      if (this.onsuccess) {
        this.onsuccess({ target: { result: db } });
      }
    });
  }
}

const mockIDB = new MockIndexedDB();

(globalThis as unknown as { indexedDB: MockIndexedDB }).indexedDB = mockIDB;
(globalThis as unknown as { IDBDatabase: typeof MockDatabase }).IDBDatabase = MockDatabase;
(globalThis as unknown as { IDBObjectStore: typeof MockObjectStore }).IDBObjectStore = MockObjectStore;
(globalThis as unknown as { IDBTransaction: typeof MockTransaction }).IDBTransaction = MockTransaction;
(globalThis as unknown as { IDBRequest: typeof MockRequest }).IDBRequest = MockRequest;

export { MockIndexedDB, MockDatabase, MockObjectStore, MockRequest };
