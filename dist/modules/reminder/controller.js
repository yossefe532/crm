"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
exports.reminderController = {
    createRule: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const rule = await service_1.reminderService.createRule(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "reminder.rule.created", entityType: "reminder_rule", entityId: rule.id });
        res.json(rule);
    },
    schedule: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const schedule = await service_1.reminderService.scheduleReminder(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "reminder.scheduled", entityType: "reminder_schedule", entityId: schedule.id });
        res.json(schedule);
    },
    markSent: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const record = await service_1.reminderService.markSent(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "reminder.sent", entityType: "reminder_sent", entityId: record.id });
        res.json(record);
    }
};
