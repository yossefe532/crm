import { prisma } from "../prisma/client"
import { pushService } from "../modules/notifications/pushService"
import { smsService } from "../modules/notifications/smsService"
import { notificationService } from "../modules/notifications/service"
import { env } from "../config/env"

export const meetingReminderJob = async () => {
  const now = new Date()
  
  // Fetch pending reminders for meetings starting in the next 24 hours
  // This avoids fetching all reminders in the database
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  
  const reminders = await prisma.meetingReminder.findMany({
    where: {
      isSent: false,
      meeting: {
        startsAt: {
          gte: new Date(now.getTime() - 60 * 60 * 1000), // Include meetings from 1 hour ago (in case we missed a reminder slightly)
          lte: next24Hours
        }
      }
    },
    include: {
      meeting: {
        include: {
          lead: true,
          organizer: {
            include: { profile: true }
          },
          participants: {
            include: { user: true }
          }
        }
      }
    }
  })

  const dueReminders = reminders.filter(r => {
    if (!r.meeting) return false
    const scheduledTime = new Date(r.meeting.startsAt.getTime() - r.minutesBefore * 60000)
    return scheduledTime <= now
  })

  for (const reminder of dueReminders) {
    const { meeting, tenantId } = reminder
    const organizer = meeting.organizer

    // 1. Send Push/In-App to Organizer & Participants
    const recipients = new Set<string>()
    if (organizer) recipients.add(organizer.id)
    
    if (meeting.participants?.length) {
      meeting.participants.forEach(p => {
        if (p.userId) recipients.add(p.userId)
      })
    }

    const recipientIds = Array.from(recipients)

    if (recipientIds.length > 0) {
      // In-App Notification
      await notificationService.sendMany(recipientIds, {
        tenantId,
        type: "reminder",
        title: "تذكير باجتماع",
        message: `لديك اجتماع مع ${meeting.lead?.name || "عميل"} في الساعة ${meeting.startsAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
        entityType: "meeting",
        entityId: meeting.id,
        actionUrl: `/leads/${meeting.leadId}`,
        senderId: undefined
      }).catch(console.error)

      // Push Notification (Keep existing for organizer only for now, or loop?)
      // Let's loop for push
      for (const userId of recipientIds) {
          await pushService.send(tenantId, userId, {
            title: "تذكير باجتماع",
            body: `لديك اجتماع مع ${meeting.lead?.name || "عميل"} في الساعة ${meeting.startsAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
            url: `/leads/${meeting.leadId}`
          }).catch(console.error)
      }
    }

    // 2. Send SMS/In-App to Owner
    // Try to find owner in DB first
    const owners = await prisma.user.findMany({
      where: {
        tenantId,
        status: "active",
        roleLinks: { some: { role: { name: "owner" } } }
      },
      select: { id: true, phone: true }
    })

    // In-App for Owners
    if (owners.length > 0) {
      await notificationService.sendMany(
        owners.map(o => o.id),
        {
          tenantId,
          type: "reminder",
          title: "تذكير اجتماع لفريق المبيعات",
          message: `اجتماع لـ ${organizer?.profile?.firstName || organizer?.email} مع ${meeting.lead?.name || "عميل"} يبدأ ${meeting.startsAt.toLocaleTimeString('ar-EG')}`,
          entityType: "meeting",
          entityId: meeting.id,
          actionUrl: `/leads/${meeting.leadId}`,
          senderId: organizer?.id
        }
      ).catch(console.error)
    }

    const ownerPhone = owners.find(o => o.phone)?.phone || env.ownerPhoneNumber

    if (ownerPhone) {
      await smsService.send(ownerPhone, `تذكير: اجتماع لفريق المبيعات مع العميل ${meeting.lead?.name || "عميل"} يبدأ ${meeting.startsAt.toLocaleString('ar-EG')}`).catch(console.error)
    }

    // 3. Mark as sent
    await prisma.meetingReminder.update({
      where: { id: reminder.id },
      data: { isSent: true }
    })
  }
}
