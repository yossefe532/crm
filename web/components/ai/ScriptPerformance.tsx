"use client"

import { Card } from "../ui/Card"
import { Progress } from "../ui/Progress"
import { useQuery } from "@tanstack/react-query"
import { intelligenceService } from "../../lib/services/intelligenceService"
import { useAuth } from "../../lib/auth/AuthContext"

export const ScriptPerformance = () => {
  const { token } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["performance_ranking"],
    queryFn: async () => intelligenceService.performanceRanking(token || undefined),
    staleTime: 60000
  })

  const rows = (data?.rows || []).slice(0, 3).map((row, index) => ({
    id: row.subjectId,
    name: row.subjectType === "team" ? `فريق مميز #${index + 1}` : `مندوب مميز #${index + 1}`,
    score: Math.round(row.score)
  }))

  return (
    <Card title="أداء السكربتات">
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-base-500">جاري تحميل الأداء...</p>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل الأداء</p>}
        {rows.map((script) => (
          <div key={script.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-base-900">{script.name}</p>
              <span className="text-sm text-base-600">{script.score}%</span>
            </div>
            <Progress value={script.score} />
          </div>
        ))}
        {!isLoading && !isError && rows.length === 0 && (
          <p className="text-sm text-base-500">لا توجد بيانات أداء</p>
        )}
      </div>
    </Card>
  )
}
