export const RECITERS = [
  // ——— API sources (AlQuran.cloud) ———
  { id: 'ar.alafasy',              name: 'مشاري العفاسي',             source: 'api' },
  { id: 'ar.abdulbasitmurattal',   name: 'عبد الباسط (مرتل)',         source: 'api' },
  { id: 'ar.abdulsamad',           name: 'عبد الباسط (مجود)',          source: 'api' },
  { id: 'ar.abdurrahmaansudais',   name: 'عبد الرحمن السديس',          source: 'api' },
  { id: 'ar.husary',               name: 'محمود خليل الحصري',          source: 'api' },
  { id: 'ar.minshawi',             name: 'المنشاوي (مرتل)',            source: 'api' },
  { id: 'ar.minshawimujawwad',     name: 'المنشاوي (مجود)',           source: 'api' },
  { id: 'ar.muhammadayyoub',       name: 'محمد أيوب',                 source: 'api' },
  { id: 'ar.shaatree',             name: 'أبو بكر الشاطري',            source: 'api' },
  { id: 'ar.abdullahbasfar',       name: 'عبد الله باسفر',            source: 'api' },
  { id: 'ar.ahmedajamy',           name: 'أحمد العجمي',               source: 'api' },

  // ——— mp3quran.net sources (full surah audio) ———
  { id: 's_gmd',    name: 'سعد الغامدي',               source: 'mp3quran', server: 'https://server7.mp3quran.net/s_gmd' },
  { id: 'shur',     name: 'سعود الشريم',               source: 'mp3quran', server: 'https://server7.mp3quran.net/shur' },
  { id: 's_bud',    name: 'صلاح البدير',               source: 'mp3quran', server: 'https://server6.mp3quran.net/s_bud' },
  { id: 'bu_khtr',  name: 'صلاح بو خاطر',              source: 'mp3quran', server: 'https://server8.mp3quran.net/bu_khtr' },
  { id: 'hthfi',    name: 'علي الحذيفي',               source: 'mp3quran', server: 'https://server9.mp3quran.net/hthfi' },
  { id: 'a_jbr',    name: 'علي جابر',                  source: 'mp3quran', server: 'https://server11.mp3quran.net/a_jbr' },
  { id: 'frs_a',    name: 'فارس عباد',                 source: 'mp3quran', server: 'https://server8.mp3quran.net/frs_a' },
  { id: 'yasser',   name: 'ياسر الدوسري',               source: 'mp3quran', server: 'https://server11.mp3quran.net/yasser' },
  { id: 'salamah',  name: 'ياسر سلامة',                source: 'mp3quran', server: 'https://server12.mp3quran.net/salamah/Rewayat-Hafs-A-n-Assem' },
  { id: 'qtm',      name: 'ناصر القطامي',               source: 'mp3quran', server: 'https://server6.mp3quran.net/qtm' },
  { id: 'mtrod',    name: 'عبد الله المطرود',           source: 'mp3quran', server: 'https://server8.mp3quran.net/mtrod' },
  { id: 'qasm',     name: 'عبد المحسن القاسم',           source: 'mp3quran', server: 'https://server8.mp3quran.net/qasm' },
  { id: 'sds',      name: 'عبد الرحمن السديس (mp3)',     source: 'mp3quran', server: 'https://server11.mp3quran.net/sds' },
  { id: 'maher',    name: 'ماهر المعيقلي',              source: 'mp3quran', server: 'https://server12.mp3quran.net/maher' },
  { id: 'jbrl',     name: 'محمد جبريل',                 source: 'mp3quran', server: 'https://server8.mp3quran.net/jbrl' },
  { id: 'minsh',    name: 'محمد صديق المنشاوي (mp3)',    source: 'mp3quran', server: 'https://server10.mp3quran.net/minsh' },
  { id: 'shaatree',name: 'أبو بكر الشاطري (mp3)',       source: 'mp3quran', server: 'https://server11.mp3quran.net/shatri' },
  { id: 'tnjy',     name: 'خليفة الطنيجي',              source: 'mp3quran', server: 'https://server12.mp3quran.net/tnjy' },
];

export function getReciterById(id) {
  return RECITERS.find(r => r.id === id) || RECITERS[0];
}

export function padSurah(num) {
  return String(num).padStart(3, '0');
}

export function buildAudioUrl(reciter, surahNum) {
  if (reciter.source === 'mp3quran') {
    return `${reciter.server}/${padSurah(surahNum)}.mp3`;
  }
  return null;
}
