"use client"

import { ReactNode, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "../lib/auth/AuthContext"
import { ThemeProvider } from "../lib/theme/ThemeProvider"
import { LocaleProvider } from "../lib/i18n/LocaleContext"
import { apiBaseUrl } from "../lib/api/client"
import { ToastProvider } from "../components/ui/ToastProvider"
import { NotificationListener } from "../components/ui/NotificationListener"
import { ErrorBoundary } from "../components/ui/ErrorBoundary"

export const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
          refetchOnWindowFocus: true,
          refetchOnMount: true,
          refetchOnReconnect: true,
          staleTime: 1000 * 60 * 5,
          gcTime: 1000 * 60 * 60 * 24, // 24 hours
        },
    },
  }))

  useEffect(() => {
    // if (process.env.NODE_ENV !== "production") return // Skip SW in dev mode to avoid caching issues
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
            <NotificationListener />
            <ToastProvider />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </LocaleProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
