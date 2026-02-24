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

export const AvailabilityCalendar = ({ date, onDateChange }: { date?: Date, onDateChange?: (date: Date) => void }) => {
  const { data } = useMeetings()
  const events = (data || []).map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    start: new Date(meeting.startsAt),
    end: new Date(meeting.endsAt),
    lead: meeting.lead,
    organizer: meeting.organizer
  }))

  const defaultView = typeof window !== "undefined" && window.innerWidth < 768 ? "agenda" : "month"
  
  const handleNavigate = (newDate: Date) => {
    if (onDateChange) onDateChange(newDate)
  }

  const CustomEvent = ({ event }: any) => (
    <div className="text-xs p-0.5 overflow-hidden">
      <div className="font-bold truncate">{event.title}</div>
      {event.lead && <div className="truncate text-[10px] opacity-90">👤 {event.lead.name}</div>}
      {event.organizer && <div className="truncate text-[10px] opacity-75">👔 {event.organizer.name}</div>}
    </div>
  )

  return (
    <Card title="توفر التقويم">
      <div className="h-[600px] overflow-x-auto">
        <div className="h-full min-w-[600px]">
          <Calendar 
            localizer={localizer} 
            events={events} 
            startAccessor="start" 
            endAccessor="end" 
            culture="ar"
            defaultView={defaultView}
            views={["month", "week", "day", "agenda"]}
            date={date}
            onNavigate={handleNavigate}
            components={{
              event: CustomEvent
            }}
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
