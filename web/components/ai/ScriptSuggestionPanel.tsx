"use client"

import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { useQuery } from "@tanstack/react-query"
import { intelligenceService } from "../../lib/services/intelligenceService"
import { useAuth } from "../../lib/auth/AuthContext"

export const ScriptSuggestionPanel = () => {
  const { token } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["performance_ranking"],
    queryFn: async () => intelligenceService.performanceRanking(token || undefined),
    staleTime: 60000
  })

  const rows = (data?.rows || []).slice(0, 3).map((row, index) => ({
    id: row.subjectId,
    title: row.subjectType === "team" ? `أفضل فريق #${index + 1}` : `أفضل مندوب #${index + 1}`,
    score: `${Math.round(row.score)}%`
  }))

  return (
    <Card title="اقتراحات السكربت الذكية">
      <div className="space-y-3">
        {isLoading && <p className="text-sm text-base-500">جاري تحميل الاقتراحات...</p>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل الاقتراحات</p>}
        {rows.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-base-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-base-900">{item.title}</p>
              <p className="text-xs text-base-500">الأداء {item.score}</p>
            </div>
            <Button variant="secondary" aria-label="عرض التفاصيل" title="عرض التفاصيل">عرض التفاصيل</Button>
          </div>
        ))}
        {!isLoading && !isError && rows.length === 0 && (
          <p className="text-sm text-base-500">لا توجد اقتراحات حالياً</p>
        )}
      </div>
    </Card>
  )
}
