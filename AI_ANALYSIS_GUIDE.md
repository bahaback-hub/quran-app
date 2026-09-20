# Quran App — AI & Human Reviewer Guide
# دليل مراجعة الذكاء الاصطناعي والم human — تطبيق القرآن الكريم

> **For AI reviewers, engineers, and contributors:**
> This guide summarises what to inspect, what is verifiable offline, and known limitations — in **English first, then Arabic**.
>
> **للمراجِعين والمهندسين ومساعدي الذكاء الاصطناعي:**
> يلخّص هذا الدليل ما يجب فحصه، وما يمكن التحقّق منه دون اتصال، والقيود المعروفة — **بالإنجليزية أولاً ثم العربية**.

---

## 1. What this project is / ما هو هذا المشروع

### English

**Quran App** (bahaback-hub/quran-app, also known as «المصحف السليماني») is a **Progressive Web App (PWA)** for reading, listening, searching, tafsir, adhkar, prayer times, qibla direction, hifdh room, ayah presentation/share, and reading statistics — and it also runs on **Android** via Capacitor 8.

- **Web**: TypeScript + Vite + pure DOM (no React/Vue/Angular)
- **Android**: Capacitor 8 wraps the same web app into a native APK (currently Debug-signed only)
- **Offline**: Optional download of Quran text, translations, tajweed, and selected audio via IndexedDB
- **Backend APIs**: AlQuran.cloud (text/audio), Aladhan (prayer times), mp3quran.net (full surah audio), quran.com (word-by-word timing), Tafsir API (tafsir), Google Fonts (Amiri, Scheherazade New, Reem Kufi)

It is **free, open-source (MIT)**, ad-free, and does not track users.

### العربية

**تطبيق القرآن الكريم** (المستودع bahaback-hub/quran-app، المعروف أيضًا باسم «المصحف السليماني») هو **تطبيق ويب تقدمي (PWA)** للقراءة والاستماع والبحث والتفسير والأذكار ومواقيت الصلاة واتجاه القبلة وغرفة الحفظ والعرض ومشاركة الآيات وإحصاءات القراءة — وهو يعمل أيضًا على **أندرويد** عبر Capacitor 8.

- **الويب**: TypeScript + Vite + DOM مباشر (بدون React أو Vue أو Angular)
- **أندرويد**: Capacitor 8 يغلف نفس تطبيق الويب في APK أصلي (حاليًا موقّع بـ Debug فقط)
- **دون اتصال**: تنزيل اختياري لنص القرآن والترجمات والتجويد والصوت المختار عبر IndexedDB
- **واجهات البرامج الخلفية**: AlQuran.cloud (النص/الصوت)، Aladhan (مواقيت الصلاة)، mp3quran.net (الصوت الكامل للسورة)، quran.com (توقيت كلمة بكلمة)، Tafsir API (التفسير)، Google Fonts (Amiri، Scheherazade New، Reem Kufi)

هو **مجاني ومفتوح المصدر (MIT)**، بلا إعلانات، ولا يتتبّع المستخدمين.

---

## 2. Facts you can verify / حقائق يمكنك التحقّق منها

### 2.1 — Offline support / دعم العمل دون اتصال

**EN**: The app supports offline reading and listening via three IndexedDB databases:

- `QuranAppDB` — Quran text, translations, tajweed data, surah metadata, offline pack manifests
- `QuranAudioCacheDB` — downloaded surah audio (LRU eviction, 200 MB cap)
- `QuranTafsirDB` — cached tafsir text

On startup the app runs `restoreSettings()` in `src/settings.ts`, which re-applies the last saved theme, font size, reciter, tafsir edition, and other preferences from `localStorage`. The **theme trigger icon** (the emoji on the theme button) is synced via `updateThemeTriggerIcon()` called from `restoreSettings()`, `applyNightMode()`, `applySepiaMode()`, `applyDeepNightMode()`, and after any click-based theme change.

**AR**: يدعم التطبيق القراءة والاستماع دون اتصال عبر ثلاثة قواعد بيانات IndexedDB:

- `QuranAppDB` — نص القرآن، الترجمات، بيانات التجويد، معلومات السور، وطوابع الحزمة غير المتصلة
- `QuranAudioCacheDB` — صوت السور المنزّل (إخلاء LRU، حد 200 ميجابايت)
- `QuranTafsirDB` — نص التفسير المُخزّن مؤقتًا

