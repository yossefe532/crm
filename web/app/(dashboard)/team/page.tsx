"use client"

import { useEffect, useState } from "react"
import { MetricsGrid } from "../../../components/dashboard/MetricsGrid"
import { TeamPerformance } from "../../../components/dashboard/TeamPerformance"
import { KanbanBoard } from "../../../components/pipeline/KanbanBoard"
import { LeadList } from "../../../components/dashboard/LeadList"
import { UpcomingMeetings } from "../../../components/meetings/UpcomingMeetings"
import { LeadDistribution } from "../../../components/dashboard/LeadDistribution"
import { RoleCatalog } from "../../../components/catalog/RoleCatalog"
import { IconShowcase } from "../../../components/catalog/IconShowcase"
import { NotificationsPanel } from "../../../components/notifications/NotificationsPanel"
import { TeamManagementTab } from "../../../components/team/TeamManagementTab"

const teamIcons = [
  { id: "blueprint", label: "المخططات", url: "https://i.postimg.cc/9RQQCZdW/blueprint.gif", hint: "تفاصيل المشاريع" },
  { id: "plan", label: "خطة الفريق", url: "https://i.postimg.cc/jWXSpZ7V/plan.gif", hint: "تنسيق المهام" },
  { id: "calendar", label: "جدولة الاجتماعات", url: "https://i.postimg.cc/62pptnrQ/calendar.gif", hint: "إدارة المواعيد" },
  { id: "agent", label: "قادة ومندوبون", url: "https://i.postimg.cc/bGTw7329/real-estate-agent.gif", hint: "توزيع الأدوار" },
  { id: "search", label: "بحث العملاء", url: "https://i.postimg.cc/XZ8YRQyP/search.gif", hint: "فرز سريع" }
]

export default function TeamDashboard() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<"dashboard" | "management">("dashboard")

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
      {/* Tabs Header */}
      <div className="flex items-center gap-6 border-b border-base-200">
        <button 
          onClick={() => setActiveTab("dashboard")}
          className={`pb-3 px-2 font-medium transition-all relative ${
            activeTab === "dashboard" 
              ? "text-brand-600 border-b-2 border-brand-600" 
              : "text-base-500 hover:text-base-700 hover:border-b-2 hover:border-base-300"
          }`}
        >
          لوحة القيادة
        </button>
        <button 
          onClick={() => setActiveTab("management")}
          className={`pb-3 px-2 font-medium transition-all relative ${
            activeTab === "management" 
              ? "text-brand-600 border-b-2 border-brand-600" 
              : "text-base-500 hover:text-base-700 hover:border-b-2 hover:border-base-300"
          }`}
        >
          إدارة الفريق
        </button>
      </div>

      {activeTab === "dashboard" ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <IconShowcase title="تشغيل الفريق" items={teamIcons} />
          <RoleCatalog role="team_leader" />
          <MetricsGrid />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TeamPerformance />
            <LeadDistribution />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <NotificationsPanel />
            <UpcomingMeetings />
          </div>
          <div className="grid grid-cols-1 gap-6">
            <KanbanBoard />
            <LeadList />
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <TeamManagementTab />
        </div>
      )}
    </div>
  )
}
