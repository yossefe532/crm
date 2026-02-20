"use client"

import { useCountUp } from "../../lib/hooks/useCountUp"

export const Stat = ({ label, value, change }: { label: string; value: string; change?: string | number }) => {
  const numeric = Number(value.replace(/[^0-9.-]/g, ""))
  const isNumeric = !Number.isNaN(numeric)
  const hasDecimal = value.includes(".")
  const isPercent = value.includes("%")
  const animated = useCountUp(isNumeric ? numeric : 0, 800, isNumeric)
  const formatted = isNumeric
    ? `${hasDecimal ? animated.toFixed(1) : Math.round(animated).toLocaleString("ar-EG")}${isPercent ? "%" : ""}`
    : value
  return (
    <div className="space-y-2">
      <p className="text-sm text-base-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-base-900" suppressHydrationWarning>{formatted}</span>
        {change && <span className="text-xs font-semibold text-emerald-600">{change}</span>}
      </div>
    </div>
  )
}
