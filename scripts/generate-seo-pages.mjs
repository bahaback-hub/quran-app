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

/** In Arabic pages the ayah count keeps Arabic numerals; elsewhere Latin. */
function numeral(n, locale) {
  return locale === 'ar' ? arabicNumeral(n) : String(n);
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

/**
 * Arabic copy for the static pages, kept in its own UTF-8 JSON file.
 *
 * These strings used to be literals here, and every ad-hoc edit of this file
 * re-encoded them as Windows-1252, which silently turned "سور مكية" into
 * letter-shuffled mojibake across 18 lines - including ARABIC_DIGITS, the ayah
 * ornament and the surah-prefix regex, so the pages rendered with broken numerals
 * and un-stripped surah names. A build script has no business carrying text it
 * only prints; the strings now live in scripts/seo-strings.ar.json, and
 * src/__tests__/seo-locales-encoding.test.ts fails if either file is saved in
 * the wrong encoding.
 */
const AR_STRINGS = readJson(join(ROOT, 'scripts', 'seo-strings.ar.json'));
const { surahPrefix, ayahOpen, ayahClose } = AR_STRINGS;
/** Matches the vocalised "سُورَةُ" that quran-uthmani.json prefixes onto names. */
const SURAH_PREFIX_RE = new RegExp(`^${surahPrefix.trim()}\\s+`, 'u');

/** Builds the Arabic locale entry from the JSON, including its templates. */
function buildArLocale(s) {
  const fill = (tpl, values) => tpl.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
  return {
    code: 'ar',
    dir: 'rtl',
    prefix: '',
    lang: 'ar',
    quran: s.quran,
    surahs: s.surahs,
    surahWord: s.surahWord,
    ayahsWord: s.ayahsWord,
    revelation: { Meccan: s.revelationMeccan, Medinan: s.revelationMedinan },
    indexTitle: (n) => fill(s.indexTitle, { n }),
    indexHeading: s.indexHeading,
    indexSubtitle: (n) => fill(s.indexSubtitle, { n }),
    indexIntro: (n) => fill(s.indexIntro, { n }),
    meccanHeading: s.meccanHeading,
    medinanHeading: s.medinanHeading,
    surahTitle: (name) => fill(s.surahTitle, { name }),
    surahDescription: (name, ayahs, revelation) =>
      fill(s.descriptionStart, { name, ayahs }) +
      (revelation ? fill(s.descriptionReveal, { revelation }) : '') +
      fill(s.descriptionEnd, { name }),
    h2Facts: s.h2Facts,
    h2Text: s.h2Text,
    h2Browse: s.h2Browse,
    factAyahs: s.factAyahs,
    factRevelation: s.factRevelation,
    factOrder: s.factOrder,
    factEnglish: s.factEnglish,
    factPage: s.factPage,
    previousSurah: s.previousSurah,
    nextSurah: s.nextSurah,
    allSurahs: (n) => fill(s.allSurahs, { n }),
    openInApp: s.openInApp,
    backHome: s.backHome,
    breadcrumbLabel: s.breadcrumbLabel,
    browseLabel: s.browseLabel,
  };
}

const LOCALES = {
  ar: buildArLocale(AR_STRINGS),
  en: {
    code: 'en',
    dir: 'ltr',
    prefix: '/en',
    lang: 'en',
    quran: 'Quran',
    surahs: 'Surahs of the Quran',
    surahWord: 'Surah',
    ayahsWord: 'verses',
    revelation: { Meccan: 'Meccan', Medinan: 'Medinan' },
    indexTitle: (n) => `All ${n} Surahs of the Quran — complete index`,
    indexHeading: 'Surahs of the Quran',
    indexSubtitle: (n) => `An index of all ${n} surahs`,
    indexIntro: (n) =>
      `All ${n} surahs of the Quran, with the number of verses, where each was revealed, and its meaning. Select a surah to read it in full in Uthmani script, or open it in the app to listen with tafsir.`,
    meccanHeading: 'Meccan surahs',
    medinanHeading: 'Medinan surahs',
    surahTitle: (name) => `Surah ${name} - Al-Mushaf As-Sulaymani`,
    surahDescription: (name, ayahs, revelation) =>
      `Surah ${name} of the Quran (${ayahs} verses${revelation ? ', ' + revelation : ''}) — read and listen to the full text in Uthmani script with tafsir in Al-Mushaf As-Sulaymani. Free, and works offline.`,
    h2Facts: 'About this surah',
    h2Text: 'Surah text',
    h2Browse: 'Browse surahs',
    factAyahs: 'Number of verses',
    factRevelation: 'Revealed in',
    factOrder: 'Position in the Quran',
    factEnglish: 'English name',
    factPage: 'Begins on mushaf page',
    previousSurah: 'Previous surah',
    nextSurah: 'Next surah',
    allSurahs: (n) => `All ${n} surahs of the Quran`,
    openInApp: 'Open in the app to listen with tafsir',
    backHome: 'Quran — home page',
    breadcrumbLabel: 'Breadcrumb',
    browseLabel: 'Browse surahs',
  },
};

const LOCALE_CODES = Object.keys(LOCALES);

/**
 * How many "../" a page needs to climb from its own directory back to the app
 * root. Takes a locale code, not a locale object - passing the object silently
 * returned the Arabic depth for every locale.
 *
 * A surah page lives at /{prefix?}/quran/{slug}/ and the index at
 * /{prefix?}/quran/, so the index is one level shallower and its link to the app
 * must be one "../" shorter. Getting that wrong made the index pages point
 * above the app entirely, at the site root.
 */
function appDepth(localeCode, isIndex = false) {
  const levels = (LOCALES[localeCode].prefix ? 3 : 2) - (isIndex ? 1 : 0);
  return '../'.repeat(levels).replace(/\/$/, '');
}
const REVELATION_ORDER = { Meccan: 0, Medinan: 1 };

/** Path of the all-surahs index, relative to a surah page directory. */
const INDEX_FROM_SURAH = '../index.html';
/** The separator between breadcrumb crumbs, taken from the Arabic strings file. */
const CRUMB_SEP = AR_STRINGS.breadcrumbSep ?? '‹';

function breadcrumbTrail(t, nameNoSurat, localeCode) {
  return [
    { name: t.quran, href: `${appDepth(localeCode)}/index.html` },
    { name: t.surahs, href: INDEX_FROM_SURAH },
    { name: `${t.surahWord} ${nameNoSurat}`.trim() },
  ];
}

/** Visible breadcrumb trail. Google reads these words for the SERP breadcrumb too. */
function breadcrumbMarkup(trail, label) {
  const parts = trail.map((crumb, i) => {
    const last = i === trail.length - 1;
    const text = escapeHtml(crumb.name);
    return last
      ? `<span class="seo-crumb" aria-current="page">${text}</span>`
      : `<a href="${crumb.href}">${text}</a><span class="seo-sep" aria-hidden="true">${CRUMB_SEP}</span>`;
  });
  return `    <nav class="seo-breadcrumb" aria-label="${escapeHtml(label)}">${parts.join('')}</nav>\n`;
}

/**
 * @param pageUrl absolute URL of the page being built, so a relative href
 *   resolves against the real location rather than a guess. That is what makes
 *   the three-level climb of a translated page come out right.
 */
function breadcrumbJsonLd(trail, pageUrl) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      ...(crumb.href
        ? {
            // Absolute, and stripped of a trailing index.html so a breadcrumb
            // never advertises a second spelling of a URL the site already
            // declares as a directory.
            item: new URL(crumb.href, pageUrl).href.replace(/index\.html$/, ''),
          }
        : {}),
    })),
  };
}

