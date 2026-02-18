import { prisma } from "../prisma/client"

export const runMeetingDeadlineJob = async (tenantId: string) => {
  const now = new Date()
  const soon = new Date(now.getTime() + 2 * 3600 * 1000)
  const meetings = await prisma.meeting.findMany({ where: { tenantId, startsAt: { lte: soon }, status: "scheduled" } })
  for (const meeting of meetings) {
    const existingReminder = await prisma.meetingReminder.findFirst({ where: { tenantId, meetingId: meeting.id, scheduledAt: { lte: soon } } })
    if (!existingReminder) {
      await prisma.meetingReminder.create({ data: { tenantId, meetingId: meeting.id, scheduledAt: now } })
    }
  }
}
