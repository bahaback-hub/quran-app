/**
 * One-shot asset optimizer: converts the large brand PNGs in public/brand/
 * into small WebP files sized for their on-screen usage.
 *
 * The PNGs are only ever displayed at small thumbnail sizes (~76x51 in the
 * reader toolbar, ~126x84 header mark), so we re-encode at 2x those boxes.
 * Run: node scripts/optimize-brand-images.mjs
 */
import { readdirSync, statSync } from 'node:fs';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const brandDir = fileURLToPath(new URL('../public/brand/', import.meta.url));

// Input filename -> target width (2x of largest displayed width).
// The Mushaf logo is referenced by src/css/layout.css; the preview logos by
// index.html. Displayed sizes from Lighthouse image-delivery audit.
const JOBS = [
  { file: 'mushaf-sulaymani-transparent-final.png', width: 252 },
  { file: 'reading-mode-surah-logo.png', width: 160 },
  { file: 'reading-mode-mushaf-logo.png', width: 160 },
  { file: 'reading-mode-featured-ayah-logo.png', width: 160 },
];

async function optimize() {
  const dir = await readdirSync(brandDir);
  for (const job of JOBS) {
    const src = join(brandDir, job.file);
    if (!dir.includes(job.file)) {
      console.warn(`SKIP ${job.file} (missing)`);
      continue;
    }
    const base = parse(job.file).name;
    const out = join(brandDir, `${base}.webp`);
    const before = statSync(src).size;
    const { width, height } = await sharp(src)
      .resize({ width: job.width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 })
      .toFile(out);
    const after = statSync(out).size;
    console.log(
      `${job.file} ${width}x${height}  ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(1)}KB  (-${(100 - (after / before) * 100).toFixed(0)}%)`
    );
  }
}

optimize().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});