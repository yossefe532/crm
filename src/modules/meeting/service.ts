import { prisma } from "../../prisma/client"
import { UserPayload } from "../../utils/auth"
import { getModuleConfig } from "../../utils/moduleConfig"
import { conversationService } from "../conversations/service"
import { notificationService } from "../notifications/service"

import { pushService } from "../notifications/pushService"
import { smsService } from "../notifications/smsService"
import { env } from "../../config/env"

export const meetingService = {
  sendReminderNow: async (tenantId: string, meetingId: string) => {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId, tenantId }, include: { lead: true, organizer: true } })
    if (!meeting) throw { status: 404, message: "Meeting not found" }

    // 1. Send Chat Message from Owner to Organizer
    if (meeting.organizer) {
        // Find Owner
        const ownerRole = await prisma.role.findFirst({ where: { tenantId, name: "owner", deletedAt: null } })
        if (ownerRole) {
            const ownerUserLink = await prisma.userRole.findFirst({ 
                where: { tenantId, roleId: ownerRole.id, revokedAt: null },
                include: { user: { include: { profile: true } } }
            })
            
            if (ownerUserLink) {
                const ownerUser = ownerUserLink.user
                const ownerName = ownerUser.profile ? `${ownerUser.profile.firstName || ''} ${ownerUser.profile.lastName || ''}`.trim() : ownerUser.email

                // Ensure Direct Conversation
                const convo = await conversationService.ensureDirect(tenantId, ownerUser.id, meeting.organizer.id)
                
                // Send Message
                await conversationService.sendMessage(
                    tenantId, 
                    convo.id, 
                    { id: ownerUser.id, tenantId, roles: ["owner"] }, 
                    { content: `🔔 تذكير: لديك اجتماع مع العميل ${meeting.lead.name}\nالعنوان: ${meeting.title}\nالتوقيت: ${new Date(meeting.startsAt).toLocaleString('ar-EG')}` }
                )
            }
        }
    }

    // 2. Send Push to Organizer
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
        minutesBefore: 0,
        isSent: true
      }
    })
  },

  listMeetings: async (tenantId: string, user?: UserPayload | null) => {
    const baseWhere = { tenantId, lead: { deletedAt: null } }
    const include = { lead: true, organizer: true }
    
    if (!user) return prisma.meeting.findMany({ where: baseWhere, orderBy: { startsAt: "asc" }, include })
    
    if (user.roles.includes("owner")) {
      return prisma.meeting.findMany({ where: baseWhere, orderBy: { startsAt: "asc" }, include })
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
        orderBy: { startsAt: "asc" },
        include
      })
    }
    
    return prisma.meeting.findMany({ where: { ...baseWhere, organizerUserId: user.id }, orderBy: { startsAt: "asc" }, include })
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

    // Notify Organizer if different from creator (not passed here but we can assume context)
    // Actually we don't have creator context here easily.
    // But we can add participants.
    
    // Add organizer as participant
    if (data.organizerUserId) {
        await prisma.meetingParticipant.create({
            data: { tenantId, meetingId: meeting.id, userId: data.organizerUserId, status: "accepted" }
        })
    }

    // Create default reminder (30 mins before)
    if (startsAt.getTime() > Date.now() + 30 * 60 * 1000) {
      await prisma.meetingReminder.create({
        data: {
          tenantId,
          meetingId: meeting.id,
          minutesBefore: 30,
          isSent: false
        }
      })
    }
    
    return meeting
  },

  updateMeetingStatus: async (tenantId: string, meetingId: string, status: string, user?: UserPayload | null) => {
    const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, tenantId }, include: { lead: true, participants: true } })
    if (!meeting) throw { status: 404, message: "Meeting not found" }
    if (status === "completed" && meeting.startsAt > new Date()) throw { status: 400, message: "لا يمكن إنهاء الاجتماع قبل موعده" }
    if (user && !user.roles.includes("owner") && meeting.organizerUserId !== user.id) {
      throw { status: 403, message: "غير مصرح بتحديث هذا الاجتماع" }
    }
    
    const updated = await prisma.meeting.update({ where: { id: meetingId, tenantId }, data: { status } })

    if (status === "cancelled" || status === "rescheduled") {
        // Notify participants
        const participants = meeting.participants.filter(p => p.userId && p.userId !== user?.id).map(p => p.userId!)
        
        // Also notify organizer if someone else cancelled it (e.g. admin)
        if (meeting.organizerUserId && meeting.organizerUserId !== user?.id && !participants.includes(meeting.organizerUserId)) {
            participants.push(meeting.organizerUserId)
        }

        if (participants.length > 0) {
            await notificationService.sendMany(participants, {
                tenantId,
                type: "warning",
                title: status === "cancelled" ? "إلغاء الاجتماع" : "تغيير حالة الاجتماع",
                message: `تم تغيير حالة الاجتماع مع ${meeting.lead.name} إلى ${status}`,
                entityType: "meeting",
                entityId: meetingId,
                actionUrl: `/leads/${meeting.leadId}`,
                senderId: user?.id
            }).catch(console.error)
        }
    }

    return updated
  },

  createReminder: async (tenantId: string, data: { meetingId: string; scheduledAt: Date }) => {
    const meeting = await prisma.meeting.findUnique({ where: { id: data.meetingId } })
    if (!meeting) throw new Error("Meeting not found")
    const minutesBefore = Math.round((meeting.startsAt.getTime() - new Date(data.scheduledAt).getTime()) / 60000)
    return prisma.meetingReminder.create({ 
      data: { 
        tenantId, 
        meetingId: data.meetingId, 
        minutesBefore: Math.max(0, minutesBefore) 
      } 
    })
  },

  createRescheduleRequest: (tenantId: string, meetingId: string, requestedBy: string, proposedStartsAt: string, proposedEndsAt: string) =>
    prisma.meetingRescheduleRequest.create({ 
      data: { 
        tenantId, 
        meetingId, 
        requestedBy, 
        suggestedStart: new Date(proposedStartsAt), 
        suggestedEnd: new Date(proposedEndsAt) 
      } 
    })
}
