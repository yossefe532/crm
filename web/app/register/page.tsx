"use client"

import { FormEvent, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Select } from "../../components/ui/Select"
import { PasswordStrength } from "../../components/ui/PasswordStrength"
import { useAuth } from "../../lib/auth/AuthContext"
import { authApi } from "../../lib/services/authApi"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { CheckCircle, ExternalLink } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const { t, dir } = useLocale()

  const [hasOwner, setHasOwner] = useState<boolean | null>(null)
  const [setupData, setSetupData] = useState<{ ownerName?: string; ownerPhone?: string; tenantName?: string } | null>(null)
  
  const [tenantName, setTenantName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState("sales")
  const [teamName, setTeamName] = useState("")
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [pendingState, setPendingState] = useState<{ ownerPhone?: string } | null>(null)

  useEffect(() => {
    authApi.getSetupStatus().then(data => {
        setHasOwner(data.hasOwner)
        setSetupData(data)
        if (data.tenantName) setTenantName(data.tenantName)
    }).catch(() => setHasOwner(false))
  }, [])

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  const isStrongPassword = (value: string) => {
    const p = value || ""
    return p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setMessage(null)

    if (!hasOwner && !tenantName.trim()) {
      setMessage({ tone: "error", text: t("company_required") })
      return
    }
    if (!isValidEmail(email)) {
      setMessage({ tone: "error", text: t("email_invalid") })
      return
    }
    if (!isStrongPassword(password)) {
      setMessage({ tone: "error", text: t("password_weak") })
      return
    }
    if (hasOwner && !phone.trim()) {
        setMessage({ tone: "error", text: "رقم الهاتف مطلوب للتواصل" })
        return
    }

    setLoading(true)
    try {
      const result = await authApi.register({
        tenantName: hasOwner ? undefined : tenantName.trim(),
        email,
        password,
        phone: phone.trim() ? phone.trim() : undefined,
        role: hasOwner ? role : undefined,
        teamName: hasOwner && role === "team_leader" ? teamName : undefined
      })

      if (result.isPending) {
          setPendingState({ ownerPhone: result.ownerPhone })
          return
      }

      signIn({ token: result.token, role: "owner", userId: result.user.id, tenantId: result.user.tenantId })
      setMessage({ tone: "success", text: t("account_created") })
      router.push("/owner")
    } catch (err) {
      const apiErr = err as { status?: number; message?: string; details?: Array<{ message?: string }> }
      if (apiErr?.status === 409) {
        setMessage({ tone: "error", text: t("email_used") })
      } else if (apiErr?.status === 0) {
        setMessage({ tone: "error", text: t("network_error") })
      } else {
        const detailsMessage = apiErr?.details?.find((item) => item?.message)?.message
        setMessage({ tone: "error", text: detailsMessage || apiErr?.message || t("unexpected_error") })
      }
    } finally {
      setLoading(false)
    }
  }

  if (hasOwner === null) {
      return <div className="flex h-screen items-center justify-center bg-base-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
  }

  if (pendingState) {
      const ownerPhone = pendingState.ownerPhone || setupData?.ownerPhone
      const waLink = ownerPhone 
        ? `https://wa.me/${ownerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`السلام عليكم، لقد قمت بإنشاء حساب جديد باسم ${email} وأنتظر الموافقة.`)}`
        : null

      return (
        <div className="page-reveal flex min-h-screen items-center justify-center bg-base-50" dir={dir}>
            <div className="theme-surface w-full max-w-md rounded-2xl bg-base-0 p-8 shadow-card text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle className="h-8 w-8" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-base-900">طلبك قيد المراجعة</h2>
                <p className="mb-6 text-sm text-base-600">
                    تم إرسال طلب انضمامك للمالك. يرجى التواصل معه لتفعيل حسابك.
                </p>
                {waLink ? (
                    <a 
                        href={waLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 font-semibold text-white transition-colors hover:bg-[#20bd5a]"
                    >
                        <span>تواصل مع المالك عبر واتساب</span>
                        <ExternalLink className="h-4 w-4" />
                    </a>
                ) : (
                    <p className="rounded-lg bg-base-100 p-3 text-sm text-base-500">
                        لم يقم المالك بإضافة رقم هاتف بعد. يرجى التواصل معه بطريقة أخرى.
                    </p>
                )}
                <Button variant="ghost" className="mt-4 w-full" onClick={() => router.push("/login")}>
                    العودة لصفحة الدخول
                </Button>
            </div>
        </div>
      )
  }

  return (
    <div className="page-reveal flex min-h-screen items-center justify-center bg-base-50" dir={dir}>
      <div className="theme-surface w-full max-w-md rounded-2xl bg-base-0 p-8 shadow-card">
        <h1 className="mb-2 text-2xl font-semibold text-base-900">{hasOwner ? "طلب انضمام للفريق" : t("register")}</h1>
        <p className="mb-6 text-sm text-base-500">{hasOwner ? "أدخل بياناتك لإرسال طلب للمالك" : t("register_start")}</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!hasOwner && (
            <Input 
                aria-label={t("company_name")} 
                title={t("company_name")} 
                className="text-right" 
                placeholder={t("company_name")} 
                value={tenantName} 
                onChange={(e) => setTenantName(e.target.value)} 
            />
          )}
          
          {hasOwner && (
             <div className="space-y-4">
                <Select 
                    label="الدور الوظيفي" 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)}
                >
                    <option value="sales">مندوب مبيعات (Sales)</option>
                    <option value="team_leader">قائد فريق (Team Leader)</option>
                </Select>

                {role === "team_leader" && (
                    <Input 
                        label="اسم الفريق (اختياري)"
                        className="text-right" 
                        placeholder="اسم فريقك" 
                        value={teamName} 
                        onChange={(e) => setTeamName(e.target.value)} 
                    />
                )}
             </div>
          )}

          <Input 
            aria-label={t("email")} 
            title={t("email")} 
            className="text-right" 
            placeholder={t("email")} 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          
          <Input 
            aria-label={t("phone")} 
            title={t("phone")} 
            className="text-right" 
            placeholder={t("phone")} 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
          />

          <Input 
            aria-label={t("password")} 
            title={t("password")} 
            className="text-right" 
            placeholder={t("password")} 
            type="password"
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          <PasswordStrength password={password} />
          
          {message && (
            <div className={`rounded-lg p-3 text-sm ${message.tone === "error" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              {message.text}
            </div>
          )}
          
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? t("creating") : (hasOwner ? "إرسال الطلب" : t("create_account"))}
          </Button>
          
          <p className="text-center text-sm text-base-500">
            {t("already_have_account")}{" "}
            <a href="/login" className="font-medium text-brand-600 hover:underline">
              {t("login")}
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}
