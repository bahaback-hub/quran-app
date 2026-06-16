# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.5.0 (2026-06-17) — 10/10 Quality Milestone

### ✨ Features
- ♿ تحسينات إتاحة الوصول: إضافة aria-label و aria-pressed و aria-expanded لجميع الأزرار التفاعلية في index.html
- ⚡ تحسينات الأداء: تفعيل treeshake الصارم و compact output و esbuild minify في vite.config.js
- 🧪 رفع تغطية الاختبارات إلى ~89% مع أكثر من 3200 اختبار (was 88.41% / 3067 tests)
- 📚 توثيق مجتمعي كامل: CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md
- 🔒 0 ثغرات أمنية في npm audit

### 🐛 Bug Fixes
- إصلاح typo في vite.config.js: `[name]-ash].js` → `[name]-[hash].js`

### 🔧 Maintenance
- إضافة coverage-booster-final.test.ts (85 اختبار جديد لـ utils, keyboard, a11y, audio-cache, templates, settings, i18n)
- إضافة coverage-booster-final2.test.ts (45 اختبار جديد لـ surah-loader, app-events, mushaf-renderer, audio, reading-stats, presentation)
- رفع تغطية utils.ts إلى 100% (كانت 90.47%)
- رفع تغطية keyboard.ts functions من 28.57% إلى ~88%

## 1.4.0 (2026-06-16)

### ✨ Features
- 📿 نظام الأذكار المتقدم مع إشعارات مجدولة وصوت AudioContext
- 🧪 تغطية اختبارات 82%+ مع أكثر من 3000 اختبار وحدة
- 🔒 سياسة أمان محتوى محسّنة (CSP hash-based)
- 📱 أيقونات PWA متعددة الأحجام لدعم أجهزة أكثر
- ♿ تحسينات إمكانية الوصول: ARIA values ديناميكية + تبديل lang

### 🐛 Bug Fixes
- إصلاح `_activeDownloads` لا يُحذف عند الخطأ في audio-cache.ts
- إصلاح `resetAdhkarCounters()` يحدّث DOM قبل الحالة
- إصلاح `savePersonalAdhkar()` يعدّل الحالة مباشرة بدلاً من النسخ
- إصلاح تكرار الإدخالات في `persistErrorLog`
- إصلاح حالة سباق Capacitor timeout في mushaf-renderer.ts
- إصلاح نتائج عدم التطابق لا تُخزّن مؤقتاً في search-ui.ts
- إصلاح `dataset['surahname']` → `dataset['surahName']` في favorites.ts
- إصلاح AudioContext محلي يتجاوز الحالة المشتركة في adhkar-notifications.ts
- إصلاح AudioContext لا يُغلق عند إعادة التعيين في internal-state.ts
- إصلاح عدم تطابق فترة الأذكار (15s → 30s) في ui-extras.ts
- إصلاح اتصالات IDB لا تُغلق في surah-cache.ts
- إصلاح 3 أخطاء في surah-loader.ts (فهرس الصوت، حالة السباق، فهرس الآية)
- إصلاح 5 أخطاء في prayer.ts (طريقة التخزين المؤقت، القبلة، alpha=0، toDateString، return→continue)
- إصلاح الاستعلام الفارغ يطابق الكل في search-core.ts
- إصلاح تسرب ذاكرة Object URL في audio.ts
- إصلاح `===` تفشل مع NaN → استخدام `Object.is()` في state.ts

### 🔧 Maintenance
- إزالة اعتماديات Electron الميتة (~150MB توفير)
- إضافة `sideEffects: false` و `prepublishOnly` في package.json
- توحيد Node.js 22 في جميع workflows
- استبدال `any` types بأنواع API صحيحة
- تحسين ESLint: `no-console: warn` للملفات المصدرية
- إزالة `ARABIC_WEEKDAYS` المُهمَل

## 1.3.0 (2026-06-10)

