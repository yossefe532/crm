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
import { ClientDate } from "../ui/ClientDate"

import Link from "next/link"

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
        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="rounded-xl border border-base-100 bg-base-0 px-4 py-3">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-1/3 rounded bg-base-200" />
                  <div className="h-3 w-1/4 rounded bg-base-200" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-6 w-16 rounded bg-base-200" />
                    <div className="h-6 w-20 rounded bg-base-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {isError && <p className="text-sm text-rose-500">تعذر تحميل الاجتماعات</p>}
        {(data || []).map((meeting) => (
          <div key={meeting.id} className="flex flex-col gap-4 rounded-xl border border-base-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-base-0 hover:shadow-sm transition-shadow">
            <div className="flex-1">
              <div className="flex items-start justify-between sm:block">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-base-900">{meeting.title}</p>
                    <Badge tone={statusLabels[meeting.status]?.tone || "default"}>{statusLabels[meeting.status]?.label || meeting.status}</Badge>
                  </div>
                  
                  {meeting.lead && (
                    <p className="text-sm text-base-700 mt-1">
                      العميل: <span className="font-medium">{meeting.lead.name}</span>
                    </p>
                  )}
                  
                  {role === "owner" && meeting.organizer && (
                    <p className="text-xs text-base-500 mt-1">
                      المنظم: {meeting.organizer.name || meeting.organizer.email || "غير معروف"}
                    </p>
                  )}

                  <ClientDate 
                    date={meeting.startsAt}
                    formatter={(d) => format(d, "PPpp", { locale: ar })}
                    className="text-xs text-base-500 mt-1 block"
                  />
                </div>
              </div>
            </div>
            <div className="flex w-full flex-row items-center justify-end gap-2 mt-2 sm:mt-0 sm:w-auto">
              {/* Lead Details Link */}
              <Link href={`/leads/${meeting.leadId}`} passHref>
                 <Button
                  variant="outline"
                  className="flex-1 sm:flex-none text-xs h-9"
                  title="عرض تفاصيل العميل"
                 >
                   عرض العميل
                 </Button>
              </Link>

              <Button
                variant="ghost"
                aria-label="إرسال تذكير"
                title="إرسال تذكير"
                className="flex-1 sm:flex-none text-xs h-9"
                disabled={reminderMutation.isPending}
                onClick={() => reminderMutation.mutate(meeting.id)}
              >
                {reminderMutation.isPending ? "جاري..." : "تذكير"}
              </Button>
              
              {/* Only show Done button if NOT owner */}
              {meeting.status !== "completed" && role !== "owner" && (
                <Button
                  variant="secondary"
                  aria-label="تم الاجتماع"
                  title="تم الاجتماع"
                  className="flex-1 sm:flex-none text-xs h-9"
                  disabled={statusMutation.isPending || (role !== "sales" && role !== "team_leader") || (meeting.organizerUserId !== userId && role !== "team_leader")}
                  onClick={() => statusMutation.mutate(meeting.id)}
                >
                  تم
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
