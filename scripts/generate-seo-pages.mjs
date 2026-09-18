/**
 * SEO pre-render — generate static, indexable surah pages.
 *
 * For every surah, emit `dist/quran/{slug}/index.html` containing the full
 * Uthmani text plus meta tags (title / description / canonical / OG / JSON-LD),
 * then write `dist/robots.txt` and `dist/sitemap.xml`.
 *
 * Runs AFTER `vite build` (the pages are copied on top of the empty `dist/`),
 * so they ride along with the GitHub Pages artifact. The pages contain NO
 * JavaScript and fetch NO fonts, keeping them crawl-safe and CLS-free; a
 * footer link opens the real app via the SPA deep link (#surah=N).
 *
 * Usage: npm run build:seo   (or: node scripts/generate-seo-pages.mjs)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'public', 'data');

const BASE_URL = 'https://bahaback-hub.github.io/quran-app';
const SURAH_COUNT = 114;

/**
 * Slugs preferred for the most-searched surahs, matched to the common Arabic
 * spelling (→ quran.com style). Everything else derives from englishName.
 */
const SLUG_ALIASES = {
  1: 'al-fatihah',
  2: 'al-baqarah',
  3: 'aal-imran',
  4: 'an-nisa',
  5: 'al-maidah',
  6: 'al-anam',
  7: 'al-araf',
  8: 'al-anfal',
  9: 'at-tawbah',
  36: 'ya-sin',
  55: 'ar-rahman',
  56: 'al-waqiah',
  93: 'ad-duha',
  109: 'al-kafirun',
  112: 'al-ikhlas',
  114: 'an-nas',
};

