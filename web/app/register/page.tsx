"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { useAuth } from "../../lib/auth/AuthContext"
import { authApi } from "../../lib/services/authApi"
import { useLocale } from "../../lib/i18n/LocaleContext"

export default function RegisterPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const { t, dir } = useLocale()

  const [tenantName, setTenantName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  const isStrongPassword = (value: string) => {
    const p = value || ""
    return p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setMessage(null)

    if (!tenantName.trim()) {
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

    setLoading(true)
    try {
      const result = await authApi.register({
        tenantName: tenantName.trim(),
        email,
        password,
        phone: phone.trim() ? phone.trim() : undefined
      })
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

  return (
    <div className="page-reveal flex min-h-screen items-center justify-center bg-base-50" dir={dir}>
      <div className="theme-surface w-full max-w-md rounded-2xl bg-base-0 p-8 shadow-card">
        <h1 className="mb-2 text-2xl font-semibold text-base-900">{t("register")}</h1>
        <p className="mb-6 text-sm text-base-500">{t("register_start")}</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input 
            aria-label={t("company_name")} 
            title={t("company_name")} 
            className="text-right" 
            placeholder={t("company_name")} 
            value={tenantName} 
            onChange={(e) => setTenantName(e.target.value)} 
          />
          <Input 
            aria-label={t("email")} 
            title={t("email")} 
            className="text-right" 
            placeholder={t("email")} 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
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
          <Input 
            aria-label={t("phone")} 
            title={t("phone")} 
            className="text-right" 
            placeholder={`${t("phone")} (${t("optional") || ""})`.trim()} 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
          />
          {message && (
            <p className={`text-sm ${message.tone === "error" ? "text-rose-500" : "text-base-700"}`} aria-live="polite">
              {message.text}
            </p>
          )}
          <Button className="w-full" disabled={loading} type="submit" aria-label={t("register")} title={t("register")}
          >
            {loading ? t("creating") : t("register")}
          </Button>
        </form>
      </div>
    </div>
  )
}
