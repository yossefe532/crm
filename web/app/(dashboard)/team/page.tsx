import { MetricsGrid } from "../../../components/dashboard/MetricsGrid"
import { TeamPerformance } from "../../../components/dashboard/TeamPerformance"
import { KanbanBoard } from "../../../components/pipeline/KanbanBoard"
import { LeadList } from "../../../components/dashboard/LeadList"
import { UpcomingMeetings } from "../../../components/meetings/UpcomingMeetings"
import { LeadDistribution } from "../../../components/dashboard/LeadDistribution"
import { RoleCatalog } from "../../../components/catalog/RoleCatalog"
import { IconShowcase } from "../../../components/catalog/IconShowcase"
import { NotificationsPanel } from "../../../components/notifications/NotificationsPanel"

const teamIcons = [
  { id: "blueprint", label: "المخططات", url: "https://i.postimg.cc/9RQQCZdW/blueprint.gif", hint: "تفاصيل المشاريع" },
  { id: "plan", label: "خطة الفريق", url: "https://i.postimg.cc/jWXSpZ7V/plan.gif", hint: "تنسيق المهام" },
  { id: "calendar", label: "جدولة الاجتماعات", url: "https://i.postimg.cc/62pptnrQ/calendar.gif", hint: "إدارة المواعيد" },
  { id: "agent", label: "قادة ومندوبون", url: "https://i.postimg.cc/bGTw7329/real-estate-agent.gif", hint: "توزيع الأدوار" },
  { id: "search", label: "بحث العملاء", url: "https://i.postimg.cc/XZ8YRQyP/search.gif", hint: "فرز سريع" }
]

export default function TeamDashboard() {
  return (
    <div className="space-y-6 p-4 md:p-6">
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
  )
}
