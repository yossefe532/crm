"use client"

import Link from "next/link"
import { useAuth } from "../../lib/auth/AuthContext"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { Button } from "../ui/Button"

const navByRole = {
  owner: [
    { href: "/owner", label: "لوحة المالك" },
    { href: "/pipeline", label: "قناة العملاء" },
    { href: "/analytics", label: "التحليلات" },
    { href: "/analytics/goals", label: "الأهداف" },
    { href: "/meetings", label: "الاجتماعات" },
    { href: "/leads", label: "العملاء المحتملون" },
    { href: "/finance", label: "المالية" },
    { href: "/requests", label: "الطلبات" },
    { href: "/settings/users", label: "إدارة المستخدمين" },
    { href: "/connect", label: "التواصل" },
    { href: "/account", label: "إدارة الحساب" }
  ],
  team_leader: [
    { href: "/team", label: "لوحة قائد الفريق" },
    { href: "/pipeline", label: "قناة العملاء" },
    { href: "/analytics", label: "التحليلات" },
    { href: "/analytics/goals", label: "الأهداف" },
    { href: "/meetings", label: "الاجتماعات" },
    { href: "/leads", label: "العملاء المحتملون" },
    { href: "/connect", label: "التواصل" },
    { href: "/settings/users", label: "إدارة المستخدمين" },
    { href: "/account", label: "إدارة الحساب" }
  ],
  sales: [
    { href: "/sales", label: "لوحة المبيعات" },
    { href: "/pipeline", label: "قناة العملاء" },
    { href: "/analytics/goals", label: "الأهداف" },
    { href: "/meetings", label: "الاجتماعات" },
    { href: "/leads", label: "عملائي" },
    { href: "/connect", label: "التواصل" },
    { href: "/account", label: "إدارة الحساب" }
  ]
}

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { role } = useAuth()
  const { t, dir } = useLocale()
  const items = role ? navByRole[role] : []
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
    "التواصل": t("connect"),
    "إدارة الحساب": t("account")
  }

  return (
    <>
      <aside className={`theme-surface hidden h-full w-64 flex-col ${borderClass} border-base-200 bg-base-0 px-5 py-6 ${textAlign} md:flex`} dir={dir}>
        <div className="mb-8 text-lg font-semibold text-base-900">{t("app_title")}</div>
        <nav className="flex flex-1 flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="rounded-lg px-3 py-2 text-sm font-medium text-base-700 hover:bg-base-100"
              title={labelMap[item.label] || item.label}
              aria-label={labelMap[item.label] || item.label}
            >
              {labelMap[item.label] || item.label}
            </Link>
          ))}
        </nav>
      </aside>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose}>
          <aside
            className={`nav-drawer theme-surface fixed top-4 bottom-4 ${anchorClass} mx-4 flex w-72 flex-col rounded-2xl bg-base-0 px-5 py-6 ${textAlign}`}
            dir={dir}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="text-lg font-semibold text-base-900">{t("app_title")}</div>
              <Button variant="ghost" onClick={onClose}>×</Button>
            </div>
            <nav className="flex flex-1 flex-col gap-2">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-base-700 hover:bg-base-100"
                  title={labelMap[item.label] || item.label}
                  aria-label={labelMap[item.label] || item.label}
                >
                  {labelMap[item.label] || item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