/**
 * Reciprocal hreflang set: every locale links to every other locale, including
 * itself. Google ignores hreflang unless the declarations are reciprocal, so
 * this is built once from the locale table and applied to every page.
 */
function hreflangLinks(urlFor) {
  return LOCALE_CODES.map(
    (code) =>
      `    <link rel="alternate" hreflang="${LOCALES[code].lang}" href="${urlFor(code)}" />`,
  ).join('\n');
}

/** Visible switcher between the locales of this page, for humans. */
function languageBar(localeCode, selfUrlFor, label) {
  const links = LOCALE_CODES.map((code) => {
    const l = LOCALES[code];
    const current = code === localeCode;
    return `      <a href="${selfUrlFor(code)}"${current ? ' aria-current="true"' : ''} hreflang="${l.lang}" lang="${l.lang}">${escapeHtml(l.code.toUpperCase())}</a>`;
  });
  return `    <nav class="seo-langbar" aria-label="${escapeHtml(label)}">\n${links.join('\n')}\n    </nav>\n`;
}

function buildHead({ title, description, ogUrl, jsonLd, t, selfUrlFor }) {
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
  <head>
    <meta charset="UTF-8" />${jsonLd ? `\n    <script type="application/ld+json">\n${jsonLd}\n    </script>` : ''}
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${ogUrl}" />
${hreflangLinks(selfUrlFor)}
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${ogUrl}" />
    <meta property="og:image" content="${BASE_URL}/icon-512.png" />
    <meta property="og:locale" content="${t.code === 'ar' ? 'ar_SA' : t.code}" />
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
      .seo-langbar { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 18px; font-size: 15px; }
      .seo-langbar a { background: #f1e6dd; color: #5c2e2e; text-decoration: none; padding: 5px 12px; border-radius: 999px; }
      .seo-langbar a[aria-current="true"] { background: #5c2e2e; color: #fff; }
      .seo-header { text-align: center; border-bottom: 1px solid #e4d8cf; padding-bottom: 20px; margin-bottom: 26px; }
      .seo-header h1 { font-size: 30px; margin: 0 0 8px; color: #5c2e2e; }
      .seo-translation { margin: 0 0 8px; color: #8a6a55; font-size: 16px; }
      .seo-intro { font-size: 17px; }
      .seo-meta { font-size: 15px; color: #8a6a55; }
      .seo-meta span + span::before { content: " • "; }
      .seo-h2 { font-size: 21px; color: #5c2e2e; margin: 34px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e4d8cf; }
      .seo-facts { margin: 0; padding: 0; list-style: none; }
      .seo-facts li { padding: 6px 0; border-bottom: 1px dashed #eadfd7; font-size: 16px; }
      .seo-facts b { color: #5c2e2e; font-weight: normal; }
      .ayah { margin: 4px 0; font-size: 24px; text-align: right; direction: rtl; }
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

function buildSurahPage(surah, slug, surahListEntry, { prev, next }, localeCode) {
  const t = LOCALES[localeCode];
  const name = stripBom(surah.name);
  const nameNoSurat = name.replace(SURAH_PREFIX_RE, '');
  const ayahCount = surah.ayahs.length;
  const revelation = t.revelation[surahListEntry?.revelationType] || '';
  // The surah's own name and meaning are only translated in English so far. An
  // English page leads with the transliteration an English speaker would search
  // for and shows the Arabic script underneath, rather than putting Arabic alone
  // in a <title>. A locale belongs here once its meanings are real: a German
  // page carrying Arabic text behind translated labels would rank as thin
  // duplicate content.
  const englishName = localeCode === 'en' ? (surahListEntry?.englishName || '') : '';
  const meaning = localeCode === 'en' ? (surahListEntry?.englishNameTranslation || '') : '';
  const heading = localeCode === 'en' ? englishName || nameNoSurat : name;
  const translation = localeCode === 'en' && meaning ? `${meaning} - ${nameNoSurat}` : meaning;

  const title = t.surahTitle(localeCode === 'en' ? heading : nameNoSurat);
  const description = t.surahDescription(
    localeCode === 'en' ? heading : nameNoSurat,
    numeral(ayahCount, localeCode),
    revelation,
  );
  const ogUrl = `${BASE_URL}${t.prefix}/quran/${slug}/`;
  const selfUrlFor = (code) => `${BASE_URL}${LOCALES[code].prefix}/quran/${slug}/`;

  const ayahMarkup = surah.ayahs
    .map(
      (a) =>
        `<div class="ayah">${escapeHtml(stripBom(a.text))}<span class="ayah-number">${ayahOpen}${arabicNumeral(a.numberInSurah)}${ayahClose}</span></div>`,
    )
    .join('\n');

  const trail = breadcrumbTrail(t, nameNoSurat, localeCode);
  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Article',
          headline: title,
          name: name,
          inLanguage: t.lang,
          url: ogUrl,
          isPartOf: {
            '@type': 'WebApplication',
            name: 'المصحف السليماني',
            url: BASE_URL,
          },
          about: `${t.surahWord} ${nameNoSurat}`,
          description,
        },
        breadcrumbJsonLd(trail, ogUrl),
      ],
    },
    null,
    0,
  );

  const translationLine = translation ? `<p class="seo-translation">${escapeHtml(translation)}</p>` : '';
  const firstPage = surah.ayahs[0]?.page;
  const appHref = `${appDepth(localeCode)}/index.html`;

  // Every surah page was previously an island: the only outbound links were to
  // itself and to the app. Google discovers pages through links on pages it has
  // already crawled, so the 114 pages were effectively unreachable to it.
  // Siblings sit one directory up, so they are "../{slug}/" not "{slug}/".
  const facts = [
    [t.factAyahs, `${numeral(ayahCount, localeCode)} ${t.ayahsWord}`],
    revelation ? [t.factRevelation, revelation] : null,
    [t.factOrder, numeral(surah.number, localeCode)],
    englishName ? [t.factEnglish, englishName] : null,
    firstPage ? [t.factPage, numeral(firstPage, localeCode)] : null,
  ].filter(Boolean);

  const siblings = [];
  if (prev) {
    siblings.push(
      `<a href="../${prev.slug}/"><span class="seo-sib-label">${escapeHtml(t.previousSurah)}</span><span class="seo-sib-name">${escapeHtml(t.surahWord)} ${escapeHtml(prev.nameNoSurat)}</span></a>`,
    );
  }
  siblings.push(
    `<a class="seo-sib-all" href="${INDEX_FROM_SURAH}">${escapeHtml(t.allSurahs(SURAH_COUNT))}</a>`,
  );
  if (next) {
    siblings.push(
      `<a href="../${next.slug}/"><span class="seo-sib-label">${escapeHtml(t.nextSurah)}</span><span class="seo-sib-name">${escapeHtml(t.surahWord)} ${escapeHtml(next.nameNoSurat)}</span></a>`,
    );
  }

  const body = `  <body>
    <div class="seo-wrap">
${languageBar(localeCode, selfUrlFor, t.breadcrumbLabel)}${breadcrumbMarkup(trail, t.breadcrumbLabel)}      <header class="seo-header">
        <h1>${escapeHtml(heading)}</h1>
        ${translationLine}
      </header>
      <h2 class="seo-h2">${escapeHtml(t.h2Facts)}</h2>
      <ul class="seo-facts">
${facts.map(([k, v]) => `        <li><b>${escapeHtml(k)}:</b> ${escapeHtml(String(v))}</li>`).join('\n')}
      </ul>
      <h2 class="seo-h2">${escapeHtml(t.h2Text)}</h2>
      <article lang="ar" dir="rtl">${ayahMarkup}</article>
      <h2 class="seo-h2">${escapeHtml(t.h2Browse)}</h2>
      <nav class="seo-siblings" aria-label="${escapeHtml(t.browseLabel)}">
        ${siblings.join('\n        ')}
      </nav>
      <div class="seo-app-link">
        <a href="${appHref}#surah=${surah.number}">${escapeHtml(t.openInApp)}</a>
      </div>
      <p class="seo-back"><a href="${appHref}">${escapeHtml(t.backHome)}</a></p>
    </div>
  </body>
</html>
`;

  const html = buildHead({ title, description, ogUrl, jsonLd, t, selfUrlFor }) + body;
  return `<!-- Generated by scripts/generate-seo-pages.mjs — ${BASE_URL}/ -->\n${html.replace(/\n\s*\n/g, '\n')}`;
}

/**
 * The all-surahs index at /quran/.
 *
 * This is the page that makes the other 114 reachable: it links every single
 * surah from one crawlable, JavaScript-free page, which is what turns the set
 * from a pile of orphans into a structure Google can walk.
 */
function buildIndexPage(entries, localeCode) {
  const t = LOCALES[localeCode];
  const title = t.indexTitle(SURAH_COUNT);
  const description = t.indexIntro(SURAH_COUNT);
  const ogUrl = `${BASE_URL}${t.prefix}/quran/`;
  const selfUrlFor = (code) => `${BASE_URL}${LOCALES[code].prefix}/quran/`;
  const trail = [
    { name: t.quran, href: `${appDepth(localeCode, true)}/index.html` },
    { name: t.surahs },
  ];

  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          name: title,
          description,
          url: ogUrl,
          inLanguage: t.lang,
          isPartOf: { '@type': 'WebApplication', name: 'المصحف السليماني', url: BASE_URL },
        },
        {
          '@type': 'ItemList',
          name: t.indexHeading,
          numberOfItems: SURAH_COUNT,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          itemListElement: entries.map((e, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `${t.surahWord} ${e.nameNoSurat}`,
            url: `${BASE_URL}${t.prefix}/quran/${e.slug}/`,
          })),
        },
        breadcrumbJsonLd(trail, ogUrl),
      ],
    },
    null,
    0,
  );

  const group = (revelation, heading) => {
    const items = entries.filter((e) => e.revelationKey === revelation);
    // The meaning is only shown where it is real - English today.
    const showMeaning = localeCode === 'en';
    const list = items
      .map((e) => {
        const bits = [`${numeral(e.numberOfAyahs, localeCode)} ${t.ayahsWord}`];
        if (showMeaning && e.meaning) bits.push(e.meaning);
        return `        <li><a href="${e.slug}/"><span class="seo-index-num">${numeral(e.number, localeCode)}</span>${escapeHtml(t.surahWord)} ${escapeHtml(e.nameNoSurat)} <span class="seo-index-meaning">- ${escapeHtml(bits.join(', '))}</span></a></li>`;
      })
      .join('\n');
    return `      <h2 class="seo-h2">${escapeHtml(heading)} (${numeral(items.length, localeCode)})</h2>
      <ul class="seo-index-list">
${list}
      </ul>
`;
  };

  const appHref = `${appDepth(localeCode, true)}/index.html`;

  const body = `  <body>
    <div class="seo-wrap">
${languageBar(localeCode, selfUrlFor, t.breadcrumbLabel)}${breadcrumbMarkup(trail, t.breadcrumbLabel)}      <header class="seo-header">
        <h1>${escapeHtml(t.indexHeading)}</h1>
        <p class="seo-translation">${escapeHtml(t.indexSubtitle(SURAH_COUNT))}</p>
      </header>
      <p class="seo-intro">${escapeHtml(t.indexIntro(SURAH_COUNT))}</p>
${group('Meccan', t.meccanHeading)}${group('Medinan', t.medinanHeading)}      <div class="seo-app-link">
        <a href="${appHref}">${escapeHtml(t.openInApp)}</a>
      </div>
      <p class="seo-back"><a href="${appHref}">${escapeHtml(t.backHome)}</a></p>
    </div>
  </body>
</html>
`;

  const html = buildHead({ title, description, ogUrl, jsonLd, t, selfUrlFor }) + body;
  return `<!-- Generated by scripts/generate-seo-pages.mjs — ${BASE_URL}/ -->\n${html.replace(/\n\s*\n/g, '\n')}`;
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

  // One row per surah, in surah order, carrying everything the page and the
  // index both need. Built up front so a page can name its neighbours.
  const neighbour = (j) => {
    const n = surahs[j];
    return {
      slug: slugByNumber.get(n.number),
      nameNoSurat: stripBom(n.name).replace(SURAH_PREFIX_RE, ''),
    };
  };
  const entries = surahs.map((s, i) => {
    const meta = listByNumber.get(s.number) || null;
    return {
      surah: s,
      number: s.number,
      slug: slugByNumber.get(s.number),
      name: stripBom(s.name),
      nameNoSurat: stripBom(s.name).replace(SURAH_PREFIX_RE, ''),
      numberOfAyahs: s.ayahs.length,
      meaning: meta?.englishNameTranslation || '',
      revelationKey: meta?.revelationType || '',
      prev: i > 0 ? neighbour(i - 1) : null,
      next: i < surahs.length - 1 ? neighbour(i + 1) : null,
    };
  });

  for (const localeCode of LOCALE_CODES) {
    const t = LOCALES[localeCode];
    const root = join(DIST, t.prefix, 'quran');
    for (const e of entries) {
      const html = buildSurahPage(
        e.surah,
        e.slug,
        listByNumber.get(e.number) || null,
        { prev: e.prev, next: e.next },
        localeCode,
      );
      const dir = join(root, e.slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'index.html'), html, 'utf8');
    }
    // The index page: one crawlable page that links all 114, so none of them is
    // an island reachable only through the sitemap.
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'index.html'), buildIndexPage(entries, localeCode), 'utf8');
    console.log(`[seo] ${localeCode}  ${entries.length} surah pages + index`);
  }

  const today = new Date().toISOString().slice(0, 10);

  /**
   * Each URL with the full set of its alternates. Google only honours hreflang
   * when the declarations are reciprocal, so every entry carries every locale -
   * including its own - in both the page markup and here. Each locale is also
   * listed under its own <loc> rather than only as an alternate, so a
   * translated page is discoverable from the sitemap on its own.
   */
  const urlEntry = (tail, localeCode) => {
    const l = LOCALES[localeCode];
    return {
      loc: `${BASE_URL}${l.prefix}/quran/${tail}`,
      alternates: LOCALE_CODES.map((c) => ({
        hreflang: LOCALES[c].lang,
        href: `${BASE_URL}${LOCALES[c].prefix}/quran/${tail}`,
      })),
    };
  };

  const pageEntries = [
    ...LOCALE_CODES.map((c) => urlEntry('', c)),
    ...entries.flatMap((e) => LOCALE_CODES.map((c) => urlEntry(`${e.slug}/`, c))),
  ];

  // Privacy policy and the FAQ are listed too: real pages people link to,
  // published but previously unreachable from the sitemap.
  const staticPages = ['privacy-policy.html', 'faq/', 'en/faq/'];

  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `  <url><loc>${BASE_URL}/</loc><lastmod>${today}</lastmod></url>\n` +
    staticPages
      .map((p) => `  <url><loc>${BASE_URL}/${p}</loc><lastmod>${today}</lastmod></url>\n`)
      .join('') +
    pageEntries
      .map(
        (u) =>
          `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod>` +
          u.alternates
            .map((a) => `<xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
            .join('') +
          `</url>\n`,
      )
      .join('') +
    `\n</urlset>\n`;
  writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf8');

  const robots = `User-agent: *\n` + `Allow: /\n` + `Sitemap: ${BASE_URL}/sitemap.xml\n`;
  writeFileSync(join(DIST, 'robots.txt'), robots, 'utf8');

  console.log(
    `[seo] Wrote ${pageEntries.length} URLs across ${LOCALE_CODES.length} locales, plus ${staticPages.length} static page`,
  );
  console.log('[seo] Wrote dist/sitemap.xml (with hreflang alternates) and dist/robots.txt');
}

main();
