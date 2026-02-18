import Link from "next/link"
import { Button } from "../../components/ui/Button"

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-50" dir="rtl">
      <div className="rounded-2xl bg-white p-10 text-center shadow-card">
        <h1 className="text-2xl font-semibold text-base-900">غير مصرح</h1>
        <p className="mt-2 text-sm text-base-500">لا تملك صلاحية للوصول إلى هذه الصفحة.</p>
        <div className="mt-6">
          <Link href="/login"><Button aria-label="العودة لتسجيل الدخول" title="العودة لتسجيل الدخول">العودة لتسجيل الدخول</Button></Link>
        </div>
      </div>
    </div>
  )
}
