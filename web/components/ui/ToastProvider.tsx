"use client"

import { useEffect, useState } from "react"
import { Toaster } from "react-hot-toast"

export const ToastProvider = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      toastOptions={{
        duration: 4000,
        style: {
          background: "var(--bg-base-0)",
          color: "var(--text-base-900)",
          border: "1px solid var(--border-base-300)",
        },
        success: {
          iconTheme: {
            primary: "var(--color-success)",
            secondary: "var(--bg-base-0)",
          },
        },
        error: {
          iconTheme: {
            primary: "var(--color-error)",
            secondary: "var(--bg-base-0)",
          },
        },
      }}
    />
  )
}
