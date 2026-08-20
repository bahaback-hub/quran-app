# NOTICE — Third-Party Data Sources & Libraries

This file documents third-party data sources, APIs, and libraries used by
`quran-app`. The MIT license of this project covers **only the source code
in this repository** — it does NOT cover the external Quran data, tafsir
text, audio recitations, or prayer-times data fetched at runtime.

## Quran Text & Metadata

| Source | URL | License / Terms |
|--------|-----|-----------------|
| **AlQuran.cloud** | https://alquran.cloud | Open data — Quran text (Uthmani, Simple), translations, surah metadata. See https://alquran.cloud/for-developers |
| **Tafsir API** (spa5k/tafsir_api) | https://github.com/spa5k/tafsir_api | MIT — 6 tafsirs (Muyassar, Ibn Kathir, Tabari, Saadi, Baghawi, Qurtubi) |
| **QCF V4 Fonts & Layout** | https://github.com/quran-com/quran-utility | Quran.com fork of QCF v4 — fonts and page layout JSON for 604-page mushaf rendering |

## Audio Recitations

| Source | URL | License / Terms |
|--------|-----|-----------------|
| **mp3quran.net** | https://mp3quran.net | Free for personal/Islamic use — full-surah MP3 recitations for 30+ reciters. See https://mp3quran.net/eng/api |
| **quran.com API** | https://quran.com | Open data — per-ayah audio with word-level timings for synchronized highlighting |

## Prayer Times

| Source | URL | License / Terms |
|--------|-----|-----------------|
| **Aladhan API** | https://aladhan.com | Open data — prayer times by city/coordinates |
| **adhan npm library** | https://github.com/batoulapps/adhan-js | MIT — local prayer-time calculations (offline fallback) |

## Fonts (Bundled)

| Font | Source | License |
|------|--------|---------|
| Amiri | https://github.com/aliftype/amiri | OFL 1.1 (SIL Open Font License) |
| Scheherazade New | https://github.com/silnrsi/font-scheherazade | OFL 1.1 |
| Reem Kufi | https://github.com/aliftype/reem-kufi | OFL 1.1 |
| Noto Sans / Noto Sans SC | https://fonts.google.com | OFL 1.1 |
| KFGQPC HAFS Uthmanic Script 2.2 | https://fonts.qurancomplex.gov.sa/hafs-reading/ | © King Fahd Glorious Quran Printing Complex. The official usage notice permits free copying, distribution, and personal/commercial use in applications and websites worldwide, provided the font is attributed to the Complex and is not modified, reprogrammed, or sold. The bundled TTF is shipped unchanged. |

## JavaScript Libraries (npm dependencies)

| Library | License |
|---------|---------|
| `@capacitor/*` (core, android, cli, splash-screen, status-bar) | MIT |
| `adhan` | MIT |

All devDependencies (Vite, Vitest, Playwright, ESLint, Prettier, TypeScript,
TypeDoc, vite-plugin-pwa, lightningcss, fake-indexeddb, jsdom, serve) are
MIT-licensed.

## Attribution

The quran-app project is grateful to the maintainers of the above data
sources and libraries. Without their generous open offerings, this project
would not be possible. ما شاء الله.

## Disclaimer

- Quranic text and tafsir content are fetched from external APIs at runtime
  and cached locally for offline use. The project maintainers are not
  responsible for the accuracy of the external data.
- For religious rulings (fatwa), please consult a qualified scholar — this
  app is a reading/listening/study aid, not a religious authority.
