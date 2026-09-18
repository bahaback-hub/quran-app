/**
 * Quran Data Integrity Verifier.
 *
 * Validates the bundled Quran datasets against canonical invariants and
 * cross-references them with each other:
 *
 *   - public/data/quran-uthmani.json  — full Quran text (114 surahs / 6236 ayahs)
 *   - public/data/surah-list.json     — 114 surah metadata with numberOfAyahs
 *   - public/data/muyassar-tafsir.json — Muyassar tafsir for every ayah
 *   - public/data/surah-1.json        — bundled first-surah payload
 *
 * Usage:
 *   node scripts/verify-quran-data.mjs            # verify invariants + manifest
 *   node scripts/verify-quran-data.mjs --generate # (re)write integrity-manifest.json
 *
 * Exits with code 1 and prints "Quran data integrity mismatch" on any failure.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const dataDir = resolve(projectRoot, 'public/data');

/** Canonical facts about the Quran dataset. */
const SURAH_COUNT = 114;
const TOTAL_AYAHS = 6236;
const PAGE_COUNT = 604;
const JUZ_COUNT = 30;

const MANIFEST_FILE = 'integrity-manifest.json';
const SOURCE_FILES = ['quran-uthmani.json', 'surah-list.json', 'muyassar-tafsir.json', 'surah-1.json'];

const GENERATE = process.argv.includes('--generate');
const problems = [];

/** Track a failed check alongside the file it relates to. */
function check(condition, message, file) {
  if (!condition) {
    problems.push(`${file ?? 'integrity'}: ${message}`);
  }
}

function fail(message) {
  problems.push(`integrity: ${message}`);
}

/** Compute the SHA-256 digest of the given file as a lower-case hex string. */
async function sha256File(filePath) {
  const bytes = await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

/** Strip a leading BOM and normalize whitespace for text comparisons. */
function cleanText(text) {
  return String(text || '').replace(/^\uFEFF/, '').replace(/[\u200e\u200f]/g, '');
}

async function loadJson(relativePath) {
  return JSON.parse(await readFile(resolve(dataDir, relativePath), 'utf8'));
}

async function verifySurahList() {
  const list = await loadJson('surah-list.json');
  check(Array.isArray(list) && list.length === SURAH_COUNT, `expected ${SURAH_COUNT} surah entries`, 'surah-list.json');
  if (!Array.isArray(list)) {
    return;
  }

  const seen = new Set();
  let totalAyahs = 0;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    check(entry && entry.number === i + 1, `entry ${i + 1} has number ${entry?.number}`, 'surah-list.json');
    check(Number.isInteger(entry?.numberOfAyahs) && entry.numberOfAyahs > 0, `surah ${i + 1} has invalid numberOfAyahs`, 'surah-list.json');
    check(typeof entry?.name === 'string' && entry.name.length > 0, `surah ${i + 1} has empty name`, 'surah-list.json');
    if (!seen.has(entry?.number)) {
      seen.add(entry.number);
    } else {
      check(false, `duplicate surah number ${entry?.number}`, 'surah-list.json');
    }
    totalAyahs += entry?.numberOfAyahs ?? 0;
  }
  check(totalAyahs === TOTAL_AYAHS, `sum of numberOfAyahs is ${totalAyahs}, expected ${TOTAL_AYAHS}`, 'surah-list.json');
  return list;
}

