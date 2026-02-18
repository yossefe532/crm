"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetingService = void 0;
const client_1 = require("../../prisma/client");
const moduleConfig_1 = require("../../utils/moduleConfig");
const pushService_1 = require("../notifications/pushService");
const smsService_1 = require("../notifications/smsService");
const env_1 = require("../../config/env");
exports.meetingService = {
    sendReminderNow: async (tenantId, meetingId) => {
        const meeting = await client_1.prisma.meeting.findUnique({ where: { id: meetingId, tenantId }, include: { lead: true, organizer: true } });
        if (!meeting)
            throw { status: 404, message: "Meeting not found" };
        // 1. Send Push to Organizer
        if (meeting.organizer) {
            await pushService_1.pushService.send(tenantId, meeting.organizer.id, {
                title: "تذكير فوري",
                body: `تذكير: اجتماع مع ${meeting.lead.name} (${meeting.title})`,
                url: `/leads/${meeting.leadId}`
            });
        }
        // 2. Send SMS to Owner
        if (env_1.env.ownerPhoneNumber) {
            await smsService_1.smsService.send(env_1.env.ownerPhoneNumber, `تذكير فوري: اجتماع لفريق المبيعات مع العميل ${meeting.lead.name} (${meeting.title})`);
        }
        await client_1.prisma.meetingReminder.create({
            data: {
                tenantId,
                meetingId,
                scheduledAt: new Date(),
                status: "sent"
            }
        });
    },
    listMeetings: async (tenantId, user) => {
        const baseWhere = { tenantId };
        if (!user)
            return client_1.prisma.meeting.findMany({ where: baseWhere, orderBy: { startsAt: "asc" } });
        if (user.roles.includes("owner")) {
            return client_1.prisma.meeting.findMany({ where: baseWhere, orderBy: { startsAt: "asc" } });
        }
        if (user.roles.includes("team_leader")) {
            const teams = await client_1.prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } });
            const teamIds = teams.map((team) => team.id);
            const members = await client_1.prisma.teamMember.findMany({ where: { tenantId, teamId: { in: teamIds }, leftAt: null, deletedAt: null }, select: { userId: true } });
            const memberIds = Array.from(new Set([...members.map((row) => row.userId), user.id]));
            return client_1.prisma.meeting.findMany({
                where: {
                    ...baseWhere,
                    OR: [
                        { organizerUserId: { in: memberIds } },
                        { lead: { teamId: { in: teamIds } } }
                    ]
                },
                orderBy: { startsAt: "asc" }
            });
        }
        return client_1.prisma.meeting.findMany({ where: { ...baseWhere, organizerUserId: user.id }, orderBy: { startsAt: "asc" } });
    },
    createMeeting: async (tenantId, data) => {
        const lead = await client_1.prisma.lead.findFirst({ where: { tenantId, id: data.leadId, deletedAt: null } });
        if (!lead)
            throw { status: 404, message: "العميل غير موجود" };
        if (!data.organizerUserId || lead.assignedUserId !== data.organizerUserId) {
            throw { status: 403, message: "لا يمكن جدولة اجتماع لعميل غير مُسند إليك" };
        }
        const startsAt = new Date(data.startsAt);
        const endsAt = new Date(data.endsAt);
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))
            throw { status: 400, message: "توقيت الاجتماع غير صحيح" };
        if (startsAt <= new Date())
            throw { status: 400, message: "لا يمكن جدولة اجتماع في الماضي" };
        if (endsAt <= startsAt)
            throw { status: 400, message: "وقت نهاية الاجتماع يجب أن يكون بعد وقت البداية" };
        const tenant = await client_1.prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null }, select: { timezone: true } });
        const timezone = data.timezone || tenant?.timezone || "UTC";
        const meeting = await client_1.prisma.meeting.create({
            data: {
                tenantId,
                leadId: data.leadId,
                organizerUserId: data.organizerUserId,
                title: data.title,
                startsAt,
                endsAt,
                timezone,
                status: "scheduled"
            }
        });
        const reminderTime = new Date(startsAt.getTime() - 30 * 60 * 1000);
        if (reminderTime > new Date()) {
            await client_1.prisma.meetingReminder.create({
                data: {
                    tenantId,
                    meetingId: meeting.id,
                    scheduledAt: reminderTime,
                    status: "queued"
                }
            });
        }
        return meeting;
    },
    updateMeetingStatus: async (tenantId, meetingId, status, user) => {
        const meeting = await client_1.prisma.meeting.findFirst({ where: { id: meetingId, tenantId } });
        if (!meeting)
            throw { status: 404, message: "Meeting not found" };
        if (status === "completed" && meeting.startsAt > new Date())
            throw { status: 400, message: "لا يمكن إنهاء الاجتماع قبل موعده" };
        if (user && !user.roles.includes("owner") && meeting.organizerUserId !== user.id) {
            throw { status: 403, message: "غير مصرح بتحديث هذا الاجتماع" };
        }
        return client_1.prisma.meeting.update({ where: { id: meetingId, tenantId }, data: { status } });
    },
    createRescheduleRequest: async (tenantId, meetingId, requestedBy, proposedStartsAt, proposedEndsAt) => {
        const config = await (0, moduleConfig_1.getModuleConfig)(tenantId, "meeting");
        const maxReschedules = Number(config?.config?.maxReschedules || 2);
        const count = await client_1.prisma.meetingRescheduleRequest.count({ where: { tenantId, meetingId } });
        if (count >= maxReschedules)
            throw { status: 400, message: "Reschedule limit reached" };
        return client_1.prisma.meetingRescheduleRequest.create({ data: { tenantId, meetingId, requestedBy, proposedStartsAt: new Date(proposedStartsAt), proposedEndsAt: new Date(proposedEndsAt) } });
    },
    createReminder: (tenantId, meetingId, scheduledAt) => client_1.prisma.meetingReminder.create({ data: { tenantId, meetingId, scheduledAt: new Date(scheduledAt) } })
};
