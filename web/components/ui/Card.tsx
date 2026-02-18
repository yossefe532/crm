 "use client"

import { ReactNode } from "react"
import { useLocale } from "../../lib/i18n/LocaleContext"

export const Card = ({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) => {
  const { dir } = useLocale()
  const textAlign = dir === "rtl" ? "text-right" : "text-left"
  return (
    <div className={`theme-surface card-lux rounded-2xl bg-base-0 p-4 md:p-6 shadow-card ${textAlign} ${className || ""}`} dir={dir}>
      {(title || actions) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {title && <h3 className="card-title text-lg font-semibold text-base-900">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}
