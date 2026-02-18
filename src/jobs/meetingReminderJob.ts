import { prisma } from "../prisma/client"
import { pushService } from "../modules/notifications/pushService"
import { smsService } from "../modules/notifications/smsService"
import { env } from "../config/env"

export const meetingReminderJob = async () => {
  const now = new Date()
  const reminders = await prisma.meetingReminder.findMany({
    where: {
      status: "queued",
      scheduledAt: { lte: now }
    },
    include: {
      meeting: {
        include: {
          lead: true,
          organizer: true
        }
      }
    }
  })

  for (const reminder of reminders) {
    const { meeting, tenantId } = reminder
    const organizer = meeting.organizer

    // 1. Send Push to Organizer
    if (organizer) {
      await pushService.send(tenantId, organizer.id, {
        title: "تذكير باجتماع",
        body: `لديك اجتماع مع ${meeting.lead.name || "عميل"} في الساعة ${meeting.startsAt.toLocaleTimeString('ar-EG')}`,
        url: `/leads/${meeting.leadId}`
      })
    }

    // 2. Send SMS to Owner
    // Try to find owner in DB first
    const owners = await prisma.user.findMany({
      where: {
        tenantId,
        status: "active",
        roleLinks: { some: { role: { name: "owner" } } }
      },
      select: { phone: true }
    })

    const ownerPhone = owners.find(o => o.phone)?.phone || env.ownerPhoneNumber

    if (ownerPhone) {
      await smsService.send(ownerPhone, `تذكير: اجتماع لفريق المبيعات مع العميل ${meeting.lead.name || "عميل"} يبدأ ${meeting.startsAt.toLocaleString('ar-EG')}`)
    }

    // 3. Mark as sent
    await prisma.meetingReminder.update({
      where: { id: reminder.id },
      data: { status: "sent" }
    })
  }
}
