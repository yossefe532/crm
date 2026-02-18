"use client"

import { ReactNode, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "../lib/auth/AuthContext"
import { ThemeProvider } from "../lib/theme/ThemeProvider"
import { LocaleProvider } from "../lib/i18n/LocaleContext"
import dynamic from "next/dynamic"

const CustomCursor = dynamic(() => import("../components/ui/CustomCursor").then(mod => mod.CustomCursor), {
  ssr: false,
})

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
