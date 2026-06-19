/**
 * ================================================================
 * Surah Repository — Layered Architecture (Problem #10)
 * ----------------------------------------------------------------
 * Implements the SurahRepositoryInterface.
 * - Uses ApiClient (DI) for network calls
 * - Uses Storage (DI) for caching
 * - Uses Schemas for type-safe responses
 * - Returns domain types, not raw API types
 *
 * This is the DATA LAYER — knows nothing about DOM or UI.
 * ================================================================
 */

import { container, TOKENS, type SurahRepositoryInterface, type StorageInterface, type ApiClientInterface } from '../core/di-container.js';
import type { SurahInfo, SurahData, Ayah } from '../core/state.js';
import {
  SurahListResponseSchema,
  SurahResponseSchema,
  type ApiSurah,
  type ApiSurahListItem,
} from '../core/schemas.js';

class SurahRepository implements SurahRepositoryInterface {
  private readonly cacheKey = 'surah_list';
  private readonly surahCachePrefix = 'surah_';
  private listCache: SurahInfo[] | null = null;

  async getSurahList(): Promise<SurahInfo[]> {
    // Return in-memory cache
    if (this.listCache) return this.listCache;

    const storage = container.resolve<StorageInterface>(TOKENS.Storage);

    // Try localStorage cache (for offline)
    const cached = storage.get<SurahInfo[]>(this.cacheKey);
    if (cached && cached.length === 114) {
      this.listCache = cached;
      return cached;
    }

    // Fetch from API with schema validation
    const apiClient = container.resolve<ApiClientInterface>(TOKENS.ApiClient);
    const response = await apiClient.fetch(
      'https://api.alquran.cloud/v1/surah',
      SurahListResponseSchema,
      { dedupeKey: 'surah_list' },
    );

    // Map API type → Domain type
    const surahs: SurahInfo[] = response.data.map((s: ApiSurahListItem) => this.mapListItem(s));
    this.listCache = surahs;
    storage.set(this.cacheKey, surahs);
    return surahs;
  }

  async getSurah(number: number): Promise<SurahData | null> {
    if (number < 1 || number > 114) {
      console.warn(`[SurahRepo] Invalid surah number: ${number}`);
      return null;
    }

    const storage = container.resolve<StorageInterface>(TOKENS.Storage);
    const cacheKey = `${this.surahCachePrefix}${number}`;

    // Try cache first
    const cached = storage.get<SurahData>(cacheKey);
    if (cached) return cached;

    // Fetch from API
    const apiClient = container.resolve<ApiClientInterface>(TOKENS.ApiClient);
    const response = await apiClient.fetch(
      `https://api.alquran.cloud/v1/surah/${number}/quran-uthmani`,
      SurahResponseSchema,
      { dedupeKey: `surah_${number}` },
    );

    // Map and cache
    const surah = this.mapSurah(response.data);
    storage.set(cacheKey, surah);
    return surah;
  }

  async getAyah(surah: number, ayah: number): Promise<Ayah | null> {
    const surahData = await this.getSurah(surah);
    if (!surahData) return null;
    return surahData.ayahs.find((a) => a.numberInSurah === ayah) ?? null;
  }

  // === Mappers (API type → Domain type) ===

  private mapListItem(api: ApiSurahListItem): SurahInfo {
    return {
      number: api.number,
      name: api.name,
      englishName: api.englishName,
      numberOfAyahs: api.numberOfAyahs,
      revelationType: api.revelationType === 'Meccan' ? 'Meccan' : 'Medinan',
    };
  }

  private mapSurah(api: ApiSurah): SurahData {
    return {
      number: api.number,
      name: api.name,
      ayahs: api.ayahs.map((a) => ({
        number: a.number,
        numberInSurah: a.numberInSurah,
        text: a.text,
        audio: a.audio,
        sajda: a.sajda,
      })),
    };
  }
}

// Register in DI container
container.register(TOKENS.SurahRepository, () => new SurahRepository());