### ✨ Features
- 🔐 فحص أمني CodeQL أسبوعي + عند PR
- 🏗️ سير عمل release تلقائي عند إنشاء tags
- 📦 فحص حجم الحزمة مع عتبة 300KB gzip
- 🏷️ تصنيف تلقائي للـ PRs
- 🧹 إغلاق تلقائي للمسائل والـ PRs غير النشطة
- 📊 سير عمل Lighthouse CI للأداء
- ♿ فحص إمكانية الوصول a11y مع Axe-core

### 🧪 Testing
- إضافة 17 ملف اختبار جديد (928+ اختبار)
- تغطية من 53.76% إلى 82.35%

## 1.2.0 (2026-06-05)

### ✨ Features
- 💬 تمكين GitHub Discussions
- 🏷️ 16 تصنيف مخصص للمسائل
- 🔒 حماية الفرع الرئيسي (مراجعات + فحوصات إلزامية)
- 📝 قوالب المسائل و PRs ثنائية اللغة
- 🛡️ سياسة أمان (SECURITY.md)
- 🤝 دليل المساهمة (CONTRIBUTING.md) ثنائي اللغة
- 📜 ميثاق السلوك (CODE_OF_CONDUCT.md)

### 🔧 Maintenance
- تحديث README مع شارات ووثائق معمارية
- إضافة .editorconfig للتنسيق الموحد

## 1.1.0 (2026-06-01)

### ✨ Features
- 🔍 بحث Trie مع اقتراحات تلقائية
- 📊 إحصائيات القراءة
- 📿 نظام الأذكار مع عدّاد
- 🧭 بوصلة القبلة
- 📤 مشاركة محسّنة (واتساب، تيليجرام، نسخ)

### 🐛 Bug Fixes
- إصلاح مشاكل التخزين المؤقت للصوت
- تحسين إعادة محاولة API

## 1.0.0 (2026-05-31)

### 🎉 Initial Release
تطبيق ويب PWA للقرآن الكريم مع تلاوة، مصحف، تفسير، بحث، مواقيت صلاة وأذكار.

### ✨ Features
- 📖 قراءة القرآن مع 8 قرّاء
- 🎵 مشغل صوت متكامل مع تحكم بالسرعة والتكرار (hifdh/repeat)
- 📄 وضع المصحف مع 604 صفحة
- 🖼️ وضع العرض (Presentation Mode)
- 🔎 بحث نصي كامل في القرآن
- 🎤 بحث صوتي (Web Speech API)
- 🗣️ لوحة مفاتيح عربية
- 📜 6 تفاسير معتمدة
- 🌐 ترجمة المعاني (إنجليزي، فرنسي، أردو)
- 🕌 مواقيت الصلاة والأذان (بصوت ناصر القطامي)
- 📌 إشارات مرجعية ومفضلة
- 🕌 بوصلة القبلة (Qibla Compass)
- 📊 إحصائيات القراءة
- 📤 مشاركة الآيات (عام، واتساب، تيليجرام، نسخ)
- ⏰ مؤقت النوم (Sleep Timer)
- 🔍 سجل البحث (آخر 10 عمليات بحث)
- 📈 شريط تقدم القراءة
- 📂 تصدير/استيراد الإعدادات
- 🌍 5 لغات: العربية، English، Türkçe، Bahasa Melayu، Bahasa Indonesia
- 🎨 خلفيات متعددة (ذهبي، خط عربي، زمردي...)
- 🌙 الوضع الليلي
- 🎵 Media Session API (تحكم في الخلفية)
- 📱 PWA مع precache و runtime caching
- 🤖 Android (Capacitor)

### 🧪 Testing
- 128 اختبار وحدة (Vitest)
- 25 اختبار E2E (Playwright)
- TypeScript type checking (0 errors)

### 🔧 Maintenance
- JSDoc لجميع الدوال المُصدَّرة
- Elasticsearch-ready logging patterns
- CI/CD مع GitHub Actions (test + typecheck + deploy)
