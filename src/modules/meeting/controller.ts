import { Request, Response } from "express"
import { meetingService } from "./service"
import { logActivity } from "../../utils/activity"
import { intelligenceService } from "../intelligence/service"

export const meetingController = {
  listMeetings: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const meetings = await meetingService.listMeetings(tenantId, req.user)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "meeting.listed", entityType: "meeting" })
    res.json(meetings)
  },
  createMeeting: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const meeting = await meetingService.createMeeting(tenantId, { ...req.body, organizerUserId: req.user?.id })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "meeting.created", entityType: "meeting", entityId: meeting.id })
    intelligenceService.queueTrigger({ type: "meeting_changed", tenantId, leadId: meeting.leadId, userId: meeting.organizerUserId || undefined })
    res.json(meeting)
  },
  createRescheduleRequest: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const request = await meetingService.createRescheduleRequest(tenantId, req.params.id, req.user?.id || "", req.body.proposedStartsAt, req.body.proposedEndsAt)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "meeting.reschedule.requested", entityType: "meeting_reschedule", entityId: request.id })
    intelligenceService.queueTrigger({ type: "meeting_changed", tenantId, userId: req.user?.id })
    res.json(request)
  },
  updateStatus: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const status = String(req.body?.status || "").trim()
    if (!status) throw { status: 400, message: "حالة الاجتماع مطلوبة" }
    const meeting = await meetingService.updateMeetingStatus(tenantId, req.params.id, status, req.user)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "meeting.status.updated", entityType: "meeting", entityId: meeting.id })
    res.json(meeting)
  },
  createReminder: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const reminder = await meetingService.createReminder(tenantId, { meetingId: req.params.id, scheduledAt: req.body.scheduledAt })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "meeting.reminder.created", entityType: "meeting_reminder", entityId: reminder.id })
    intelligenceService.queueTrigger({ type: "meeting_changed", tenantId, userId: req.user?.id })
    res.json(reminder)
  },
  sendReminderNow: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    await meetingService.sendReminderNow(tenantId, req.params.id)
    res.json({ status: "sent" })
  }
}
