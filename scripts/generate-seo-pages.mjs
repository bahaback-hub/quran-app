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
const REVELATION_ORDER = { Meccan: 0, Medinan: 1 };

/** Path of the all-surahs index, relative to a surah page directory. */
const INDEX_FROM_SURAH = '../index.html';
/** Path of the app root, relative to a surah page directory. */
const APP_FROM_SURAH = '../../index.html';

function breadcrumbTrail(nameNoSurat) {
  return [
    { name: 'القرآن الكريم', href: APP_FROM_SURAH },
    { name: 'سور القرآن', href: INDEX_FROM_SURAH },
    { name: `سورة ${nameNoSurat}` },
  ];
}

/** Visible breadcrumb trail. Google reads these words for the SERP breadcrumb too. */
function breadcrumbMarkup(trail) {
  const parts = trail.map((crumb, i) => {
    const last = i === trail.length - 1;
    const label = escapeHtml(crumb.name);
    return last
      ? `<span class="seo-crumb" aria-current="page">${label}</span>`
      : `<a href="${crumb.href}">${label}</a><span class="seo-sep" aria-hidden="true">‹</span>`;
  });
  return `    <nav class="seo-breadcrumb" aria-label="مسار التنقل">${parts.join('')}</nav>\n`;
}

function breadcrumbJsonLd(trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      ...(crumb.href
        ? {
            // Resolved to an absolute URL, and stripped of the trailing
            // "index.html" so a breadcrumb never advertises a second spelling
            // of a URL the site already declares as a directory elsewhere.
            item: new URL(crumb.href, `${BASE_URL}/quran/x/`).href.replace(/index\.html$/, ''),
          }
        : {}),
    })),
  };
}

