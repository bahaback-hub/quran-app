/**
 * Offline prayer-time tables: the date-aware 1448 H JSON (primary source for
 * the ten covered Saudi cities) and the date-less official fallback snapshot.
 *
 * `prayer.ts` owns sequencing and rendering; this module only resolves tables.
 */
import { jsonFetch } from '../../api-client.js';
import type { PrayerTimes } from '../../types.js';

/* ===================== LOCAL OFFLINE PRAYER TIMES (1448 H) ===================== */

/** Map English/Arabic city names to the keys in prayer-times-1448.json */
const LOCAL_CITY_MAP: Record<string, string> = {
  makkah: 'مكة المكرمة',
  mecca: 'مكة المكرمة',
  مكة: 'مكة المكرمة',
  'مكة المكرمة': 'مكة المكرمة',
  madinah: 'المدينة المنورة',
  medina: 'المدينة المنورة',
  المدينة: 'المدينة المنورة',
  'المدينة المنورة': 'المدينة المنورة',
  riyadh: 'الرياض',
  الرياض: 'الرياض',
  jeddah: 'جدة',
  جدة: 'جدة',
  dammam: 'الدمام',
  الدمام: 'الدمام',
  abha: 'أبها',
  أبها: 'أبها',
  tabuk: 'تبوك',
  تبوك: 'تبوك',
  buraydah: 'بريدة',
  buraidah: 'بريدة',
  بريدة: 'بريدة',
  hail: 'حائل',
  حائل: 'حائل',
  taif: 'الطائف',
  الطائف: 'الطائف',
};

/** True when the offline tables cover this city (spelling variants included). */
export function isSaudiCity(city: string): boolean {
  return Boolean(LOCAL_CITY_MAP[city.trim().toLowerCase()] || LOCAL_CITY_MAP[city.trim()]);
}

