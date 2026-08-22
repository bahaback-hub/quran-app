import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = join(scriptDir, '..');
const inputArg = process.argv[2];
if (!inputArg) {
  throw new Error('Usage: node scripts/split-contemplation-data.mjs <checkpoint-json-path>');
}
const inputPath = join(projectDir, inputArg);
const outputDir = join(projectDir, 'public', 'data', 'contemplation');

const raw = await readFile(inputPath, 'utf8');
const checkpoint = JSON.parse(raw);
const bySurah = new Map();

for (const entries of Object.values(checkpoint)) {
  for (const entry of entries) {
    if (!entry || typeof entry.surah !== 'number' || typeof entry.ayah !== 'number' || !Array.isArray(entry.questions)) {
      continue;
    }
    const list = bySurah.get(entry.surah) ?? [];
    list.push(entry);
    bySurah.set(entry.surah, list);
  }
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const surahs = [];
for (const [surah, entries] of [...bySurah.entries()].sort(([a], [b]) => a - b)) {
  entries.sort((a, b) => a.ayah - b.ayah);
  const file = `surah-${String(surah).padStart(3, '0')}.json`;
  await writeFile(join(outputDir, file), `${JSON.stringify(entries)}\n`, 'utf8');
  surahs.push({
    surah,
    file,
    ayahCount: entries.length,
    firstAyah: entries[0].ayah,
    lastAyah: entries.at(-1).ayah,
  });
}

const manifest = {
  schemaVersion: 1,
  status: 'partial-draft',
  totalEntries: surahs.reduce((total, item) => total + item.ayahCount, 0),
  surahs,
};
await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Created ${surahs.length} surah files containing ${manifest.totalEntries} contemplation entries.`);
