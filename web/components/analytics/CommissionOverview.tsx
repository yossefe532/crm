"use client"

import { Card } from "../ui/Card"
import { Progress } from "../ui/Progress"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../../lib/api/client"
import { useAuth } from "../../lib/auth/AuthContext"

export const CommissionOverview = () => {
  const { token } = useAuth()
  const { data } = useQuery({
    queryKey: ["commission_ledger"],
    queryFn: async () => apiClient.get<Array<{ amount: number; status: string; createdAt: string }>>("/commissions/ledger", token || undefined),
    staleTime: 60000
  })

  const total = (data || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const approved = (data || []).filter((entry) => entry.status === "approved").reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const pending = (data || []).filter((entry) => entry.status === "pending").reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  const approvedPct = total ? Math.round((approved / total) * 100) : 0
  const pendingPct = total ? Math.round((pending / total) * 100) : 0

  const rows = [
    { label: "إجمالي العمولات", value: total ? 100 : 0, amount: total },
    { label: "عمولات معتمدة", value: approvedPct, amount: approved },
    { label: "عمولات معلّقة", value: pendingPct, amount: pending }
  ]

  return (
    <Card title="نظرة عامة على العمولات">
      <div className="space-y-4">
        {rows.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-base-900">{item.label}</p>
              <span className="text-sm text-base-600" suppressHydrationWarning>
                {item.amount.toLocaleString("ar-EG")}
              </span>
            </div>
            <Progress value={item.value} />
          </div>
        ))}
      </div>
    </Card>
  )
}
