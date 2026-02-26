"use client"

import { FormEvent, useState } from "react"
import { Card } from "../../../components/ui/Card"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { useAuth } from "../../../lib/auth/AuthContext"
import { authApi } from "../../../lib/services/authApi"
import { coreService } from "../../../lib/services/coreService"

import { FileInput } from "../../../components/ui/FileInput"

export default function AccountPage() {
  const { token, signIn } = useAuth()
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [importing, setImporting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setMessage(null)
    if (!currentPassword) {
      setMessage({ tone: "error", text: "كلمة المرور الحالية مطلوبة" })
      return
    }
    if (!email && !phone && !newPassword && !confirmPassword) {
      setMessage({ tone: "error", text: "لا توجد بيانات للتحديث" })
      return
    }
    if ((newPassword || confirmPassword) && (!newPassword || !confirmPassword)) {
      setMessage({ tone: "error", text: "يرجى إدخال كلمة المرور الجديدة وتأكيدها" })
      return
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      setMessage({ tone: "error", text: "تأكيد كلمة المرور غير مطابق" })
      return
    }
    setLoading(true)
    try {
      const result = await authApi.updateCredentials(
        {
          currentPassword,
          email: email || undefined,
          phone: phone || undefined,
          newPassword: newPassword || undefined,
          confirmPassword: confirmPassword || undefined
        },
        token || undefined
      )

      const roles = result.user.roles || []
      const nextRole = roles.includes("owner") ? "owner" : roles.includes("team_leader") ? "team_leader" : "sales"
      signIn({ token: result.token, role: nextRole, userId: result.user.id, tenantId: result.user.tenantId, forceReset: false })

      const messageText = newPassword && (email || phone)
        ? "تم تحديث كلمة المرور وبيانات الحساب"
        : newPassword
          ? "تم تحديث كلمة المرور"
          : "تم تحديث بيانات الحساب"
      setMessage({ tone: "success", text: messageText })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setEmail("")
      setPhone("")
    } catch (err) {
      const apiErr = err as { status?: number; message?: string; details?: Array<{ message?: string }> }
      const detailsMessage = apiErr?.details?.find((item) => item?.message)?.message
      setMessage({ tone: "error", text: detailsMessage || apiErr?.message || "حدث خطأ غير متوقع" })
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const snapshot = await coreService.exportBackup(token || undefined)
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage({ tone: "success", text: "تم إنشاء النسخة الاحتياطية" })
    } catch {
      setMessage({ tone: "error", text: "تعذر إنشاء النسخة الاحتياطية" })
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImporting(true)
    setMessage(null)
    try {
      const text = await file.text()
      const snapshot = JSON.parse(text)
      await coreService.importBackup(snapshot, token || undefined)
      setMessage({ tone: "success", text: "تم استيراد البيانات بنجاح" })
    } catch {
      setMessage({ tone: "error", text: "تعذر استيراد البيانات" })
    } finally {
      setImporting(false)
      event.target.value = ""
    }
  }

  return (
    <div className="space-y-6">
      <Card title="إدارة الحساب">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Input
            className="text-right"
            placeholder="البريد الإلكتروني الجديد (اختياري)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            className="text-right"
            placeholder="رقم الهاتف الجديد (اختياري)"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Input
            type="password"
            className="text-right"
            placeholder="كلمة المرور الحالية (إجباري)"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <Input
            type="password"
            className="text-right"
            placeholder="كلمة المرور الجديدة (اختياري)"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <Input
            type="password"
            className="text-right"
            placeholder="تأكيد كلمة المرور الجديدة (اختياري)"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <div className="md:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </form>
        {message && (
          <p className={`mt-3 text-sm ${message.tone === "success" ? "text-emerald-600" : "text-rose-600"}`}>{message.text}</p>
        )}
        <p className="mt-4 text-xs text-base-500">
          في حالة نسيان كلمة المرور، يرجى التواصل مع المالك لتحديثها من لوحة إدارة المستخدمين.
        </p>
      </Card>
      <Card title="النسخة الاحتياطية للمالك">
        <div className="flex flex-col gap-3 md:flex-row">
          <Button type="button" onClick={handleExport}>
            إنشاء نسخة احتياطية
          </Button>
          <FileInput
            accept="application/json"
            onChange={handleImport}
            disabled={importing}
            loading={importing}
            loadingText="جاري الاستيراد..."
            label="استيراد بيانات"
            buttonProps={{ variant: "outline", children: "استيراد بيانات" }}
            className="px-3 py-2 text-sm"
          />
        </div>
        <p className="mt-2 text-xs text-base-500">
          قم بإنشاء نسخة قبل التحديثات، ويمكنك استيراد بيانات قديمة لاحقًا.
        </p>
      </Card>
    </div>
  )
}
