/**
 * Tests for the lightweight schema validation system.
 *
 * Verifies:
 *   - Primitives (string, number, boolean)
 *   - Modifiers (optional, nullable)
 *   - Objects with nested validation
 *   - Arrays
 *   - Error messages with path information
 *   - safeParse vs parse
 *   - Quran API schemas match real API response shapes
 */

import { describe, it, expect } from 'vitest';
import { z, SchemaError } from '../schemas.js';
import {
  AyahApiSchema,
  SurahApiSchema,
  SurahListItemApiSchema,
  SurahListApiResponseSchema,
  SurahApiResponseSchema,
  PrayerTimingsSchema,
  AladhanApiResponseSchema,
  TafsirApiResponseSchema,
  ApiResponseSchema,
  HijriDateSchema,
  GregorianDateSchema,
  ReciterAudioSchema,
  Mp3QuranApiResponseSchema,
  validate,
  tryValidate,
} from '../api-schemas.js';
import { validate as reValidate, SchemaError as ReSchemaError } from '../schemas-validate.js';

describe('Schema primitives', () => {
  describe('z.string()', () => {
    it('should accept strings', () => {
      expect(z.string().parse('hello')).toBe('hello');
      expect(z.string().parse('')).toBe('');
    });

    it('should reject non-strings', () => {
      expect(() => z.string().parse(42)).toThrow(SchemaError);
      expect(() => z.string().parse(null)).toThrow(SchemaError);
      expect(() => z.string().parse(true)).toThrow(SchemaError);
      expect(() => z.string().parse({})).toThrow(SchemaError);
    });
  });

  describe('z.number()', () => {
    it('should accept numbers', () => {
      expect(z.number().parse(42)).toBe(42);
      expect(z.number().parse(0)).toBe(0);
      expect(z.number().parse(-1.5)).toBe(-1.5);
    });

    it('should reject NaN', () => {
      expect(() => z.number().parse(NaN)).toThrow(SchemaError);
    });

    it('should reject non-numbers', () => {
      expect(() => z.number().parse('42')).toThrow(SchemaError);
      expect(() => z.number().parse(null)).toThrow(SchemaError);
    });
  });

  describe('z.boolean()', () => {
    it('should accept booleans', () => {
      expect(z.boolean().parse(true)).toBe(true);
      expect(z.boolean().parse(false)).toBe(false);
    });

    it('should reject non-booleans', () => {
      expect(() => z.boolean().parse(1)).toThrow(SchemaError);
      expect(() => z.boolean().parse('true')).toThrow(SchemaError);
    });
  });
});

describe('Schema modifiers', () => {
  describe('z.optional()', () => {
    it('should accept defined values', () => {
      expect(z.optional(z.string()).parse('hello')).toBe('hello');
    });

    it('should accept undefined', () => {
      expect(z.optional(z.string()).parse(undefined)).toBeUndefined();
    });

    it('should accept null (treats as undefined)', () => {
      expect(z.optional(z.string()).parse(null)).toBeUndefined();
    });

    it('should reject wrong types when defined', () => {
      expect(() => z.optional(z.string()).parse(42)).toThrow(SchemaError);
    });
  });

  describe('z.nullable()', () => {
    it('should accept defined values', () => {
      expect(z.nullable(z.string()).parse('hello')).toBe('hello');
    });

    it('should accept null', () => {
      expect(z.nullable(z.string()).parse(null)).toBeNull();
    });

    it('should reject undefined', () => {
      expect(() => z.nullable(z.string()).parse(undefined)).toThrow(SchemaError);
    });
  });
});

describe('Object schema', () => {
  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.optional(z.string()),
  });

  it('should accept valid objects', () => {
    const user = UserSchema.parse({ id: 1, name: 'Ahmed' });
    expect(user.id).toBe(1);
    expect(user.name).toBe('Ahmed');
    expect(user.email).toBeUndefined();
  });

  it('should accept objects with optional fields', () => {
    const user = UserSchema.parse({ id: 1, name: 'Ahmed', email: 'a@b.com' });
    expect(user.email).toBe('a@b.com');
  });

  it('should reject non-objects', () => {
    expect(() => UserSchema.parse('not an object')).toThrow(SchemaError);
    expect(() => UserSchema.parse(null)).toThrow(SchemaError);
    expect(() => UserSchema.parse([])).toThrow(SchemaError);
  });

  it('should reject missing required fields', () => {
    expect(() => UserSchema.parse({ id: 1 })).toThrow(SchemaError);
  });

  it('should reject wrong field types', () => {
    expect(() => UserSchema.parse({ id: '1', name: 'Ahmed' })).toThrow(SchemaError);
  });

  it('should report all errors with paths', () => {
    try {
      UserSchema.parse({ id: 'bad', name: 123 });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaError);
      const issues = (error as SchemaError).issues;
      expect(issues.length).toBe(2);
      expect(issues.some((i) => i.path === 'id')).toBe(true);
      expect(issues.some((i) => i.path === 'name')).toBe(true);
    }
  });
});

