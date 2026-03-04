"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { analyticsService, TimelineEvent } from "../../lib/services/analyticsService"
import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"

export const ActivityTimeline = ({ leadId }: { leadId: string }) => {
  const { data: timeline, isLoading } = useQuery({
    queryKey: ["lead-timeline", leadId],
    queryFn: () => analyticsService.getLeadTimeline(leadId)
  })

  if (isLoading) return <Card title="سجل النشاط">جاري التحميل...</Card>

  const getEventIcon = (type: string) => {
    switch (type) {
      case "stage_change": return "🔄"
      case "assignment": return "👤"
      case "note": return "📝"
      case "meeting": return "📅"
      default: return "•"
    }
  }

  const getEventTitle = (event: TimelineEvent) => {
    switch (event.type) {
      case "stage_change": return `تغيير المرحلة من ${event.details.from || "البداية"} إلى ${event.details.to}`
      case "assignment": return `تم إسناد العميل إلى ${event.details.assignedTo?.email || "مستخدم"}`
      case "note": return "ملاحظة جديدة"
      case "meeting": return `اجتماع: ${event.details.title}`
      default: return "نشاط غير معروف"
    }
  }

  return (
    <Card title="سجل النشاط">
      <div className="relative border-r border-base-200 pr-4">
        {(timeline || []).map((event) => (
          <div key={event.id} className="mb-6 last:mb-0">
            <div className="absolute -right-1.5 mt-1.5 h-3 w-3 rounded-full border border-base-0 bg-base-300" />
            <div className="flex items-center gap-2">
              <span className="text-lg">{getEventIcon(event.type)}</span>
              <time className="text-sm text-base-500">
                {format(new Date(event.date), "PP p", { locale: ar })}
              </time>
            </div>
            <div className="mt-1 rounded-lg border border-base-200 bg-base-50 p-3">
              <p className="font-medium text-base-900">{getEventTitle(event)}</p>
              {event.type === "note" && <p className="mt-1 text-sm text-base-700">{event.details.content}</p>}
              {event.actor && (
                <p className="mt-2 text-xs text-base-500">
                  بواسطة: {event.actor.profile?.firstName ? `${event.actor.profile.firstName} ${event.actor.profile.lastName || ""}` : event.actor.email}
                </p>
              )}
            </div>
          </div>
        ))}
        {timeline?.length === 0 && <p className="text-base-500">لا يوجد نشاط مسجل</p>}
      </div>
    </Card>
  )
}
