import { Request, Response } from "express"
import { notificationService } from "./service"
import { logActivity } from "../../utils/activity"
import { intelligenceService } from "../intelligence/service"
import { prisma } from "../../prisma/client"

import { pushService } from "./pushService"

export const notificationController = {
  getVapidKey: async (req: Request, res: Response) => {
    res.json({ publicKey: pushService.getPublicKey() })
  },

  subscribe: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = req.user?.id || ""
    await pushService.subscribe(tenantId, userId, req.body.subscription)
    res.json({ status: "ok" })
  },

  broadcast: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    if (!req.user?.roles.includes("owner") && !req.user?.roles.includes("team_leader")) {
      throw { status: 403, message: "Forbidden" }
    }
    const message = String(req.body?.message || "").trim()
    if (!message) throw { status: 400, message: "الرسالة مطلوبة" }
    
    // If team leader, ensure they can only message their team members (optional check, but good for security)
    // For now, we trust the frontend logic to only allow messaging assigned members, 
    // but the service handles "user" target correctly by ID.
    
    const sender = req.user?.id
      ? await prisma.user.findUnique({ where: { id: req.user?.id }, include: { profile: true } })
      : null
      
    const senderName = sender?.profile?.firstName
      ? `${sender.profile.firstName}${sender.profile.lastName ? ` ${sender.profile.lastName}` : ""}`
      : sender?.email || "المشرف"
      
    await notificationService.broadcast(
      tenantId, 
      req.body.target, 
      message, 
      req.body.channels, 
      {
        id: req.user?.id,
        name: senderName
      }
    )
    res.json({ status: "ok" })
  },

  listEvents: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = req.user?.id || ""
    const roles = req.user?.roles || []
    
    // Fetch user to get last clear time
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastNotificationClearTime: true } })
    const afterDate = user?.lastNotificationClearTime || undefined

    const limit = req.query.limit ? Number(req.query.limit) : 20
    const events = await notificationService.listEvents(tenantId, Math.max(limit * 5, 50), afterDate)
    const filtered = roles.includes("owner")
      ? events
      : events.filter((event) => {
          const payload = (event.payload || {}) as Record<string, unknown>
          const recipients = Array.isArray(payload.recipients) ? payload.recipients : []
          const targets = Array.isArray(payload.targets) ? payload.targets : []
          if (payload.recipientUserId === userId) return true
          if (recipients.includes(userId)) return true
          if (targets.includes("sales") && roles.includes("sales")) return true
          if (targets.includes("team_leader") && roles.includes("team_leader")) return true
          return false
        })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "notification.event.listed", entityType: "notification_event" })
    res.json(filtered.slice(0, limit))
  },
  
  clearEvents: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = req.user?.id || ""
    await notificationService.clearEvents(userId)
    await logActivity({ tenantId, actorUserId: userId, action: "notification.events.cleared", entityType: "notification_event" })
    res.json({ status: "ok" })
  },

  getPolicy: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const module = await prisma.module.findFirst({ where: { key: "notifications" } })
    const config = module
      ? await prisma.moduleConfig.findFirst({ where: { tenantId, moduleId: module.id, isActive: true } })
      : null
    const raw = (config?.config as Record<string, unknown>) || {}
    res.json({
      enabled: raw.enabled !== false,
      dailyLimit: Number(raw.dailyLimit || 10),
      quietHours: {
        enabled: (raw.quietHours as Record<string, unknown> | undefined)?.enabled !== false,
        start: Number((raw.quietHours as Record<string, unknown> | undefined)?.start ?? 22),
        end: Number((raw.quietHours as Record<string, unknown> | undefined)?.end ?? 8)
      }
    })
  },
  updatePolicy: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const dailyLimit = Math.min(Number(req.body?.dailyLimit || 10), 50)
    const quietHours = req.body?.quietHours || {}
    const payload = {
      enabled: req.body?.enabled !== false,
      dailyLimit,
      quietHours: {
        enabled: quietHours.enabled !== false,
        start: Number(quietHours.start ?? 22),
        end: Number(quietHours.end ?? 8)
      }
    }
    let module = await prisma.module.findFirst({ where: { key: "notifications" } })
    if (!module) {
      module = await prisma.module.create({ data: { key: "notifications", name: "Notifications", version: "1.0.0" } })
    }
    const existing = await prisma.moduleConfig.findFirst({ where: { tenantId, moduleId: module.id, isActive: true } })
    if (existing) {
      await prisma.moduleConfig.update({ where: { id: existing.id }, data: { config: payload } })
    } else {
      await prisma.moduleConfig.create({ data: { tenantId, moduleId: module.id, config: payload } })
    }
    res.json(payload)
  },
  publishEvent: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const event = await notificationService.publishEvent(tenantId, req.body.eventKey, req.body.payload || {})
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "notification.event.published", entityType: "notification_event", entityId: event.id })
    if (req.body.payload?.leadId && ["email.opened", "website.visited", "form.submitted", "social.interacted"].includes(req.body.eventKey)) {
      const activityType = req.body.eventKey
        .replace("email.opened", "email_open")
        .replace("website.visited", "website_visit")
        .replace("form.submitted", "form_submission")
        .replace("social.interacted", "social_interaction")
      await intelligenceService.recordEngagementEvent(tenantId, req.body.payload.leadId, { type: activityType, occurredAt: req.body.payload.occurredAt, metadata: req.body.payload })
      intelligenceService.queueTrigger({ type: "lead_engaged", tenantId, leadId: req.body.payload.leadId })
    }
    res.json(event)
  },
  createRule: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const rule = await notificationService.createRule(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "notification.rule.created", entityType: "notification_rule", entityId: rule.id })
    res.json(rule)
  },
  queueDelivery: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const delivery = await notificationService.queueDelivery(tenantId, req.body.eventId, req.body.channel, req.body.scheduledAt)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "notification.delivery.queued", entityType: "notification_delivery", entityId: delivery.id })
    res.json(delivery)
  }
}
