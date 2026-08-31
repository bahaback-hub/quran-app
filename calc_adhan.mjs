import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';

const date = new Date(2026, 7, 26); // Aug 26, 2026
const coords = new Coordinates(21.3891, 39.8579); // Makkah
const params = CalculationMethod.UmmAlQura();
const pt = new PrayerTimes(coords, date, params);

const fmt = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
console.log('Makkah via adhan UmmAlQura (Aug 26 2026):');
console.log('  Fajr   ', fmt(pt.fajr));
console.log('  Sunrise', fmt(pt.sunrise));
console.log('  Dhuhr  ', fmt(pt.dhuhr));
console.log('  Asr     ', fmt(pt.asr));
console.log('  Maghrib', fmt(pt.maghrib));
console.log('  Isha   ', fmt(pt.isha));
console.log('');
console.log('Official ummulqura.org.sa same day:');
console.log('  Fajr 04:45 | Sunrise 06:02 | Dhuhr 12:23 | Asr 15:47 | Maghrib 18:43 | Isha 20:13');
