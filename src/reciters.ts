import { __ } from './i18n.js';

/** Represents a Quran reciter from either the AlQuran.cloud API or mp3quran.net. */
export interface Reciter {
  id: string;
  /** i18n key for the reciter's display name (resolved via getReciterDisplayName). */
  name: string;
  source: 'api' | 'mp3quran';
  server?: string;
}

/** List of available Quran reciters from multiple sources.
 *  The `name` field stores an i18n key — use `getReciterDisplayName()` to resolve it. */
export const RECITERS: Reciter[] = [
  // ——— API sources (AlQuran.cloud) ———
  { id: 'ar.alafasy', name: 'reciter_alafasy', source: 'api' },
  { id: 'ar.abdulbasitmurattal', name: 'reciter_abdulbasit_murattal', source: 'api' },
  { id: 'ar.abdulsamad', name: 'reciter_abdulsamad', source: 'api' },
  { id: 'ar.abdurrahmaansudais', name: 'reciter_sudais', source: 'api' },
  { id: 'ar.husary', name: 'reciter_husary', source: 'api' },
  { id: 'ar.minshawi', name: 'reciter_minshawi_murattal', source: 'api' },
  { id: 'ar.minshawimujawwad', name: 'reciter_minshawi_mujawwad', source: 'api' },
  { id: 'ar.muhammadayyoub', name: 'reciter_ayyoub', source: 'api' },
  { id: 'ar.shaatree', name: 'reciter_shaatree', source: 'api' },
  { id: 'ar.abdullahbasfar', name: 'reciter_basfar', source: 'api' },
  { id: 'ar.ahmedajamy', name: 'reciter_ajamy', source: 'api' },

  // ——— mp3quran.net sources (full surah audio) ———
  { id: 's_gmd', name: 'reciter_ghamdi', source: 'mp3quran', server: 'https://server7.mp3quran.net/s_gmd' },
  { id: 'shur', name: 'reciter_shuraim', source: 'mp3quran', server: 'https://server7.mp3quran.net/shur' },
  { id: 's_bud', name: 'reciter_budayr', source: 'mp3quran', server: 'https://server6.mp3quran.net/s_bud' },
  { id: 'bu_khtr', name: 'reciter_bukhatir', source: 'mp3quran', server: 'https://server8.mp3quran.net/bu_khtr' },
  { id: 'hthfi', name: 'reciter_huthaify', source: 'mp3quran', server: 'https://server9.mp3quran.net/hthfi' },
  { id: 'a_jbr', name: 'reciter_jaber', source: 'mp3quran', server: 'https://server11.mp3quran.net/a_jbr' },
  { id: 'frs_a', name: 'reciter_abbad', source: 'mp3quran', server: 'https://server8.mp3quran.net/frs_a' },
  { id: 'yasser', name: 'reciter_dosari', source: 'mp3quran', server: 'https://server11.mp3quran.net/yasser' },
  {
    id: 'salamah',
    name: 'reciter_salamah',
    source: 'mp3quran',
    server: 'https://server12.mp3quran.net/salamah/Rewayat-Hafs-A-n-Assem',
  },
  { id: 'qtm', name: 'reciter_qatami', source: 'mp3quran', server: 'https://server6.mp3quran.net/qtm' },
  { id: 'mtrod', name: 'reciter_matroud', source: 'mp3quran', server: 'https://server8.mp3quran.net/mtrod' },
  { id: 'qasm', name: 'reciter_qasim', source: 'mp3quran', server: 'https://server8.mp3quran.net/qasm' },
  { id: 'sds', name: 'reciter_sudais_mp3', source: 'mp3quran', server: 'https://server11.mp3quran.net/sds' },
  { id: 'maher', name: 'reciter_muaiqly', source: 'mp3quran', server: 'https://server12.mp3quran.net/maher' },
  { id: 'jbrl', name: 'reciter_jibreel', source: 'mp3quran', server: 'https://server8.mp3quran.net/jbrl' },
  { id: 'minsh', name: 'reciter_minshawi_mp3', source: 'mp3quran', server: 'https://server10.mp3quran.net/minsh' },
  { id: 'shaatree', name: 'reciter_shaatree_mp3', source: 'mp3quran', server: 'https://server11.mp3quran.net/shatri' },
  { id: 'tnjy', name: 'reciter_taniji', source: 'mp3quran', server: 'https://server12.mp3quran.net/tnjy' },
];

/** Map of mp3quran reciter IDs → quran.com chapter_recitation IDs for real ayah timestamps. */
export const TIMING_API_IDS: Record<string, number> = {
  s_gmd: 13,
  shur: 10,
  s_bud: 43,
  bu_khtr: 18,
  a_jbr: 24,
  frs_a: 14,
  yasser: 20,
  qasm: 11,
  sds: 3,
  maher: 52,
  jbrl: 28,
  minsh: 7,
  shaatree: 4,
  tnjy: 161,
};

/** Get the localized display name for a reciter.
 *  The `name` field on Reciter stores an i18n key; this function resolves it. */
export function getReciterDisplayName(reciter: Reciter): string {
  return __(reciter.name);
}

/** Get a reciter object by its ID. */
export function getReciterById(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) || RECITERS[0];
}

/** Pad a surah number to 3 digits (e.g. 1 → "001"). */
export function padSurah(num: number): string {
  return String(num).padStart(3, '0');
}

/** Check if a reciter has real timing data available via the quran.com API. */
export function hasTimingApi(reciterId: string): boolean {
  return reciterId in TIMING_API_IDS;
}

/** Get the quran.com chapter_recitation ID for a given reciter. */
export function getTimingApiId(reciterId: string): number | null {
  return TIMING_API_IDS[reciterId] || null;
}

/** Build the audio URL for a reciter and surah number. */
export function buildAudioUrl(reciter: Reciter, surahNum: number): string | null {
  if (reciter.source === 'mp3quran') {
    return `${reciter.server}/${padSurah(surahNum)}.mp3`;
  }
  return null;
}
