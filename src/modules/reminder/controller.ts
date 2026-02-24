import { Request, Response } from "express"
import { reminderService } from "./service"
import { logActivity } from "../../utils/activity"

export const reminderController = {
  createRule: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const rule = await reminderService.createRule(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "reminder.rule.created", entityType: "reminder_rule", entityId: rule.id })
    res.json(rule)
  },
  schedule: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const schedule = await reminderService.createSchedule(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "reminder.scheduled", entityType: "reminder_schedule", entityId: schedule.id })
    res.json(schedule)
  },
  markSent: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const record = await reminderService.createSent(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "reminder.sent", entityType: "reminder_sent", entityId: record.id })
    res.json(record)
  }
}