async function verifyQuranText(surahList) {
  const quran = await loadJson('quran-uthmani.json');
  const surahs = quran?.data?.surahs;
  check(Array.isArray(surahs) && surahs.length === SURAH_COUNT, `expected ${SURAH_COUNT} surahs`, 'quran-uthmani.json');
  if (!Array.isArray(surahs)) {
    return;
  }

  const seenAyahKeys = new Set();
  let globalNumber = 1;
  let totalAyahs = 0;
  const pages = new Set();
  const juzs = new Set();

  for (let i = 0; i < surahs.length; i++) {
    const surah = surahs[i];
    const surahNum = i + 1;
    check(surah && surah.number === surahNum, `surah index ${i} has number ${surah?.number}`, 'quran-uthmani.json');
    check(Array.isArray(surah?.ayahs) && surah.ayahs.length > 0, `surah ${surahNum} has empty/invalid ayahs`, 'quran-uthmani.json');
    if (!Array.isArray(surah?.ayahs)) {
      continue;
    }

    if (surahList) {
      const listed = surahList[surahNum - 1];
      check(
        listed?.numberOfAyahs === surah.ayahs.length,
        `surah ${surahNum} ayah count ${surah.ayahs.length} != list ${listed?.numberOfAyahs}`,
        'quran-uthmani.json',
      );
    }

    for (let j = 0; j < surah.ayahs.length; j++) {
      const ayah = surah.ayahs[j];
      const ayahNum = j + 1;
      const key = `${surahNum}:${ayahNum}`;

      check(ayah && ayah.number === globalNumber, `ayah ${key} has global number ${ayah?.number}, expected ${globalNumber}`, 'quran-uthmani.json');
      check(ayah && ayah.numberInSurah === ayahNum, `ayah ${key} has numberInSurah ${ayah?.numberInSurah}`, 'quran-uthmani.json');
      check(Number.isInteger(ayah?.juz) && ayah.juz >= 1 && ayah.juz <= JUZ_COUNT, `ayah ${key} has invalid juz ${ayah?.juz}`, 'quran-uthmani.json');
      check(Number.isInteger(ayah?.page) && ayah.page >= 1 && ayah.page <= PAGE_COUNT, `ayah ${key} has invalid page ${ayah?.page}`, 'quran-uthmani.json');
      check(cleanText(ayah?.text).length > 0, `ayah ${key} has empty text`, 'quran-uthmani.json');
      check(!seenAyahKeys.has(key), `duplicate ayah key ${key}`, 'quran-uthmani.json');
      seenAyahKeys.add(key);
      if (Number.isInteger(ayah?.page)) {
        pages.add(ayah.page);
      }
      if (Number.isInteger(ayah?.juz)) {
        juzs.add(ayah.juz);
      }
      globalNumber++;
      totalAyahs++;
    }
  }

  check(totalAyahs === TOTAL_AYAHS, `total ayahs is ${totalAyahs}, expected ${TOTAL_AYAHS}`, 'quran-uthmani.json');
  check(globalNumber - 1 === TOTAL_AYAHS, 'global ayah numbering is not continuous', 'quran-uthmani.json');
  check(pages.size === PAGE_COUNT, `covers ${pages.size} distinct pages, expected ${PAGE_COUNT}`, 'quran-uthmani.json');
  check(juzs.size === JUZ_COUNT, `covers ${juzs.size} distinct juz, expected ${JUZ_COUNT}`, 'quran-uthmani.json');

  return { surahs, seenAyahKeys };
}

