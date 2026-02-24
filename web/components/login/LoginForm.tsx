"use client"

import { useState, FormEvent, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "../../lib/auth/AuthContext"
import { authApi } from "../../lib/services/authApi"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { Lock, Mail, ArrowRight, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"
import { cn } from "../../lib/utils/cn"
import { motion, AnimatePresence } from "framer-motion"

export const LoginForm = () => {
  const router = useRouter()
  const { signIn } = useAuth()
  const { t, dir } = useLocale()
  const [mounted, setMounted] = useState(false)
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  
  // Forgot Password State
  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [forgotData, setForgotData] = useState({ name: "", phone: "", role: "" })
  
  // Remember Me State
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedEmail = localStorage.getItem("remember_email")
    if (storedEmail) {
      setEmail(storedEmail)
      setRememberMe(true)
    }
  }, [])

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const handleSubmit = async (event: FormEvent) => {
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

    if (rememberMe) {
      localStorage.setItem("remember_email", cleanEmail)
    } else {
      localStorage.removeItem("remember_email")
    }

    setLoading(true)
    try {
      const [result] = await Promise.all([
        authApi.login({ email: cleanEmail, password }),
        new Promise(resolve => setTimeout(resolve, 800))
      ])

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
      
      setTimeout(() => {
        router.push(destination)
      }, 500)
      
    } catch (err) {
      const apiErr = err as { status?: number; message?: string; details?: Array<{ message?: string }> }
      
      // Check for inactive/suspended account (usually 403 or specific 401 message)
      const errorMessage = apiErr?.message?.toLowerCase() || ""
      const isInactive = errorMessage.includes("inactive") || errorMessage.includes("suspended") || errorMessage.includes("banned") || apiErr?.status === 403

      if (isInactive) {
        setMessage({ tone: "error", text: "تم إيقاف حسابك تواصل مع المالك للتفاصيل" })
      } else if (apiErr?.status === 401) {
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

  const handleWhatsAppSend = () => {
    if (!forgotData.name || !forgotData.phone || !forgotData.role) {
      setMessage({ tone: "error", text: t("fill_all_fields") })
      return
    }
    
    const text = encodeURIComponent(
      `*Forgot Password Request*\n` +
      `Name: ${forgotData.name}\n` +
      `Phone: ${forgotData.phone}\n` +
      `Role: ${forgotData.role}\n` +
      `Please reset my password.`
    )
    
    window.open(`https://wa.me/201202112115?text=${text}`, "_blank")
    setForgotModalOpen(false)
    setMessage({ tone: "success", text: t("request_sent") })
  }

  // Prevent hydration mismatch
  if (!mounted) return null

  return (
    <div className="w-full relative z-20">
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="space-y-8"
      >
        <div className="space-y-2 text-center lg:text-start">
          <h2 className="text-3xl font-bold tracking-tight text-white">{t("welcome_back")}</h2>
          <p className="text-slate-400">{t("enter_credentials")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            {/* Email Input */}
            <div className="group space-y-2">
              <label className="text-sm font-medium text-slate-300">
                {t("username")}
              </label>
              <div className={cn(
                "relative flex items-center bg-[#1a1a1a] border rounded-xl transition-all duration-300",
                focusedField === "email" ? "border-[#d4af37] shadow-[0_0_0_1px_rgba(212,175,55,0.3)]" : "border-white/10 hover:border-white/20"
              )}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full bg-transparent border-none py-3.5 px-4 outline-none text-white placeholder-slate-500"
                  placeholder="name@example.com"
                />
                <div className="pr-4 text-slate-500">
                  <Mail className={cn("w-5 h-5 transition-colors", focusedField === "email" ? "text-[#d4af37]" : "")} />
                </div>
              </div>
            </div>

            {/* Password Input */}
            <div className="group space-y-2">
               <label className="text-sm font-medium text-slate-300">
                {t("password")}
              </label>
              <div className={cn(
                "relative flex items-center bg-[#1a1a1a] border rounded-xl transition-all duration-300",
                focusedField === "password" ? "border-[#d4af37] shadow-[0_0_0_1px_rgba(212,175,55,0.3)]" : "border-white/10 hover:border-white/20"
              )}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full bg-transparent border-none py-3.5 px-4 outline-none text-white placeholder-slate-500"
                  placeholder="••••••••"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="pr-4 text-slate-500 hover:text-white transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label 
              className="flex items-center space-x-2 cursor-pointer group"
              onClick={() => setRememberMe(!rememberMe)}
            >
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                rememberMe ? "border-[#d4af37] bg-[#d4af37]" : "border-slate-600 group-hover:border-[#d4af37]"
              )}>
                {rememberMe && <CheckCircle2 className="w-3 h-3 text-[#0a0a0a]" />}
              </div>
              <span className={cn("transition-colors select-none", rememberMe ? "text-white" : "text-slate-500 group-hover:text-slate-300")}>
                {t("remember_me")}
              </span>
            </label>
            <button
              type="button"
              onClick={() => setForgotModalOpen(true)}
              className="text-[#d4af37] hover:text-[#f0c43f] font-medium transition-colors hover:underline underline-offset-4"
            >
              {t("forgot_password") || "Forgot password?"}
            </button>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={loading}
            className={cn(
              "relative w-full py-3.5 rounded-xl font-bold text-[#0a0a0a] overflow-hidden transition-all duration-300",
              loading ? "cursor-not-allowed opacity-80" : "hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#d4af37] to-[#b89628]" />
            <div className="relative flex items-center justify-center gap-2">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span>{t("sign_in")}</span>
              )}
            </div>
          </motion.button>

          <p className="text-center text-sm text-slate-500">
            {t("no_account")}{" "}
            <button
              type="button"
              className="text-[#d4af37] hover:text-[#f0c43f] font-medium transition-colors hover:underline underline-offset-4"
              onClick={() => router.push("/register")}
            >
              {t("create_account")}
            </button>
          </p>

          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: 10, height: 0 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg text-sm font-medium overflow-hidden border",
                  message.tone === "error" 
                    ? "bg-red-900/20 border-red-900/50 text-red-200" 
                    : "bg-emerald-900/20 border-emerald-900/50 text-emerald-200"
                )}
              >
                {message.tone === "error" ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {forgotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setForgotModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#1a1a1a] border border-[#d4af37]/20 rounded-2xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#d4af37] to-[#8a6a1f]" />
              
              <h2 className="text-xl font-bold text-white mb-2">{t("forgot_password")}</h2>
              <p className="text-slate-400 text-sm mb-6">
                {t("forgot_password_desc")}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 ml-1">{t("full_name")}</label>
                  <input
                    type="text"
                    value={forgotData.name}
                    onChange={(e) => setForgotData({ ...forgotData, name: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2.5 px-4 text-white focus:border-[#d4af37] focus:outline-none transition-colors"
                    placeholder=" "
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 ml-1">{t("phone")}</label>
                  <input
                    type="tel"
                    value={forgotData.phone}
                    onChange={(e) => setForgotData({ ...forgotData, phone: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2.5 px-4 text-white focus:border-[#d4af37] focus:outline-none transition-colors"
                    placeholder=" "
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 ml-1">{t("role_position")}</label>
                  <input
                    type="text"
                    value={forgotData.role}
                    onChange={(e) => setForgotData({ ...forgotData, role: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2.5 px-4 text-white focus:border-[#d4af37] focus:outline-none transition-colors"
                    placeholder=" "
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setForgotModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors font-medium text-sm"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleWhatsAppSend}
                  className="flex-1 py-2.5 rounded-lg bg-[#d4af37] hover:bg-[#b89628] text-[#0a0a0a] font-bold text-sm transition-colors shadow-lg shadow-[#d4af37]/20"
                >
                  {t("send_request")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
