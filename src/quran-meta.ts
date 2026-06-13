/**
 * Quran metadata: sajda ayahs and juz (para) boundaries.
 *
 * All data follows the standard Hafs / Madinah Mushaf convention.
 */

/* ======================================================================== */
/*  SAJDA AYAHS                                                             */
/* ======================================================================== */

/**
 * Map of all 15 sajda ayahs in the Quran.
 * Key format: `"surah:ayahInSurah"`
 * Value: `"obligatory"` or `"recommended"`
 *
 * Note: There are 14 distinct sajda locations, but Surah Al-Hajj (22)
 * contains two sajda ayahs — 22:18 (obligatory) and 22:77 (recommended) —
 * bringing the total count to 15 sajda markers in the mushaf.
 */
export const SAJDA_AYAHS: Record<string, 'obligatory' | 'recommended'> = {
  '7:206': 'obligatory', // Surah Al-A'raf
  '13:15': 'obligatory', // Surah Ar-Ra'd
  '16:50': 'obligatory', // Surah An-Nahl
  '17:109': 'obligatory', // Surah Al-Isra
  '19:58': 'obligatory', // Surah Maryam
  '22:18': 'obligatory', // Surah Al-Hajj (first sajda)
  '22:77': 'recommended', // Surah Al-Hajj (second sajda)
  '25:60': 'obligatory', // Surah Al-Furqan
  '27:26': 'obligatory', // Surah An-Naml
  '32:15': 'obligatory', // Surah As-Sajdah
  '38:24': 'recommended', // Surah Sad
  '41:38': 'obligatory', // Surah Fussilat
  '53:62': 'obligatory', // Surah An-Najm
  '84:21': 'recommended', // Surah Al-Inshiqaq
  '96:19': 'obligatory', // Surah Al-Alaq
};

/* ======================================================================== */
/*  JUZ STARTS                                                              */
/* ======================================================================== */

/**
 * Starting surah and ayah for each of the 30 juz (para) of the Quran.
 * Based on the standard Madinah Mushaf (Hafs).
 */
export const JUZ_STARTS: { juz: number; surah: number; ayah: number }[] = [
  { juz: 1, surah: 1, ayah: 1 }, // Al-Fatihah
  { juz: 2, surah: 2, ayah: 142 }, // Al-Baqarah
  { juz: 3, surah: 2, ayah: 253 }, // Al-Baqarah
  { juz: 4, surah: 3, ayah: 93 }, // Al-Imran
  { juz: 5, surah: 4, ayah: 24 }, // An-Nisa
  { juz: 6, surah: 4, ayah: 148 }, // An-Nisa
  { juz: 7, surah: 5, ayah: 82 }, // Al-Ma'idah
  { juz: 8, surah: 6, ayah: 111 }, // Al-An'am
  { juz: 9, surah: 7, ayah: 47 }, // Al-A'raf
  { juz: 10, surah: 8, ayah: 41 }, // Al-Anfal
  { juz: 11, surah: 9, ayah: 93 }, // At-Tawbah
  { juz: 12, surah: 11, ayah: 6 }, // Hud
  { juz: 13, surah: 12, ayah: 53 }, // Yusuf
  { juz: 14, surah: 15, ayah: 1 }, // Al-Hijr
  { juz: 15, surah: 17, ayah: 1 }, // Al-Isra
  { juz: 16, surah: 18, ayah: 75 }, // Al-Kahf
  { juz: 17, surah: 21, ayah: 1 }, // Al-Anbiya
  { juz: 18, surah: 23, ayah: 1 }, // Al-Mu'minun
  { juz: 19, surah: 25, ayah: 21 }, // Al-Furqan
  { juz: 20, surah: 27, ayah: 56 }, // An-Naml
  { juz: 21, surah: 29, ayah: 46 }, // Al-Ankabut
  { juz: 22, surah: 33, ayah: 31 }, // Al-Ahzab
  { juz: 23, surah: 36, ayah: 28 }, // Ya-Sin
  { juz: 24, surah: 39, ayah: 32 }, // Az-Zumar
  { juz: 25, surah: 41, ayah: 47 }, // Fussilat
  { juz: 26, surah: 46, ayah: 1 }, // Al-Ahqaf
  { juz: 27, surah: 51, ayah: 31 }, // Adh-Dhariyat
  { juz: 28, surah: 58, ayah: 1 }, // Al-Mujadila
  { juz: 29, surah: 67, ayah: 1 }, // Al-Mulk
  { juz: 30, surah: 78, ayah: 1 }, // An-Naba
];

/* ======================================================================== */
/*  HELPER FUNCTIONS                                                        */
/* ======================================================================== */

/** Check if a given surah:ayahInSurah is a sajda ayah */
export function isSajdaAyah(
  surah: number,
  ayahInSurah: number
): { isSajda: boolean; type: 'obligatory' | 'recommended' | '' } {
  const key = `${surah}:${ayahInSurah}`;
  const type = SAJDA_AYAHS[key];
  return { isSajda: !!type, type: type || '' };
}

/** Get the juz number (1-30) for a given surah and ayah within the surah */
export function getJuzForAyah(surah: number, ayahInSurah: number): number {
  for (let i = JUZ_STARTS.length - 1; i >= 0; i--) {
    const j = JUZ_STARTS[i];
    if (surah > j.surah || (surah === j.surah && ayahInSurah >= j.ayah)) {
      return j.juz;
    }
  }
  return 1;
}

/** Check if an ayah is the start of a new juz — returns juz number or null */
export function isJuzStart(surah: number, ayahInSurah: number): number | null {
  for (const j of JUZ_STARTS) {
    if (j.surah === surah && j.ayah === ayahInSurah) return j.juz;
  }
  return null;
}
