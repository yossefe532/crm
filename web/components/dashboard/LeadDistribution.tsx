"use client"

import { Card } from "../ui/Card"
import { useLeads } from "../../lib/hooks/useLeads"
import { useUsers } from "../../lib/hooks/useUsers"

export const LeadDistribution = () => {
  const { data: leads } = useLeads()
  const { data: users } = useUsers()

  const byUser = (leads || []).reduce<Record<string, number>>((acc, lead) => {
    const key = lead.assignedUserId || "unassigned"
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const rows = (Object.entries(byUser) as Array<[string, number]>).map(([userId, count]) => {
    const user = users?.find((u) => u.id === userId)
    return { id: userId, name: user?.email || "غير مُسند", count }
  })

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
