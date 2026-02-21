"use client"

import { ReactNode, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "../lib/auth/AuthContext"
import { ThemeProvider } from "../lib/theme/ThemeProvider"
import { LocaleProvider } from "../lib/i18n/LocaleContext"
import { ToastProvider } from "../components/ui/ToastProvider"
import { NotificationListener } from "../components/ui/NotificationListener"
import { ErrorBoundary } from "../components/ui/ErrorBoundary"
import dynamic from "next/dynamic"
import { apiBaseUrl } from "../lib/api/client"
import { toast } from "react-hot-toast"

// const CustomCursor = dynamic(() => import("../components/ui/CustomCursor").then(mod => mod.CustomCursor), {
//   ssr: false,
// })

// const NotificationManager = dynamic(() => import("../components/ui/NotificationManager").then(mod => mod.NotificationManager), {
//   ssr: false,
// })

export const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true, // Refetch when window regains focus
        refetchOnMount: true,       // Refetch when component mounts
        refetchOnReconnect: true,   // Refetch when network reconnects
        staleTime: 1000 * 60 * 5,   // 5 minutes stale time by default
        gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection
      },
    },
  }))

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let mounted = true
    const ping = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/health`, { method: "GET" })
        if (!res.ok) throw new Error(String(res.status))
      } catch {
        if (mounted) {
          // toast.error("الخادم غير متاح الآن")
          console.error("الخادم غير متاح الآن")
        }
      }
    }
    ping()
    const id = setInterval(ping, 60000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ThemeProvider>
          <LocaleProvider>
            {/* <CustomCursor /> */}
            {/* <NotificationManager /> */}
            <NotificationListener />
            <ToastProvider />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </LocaleProvider>   </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
