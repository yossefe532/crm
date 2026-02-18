# المنافذ (Frontend/Backend)

## السبب الجذري للمشكلة
- السبب الأساسي كان مشاركة متغير البيئة `PORT` بين عمليتي الـ Backend والـ Frontend عند التشغيل معًا.
- عند وجود `PORT=4000` في بيئة التشغيل، Next.js قد يلتقطه ويبدأ على 4000 إذا لم يتم تثبيت منفذ الـ Frontend صراحةً.

## التكوين المعتمد
- Frontend: ثابت على `http://localhost:3000`
- Backend (API): ثابت على `http://localhost:4000`
- API Base URL داخل الواجهة: `http://localhost:4000/api`

## التحقق من المنافذ على Windows (PowerShell)
عرض من يستخدم 3000 و 4000:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,4000 | Select-Object LocalAddress,LocalPort,OwningProcess
```

عرض اسم العملية حسب PID:

```powershell
Get-Process -Id <PID>
```

إيقاف عملية:

```powershell
Stop-Process -Id <PID> -Force
```

## التشغيل
تشغيل الاثنين معًا:
- شغّل `start-all.cmd`

إيقاف الاثنين:
- شغّل `stop-all.cmd`

تشغيل الـ Backend فقط:

```powershell
cd "d:\شغل\crm doctor V2\system"
npm.cmd run dev
```

تشغيل الـ Frontend فقط:

```powershell
cd "d:\شغل\crm doctor V2\system\web"
npm.cmd run dev
```

## تغيير المنافذ عند الحاجة
إذا اضطررت لتغيير منفذ الـ Frontend:
1) عدّل `web/package.json` (القيمة بعد `-p`).
2) عدّل `web/.env.local` و `web/.env.example` لقيمة `NEXT_PUBLIC_API_BASE_URL` المناسبة.
3) حدّث CORS في `src/app.ts` ليستوعب Origin الجديد.

