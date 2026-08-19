/**
 * Network Mock Fixture for Playwright E2E Tests.
 *
 * Intercepts ALL external API calls and returns mock data instead of
 * hitting real network endpoints. This makes E2E tests:
 *   - Deterministic (same results every run)
 *   - Fast (no network latency)
 *   - Reliable (no flaky failures from API downtime)
 *   - CI-friendly (no external dependencies)
 *
 * Usage in test files:
 *   import { test, expect } from './fixtures/mock-network';
 *   // test now has all network calls mocked automatically
 *
 * Local data files (/data/*.json) are NOT mocked — they're served by
 * the preview server and work reliably.
 */

import { test as base, expect } from '@playwright/test';

/* ===================== MOCK DATA ===================== */

/** Mock surah 1 (Al-Fatiha) response from AlQuran.cloud */
const mockSurah1 = {
  code: 200,
  status: 'OK',
  data: {
    number: 1,
    name: 'الفاتحة',
    englishName: 'Al-Fatiha',
    englishNameTranslation: 'The Opening',
    revelationType: 'Meccan',
    numberOfAyahs: 7,
    ayahs: [
      { number: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', numberInSurah: 1, audio: 'https://cdn.islamic.network/quran/1/1.mp3' },
      { number: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', numberInSurah: 2, audio: 'https://cdn.islamic.network/quran/1/2.mp3' },
      { number: 3, text: 'الرَّحْمَٰنِ الرَّحِيمِ', numberInSurah: 3, audio: 'https://cdn.islamic.network/quran/1/3.mp3' },
      { number: 4, text: 'مَالِكِ يَوْمِ الدِّينِ', numberInSurah: 4, audio: 'https://cdn.islamic.network/quran/1/4.mp3' },
      { number: 5, text: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', numberInSurah: 5, audio: 'https://cdn.islamic.network/quran/1/5.mp3' },
      { number: 6, text: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', numberInSurah: 6, audio: 'https://cdn.islamic.network/quran/1/6.mp3' },
      { number: 7, text: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', numberInSurah: 7, audio: 'https://cdn.islamic.network/quran/1/7.mp3' },
    ],
  },
};

/** Mock surah 2 (Al-Baqarah) — simplified with 3 ayahs for testing */
const mockSurah2 = {
  code: 200,
  status: 'OK',
  data: {
    number: 2,
    name: 'البقرة',
    englishName: 'Al-Baqarah',
    englishNameTranslation: 'The Cow',
    revelationType: 'Medinan',
    numberOfAyahs: 286,
    ayahs: [
      { number: 8, text: 'الٓمٓ', numberInSurah: 1, audio: 'https://cdn.islamic.network/quran/2/1.mp3' },
      { number: 9, text: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِلْمُتَّقِينَ', numberInSurah: 2, audio: 'https://cdn.islamic.network/quran/2/2.mp3' },
      { number: 10, text: 'الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنْفِقُونَ', numberInSurah: 3, audio: 'https://cdn.islamic.network/quran/2/3.mp3' },
    ],
  },
};

/** Mock surah 36 (Ya-Sin) — simplified with 3 ayahs */
const mockSurah36 = {
  code: 200,
  status: 'OK',
  data: {
    number: 36,
    name: 'يس',
    englishName: 'Ya-Sin',
    englishNameTranslation: 'Ya Sin',
    revelationType: 'Meccan',
    numberOfAyahs: 83,
    ayahs: [
      { number: 5829, text: 'يسٓ', numberInSurah: 1, audio: 'https://cdn.islamic.network/quran/36/1.mp3' },
      { number: 5830, text: 'وَالْقُرْآنِ الْحَكِيمِ', numberInSurah: 2, audio: 'https://cdn.islamic.network/quran/36/2.mp3' },
      { number: 5831, text: 'إِنَّكَ لَمِنَ الْمُرْسَلِينَ', numberInSurah: 3, audio: 'https://cdn.islamic.network/quran/36/3.mp3' },
    ],
  },
};

/** Mock prayer times response from Aladhan API */
const mockPrayerTimes = {
  code: 200,
  status: 'OK',
  data: {
    timings: {
      Fajr: '05:00',
      Sunrise: '06:30',
      Dhuhr: '12:00',
      Asr: '15:30',
      Sunset: '18:00',
      Maghrib: '18:00',
      Isha: '19:30',
      Imsak: '04:50',
      Midnight: '00:30',
    },
    date: {
      readable: '15 Aug 2026',
      timestamp: Date.now(),
      hijri: {
        date: '15-08-1447',
        day: '15',
        month: { en: 'Safar', ar: 'صفر' },
        year: '1447',
      },
    },
    meta: {
      latitude: 24.7136,
      longitude: 46.6753,
      timezone: 'Asia/Riyadh',
    },
  },
};

/** Mock translation response */
const mockTranslation = {
  code: 200,
  status: 'OK',
  data: {
    surahs: [{
      number: 1,
      ayahs: [
        { numberInSurah: 1, text: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.' },
        { numberInSurah: 2, text: 'All praise is due to Allah, Lord of the worlds.' },
        { numberInSurah: 3, text: 'The Entirely Merciful, the Especially Merciful.' },
        { numberInSurah: 4, text: 'Sovereign of the Day of Recompense.' },
        { numberInSurah: 5, text: 'It is You we worship and You we ask for help.' },
        { numberInSurah: 6, text: 'Guide us to the straight path.' },
        { numberInSurah: 7, text: 'The path of those upon whom You have bestowed favor, not of those who have evoked anger or of those who are astray.' },
      ],
    }],
  },
};

/** Mock tafsir response */
const mockTafsir = {
  code: 200,
  status: 'OK',
  data: {
    text: 'هذا تفسير الآية الأولى من سورة الفاتحة. بسم الله الرحمن الرحيم هي أول آية في القرآن الكريم.',
  },
};

/* ===================== MOCK ROUTES ===================== */

/** Mock surah 114 (An-Nas) */
const mockSurah114 = {
  code: 200,
  status: 'OK',
  data: {
    number: 114,
    name: 'الناس',
    englishName: 'An-Nas',
    englishNameTranslation: 'Mankind',
    revelationType: 'Meccan',
    numberOfAyahs: 6,
    ayahs: [
      { number: 6326, text: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ', numberInSurah: 1, audio: 'https://cdn.islamic.network/quran/114/1.mp3' },
      { number: 6327, text: 'مَلِكِ النَّاسِ', numberInSurah: 2, audio: 'https://cdn.islamic.network/quran/114/2.mp3' },
      { number: 6328, text: 'إِلَٰهِ النَّاسِ', numberInSurah: 3, audio: 'https://cdn.islamic.network/quran/114/3.mp3' },
      { number: 6329, text: 'مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ', numberInSurah: 4, audio: 'https://cdn.islamic.network/quran/114/4.mp3' },
      { number: 6330, text: 'الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ', numberInSurah: 5, audio: 'https://cdn.islamic.network/quran/114/5.mp3' },
      { number: 6331, text: 'مِنَ الْجِنَّةِ وَالنَّاسِ', numberInSurah: 6, audio: 'https://cdn.islamic.network/quran/114/6.mp3' },
    ],
  },
};

/** Map surah numbers to their mock data */
const surahMocks: Record<string, typeof mockSurah1> = {
  '1': mockSurah1,
  '2': mockSurah2,
  '36': mockSurah36,
  '114': mockSurah114,
};

/** Setup all network mocks on a Playwright page */
export async function setupNetworkMocks(page: import('@playwright/test').Page): Promise<void> {
  // Mock AlQuran.cloud API — surah text + editions
  await page.route('https://api.alquran.cloud/v1/surah/*', (route) => {
    const url = route.request().url();
    const match = url.match(/\/surah\/(\d+)/);
    const surahNum = match ? match[1] : '1';
    const surahMock = surahMocks[surahNum] || mockSurah1;

    // If URL includes /editions/ — return translation data
    if (url.includes('/editions/') || url.includes('en.sahih') || url.includes('fr.') || url.includes('ur.')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTranslation),
      });
      return;
    }

    // If URL includes a reciter ID (e.g. ar.alafasy) — return surah with audio
    if (url.match(/\/surah\/\d+\/ar\./) || url.match(/\/surah\/\d+\/[a-z]+\.[a-z]+/)) {
      // Return surah data with audio URLs
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(surahMock),
      });
      return;
    }

    // Default: return surah text (quran-uthmani)
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(surahMock),
    });
  });

  // Mock AlQuran.cloud API — translations
  await page.route('https://api.alquran.cloud/v1/surah/*/editions/*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTranslation),
    });
  });

  // Mock AlQuran.cloud API — full Quran text
  await page.route('https://api.alquran.cloud/v1/quran/*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, status: 'OK', data: { surahs: [mockSurah1.data, mockSurah2.data, mockSurah36.data] } }),
    });
  });

  // Mock Aladhan API — prayer times
  await page.route('https://api.aladhan.com/v1/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPrayerTimes),
    });
  });

  // Mock mp3quran.net audio — return empty audio buffer (no actual MP3)
  await page.route('https://server*.mp3quran.net/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: Buffer.alloc(0),
    });
  });

  // Mock cdn.islamic.network audio
  await page.route('https://cdn.islamic.network/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: Buffer.alloc(0),
    });
  });

  // Mock Tafsir API (jsDelivr CDN)
  await page.route('https://cdn.jsdelivr.net/gh/spa5k/tafsir_api/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTafsir),
    });
  });

  // Mock QCF4 mushaf fonts (jsDelivr CDN)
  await page.route('https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4*/**', (route) => {
    // Return empty font file — mushaf canvas won't render text but won't error
    route.fulfill({
      status: 200,
      contentType: 'font/woff2',
      body: Buffer.alloc(0),
    });
  });

  // Mock raw.githubusercontent.com for mushaf page data
  await page.route('https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ lines: [] }),
    });
  });
}

/* ===================== TEST FIXTURE ===================== */

/** Extended test fixture with automatic network mocking */
export const test = base.extend<{
  mockedPage: import('@playwright/test').Page;
}>({
  page: async ({ page }, use) => {
    // Setup all network mocks before each test
    await setupNetworkMocks(page);
    await use(page);
  },
});

export { expect };
