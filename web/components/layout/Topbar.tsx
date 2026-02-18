"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "../../lib/auth/AuthContext"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { Button } from "../ui/Button"
import { Avatar } from "../ui/Avatar"
import { ThemeToggle } from "./ThemeToggle"
import { useUsers } from "../../lib/hooks/useUsers"

export const Topbar = ({ onMenuToggle }: { onMenuToggle: () => void }) => {
  const router = useRouter()
  const pathname = usePathname()
  const { signOut, role, userId } = useAuth()
  const { t, toggleLocale, dir } = useLocale()
  const { data: users } = useUsers()
  const [cursorMode, setCursorMode] = useState<"custom" | "default">("custom")
  const roleLabel = role === "owner" ? t("role_owner") : role === "team_leader" ? t("role_team_leader") : role === "sales" ? t("role_sales") : ""
  const hidePreferences = pathname?.startsWith("/account")

  const currentUser = useMemo(() => users?.find((u) => u.id === userId), [users, userId])


  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem("cursor_mode")
    setCursorMode(stored === "default" ? "default" : "custom")
  }, [])

  const handleSignOut = () => {
    signOut()
    router.replace("/login")
  }

  const handleCursorToggle = () => {
    const next = cursorMode === "custom" ? "default" : "custom"
    setCursorMode(next)
    window.localStorage.setItem("cursor_mode", next)
    window.dispatchEvent(new Event("cursor-mode-change"))
  }

  return (
    <header className="theme-surface flex items-center justify-between border-b border-base-200 bg-base-0 px-4 py-4 md:px-8" dir={dir}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="md:hidden" onClick={onMenuToggle} aria-label="menu">
          ☰
        </Button>
        <Avatar name={currentUser?.name || currentUser?.email} size="sm" />
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-base-900">{currentUser?.name || currentUser?.email}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-base-500">{t("role_label")}: {roleLabel}</span>
          </div>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-3">
        {!hidePreferences && (
          <>
            <ThemeToggle />
            <Button variant="secondary" onClick={handleCursorToggle} aria-label={t("cursor")} title={t("cursor")}>
              {cursorMode === "custom" ? t("cursor_custom") : t("cursor_default")}
            </Button>
            <Button variant="secondary" onClick={toggleLocale} aria-label={t("language")} title={t("language")}>
              {t("language")}
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={handleSignOut} aria-label={t("logout")} title={t("logout")}>
          {t("logout")}
        </Button>
      </div>
    </header>
  )
}
