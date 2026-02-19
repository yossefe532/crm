"use client"

import { useEffect, useState } from "react"
import { MetricsGrid } from "../../../components/dashboard/MetricsGrid"
import { LeadList } from "../../../components/dashboard/LeadList"
import { CommissionOverview } from "../../../components/analytics/CommissionOverview"
import { UpcomingMeetings } from "../../../components/meetings/UpcomingMeetings"
import { ActivityLog } from "../../../components/dashboard/ActivityLog"
import { TaskList } from "../../../components/dashboard/TaskList"
import { RoleCatalog } from "../../../components/catalog/RoleCatalog"
import { IconShowcase } from "../../../components/catalog/IconShowcase"
import { NotificationsPanel } from "../../../components/notifications/NotificationsPanel"

const salesIcons = [
  { id: "apartment", label: "الشقق", url: "https://i.postimg.cc/jw3d52cH/apartment.gif", hint: "عروض حضرية" },
  { id: "house", label: "المنازل", url: "https://i.postimg.cc/wtHB4S3s/house.gif", hint: "خيارات سكنية" },
  { id: "property", label: "العقارات", url: "https://i.postimg.cc/xkR1wtbz/property.gif", hint: "مخزون متنوع" },
  { id: "contract-1", label: "إدارة العقود", url: "https://i.postimg.cc/VrkkmnjT/contract-(1).gif", hint: "توثيق الصفقات" },
  { id: "mortgage", label: "التمويل العقاري", url: "https://i.postimg.cc/ZB554p8b/mortgage.gif", hint: "خيارات الرهن" },
  { id: "agent-2", label: "الوكيل الميداني", url: "https://i.postimg.cc/kV95YkDv/real-estate-agent-(1).gif", hint: "التواصل المباشر" }
]

export default function SalesDashboard() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="h-32 rounded-xl bg-base-100 animate-pulse" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-xl bg-base-100 animate-pulse" />
          <div className="h-64 rounded-xl bg-base-100 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <IconShowcase title="عمليات المبيعات" items={salesIcons} />
      <RoleCatalog role="sales" />
      <MetricsGrid />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CommissionOverview />
        <UpcomingMeetings />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <LeadList />
        <div className="space-y-6">
          <NotificationsPanel />
          <ActivityLog />
          <TaskList />
        </div>
      </div>
    </div>
  )
}
