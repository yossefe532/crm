"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { MeetingDatePicker } from "../../../components/meetings/MeetingDatePicker"
import { UpcomingMeetings } from "../../../components/meetings/UpcomingMeetings"

const AvailabilityCalendar = dynamic(
  () => import("../../../components/meetings/AvailabilityCalendar").then((mod) => mod.AvailabilityCalendar),
  { ssr: false }
)

export default function MeetingsPage() {
  const [showCalendar, setShowCalendar] = useState(false)
  return (
    <div className="space-y-6">
      <MeetingDatePicker />
      <UpcomingMeetings />
      <div className="md:hidden">
        <button
          className="rounded-md border border-base-200 bg-white px-3 py-2 text-sm text-base-700 shadow-sm"
          onClick={() => setShowCalendar((v) => !v)}
        >
          {showCalendar ? "إخفاء التقويم" : "عرض التقويم"}
        </button>
      </div>
      <div className="md:block">
        {(showCalendar || typeof window === "undefined") && (
          <div className="overflow-x-auto rounded-lg border border-base-200 bg-white p-2 md:p-4">
            <AvailabilityCalendar />
          </div>
        )}
      </div>
    </div>
  )
}
