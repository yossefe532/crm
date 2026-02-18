## qالتشخيص المتوقع

* زر **Sign in** بيعمل `signIn()` + `router.push()` (من [page.tsx](file:///d:/شغل/crm%20doctor%20V2/system/web/app/login/page.tsx#L27-L37)). لو النتيجة "ولا حاجة" غالبًا واحد من دول:

  * دخولك بيروح لصفحة محمية وبيرجع فورًا للـ `/login` لأن الكوكيز ما اتسجلتش/مش مقروءة في الـ middleware (شوف [middleware.ts](file:///d:/شغل/crm%20doctor%20V2/system/web/middleware.ts#L5-L27)).

  * صفحات الداشبورد بتعمل Requests للباك اند على بورت مختلف، والباك اند مفيهوش CORS (شوف [app.ts](file:///d:/شغل/crm%20doctor%20V2/system/src/app.ts#L19-L40)) فالمتصفح بيمنع الطلبات، وده بيخلي الصفحة شكلها واقف/فاضي.

  * التوكن الحالي في الديمو هو `demo-token` (مش JWT)، والباك اند بيتحقق بـ `jwt.verify` (شوف [auth.ts](file:///d:/شغل/crm%20doctor%20V2/system/src/utils/auth.ts#L10-L18))، فكل API هترجع 401.

## الخطة (تنفيذ فعلي بعد موافقتك)

1. **تثبيت جلسة الديمو بشكل يعتمد على Cookies**

* تعديل `loginWithToken` في [authService.ts](file:///d:/شغل/crm%20doctor%20V2/system/web/lib/auth/authService.ts) عشان يخزن كمان `auth_user_id` و `auth_tenant_id` في cookies (مش بس localStorage)، مع try/catch لتجنب كراش لو localStorage محجوب.

* تعديل `getAuthSession` عشان يقرأ من cookies أولًا ثم localStorage (علشان الـ middleware يعتمد على cookies).

1. **تخلي الفرونت يبعت الـ fallback headers للباك اند**

* تحديث [httpClient.ts](file:///d:/شغل/crm%20doctor%20V2/system/web/lib/api/httpClient.ts) عشان يبعت تلقائيًا:

  * `x-user-id`, `x-tenant-id`, `x-roles`

  * (وكمان Authorization لو موجود)

* ده هيخلي الباك اند يقبل الديمو بدون JWT لأن عنده fallback جاهز في [auth.ts](file:///d:/شغل/crm%20doctor%20V2/system/src/middleware/auth.ts#L12-L19).

1. **إضافة CORS للباك اند (ضروري طالما ports مختلفة)**

* إضافة middleware بسيط في [app.ts](file:///d:/شغل/crm%20doctor%20V2/system/src/app.ts) يضبط:

  * `Access-Control-Allow-Origin: http://localhost:3000`

  * `Access-Control-Allow-Headers: Content-Type, Authorization, x-user-id, x-tenant-id, x-roles`

  * `Access-Control-Allow-Methods: GET,POST,PATCH,DELETE,OPTIONS`

  * والرد على `OPTIONS` بـ 204.

1. **تحسين تجربة الديمو**

* إضافة endpoint بسيط `/api/health` للباك اند للتأكد بسرعة إن الباك اند شغال.

* (اختياري) لو لسه في أجهزة بتمنع cookies في preview، نضيف وضع DEV bypass في `middleware.ts` عبر env flag.

1. **تحقق نهائي**

* تشغيل الفرونت/الباك، وتجربة تسجيل الدخول:

  * الضغط على Sign in ينقلك للـ `/owner` بدون رجوع فوري.

  * الداشبورد يبدأ يجيب بيانات (حتى لو فاضية) بدون CORS/401.

## ناتج التنفيذ

* Login يشتغل فعليًا.

* الفرونت يقدر يتكلم مع الباك اند عبر port مختلف.

* الديمو يبقى متماسك بدون JWT حقيقي.

