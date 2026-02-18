import { addHours, isSameDay } from "date-fns"
import { Meeting } from "../types"

export const getConflicts = (meetings: Meeting[], selected?: Date) => {
  if (!selected) return []
  return meetings.filter((meeting) => isSameDay(new Date(meeting.startsAt), selected))
}

export const getDeadlineWarning = (selected?: Date) => {
  if (!selected) return null
  return addHours(selected, 24)
}
