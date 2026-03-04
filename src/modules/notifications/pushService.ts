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

type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  metadata?: Record<string, unknown>
}

type PushSubscriptionInput = {
  endpoint: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

const toJsonPayload = (payload: PushPayload) =>
  JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/notifications",
    tag: payload.tag || "crm-doctor",
    metadata: payload.metadata || {}
  })

export const pushService = {
  getPublicKey: () => env.vapidPublicKey,
  
  getPolicy: async (tenantId: string) => {
    // Use moduleKey directly as Module model might not exist or be needed
    const config = await prisma.moduleConfig.findFirst({ 
      where: { 
        tenantId, 
        moduleKey: "notifications", 
        isEnabled: true 
      } 
    })
    
    const raw = (config?.config as Record<string, unknown>) || {}
    
    const policy = {
      enabled: config?.isEnabled !== false, // Default to true if no config found? Or false? Let's say true if no config but keys exist
      dailyLimit: Math.min(Number(raw.dailyLimit || 50), 100), // Increased default
      quietHours: {
        enabled: (raw.quietHours as Record<string, unknown> | undefined)?.enabled === true,
        start: Number((raw.quietHours as Record<string, unknown> | undefined)?.start ?? 22),
        end: Number((raw.quietHours as Record<string, unknown> | undefined)?.end ?? 8)
      }
    }
    return policy
  },

  subscribe: async (tenantId: string, userId: string, subscription: PushSubscriptionInput, userAgent?: string) => {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      throw new Error("Invalid push subscription payload")
    }

    await prisma.pushSubscription.upsert({
      where: {
        tenantId_endpoint: {
          tenantId,
          endpoint: subscription.endpoint
        }
      },
      update: {
        userId,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        userAgent: userAgent?.slice(0, 500),
        isActive: true,
        lastSeenAt: new Date(),
        failureReason: null
      },
      create: {
        tenantId,
        userId,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        userAgent: userAgent?.slice(0, 500),
        isActive: true
      }
    })
  },

  unsubscribe: async (tenantId: string, userId: string, endpoint: string) => {
    await prisma.pushSubscription.updateMany({
      where: { tenantId, userId, endpoint },
      data: {
        isActive: false,
        lastSeenAt: new Date()
      }
    })
  },

  hasActiveSubscription: async (tenantId: string, userId: string) => {
    const count = await prisma.pushSubscription.count({
      where: { tenantId, userId, isActive: true }
    })
    return count > 0
  },

  send: async (tenantId: string, userId: string, payload: { title: string; body: string; url?: string }) => {
    if (!env.vapidPublicKey || !env.vapidPrivateKey) {
      // console.warn("[Push] VAPID keys not configured")
      return
    }
    
    const policy = await pushService.getPolicy(tenantId)
    if (!policy.enabled) return
    
    const now = new Date()
    
    // Quiet hours check
    if (policy.quietHours.enabled) {
      const hour = now.getHours()
      if (policy.quietHours.start <= policy.quietHours.end) {
        if (hour >= policy.quietHours.start && hour < policy.quietHours.end) return
      } else {
        // Spans midnight (e.g. 22 to 08)
        if (hour >= policy.quietHours.start || hour < policy.quietHours.end) return
      }
    }
    
    // Quota check
    const channel = "push"
    const period = "daily" // or use dayKey logic if we want to reset daily
    
    // We need to handle daily reset logic manually or rely on a job. 
    // For now, let's just use "daily" as the period key, and check resetAt.
    // Ideally we should have a unique key for the day like "daily:2023-10-27" but schema says period is String.
    // If we use fixed "daily", we must check resetAt.
    
    let quota = await prisma.notificationQuota.findUnique({
      where: { 
        tenantId_userId_channel_period: { 
          tenantId, 
          userId, 
          channel, 
          period 
        } 
      }
    })

    // Reset quota if needed
    if (quota && quota.resetAt < now) {
      quota = await prisma.notificationQuota.update({
        where: { id: quota.id },
        data: {
          used: 0,
          resetAt: new Date(now.setHours(24, 0, 0, 0)) // Reset next midnight
        }
      })
    }

    if (quota && quota.used >= (quota.limit || policy.dailyLimit)) return

    // Increment usage
    if (quota) {
      await prisma.notificationQuota.update({
        where: { id: quota.id },
        data: { used: { increment: 1 } }
      })
    } else {
      // Create new quota
      await prisma.notificationQuota.create({
        data: {
          tenantId,
          userId,
          channel,
          period,
          limit: policy.dailyLimit,
          used: 1,
          resetAt: new Date(new Date().setHours(24, 0, 0, 0))
        }
      })
    }

    // Get subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        tenantId,
        userId,
        isActive: true
      }
    })

    let sentCount = 0
    const errors: string[] = []

    // Send notifications
    for (const subscription of subscriptions) {
      try {
        const webPushSubscription: webpush.PushSubscription = {
          endpoint: subscription.endpoint,
          expirationTime: null,
          keys: {
            p256dh: subscription.p256dhKey,
            auth: subscription.authKey
          }
        }
        await webpush.sendNotification(webPushSubscription, toJsonPayload(payload))
        sentCount += 1
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            isActive: true,
            lastSuccessAt: new Date(),
            lastFailureAt: null,
            failureReason: null,
            lastSeenAt: new Date()
          }
        })
      } catch (error) {
        const statusCode = (error as { statusCode?: number })?.statusCode
        const reason = error instanceof Error ? error.message : "Unknown push error"
        errors.push(reason)
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            isActive: statusCode === 404 || statusCode === 410 ? false : subscription.isActive,
            lastFailureAt: new Date(),
            failureReason: reason.slice(0, 500)
          }
        })
      }
    }

    return { sentCount, attempted: subscriptions.length, errors }
  },

  broadcast: async (tenantId: string, target: { type: "all" | "role" | "user"; value?: string }, message: string) => {
    let userIds: string[] = []

    if (target.type === "user" && target.value) {
      userIds = [target.value]
    } else if (target.type === "all") {
      const users = await prisma.user.findMany({ 
        where: { tenantId, deletedAt: null, status: "active" }, 
        select: { id: true } 
      })
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
