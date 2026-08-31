#!/usr/bin/env node
/**
 * Regenerate public/data/prayer-times-1448.json from the OFFICIAL Umm Al-Qura
 * (KACST) API used by ummulqura.org.sa — guaranteeing a 100% match with the
 * published Saudi prayer-times calendar.
 *
 * Endpoint: https://umqserv.kacst.gov.sa/api/v1/Prayer/GetPrayerHijriMonth
 *   ?lang=en&format=24&yh=1448&mh=<1..12>&lat=<city>&lon=<city>&zone=3
 *
 * This replaces the previous Aladhan/stat-based generators so the bundled
 * offline table is byte-for-byte consistent with the official site.
 */

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

// Official KACST coordinates for each supported city (from the site's own API calls).
const CITIES = [
  { ar: 'مكة المكرمة', en: 'Makkah', country: 'SA', lat: 21.426666, lon: 39.831666 },
  { ar: 'المدينة المنورة', en: 'Madinah', country: 'SA', lat: 24.524722, lon: 39.569722 },
  { ar: 'الرياض', en: 'Riyadh', country: 'SA', lat: 24.713333, lon: 46.675278 },
  { ar: 'جدة', en: 'Jeddah', country: 'SA', lat: 21.543333, lon: 39.172778 },
  { ar: 'الدمام', en: 'Dammam', country: 'SA', lat: 26.433333, lon: 50.083333 },
  { ar: 'أبها', en: 'Abha', country: 'SA', lat: 18.216667, lon: 42.505278 },
  { ar: 'تبوك', en: 'Tabuk', country: 'SA', lat: 28.383333, lon: 36.566667 },
  { ar: 'بريدة', en: 'Buraydah', country: 'SA', lat: 26.326389, lon: 43.975 },
  { ar: 'حائل', en: 'Hail', country: 'SA', lat: 27.511667, lon: 41.720833 },
  { ar: 'الطائف', en: 'Taif', country: 'SA', lat: 21.285833, lon: 40.418333 },
];

const HIJRI_YEAR = 1448;
const ZONE = 3; // Arabia Standard Time (UTC+3)

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchUrl(res.headers.location));
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject)
      .on('timeout', () => reject(new Error('timeout')));
  });
}

const pad2 = (n) => String(n).padStart(2, '0');
const gregISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hijriISO = (h) => `${h.year}-${pad2(h.month)}-${pad2(h.day)}`;

async function main() {
  console.log('🕌 Fetching official Umm Al-Qura (KACST) prayer times for 1448H...\n');
  const cities = {};

  for (const c of CITIES) {
    const days = [];
    for (let mh = 1; mh <= 12; mh++) {
      const url = `https://umqserv.kacst.gov.sa/api/v1/Prayer/GetPrayerHijriMonth?lang=en&format=24&yh=${HIJRI_YEAR}&mh=${mh}&lat=${c.lat}&lon=${c.lon}&zone=${ZONE}`;
      const raw = await fetchUrl(url);
      const month = JSON.parse(raw);
      for (const day of month) {
        const p = day.prayerTimes;
        days.push({
          date: gregISO(new Date(day.date)),
          hijri: hijriISO(day.hijriDate),
          Fajr: p.fajr,
          Sunrise: p.sunrise,
          Dhuhr: p.dhuhr,
          Asr: p.asr,
          Maghrib: p.maghrib,
          Isha: p.isha,
        });
      }
    }
    cities[c.ar] = {
      city_en: c.en,
      country: c.country,
      latitude: c.lat,
      longitude: c.lon,
      days,
    };
    console.log(`✅ ${c.ar}: ${days.length} days`);
  }

  const out = {
    hijri_year: HIJRI_YEAR,
    calendar: 'Umm Al-Qura',
    method: 4,
    source: 'official KACST umqserv API (ummulqura.org.sa)',
    cities,
  };

  const JSON_FILE = path.join(process.cwd(), 'public/data/prayer-times-1448.json');
  fs.writeFileSync(JSON_FILE, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`\n✅ Wrote ${JSON_FILE} (${Object.keys(cities).length} cities)`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
