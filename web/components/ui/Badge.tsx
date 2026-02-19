import { ReactNode } from "react"

export const Badge = ({ children, tone = "default", variant, className }: { children: ReactNode; tone?: "default" | "success" | "warning" | "danger" | "info"; variant?: "default" | "success" | "warning" | "danger" | "info" | "outline"; className?: string }) => {
  const mode = variant || tone
  const styles: Record<string, string> = {
    default: "bg-base-100 text-base-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    info: "bg-sky-100 text-sky-700",
    outline: "border border-base-200 text-base-600"
  }
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[mode] || styles.default} ${className || ""}`}>{children}</span>
}
