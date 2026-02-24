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
    queryFn: async () => apiClient.get<Array<{ id: string; amount: number; status: string; createdAt: string }>>("/commissions/ledger", token || undefined),
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
      <div className="space-y-6">
        {/* Summary Stats */}
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

        {/* Recent Entries */}
        <div className="border-t border-base-200 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-base-900">آخر العمليات</h4>
          <div className="space-y-3">
            {(data || []).slice(0, 3).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${
                    entry.status === 'approved' ? 'bg-emerald-500' : 
                    entry.status === 'pending' ? 'bg-amber-500' : 'bg-base-300'
                  }`} />
                  <span className="text-base-600">
                    {new Date(entry.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
                <span className={`font-medium ${
                  entry.status === 'approved' ? 'text-emerald-600' : 'text-base-900'
                }`}>
                  {Number(entry.amount).toLocaleString('ar-EG')}
                </span>
              </div>
            ))}
            {(!data || data.length === 0) && (
              <p className="text-center text-xs text-base-400">لا توجد عمولات مسجلة</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
