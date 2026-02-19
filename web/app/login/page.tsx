"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "../../lib/auth/AuthContext"
import { authApi } from "../../lib/services/authApi"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { IconShowcase } from "../../components/catalog/IconShowcase"
import { Input } from "../../components/ui/Input"
import { Button } from "../../components/ui/Button"

const entryIcons = [
  { id: "website", label: "منصة الويب", url: "https://i.postimg.cc/hzttcTLh/website.gif", hint: "وصول من المتصفح" },
  { id: "mobile", label: "تطبيق الجوال", url: "https://i.postimg.cc/DWFzptmr/mobile.gif", hint: "تنبيهات فورية" }
]

export default function LoginPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const { t, dir } = useLocale()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setMessage(null)
    const cleanEmail = email.trim()
    
    if (!isValidEmail(cleanEmail)) {
      setMessage({ tone: "error", text: t("email_invalid") })
      return
    }
    if (!password) {
      setMessage({ tone: "error", text: t("password_required") })
      return
    }
    setLoading(true)
    try {
      const result = await authApi.login({ email: cleanEmail, password })
      const roles = result.user.roles || []
      const fallbackDestination = roles.includes("owner") ? "/owner" : roles.includes("team_leader") ? "/team" : "/sales"
      const destination = result.user.forceReset ? "/change-password" : fallbackDestination
      signIn({
        token: result.token,
        role: (fallbackDestination === "/owner" ? "owner" : fallbackDestination === "/team" ? "team_leader" : "sales"),
        userId: result.user.id,
        tenantId: result.user.tenantId,
        forceReset: Boolean(result.user.forceReset)
      })
      setMessage({ tone: "success", text: t("login_success") })
      router.push(destination)
    } catch (err) {
      const apiErr = err as { status?: number; message?: string; details?: Array<{ message?: string }> }
      if (apiErr?.status === 401) {
        setMessage({ tone: "error", text: t("login_invalid") })
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.innerWidth < 768) return
    let animationFrame = 0
    const dots = Array.from({ length: 36 }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.0006,
      vy: (Math.random() - 0.5) * 0.0006
    }))

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    const render = () => {
      if (!ctx) return
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = "rgba(79, 70, 229, 0.4)"
        dots.forEach((dot) => {
          dot.x += dot.vx
          dot.y += dot.vy
          if (dot.x < 0 || dot.x > 1) dot.vx *= -1
          if (dot.y < 0 || dot.y > 1) dot.vy *= -1
          ctx.beginPath()
          ctx.arc(dot.x * canvas.width, dot.y * canvas.height, dot.r, 0, Math.PI * 2)
          ctx.fill()
        })
        animationFrame = requestAnimationFrame(render)
      } catch (e) {
        // Silently fail animation errors
      }
    }

    try {
      resize()
      render()
    } catch (e) {
      // Silently fail initialization
    }
    window.addEventListener("resize", resize)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <div className="page-reveal relative flex min-h-screen items-center justify-center bg-base-50 login-bg" dir={dir}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-60" aria-hidden="true" />
      <div className="theme-surface relative w-full max-w-md rounded-2xl bg-base-0 p-8 shadow-card">
        <h1 className="mb-2 text-2xl font-semibold text-base-900">{t("login")}</h1>
        <p className="mb-6 text-sm text-base-500">{t("login_subtitle")}</p>
        <div className="mb-6">
          <IconShowcase items={entryIcons} variant="inline" />
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label={t("email")}
            className="text-right"
            placeholder={t("email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t("password")}
            className="text-right"
            placeholder={t("password")}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            endIcon={
              <Button
                type="button"
                variant="ghost"
                className="text-base-400 hover:text-base-600 focus:outline-none p-1 h-auto"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </Button>
            }
          />
          {message && (
            <p className={`text-sm ${message.tone === "error" ? "text-rose-500" : "text-base-700"}`} aria-live="polite">
              {message.text}
            </p>
          )}
          <Button className="btn-85 w-full" disabled={loading} type="submit" aria-label={t("login")} title={t("login")}>
            <span>{loading ? t("login") : t("login")}</span>
          </Button>
        </form>
      </div>
    </div>
  )
}
