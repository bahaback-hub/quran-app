/**
 * ================================================================
 * API Schemas — Solves Problem #8
 * ----------------------------------------------------------------
 * Replaces `await response.json() as SomeType` (which is unsafe)
 * with runtime schema validation using Zod.
 *
 * Benefits:
 *   1. Catches API contract violations at runtime
 *   2. Type-safe (TypeScript infers types from schemas)
 *   3. Clear error messages when data doesn't match
 *   4. Self-documenting (schema IS the documentation)
 *
 * If Zod is not installed, this file provides a minimal compatible
 * API using a hand-rolled schema validator.
 * ================================================================
 */

// ================================================================
// Minimal Zod-compatible schema implementation
// (Drop-in replacement — install real zod for production)
// ================================================================

export interface ZodSchema<T> {
  parse(data: unknown): T;
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: ZodError };
  _type: T; // phantom type
}

export class ZodError extends Error {
  constructor(public readonly issues: Array<{ path: string; message: string }>) {
    super(`Schema validation failed:\n${issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')}`);
    this.name = 'ZodError';
  }
}

// === Primitives ===
export function z_string(): ZodSchema<string> {
  return {
    _type: undefined as never,
    parse(data: unknown): string {
      if (typeof data !== 'string') {
        throw new ZodError([{ path: '', message: `Expected string, got ${typeof data}` }]);
      }
      return data;
    },
    safeParse(data: unknown) {
      try {
        return { success: true, data: this.parse(data) };
      } catch (error) {
        return { success: false, error: error as ZodError };
      }
    },
  };
}

export function z_number(): ZodSchema<number> {
  return {
    _type: undefined as never,
    parse(data: unknown): number {
      if (typeof data !== 'number' || Number.isNaN(data)) {
        throw new ZodError([{ path: '', message: `Expected number, got ${typeof data}` }]);
      }
      return data;
    },
    safeParse(data: unknown) {
      try {
        return { success: true, data: this.parse(data) };
      } catch (error) {
        return { success: false, error: error as ZodError };
      }
    },
  };
}

export function z_boolean(): ZodSchema<boolean> {
  return {
    _type: undefined as never,
    parse(data: unknown): boolean {
      if (typeof data !== 'boolean') {
        throw new ZodError([{ path: '', message: `Expected boolean, got ${typeof data}` }]);
      }
      return data;
    },
    safeParse(data: unknown) {
      try {
        return { success: true, data: this.parse(data) };
      } catch (error) {
        return { success: false, error: error as ZodError };
      }
    },
  };
}

// === Optional / Nullable ===
export function z_optional<T>(schema: ZodSchema<T>): ZodSchema<T | undefined> {
  return {
    _type: undefined as never,
    parse(data: unknown): T | undefined {
      if (data === undefined || data === null) return undefined;
      return schema.parse(data);
    },
    safeParse(data: unknown) {
      try {
        return { success: true, data: this.parse(data) };
      } catch (error) {
        return { success: false, error: error as ZodError };
      }
    },
  };
}

export function z_nullable<T>(schema: ZodSchema<T>): ZodSchema<T | null> {
  return {
    _type: undefined as never,
    parse(data: unknown): T | null {
      if (data === null) return null;
      return schema.parse(data);
    },
    safeParse(data: unknown) {
      try {
        return { success: true, data: this.parse(data) };
      } catch (error) {
        return { success: false, error: error as ZodError };
      }
    },
  };
}

// === Objects ===
type ObjectSchema<T extends Record<string, ZodSchema<unknown>>> = ZodSchema<{
  [K in keyof T]: T[K] extends ZodSchema<infer U> ? U : never;
}>;

export function z_object<T extends Record<string, ZodSchema<unknown>>>(
  fields: T,
): ObjectSchema<T> {
  return {
    _type: undefined as never,
    parse(data: unknown) {
      if (typeof data !== 'object' || data === null) {
        throw new ZodError([{ path: '', message: `Expected object, got ${typeof data}` }]);
      }
      const result: Record<string, unknown> = {};
      for (const [key, schema] of Object.entries(fields)) {
        const value = (data as Record<string, unknown>)[key];
        try {
          result[key] = schema.parse(value);
        } catch (error) {
          if (error instanceof ZodError) {
            throw new ZodError(
              error.issues.map((i) => ({ path: `${key}.${i.path}`, message: i.message })),
            );
          }
          throw error;
        }
      }
      return result as { [K in keyof T]: T[K] extends ZodSchema<infer U> ? U : never };
    },
    safeParse(data: unknown) {
      try {
        return { success: true, data: this.parse(data) };
      } catch (error) {
        return { success: false, error: error as ZodError };
      }
    },
  };
}

