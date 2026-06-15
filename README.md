<div align="center">

# 📖 القرآن الكريم

**تطبيق ويب احترافي للقرآن الكريم** — تلاوة، بحث، تفسير، مواقيت الصلاة، وأكثر

[![CI](https://github.com/bahaback-hub/quran-app/actions/workflows/ci.yml/badge.svg)](https://github.com/bahaback-hub/quran-app/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF.svg)](https://vitejs.dev/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-A022A0.svg)](https://web.dev/progressive-web-apps/)

[🌐 عرض مباشر](https://bahaback-hub.github.io/quran-app/) · [🐛 تقرير خطأ](https://github.com/bahaback-hub/quran-app/issues) · [💡 طلب ميزة](https://github.com/bahaback-hub/quran-app/issues)

</div>

---

## ✨ المميزات

| الميزة | الوصف |
|--------|-------|
| 📖 **تلاوة القرآن** | عرض نصي كامل مع 114 سورة، يدعم تشكيل التجويد |
| 🎧 **استماع صوتي** | أكثر من 30 قارئ مع تحميل تلقائي للآيات الصوتية |
| 🔍 **بحث متقدم** | بحث فوري في النص القرآني مع دعم العربية والتشكيل |
| 📜 **التفسير** | 6 تفاسير (الميسر، السعدي، ابن كثير، الطبري، البغوي، القرطبي) |
| 📄 **وضع المصحف** | عرض صفحات المصحف بنظام الخطوط العثمانية (QCF V4) |
| 🖼️ **وضع العرض** | عرض تقديمي للآيات مع خلفيات متعددة |
| 🕌 **مواقيت الصلاة** | أوقات الصلاة التلقائية مع تنبيه الأذان |
| 🧭 **اتجاه القبلة** | بوصلة القبلة التفاعلية |
| 📿 **الأذكار** | أذكار الصباح والمساء مع إشعارات تذكيرية |
| ⭐ **المفضلة** | حفظ الآيات المفضلة مع تصدير JSON/نص |
| 🔖 **العلامات المرجعية** | تحديد مواضع الوقوف |
| 📊 **إحصائيات القراءة** | متابعة تقدم القراءة اليومي |
| 🌙 **أنماط العرض** | نهاري، سيبيا، ليلي مع كشف تلقائي لنظام التشغيل |
| 🌐 **تعدد اللغات** | العربية، الإنجليزية، التركية، الملايو، الإندونيسية |
| 📱 **PWA** | قابل للتثبيت كتطبيق، يعمل أوفلاين بالكامل |
| 🤖 **أندرويد** | دعم Capacitor لبناء تطبيق أندرويد أصلي |

## 🛠️ التقنيات

- **TypeScript** — أنواع صارمة مع `strict: true` و `noImplicitAny`
- **Vite 8** — بناء فائق السرعة مع code splitting تلقائي
- **PWA (Workbox)** — خدمة عامل متقدمة مع تخزين مؤقت متعدد المستويات
- **Capacitor** — بناء تطبيق أندرويد أصلي من نفس الكود
- **Vitest** — اختبارات وحدية مع تغطية 82%+
- **Playwright** — اختبارات شاملة للواجهة (E2E)
- **ESLint + Prettier** — جودة وتنسيق الكود
- **Proxy-based State** — إدارة حالة تفاعلية بدون إطار عمل خارجي

## 🚀 البدء السريع

### المتطلبات
- Node.js 22+

### التثبيت
```bash
git clone https://github.com/bahaback-hub/quran-app.git
cd quran-app
npm install
```

### التطوير
```bash
npm run dev          # تشغيل خادم التطوير
```

### البناء
```bash
npm run build        # بناء للإنتاج
npm run preview      # معاينة البناء
```

### الاختبار
```bash
npm test             # تشغيل جميع الاختبارات
npm run test:watch   # اختبارات في وضع المراقبة
npm test -- --coverage  # مع تقرير التغطية
```

### فحص الكود
```bash
npm run lint         # فحص ESLint
npm run lint:fix     # إصلاح تلقائي
npm run format       # تنسيق Prettier
npm run typecheck    # فحص الأنواع
```

### بناء أندرويد
```bash
npm run android:build   # بناء + مزامنة Capacitor
npm run android:open    # فتح في Android Studio
npm run android:run     # بناء + تشغيل على الجهاز
```

## 📁 هيكل المشروع

```
quran-app/
├── .github/workflows/    # CI/CD pipeline
├── src/
│   ├── __tests__/        # اختبارات وحدية (649+ اختبار)
│   ├── translations/     # ملفات الترجمة (ar, en, tr, ms, id)
│   ├── main.ts           # نقطة الدخول
│   ├── app.ts            # تهيئة التطبيق المتتابعة
│   ├── state.ts          # إدارة الحالة التفاعلية (Proxy)
│   ├── dom.ts            # تخزين مؤقت لعناصر DOM
│   ├── audio.ts          # مشغل الصوت المتقدم
│   ├── i18n.ts           # نظام الترجمة الديناميكي
│   ├── templates.ts      # قوالب HTML آمنة من XSS
│   ├── api-client.ts     # عميل API موحد مع إعادة محاولة
│   ├── error-boundary.ts # معالجة أخطاء شاملة
│   ├── a11y.ts           # أدوات إمكانية الوصول
│   ├── overlays.ts       # حقن القوالب المتأخر
│   ├── surah-loader.ts   # تحميل السور على 3 مستويات
│   ├── mushaf.ts         # وضع المصحف
│   ├── search-core.ts    # محرك البحث مع Trie
│   ├── prayer.ts         # مواقيت الصلاة
│   ├── tafsir.ts         # التفاسير
│   ├── tajweed.ts        # ألوان التجويد
│   ├── reciters.ts       # قائمة القراء
│   ├── favorites.ts      # المفضلة
│   ├── keyboard.ts       # اختصارات لوحة المفاتيح
│   └── ...               # ملفات أخرى
├── index.html            # الصفحة الرئيسية
├── styles.css            # الأنماط
├── vite.config.js        # إعدادات Vite + PWA
├── vitest.config.ts      # إعدادات Vitest
├── tsconfig.json         # إعدادات TypeScript صارمة
└── eslint.config.js      # إعدادات ESLint
```

## 🏗️ العمارة

### إدارة الحالة التفاعلية
بدون أي إطار عمل خارجي — يستخدم `Proxy` لإنشاء حالة تفاعلية:
```typescript
state.isPlaying = true;  // ← يُخطر المشتركين تلقائياً
subscribe('isPlaying', (newVal, oldVal) => { ... });  // ← أنواع آمنة
batch(() => { state.currentSurah = 5; state.currentAyahIndex = 0; });  // ← إخطار واحد
```

### التهيئة المتتابعة
التطبيق يتبع 3 مراحل لتسريع التحميل:
1. **المسار الحاسم**: تحميل السورة الحالية أولاً
2. **ربط الأحداث**: إعداد التفاعل
3. **المهام المؤجلة**: الصلاة، الأذكار، الإحصائيات

### عميل API موحد
`safeFetch` يوفر: مهلة زمنية، إعادة محاولة، إلغاء الطلبات المكررة، وإشعارات خطأ صديقة.

## 🤝 المساهمة

1. Fork المشروع
2. أنشئ فرع جديد (`git checkout -b feature/amazing-feature`)
3. التزم بالتغييرات (`git commit -m 'Add amazing feature'`)
4. ارفع الفرع (`git push origin feature/amazing-feature`)
5. افتح Pull Request

تأكد من اجتياز جميع الفحوصات:
```bash
npm run lint && npm run typecheck && npm test
```

## 📄 الرخصة

هذا المشروع مرخص تحت [MIT License](LICENSE).

---

<div align="center">
اللهم اجعل هذا العمل في ميزان أعمال عائلة السليماني
</div>
