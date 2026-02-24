import { Request, Response } from "express"
import { notificationService } from "./service"
import { logActivity } from "../../utils/activity"
import { intelligenceService } from "../intelligence/service"
import { prisma } from "../../prisma/client"
import { pushService } from "./pushService"

export const notificationController = {
  // --- New Methods ---

  list: async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unreadOnly === "true";

      const result = await notificationService.list(req.user!.id, { page, limit, unreadOnly });
      res.json(result);
    } catch (error) {
      console.error("Error listing notifications:", error);
      res.status(500).json({ message: "Failed to list notifications" });
    }
  },

  getUnreadCount: async (req: Request, res: Response) => {
    try {
      const count = await notificationService.getUnreadCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  },

  markAllAsRead: async (req: Request, res: Response) => {
    try {
      await notificationService.markAllAsRead(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all as read:", error);
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  },

  markAsRead: async (req: Request, res: Response) => {
    try {
      await notificationService.markAsRead(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  },

  archive: async (req: Request, res: Response) => {
    try {
      await notificationService.archive(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error archiving notification:", error);
      res.status(500).json({ message: "Failed to archive notification" });
    }
  },

  archiveAll: async (req: Request, res: Response) => {
    try {
      await notificationService.archiveAll(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error archiving all notifications:", error);
      res.status(500).json({ message: "Failed to archive all notifications" });
    }
  },

  // --- Existing Methods (Updated) ---

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
    
    const sender = req.user?.id
      ? await prisma.user.findUnique({ where: { id: req.user?.id }, include: { profile: true } })
      : null
      
    const senderName = sender?.profile
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

  testPush: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = req.user?.id || ""
    await pushService.send(tenantId, userId, {
      title: "تجربة الإشعارات",
      body: "هذا إشعار تجريبي للتأكد من عمل النظام بشكل صحيح ✅",
      url: "/notifications"
    })
    res.json({ status: "ok", message: "Notification sent" })
  }
}

  listEvents: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = req.user?.id || ""
    const roles = req.user?.roles || []
    
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastNotificationClearTime: true } })
    const afterDate = user?.lastNotificationClearTime || undefined

    const limit = req.query.limit ? Number(req.query.limit) : 20
    const events = await notificationService.listEvents(tenantId, Math.max(limit * 5, 50), afterDate)
    const filtered = roles.includes("owner")
      ? events
        : events.filter((event) => {
            const payload = {} as Record<string, unknown>
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
    const config = await prisma.moduleConfig.findFirst({ where: { tenantId, moduleKey: "notifications", isEnabled: true } })
    const raw = (config?.config as Record<string, unknown>) || {}
    res.json({
      enabled: raw.enabled !== false,
      dailyLimit: Number(raw.dailyLimit || 10),
      quietHours: {
        enabled: (raw.quietHours as Record<string, unknown> | undefined)?.enabled !== false,
        start: (raw.quietHours as Record<string, unknown> | undefined)?.start || "22:00",
        end: (raw.quietHours as Record<string, unknown> | undefined)?.end || "08:00"
      }
    })
  },

  updatePolicy: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const config = await prisma.moduleConfig.findFirst({ where: { tenantId, moduleKey: "notifications", isEnabled: true } })
    
    if (config) {
      await prisma.moduleConfig.update({
        where: { tenantId_moduleKey: { tenantId, moduleKey: "notifications" } },
        data: { config: req.body }
      })
    } else {
      await prisma.moduleConfig.create({
        data: {
            tenantId,
            moduleKey: "notifications",
            isEnabled: true,
            config: req.body
        }
      })
    }
    
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "notification.policy.updated", entityType: "module_config", metadata: req.body })
    res.json({ status: "ok" })
  },

  publishEvent: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const { eventKey, payload } = req.body
    const event = await notificationService.publishEvent(tenantId, eventKey, payload)
    res.json(event)
  },

  createRule: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const rule = await notificationService.createRule(tenantId, req.body)
    res.json(rule)
  },

  queueDelivery: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    // Deprecated but kept for compatibility
    // Using service.queueDelivery which uses the old structure
    const delivery = await notificationService.queueDelivery(tenantId, req.body.eventId, req.body.channel, req.body.scheduledAt)
    res.json(delivery)
  }
}