// === Arrays ===
export function z_array<T>(schema: ZodSchema<T>): ZodSchema<T[]> {
  return {
    _type: undefined as never,
    parse(data: unknown): T[] {
      if (!Array.isArray(data)) {
        throw new ZodError([{ path: '', message: `Expected array, got ${typeof data}` }]);
      }
      return data.map((item, i) => {
        try {
          return schema.parse(item);
        } catch (error) {
          if (error instanceof ZodError) {
            throw new ZodError(
              error.issues.map((iss) => ({ path: `[${i}].${iss.path}`, message: iss.message })),
            );
          }
          throw error;
        }
      });
    },
    safeParse(data: unknown) {
      try {
        return { success: true, data: this.parse(data) };
      } catch (error) {
        return { success: false, error: error as ZodError };
      }
    },
  };
}

// ================================================================
// Quran API Schemas
// ================================================================

/** AlQuran.cloud API: Ayah shape. */
export const AyahSchema = z_object({
  number: z_number(),
  numberInSurah: z_number(),
  text: z_string(),
  audio: z_optional(z_string()),
  audioSecondary: z_optional(z_array(z_string())),
  sajda: z_optional(z_boolean()),
  juz: z_optional(z_number()),
  page: z_optional(z_number()),
});

export type ApiAyah = typeof AyahSchema._type;

/** AlQuran.cloud API: Surah shape. */
export const SurahSchema = z_object({
  number: z_number(),
  name: z_string(),
  englishName: z_string(),
  englishNameTranslation: z_string(),
  numberOfAyahs: z_number(),
  revelationType: z_string(),
  ayahs: z_array(AyahSchema),
});

export type ApiSurah = typeof SurahSchema._type;

/** AlQuran.cloud API: Surah list item (no ayahs). */
export const SurahListItemSchema = z_object({
  number: z_number(),
  name: z_string(),
  englishName: z_string(),
  englishNameTranslation: z_string(),
  numberOfAyahs: z_number(),
  revelationType: z_string(),
});

export type ApiSurahListItem = typeof SurahListItemSchema._type;

/** AlQuran.cloud API: Surah list response. */
export const SurahListResponseSchema = z_object({
  code: z_number(),
  status: z_string(),
  data: z_array(SurahListItemSchema),
});

/** AlQuran.cloud API: Single surah response. */
export const SurahResponseSchema = z_object({
  code: z_number(),
  status: z_string(),
  data: SurahSchema,
});

// ================================================================
// Aladhan API Schemas (Prayer Times)
// ================================================================

export const PrayerTimesSchema = z_object({
  Fajr: z_string(),
  Sunrise: z_string(),
  Dhuhr: z_string(),
  Asr: z_string(),
  Maghrib: z_string(),
  Isha: z_string(),
  Imsak: z_optional(z_string()),
  Midnight: z_optional(z_string()),
});

export const AladhanResponseSchema = z_object({
  code: z_number(),
  status: z_string(),
  data: z_object({
    timings: PrayerTimesSchema,
    date: z_object({
      readable: z_string(),
      timestamp: z_optional(z_string()),
      hijri: z_object({
        date: z_string(),
        day: z_string(),
        month: z_object({
          number: z_number(),
          en: z_string(),
          ar: z_string(),
        }),
        year: z_string(),
      }),
    }),
  }),
});

// ================================================================
// Tafsir API Schemas
// ================================================================

export const TafsirResponseSchema = z_object({
  code: z_number(),
  status: z_string(),
  data: z_object({
    text: z_string(),
    surah: z_number(),
    ayah: z_number(),
    edition: z_object({
      identifier: z_string(),
      language: z_string(),
      name: z_string(),
    }),
  }),
});
