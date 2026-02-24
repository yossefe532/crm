"use client"

import { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "../../lib/auth/AuthContext"
import { conversationService } from "../../lib/services/conversationService"
import { NotificationManager } from "../ui/NotificationManager"
import { useSocket } from "../../lib/hooks/useSocket"
import { toast } from "react-hot-toast"
import { Message } from "../../lib/types"

export const DashboardShell = ({ children }: { children: ReactNode }) => {
  const { dir } = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const { role, token, userId } = useAuth()
  const socket = useSocket()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const layoutClass = dir === "rtl" ? "flex-row-reverse" : "flex-row"

  useEffect(() => {
    setIsLoading(false)
    setSidebarOpen(false)
  }, [pathname])

  // Click handler for loader
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
      if (link.hasAttribute("data-no-loader")) return
      if (url.hash) return
      setIsLoading(true)
    }
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [])

  // Initial Unread Load
  const loadUnread = async () => {
    if (!token) return
    try {
      const list = await conversationService.list(token)
      const count = list.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0)
      setUnread(count)
    } catch {}
  }

  useEffect(() => {
    loadUnread()
  }, [token, pathname]) // Reload when changing pages too, to update if we left chat

  // Socket Listener for Global Notifications
  useEffect(() => {
    if (!socket || !userId) return

    const handleMessage = (message: Message) => {
      if (message.senderId === userId) return

      // If we are NOT on the connect page, show notification and update badge
      if (!pathname?.startsWith('/connect')) {
        setUnread(prev => prev + 1)
        
        toast.custom((t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 cursor-pointer`}
            onClick={() => {
              toast.dismiss(t.id)
              router.push('/connect')
            }}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold">
                    💬
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    رسالة جديدة
                  </p>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {message.content}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ), { duration: 4000, position: "top-left" })
      }
    }

    socket.on("message:new", handleMessage)
    
    return () => {
      socket.off("message:new", handleMessage)
    }
  }, [socket, userId, pathname, router])

  return (
    <div className={`theme-shell relative flex min-h-screen ${layoutClass}`} dir={dir} suppressHydrationWarning>
      <div className="city-bg opacity-10 fixed inset-0 z-0 hidden md:block pointer-events-none">
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
            {unread > 0 && (
              <span className="mt-0.5 inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
        </div>
      </nav>
      {isLoading && (
        <div className="page-loader">
          <div className="page-loader__spinner" />
        </div>
      )}
      <NotificationManager />
    </div>
  )
}
