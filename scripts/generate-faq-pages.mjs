/**
 * FAQ pre-render — generate the static /faq/ pages.
 *
 * Alongside the surah pages this emits one FAQ page per locale, carrying
 * FAQPage structured data and the same reciprocal hreflang set.
 *
 * Honest note on the structured data: Google restricted FAQ rich results in
 * August 2023 to authoritative government and health sites, so a Quran app will
 * not get the expandable question-and-answer block in its search results. The
 * markup is still worth publishing - it describes the page unambiguously to
 * search crawlers and to AI answer engines, and the guide's AI-optimisation
 * section is explicit that clear question-and-answer passages are what those
 * systems quote. The prose is the reason to do this, not the badge.
 *
 * The answers live in scripts/seo-faq.<locale>.json, not in this file: a build
 * script has no business carrying the text it only prints, and an ad-hoc edit of
 * one that did re-encoded its Arabic as Windows-1252 and nothing caught it.
 *
 * Usage: npm run build:faq   (run after `npm run build`, like build:seo)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const BASE_URL = 'https://bahaback-hub.github.io/quran-app';
const LOCALES = ['ar', 'en'];

const LOCALE_META = {
  ar: { lang: 'ar', dir: 'rtl', prefix: '', ui: 'ar' },
  en: { lang: 'en', dir: 'ltr', prefix: '/en', ui: 'en' },
};

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The app root, relative to the FAQ page's own directory. The Arabic page lives
 * at /faq/ and the English one at /en/faq/, so the English page needs one more
 * level. Looking the prefix up rather than testing membership in the list is the
 * point: an earlier version returned the Arabic depth for every locale, and the
 * English page's links pointed above the app at the site root.
 */
function appDepth(localeCode) {
  return LOCALE_META[localeCode].prefix ? '../..' : '..';
}

function selfUrl(localeCode) {
  return `${BASE_URL}${LOCALE_META[localeCode].prefix}/faq/`;
}

function buildPage(localeCode) {
  const meta = LOCALE_META[localeCode];
  const copy = readJson(join(ROOT, 'scripts', `seo-faq.${localeCode}.json`));
  const app = `${appDepth(localeCode)}/index.html`;
  const index = `${appDepth(localeCode)}/quran/`;

  const title = `${copy.title} | Al-Mushaf As-Sulaymani`;
  const description = copy.intro;

  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'FAQPage',
          url: selfUrl(localeCode),
          inLanguage: meta.lang,
          isPartOf: { '@type': 'WebApplication', name: 'Al-Mushaf As-Sulaymani', url: BASE_URL },
          mainEntity: copy.questions.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Al-Mushaf As-Sulaymani',
              item: new URL(app, 'https://x.invalid/').href,
            },
            { '@type': 'ListItem', position: 2, name: copy.title },
          ],
        },
      ],
    },
    null,
    0,
  );

  const alternates = LOCALES.map(
    (c) => `    <link rel="alternate" hreflang="${LOCALE_META[c].lang}" href="${selfUrl(c)}" />`,
  ).join('\n');

  const langBar = LOCALES.map((c) => {
    const cur = c === localeCode;
    return `      <a href="${c === localeCode ? './' : `../${c}/faq/`}"${cur ? ' aria-current="true"' : ''} hreflang="${LOCALE_META[c].lang}">${c.toUpperCase()}</a>`;
  }).join('\n');

  const items = copy.questions
    .map(
      (item) => `      <section class="faq-item">
        <h2 id="q${copy.questions.indexOf(item) + 1}">${escapeHtml(item.q)}</h2>
        <p>${escapeHtml(item.a)}</p>
      </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="${meta.lang}" dir="${meta.dir}">
  <head>
    <meta charset="UTF-8" />
    <script type="application/ld+json">
${jsonLd}
    </script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${selfUrl(localeCode)}" />
    <link rel="sitemap" type="application/xml" href="${BASE_URL}/sitemap.xml" />
${alternates}
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${selfUrl(localeCode)}" />
    <meta property="og:image" content="${BASE_URL}/icon-512.png" />
    <meta property="og:locale" content="${meta.lang === 'ar' ? 'ar_SA' : 'en_US'}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${BASE_URL}/icon-512.png" />
    <meta name="robots" content="index,follow" />
    <style>
      body { margin: 0; background: #faf5f2; color: #2b1a12; font-family: "Amiri", "Scheherazade New", "Traditional Arabic", serif; line-height: 1.9; }
      .wrap { max-width: 760px; margin: 0 auto; padding: 24px 16px 56px; }
      .langbar { display: flex; gap: 8px; margin: 0 0 18px; font-size: 15px; }
      .langbar a { background: #f1e6dd; color: #5c2e2e; text-decoration: none; padding: 5px 12px; border-radius: 999px; }
      .langbar a[aria-current="true"] { background: #5c2e2e; color: #fff; }
      .head { text-align: center; border-bottom: 1px solid #e4d8cf; padding-bottom: 20px; margin-bottom: 26px; }
      .head h1 { font-size: 29px; margin: 0 0 8px; color: #5c2e2e; }
      .sub { margin: 0 0 8px; color: #8a6a55; font-size: 16px; }
      .faq-item { border-bottom: 1px solid #f0e6dd; padding: 4px 0 18px; }
      .faq-item h2 { font-size: 21px; color: #5c2e2e; margin: 0 0 8px; }
      .faq-item p { margin: 0; font-size: 17px; }
      .links { text-align: center; margin-top: 30px; font-size: 16px; }
      .links a { color: #5c2e2e; }
      @media (max-width: 480px) { .head h1 { font-size: 24px; } .faq-item h2 { font-size: 19px; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <nav class="langbar" aria-label="Language">
${langBar}
      </nav>
      <header class="head">
        <h1>${escapeHtml(copy.title)}</h1>
        <p class="sub">${escapeHtml(copy.subtitle)}</p>
        <p>${escapeHtml(copy.intro)}</p>
      </header>
${items}
      <nav class="links">
        <a href="${app}">Al-Mushaf As-Sulaymani</a> &middot;
        <a href="${index}">${localeCode === 'ar' ? 'فهرس السور' : 'All surahs'}</a>
      </nav>
    </div>
  </body>
</html>
`;
}

function main() {
  const urls = [];
  for (const localeCode of LOCALES) {
    const meta = LOCALE_META[localeCode];
    const dir = join(DIST, meta.prefix, 'faq');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), buildPage(localeCode), 'utf8');
    urls.push(selfUrl(localeCode));
    console.log(`[faq] ${localeCode} -> dist${meta.prefix}/faq/`);
  }
  console.log(`[faq] Wrote ${urls.length} FAQ pages`);
  console.log(JSON.stringify(urls));
}

main();
