"use client"

import { Card } from "../ui/Card"
import { useQuery } from "@tanstack/react-query"
import { intelligenceService } from "../../lib/services/intelligenceService"
import { useAuth } from "../../lib/auth/AuthContext"

export const TemplateManager = () => {
  const { token } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["revenue_forecast"],
    queryFn: async () => intelligenceService.revenueForecast(token || undefined),
    staleTime: 60000
  })

  return (
    <Card title="توقعات الإيرادات">
      <div className="space-y-3">
        {isLoading && <p className="text-sm text-base-500">جاري تحميل التوقعات...</p>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل التوقعات</p>}
        {(data?.monthly || []).slice(0, 4).map((row) => (
          <div key={row.period} className="flex items-center justify-between rounded-xl border border-base-100 px-4 py-3">
            <p className="text-sm font-semibold text-base-900">{row.period}</p>
            <p className="text-sm text-base-600">{Math.round(row.expected).toLocaleString("ar-EG")}</p>
          </div>
        ))}
        {!isLoading && !isError && (data?.monthly || []).length === 0 && (
          <p className="text-sm text-base-500">لا توجد توقعات بعد</p>
        )}
      </div>
    </Card>
  )
}