عند بدء التشغيل، يستدعي التطبيق `restoreSettings()` في `src/settings.ts`، التي تُعيد تطبيق آخر ثيم وحجم خط وقارئ وتفسير وغيرها من الإعدادات المحفوظة من `localStorage`. رمز أيقونة تبديل الثيم (الإيموجي على زر الثيم) يُزامن عبر `updateThemeTriggerIcon()` المستدعى من `restoreSettings()` و `applyNightMode()` و `applySepiaMode()` و `applyDeepNightMode()` وبعد أي تغيير للثيم بالضغط.

### 2.2 — Security and input handling / الأمان ومعالجة الإدخال

**EN**:

- **Content Security Policy** is declared in `index.html` as a `<meta>` tag; it restricts scripts, styles, fonts, images, media, and connections to allowed origins only.
- **XSS prevention**: All dynamic HTML is built through `escapeHtml()` (imported from `src/templates/escape.ts`) before being inserted into the DOM.
- **Settings import validation**: `src/settings.ts` + `src/schemas.ts` + `src/schemas-validate.ts` validate imported settings JSON against a schema (structure, time/period values) before applying.
- **Adhkar import validation**: `src/adhkar.ts` validates imported adhkar entries (structure, time value, duration).
- **Referrer Policy**: `strict-origin-when-cross-origin`
- **X-Content-Type-Options**: `nosniff`

**AR**:

- **سياسة أمان المحتوى (CSP)** مُعلنة في `index.html` كوسم `<meta>`؛ وهي تقيد النصوص والأنماط والخطوط والصور والوسائط والاتصالات بمصادر مسموحة فقط.
- **منع XSS**: كل HTML ديناميكي يُبنى عبر `escapeHtml()` (مستورد من `src/templates/escape.ts`) قبل إدراجه في DOM.
- **التحقق من استيراد الإعدادات**: `src/settings.ts` + `src/schemas.ts` + `src/schemas-validate.ts` تتحقّق من بنية JSON المستوردзначение하키 구조، وقيم الوقت والمدة) قبل تطبيقه.
- **التحقق من استيراد الأذكار**: `src/adhkar.ts` يتحقّق من إدخالات الأذكار المستوردة (البنية، قيمة الوقت، المدة).
- **سياسة Referrer**: `strict-origin-when-cross-origin`
- **X-Content-Type-Options**: `nosniff`

### 2.3 — Ayah sharing and presentation mode / مشاركة الآية ووضع العرض

**EN**:

- The presentation mode (`src/presentation.ts`) shows one ayah on a full-screen background (static image, animated Canvas, or local video).
- **Ayah image export**: Generates a wide PNG containing the ayah, source reference, and «المصحف السليماني» signature — no extra frame, and all background assets are inside the repository.
- **Ayah video export**: Creates a local WebM video using Canvas + MediaRecorder with the user's chosen background animation and Mishary Alafasy audio **only** if that reciter is selected. The video is generated entirely on the device — **no upload to any server**.
- **Mobile sharing**: Uses Capacitor Share on Android and Web Share API on the web; falls back to copying the text if sharing is unavailable.
- **HD original**: The app offers to save the original HD version before sending, because WhatsApp and other apps may re-compress after sending.

**AR**:

- وضع العرض (`src/presentation.ts`) يعرض آية واحدة على خلفية ملمئة الشاشة (صورة ثابتة، أو Canvas متحرك، أو فيديو محلي).
- **تصدير صورة الآية**: يولّد صورة PNG عريضة تحتوي على الآية ومرجع المصدر وتوقيع «المصحف السليماني» — بلا إطار زائد، وجميع مصادر الخلفية داخل المستودع.
- **تصدير فيديو الآية**: يولّد فيديو WebM محليًا باستخدام Canvas + MediaRecorder مع خلفية الحركة المختارة وصوت مشاري العفاسي **فقط** إذا كان هذا القارئ مُحدّدًا. الفيديو يُصنع بالكامل على الجهاز — **لا يُرفع إلى أي خادم**.
- **مشاركة الهاتف**: يستخدم Capacitor Share على أندرويد و Web Share API على الويب؛ ويؤول إلى نسخ النص إذا تعذّر المشاركة.
- **النسخة HD الأصلية**: يقدّم التطبيق حفظ النسخة الأصلية قبل الإرسال، لأن واتساب والتطبيقات الأخرى قد تعيد ضغط الملف بعد الإرسال.

