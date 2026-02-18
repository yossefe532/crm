"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMeetingDeadlineJob = void 0;
const client_1 = require("../prisma/client");
const runMeetingDeadlineJob = async (tenantId) => {
    const now = new Date();
    const soon = new Date(now.getTime() + 2 * 3600 * 1000);
    const meetings = await client_1.prisma.meeting.findMany({ where: { tenantId, startsAt: { lte: soon }, status: "scheduled" } });
    for (const meeting of meetings) {
        const existingReminder = await client_1.prisma.meetingReminder.findFirst({ where: { tenantId, meetingId: meeting.id, scheduledAt: { lte: soon } } });
        if (!existingReminder) {
            await client_1.prisma.meetingReminder.create({ data: { tenantId, meetingId: meeting.id, scheduledAt: now } });
        }
    }
};
exports.runMeetingDeadlineJob = runMeetingDeadlineJob;
