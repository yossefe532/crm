"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reminderService = void 0;
const client_1 = require("../../prisma/client");
exports.reminderService = {
    createRule: (tenantId, data) => client_1.prisma.reminderRule.create({
        data: {
            tenantId,
            name: data.name,
            triggerKey: data.triggerKey,
            schedule: data.schedule ? data.schedule : undefined,
            channel: data.channel
        }
    }),
    scheduleReminder: (tenantId, data) => client_1.prisma.reminderSchedule.create({ data: { tenantId, leadId: data.leadId, ruleId: data.ruleId, scheduledAt: new Date(data.scheduledAt) } }),
    markSent: (tenantId, data) => client_1.prisma.remindersSent.create({ data: { tenantId, leadId: data.leadId, ruleId: data.ruleId, channel: data.channel, result: data.result } })
};
