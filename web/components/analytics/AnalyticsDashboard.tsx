"use client"

import { useQuery } from "@tanstack/react-query"
import { analyticsService } from "../../lib/services/analyticsService"
import { Card } from "../ui/Card"
import { Stat } from "../ui/Stat"
import { Skeleton } from "../ui/Skeleton"
import { ExportButton } from "../ui/ExportButton"
import { useAuth } from "../../lib/auth/AuthContext"

export const AnalyticsDashboard = () => {
  const { token } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => analyticsService.getDashboardMetrics(token || undefined)
  })

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="grid gap-4 md:gap-6 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }
  if (!data) return <div className="text-center p-8 text-red-500">فشل تحميل البيانات</div>

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid gap-4 md:gap-6 md:grid-cols-3">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <Stat
            label="معدل التحويل"
            value={`${data.conversion.rate.toFixed(1)}%`}
          />
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <Stat
            label="إجمالي العملاء"
            value={data.conversion.total.toString()}
          />
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <Stat
            label="صفقات ناجحة"
            value={data.conversion.won.toString()}
          />
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card title="توزيع العملاء حسب المرحلة">
          <div className="space-y-4">
            {data.distribution.map((item) => (
              <div key={item.stage} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{item.stage}</span>
                  <span className="text-gray-500">{item.count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${data.conversion.total > 0 ? (item.count / data.conversion.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {data.distribution.length === 0 && <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card 
          title="أداء فريق المبيعات"
          actions={
            <ExportButton
              data={data.salesPerformance}
              filename="sales-performance"
              headers={["المندوب", "عدد الصفقات", "قيمة الصفقات", "إجمالي التفاعلات", "معدل التحويل"]}
              keys={["name", "deals", "value", "total", "conversionRate"]}
            />
          }
        >
          {/* Mobile View */}
          <div className="space-y-4 sm:hidden">
            {data.salesPerformance.map((user) => (
              <div key={user.userId} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">{user.name}</span>
                  <span className="text-sm text-gray-500">{user.deals} صفقة</span>
                </div>
                <div className="text-sm text-gray-600">
                  قيمة الصفقات: <span className="font-medium text-gray-900">{user.value.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {data.salesPerformance.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-4">لا توجد بيانات أداء</p>
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium px-4">المندوب</th>
                  <th className="pb-3 font-medium px-4">عدد الصفقات</th>
                  <th className="pb-3 font-medium px-4">قيمة الصفقات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.salesPerformance.map((user) => (
                  <tr key={user.userId} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{user.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{user.deals}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{user.value.toLocaleString()}</td>
                  </tr>
                ))}
                {data.salesPerformance.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-sm text-gray-500">لا توجد بيانات أداء</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="أداء الفرق (Team Leaders)">
          {/* Mobile View */}
          <div className="space-y-4 sm:hidden">
            {data.teamPerformance.map((team) => (
              <div key={team.teamId} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">{team.teamName}</span>
                  <span className="text-sm text-gray-500">{team.deals} صفقة</span>
                </div>
                <div className="text-sm text-gray-600">
                  القائد: <span className="font-medium text-gray-900">{team.leaderName}</span>
                </div>
              </div>
            ))}
            {data.teamPerformance.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-4">لا توجد بيانات فرق</p>
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium px-4">الفريق</th>
                  <th className="pb-3 font-medium px-4">القائد</th>
                  <th className="pb-3 font-medium px-4">الصفقات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.teamPerformance.map((team) => (
                  <tr key={team.teamId} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{team.teamName}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{team.leaderName}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{team.deals}</td>
                  </tr>
                ))}
                {data.teamPerformance.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-sm text-gray-500">لا توجد بيانات فرق</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
