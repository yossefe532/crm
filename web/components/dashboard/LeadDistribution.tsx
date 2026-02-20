"use client"

import { Card } from "../ui/Card"
import { useDashboardAnalytics } from "../../lib/hooks/useDashboardAnalytics"

export const LeadDistribution = () => {
  const { data, isLoading } = useDashboardAnalytics()

  const rows = (data?.salesPerformance || []).map((user) => {
    return { id: user.userId, name: user.name, count: user.total }
  })

  if (isLoading) {
    return (
      <Card title="توزيع العملاء">
         <div className="space-y-3">
           {[1, 2, 3].map(i => (
             <div key={i} className="h-10 bg-base-200 animate-pulse rounded" />
           ))}
         </div>
      </Card>
    )
  }

  return (
    <Card title="توزيع العملاء">
      <div className="space-y-3">
        {rows.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-base-100 px-3 py-2">
            <p className="truncate text-sm font-semibold text-base-900">{item.name}</p>
            <span className="flex-shrink-0 text-sm text-base-600">{item.count}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-base-500">لا توجد بيانات للعرض</p>}
      </div>
    </Card>
  )
}