describe('Array schema', () => {
  const NumbersSchema = z.array(z.number());

  it('should accept arrays', () => {
    expect(NumbersSchema.parse([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('should accept empty arrays', () => {
    expect(NumbersSchema.parse([])).toEqual([]);
  });

  it('should reject non-arrays', () => {
    expect(() => NumbersSchema.parse('not an array')).toThrow(SchemaError);
    expect(() => NumbersSchema.parse({})).toThrow(SchemaError);
  });

  it('should reject arrays with wrong element types', () => {
    expect(() => NumbersSchema.parse([1, 'two', 3])).toThrow(SchemaError);
  });

  it('should report error path with index', () => {
    try {
      NumbersSchema.parse([1, 'bad', 3]);
      expect.fail('Should have thrown');
    } catch (error) {
      const issues = (error as SchemaError).issues;
      expect(issues[0]?.path).toBe('[1]');
    }
  });
});

describe('safeParse', () => {
  it('should return success result for valid data', () => {
    const result = z.string().safeParse('hello');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('hello');
    }
  });

  it('should return error result for invalid data', () => {
    const result = z.string().safeParse(42);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(SchemaError);
    }
  });
});

describe('SchemaError', () => {
  it('should format issues in message', () => {
    const error = new SchemaError([
      { path: 'name', message: 'Expected string' },
      { path: 'age', message: 'Expected number' },
    ]);
    expect(error.message).toContain('name');
    expect(error.message).toContain('Expected string');
    expect(error.message).toContain('age');
    expect(error.message).toContain('Expected number');
  });
});

describe('Quran API schemas', () => {
  describe('AyahApiSchema', () => {
    it('should accept valid ayah data', () => {
      const ayah = {
        number: 1,
        numberInSurah: 1,
        text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        audio: 'https://example.com/audio.mp3',
        sajda: false,
      };
      const result = AyahApiSchema.safeParse(ayah);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.numberInSurah).toBe(1);
      }
    });

    it('should accept minimal ayah (no optional fields)', () => {
      const ayah = {
        number: 1,
        numberInSurah: 1,
        text: 'بسم الله',
      };
      const result = AyahApiSchema.safeParse(ayah);
      expect(result.success).toBe(true);
    });

    it('should reject ayah missing required fields', () => {
      const invalid = { number: 1, text: 'بسم الله' };
      const result = AyahApiSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('SurahApiSchema', () => {
    it('should accept valid surah with ayahs', () => {
      const surah = {
        number: 1,
        name: 'الفاتحة',
        englishName: 'Al-Fatihah',
        englishNameTranslation: 'The Opening',
        revelationType: 'Meccan',
        numberOfAyahs: 7,
        ayahs: [
          { number: 1, numberInSurah: 1, text: 'بسم الله' },
          { number: 2, numberInSurah: 2, text: 'الحمد لله' },
        ],
      };
      const result = SurahApiSchema.safeParse(surah);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ayahs.length).toBe(2);
      }
    });
  });

  describe('SurahListApiResponseSchema', () => {
    it('should accept AlQuran.cloud surah-list response', () => {
      const response = {
        code: 200,
        status: 'OK',
        data: [
          {
            number: 1,
            name: 'الفاتحة',
            englishName: 'Al-Fatihah',
            englishNameTranslation: 'The Opening',
            numberOfAyahs: 7,
            revelationType: 'Meccan',
          },
          {
            number: 2,
            name: 'البقرة',
            englishName: 'Al-Baqarah',
            englishNameTranslation: 'The Cow',
            numberOfAyahs: 286,
            revelationType: 'Medinan',
          },
        ],
      };
      const result = SurahListApiResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.length).toBe(2);
      }
    });
  });

  describe('SurahApiResponseSchema', () => {
    it('should accept single-surah response', () => {
      const response = {
        code: 200,
        status: 'OK',
        data: {
          number: 1,
          name: 'الفاتحة',
          englishName: 'Al-Fatihah',
          englishNameTranslation: 'The Opening',
          revelationType: 'Meccan',
          numberOfAyahs: 7,
          ayahs: [{ number: 1, numberInSurah: 1, text: 'بسم الله' }],
        },
      };
      const result = SurahApiResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('AladhanApiResponseSchema', () => {
    it('should accept Aladhan prayer times response', () => {
      const response = {
        code: 200,
        status: 'OK',
        data: {
          timings: {
            Fajr: '05:00',
            Sunrise: '06:30',
            Dhuhr: '12:00',
            Asr: '15:30',
            Maghrib: '18:00',
            Isha: '19:30',
          },
          date: {
            readable: '01 Jan 2025',
            timestamp: '1234567890',
            hijri: {
              date: '01-01-1446',
              day: '01',
              month: { number: 1, en: 'Muharram', ar: 'محرم' },
              year: '1446',
              weekday: { en: 'Monday', ar: 'الاثنين' },
            },
            gregorian: {
              date: '01-01-2025',
              day: '01',
              month: { number: 1, en: 'January' },
              year: '2025',
              weekday: { en: 'Wednesday' },
            },
          },
          meta: {
            latitude: 21.4225,
            longitude: 39.8262,
            timezone: 'Asia/Riyadh',
            method: { id: 4, name: 'Umm Al-Qura University, Makkah' },
          },
        },
      };
      const result = AladhanApiResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data.timings.Fajr).toBe('05:00');
      }
    });
  });

  describe('TafsirApiResponseSchema', () => {
    it('should accept tafsir response', () => {
      const response = {
        text: 'تفسير الآية',
        surah: 1,
        ayah: 1,
        edition: {
          identifier: 'ar-tafsir-muyassar',
          language: 'ar',
          name: 'التفسير الميسر',
        },
      };
      const result = TafsirApiResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should accept minimal tafsir (just text)', () => {
      const response = { text: 'تفسير بسيط' };
      const result = TafsirApiResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe('Helper functions', () => {
  describe('validate()', () => {
    it('should return parsed data on success', () => {
      const result = validate('hello', z.string());
      expect(result).toBe('hello');
    });

    it('should throw on failure', () => {
      expect(() => validate(42, z.string())).toThrow(SchemaError);
    });
  });

  describe('tryValidate()', () => {
    it('should return data on success', () => {
      const result = tryValidate('hello', z.string());
      expect(result).toBe('hello');
    });

    it('should return null on failure', () => {
      const result = tryValidate(42, z.string());
      expect(result).toBeNull();
    });
  });

  describe('schemas-validate re-exports', () => {
    it('should re-export validate from api-schemas', () => {
      expect(reValidate('hello', z.string())).toBe('hello');
    });

    it('should re-export SchemaError class', () => {
      const err = new ReSchemaError([{ path: 'x', message: 'fail' }]);
      expect(err).toBeInstanceOf(SchemaError);
      expect(err.message).toContain('fail');
    });
  });
});

describe('Additional API schemas', () => {
  describe('ApiResponseSchema', () => {
    it('should accept generic AlQuran.cloud response', () => {
      const response = { code: 200, status: 'OK', data: 'some text' };
      const result = ApiResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should accept response without data', () => {
      const response = { code: 200, status: 'OK' };
      const result = ApiResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('HijriDateSchema', () => {
    it('should accept valid Hijri date', () => {
      const date = {
        date: '01-01-1446',
        day: '01',
        month: { number: 1, en: 'Muharram', ar: 'محرم' },
        year: '1446',
        weekday: { en: 'Monday', ar: 'الاثنين' },
      };
      const result = HijriDateSchema.safeParse(date);
      expect(result.success).toBe(true);
    });
  });

  describe('GregorianDateSchema', () => {
    it('should accept valid Gregorian date', () => {
      const date = {
        date: '01-01-2025',
        day: '01',
        month: { number: 1, en: 'January' },
        year: '2025',
        weekday: { en: 'Wednesday' },
      };
      const result = GregorianDateSchema.safeParse(date);
      expect(result.success).toBe(true);
    });
  });

  describe('ReciterAudioSchema', () => {
    it('should accept valid reciter audio entry', () => {
      const reciter = {
        id: '1',
        name: 'العفاسي',
        surah: '001',
        server: 'https://example.com/',
      };
      const result = ReciterAudioSchema.safeParse(reciter);
      expect(result.success).toBe(true);
    });
  });

  describe('Mp3QuranApiResponseSchema', () => {
    it('should accept mp3quran.net API response', () => {
      const response = {
        reciters: [
          {
            id: '1',
            name: 'العفاسي',
            surah: '001,002',
            server: 'https://server11.mp3quran.net/afasy/',
          },
        ],
      };
      const result = Mp3QuranApiResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reciters.length).toBe(1);
      }
    });
  });
});

describe('Error messages', () => {
  it('should include type information in errors', () => {
    try {
      z.string().parse(42);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaError);
      const issues = (error as SchemaError).issues;
      expect(issues[0]?.message).toContain('Expected string');
      expect(issues[0]?.message).toContain('number');
    }
  });

  it('should include path in nested object errors', () => {
    const Schema = z.object({
      user: z.object({
        name: z.string(),
      }),
    });
    try {
      Schema.parse({ user: { name: 123 } });
      expect.fail('Should have thrown');
    } catch (error) {
      const issues = (error as SchemaError).issues;
      expect(issues[0]?.path).toBe('user.name');
    }
  });

  it('should include index in array errors', () => {
    const Schema = z.array(z.number());
    try {
      Schema.parse([1, 2, 'three']);
      expect.fail('Should have thrown');
    } catch (error) {
      const issues = (error as SchemaError).issues;
      expect(issues[0]?.path).toBe('[2]');
    }
  });
});
