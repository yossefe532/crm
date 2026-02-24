"use client"

import Link from "next/link"
import { ThemeToggle } from "./ThemeToggle"
import { useAuth } from "../../lib/auth/AuthContext"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { Button } from "../ui/Button"
import { useRouter } from "next/navigation"
import { useCurrentUserPermissions } from "../../lib/hooks/useCurrentUserPermissions"

type NavItem = {
  href: string
  label: string
  permissions?: string[]
  roles?: string[]
  fallbackRoles?: string[]
}

const allNavItems: NavItem[] = [
  // Dashboards
  { href: "/owner", label: "لوحة المالك", roles: ["owner"] },
  { href: "/team", label: "لوحة قائد الفريق", roles: ["team_leader"] },
  { href: "/sales", label: "لوحة المبيعات", roles: ["sales"] },
  
  // Core Modules
  { href: "/pipeline", label: "قناة العملاء", permissions: ["leads.read"], fallbackRoles: ["sales", "team_leader"] },
  { href: "/analytics", label: "التحليلات", permissions: ["analytics.read"], fallbackRoles: ["team_leader"] },
  { href: "/analytics/goals", label: "الأهداف", permissions: ["analytics.read"], fallbackRoles: ["sales", "team_leader"] },
  { href: "/meetings", label: "الاجتماعات", permissions: ["meetings.read"], fallbackRoles: ["sales", "team_leader"] },
  { href: "/leads", label: "العملاء المحتملون", permissions: ["leads.read"], fallbackRoles: ["sales", "team_leader"] },
  
  { href: "/finance", label: "المالية", permissions: ["finance.read"] }, // Removed team_leader fallback
  { href: "/requests", label: "الطلبات", permissions: ["user_requests.read"], fallbackRoles: ["team_leader"] },
  
  // Settings & Admin
  { href: "/settings/users", label: "إدارة الفريق", permissions: ["users.read"], fallbackRoles: ["team_leader"] }, // Renamed to Team Management for TL context? Or just keep generic label map
  { href: "/settings/roles", label: "إدارة الصلاحيات", permissions: ["roles.read"] },
  { href: "/settings/archive", label: "الأرشيف", permissions: ["leads.delete"] },
  
  { href: "/connect", label: "التواصل", permissions: ["conversations.read"], fallbackRoles: ["sales", "team_leader"] },
  { href: "/account", label: "إدارة الحساب" } // Everyone
]

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { role, signOut } = useAuth()
  const { t, dir, locale, setLocale } = useLocale()
  const router = useRouter()

  const toggleLocale = () => {
    const nextLocale = locale === "ar" ? "en" : "ar"
    setLocale(nextLocale)
    document.documentElement.lang = nextLocale
    document.documentElement.dir = nextLocale === "ar" ? "rtl" : "ltr"
  }
  const { data: permissions } = useCurrentUserPermissions()

  const items = allNavItems.filter(item => {
    // 1. If roles are specified, user must have one of them
    if (item.roles && role && !item.roles.includes(role)) return false
    
    // 2. Permission Check
    if (item.permissions) {
      if (role === 'owner') return true 
      
      // Check DB permissions
      const hasDbPermission = permissions && item.permissions.some(code => 
        permissions.rolePermissions.some(p => p.code === code) || 
        permissions.directPermissions.some(p => p.code === code)
      )
      
      if (hasDbPermission) return true
      
      // Check Fallback Roles
      if (item.fallbackRoles && role && item.fallbackRoles.includes(role)) return true
      
      return false
    }
    
    return true
  })

  const borderClass = dir === "rtl" ? "border-l" : "border-r"
  const textAlign = dir === "rtl" ? "text-right" : "text-left"
  const anchorClass = dir === "rtl" ? "right-0" : "left-0"
  const labelMap: Record<string, string> = {
    "لوحة المالك": t("owner_dashboard"),
    "لوحة قائد الفريق": t("team_dashboard"),
    "لوحة المبيعات": t("sales_dashboard"),
    "قناة العملاء": t("pipeline"),
    "التحليلات": t("analytics"),
    "الأهداف": t("goals"),
    "الاجتماعات": t("meetings"),
    "العملاء المحتملون": t("leads"),
    "عملائي": t("my_leads"),
    "المالية": t("finance"),
    "الطلبات": "الطلبات",
    "إدارة المستخدمين": t("users"),
    "إدارة الفريق": role === 'team_leader' ? "إدارة فريقي" : t("users"), // Dynamic label
    "إدارة الصلاحيات": t("roles"),
    "التواصل": t("connect"),
    "إدارة الحساب": t("account")
  }

  const handleSignOut = () => {
    signOut()
    router.replace("/login")
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`theme-surface hidden h-full w-64 flex-col ${borderClass} border-base-200 bg-base-0 px-5 py-6 ${textAlign} md:flex`} dir={dir}>
        <div className="mb-8 text-lg font-semibold text-base-900">{t("app_title")}</div>
        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="rounded-lg px-3 py-2 text-sm font-medium text-base-700 hover:bg-base-100 transition-colors"
              title={labelMap[item.label] || item.label}
              aria-label={labelMap[item.label] || item.label}
            >
              {labelMap[item.label] || item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[140] bg-base-900/50 backdrop-blur-sm md:hidden transition-opacity" onClick={onClose}>
          <aside
            className={`nav-drawer theme-surface fixed top-0 bottom-0 ${anchorClass} flex w-[85vw] max-w-[300px] flex-col bg-base-0 px-5 py-6 shadow-2xl ${textAlign} transition-transform duration-300 ease-in-out z-[150]`}
            dir={dir}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between border-b border-base-200 pb-4">
              <div className="text-lg font-bold text-base-900">{t("app_title")}</div>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full hover:bg-base-200">
                <span className="text-xl">×</span>
              </Button>
            </div>
            
            <nav className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  prefetch={false}
                  className="rounded-lg px-3 py-3 text-base font-medium text-base-700 hover:bg-base-100 active:bg-base-200 transition-colors"
                  title={labelMap[item.label] || item.label}
                  aria-label={labelMap[item.label] || item.label}
                >
                  {labelMap[item.label] || item.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Footer Actions */}
            <div className="mt-4 flex flex-col gap-3 border-t border-base-200 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <ThemeToggle />
                <Button variant="outline" onClick={toggleLocale} className="w-full justify-center">
                  {t("language")}
                </Button>
              </div>
              <Button variant="danger" onClick={handleSignOut} className="w-full justify-center">
                {t("logout")}
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