/** Get today's Hijri date in YYYY-MM-DD format (Umm Al-Qura calendar) */
function getTodayHijriISO(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    let day = '',
      month = '',
      year = '';
    for (const p of parts) {
      if (p.type === 'day') {
        day = p.value;
      } else if (p.type === 'month') {
        month = p.value;
      } else if (p.type === 'year') {
        year = p.value;
      }
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/** Local prayer times JSON cache (loaded once per session) */
let _localPrayerJSON: Record<string, unknown> | null = null;

/**
 * Load prayer times from the local offline JSON file (prayer-times-1448.json).
 * Returns PrayerTimes if the city is found and today's date matches.
 * This is instant (no network) and works fully offline.
 */
/** @internal exported for unit testing the offline-table guard */
export async function loadPrayerTimesFromLocalJSON(city: string): Promise<Record<string, string> | null> {
  try {
    // Normalize city name to match JSON keys
    const norm = city.trim().toLowerCase();
    const jsonCity = LOCAL_CITY_MAP[norm] || LOCAL_CITY_MAP[city.trim()];
    if (!jsonCity) {
      // City is not covered by the offline table — do NOT fetch the ~975 KB
      // JSON just to discover it is unsupported. Return early and let the
      // caller fall through to the Aladhan API instead.
      return null;
    }

    // Load JSON file (cached after first load).
    // NOTE: the file is ~975 KB; we only parse it when we already know the
    // requested city is covered, so we never load it for unsupported cities.
    if (!_localPrayerJSON) {
      const url = `${import.meta.env.BASE_URL}data/prayer-times-1448.json`;
      // Throws on failure → the outer catch returns null and the caller
      // falls back to cached/API timings.
      _localPrayerJSON = await jsonFetch<Record<string, unknown>>(url, { silent: true });
    }

    const cities = (_localPrayerJSON as Record<string, unknown>)['cities'] as Record<
      string,
      { days: Array<Record<string, string>> }
    >;
    if (!cities || !cities[jsonCity]) {
      return null;
    }

    // Get today's GREGORIAN date in YYYY-MM-DD format
    // The JSON `date` field is Gregorian (e.g., "2026-08-30"), NOT Hijri
    const today = new Date();
    const todayGreg = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Also get today's Hijri date in DD-MM-YYYY format to match the `hijri` field
    const todayHijri = getTodayHijriISO(); // Returns YYYY-MM-DD
    let todayHijriDDMMYYYY = '';
    if (todayHijri) {
      const parts = todayHijri.split('-');
      todayHijriDDMMYYYY = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    // Find today's entry — match by GREGORIAN date (primary) or Hijri date (fallback)
    const days = cities[jsonCity].days;
    let todayData = days.find((d: Record<string, string>) => d['date'] === todayGreg);

    // Fallback: match by Hijri date field (DD-MM-YYYY)
    if (!todayData && todayHijriDDMMYYYY) {
      todayData = days.find((d: Record<string, string>) => d['hijri'] === todayHijriDDMMYYYY);
    }

    // Last fallback: match by month-day of Gregorian date
    if (!todayData) {
      const monthDay = todayGreg.substring(5); // "MM-DD"
      todayData = days.find((d: Record<string, string>) => {
        const dDate = d['date'];
        return typeof dDate === 'string' && dDate.endsWith(monthDay);
      });
    }

    if (!todayData) {
      return null;
    }

    // Return in the same format as Aladhan API timings
    return {
      Fajr: todayData['Fajr'] || '00:00',
      Sunrise: todayData['Sunrise'] || '00:00',
      Dhuhr: todayData['Dhuhr'] || '00:00',
      Asr: todayData['Asr'] || '00:00',
      Maghrib: todayData['Maghrib'] || '00:00',
      Isha: todayData['Isha'] || '00:00',
    };
  } catch {
    return null;
  }
}

/* ===================== INTERFACES ===================== */

/** Shape of cached prayer times stored in localStorage. */
export interface CachedPrayerTimes {
  date: string;
  timings: PrayerTimes;
  city: string;
  country: string;
  method: string;
}

/** Device-derived times are deliberately kept separate from an explicitly selected city. */
export interface CachedLocalPrayerTimes {
  date: string;
  timings: PrayerTimes;
  method: string;
  source: 'device-location';
}

export const LOCAL_PRAYER_CACHE_KEY = 'cached_local_prayer_times';
export const PRAYER_CACHE_MAX_AGE_DAYS = 3;

/* ===================== OFFICIAL UNDERWRITTEN TABLE ===================== */

/* Official Umm Al-Qura (رئاسة الحرمين) times for major Saudi cities.
 * Loaded once from public/data/prayer-times-underwritten.json. It is a date-less
 * static snapshot, so it is only a last-resort fallback (Strategy 0.5) for dates
 * the date-aware prayer-times-1448.json does not cover — never the primary source,
 * which would freeze summer values onto the whole year. */
let underwrittenTable: Record<string, Record<string, string>> | null = null;
let underwrittenLoaded = false;

export async function loadUnderwrittenPrayerTable(): Promise<void> {
  if (underwrittenLoaded) {
    return;
  }
  underwrittenLoaded = true;
  try {
    const json = await jsonFetch<Record<string, Record<string, string>>>(
      `${import.meta.env.BASE_URL}data/prayer-times-underwritten.json`,
      { silent: true },
    );
    delete (json as Record<string, unknown>)['_comment'];
    underwrittenTable = json;
  } catch {
    underwrittenTable = null;
  }
}

export function getUnderwrittenPrayerTimes(city: string): Record<string, string> | null {
  if (!underwrittenTable) {
    return null;
  }
  const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, '');
  const c = norm(city);
  for (const [key, val] of Object.entries(underwrittenTable)) {
    if (norm(key) === c) {
      return val;
    }
    const label = val['label'];
    if (label && norm(label) === c) {
      return val;
    }
  }
  return null;
}
