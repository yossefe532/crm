"use client"

import { Card } from "../ui/Card"
import { useDashboardAnalytics } from "../../lib/hooks/useDashboardAnalytics"
import { Badge } from "../ui/Badge"

const STAGE_LABELS: Record<string, string> = {
  "new": "جديد",
  "call": "مكالمة",
  "meeting": "اجتماع",
  "site_visit": "زيارة",
  "closing": "إغلاق",
  "won": "ناجحة",
  "lost": "خاسرة"
}

const STAGE_COLORS: Record<string, "default" | "info" | "success" | "warning" | "danger" | "outline"> = {
  "new": "default",
  "call": "info",
  "meeting": "info",
  "site_visit": "warning",
  "closing": "outline",
  "won": "success",
  "lost": "danger"
}

export const LeadStageSummary = () => {
  const { data, isLoading } = useDashboardAnalytics()

  if (isLoading) {
    return (
      <Card title="ملخص مراحل العملاء">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-base-100 rounded w-full" />
          <div className="h-8 bg-base-100 rounded w-full" />
          <div className="h-8 bg-base-100 rounded w-full" />
        </div>
      </Card>
    )
  }

  if (!data?.salesStageSummary || data.salesStageSummary.length === 0) {
    return (
        <Card title="ملخص مراحل العملاء">
            <div className="text-center text-base-500 py-8">
                لا توجد بيانات متاحة
            </div>
        </Card>
    )
  }

  const stages = ["new", "call", "meeting", "site_visit", "closing", "won", "lost"]

  return (
    <Card title="متابعة مراحل العملاء (حسب المندوب)" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead>
            <tr className="border-b border-base-200 bg-base-50 dark:bg-base-900/50">
              <th className="py-3 px-4 font-medium text-base-700 dark:text-base-300">المندوب</th>
              {stages.map(stage => (
                <th key={stage} className="py-3 px-4 font-medium text-base-700 dark:text-base-300 text-center">
                  {STAGE_LABELS[stage] || stage}
                </th>
              ))}
              <th className="py-3 px-4 font-medium text-base-700 dark:text-base-300 text-center">الإجمالي</th>
              <th className="py-3 px-4 font-medium text-base-700 dark:text-base-300 text-center">نسبة التحويل</th>
            </tr>
          </thead>
          <tbody>
            {data.salesStageSummary.map((user) => {
              const wonCount = user.stages["won"] || 0
              const total = user.total
              const conversionRate = total > 0 ? ((wonCount / total) * 100).toFixed(1) : "0.0"
              
              return (
              <tr key={user.userId} className="border-b border-base-100 last:border-0 hover:bg-base-50 dark:hover:bg-base-900/30 transition-colors">
                <td className="py-3 px-4 font-medium text-base-900 dark:text-base-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                        {user.name.charAt(0)}
                    </div>
                    {user.name}
                  </div>
                </td>
                {stages.map(stage => (
                  <td key={stage} className="py-3 px-4 text-center">
                    {user.stages[stage] ? (
                      <Badge variant={STAGE_COLORS[stage] || "default"} className="min-w-[30px] justify-center">
                        {user.stages[stage]}
                      </Badge>
                    ) : (
                      <span className="text-base-300">-</span>
                    )}
                  </td>
                ))}
                <td className="py-3 px-4 text-center font-bold text-base-900 dark:text-white">
                  {user.total}
                </td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                  {conversionRate}%
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
