#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED — do NOT use to regenerate the published file.
 *
 * The official Umm Al-Qura (KACST) calendar is now sourced directly from the
 * KACST API that powers ummulqura.org.sa, guaranteeing a 100% match:
 *
 *   scripts/regenerate-prayer-times-official.mjs
 *
 * (It calls https://umqserv.kacst.gov.sa/api/v1/Prayer/GetPrayerHijriMonth.)
 *
 * This legacy Aladhan-based script is kept only as a fallback reference and
 * must not overwrite the official data.
 */

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const CITIES = [
  { slug: 'makkah', ar: 'مكة المكرمة', lat: 21.3891, lng: 39.8579 },
  { slug: 'madinah', ar: 'المدينة المنورة', lat: 24.5247, lng: 39.5692 },
  { slug: 'riyadh', ar: 'الرياض', lat: 24.7136, lng: 46.6753 },
  { slug: 'jeddah', ar: 'جدة', lat: 21.4858, lng: 39.1925 },
  { slug: 'dammam', ar: 'الدمام', lat: 26.4207, lng: 50.0888 },
  { slug: 'abha', ar: 'أبها', lat: 18.2164, lng: 42.5053 },
  { slug: 'tabuk', ar: 'تبوك', lat: 28.3835, lng: 36.5662 },
  { slug: 'buraydah', ar: 'بريدة', lat: 26.3260, lng: 43.9720 },
  { slug: 'hail', ar: 'حائل', lat: 27.5114, lng: 41.7208 },
  { slug: 'taif', ar: 'الطائف', lat: 21.2854, lng: 40.4183 },
];

const JSON_FILE = path.join(process.cwd(), 'public/data/prayer-times-1448.json');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  console.log('🕌 Syncing prayer times with Aladhan API (method=4, Umm Al-Qura)...\n');

  const json = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let updated = 0;

  for (const city of CITIES) {
    process.stdout.write(`📍 ${city.ar}... `);
    const url = `https://api.aladhan.com/v1/timings/${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}?latitude=${city.lat}&longitude=${city.lng}&method=4`;

    try {
      const raw = await fetchUrl(url);
      const data = JSON.parse(raw);
      if (data.code === 200 && data.data?.timings) {
        const t = data.data.timings;
        const clean = (v) => (v || '').split('(')[0].trim();

        const times = {
          Fajr: clean(t.Fajr),
          Sunrise: clean(t.Sunrise),
          Dhuhr: clean(t.Dhuhr),
          Asr: clean(t.Asr),
          Maghrib: clean(t.Maghrib),
          Isha: clean(t.Isha),
        };

        const cityData = json.cities[city.ar];
        if (cityData?.days) {
          const dayEntry = cityData.days.find((d) => d.date === todayStr);
          if (dayEntry) {
            Object.assign(dayEntry, times);
            updated++;
            console.log(`✅ ${times.Fajr} / ${times.Dhuhr} / ${times.Maghrib}`);
          } else {
            console.log(`⚠️  ${todayStr} not in JSON`);
          }
        } else {
          console.log(`⚠️  City not in JSON`);
        }
      } else {
        console.log(`❌ API error`);
      }
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }

  fs.writeFileSync(JSON_FILE, JSON.stringify(json, null, 2), 'utf-8');
  console.log(`\n✅ Updated ${updated} cities for ${todayStr}`);
}

main().catch(console.error);
