"use client"

import { Card } from "../ui/Card"
import { Progress } from "../ui/Progress"
import { useDashboardAnalytics } from "../../lib/hooks/useDashboardAnalytics"

export const TeamPerformance = () => {
  const { data, isLoading } = useDashboardAnalytics()

  const rows = (data?.teamPerformance || []).map((team) => {
    return { id: team.teamId, name: team.teamName, value: team.conversionRate || 0 }
  })

  if (isLoading) {
    return (
      <Card title="أداء الفرق">
         <div className="space-y-4">
           {[1, 2, 3].map(i => (
             <div key={i} className="h-8 bg-base-200 animate-pulse rounded" />
           ))}
         </div>
      </Card>
    )
  }

  return (
    <Card title="أداء الفرق">
      <div className="space-y-4">
        {rows.map((team) => (
          <div key={team.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-base-900">{team.name}</p>
              <span className="text-sm text-base-600">{team.value}%</span>
            </div>
            <Progress value={team.value} />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-base-500">لا توجد بيانات للعرض</p>}
      </div>
    </Card>
  )
}
