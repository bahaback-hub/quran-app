/** Represents a Quran reciter from either the AlQuran.cloud API or mp3quran.net. */
export interface Reciter {
  id: string;
  name: string;
  source: 'api' | 'mp3quran';
  server?: string;
}

/** List of available Quran reciters from multiple sources. */
export const RECITERS: Reciter[] = [
  // ——— API sources (AlQuran.cloud) ———
  { id: 'ar.alafasy', name: 'مشاري العفاسي', source: 'api' },
  { id: 'ar.abdulbasitmurattal', name: 'عبد الباسط (مرتل)', source: 'api' },
  { id: 'ar.abdulsamad', name: 'عبد الباسط (مجود)', source: 'api' },
  { id: 'ar.abdurrahmaansudais', name: 'عبد الرحمن السديس', source: 'api' },
  { id: 'ar.husary', name: 'محمود خليل الحصري', source: 'api' },
  { id: 'ar.minshawi', name: 'المنشاوي (مرتل)', source: 'api' },
  { id: 'ar.minshawimujawwad', name: 'المنشاوي (مجود)', source: 'api' },
  { id: 'ar.muhammadayyoub', name: 'محمد أيوب', source: 'api' },
  { id: 'ar.shaatree', name: 'أبو بكر الشاطري', source: 'api' },
  { id: 'ar.abdullahbasfar', name: 'عبد الله باسفر', source: 'api' },
  { id: 'ar.ahmedajamy', name: 'أحمد العجمي', source: 'api' },

  // ——— mp3quran.net sources (full surah audio) ———
  { id: 's_gmd', name: 'سعد الغامدي', source: 'mp3quran', server: 'https://server7.mp3quran.net/s_gmd' },
  { id: 'shur', name: 'سعود الشريم', source: 'mp3quran', server: 'https://server7.mp3quran.net/shur' },
  { id: 's_bud', name: 'صلاح البدير', source: 'mp3quran', server: 'https://server6.mp3quran.net/s_bud' },
  { id: 'bu_khtr', name: 'صلاح بو خاطر', source: 'mp3quran', server: 'https://server8.mp3quran.net/bu_khtr' },
  { id: 'hthfi', name: 'علي الحذيفي', source: 'mp3quran', server: 'https://server9.mp3quran.net/hthfi' },
  { id: 'a_jbr', name: 'علي جابر', source: 'mp3quran', server: 'https://server11.mp3quran.net/a_jbr' },
  { id: 'frs_a', name: 'فارس عباد', source: 'mp3quran', server: 'https://server8.mp3quran.net/frs_a' },
  { id: 'yasser', name: 'ياسر الدوسري', source: 'mp3quran', server: 'https://server11.mp3quran.net/yasser' },
  {
    id: 'salamah',
    name: 'ياسر سلامة',
    source: 'mp3quran',
    server: 'https://server12.mp3quran.net/salamah/Rewayat-Hafs-A-n-Assem',
  },
  { id: 'qtm', name: 'ناصر القطامي', source: 'mp3quran', server: 'https://server6.mp3quran.net/qtm' },
  { id: 'mtrod', name: 'عبد الله المطرود', source: 'mp3quran', server: 'https://server8.mp3quran.net/mtrod' },
  { id: 'qasm', name: 'عبد المحسن القاسم', source: 'mp3quran', server: 'https://server8.mp3quran.net/qasm' },
  { id: 'sds', name: 'عبد الرحمن السديس (mp3)', source: 'mp3quran', server: 'https://server11.mp3quran.net/sds' },
  { id: 'maher', name: 'ماهر المعيقلي', source: 'mp3quran', server: 'https://server12.mp3quran.net/maher' },
  { id: 'jbrl', name: 'محمد جبريل', source: 'mp3quran', server: 'https://server8.mp3quran.net/jbrl' },
  { id: 'minsh', name: 'محمد صديق المنشاوي (mp3)', source: 'mp3quran', server: 'https://server10.mp3quran.net/minsh' },
  { id: 'shaatree', name: 'أبو بكر الشاطري (mp3)', source: 'mp3quran', server: 'https://server11.mp3quran.net/shatri' },
  { id: 'tnjy', name: 'خليفة الطنيجي', source: 'mp3quran', server: 'https://server12.mp3quran.net/tnjy' },
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
