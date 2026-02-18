"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { ReportExport } from "../../../components/analytics/ReportExport"
import { AnalyticsDashboard } from "../../../components/analytics/AnalyticsDashboard"
import { PerformanceCharts } from "../../../components/analytics/PerformanceCharts"
import { TeamPerformance } from "../../../components/dashboard/TeamPerformance"
import { useAuth } from "../../../lib/auth/AuthContext"
import { Button } from "../../../components/ui/Button"
import { useQuery } from "@tanstack/react-query"
import { analyticsService } from "../../../lib/services/analyticsService"
import { Card } from "../../../components/ui/Card"

const DisciplineHeatmap = dynamic(() => import("../../../components/analytics/DisciplineHeatmap").then((mod) => mod.DisciplineHeatmap), { ssr: false })

export default function AnalyticsPage() {
  const { token, role, userId } = useAuth()
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly")
  const { data: performance } = useQuery({
    queryKey: ["employee-performance", period],
    queryFn: () => analyticsService.getEmployeePerformance(period, token || undefined),
    enabled: !!token
  })
  const visiblePerformance = (performance || []).filter((row) => {
    if (role === "sales") return row.userId === userId
    if (role === "team_leader") return true
    return true
  })
  return (
    <div className="space-y-6">
      <AnalyticsDashboard />
      <PerformanceCharts />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <DisciplineHeatmap />
        <TeamPerformance />
      <Card title="أداء الموظفين">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button type="button" variant={period === "weekly" ? "secondary" : "ghost"} onClick={() => setPeriod("weekly")}>
            أسبوعي
          </Button>
          <Button type="button" variant={period === "monthly" ? "secondary" : "ghost"} onClick={() => setPeriod("monthly")}>
            شهري
          </Button>
        </div>
        <div className="space-y-3">
          {visiblePerformance.slice(0, 3).map((row) => (
            <div key={row.userId} className="rounded-lg border border-base-100 px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-base-900">{row.name}</p>
                <span className="text-sm font-semibold text-base-900">سلوك: {row.points} نقطة</span>
              </div>
              <p className="text-xs text-base-500">
                مكالمات {row.breakdown.calls} • اجتماعات {row.breakdown.meetings} • رؤية موقع {row.breakdown.siteVisits} • صفقات ناجحة {row.breakdown.wins} • فشل {row.breakdown.fails}
              </p>
              <p className="text-xs text-base-500">نتائج: {row.revenue.toLocaleString("ar-EG")} إيراد</p>
            </div>
          ))}
          {visiblePerformance.length === 0 && <p className="text-sm text-base-500">لا توجد بيانات أداء بعد</p>}
        </div>
      </Card>
      </div>
      <ReportExport />
    </div>
  )
}
