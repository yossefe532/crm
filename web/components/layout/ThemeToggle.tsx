"use client"

import { Button } from "../ui/Button"
import { useTheme } from "../../lib/theme/ThemeProvider"

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme()
  const label = theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"

  return (
    <Button
      variant="ghost"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="border border-base-200"
    >
      {label}
    </Button>
  )
}
