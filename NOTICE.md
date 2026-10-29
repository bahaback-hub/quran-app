# NOTICE — Third-Party Data Sources & Libraries

This file documents third-party data sources, APIs, and libraries used by
`quran-app`. The MIT license of this project covers **only the source code
in this repository** — it does NOT cover the external Quran data, tafsir
text, audio recitations, or prayer-times data fetched at runtime.

For a per-item status table, known gaps, and the remediation plan, see
[`LICENSES-REVIEW.md`](LICENSES-REVIEW.md).

## Quran Text & Metadata

| Source                            | URL                                        | License / Terms                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AlQuran.cloud**                 | https://alquran.cloud                      | Open data — Quran text (Uthmani, Simple), translations, surah metadata. See https://alquran.cloud/for-developers                                                                                                                                                                                                                                                 |
| **Tafsir API** (spa5k/tafsir_api) | https://github.com/spa5k/tafsir_api        | MIT — 5 tafsirs (Muyassar, Ibn Kathir, Tabari, Saadi, Baghawi)                                                                                                                                                                                                                                                                                                   |
| **Saheeh International (bundled)** | https://alquran.cloud/for-developers | English translation text (`public/data/translations/en.sahih.json`) fetched verbatim from the AlQuran.cloud open-data endpoint the app itself uses at runtime, and shipped so the English translation survives a total network outage. © Umm Muhammad, Emily Assami and Amatullah Bantley; kept here for free non-commercial dawah use with attribution — verify terms before any commercial redistribution. |
| **Pickthall / Yusuf Ali / Hamidullah / Jalandhry (bundled)** | https://alquran.cloud/for-developers | Same pattern as above: `public/data/translations/{edition}.json` fetched verbatim from AlQuran.cloud open data so every supported translation edition (English ×3, French, Urdu) survives a total network outage. Attributed to their translators in the app's translation credits — verify terms before any commercial redistribution. |
| **QCF V4 Layout Data**             | https://github.com/MohamadHajjRabee/quran-qcf4 | MIT © 2026 Mohamad Hajj Rabee — applies to the per-page layout JSON only (604 pages, pinned to commit `5130511`). The license text is bundled at `public/data/mushaf-pack/LICENSE-MIT-QCF4-DATA.txt`. |
| **QCF V4 Font Files**              | https://github.com/MohamadHajjRabee/quran-qcf4 | **Not MIT.** The upstream `LICENSE.md` states that the font files are not covered by the MIT license and that redistribution, modification, or commercial use requires explicit permission from the original rights holders. The glyphs derive from the Madinah Mushaf (1441 AH), calligraphy by Uthman Taha, produced by the King Fahd Glorious Quran Printing Complex (KFGQPC); the WOFF2 build is by Ahmad ElGharib. Open question and planned remediation are tracked in `LICENSES-REVIEW.md`. |

## Audio Recitations

| Source            | URL                  | License / Terms                                                                                               |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| **mp3quran.net**  | https://mp3quran.net | Free for personal/Islamic use — full-surah MP3 recitations for 30+ reciters. See https://mp3quran.net/eng/api |
| **quran.com API** | https://quran.com    | Open data — per-ayah audio with word-level timings for synchronized highlighting                              |

## Prayer Times

| Source                | URL                                    | License / Terms                                         |
| --------------------- | -------------------------------------- | ------------------------------------------------------- |
| **Aladhan API**       | https://aladhan.com                    | Open data — prayer times by city/coordinates            |
| **adhan npm library** | https://github.com/batoulapps/adhan-js | MIT — local prayer-time calculations (offline fallback) |

## Fonts (Bundled)

| Font                            | Source                                          | License                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amiri                           | https://github.com/aliftype/amiri               | OFL 1.1 (SIL Open Font License). License text: `public/fonts/OFL-Amiri.txt`                                                                                                                                                                                                                                     |
| Scheherazade New                | https://github.com/silnrsi/font-scheherazade    | OFL 1.1. License text: `public/fonts/OFL-Scheherazade.txt`. The upstream notice reserves the names "Scheherazade" and "SIL"; the bundled files are subsets, see `LICENSES-REVIEW.md`                                                                                                                            |
| KFGQPC HAFS Uthmanic Script 2.2 | https://fonts.qurancomplex.gov.sa/hafs-reading/ | © King Fahd Glorious Quran Printing Complex. The official usage notice permits free copying, distribution, and personal/commercial use in applications and websites worldwide, provided the font is attributed to the Complex and is not modified, reprogrammed, or sold. The bundled TTF is shipped unchanged. |

`Reem Kufi` is requested by the Mushaf renderer as the preferred Bismillah
family but is **not bundled**; when it is absent the renderer falls back to
Scheherazade New. The static landing preview (`public/landing-preview/`)
loads *Amiri* and *Noto Kufi Arabic* from Google Fonts at runtime; both are
OFL 1.1 and are not shipped in this repository.

## Bundled Media

| Asset                                                                       | Location              | Source / License                                                                                                                                     |
| --------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presentation & theme backgrounds (19 files: 4 MP4 videos, poster frames, screen backgrounds) | `public/backgrounds/` | Generated in-house with open-source AI image/video tools. No stock footage or third-party media is included, so no external attribution is required. |
| Brand logos, app icons and store screenshots | `public/brand/`, `public/screenshots/` | Produced in-house for this project. |
| Language flag icons (5 SVGs) | `public/flags/` | Simple national flag icons used in the language selector; the original source is not recorded. |

## Bundled Data

| Dataset | Location | Source / Terms |
| ------- | -------- | -------------- |
| Adhkar (50 supplications in 5 categories) | `src/data/adhkar.json` | Traditional supplications; every item carries its own reference to the Quran or a hadith collection (Bukhari, Muslim, Abu Dawud, Tirmidhi). |
| Surah summaries (114) | `src/data/surah-secrets.json` | Generated in-house with AI as educational summaries. Not reviewed by a scholar; the app always shows a disclaimer and the summaries make no legal or ruling claims. |

## JavaScript Libraries (npm dependencies)

| Library                                                        | License |
| -------------------------------------------------------------- | ------- |
| `@capacitor/*` (core, android, cli, splash-screen, status-bar) | MIT     |
| `adhan`                                                        | MIT     |

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
