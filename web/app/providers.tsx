"use client"

import { ReactNode, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "../lib/auth/AuthContext"
import { ThemeProvider } from "../lib/theme/ThemeProvider"
import { CustomCursor } from "../components/ui/CustomCursor"
import { LocaleProvider } from "../lib/i18n/LocaleContext"

export const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient())

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {})
  }, [])

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ThemeProvider>
          <LocaleProvider>
            <CustomCursor />
            {children}
          </LocaleProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
