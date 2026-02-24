
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

  subscribe: async (tenantId: string, userId: string, subscription: any) => {
    // Store subscription in Note model using relatedTo/relatedId
    // relatedTo: "push_subscription"
    // relatedId: userId (Note: relatedId is UUID, so this fits if userId is UUID)
    
    const subString = JSON.stringify(subscription)
    
    // Check if subscription already exists to avoid duplicates
    const existing = await prisma.note.findFirst({
      where: {
        tenantId,
        relatedTo: "push_subscription",
        relatedId: userId,
        content: { contains: subString } 
      }
    })

    if (!existing) {
      await prisma.note.create({
        data: {
          tenantId,
          relatedTo: "push_subscription",
          relatedId: userId,
          content: subString,
          createdBy: userId
        }
      })
    }
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
    const subscriptions = await prisma.note.findMany({
      where: {
        tenantId,
        relatedTo: "push_subscription",
        relatedId: userId
      }
    })

    // Send notifications
    for (const subNote of subscriptions) {
      try {
        const subscription = JSON.parse(subNote.content)
        await webpush.sendNotification(subscription, JSON.stringify(payload))
      } catch (error) {
        console.error(`[Push] Failed to send to user ${userId}:`, error)
        // If 410 Gone, delete the subscription
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