---

## 3. Commands to run / الأوامر التي يجب تشغيلها

**EN**: Run these from the repository root. All commands use `pnpm` in the project, but `npm` equivalents are noted.

**AR**: شغّل هذه الأوامر من جذر المستودع. جميع الأوامر تستخدم `pnpm` في المشروع، لكن ما يلي يذكر البدائل بـ `npm`.

```bash
# Code quality / جودة الكود
pnpm run lint            # ESLint
pnpm run lint:fix        # ESLint auto-fix
pnpm run format          # Prettier format
pnpm run format:check    # Prettier check
pnpm run typecheck       # TypeScript strict type-check (tsc --noEmit -p tsconfig.ci.json)

# Tests / الاختبارات
pnpm vitest run --silent=true --maxWorkers=1   # full unit test suite, single worker
pnpm vitest run --coverage                      # with coverage report
pnpm run test:e2e                 # Playwright E2E (chromium by default)
pnpm run test:e2e --project=firefox           # Firefox E2E
pnpm run test:e2e --project=webkit           # WebKit E2E
pnpm run test:e2e --project=mobile-chrome    # mobile-chrome E2E
pnpm run test:a11y              # axe-core accessibility audit (builds + serves + scans)

# Build / البناء
pnpm run build            # Vite production build (output in dist/)
pnpm run preview          # preview the production build locally
pnpm run dev             # Vite dev server (for manual inspection)

# Security & dependencies / الأمان والتبعيات
pnpm audit --prod        # known vulnerabilities in production deps
pnpm audit --dev         # known vulnerabilities in dev deps
npm audit --omit=dev     # same, npm-based
npm ci --ignore-scripts --dry-run   # validate lockfile + install plan

# Documentation / التوثيق
pnpm run docs            # TypeDoc → deployed to /api/ on GitHub Pages

# Android (optional) / أندرويد (اختياري)
pnpm run android:build   # web build + Capacitor sync
pnpm run android:open     # open in Android Studio
pnpm run android:run      # build, sync, run on connected device
```

---

## 4. Known limitations / القيود المعروفة

**EN**:

1. **APK is Debug-signed only**: The published APK is for field testing, not for public distribution. A Release-signed APK is planned for a future public release.
2. **Qibla accuracy on the web**: Relies on the best device orientation data available in the browser. Some phones need compass calibration; accurate magnetic declination is not always available inside the browser.
3. **Prayer times source**: Uses the Aladhan API by default. The README mentions KACST as an alternative for 100% match with ummulqura.org.sa — but the current code uses Aladhan. Method=4 / Umm Al-Qura is close but not exact.
4. **Video export reciter restriction**: Ayah video export only works with Mishary Alafasy audio — because the pipeline depends on that reciter's timing and audio availability. Other reciters are not supported for video export in the current version.
5. **QCF4 font packaging**: The official QCF V4 font pack for Mushaf mode is bundled locally, but the font files remain outside the main application bundle until written distribution permission is obtained from the King Fahd Complex. This is intentional.
6. **jsdom test limitations**: Unit tests use jsdom, which cannot exercise Canvas, AudioContext, ServiceWorker, DeviceOrientation, or MediaSession fully. E2E (Playwright) supplements these.
7. **iOS**: The app works on iOS as a web app in the browser, but there is no native iOS app in the App Store yet.

**AR**:

1. **APK موقّعة بـ Debug فقط**: النسخة المنشورة للتجربة الميدانية، وليست للنشر العام. نسخة Release موقّعة مُخطَّط لها لإصدار عام قادم.
2. **دقة القبلة على الويب**: تعتمد على أفضل بيانات اتجاه متاحة في المتصفح. بعض الهواتف تحتاج معايرة البوصلة؛ والانحراف المغناطيسي الدقيق غير متاح دائمًا داخل المتصفح.
3. **مصدر مواقيت الصلاة**: يستخدم واجهة Aladhan افتراضيًا. يشير README إلى KACST كبديل لتطابق 100% مع ummulqura.org.sa — لكن الكود الحالي يستخدم Aladhan. الطريقة 4 / أم القرى قريبة لكنها ليست دقيقة بنسبة 100%.
4. **قيد قارئ الفيديو**: تصدير فيديو الآية يعمل فقط مع صوت مشاري العفاسي — لأن خط الإنتاج يعتمد على توقيت هذا القارئ وتوافره. القارئون الآخرون غير مدعومين لتصدير الفيديو في النسخة الحالية.
5. **تغليف خط QCF4**: حزمة الخط الرسمي QCF V4 لوضع المصحف مُجمّعة محليًا، لكن ملفات الخط تبقى خارج الحزمة الرئيسية للتطبيق حتى الحصول على إذن توزيع مكتوب من مجمع الملك فهد لطباعة المصحف الشريف. هذا متعمد.
6. **قيود اختبارات jsdom**: الاختبارات الوحدية تستخدم jsdom، الذي لا يستطيعامل Exercise Canvas و AudioContext و ServiceWorker و DeviceOrientation و MediaSession بالكامل. E2E (Playwright) يُكمّل هذه المناطق.
7. **iOS**: يعمل التطبيق على iOS كتطبيق ويب في المتصفح، لكن لا توجد نسخة أصيلة في App Store بعد.

