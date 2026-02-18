import { prisma } from "../../prisma/client"
import { Prisma } from "@prisma/client"
import { pushService } from "./pushService"
import { smsService } from "./smsService"

export const notificationService = {
  listEvents: (tenantId: string, limit = 20) =>
    prisma.notificationEvent.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: limit }),
  publishEvent: (tenantId: string, eventKey: string, payload: Record<string, unknown>) =>
    prisma.notificationEvent.create({ data: { tenantId, eventKey, payload: payload as Prisma.InputJsonValue } }),

  createRule: (tenantId: string, data: { eventKey: string; channel: string; recipients?: Record<string, unknown>; templateRef?: string }) =>
    prisma.notificationRule.create({
      data: {
        tenantId,
        eventKey: data.eventKey,
        channel: data.channel,
        recipients: data.recipients ? (data.recipients as Prisma.InputJsonValue) : undefined,
        templateRef: data.templateRef
      }
    }),

  queueDelivery: (tenantId: string, eventId: string, channel: string, scheduledAt?: string) =>
    prisma.notificationDelivery.create({ data: { tenantId, eventId, channel, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined } }),

  broadcast: async (
    tenantId: string,
    target: { type: "all" | "role" | "user" | "users" | "team"; value?: string | string[] },
    message: string,
    channels: string[] = ["in_app", "push"],
    sender?: { id?: string; name?: string }
  ) => {
    const normalizedMessage = sender?.name ? `رسالة من ${sender.name}: ${message}` : `رسالة الإدارة: ${message}`
    let users: { id: string; phone?: string | null }[] = []

    if (target.type === "user" && typeof target.value === "string") {
      const user = await prisma.user.findUnique({ where: { id: target.value }, select: { id: true, phone: true } })
      if (user) users = [user]
    } else if (target.type === "users" && Array.isArray(target.value)) {
      users = await prisma.user.findMany({ where: { tenantId, id: { in: target.value }, deletedAt: null, status: "active" }, select: { id: true, phone: true } })
    } else if (target.type === "all") {
      users = await prisma.user.findMany({ where: { tenantId, deletedAt: null, status: "active" }, select: { id: true, phone: true } })
    } else if (target.type === "role" && typeof target.value === "string") {
      users = await prisma.user.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: "active",
          roleLinks: { some: { role: { name: target.value } } }
        },
        select: { id: true, phone: true }
      })
    } else if (target.type === "team" && typeof target.value === "string") {
      const members = await prisma.teamMember.findMany({
        where: { tenantId, teamId: target.value, leftAt: null, deletedAt: null },
        select: { userId: true }
      })
      const team = await prisma.team.findFirst({ where: { tenantId, id: target.value } })
      const userIds = Array.from(new Set([...(team?.leaderUserId ? [team.leaderUserId] : []), ...members.map((row) => row.userId)]))
      users = await prisma.user.findMany({ where: { tenantId, id: { in: userIds }, deletedAt: null, status: "active" }, select: { id: true, phone: true } })
    }

    // 1. Store History (In-App)
    if (channels.includes("in_app")) {
      await prisma.notificationEvent.create({
        data: {
          tenantId,
          eventKey: "admin.broadcast",
          payload: {
            messageAr: normalizedMessage,
            target,
            recipients: users.map((u) => u.id),
            senderUserId: sender?.id,
            senderName: sender?.name
          } as Prisma.InputJsonValue
        }
      })
    }

    // 2. Send Push
    if (channels.includes("push")) {
      for (const user of users) {
        await pushService.send(tenantId, user.id, {
          title: "إشعار إداري",
          body: normalizedMessage,
          url: "/"
        })
      }
    }

    // 3. Send SMS
    if (channels.includes("sms")) {
      for (const user of users) {
        if (user.phone) {
          await smsService.send(user.phone, normalizedMessage)
        }
      }
    }
  }
}
