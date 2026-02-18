"use client"

import { Calendar, dateFnsLocalizer } from "react-big-calendar"
import { format, parse, startOfWeek, getDay } from "date-fns"
import { ar } from "date-fns/locale"
import "react-big-calendar/lib/css/react-big-calendar.css"
import { Card } from "../ui/Card"
import { useMeetings } from "../../lib/hooks/useMeetings"

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { ar }
})

export const AvailabilityCalendar = () => {
  const { data } = useMeetings()
  const events = (data || []).map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    start: new Date(meeting.startsAt),
    end: new Date(meeting.endsAt)
  }))

  return (
    <Card title="توفر التقويم">
      <div className="h-[420px]">
        <Calendar localizer={localizer} events={events} startAccessor="start" endAccessor="end" culture="ar" />
      </div>
    </Card>
  )
}