---

## 5. Points not to confuse / نقاط لا تخلط بينها

**EN**:

| Topic | Correct understanding |
|---|---|
| Published APK | **Debug** build for field testing, not a Release build for public distribution |
| Qibla accuracy on web | Uses best available device data; may need calibration on some phones; not a bug |
| Video exports | User-created videos are generated locally on the device and not uploaded anywhere |
| Test counts | The number of tests changes with each commit; always run `pnpm vitest run --silent=true --maxWorkers=1` instead of relying on a number from an older report |
| Offline text fallback | `public/data/quran-uthmani.json` (1.7 MB) works fully offline after first download |
| Theme trigger icon | The emoji on the theme button updates via `updateThemeTriggerIcon()` — called from restore, night/sepia/deep-night toggles, and after every click-based theme change |

**AR**:

| الموضوع | الفهم الصحيح |
|---|---|
| APK المنشور | بناء **Debug** للتجربة الميدانية، وليست بناء Release للنشر العام |
| دقة القبلة على الويب | تستخدم أفضل البيانات المتاحة من الجهاز؛ قد تحتاج معايرة على بعض الهواتف؛ ليست عطلًا |
| تصدير الفيديو | الفيديوهات التي ينشئها المستخدم تُصنع محليًا على الجهاز ولا تُرفع إلى أي مكان |
| أعداد الاختبارات | عدد الاختبارات يتغيّر مع كل commit؛ شغّل دائمًا `pnpm vitest run --silent=true --maxWorkers=1` بدلًا من الاعتماد على رقم من تقرير أقدم |
| النص الاحتياطي دون اتصال | `public/data/quran-uthmani.json` (1.7 ميجابايت) يعمل دون اتصال بالكامل بعد التحميل الأول |
| أيقونة زر الثيم | الإيموجي على زر الثيم يُحدَّث عبر `updateThemeTriggerIcon()` — يُستدعى من الاستعادة، وتبديلات الليل/السيبيا/الليلي القاتم، وبعد كل تغيير للثيم بالضغط |

---

## 6. How to report an observation / كيفية الإبلاغ عن ملاحظة

**EN**: For every observation, please mention:

1. The commit or branch you inspected (always inspect `main` first)
2. The exact file, line or function
3. Exact steps to reproduce
4. Expected behaviour
5. Actual behaviour

Do **not** count the Debug APK or browser compass behaviour as a web-app bug — mention them as scope limits or separate release tasks.

**AR**: لكل ملاحظة، يرجى ذكر:

1. الـ commit أو الفرع الذي فُحص (دائمًا فحص `main` أولاً)
2. الملف والسطر أو الدالة بالضبط
3. الخطوات الدقيقة لإعادة الإنتاج
4. السلوك المتوقّع
5. السلوك الفعلي

لا تحسب **نظام APK Debug** أو سلوك البوصلة في المتصفح كعطل في تطبيق الويب — اذكرهما كحدود نطاق أو مهام إصدار مستقلة.

---

## 7. Quick reference for AI reviewers / مرجع سريع لمراجعي الذكاء الاصطناعي

### Entry points / نقاط الدخول

