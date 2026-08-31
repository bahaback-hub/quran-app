# خطة: عدّاد "كم باقي على الصلاة" داخل الحاوية + زر "استخدم موقعي"

**تاريخ:** 2026-08-31
**الحالة:** للمراجعة (لم يُنفَّذ بعد)

---

## السياق (مؤكد من فحص الكود)

- العدّاد التنازلي **كان** في أعلى الواجهة في النسخ القديمة، والمستخدم طلب حذفه من الأعلى (فعله مساعد سابق).
- حالياً: منطق العدّاد في `src/prayer.ts` (`updateCountdowns`) يكتب في `dom.countdownDisplay` و`dom.prayerCountdown` — لكن **هذه العناصر محذوفة من القوالب/HTML** (search في `templates.ts` أعطى 0 نتائج). أي أن المنطق **ميت (dead code)** يُ执行 كل ثانية لكتابة نص في عناصر `null`.
- حقل المدينة `cityInput` موجود في الإعدادات (`src/templates-panels.ts:63`).
- `getCoordinates()` موجودة في `src/prayer-local.ts:84` (تستخدم `navigator.geolocation`) لكن **غير موصولة بزر**.
- `calculatePrayerTimesLocally(method)` موجودة وتحسب مواقيت دقيقة بالإحداثيات.

---

## الميزة أ: عدّاد "كم باقي" داخل حاوية الصلاة (مع حذف الميت)

### أ.١ — حذف المنطق الميت
| الملف | التغيير |
|-------|---------|
| `src/prayer.ts` | في `updateCountdowns()` (السطر ~519-523): حذف كتابة `dom.countdownDisplay` و`dom.prayerCountdown` (العناصر المحذوفة). تبقى الدالة تكتب في العنصر الجديد `#prayerNextCountdown` فقط. |
| `src/dom.ts` | حذف الحقول `countdownDisplay` (السطر 23) و`prayerCountdown` (السطر 25) من `DomMap` + حذف تسجيلهما في `cacheDom` (الأسطر 215, 217). إضافة `prayerNextCountdown: HTMLElement \| null`. |
| `src/__tests__/prayer-full.test.ts` | حذف/تحديث الاختبارات 1351-1376 التي تعتمد على `countdownDisplay`/`prayerCountdown` (mock + assertions). |
| `src/__tests__/dom.test.ts` | حذف `countdownDisplay`/`prayerCountdown` من قائمة الـ IDs المتوقعة (السطر 201-203). |

### أ.٢ — إضافة العدّاد داخل الحاوية
| الملف | التغيير |
|-------|---------|
| `src/templates.ts` | `prayerTimesRows(times)` (السطر 646) يضيف صفاً علوياً داخل الحاوية: `<div id="prayerNextCountdown" class="prayer-next-countdown"></div>` يعرض "باقي على صلاة {القادمة}: {HH:MM:SS}". |
| `src/prayer.ts` | `renderPrayerTimes()` (السطر 478) يملأ `#prayerNextCountdown` عبر دالة `getPrayerName(next)` + الوقت المتبقي. `updateCountdowns()` تُحدّثه كل ثانية (إعادة استخدام `getNextPrayerKey()` الموجودة). |
| `src/dom.ts` | تسجيل `prayerNextCountdown` في `cacheDom` (بجانب `prayerTimesRows`). |
| `src/css/responsive.css` (أو ملف CSS ذي صلة) | تنسيق `.prayer-next-countdown` (بارز، لون مميز، حجم مناسب للجوال). |
| `src/__tests__/prayer.test.ts` أو `prayer-full.test.ts` | اختبار: يُملأ `#prayerNextCountdown` بالصلاة القادمة + يتحدّث كل ثانية. |

**لا حساب جديد** — نعيد استخدام `getNextPrayerKey()` و`timeStrToMinutes()` الموجودة.

---

## الميزة ب: زر "استخدم موقعي" + ربطه بالمدينة

### ب.١ — الواجهة
| الملف | التغيير |
|-------|---------|
| `src/templates-panels.ts` | بجانب `cityInput` (السطر 63): زر `<button id="useLocationBtn">📍 استخدم موقعي</button>` + تبديل (toggle) `<input type="checkbox" id="autoLocationToggle">` "تحديد تلقائي للموقع". |

### ب.٢ — المنطق
| الملف | التغيير |
|-------|---------|
| `src/prayer-local.ts` | دالة جديدة `nearestCityToCoords(lat, lng)`: تحسب أقرب مدينة من قائمة المدن العشر (`LOCAL_CITY_MAP` أو إحداثياتها) وتُرجع اسم المدينة العربية. |
| `src/settings.ts` | معالج `useLocationBtn`: يستدعي `getCoordinates()` ← `nearestCityToCoords()` ← يملأ `cityInput.value` + `state.city` ← يحفظ في `storage`. معالج `autoLocationToggle`: يحفظ `autoLocation: boolean` + `lastCoords` في `storage`. |
| `src/state.ts` + `src/storage.ts` | إضافة `autoLocation` و`lastCoords` (keys جديدة، بقيم افتراضية آمنة). |
| `src/prayer.ts` | عند تفعيل `autoLocation`: يستخدم `lastCoords` لحساب المواقيت عبر `calculatePrayerTimesLocally` (أو يملأ المدينة بأقرب مدينة) بدل قراءة `cityInput` فقط. |
| `src/__tests__/...` | اختبار الزر (يملأ المدينة) + اختبار `nearestCityToCoords` (إحداثيات معروفة → مدينة متوقعة). |

**خصوصية**: `navigator.geolocation` يطلب إذن المستخدم صراحةً — لا شيء يُرسل دون موافقة.

---

## ترتيب التنفيذ
1. **أ.١** حذف الميت (آمن، معزول).
2. **أ.٢** عدّاد داخل الحاوية.
3. **ب.١ + ب.٢** زر الموقع + الربط.

## التحقق قبل الدمج
- `npx tsc -p tsconfig.ci.json --noEmit` → 0 أخطاء.
- `npx vitest run` → كل الاختبارات تمر (تحديث القديمة + الجديدة).
- مراجعة بصرية: فتح الحاوية → يظهر "باقي على صلاة العصر: ٠٢:١٥:٣٠" يتحرك حياً؛ الإعدادات → زر الموقع يملأ المدينة.

## ملاحظات
- المدن العشر فقط: "اسم المدينة التلقائي" = أقرب مدينة من العشر (مكة/المدينة/الرياض...)، لا أي قرية — يتوافق مع سياسة التطبيق (١٠ مدن سعودية رسمية).
- لا مسّ للعدّاد في الأعلى (يظل محذوفاً كما طلب المستخدم سابقاً).
