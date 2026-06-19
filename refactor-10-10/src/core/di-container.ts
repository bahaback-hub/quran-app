/**
 * ================================================================
 * Dependency Injection Container — Solves Problem #10
 * ----------------------------------------------------------------
 * Replaces tight coupling (modules directly importing each other)
 * with a small DI container that supports:
 *   - Interface-based registration
 *   - Lazy initialization (singleton on first resolve)
 *   - Easy mocking for tests
 *   - Circular dependency detection
 *
 * This enables the Layered Architecture pattern:
 *   - Presentation Layer depends on interfaces, not concretions
 *   - Services are swappable without UI changes
 *   - Tests can inject mocks without module patching
 * ================================================================
 */

export type Token<T = unknown> = string & { __type?: T };

export type Factory<T> = (container: DIContainer) => T | Promise<T>;

interface Registration<T> {
  factory: Factory<T>;
  isSingleton: boolean;
  instance?: T;
  resolved: boolean;
  resolving: boolean; // for circular dep detection
}

class DIContainer {
  private readonly registrations = new Map<Token, Registration>();
  private readonly resolutionStack: Token[] = [];

  /**
   * Register a singleton (instance created once on first resolve).
   * @example
   *   container.register('StorageService', () => new LocalStorageAdapter());
   */
  register<T>(token: Token<T>, factory: Factory<T>): this {
    this.registrations.set(token, {
      factory,
      isSingleton: true,
      resolved: false,
      resolving: false,
    });
    return this;
  }

  /**
   * Register a transient (new instance on every resolve).
   * @example
   *   container.registerTransient('ApiClient', () => new ApiClient());
   */
  registerTransient<T>(token: Token<T>, factory: Factory<T>): this {
    this.registrations.set(token, {
      factory,
      isSingleton: false,
      resolved: false,
      resolving: false,
    });
    return this;
  }

  /**
   * Register an existing instance (useful for tests / pre-built objects).
   * @example
   *   container.registerInstance('Config', { apiUrl: '...' });
   */
  registerInstance<T>(token: Token<T>, instance: T): this {
    this.registrations.set(token, {
      factory: () => instance,
      isSingleton: true,
      instance,
      resolved: true,
      resolving: false,
    });
    return this;
  }

  /**
   * Resolve a dependency by token.
   * Throws on circular dependencies and missing registrations.
   *
   * @example
   *   const storage = container.resolve('StorageService');
   */
  resolve<T>(token: Token<T>): T {
    const reg = this.registrations.get(token);
    if (!reg) {
      throw new Error(`[DI] No registration found for token "${token}". Did you forget to register it?`);
    }

    // Return cached singleton
    if (reg.isSingleton && reg.resolved) {
      return reg.instance as T;
    }

    // Circular dependency check
    if (reg.resolving) {
      const cycle = [...this.resolutionStack, token].join(' → ');
      throw new Error(`[DI] Circular dependency detected: ${cycle}`);
    }

    reg.resolving = true;
    this.resolutionStack.push(token);
    try {
      const instance = reg.factory(this);
      if (reg.isSingleton) {
        reg.instance = instance;
        reg.resolved = true;
      }
      return instance;
    } finally {
      reg.resolving = false;
      this.resolutionStack.pop();
    }
  }

  /**
   * Resolve an async dependency (factory returns a Promise).
   */
  async resolveAsync<T>(token: Token<T>): Promise<T> {
    const reg = this.registrations.get(token);
    if (!reg) {
      throw new Error(`[DI] No registration found for token "${token}".`);
    }

    if (reg.isSingleton && reg.resolved) {
      return reg.instance as T;
    }

    if (reg.resolving) {
      const cycle = [...this.resolutionStack, token].join(' → ');
      throw new Error(`[DI] Circular dependency detected: ${cycle}`);
    }

    reg.resolving = true;
    this.resolutionStack.push(token);
    try {
      const instance = await reg.factory(this);
      if (reg.isSingleton) {
        reg.instance = instance;
        reg.resolved = true;
      }
      return instance;
    } finally {
      reg.resolving = false;
      this.resolutionStack.pop();
    }
  }