| English | العربية | File |
|---|---|---|
| App bootstrap (3-phase) | bootstrapping التطبيق (3 مراحل) | `src/app.ts` |
| Event bindings | ربط الأحداث | `src/app-events.ts` |
| DOM cache | ذاكرة DOM المخبّأة | `src/dom.ts` |
| Settings + themes | الإعدادات والثيمات | `src/settings.ts` |
| Reactive state | الحالة التفاعلية | `src/state.ts` |
| Audio player | مشغل الصوت | `src/audio.ts` |
| Surah loading | تحميل السور | `src/surah-loader.ts` |
| Offline pack | الحزمة دون اتصال | `src/offline-pack.ts` |
| Audio cache | ذاكرة الصوت | `src/audio-cache.ts` |
| Hifdh room | غرفة الحفظ | `src/hifz-room.ts` |
| Presentation + share | العرض ومشاركة الآية | `src/presentation.ts` + `src/presentation-share.ts` |
| Local video export | تصدير الفيديو المحلي | `src/pres-video.ts` |
| Search engine | محرك البحث | `src/search-core.ts` |
| Tafsir | التفاسير | `src/tafsir.ts` |
| Prayer times + qibla | مواقيت الصلاة والقبلة | `src/prayer.ts` |
| Adhkar | الأذكار | `src/adhkar.ts` |

### Frameworks and tools / الأطر والأدوات

| English | العربية |
|---|---|
| Language: TypeScript 6.0 (strict) | اللغة: TypeScript 6.0 (صارم) |
| Build: Vite 8 + LightningCSS | البناء: Vite 8 + LightningCSS |
| PWA: vite-plugin-pwa (Workbox) | PWA: vite-plugin-pwa (Workbox) |
| Android: Capacitor 8 | أندرويد: Capacitor 8 |
| Tests: Vitest 4 + Playwright 1.60 | الاختبارات: Vitest 4 + Playwright 1.60 |
| Lint: ESLint 9 + typescript-eslint | الفحص: ESLint 9 + typescript-eslint |
| Format: Prettier 3 | التنسيق: Prettier 3 |
| State: custom Proxy (no framework) | الحالة: Proxy مخصص (بدون أطار) |
| Storage: localStorage + 3 IndexedDB DBs | التخزين: localStorage + 3 قواعد IndexedDB |
| CI: GitHub Actions (11 workflows) | CI: GitHub Actions (11 سير عمل) |
| Docs: TypeDoc → GitHub Pages /api/ | التوثيق: TypeDoc → GitHub Pages /api/ |

### Key directories / أهم المجلدات

```
quran-app/
├── src/
│   ├── app.ts                  # bootstrap
│   ├── app-events.ts           # event bindings
│   ├── settings.ts             # settings + themes (updateThemeTriggerIcon is here)
│   ├── dom.ts                  # DOM cache
│   ├── state.ts                # reactive state
│   ├── audio.ts                # audio player
│   ├── surah-loader.ts         # surah loading/rendering
│   ├── offline-pack.ts         # offline pack
│   ├── audio-cache.ts          # audio cache (IndexedDB + LRU)
│   ├── hifz-room.ts            # hifdh room
│   ├── presentation.ts         # presentation mode
│   ├── presentation-share.ts   # ayah share (image + video)
│   ├── pres-video.ts           # local video export
│   ├── search-core.ts          # search engine (Trie)
│   ├── search-ui.ts            # search UI
│   ├── tafsir.ts               # tafsirs (6 editions)
│   ├── prayer.ts               # prayer times + qibla
│   ├── adhkar.ts               # adhkar + notifications
│   ├── templates.ts            # XSS-safe HTML templates
│   ├── __tests__/              # Vitest unit tests
│   ├── css/                    # CSS (17 files)
│   ├── translations/           # i18n (ar, en, fr, de, ru, tr, ms, id)
│   └── ...
├── index.html                  # main page
├── styles.css                  # main CSS entry (imports normalised)
├── vite.config.js              # Vite + PWA config
├── playwright.config.js        # Playwright config
├── playwright.config.ts        # Playwright config (TypeScript)
├── tsconfig.json               # TypeScript strict config
├── eslint.config.js            # ESLint flat config
├── vitest.config.ts            # Vitest config
├── performance-budget.json     # Lighthouse performance budget
├── lighthouserc.json           # Lighthouse CI config
├── pnpm-lock.yaml              # pnpm lockfile
└── package.json                # project manifest
```

### Theme implementation details / تفاصيل تنفيذ الثيمات

**EN**: The current theme selector is a **single trigger button + dropdown** (not 4 separate visible buttons). Implementation:

