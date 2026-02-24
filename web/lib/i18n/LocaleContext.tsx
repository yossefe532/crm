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
    unexpected_error: "حدث خطأ غير متوقع",
    remember_me: "تذكرني",
    forgot_password: "نسيت كلمة المرور؟",
    get_started: "تسجيل الدخول",
    need_help: "هل تحتاج مساعدة؟",
    create_account: "إنشاء حساب جديد",
    welcome_doctor: "أهلاً بك يا دكتور",
    crm_name: "EL DOCTOR REAL ESTATE",
    username: "اسم المستخدم",
    forgot_password_desc: "أدخل بياناتك لطلب إعادة تعيين كلمة المرور عبر واتساب",
    full_name: "الاسم الكامل",
    role_position: "الدور / المنصب",
    cancel: "إلغاء",
    send_request: "إرسال الطلب",
    fill_all_fields: "يرجى ملء جميع الحقول",
    request_sent: "تم إرسال الطلب عبر واتساب",
    already_have_account: "لديك حساب بالفعل؟"
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
    unexpected_error: "Unexpected error",
    remember_me: "Remember me",
    forgot_password: "Forgot Password?",
    get_started: "Get Started",
    need_help: "Need Help?",
    create_account: "Create Account",
    welcome_doctor: "Welcome, Doctor",
    crm_name: "EL DOCTOR REAL ESTATE",
    username: "Username",
    forgot_password_desc: "Enter your details to request a password reset via WhatsApp",
    full_name: "Full Name",
    role_position: "Role / Position",
    cancel: "Cancel",
    send_request: "Send Request",
    fill_all_fields: "Please fill all fields",
    request_sent: "Request sent via WhatsApp",
    already_have_account: "Already have an account?"
  }
}

type LocaleContextValue = {
  locale: Locale
  setLocale: (next: Locale) => void
  t: (key: string) => string
  dir: "rtl" | "ltr"
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>("ar")

  useEffect(() => {
    try {
      const stored = localStorage.getItem("crm_locale") as Locale | null
      if (stored === "ar" || stored === "en") {
        setLocaleState(stored)
        document.documentElement.lang = stored
        document.documentElement.dir = stored === "ar" ? "rtl" : "ltr"
      }
    } catch {}
  }, [])

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem("crm_locale", next)
      document.documentElement.lang = next
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr"
    } catch {}
  }

  const t = (key: string) => {
    return translations[locale][key] || key
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, dir: locale === "ar" ? "rtl" : "ltr" }}>
      {children}
    </LocaleContext.Provider>
  )
}

export const useLocale = () => {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("LocaleContext missing")
  return ctx
}
