## ما اكتشفته في المشروع الحالي
- لا يوجد حاليًا أي endpoints للمصادقة مثل `/api/auth/login` أو `/api/auth/register` في الباك‑إند؛ الموجود فقط `authMiddleware` الذي يتحقق من JWT أو fallback headers. (لا يوجد إصدار JWT داخل السيرفر).
- صفحة تسجيل الدخول في الفرونت حالياً تعمل بوضع Demo (تضع `demo-token` محليًا) وليست متكاملة فعليًا مع الباك‑إند.

## الهدف
- بناء تسجيل دخول (وملف تسجيل/إنشاء حساب اختياري) يعمل بـ Fetch/AJAX بدون إعادة تحميل الصفحة.
- التحقق من البيانات على الواجهة والخادم.
- عرض رسائل نجاح/فشل في نفس الصفحة.
- تخزين جلسة المستخدم (token/role/userId/tenantId) بشكل صحيح.
- إعادة توجيه ذكية بعد النجاح عبر JavaScript (بدون reload كامل).
- تغطية سيناريوهات التكامل (نجاح/فشل/خادم غير متاح/بطء).

## التغييرات المقترحة في Backend
1) **إضافة Auth Module جديد**
- إنشاء مسارات عامة:
  - `POST /api/auth/login`
  - `POST /api/auth/register` (اختياري حسب رغبتك، لكنه مطلوب ضمن سيناريو "البريد مستخدم بالفعل")
  - `GET /api/auth/me` (اختياري لإعادة جلب بيانات المستخدم من التوكن)

2) **تعديل ترتيب الـ middleware في السيرفر**
- تركيب `/api/auth/*` قبل `app.use(authMiddleware)` حتى تكون login/register عامة.

3) **Hashing آمن لكلمة المرور بدون إضافة مكتبات خارجية**
- إضافة util في الباك‑إند يعتمد على `node:crypto` (مثل `scrypt`) لإنشاء `passwordHash` وتحقق المقارنة.
- تخزين `passwordHash` بصيغة تتضمن salt + parameters (مثلاً `scrypt$...$salt$hash`) داخل حقل `User.passwordHash`.

4) **Validation على الخادم + رسائل أخطاء واضحة**
- Login:
  - 400 لو email format غلط أو password فارغ
  - 401 لو بيانات الدخول غير صحيحة
- Register:
  - 400 لو email/password غير صالحين أو password ضعيفة
  - 409 لو البريد موجود بالفعل (بسبب `email @unique`)

5) **إصدار JWT حقيقي عند نجاح login/register**
- استخدام `jsonwebtoken` لإصدار JWT payload بالشكل الموجود فعلاً في النظام:
  - `{ id, tenantId, roles }`
- تحديث `lastLoginAt` عند نجاح login.
- ملاحظة: لو `JWT_SECRET` غير مضبوط في `.env` سنرجع 500 برسالة “Server misconfigured” بدل إصدار توكن غير آمن.

## التغييرات المقترحة في Frontend
1) **واجهة Login متكاملة عبر Fetch/AJAX**
- تعديل صفحة [page.tsx](file:///d:/شغل/crm%20doctor%20V2/system/web/app/login/page.tsx) لتصبح:
  - نموذج `<form>` + `onSubmit`
  - `preventDefault()` + `try/catch`
  - state لـ email/password/role
  - تعطيل زر الإرسال أثناء الطلب + نص تحميل

2) **عرض رسائل نجاح/فشل في نفس الصفحة**
- state مثل `statusMessage` و `statusTone` (بدون تغيير CSS/layout؛ فقط إضافة عنصر نصي بسيط ضمن نفس الهيكل).

3) **تكامل التخزين**
- عند نجاح login: استدعاء `signIn(...)` الموجود في [AuthContext](file:///d:/شغل/crm%20doctor%20V2/system/web/lib/auth/AuthContext.tsx) لتخزين التوكن/البيانات (cookies + localStorage) ثم redirect عبر `router.push()`.

4) **Validation على الواجهة**
- تحقق سريع قبل الإرسال:
  - email format
  - password length + قواعد قوة
- عرض الرسالة للمستخدم بدون إرسال طلب إذا البيانات غير صالحة.

5) **عدم إضافة console.log في النسخة النهائية**
- سأستخدم logs مؤقتًا أثناء التحقق ثم أزيلها قبل إنهاء التغيير (حسب متطلباتك).

## اختبار التكامل (Automated + Manual)
1) **اختبارات Backend (Vitest)**
- اختبار `hash/verify` لكلمة المرور.
- اختبار validation (email/password) كدوال pure.

2) **اختبارات Frontend (Playwright) بدون الاعتماد على DB**
- كتابة اختبارات تقوم بعمل intercept لطلب `/api/auth/login` وتعيد:
  - 200 نجاح → تتأكد من تعطيل الزر أثناء التحميل ثم حدوث redirect
  - 401 فشل → تظهر رسالة مناسبة
  - network failure/timeout → تظهر رسالة “تعذر الاتصال بالخادم”

3) **تحقق يدوي في المتصفح**
- فتح Network tab والتأكد من ظهور طلب `POST /api/auth/login` عند الضغط على “Sign In”.

## مخرجات نهائية
- تسجيل دخول حقيقي متكامل Front/Back.
- رسائل واضحة للمستخدم بدون reload.
- JWT صالح + تخزين session.
- اختبارات تغطي السيناريوهات المطلوبة.

إذا وافقت، سأبدأ التنفيذ مباشرة بهذه الخطوات مع الحفاظ على نفس التصميم (بدون تعديل layout/styling).