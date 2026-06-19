/**
 * ================================================================
 * API Client — Uses Zod Schemas (Problem #8)
 * ----------------------------------------------------------------
 * Unified fetch with:
 *   - Schema validation on every response
 *   - Timeout (15s default)
 *   - Retry with exponential backoff (2 attempts)
 *   - AbortController for request cancellation
 *   - Deduplication of identical in-flight requests
 * ================================================================
 */

import type { ZodSchema } from './schemas.js';
import { container, TOKENS } from './di-container.js';
import { toast } from './toast.js';

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY = 1000;

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  /** Cache key for deduplication. Set to omit (default) to disable. */
  dedupeKey?: string;
}

class ApiClient {
  private readonly inflightRequests = new Map<string, Promise<Response>>();

  /**
   * Fetch JSON with schema validation, timeout, retry, and deduplication.
   *
   * @example
   *   const surah = await apiClient.fetch(
   *     'https://api.alquran.cloud/v1/surah/1',
   *     SurahResponseSchema,
   *   );
   *   // surah is fully typed & validated
   */
  async fetch<T>(url: string, schema: ZodSchema<T>, options: FetchOptions = {}): Promise<T> {
    const { timeout = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES, dedupeKey, ...init } = options;

    // Deduplicate identical in-flight requests
    if (dedupeKey && this.inflightRequests.has(dedupeKey)) {
      const response = await this.inflightRequests.get(dedupeKey)!;
      // Clone the response (bodies can only be read once on the original)
      return this.parseResponse(response.clone(), schema);
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.rawFetch(url, init, timeout, dedupeKey);
        return await this.parseResponse(response, schema);
      } catch (err) {
        lastError = err as Error;
        if (attempt < retries) {
          const delay = DEFAULT_BASE_DELAY * Math.pow(2, attempt);
          console.warn(`[ApiClient] Retry ${attempt + 1}/${retries} for ${url} in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error(`[ApiClient] Failed to fetch ${url} after ${retries + 1} attempts.`);
  }

  /**
   * Raw fetch with timeout via AbortController.
   */
  private async rawFetch(
    url: string,
    init: RequestInit,
    timeout: number,
    dedupeKey?: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    init.signal = controller.signal;

    const promise = fetch(url, init).finally(() => {
      clearTimeout(timeoutId);
      if (dedupeKey) {
        // Remove from in-flight map after a short delay (to allow dedupe of rapid retries)
        setTimeout(() => this.inflightRequests.delete(dedupeKey), 100);
      }
    });

    if (dedupeKey) {
      this.inflightRequests.set(dedupeKey, promise);
    }

    return promise;
  }

  /**
   * Parse and validate the response.
   */
  private async parseResponse<T>(response: Response, schema: ZodSchema<T>): Promise<T> {
    if (!response.ok) {
      throw new Error(`[ApiClient] HTTP ${response.status}: ${response.statusText}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (err) {
      throw new Error(`[ApiClient] Failed to parse JSON: ${(err as Error).message}`);
    }

    // Validate against schema
    const result = schema.safeParse(data);
    if (!result.success) {
      console.error(`[ApiClient] Schema validation failed for response:`, result.error);
      // Show user-friendly toast (don't leak schema internals)
      toast.error('استجابة غير متوقعة من الخادم. يرجى المحاولة لاحقاً.');
      throw new Error(`[ApiClient] Schema validation failed: ${result.error.message}`);
    }

    return result.data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Singleton instance. */
export const apiClient = new ApiClient();

/** Register in DI container. */
container.registerInstance(TOKENS.ApiClient, apiClient);