/** Lowercase englishName, drop apostrophes/diacritics, collapse junk runs to '-'. */
function defaultSlug(englishName) {
  return englishName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function arabicNumeral(n) {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

function stripBom(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[\u202A-\u202E]/g, '')
    .trim();
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const REVELATION_AR = { Meccan: 'مكية', Medinan: 'مدنية' };

function buildHead({ title, description, canonical, ogUrl, jsonLd }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />${jsonLd ? `\n    <script type="application/ld+json">\n${jsonLd}\n    </script>` : ''}
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${ogUrl}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${ogUrl}" />
    <meta property="og:image" content="${BASE_URL}/icon-512.png" />
    <meta property="og:locale" content="ar_SA" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${BASE_URL}/icon-512.png" />
    <meta name="robots" content="index,follow" />
    <style>
      body { margin: 0; background: #faf5f2; color: #2b1a12; font-family: "Amiri", "Scheherazade New", "Traditional Arabic", serif; line-height: 2.1; }
      .seo-wrap { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
      .seo-header { text-align: center; border-bottom: 1px solid #e4d8cf; padding-bottom: 20px; margin-bottom: 26px; }
      .seo-header h1 { font-size: 30px; margin: 0 0 8px; color: #5c2e2e; }
      .seo-translation { margin: 0 0 8px; color: #8a6a55; font-size: 16px; }
      .seo-meta { font-size: 15px; color: #8a6a55; }
      .seo-meta span + span::before { content: " • "; }
      .ayah { margin: 4px 0; font-size: 24px; text-align: right; }
      .ayah-number { color: #9a5e08; font-size: 0.75em; margin: 0 6px; }
      .seo-app-link { display: block; margin: 34px auto 12px; max-width: 420px; text-align: center; }
      .seo-app-link a { display: inline-block; background: #5c2e2e; color: #fff; text-decoration: none; padding: 12px 26px; border-radius: 12px; font-size: 18px; }
      .seo-back { text-align: center; font-size: 15px; color: #8a6a55; }
      .seo-back a { color: #5c2e2e; }
      footer { margin-top: 34px; border-top: 1px solid #e4d8cf; padding-top: 14px; font-size: 13px; color: #8a6a55; text-align: center; }
    </style>
  </head>`;
}

function buildSurahPage(surah, slug, surahListEntry) {
  const name = stripBom(surah.name);
  const nameNoSurat = name.replace(/^سُورَةُ\s+/, '');
  const ayahCount = surah.ayahs.length;
  const revelation = REVELATION_AR[surahListEntry?.revelationType] || '';
  const translation = surahListEntry?.englishNameTranslation || '';

  const title = `${name} - القرآن الكريم`;
  const description = `سورة ${nameNoSurat} من القرآن الكريم (${arabicNumeral(ayahCount)} آية${revelation ? '، ' + revelation : ''}) — اقرأ واستمع لسورة ${nameNoSurat} كاملة بالرسم العثماني مع التفسير في تطبيق القرآن الكريم (مجاناً، ويعمل دون اتصال).`;
  const ogUrl = `${BASE_URL}/quran/${slug}/`;
  const canonical = ogUrl;

  const ayahMarkup = surah.ayahs
    .map(
      (a) =>
        `<div class="ayah">${escapeHtml(stripBom(a.text))}<span class="ayah-number">﴿${arabicNumeral(a.numberInSurah)}﴾</span></div>`,
    )
    .join('\n');

  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      name: name,
      inLanguage: 'ar',
      url: ogUrl,
      mainEntityOfPage: ogUrl,
      isPartOf: {
        '@type': 'WebApplication',
        name: 'القرآن الكريم - عائلة السليماني',
        url: BASE_URL,
      },
      about: `سورة ${nameNoSurat} من القرآن الكريم`,
      description,
    },
    null,
    0,
  );

  const translationLine = translation ? `<p class="seo-translation">${escapeHtml(translation)}</p>` : '';

  const firstPage = surah.ayahs[0]?.page;

  const body = `  <body>
    <main class="seo-wrap">
      <header class="seo-header">
        <h1>${escapeHtml(name)}</h1>
        ${translationLine}
        <p class="seo-meta">
          <span>${arabicNumeral(ayahCount)} آية</span>
          ${revelation ? `<span>${escapeHtml(revelation)}</span>` : ''}
          ${firstPage ? `<span>تبدأ في الصفحة ${arabicNumeral(firstPage)}</span>` : ''}
        </p>
      </header>
      <article lang="ar" dir="rtl">${ayahMarkup}</article>
      <div class="seo-app-link">
        <a href="../../index.html#surah=${surah.number}">افتح في التطبيق للاستماع والتفسير</a>
      </div>
      <p class="seo-back"><a href="../../index.html">القرآن الكريم — الصفحة الرئيسية</a></p>
    </main>
  </body>
</html>
`;

  const html = buildHead({ title, description, canonical, ogUrl, jsonLd }) + body;
  return `<!-- Generated by scripts/generate-seo-pages.mjs — https://bahaback-hub.github.io/quran-app/ -->\n${html.replace(/\n\s*\n/g, '\n')}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const quran = readJson(join(DATA, 'quran-uthmani.json'));
  const surahs = quran.data.surahs;
  if (!Array.isArray(surahs) || surahs.length !== SURAH_COUNT) {
    throw new Error(`Unexpected quran-uthmani.json shape: expected ${SURAH_COUNT} surahs, got ${surahs?.length}`);
  }

  const list = readJson(join(DATA, 'surah-list.json'));
  const listByNumber = new Map(list.map((s) => [s.number, s]));

  const slugByNumber = new Map();
  for (const s of surahs) {
    const slug = SLUG_ALIASES[s.number] || defaultSlug(s.englishName);
    if (slugByNumber.has(slug)) {
      throw new Error(`Duplicate slug "${slug}" (surah ${s.number})`);
    }
    slugByNumber.set(s.number, slug);
  }

  const pageUrls = [];
  for (const s of surahs) {
    const slug = slugByNumber.get(s.number);
    const html = buildSurahPage(s, slug, listByNumber.get(s.number) || null);
    const dir = join(DIST, 'quran', slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf8');
    const url = `${BASE_URL}/quran/${slug}/`;
    pageUrls.push(url);
    console.log(`[seo] ${String(s.number).padStart(3)}  ${slug}  (${s.ayahs.length} ayahs)`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${BASE_URL}/</loc><lastmod>${today}</lastmod></url>\n` +
    pageUrls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    `\n</urlset>\n`;
  writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf8');

  const robots = `User-agent: *\n` + `Allow: /\n` + `Sitemap: ${BASE_URL}/sitemap.xml\n`;
  writeFileSync(join(DIST, 'robots.txt'), robots, 'utf8');

  console.log(`[seo] Wrote ${pageUrls.length} surah pages → dist/quran/`);
  console.log('[seo] Wrote dist/sitemap.xml and dist/robots.txt');
}

main();
