"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { PasswordStrength } from "../../components/ui/PasswordStrength"
import { useAuth } from "../../lib/auth/AuthContext"
import { authApi } from "../../lib/services/authApi"

export default function ChangePasswordPage() {
  const router = useRouter()
  const { token, role, userId, tenantId, signIn } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (!token || !role || !userId || !tenantId) {
      router.replace("/login")
    }
  }, [router, role, tenantId, token, userId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setMessage(null)
    if (!currentPassword) {
      setMessage({ tone: "error", text: "كلمة المرور الحالية مطلوبة" })
      return
    }
    if (!newPassword) {
      setMessage({ tone: "error", text: "كلمة المرور الجديدة مطلوبة" })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ tone: "error", text: "تأكيد كلمة المرور غير مطابق" })
      return
    }
    setLoading(true)
    try {
      const result = await authApi.changePassword({ currentPassword, newPassword, confirmPassword })
      const roles = result.user.roles || []
      const destination = roles.includes("owner") ? "/owner" : roles.includes("team_leader") ? "/team" : "/sales"
      signIn({ token: result.token, role: (destination === "/owner" ? "owner" : destination === "/team" ? "team_leader" : "sales"), userId: result.user.id, tenantId: result.user.tenantId, forceReset: false })
      setMessage({ tone: "success", text: "تم تحديث كلمة المرور بنجاح" })
      router.push(destination)
    } catch (err) {
      const apiErr = err as { status?: number; message?: string; details?: Array<{ message?: string }> }
      const detailsMessage = apiErr?.details?.find((item) => item?.message)?.message
      if (apiErr?.status === 401) {
        setMessage({ tone: "error", text: detailsMessage || apiErr?.message || "كلمة المرور الحالية غير صحيحة" })
      } else if (apiErr?.status === 403) {
        setMessage({ tone: "error", text: detailsMessage || apiErr?.message || "غير مصرح" })
      } else if (apiErr?.status === 0) {
        setMessage({ tone: "error", text: "تعذر الاتصال بالخادم" })
      } else {
        setMessage({ tone: "error", text: detailsMessage || apiErr?.message || "حدث خطأ غير متوقع" })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-reveal flex min-h-screen items-center justify-center bg-base-50" dir="rtl">
      <div className="theme-surface w-full max-w-md rounded-2xl bg-base-0 p-8 shadow-card">
        <h1 className="mb-2 text-2xl font-semibold text-base-900">تغيير كلمة المرور</h1>
        <p className="mb-6 text-sm text-base-500">قم بتحديث كلمة المرور لحماية حسابك</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="كلمة المرور الحالية"
            className="text-right"
            placeholder="كلمة المرور الحالية"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="كلمة المرور الجديدة"
            className="text-right"
            placeholder="كلمة المرور الجديدة"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordStrength password={newPassword} />
          <Input
            label="تأكيد كلمة المرور"
            className="text-right"
            placeholder="تأكيد كلمة المرور"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {message && (
            <p className={`text-sm ${message.tone === "error" ? "text-rose-500" : "text-base-700"}`} aria-live="polite">
              {message.text}
            </p>
          )}
          <Button className="w-full" disabled={loading} type="submit" aria-label="تحديث كلمة المرور" title="تحديث كلمة المرور">
            {loading ? "جاري الحفظ..." : "تحديث كلمة المرور"}
          </Button>
        </form>
      </div>
    </div>
  )
}
