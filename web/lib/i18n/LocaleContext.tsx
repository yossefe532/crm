"use client"

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react"

type Locale = "ar" | "en"

const translations: Record<Locale, Record<string, string>> = {
  ar: {
    app_title: "لوحة إدارة العقارات",
    role_label: "الدور",
    role_owner: "المالك",
    role_team_leader: "قائد الفريق",
    role_sales: "المبيعات",
    logout: "تسجيل الخروج",
    cursor: "شكل المؤشر",
    cursor_default: "السهم",
    cursor_custom: "الدائرة",
    owner_dashboard: "لوحة المالك",
    team_dashboard: "لوحة قائد الفريق",
    sales_dashboard: "لوحة المبيعات",
    pipeline: "قناة العملاء",
    analytics: "التحليلات",
    goals: "الأهداف",
    meetings: "الاجتماعات",
    leads: "العملاء المحتملون",
    my_leads: "عملائي",
    finance: "المالية",
    users: "إدارة المستخدمين",
    roles: "إدارة الصلاحيات",
    connect: "التواصل",
    account: "إدارة الحساب",
    login: "تسجيل الدخول",
    register: "إنشاء الحساب",
    login_subtitle: "الدخول إلى لوحة إدارة العملاء",
    register_subtitle: "إنشاء حساب لإدارة العملاء",
    register_start: "ابدأ إعداد شركتك وفريقك",
    company_required: "اسم الشركة/العميل مطلوب",
    password_weak: "كلمة المرور ضعيفة (٨+ أحرف مع حرف كبير/صغير ورقم ورمز)",
    account_created: "تم إنشاء الحساب بنجاح",
    email_used: "البريد الإلكتروني مستخدم بالفعل",
    creating: "جاري الإنشاء...",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    company_name: "اسم الشركة",
    phone: "رقم الهاتف",
    optional: "اختياري",
    language: "اللغة",
    email_invalid: "صيغة البريد الإلكتروني غير صحيحة",
    password_required: "كلمة المرور مطلوبة",
    login_success: "تم تسجيل الدخول بنجاح",
    login_invalid: "بيانات الدخول غير صحيحة",
    network_error: "تعذر الاتصال بالخادم",
    unexpected_error: "حدث خطأ غير متوقع"
  },
  en: {
    app_title: "Real Estate CRM",
    role_label: "Role",
    role_owner: "Owner",
    role_team_leader: "Team Leader",
    role_sales: "Sales",
    logout: "Sign out",
    cursor: "Cursor",
    cursor_default: "Arrow",
    cursor_custom: "Circle",
    owner_dashboard: "Owner Dashboard",
    team_dashboard: "Team Dashboard",
    sales_dashboard: "Sales Dashboard",
    pipeline: "Pipeline",
    analytics: "Analytics",
    goals: "Goals",
    meetings: "Meetings",
    leads: "Leads",
    my_leads: "My Leads",
    finance: "Finance",
    users: "Users",
    roles: "Roles",
    connect: "Connect",
    account: "Account",
    login: "Login",
    register: "Create Account",
    login_subtitle: "Access the CRM dashboard",
    register_subtitle: "Create a new CRM account",
    register_start: "Set up your company and team",
    company_required: "Company name is required",
    password_weak: "Password is weak (8+ chars with upper/lower/number/symbol)",
    account_created: "Account created successfully",
    email_used: "Email already exists",
    creating: "Creating...",
    email: "Email",
    password: "Password",
    company_name: "Company Name",
    phone: "Phone",
    optional: "Optional",
    language: "Language",
    email_invalid: "Invalid email format",
    password_required: "Password is required",
    login_success: "Signed in successfully",
    login_invalid: "Invalid credentials",
    network_error: "Unable to reach the server",
    unexpected_error: "Unexpected error"
  }
}

type LocaleContextValue = {
  locale: Locale
  dir: "rtl" | "ltr"
  toggleLocale: () => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>("ar")

  useEffect(() => {
    if (typeof window === "undefined") return
    let stored: Locale | null = null
    try {
      stored = window.localStorage.getItem("ui_locale") as Locale | null
    } catch {}
    if (stored === "ar" || stored === "en") {
      setLocale(stored)
    }
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.lang = locale
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"
    try {
      window.localStorage.setItem("ui_locale", locale)
    } catch {
    }
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: locale === "ar" ? "rtl" : "ltr",
      toggleLocale: () => setLocale((prev) => (prev === "ar" ? "en" : "ar")),
      t: (key: string) => translations[locale][key] || key
    }),
    [locale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export const useLocale = () => {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("LocaleContext missing")
  return ctx
}