  /**
   * Check if a token is registered.
   */
  isRegistered<T>(token: Token<T>): boolean {
    return this.registrations.has(token);
  }

  /**
   * Clear all registrations (for tests / hot reload).
   */
  clear(): void {
    this.registrations.clear();
    this.resolutionStack.length = 0;
  }

  /**
   * List all registered tokens (for diagnostics).
   */
  listTokens(): string[] {
    return Array.from(this.registrations.keys());
  }
}

// ================================================================
// Singleton Container + Token Helpers
// ================================================================

export const container = new DIContainer();

/**
 * Type-safe token creator.
 * @example
 *   const StorageService = token<StorageInterface>('StorageService');
 *   container.register(StorageService, () => new LocalStorageAdapter());
 *   const storage = container.resolve(StorageService);
 */
export function token<T>(name: string): Token<T> {
  return name as Token<T>;
}

// ================================================================
// Common Tokens (Interfaces)
// ================================================================

export const TOKENS = {
  Storage: token<StorageInterface>('Storage'),
  ApiClient: token<ApiClientInterface>('ApiClient'),
  AudioPlayer: token<AudioPlayerInterface>('AudioPlayer'),
  SurahRepository: token<SurahRepositoryInterface>('SurahRepository'),
  TafsirRepository: token<TafsirRepositoryInterface>('TafsirRepository'),
  PrayerService: token<PrayerServiceInterface>('PrayerService'),
  SearchService: token<SearchServiceInterface>('SearchService'),
  FavoritesRepository: token<FavoritesRepositoryInterface>('FavoritesRepository'),
  I18n: token<I18nInterface>('I18n'),
  EventBus: token<EventBusInterface>('EventBus'),
  Toast: token<ToastInterface>('Toast'),
  ErrorBoundary: token<ErrorBoundaryInterface>('ErrorBoundary'),
} as const;

// ================================================================
// Service Interfaces (contracts for DI)
// ================================================================

export interface StorageInterface {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
}

export interface ApiClientInterface {
  fetch<T>(url: string, schema: ZodSchema<T>, options?: RequestInit): Promise<T>;
}

export interface AudioPlayerInterface {
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setSource(url: string): void;
  on(event: string, handler: (...args: unknown[]) => void): () => void;
}

export interface SurahRepositoryInterface {
  getSurahList(): Promise<SurahInfo[]>;
  getSurah(number: number): Promise<SurahData | null>;
  getAyah(surah: number, ayah: number): Promise<Ayah | null>;
}

export interface TafsirRepositoryInterface {
  getTafsir(edition: string, surah: number, ayah: number): Promise<string | null>;
}

export interface PrayerServiceInterface {
  getTimes(lat: number, lng: number, date: Date): Promise<PrayerTimes | null>;
  getNextPrayer(): PrayerName | null;
}

export interface SearchServiceInterface {
  search(query: string): SearchResult[];
  buildIndex(): Promise<void>;
}

export interface FavoritesRepositoryInterface {
  add(entry: FavoriteEntry): void;
  remove(surah: number, ayah: number): void;
  getAll(): FavoriteEntry[];
  has(surah: number, ayah: number): boolean;
}

export interface I18nInterface {
  __(key: string, params?: Record<string, string | number>): string;
  setLang(lang: string): Promise<void>;
  getLang(): string;
}

export interface EventBusInterface {
  on(action: string, handler: (...args: unknown[]) => void): () => void;
  delegate(eventType: string): void;
  trigger(action: string, event?: Event): Promise<void>;
}

export interface ToastInterface {
  info(message: string, duration?: number): void;
  success(message: string, duration?: number): void;
  error(message: string, duration?: number): void;
  warning(message: string, duration?: number): void;
}

export interface ErrorBoundaryInterface {
  load<T>(label: string, loader: () => Promise<T>): Promise<T | null>;
  wrap<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T>;
}

// Re-export types from state for convenience
import type {
  SurahInfo,
  SurahData,
  Ayah,
  PrayerTimes,
  PrayerName,
  SearchResult,
  FavoriteEntry,
} from './state.js';

// Zod-like schema interface (avoids hard zod dep in interface file)
export interface ZodSchema<T> {
  parse(data: unknown): T;
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: Error };
}