async function verifyTafsir(surahList, seenAyahKeys) {
  const tafsir = await loadJson('muyassar-tafsir.json');
  check(tafsir && typeof tafsir === 'object', 'file must be an object keyed by surah number', 'muyassar-tafsir.json');
  if (!tafsir || typeof tafsir !== 'object') {
    return;
  }

  const keys = Object.keys(tafsir);
  check(keys.length === SURAH_COUNT, `has ${keys.length} surah keys, expected ${SURAH_COUNT}`, 'muyassar-tafsir.json');

  let covered = 0;
  for (let surahNum = 1; surahNum <= SURAH_COUNT; surahNum++) {
    const entry = tafsir[String(surahNum)];
    const ayahs = Array.isArray(entry) ? entry : entry?.ayahs;
    check(Array.isArray(ayahs), `surah ${surahNum} has invalid tafsir container`, 'muyassar-tafsir.json');
    if (!Array.isArray(ayahs)) {
      continue;
    }

    const expectedCount = surahList?.[surahNum - 1]?.numberOfAyahs;
    check(ayahs.length === expectedCount, `surah ${surahNum} tafsir count ${ayahs.length} != expected ${expectedCount}`, 'muyassar-tafsir.json');

    const seenAt = new Set();
    for (const row of ayahs) {
      check(row && Number.isInteger(row.ayah) && row.ayah >= 1 && row.ayah <= (expectedCount ?? SURAH_COUNT), `surah ${surahNum} tafsir has invalid ayah ${row?.ayah}`, 'muyassar-tafsir.json');
      check(cleanText(row?.text).length > 0, `surah ${surahNum} tafsir ayah ${row?.ayah} has empty text`, 'muyassar-tafsir.json');
      check(!seenAt.has(row?.ayah), `surah ${surahNum} tafsir duplicates ayah ${row?.ayah}`, 'muyassar-tafsir.json');
      seenAt.add(row?.ayah);
      const key = `${surahNum}:${row?.ayah}`;
      check(seenAyahKeys?.has(key), `tafsir entry ${key} not present in quran-uthmani.json`, 'muyassar-tafsir.json');
      covered++;
    }
  }

  check(covered === TOTAL_AYAHS, `tafsir covers ${covered} ayahs, expected ${TOTAL_AYAHS}`, 'muyassar-tafsir.json');
}

async function verifyFirstSurahPayload(quranSurahs) {
  const payload = await loadJson('surah-1.json');
  const data = payload?.data;
  check(data && data.number === 1, 'payload must describe surah 1', 'surah-1.json');
  if (!data) {
    return;
  }

  const expected = quranSurahs?.find((s) => s.number === 1);
  check(Array.isArray(data.ayahs) && expected, 'payload or reference ayahs missing', 'surah-1.json');
  if (!expected) {
    return;
  }

  check(data.ayahs.length === expected.ayahs.length, `payload ayah count ${data.ayahs.length} != reference ${expected.ayahs.length}`, 'surah-1.json');
  for (let i = 0; i < Math.min(data.ayahs.length, expected.ayahs.length); i++) {
    const p = data.ayahs[i];
    const r = expected.ayahs[i];
    check(p.number === r.number && p.numberInSurah === r.numberInSurah && p.juz === r.juz && p.page === r.page, `ayah ${i + 1} metadata mismatch`, 'surah-1.json');
    check(cleanText(p.text) === cleanText(r.text), `ayah ${i + 1} text mismatch`, 'surah-1.json');
  }
}

async function verifyManifest() {
  const manifestPath = resolve(dataDir, MANIFEST_FILE);
  const entries = {};
  for (const file of SOURCE_FILES) {
    entries[file] = { sha256: await sha256File(resolve(dataDir, file)) };
  }

  if (GENERATE) {
    const manifest = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      description: 'SHA-256 digests of bundled Quran datasets enforced at build/verify time.',
      files: entries,
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`[verify-quran-data] wrote ${MANIFEST_FILE}`);
    return;
  }

  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const file of SOURCE_FILES) {
      const expected = manifest?.files?.[file]?.sha256;
      check(typeof expected === 'string' && expected.length === 64, `manifest has no sha256 for ${file}`, 'integrity-manifest.json');
      check(expected === entries[file].sha256, `sha256 mismatch for ${file}`, 'integrity-manifest.json');
    }
  } catch {
    check(false, `manifest ${MANIFEST_FILE} missing — run with --generate first`, 'integrity-manifest.json');
  }
}

async function main() {
  const surahList = await verifySurahList();
  const { surahs, seenAyahKeys } = await verifyQuranText(surahList);
  await verifyTafsir(surahList, seenAyahKeys);
  await verifyFirstSurahPayload(surahs);
  await verifyManifest();

  if (problems.length > 0) {
    console.error('🚨 Quran data integrity mismatch');
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }

  console.log('✅ Quran data integrity verified: 114 surahs, 6236 ayahs, 604 pages, 30 juz, full tafsir coverage.');
}

main().catch((error) => {
  console.error('🚨 Quran data integrity mismatch:', error);
  process.exit(1);
});