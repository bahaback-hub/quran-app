/**
 * ================================================================
 * Quran API Schemas
 * ----------------------------------------------------------------
 * Schemas for all external API responses used in the app.
 * Replaces unsafe `as Type` assertions with runtime validation.
 *
 * APIs covered:
 *   - AlQuran.cloud (surah list, single surah, editions)
 *   - Aladhan (prayer times)
 *   - Tafsir API (jsDelivr-hosted)
 *   - mp3quran.net (audio recitations)
 * ================================================================
 */

import { z, type Infer } from './schemas.js';

// ================================================================
// AlQuran.cloud Schemas
// ================================================================

/** Single ayah from AlQuran.cloud API. */
export const AyahApiSchema = z.object({
  number: z.number(),
  numberInSurah: z.number(),
  text: z.string(),
  audio: z.optional(z.string()),
  audioSecondary: z.optional(z.array(z.string())),
  sajda: z.optional(z.boolean()),
  juz: z.optional(z.number()),
  page: z.optional(z.number()),
  manzil: z.optional(z.number()),
  ruku: z.optional(z.number()),
  hizbQuarter: z.optional(z.number()),
});
export type AyahApi = Infer<typeof AyahApiSchema>;

/** Surah from AlQuran.cloud API (full, with ayahs). */
export const SurahApiSchema = z.object({
  number: z.number(),
  name: z.string(),
  englishName: z.string(),
  englishNameTranslation: z.string(),
  revelationType: z.string(),
  numberOfAyahs: z.number(),
  ayahs: z.array(AyahApiSchema),
});
export type SurahApi = Infer<typeof SurahApiSchema>;

/** Surah list item (no ayahs, used in surah-list endpoint). */
export const SurahListItemApiSchema = z.object({
  number: z.number(),
  name: z.string(),
  englishName: z.string(),
  englishNameTranslation: z.string(),
  numberOfAyahs: z.number(),
  revelationType: z.string(),
});
export type SurahListItemApi = Infer<typeof SurahListItemApiSchema>;

/** AlQuran.cloud standard response envelope. */
export const ApiResponseSchema = z.object({
  code: z.number(),
  status: z.string(),
  data: z.optional(z.string()),
});

/** Response: list of surahs. */
export const SurahListApiResponseSchema = z.object({
  code: z.number(),
  status: z.string(),
  data: z.array(SurahListItemApiSchema),
});
export type SurahListApiResponse = Infer<typeof SurahListApiResponseSchema>;

/** Response: single surah (with ayahs). */
export const SurahApiResponseSchema = z.object({
  code: z.number(),
  status: z.string(),
  data: SurahApiSchema,
});
export type SurahApiResponse = Infer<typeof SurahApiResponseSchema>;

// ================================================================
// Aladhan Prayer Times Schemas
// ================================================================

export const PrayerTimingsSchema = z.object({
  Fajr: z.string(),
  Sunrise: z.string(),
  Dhuhr: z.string(),
  Asr: z.string(),
  Maghrib: z.string(),
  Isha: z.string(),
  Imsak: z.optional(z.string()),
  Midnight: z.optional(z.string()),
  Firstthird: z.optional(z.string()),
  Lastthird: z.optional(z.string()),
});
export type PrayerTimings = Infer<typeof PrayerTimingsSchema>;

export const HijriDateSchema = z.object({
  date: z.string(),
  day: z.string(),
  month: z.object({
    number: z.number(),
    en: z.string(),
    ar: z.string(),
  }),
  year: z.string(),
  weekday: z.object({
    en: z.string(),
    ar: z.string(),
  }),
});

export const GregorianDateSchema = z.object({
  date: z.string(),
  day: z.string(),
  month: z.object({
    number: z.number(),
    en: z.string(),
  }),
  year: z.string(),
  weekday: z.object({
    en: z.string(),
  }),
});

export const AladhanApiResponseSchema = z.object({
  code: z.number(),
  status: z.string(),
  data: z.object({
    timings: PrayerTimingsSchema,
    date: z.object({
      readable: z.string(),
      timestamp: z.optional(z.string()),
      hijri: HijriDateSchema,
      gregorian: GregorianDateSchema,
    }),
    meta: z.object({
      latitude: z.number(),
      longitude: z.number(),
      timezone: z.string(),
      method: z.object({
        id: z.number(),
        name: z.string(),
      }),
    }),
  }),
});
export type AladhanApiResponse = Infer<typeof AladhanApiResponseSchema>;

// ================================================================
// Tafsir API Schemas (jsDelivr-hosted)
// ================================================================

export const TafsirApiResponseSchema = z.object({
  text: z.string(),
  surah: z.optional(z.number()),
  ayah: z.optional(z.number()),
  edition: z.optional(
    z.object({
      identifier: z.string(),
      language: z.string(),
      name: z.string(),
    }),
  ),
});
export type TafsirApiResponse = Infer<typeof TafsirApiResponseSchema>;

// ================================================================
// mp3quran.net Schemas
// ================================================================

export const ReciterAudioSchema = z.object({
  id: z.string(),
  name: z.string(),
  surah: z.string(),
  moshaf: z.optional(z.string()),
  letter: z.optional(z.string()),
  server: z.string(),
});
export type ReciterAudio = Infer<typeof ReciterAudioSchema>;

export const Mp3QuranApiResponseSchema = z.object({
  reciters: z.array(ReciterAudioSchema),
});
export type Mp3QuranApiResponse = Infer<typeof Mp3QuranApiResponseSchema>;

// ================================================================
// Convenience: validate helper
// ================================================================

/**
 * Validate data against a schema and throw a clear error on failure.
 * Use this in API calls instead of `as Type` assertions.
 *
 * @example
 *   const surah = validate(await response.json(), SurahApiResponseSchema);
 *   // surah is fully typed & validated at runtime
 */
export function validate<T>(data: unknown, schema: { parse: (d: unknown) => T }): T {
  return schema.parse(data);
}

/**
 * Validate data against a schema, returning null on failure (no throw).
 * Useful when you want graceful degradation.
 *
 * @example
 *   const surah = tryValidate(await response.json(), SurahApiResponseSchema);
 *   if (!surah) { showError(); return; }
 */
export function tryValidate<T>(
  data: unknown,
  schema: { safeParse: (d: unknown) => { success: true; data: T } | { success: false; error: unknown } },
): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
