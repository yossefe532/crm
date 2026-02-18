import { prisma } from "../../prisma/client"
import { UserPayload } from "../../utils/auth"
import { getModuleConfig } from "../../utils/moduleConfig"

import { pushService } from "../notifications/pushService"
import { smsService } from "../notifications/smsService"
import { env } from "../../config/env"

export const meetingService = {
  sendReminderNow: async (tenantId: string, meetingId: string) => {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId, tenantId }, include: { lead: true, organizer: true } })
    if (!meeting) throw { status: 404, message: "Meeting not found" }

    // 1. Send Push to Organizer
    if (meeting.organizer) {
      await pushService.send(tenantId, meeting.organizer.id, {
        title: "تذكير فوري",
        body: `تذكير: اجتماع مع ${meeting.lead.name} (${meeting.title})`,
        url: `/leads/${meeting.leadId}`
      })
    }

    // 2. Send SMS to Owner
    if (env.ownerPhoneNumber) {
      await smsService.send(env.ownerPhoneNumber, `تذكير فوري: اجتماع لفريق المبيعات مع العميل ${meeting.lead.name} (${meeting.title})`)
    }

    await prisma.meetingReminder.create({
      data: {
        tenantId,
        meetingId,
        scheduledAt: new Date(),
        status: "sent"
      }
    })
  },

  listMeetings: async (tenantId: string, user?: UserPayload | null) => {
    const baseWhere = { tenantId }
    if (!user) return prisma.meeting.findMany({ where: baseWhere, orderBy: { startsAt: "asc" } })
    if (user.roles.includes("owner")) {
      return prisma.meeting.findMany({ where: baseWhere, orderBy: { startsAt: "asc" } })
    }
    if (user.roles.includes("team_leader")) {
      const teams = await prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } })
      const teamIds = teams.map((team) => team.id)
      const members = await prisma.teamMember.findMany({ where: { tenantId, teamId: { in: teamIds }, leftAt: null, deletedAt: null }, select: { userId: true } })
      const memberIds = Array.from(new Set([...members.map((row) => row.userId), user.id]))
      return prisma.meeting.findMany({
        where: {
          ...baseWhere,
          OR: [
            { organizerUserId: { in: memberIds } },
            { lead: { teamId: { in: teamIds } } }
          ]
        },
        orderBy: { startsAt: "asc" }
      })
    }
    return prisma.meeting.findMany({ where: { ...baseWhere, organizerUserId: user.id }, orderBy: { startsAt: "asc" } })
  },
  createMeeting: async (tenantId: string, data: { leadId: string; organizerUserId?: string; title: string; startsAt: string; endsAt: string; timezone?: string }) => {
    const lead = await prisma.lead.findFirst({ where: { tenantId, id: data.leadId, deletedAt: null } })
    if (!lead) throw { status: 404, message: "العميل غير موجود" }
    if (!data.organizerUserId || lead.assignedUserId !== data.organizerUserId) {
      throw { status: 403, message: "لا يمكن جدولة اجتماع لعميل غير مُسند إليك" }
    }
    const startsAt = new Date(data.startsAt)
    const endsAt = new Date(data.endsAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw { status: 400, message: "توقيت الاجتماع غير صحيح" }
    if (startsAt <= new Date()) throw { status: 400, message: "لا يمكن جدولة اجتماع في الماضي" }
    if (endsAt <= startsAt) throw { status: 400, message: "وقت نهاية الاجتماع يجب أن يكون بعد وقت البداية" }
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { timezone: true } })
    const timezone = data.timezone || tenant?.timezone || "UTC"
    const meeting = await prisma.meeting.create({
      data: {
        tenantId,
        leadId: data.leadId,
        organizerUserId: data.organizerUserId,
        title: data.title,
        startsAt,
        endsAt,
        timezone,
        status: "scheduled"
      }
    })

    const reminderTime = new Date(startsAt.getTime() - 30 * 60 * 1000)
    if (reminderTime > new Date()) {
      await prisma.meetingReminder.create({
        data: {
          tenantId,
          meetingId: meeting.id,
          scheduledAt: reminderTime,
          status: "queued"
        }
      })
    }
    
    return meeting
  },

  updateMeetingStatus: async (tenantId: string, meetingId: string, status: string, user?: UserPayload | null) => {
    const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, tenantId } })
    if (!meeting) throw { status: 404, message: "Meeting not found" }
    if (status === "completed" && meeting.startsAt > new Date()) throw { status: 400, message: "لا يمكن إنهاء الاجتماع قبل موعده" }
    if (user && !user.roles.includes("owner") && meeting.organizerUserId !== user.id) {
      throw { status: 403, message: "غير مصرح بتحديث هذا الاجتماع" }
    }
    return prisma.meeting.update({ where: { id: meetingId, tenantId }, data: { status } })
  },

  createRescheduleRequest: async (tenantId: string, meetingId: string, requestedBy: string, proposedStartsAt: string, proposedEndsAt: string) => {
    const config = await getModuleConfig(tenantId, "meeting")
    const maxReschedules = Number((config?.config as { maxReschedules?: number } | null)?.maxReschedules || 2)
    const count = await prisma.meetingRescheduleRequest.count({ where: { tenantId, meetingId } })
    if (count >= maxReschedules) throw { status: 400, message: "Reschedule limit reached" }
    return prisma.meetingRescheduleRequest.create({ data: { tenantId, meetingId, requestedBy, proposedStartsAt: new Date(proposedStartsAt), proposedEndsAt: new Date(proposedEndsAt) } })
  },

  createReminder: (tenantId: string, meetingId: string, scheduledAt: string) =>
    prisma.meetingReminder.create({ data: { tenantId, meetingId, scheduledAt: new Date(scheduledAt) } })
}
