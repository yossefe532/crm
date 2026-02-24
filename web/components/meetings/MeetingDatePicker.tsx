"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { DayPicker } from "react-day-picker"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { Card } from "../ui/Card"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Select } from "../ui/Select"
import { useMeetings } from "../../lib/hooks/useMeetings"
import { getConflicts, getDeadlineWarning } from "../../lib/utils/meetingUtils"
import { useLeads } from "../../lib/hooks/useLeads"
import { useAuth } from "../../lib/auth/AuthContext"
import { useLocale } from "../../lib/i18n/LocaleContext"
import { meetingService } from "../../lib/services/meetingService"
import { useMutation, useQueryClient } from "@tanstack/react-query"

export const MeetingDatePicker = ({ date: propDate, onDateChange }: { date?: Date, onDateChange?: (date: Date) => void }) => {
  const { data, isLoading, isError } = useMeetings()
  const { data: leads } = useLeads()
  const { token, role, userId } = useAuth()
  const { dir } = useLocale()
  const queryClient = useQueryClient()

  const [selected, setSelected] = useState<Date | undefined>(propDate || new Date())

  useEffect(() => {
    if (propDate) {
      setSelected(propDate)
    }
  }, [propDate])

  const [leadId, setLeadId] = useState("")
  const [title, setTitle] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  // Sync DayPicker with input
  const handleDaySelect = (date: Date | undefined) => {
    setSelected(date)
    if (onDateChange && date) {
      onDateChange(date)
    }
    if (date) {
      // If there's an existing time in startsAt, preserve it. Otherwise default to 09:00
      let hour = 9
      let minute = 0
      if (startsAt) {
        const d = new Date(startsAt)
        hour = d.getHours()
        minute = d.getMinutes()
      }
      
      const newStart = new Date(date)
      newStart.setHours(hour, minute)
      setStartsAt(format(newStart, "yyyy-MM-dd'T'HH:mm"))

      // Default duration 1 hour
      const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000)
      setEndsAt(format(newEnd, "yyyy-MM-dd'T'HH:mm"))
    }
  }

  // Sync input with DayPicker
  const handleStartChange = (value: string) => {
    setStartsAt(value)
    if (value) {
      setSelected(new Date(value))
      // Update endsAt if empty or before startsAt
      const newStart = new Date(value)
      if (!endsAt || new Date(endsAt) <= newStart) {
         const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000)
         setEndsAt(format(newEnd, "yyyy-MM-dd'T'HH:mm"))
      }
    }
  }

  const visibleLeads =
    role === "sales" ? (leads || []).filter((lead) => lead.assignedUserId === userId) : []
  const conflicts = useMemo(() => getConflicts(data || [], selected), [data, selected])
  const deadlineWarning = getDeadlineWarning(selected)
  const mutation = useMutation({
    mutationFn: () =>
      meetingService.create(
        {
          leadId,
          title,
          startsAt,
          endsAt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        token || undefined
      ),
    onSuccess: () => {
      setMessage("تم جدولة الاجتماع بنجاح")
      setLeadId("")
      setTitle("")
      setStartsAt("")
      setEndsAt("")
      queryClient.invalidateQueries({ queryKey: ["meetings"] })
    }
  })

  return (
    <Card title="جدولة الاجتماعات">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          {isLoading && <p className="mb-2 text-sm text-base-500">جاري تحميل المواعيد المتاحة...</p>}
          {isError && <p className="mb-2 text-sm text-rose-500">تعذر تحميل المواعيد</p>}
          <DayPicker mode="single" selected={selected} onSelect={handleDaySelect} dir={dir} />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-base-100 p-4">
            <p className="text-sm font-semibold text-base-900">التاريخ المختار</p>
            <p className="text-sm text-base-500">{selected ? format(selected, "PPP", { locale: ar }) : "غير محدد"}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-base-900">التعارضات</p>
            {conflicts.length === 0 && <p className="text-sm text-base-500">لا توجد تعارضات</p>}
            {conflicts.map((meeting) => (
              <div key={meeting.id} className="flex items-center justify-between rounded-lg border border-base-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-base-900">{meeting.title}</p>
                  <p className="text-xs text-base-500">{format(new Date(meeting.startsAt), "p", { locale: ar })}</p>
                </div>
                <Badge tone="warning">تعارض</Badge>
              </div>
            ))}
          </div>
          {deadlineWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              تنبيه تمديد: يرجى تأكيد المواعيد قبل {format(deadlineWarning, "PPpp", { locale: ar })}.
            </div>
          )}
          {role !== "sales" && <p className="text-sm text-base-500">يمكن للمندوب المسند فقط جدولة الاجتماعات</p>}
          <form
            className="space-y-3"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              setMessage(null)
              if (!leadId || !title || !startsAt || !endsAt) {
                setMessage("يرجى إدخال كل بيانات الاجتماع")
                return
              }
              mutation.mutate()
            }}
          >
            <Select
              label="العميل"
              className="text-right"
              value={leadId}
              onChange={(event) => setLeadId(event.target.value)}
              disabled={role !== "sales"}
            >
              <option value="">اختر العميل</option>
              {visibleLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}
                </option>
              ))}
            </Select>
            <Input
              label="عنوان الاجتماع"
              className="text-right"
              placeholder="عنوان الاجتماع"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={role !== "sales"}
            />
            <Input
              label="بداية الاجتماع"
              type="datetime-local"
              className="text-right"
              value={startsAt}
              onChange={(event) => handleStartChange(event.target.value)}
              disabled={role !== "sales"}
            />
            <Input
              label="نهاية الاجتماع"
              type="datetime-local"
              className="text-right"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              disabled={role !== "sales"}
            />
            <Button aria-label="جدولة اجتماع" title="جدولة اجتماع" disabled={mutation.isPending || role !== "sales"}>
              {mutation.isPending ? "جاري الجدولة..." : "جدولة اجتماع"}
            </Button>
            {message && <p className="text-sm text-base-700">{message}</p>}
          </form>
        </div>
      </div>
    </Card>
  )
}
