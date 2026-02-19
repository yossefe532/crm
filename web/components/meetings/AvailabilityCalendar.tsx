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

  const defaultView = typeof window !== "undefined" && window.innerWidth < 768 ? "agenda" : "month"

  return (
    <Card title="توفر التقويم">
      <div className="h-[420px] overflow-x-auto">
        <div className="h-full">
          <Calendar 
            localizer={localizer} 
            events={events} 
            startAccessor="start" 
            endAccessor="end" 
            culture="ar"
            defaultView={defaultView}
            views={["month", "week", "day", "agenda"]}
            messages={{
              next: "التالي",
              previous: "السابق",
              today: "اليوم",
              month: "شهر",
              week: "أسبوع",
              day: "يوم",
              agenda: "أجندة",
              date: "التاريخ",
              time: "الوقت",
              event: "الحدث",
              noEventsInRange: "لا توجد أحداث في هذا النطاق"
            }}
          />
        </div>
      </div>
    </Card>
  )
}
