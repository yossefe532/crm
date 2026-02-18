"use client"

import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { useMeetings } from "../../lib/hooks/useMeetings"
import { useAuth } from "../../lib/auth/AuthContext"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { meetingService } from "../../lib/services/meetingService"
import { Card } from "../ui/Card"
import { Button } from "../ui/Button"
import { Badge } from "../ui/Badge"

export const UpcomingMeetings = () => {
  const { data, isLoading, isError } = useMeetings()
  const { token, userId, role } = useAuth()
  const queryClient = useQueryClient()
  const statusLabels: Record<string, { label: string; tone: "warning" | "success" | "default" }> = {
    pending: { label: "معلق", tone: "warning" },
    scheduled: { label: "مجدول", tone: "warning" },
    completed: { label: "تم", tone: "success" }
  }
  const reminderMutation = useMutation({
    mutationFn: (meetingId: string) => meetingService.sendReminderNow(meetingId),
    onSuccess: () => {
      alert("تم إرسال التذكير الفوري بنجاح")
      queryClient.invalidateQueries({ queryKey: ["meetings"] })
    }
  })
  const statusMutation = useMutation({
    mutationFn: (meetingId: string) => meetingService.updateStatus(meetingId, { status: "completed" }, token || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] })
    }
  })

  return (
    <Card title="الاجتماعات القادمة">
      <div className="space-y-3">
        {isLoading && <p className="text-sm text-base-500">جاري تحميل الاجتماعات...</p>}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل الاجتماعات</p>}
        {(data || []).map((meeting) => (
          <div key={meeting.id} className="flex flex-col gap-4 rounded-xl border border-base-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-base-0 hover:shadow-sm transition-shadow">
            <div className="flex-1">
              <p className="text-sm font-semibold text-base-900">{meeting.title}</p>
              <p className="text-xs text-base-500 mt-1">{format(new Date(meeting.startsAt), "PPpp", { locale: ar })}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={statusLabels[meeting.status]?.tone || "default"}>{statusLabels[meeting.status]?.label || meeting.status}</Badge>
              </div>
            </div>
            <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:w-auto">
              <Button
                variant="ghost"
                aria-label="إرسال تذكير"
                title="إرسال تذكير"
                disabled={reminderMutation.isPending}
                onClick={() => reminderMutation.mutate(meeting.id)}
              >
                {reminderMutation.isPending ? "جاري الإرسال..." : "إرسال تذكير"}
              </Button>
              {meeting.status !== "completed" && (
                <Button
                  variant="secondary"
                  aria-label="تم الاجتماع"
                  title="تم الاجتماع"
                  disabled={statusMutation.isPending || role !== "sales" || meeting.organizerUserId !== userId}
                  onClick={() => statusMutation.mutate(meeting.id)}
                >
                  تم الاجتماع
                </Button>
              )}
            </div>
          </div>
        ))}
      {!isLoading && !isError && (data || []).length === 0 && (
        <p className="text-sm text-base-500">لا توجد اجتماعات قادمة</p>
      )}
      </div>
    </Card>
  )
}
