"use client"

import { Card } from "../ui/Card"
import { Stat } from "../ui/Stat"
import { useMetrics } from "../../lib/hooks/useMetrics"
import Link from "next/link"
import { useUsers } from "../../lib/hooks/useUsers"

export const MetricsGrid = () => {
  const { data, isLoading, isError } = useMetrics()
  const { data: users } = useUsers()

  // Calculate real metrics for users only (leads are paginated, so we trust backend for counts)
  const salesCount = users?.filter(u => u.roles?.includes('sales')).length || 0
  const teamLeaderCount = users?.filter(u => u.roles?.includes('team_leader')).length || 0
  const totalUsers = users?.length || 0

  const modifiedData = data?.map(metric => {
    // console.log("Metric label:", metric.label) // Debugging

    if (metric.label === "إجمالي العملاء" || metric.label === "Total Leads") {
      return {
        ...metric,
        // value: Use backend value because leads list is paginated
        href: "/pipeline"
      }
    }
    if (metric.label === "عملاء جدد" || metric.label === "عملاء جدد (شهري)" || metric.label === "New Leads") {
      return {
        ...metric,
        // value: Use backend value
        href: "/pipeline"
      }
    }
    // Match both spellings just in case
    if (metric.label.includes("عملاء نشطين") || metric.label.includes("عملاء نشيطين") || metric.label === "Active Clients" || metric.label === "المستخدمين النشطين") {
      return {
        ...metric,
        label: "المستخدمين النشطين",
        value: totalUsers.toLocaleString("ar-EG"),
        subtext: `مبيعات: ${salesCount} | تيم ليدر: ${teamLeaderCount}`,
        href: "/settings/users"
      }
    }
    return metric
  })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {isLoading && (
        <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-24 bg-base-200 rounded" />
                <div className="h-8 w-32 bg-base-200 rounded" />
                <div className="h-3 w-20 bg-base-200 rounded" />
              </div>
            </Card>
          ))}
        </div>
      )}
      {isError && <p className="col-span-full text-sm text-rose-500">تعذر تحميل المؤشرات</p>}
      {(modifiedData || data)?.map((metric) => {
        const content = (
          <Card key={metric.label} className={`min-h-[120px] ${(metric as any).href ? 'hover:bg-base-50 transition-colors cursor-pointer' : ''}`}>
            <Stat 
              label={metric.label} 
              value={metric.value} 
              change={metric.change} 
              subtext={(metric as any).subtext}
            />
          </Card>
        )
        
        return (metric as any).href ? (
          <Link key={metric.label} href={(metric as any).href} className="block no-underline">
            {content}
          </Link>
        ) : content
      })}
    </div>
  )
}
