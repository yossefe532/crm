import webpush from "web-push"
import { prisma } from "../../prisma/client"
import { env } from "../../config/env"

// Initialize web-push with keys
if (env.vapidPublicKey && env.vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:admin@example.com",
    env.vapidPublicKey,
    env.vapidPrivateKey
  )
}

export const pushService = {
  getPublicKey: () => env.vapidPublicKey,
  getPolicy: async (tenantId: string) => {
    const module = await prisma.module.findFirst({ where: { key: "notifications" } })
    const config = module
      ? await prisma.moduleConfig.findFirst({ where: { tenantId, moduleId: module.id, isActive: true } })
      : null
    const raw = (config?.config as Record<string, unknown>) || {}
    const policy = {
      enabled: raw.enabled !== false,
      dailyLimit: Math.min(Number(raw.dailyLimit || 10), 50),
      quietHours: {
        enabled: (raw.quietHours as Record<string, unknown> | undefined)?.enabled !== false,
        start: Number((raw.quietHours as Record<string, unknown> | undefined)?.start ?? 22),
        end: Number((raw.quietHours as Record<string, unknown> | undefined)?.end ?? 8)
      }
    }
    return policy
  },

  subscribe: async (tenantId: string, userId: string, subscription: any) => {
    // Store subscription in Note model to avoid schema changes for now
    // entityType: "push_subscription"
    // entityId: userId
    
    // Check if subscription already exists to avoid duplicates
    const subString = JSON.stringify(subscription)
    const existing = await prisma.note.findFirst({
      where: {
        tenantId,
        entityType: "push_subscription",
        entityId: userId,
        body: { contains: subString } 
      }
    })

    if (!existing) {
      await prisma.note.create({
        data: {
          tenantId,
          entityType: "push_subscription",
          entityId: userId,
          body: subString,
          createdBy: userId
        }
      })
    }
  },

  send: async (tenantId: string, userId: string, payload: { title: string; body: string; url?: string }) => {
    if (!env.vapidPublicKey || !env.vapidPrivateKey) {
      console.warn("[Push] VAPID keys not configured")
      return
    }
    const policy = await pushService.getPolicy(tenantId)
    if (!policy.enabled) return
    const now = new Date()
    if (policy.quietHours.enabled) {
      const hour = now.getHours()
      if (policy.quietHours.start <= policy.quietHours.end) {
        if (hour >= policy.quietHours.start && hour < policy.quietHours.end) return
      } else {
        if (hour >= policy.quietHours.start || hour < policy.quietHours.end) return
      }
    }
    const dayKey = now.toISOString().slice(0, 10)
    const quota = await prisma.notificationQuota.findUnique({
      where: { tenantId_userId_dayKey: { tenantId, userId, dayKey } }
    })
    if (quota && quota.sentCount >= policy.dailyLimit) return
    await prisma.notificationQuota.upsert({
      where: { tenantId_userId_dayKey: { tenantId, userId, dayKey } },
      update: { sentCount: { increment: 1 } },
      create: { tenantId, userId, dayKey, sentCount: 1 }
    })

    const subscriptions = await prisma.note.findMany({
      where: {
        tenantId,
        entityType: "push_subscription",
        entityId: userId
      }
    })

    for (const subNote of subscriptions) {
      try {
        const subscription = JSON.parse(subNote.body)
        await webpush.sendNotification(subscription, JSON.stringify(payload))
      } catch (error) {
        console.error(`[Push] Failed to send to user ${userId}:`, error)
        // If 410 Gone, we should delete the subscription
        if ((error as any)?.statusCode === 410) {
          await prisma.note.delete({ where: { id: subNote.id } })
        }
      }
    }
  },

  broadcast: async (tenantId: string, target: { type: "all" | "role" | "user"; value?: string }, message: string) => {
    let userIds: string[] = []

    if (target.type === "user" && target.value) {
      userIds = [target.value]
    } else if (target.type === "all") {
      const users = await prisma.user.findMany({ where: { tenantId, deletedAt: null, status: "active" }, select: { id: true } })
      userIds = users.map(u => u.id)
    } else if (target.type === "role" && target.value) {
      // Find users with role
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: "active",
          roleLinks: {
            some: {
              role: { name: target.value }
            }
          }
        },
        select: { id: true }
      })
      userIds = users.map(u => u.id)
    }

    for (const userId of userIds) {
      await pushService.send(tenantId, userId, {
        title: "إشعار إداري",
        body: message,
        url: "/"
      })
    }
  }
}
