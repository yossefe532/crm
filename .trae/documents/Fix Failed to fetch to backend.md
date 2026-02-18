## التشخيص (السبب الجذري)
- الخطأ `Failed to fetch` هنا غالبًا ليس “الباك مش شغال” فقط، بل بسبب **CSP في Next.js**.
- عندك في [next.config.mjs](file:///d:/شغل/crm%20doctor%20V2/system/web/next.config.mjs#L1-L2) قيمة `connect-src 'self' https:` فقط.
  - هذا يمنع أي طلبات `fetch` إلى `http://localhost:4000` (لأنه http وليس https وليس نفس الأصل).
  - النتيجة في المتصفح: `TypeError: Failed to fetch` ويتسجل عندك `api.network_error`.
- بالإضافة لذلك، لو أنت تشغل الواجهة من “Preview” بأصل مختلف (ليس `http://localhost:3000`) فـ CORS في الباك قد يمنع الطلبات أيضًا. أفضل حل نهائي هو جعل الطلبات من الواجهة إلى `/api/*` (نفس الأصل) وترك Next يعمل كـ proxy للباك.

## الهدف النهائي
- منع فشل `fetch` نهائيًا في التطوير عبر:
  1) CSP يسمح بالاتصالات المطلوبة (خصوصًا ws/HMR وطلبات API).
  2) الواجهة تستدعي `/api/...` بدل `http://localhost:4000/...`.
  3) Next يعمل rewrite/proxy من `/api` إلى Backend على `http://localhost:4000`.
  4) الحفاظ على Backend على 4000 و Frontend على 3000 كما اتفقنا.

## التعديلات التي سأطبقها
1) **تعديل CSP في Next**
- تحديث [next.config.mjs](file:///d:/شغل/crm%20doctor%20V2/system/web/next.config.mjs) بحيث:
  - `connect-src` يتضمن `ws:` و `wss:` (ضروري لـ Next dev/HMR).
  - وفي وضع التطوير يسمح أيضًا بـ `http://localhost:4000` و `http://127.0.0.1:4000`.

2) **Proxy /api عبر Next rewrites**
- إضافة `async rewrites()` في [next.config.mjs](file:///d:/شغل/crm%20doctor%20V2/system/web/next.config.mjs) لتوجيه:
  - `/api/:path*` → `http://localhost:4000/api/:path*` (في التطوير)
  - (اختياري) دعم `BACKEND_ORIGIN` كمتغير بيئة لو حبيت تغيّر عنوان الباك لاحقًا.

3) **تغيير عميل الـ API في الواجهة ليستخدم نفس الأصل**
- تعديل [client.ts](file:///d:/شغل/crm%20doctor%20V2/system/web/lib/api/client.ts) ليصبح الافتراضي:
  - `apiBaseUrl = "/api"` بدل `http://localhost:4000/api`.
- تعديل [web/.env.example](file:///d:/شغل/crm%20doctor%20V2/system/web/.env.example) ليكون الافتراضي `NEXT_PUBLIC_API_BASE_URL=/api`.
- الإبقاء على إمكانية override عبر `NEXT_PUBLIC_API_BASE_URL` عند الحاجة.

4) **تعديل start-all حتى لا يعيد ضبط API_BASE بشكل يكسر proxy**
- تحديث [start-all.ps1](file:///d:/شغل/crm%20doctor%20V2/system/start-all.ps1) بحيث يكتب `NEXT_PUBLIC_API_BASE_URL=/api` (أو يتوقف عن الكتابة نهائيًا إذا كان الملف موجود).

5) **اختبارات**
- إضافة/تحديث اختبار Vitest بسيط يتحقق أن:
  - CSP يحتوي على `connect-src` المناسب.
  - rewrites موجودة.
  - apiBaseUrl الافتراضي هو `/api`.

## التحقق بعد التعديل (خطوات واضحة)
- افتح `http://localhost:3000/login`.
- من Network:
  - طلبات `POST /api/auth/login` يجب أن تظهر **على نفس الأصل 3000**.
  - وستُعاد توجيهها داخليًا إلى الباك على 4000 بدون CORS/CSP مشاكل.
- افتح `http://localhost:4000/api/health` للتأكد الباك شغال.

سأنفّذ التعديلات السابقة مباشرة بعد الموافقة.