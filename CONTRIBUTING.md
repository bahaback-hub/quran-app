# المساهمة في قرآن كريم

شكراً لاهتمامك بالمساهمة في تطبيق القرآن الكريم 🙏

## المتطلبات

- Node.js >= 22
- npm

## التطوير

```bash
# نسخ المستودع
git clone https://github.com/bahaback-hub/quran-app.git
cd quran-app

# تثبيت الاعتماديات
npm install

# تشغيل خادم التطوير
npm run dev

# تشغيل الاختبارات
npm test

# تشغيل اختبارات E2E
npm run test:e2e

# فحص الأنواع
npm run typecheck

# بناء الإنتاج
npm run build
```

## هيكل المشروع

```
src/
  state.js        — كائن الحالة العام
  app.js          — المنسق الرئيسي
  audio.js        — مشغل الصوت
  surah-loader.js — تحميل السور
  search.js       — البحث
  mushaf.js       — المصحف
  prayer.js       — مواقيت الصلاة، القبلة
  tafsir.js       — التفسير
  i18n.js         — الترجمات
  translations/   — ملفات اللغات
  config.js       — الثوابت
  dom.js          — مراجع DOM
  ui.js           — Toast، شريط التحميل
  utils.js        — دوال مساعدة
  storage.js      — التخزين المحلي
  state.js        — الحالة العامة
  __tests__/      — اختبارات الوحدة
e2e/              — اختبارات E2E
```

## قواعد الكود

- **الدوال**: استخدم `function` declarations (ليس arrow/const)
- **الحالة**: كل الحالة في `state.js` — لا تنشئ متغيرات عامة خاصة بالوحدة
- **التعليقات**: أضف JSDoc لكل دالة مُصدَّرة
- **الاختبارات**: أضف اختبارات لكل وظيفة جديدة
- **الترجمات**: أضف ملف لغة جديد في `src/translations/` وسجله في `src/i18n.js`

## سير العمل

1. أنشئ فرعاً جديداً (`git checkout -b feature/your-feature`)
2. نفذ التغييرات
3. تأكد من اجتياز الاختبارات (`npm test && npm run typecheck`)
4. ارفع التغييرات (`git push origin feature/your-feature`)
5. افتح Pull Request

## الإبلاغ عن مشكلة

افتح issue في [GitHub Issues](https://github.com/bahaback-hub/quran-app/issues) مع:
- وصف المشكلة
- خطوات إعادة الإنتاج
- المتصفح ونظام التشغيل

## الترخيص

MIT
