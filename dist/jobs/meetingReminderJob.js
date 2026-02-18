"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetingReminderJob = void 0;
const client_1 = require("../prisma/client");
const pushService_1 = require("../modules/notifications/pushService");
const smsService_1 = require("../modules/notifications/smsService");
const env_1 = require("../config/env");
const meetingReminderJob = async () => {
    const now = new Date();
    const reminders = await client_1.prisma.meetingReminder.findMany({
        where: {
            status: "queued",
            scheduledAt: { lte: now }
        },
        include: {
            meeting: {
                include: {
                    lead: true,
                    organizer: true
                }
            }
        }
    });
    for (const reminder of reminders) {
        const { meeting, tenantId } = reminder;
        const organizer = meeting.organizer;
        // 1. Send Push to Organizer
        if (organizer) {
            await pushService_1.pushService.send(tenantId, organizer.id, {
                title: "تذكير باجتماع",
                body: `لديك اجتماع مع ${meeting.lead.name || "عميل"} في الساعة ${meeting.startsAt.toLocaleTimeString('ar-EG')}`,
                url: `/leads/${meeting.leadId}`
            });
        }
        // 2. Send SMS to Owner
        // Try to find owner in DB first
        const owners = await client_1.prisma.user.findMany({
            where: {
                tenantId,
                status: "active",
                roleLinks: { some: { role: { name: "owner" } } }
            },
            select: { phone: true }
        });
        const ownerPhone = owners.find(o => o.phone)?.phone || env_1.env.ownerPhoneNumber;
        if (ownerPhone) {
            await smsService_1.smsService.send(ownerPhone, `تذكير: اجتماع لفريق المبيعات مع العميل ${meeting.lead.name || "عميل"} يبدأ ${meeting.startsAt.toLocaleString('ar-EG')}`);
        }
        // 3. Mark as sent
        await client_1.prisma.meetingReminder.update({
            where: { id: reminder.id },
            data: { status: "sent" }
        });
    }
};
exports.meetingReminderJob = meetingReminderJob;
