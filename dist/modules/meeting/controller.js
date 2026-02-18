"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetingController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
const service_2 = require("../intelligence/service");
exports.meetingController = {
    listMeetings: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const meetings = await service_1.meetingService.listMeetings(tenantId, req.user);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "meeting.listed", entityType: "meeting" });
        res.json(meetings);
    },
    createMeeting: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const meeting = await service_1.meetingService.createMeeting(tenantId, { ...req.body, organizerUserId: req.user?.id });
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "meeting.created", entityType: "meeting", entityId: meeting.id });
        service_2.intelligenceService.queueTrigger({ type: "meeting_changed", tenantId, leadId: meeting.leadId, userId: meeting.organizerUserId || undefined });
        res.json(meeting);
    },
    createRescheduleRequest: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const request = await service_1.meetingService.createRescheduleRequest(tenantId, req.params.id, req.user?.id || "", req.body.proposedStartsAt, req.body.proposedEndsAt);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "meeting.reschedule.requested", entityType: "meeting_reschedule", entityId: request.id });
        service_2.intelligenceService.queueTrigger({ type: "meeting_changed", tenantId, userId: req.user?.id });
        res.json(request);
    },
    updateStatus: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const status = String(req.body?.status || "").trim();
        if (!status)
            throw { status: 400, message: "حالة الاجتماع مطلوبة" };
        const meeting = await service_1.meetingService.updateMeetingStatus(tenantId, req.params.id, status, req.user);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "meeting.status.updated", entityType: "meeting", entityId: meeting.id });
        res.json(meeting);
    },
    createReminder: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const reminder = await service_1.meetingService.createReminder(tenantId, req.params.id, req.body.scheduledAt);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "meeting.reminder.created", entityType: "meeting_reminder", entityId: reminder.id });
        service_2.intelligenceService.queueTrigger({ type: "meeting_changed", tenantId, userId: req.user?.id });
        res.json(reminder);
    },
    sendReminderNow: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        await service_1.meetingService.sendReminderNow(tenantId, req.params.id);
        res.json({ status: "sent" });
    }
};
