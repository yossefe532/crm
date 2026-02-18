"use client"

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { usePathname } from "next/navigation"
import { useAuth } from "../../lib/auth/AuthContext"

export const DashboardShell = ({ children }: { children: ReactNode }) => {
  const { dir } = useLocale()
  const pathname = usePathname()
  const { role } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const layoutClass = dir === "rtl" ? "flex-row-reverse" : "flex-row"

  useEffect(() => {
    setIsLoading(false)
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (typeof document === "undefined") return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const link = target.closest("a") as HTMLAnchorElement | null
      if (!link || !link.href) return
      const url = new URL(link.href, window.location.origin)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      // Don't show loader for anchor links or if explicitly disabled
      if (link.hasAttribute("data-no-loader")) return
      if (url.hash) return
      
      setIsLoading(true)
    }
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [])

  return (
    <div className={`theme-shell relative flex min-h-screen ${layoutClass}`} dir={dir}>
      <div className="city-bg pointer-events-none opacity-10 fixed inset-0 z-0 hidden md:block">
        <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
          <rect width="1200" height="300" fill="var(--city-2)" />
          <rect x="40" y="120" width="90" height="180" fill="var(--city-1)" />
          <rect x="160" y="80" width="120" height="220" fill="var(--city-2)" />
          <rect x="320" y="140" width="70" height="160" fill="var(--city-3)" />
          <rect x="420" y="60" width="140" height="240" fill="var(--city-2)" />
          <rect x="600" y="100" width="110" height="200" fill="var(--city-1)" />
          <rect x="740" y="140" width="80" height="160" fill="var(--city-3)" />
          <rect x="860" y="70" width="150" height="230" fill="var(--city-2)" />
          <rect x="1040" y="130" width="100" height="170" fill="var(--city-1)" />
        </svg>
      </div>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col relative z-10">
        <Topbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
        <main className="page-reveal flex-1 space-y-8 px-4 py-4 pb-20 md:px-8 md:py-6 md:pb-6">
          {children}
        </main>
      </div>
      {/* Mobile Bottom Navigation */}
      <nav
        className="fixed bottom-0 inset-x-0 z-20 border-t border-base-200 bg-base-0/95 backdrop-blur supports-[backdrop-filter]:bg-base-0/70 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="التنقل السفلي"
        dir={dir}
      >
        <div className="grid grid-cols-4 gap-0">
          <Link
            href="/pipeline"
            prefetch={false}
            className={`flex flex-col items-center justify-center py-2 text-xs ${pathname?.startsWith("/pipeline") ? "text-brand-600" : "text-base-700"}`}
            aria-label="قناة العملاء"
          >
            <span>قناة</span>
            <span className="mt-0.5">العملاء</span>
          </Link>
          <Link
            href="/leads"
            prefetch={false}
            className={`flex flex-col items-center justify-center py-2 text-xs ${pathname?.startsWith("/leads") ? "text-brand-600" : "text-base-700"}`}
            aria-label="العملاء المحتملون"
          >
            <span>العملاء</span>
            <span className="mt-0.5">المحتملون</span>
          </Link>
          <Link
            href="/meetings"
            prefetch={false}
            className={`flex flex-col items-center justify-center py-2 text-xs ${pathname?.startsWith("/meetings") ? "text-brand-600" : "text-base-700"}`}
            aria-label="الاجتماعات"
          >
            <span>الاجتماعات</span>
          </Link>
          <Link
            href="/connect"
            prefetch={false}
            className={`flex flex-col items-center justify-center py-2 text-xs ${pathname?.startsWith("/connect") ? "text-brand-600" : "text-base-700"}`}
            aria-label="التواصل"
          >
            <span>التواصل</span>
          </Link>
        </div>
      </nav>
      {isLoading && (
        <div className="page-loader">
          <div className="page-loader__spinner" />
        </div>
      )}
    </div>
  )
}
