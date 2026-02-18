"use client"

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react"

type Theme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  setTheme: (next: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const applyTheme = (next: Theme) => {
  if (typeof document === "undefined") return
  document.documentElement.dataset.theme = next
  document.documentElement.classList.toggle("dark", next === "dark")
  document.documentElement.classList.add("theme-ready")
  try {
    localStorage.setItem("crm_theme", next)
  } catch {
  }
}

const resolveInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light"
  try {
    const stored = localStorage.getItem("crm_theme")
    if (stored === "light" || stored === "dark") return stored
  } catch {
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>("light")

  useEffect(() => {
    // Avoid double render of theme
    if (typeof window === "undefined") return
    const stored = localStorage.getItem("crm_theme") as Theme | null
    if (stored) {
      setThemeState(stored)
      applyTheme(stored)
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const initial = prefersDark ? "dark" : "light"
      setThemeState(initial)
      applyTheme(initial)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const root = document.documentElement
    let frame = 0
    let latestX = window.innerWidth / 2
    let latestY = window.innerHeight / 2
    const onMove = (event: MouseEvent) => {
      latestX = event.clientX
      latestY = event.clientY
      if (!frame) frame = window.requestAnimationFrame(() => {
        frame = 0
        root.style.setProperty("--cursor-x", `${latestX}px`)
        root.style.setProperty("--cursor-y", `${latestY}px`)
      })
    }
    const onTouch = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      latestX = touch.clientX
      latestY = touch.clientY
      if (!frame) frame = window.requestAnimationFrame(() => {
        frame = 0
        root.style.setProperty("--cursor-x", `${latestX}px`)
        root.style.setProperty("--cursor-y", `${latestY}px`)
      })
    }

    // root.classList.add("lux-cursor")
    // root.classList.toggle("dark-effects", theme === "dark")

    // if (theme === "dark") {
    //   window.addEventListener("mousemove", onMove)
    //   window.addEventListener("touchmove", onTouch, { passive: true })
    // }

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("touchmove", onTouch)
    }
  }, [theme])

  useEffect(() => {
    if (typeof window === "undefined") return
    const onFocus = () => {
      const root = document.documentElement
      if (theme === "dark" && root.classList.contains("dark-effects")) {
        const update = () => {
          root.style.setProperty("--cursor-x", `${window.innerWidth / 2}px`)
          root.style.setProperty("--cursor-y", `${window.innerHeight / 2}px`)
        }
        update()
      }
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    applyTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      applyTheme(next)
      return next
    })
  }, [])

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("ThemeContext missing")
  return ctx
}
