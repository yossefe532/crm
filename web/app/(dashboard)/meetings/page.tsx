import dynamic from "next/dynamic"
import { MeetingDatePicker } from "../../../components/meetings/MeetingDatePicker"
import { UpcomingMeetings } from "../../../components/meetings/UpcomingMeetings"

const AvailabilityCalendar = dynamic(
  () => import("../../../components/meetings/AvailabilityCalendar").then((mod) => mod.AvailabilityCalendar),
  { ssr: false }
)

export default function MeetingsPage() {
  return (
    <div className="space-y-6">
      <MeetingDatePicker />
      <UpcomingMeetings />
      <AvailabilityCalendar />
    </div>
  )
}
