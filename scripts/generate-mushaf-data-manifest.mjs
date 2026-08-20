import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_REPOSITORY = 'https://github.com/MohamadHajjRabee/quran-qcf4';
const SOURCE_COMMIT = process.argv[2] || '5130511027e769f0a8f4eeb7f00f46bde3788d60';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'public', 'data', 'mushaf-pack', 'qcf4-hafs-layout-v1.manifest.json');
const BASE_URL = `https://raw.githubusercontent.com/MohamadHajjRabee/quran-qcf4/${SOURCE_COMMIT}`;
const DATA_FILES = [
  ...Array.from({ length: 604 }, (_, index) => `pages/${String(index + 1).padStart(3, '0')}.json`),
  'index.json',
  'verses.json',
  'font-map.json',
  'qbsml.json',
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

console.log(`Generating QCF4 data manifest from commit ${SOURCE_COMMIT}...`);
const files = await mapWithConcurrency(DATA_FILES, 8, async (file) => {
  const response = await fetch(`${BASE_URL}/${file}`);
  if (!response.ok) {
    throw new Error(`Could not fetch ${file}: HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return { path: file, bytes: bytes.byteLength, sha256: sha256(bytes) };
});

const manifest = {
  schemaVersion: 1,
  packId: 'qcf4-hafs-layout-v1',
  version: '1.0.0',
  title: 'بيانات تخطيط مصحف حفص QCF4',
  edition: {
    riwayah: 'حفص عن عاصم',
    pageCount: 604,
    fontsIncluded: false,
    note: 'تتضمن هذه الحزمة بيانات الصفحات والفهارس المرخّصة فقط. لا تتضمن خطوط QCF4.',
  },
  source: {
    repository: SOURCE_REPOSITORY,
    commit: SOURCE_COMMIT,
    rawBaseUrl: BASE_URL,
    dataLicense: 'MIT',
    dataLicenseUrl: `${BASE_URL}/LICENSE.md`,
    attribution: 'Copyright (c) 2026 Mohamad Hajj Rabee. Page data and schemas are licensed under MIT.',
    fontNotice:
      'QCF4 font files are excluded. The upstream license states that redistributing font files requires explicit permission from the original rights holders.',
  },
  files,
  fileCount: files.length,
  totalBytes: files.reduce((total, file) => total + file.bytes, 0),
};

await mkdir(path.dirname(OUTPUT), { recursive: true });
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(OUTPUT, serialized, 'utf8');
console.log(`Wrote ${OUTPUT}`);
console.log(`Manifest SHA-256: ${sha256(Buffer.from(serialized, 'utf8'))}`);
console.log(`Verified files: ${files.length}; total bytes: ${manifest.totalBytes}`);
