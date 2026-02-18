# طبقة تكامل API

## عنوان الأساس

- متغير البيئة: NEXT_PUBLIC_API_BASE_URL

## المصادقة

- يتم تخزين auth_token و auth_role في الكوكيز
- ترويسة التفويض: Bearer {token}

## المسارات المستخدمة

- GET /leads
- PATCH /leads/:id
- GET /meetings
- POST /meetings
- GET /analytics/metrics/daily
- GET /analytics/rankings
- GET /commissions/ledger

## معالجة الأخطاء

- أخطاء الـ API ترجع { error }
- httpClient يرمي { status, message }