function buildHead({ title, description, ogUrl, jsonLd }) {
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
      .seo-breadcrumb { font-size: 15px; color: #8a6a55; margin-bottom: 14px; }
      .seo-breadcrumb a { color: #5c2e2e; }
      .seo-crumb { color: #8a6a55; }
      .seo-sep { margin: 0 6px; color: #b59c8c; }
      .seo-header { text-align: center; border-bottom: 1px solid #e4d8cf; padding-bottom: 20px; margin-bottom: 26px; }
      .seo-header h1 { font-size: 30px; margin: 0 0 8px; color: #5c2e2e; }
      .seo-translation { margin: 0 0 8px; color: #8a6a55; font-size: 16px; }
      .seo-meta { font-size: 15px; color: #8a6a55; }
      .seo-meta span + span::before { content: " • "; }
      .seo-h2 { font-size: 21px; color: #5c2e2e; margin: 34px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e4d8cf; }
      .seo-facts { margin: 0; padding: 0; list-style: none; }
      .seo-facts li { padding: 6px 0; border-bottom: 1px dashed #eadfd7; font-size: 16px; }
      .seo-facts b { color: #5c2e2e; font-weight: normal; }
      .ayah { margin: 4px 0; font-size: 24px; text-align: right; }
      .ayah-number { color: #9a5e08; font-size: 0.75em; margin: 0 6px; }
      .seo-siblings { display: flex; flex-wrap: wrap; gap: 10px; align-items: stretch; }
      .seo-siblings a { flex: 1 1 180px; display: block; text-decoration: none; background: #f1e6dd; color: #5c2e2e; border-radius: 12px; padding: 12px 16px; }
      .seo-siblings a:hover { background: #e8d9cd; }
      .seo-sib-label { display: block; font-size: 13px; color: #8a6a55; }
      .seo-sib-name { display: block; font-size: 18px; }
      .seo-sib-all { flex-basis: 100%; text-align: center; }
      .seo-index-list { margin: 0; padding: 0; list-style: none; }
      .seo-index-list li { border-bottom: 1px solid #f0e6dd; }
      .seo-index-list a { display: block; padding: 9px 2px; text-decoration: none; color: #2b1a12; }
      .seo-index-list a:hover { background: #f4ebe4; }
      .seo-index-num { display: inline-block; min-width: 2.6em; color: #9a5e08; }
      .seo-index-meaning { color: #8a6a55; font-size: 15px; }
      .seo-app-link { display: block; margin: 34px auto 12px; max-width: 420px; text-align: center; }
      .seo-app-link a { display: inline-block; background: #5c2e2e; color: #fff; text-decoration: none; padding: 12px 26px; border-radius: 12px; font-size: 18px; }
      .seo-back { text-align: center; font-size: 15px; color: #8a6a55; }
      .seo-back a { color: #5c2e2e; }
      footer { margin-top: 34px; border-top: 1px solid #e4d8cf; padding-top: 14px; font-size: 13px; color: #8a6a55; text-align: center; }
      @media (max-width: 480px) { .seo-header h1 { font-size: 25px; } .ayah { font-size: 21px; } }
    </style>
  </head>`;
}

function buildSurahPage(surah, slug, surahListEntry, { prev, next }) {
  const name = stripBom(surah.name);
  const nameNoSurat = name.replace(/^سُورَةُ\s+/, '');
  const ayahCount = surah.ayahs.length;
  const revelation = REVELATION_AR[surahListEntry?.revelationType] || '';
  const translation = surahListEntry?.englishNameTranslation || '';
  const englishName = surahListEntry?.englishName || '';

  const title = `${name} - المصحف السليماني`;
  const description = `سورة ${nameNoSurat} من القرآن الكريم (${arabicNumeral(ayahCount)} آية${revelation ? '، ' + revelation : ''}) — اقرأ واستمع لسورة ${nameNoSurat} كاملة بالرسم العثماني مع التفسير في المصحف السليماني (مجاناً، ويعمل دون اتصال).`;
  const ogUrl = `${BASE_URL}/quran/${slug}/`;

  const ayahMarkup = surah.ayahs
    .map(
      (a) =>
        `<div class="ayah">${escapeHtml(stripBom(a.text))}<span class="ayah-number">﴿${arabicNumeral(a.numberInSurah)}﴾</span></div>`,
    )
    .join('\n');

  const trail = breadcrumbTrail(nameNoSurat);
  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: title,
          name: name,
          inLanguage: 'ar',
          url: ogUrl,
          isPartOf: {
            '@type': 'WebApplication',
            name: 'المصحف السليماني',
            url: BASE_URL,
          },
          about: `سورة ${nameNoSurat} من القرآن الكريم`,
          description,
        },
        breadcrumbJsonLd(trail),
      ],
    },
    null,
    0,
  );

  const translationLine = translation ? `<p class="seo-translation">${escapeHtml(translation)}</p>` : '';
  const firstPage = surah.ayahs[0]?.page;

  // Every surah page was previously an island: the only outbound links were to
  // itself and to the app. Google discovers pages through links on pages it has
  // already crawled, so the 114 pages were effectively unreachable to it.
  // Siblings sit one directory up, so they are "../{slug}/" not "{slug}/".
  const facts = [
    ['عدد الآيات', `${arabicNumeral(ayahCount)} آية`],
    ['مكان النزول', revelation],
    ['ترتيبها في المصحف', arabicNumeral(surah.number)],
    englishName ? ['الاسم بالإنجليزية', englishName] : null,
    firstPage ? ['تبدأ في صفحة المصحف', arabicNumeral(firstPage)] : null,
  ].filter(Boolean);

  const siblings = [];
  if (prev) {
    siblings.push(
      `<a href="../${prev.slug}/"><span class="seo-sib-label">السورة السابقة</span><span class="seo-sib-name">سورة ${escapeHtml(prev.nameNoSurat)}</span></a>`,
    );
  }
  siblings.push(
    `<a class="seo-sib-all" href="${INDEX_FROM_SURAH}">كل سور القرآن الكريم (${arabicNumeral(SURAH_COUNT)})</a>`,
  );
  if (next) {
    siblings.push(
      `<a href="../${next.slug}/"><span class="seo-sib-label">السورة التالية</span><span class="seo-sib-name">سورة ${escapeHtml(next.nameNoSurat)}</span></a>`,
    );
  }

  const body = `  <body>
    <div class="seo-wrap">
${breadcrumbMarkup(trail)}      <header class="seo-header">
        <h1>${escapeHtml(name)}</h1>
        ${translationLine}
      </header>
      <h2 class="seo-h2">معلومات السورة</h2>
      <ul class="seo-facts">
${facts.map(([k, v]) => `        <li><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</li>`).join('\n')}
      </ul>
      <h2 class="seo-h2">نص السورة</h2>
      <article lang="ar" dir="rtl">${ayahMarkup}</article>
      <h2 class="seo-h2">تصفح السور</h2>
      <nav class="seo-siblings" aria-label="التنقل بين السور">
        ${siblings.join('\n        ')}
      </nav>
      <div class="seo-app-link">
        <a href="${APP_FROM_SURAH}#surah=${surah.number}">افتح في التطبيق للاستماع والتفسير</a>
      </div>
      <p class="seo-back"><a href="${APP_FROM_SURAH}">القرآن الكريم — الصفحة الرئيسية</a></p>
    </div>
  </body>
</html>
`;

  const html = buildHead({ title, description, ogUrl, jsonLd }) + body;
  return `<!-- Generated by scripts/generate-seo-pages.mjs — https://bahaback-hub.github.io/quran-app/ -->\n${html.replace(/\n\s*\n/g, '\n')}`;
}

/**
 * The all-surahs index at /quran/.
 *
 * This is the page that makes the other 114 reachable: it links every single
 * surah from one crawlable, JavaScript-free page, which is what turns the set
 * from a pile of orphans into a structure Google can walk.
 */
function buildIndexPage(entries) {
  const title = `سور القرآن الكريم — فهرس ال${arabicNumeral(SURAH_COUNT)} سورة كاملة`;
  const description = `فهرس شامل لسور القرآن الكريم: ${arabicNumeral(SURAH_COUNT)} سورة مع عدد آياتها ومكان نزولها ومعناها، وروابط مباشرة لقراءة كل سورة كاملة بالرسم العثماني — مجاناً ويعمل دون اتصال.`;
  const ogUrl = `${BASE_URL}/quran/`;

  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          name: title,
          description,
          url: ogUrl,
          inLanguage: 'ar',
          isPartOf: { '@type': 'WebApplication', name: 'المصحف السليماني', url: BASE_URL },
        },
        {
          '@type': 'ItemList',
          name: 'سور القرآن الكريم',
          numberOfItems: SURAH_COUNT,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: entries.map((e, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `سورة ${e.nameNoSurat}`,
            url: `${BASE_URL}/quran/${e.slug}/`,
          })),
        },
        breadcrumbJsonLd([
          { name: 'القرآن الكريم', href: '../../index.html' },
          { name: 'سور القرآن' },
        ]),
      ],
    },
    null,
    0,
  );

  const group = (revelation, heading) => {
    const items = entries.filter((e) => e.revelationKey === revelation);
    const list = items
      .map(
        (e) =>
          `        <li><a href="${e.slug}/"><span class="seo-index-num">${arabicNumeral(e.number)}</span>سورة ${escapeHtml(e.nameNoSurat)} <span class="seo-index-meaning">— ${arabicNumeral(e.numberOfAyahs)} آية${e.meaning ? '، ' + escapeHtml(e.meaning) : ''}</span></a></li>`,
      )
      .join('\n');
    return `      <h2 class="seo-h2">${heading} (${arabicNumeral(items.length)})</h2>
      <ul class="seo-index-list">
${list}
      </ul>
`;
  };

  const body = `  <body>
    <div class="seo-wrap">
${breadcrumbMarkup([
      { name: 'القرآن الكريم', href: '../../index.html' },
      { name: 'سور القرآن' },
    ])}      <header class="seo-header">
        <h1>سور القرآن الكريم</h1>
        <p class="seo-translation">فهرس ال${arabicNumeral(SURAH_COUNT)} سورة</p>
      </header>
      <p>كل سورة من سور القرآن الكريم ال${arabicNumeral(SURAH_COUNT)}، مع عدد آياتها ومكان نزولها ومعناها. اضغط اسم السورة لقراءة نصها كاملاً بالرسم العثماني، أو افتحها في التطبيق للاستماع مع التفسير.</p>
${group('Meccan', 'سور مكية')}${group('Medinan', 'سور مدنية')}      <div class="seo-app-link">
        <a href="../index.html">افتح التطبيق — Quran الكريم</a>
      </div>
      <p class="seo-back"><a href="../index.html">القرآن الكريم — الصفحة الرئيسية</a></p>
    </div>
  </body>
</html>
`;

  const html = buildHead({ title, description, ogUrl, jsonLd }) + body;
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

  // One row per surah, in surah order, carrying everything the page and the
  // index both need. Built up front so a page can name its neighbours.
  const neighbour = (j) => {
    const n = surahs[j];
    return {
      slug: slugByNumber.get(n.number),
      nameNoSurat: stripBom(n.name).replace(/^سُورَةُ\s+/, ''),
    };
  };
  const entries = surahs.map((s, i) => {
    const meta = listByNumber.get(s.number) || null;
    return {
      surah: s,
      number: s.number,
      slug: slugByNumber.get(s.number),
      name: stripBom(s.name),
      nameNoSurat: stripBom(s.name).replace(/^سُورَةُ\s+/, ''),
      numberOfAyahs: s.ayahs.length,
      meaning: meta?.englishNameTranslation || '',
      revelationKey: meta?.revelationType || '',
      prev: i > 0 ? neighbour(i - 1) : null,
      next: i < surahs.length - 1 ? neighbour(i + 1) : null,
    };
  });

  for (const e of entries) {
    const html = buildSurahPage(e.surah, e.slug, listByNumber.get(e.number) || null, {
      prev: e.prev,
      next: e.next,
    });
    const dir = join(DIST, 'quran', e.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf8');
    const url = `${BASE_URL}/quran/${e.slug}/`;
    pageUrls.push(url);
    console.log(`[seo] ${String(e.number).padStart(3)}  ${e.slug}  (${e.numberOfAyahs} ayahs)`);
  }

  // The index page: one crawlable page that links all 114, so none of them is
  // an island reachable only through the sitemap.
  const indexHtml = buildIndexPage(entries);
  mkdirSync(join(DIST, 'quran'), { recursive: true });
  writeFileSync(join(DIST, 'quran', 'index.html'), indexHtml, 'utf8');
  const indexUrl = `${BASE_URL}/quran/`;
  console.log(`[seo]   -  index  (/quran/ — ${entries.length} links)`);

  const today = new Date().toISOString().slice(0, 10);
  const sitemapUrls = [indexUrl, ...pageUrls];
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${BASE_URL}/</loc><lastmod>${today}</lastmod></url>\n` +
    sitemapUrls
      .map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`)
      .join('\n') +
    `\n</urlset>\n`;
  writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf8');

  const robots = `User-agent: *\n` + `Allow: /\n` + `Sitemap: ${BASE_URL}/sitemap.xml\n`;
  writeFileSync(join(DIST, 'robots.txt'), robots, 'utf8');

  console.log(`[seo] Wrote ${pageUrls.length} surah pages + 1 index → dist/quran/`);
  console.log('[seo] Wrote dist/sitemap.xml and dist/robots.txt');
}

main();