- HTML: `index.html` — `<div class="theme-switcher theme-menu" id="themeToggle">` contains:
  - A trigger button `#themeMenuBtn` showing the current theme emoji + ▼ caret
  - A dropdown `#themeDropdownMenu` with 4 theme buttons (light, sepia, night, deep-night)
- CSS: `src/css/layout.css` — `.theme-dropdown-menu` is `position: absolute` and hidden by default; shown when `.theme-menu` has class `.open`
- TypeScript:
  - `src/app-events.ts` binds: trigger click (toggle open/close), trigger keydown (Enter/Space toggle, Escape close, ArrowUp/ArrowDown navigation), container click (apply theme from selected button), container keydown (Escape, ArrowUp/ArrowDown)
  - `src/settings.ts` exports `updateThemeTriggerIcon()` — reads current state (nightMode / sepiaMode / deepNightMode / body classes) and sets the emoji on `#themeIcon`
  - `updateThemeTriggerIcon()` is called from: `restoreSettings()`, `toggleNightMode()`, `applyNightMode()`, `applySepiaMode()`, `applyDeepNightMode()`, and after every theme click in `bindHeaderAndSettingsEvents()`
- DOM cache: `src/dom.ts` adds `themeMenuBtn`, `themeIcon`, `themeDropdownMenu` to the `DomMap`
- Tests: `src/__tests__/app-events.test.ts` includes 4 new tests for the dropdown (open/close with Enter, close with Escape, apply theme on click, icon update after theme change)

**AR**: محددات تبديل الثيم الحالية هي **زر تشغيل واحد + قائمة منسدلة** (ليس 4 أزرار ظاهرة منفصلة). التنفيذ:

- HTML: `index.html` — `<div class="theme-switcher theme-menu" id="themeToggle">` يحتوي على:
  - زر تشغيل `#themeMenuBtn` يظهر إيموجي الثيم الحالي + سهم ▼
  - قائمة منسدلة `#themeDropdownMenu` فيها 4 أزرار ثيم (light, sepia, night, deep-night)
- CSS: `src/css/layout.css` — `.theme-dropdown-menu` 위치 `position: absolute` ومخفي افتراضيًا؛ يظهر عندما يكون `.theme-menu` يحمل الفئة `.open`
- TypeScript:
  - `src/app-events.ts` يربط: نقر الزر المشغّل (تبديل مفتوح/مغلق)، keydown الزر المشغّل (Enter/Space تبديل، Escape إغلاق، ArrowUp/ArrowDown تنقّل)، نقر الحاوية (تطبيق الثيم من الزر المختار)، keydown الحاوية (Escape، ArrowUp/ArrowDown)
  - `src/settings.ts` يصدر `updateThemeTriggerIcon()` — يقرأ الحالة الحالية (nightMode / sepiaMode / deepNightMode / فئات body) ويعيّن الإيموجي على `#themeIcon`
  - `updateThemeTriggerIcon()` يُستدعى من: `restoreSettings()`، `toggleNightMode()`، `applyNightMode()`، `applySepiaMode()`، `applyDeepNightMode()`، وبعد كل نقر ثيم في `bindHeaderAndSettingsEvents()`
- الذاكرة المخبّأة DOM: `src/dom.ts` يضيف `themeMenuBtn` و `themeIcon` و `themeDropdownMenu` إلى `DomMap`
- الاختبارات: `src/__tests__/app-events.test.ts` يشمل 4 اختبارات جديدة للقائمة المنسدلة (فتح/إغلاق بـ Enter، إغلاق بـ Escape، تطبيق ثيم بالنقر، تحديث الأيقونة بعد تغيير الثيم)

---

## 8. Repository metadata / بيانات تعريف المستودع

| Field | Value |
|---|---|
| Repository | `bahaback-hub/quran-app` |
| Default branch | `main` |
| License | MIT |
| PWA URL | `https://bahaback-hub.github.io/quran-app/` |
| Android APK (latest) | `https://github.com/bahaback-hub/quran-app/releases/latest` |
| Language | Arabic (primary UI) + 7 additional languages |
| Data sources | AlQuran.cloud API, Tafsir API (spa5k/tafsir_api), Aladhan API, mp3quran.net, quran.com |

---

*Last updated: 2026-09-04 — with theme dropdown commit (f7ca8a1)*
*آخر تحديث: 2026-09-04 — مع commit قائمة الثيمات المنسدلة (f7ca8a1)*
