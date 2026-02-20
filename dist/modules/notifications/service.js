"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const client_1 = require("../../prisma/client");
const pushService_1 = require("./pushService");
const smsService_1 = require("./smsService");
const socket_1 = require("../../socket");
exports.notificationService = {
    listEvents: (tenantId, limit = 20) => client_1.prisma.notificationEvent.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: limit }),
    publishEvent: (tenantId, eventKey, payload) => client_1.prisma.notificationEvent.create({ data: { tenantId, eventKey, payload: payload } }),
    createRule: (tenantId, data) => client_1.prisma.notificationRule.create({
        data: {
            tenantId,
            eventKey: data.eventKey,
            channel: data.channel,
            recipients: data.recipients ? data.recipients : undefined,
            templateRef: data.templateRef
        }
    }),
    queueDelivery: (tenantId, eventId, channel, scheduledAt) => client_1.prisma.notificationDelivery.create({ data: { tenantId, eventId, channel, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined } }),
    broadcast: async (tenantId, target, message, channels = ["in_app", "push"], sender) => {
        const normalizedMessage = sender?.name ? `رسالة من ${sender.name}: ${message}` : `رسالة الإدارة: ${message}`;
        let users = [];
        if (target.type === "user" && typeof target.value === "string") {
            const user = await client_1.prisma.user.findUnique({ where: { id: target.value }, select: { id: true, phone: true } });
            if (user)
                users = [user];
        }
        else if (target.type === "users" && Array.isArray(target.value)) {
            users = await client_1.prisma.user.findMany({ where: { tenantId, id: { in: target.value }, deletedAt: null, status: "active" }, select: { id: true, phone: true } });
        }
        else if (target.type === "all") {
            users = await client_1.prisma.user.findMany({ where: { tenantId, deletedAt: null, status: "active" }, select: { id: true, phone: true } });
        }
        else if (target.type === "role" && typeof target.value === "string") {
            users = await client_1.prisma.user.findMany({
                where: {
                    tenantId,
                    deletedAt: null,
                    status: "active",
                    roleLinks: { some: { role: { name: target.value } } }
                },
                select: { id: true, phone: true }
            });
        }
        else if (target.type === "team" && typeof target.value === "string") {
            const members = await client_1.prisma.teamMember.findMany({
                where: { tenantId, teamId: target.value, leftAt: null, deletedAt: null },
                select: { userId: true }
            });
            const team = await client_1.prisma.team.findFirst({ where: { tenantId, id: target.value } });
            const userIds = Array.from(new Set([...(team?.leaderUserId ? [team.leaderUserId] : []), ...members.map((row) => row.userId)]));
            users = await client_1.prisma.user.findMany({ where: { tenantId, id: { in: userIds }, deletedAt: null, status: "active" }, select: { id: true, phone: true } });
        }
        // 1. Store History (In-App)
        if (channels.includes("in_app")) {
            await client_1.prisma.notificationEvent.create({
                data: {
                    tenantId,
                    eventKey: "admin.broadcast",
                    payload: {
                        messageAr: normalizedMessage,
                        target,
                        recipients: users.map((u) => u.id),
                        senderUserId: sender?.id,
                        senderName: sender?.name
                    }
                }
            });
            // Emit Socket Event
            try {
                const io = (0, socket_1.getIO)();
                users.forEach((user) => {
                    io.to(`user:${user.id}`).emit("notification", {
                        message: normalizedMessage,
                        type: "info",
                    });
                });
            }
            catch (e) {
                // Socket might not be initialized in some contexts
            }
        }
        // 2. Send Push
        if (channels.includes("push")) {
            for (const user of users) {
                await pushService_1.pushService.send(tenantId, user.id, {
                    title: "إشعار إداري",
                    body: normalizedMessage,
                    url: "/"
                });
            }
        }
        // 3. Send SMS
        if (channels.includes("sms")) {
            for (const user of users) {
                if (user.phone) {
                    await smsService_1.smsService.send(user.phone, normalizedMessage);
                }
            }
        }
    },
    send: async (tenantId, userIds, payload) => {
        // 1. Store In-App Notification
        await client_1.prisma.notificationEvent.create({
            data: {
                tenantId,
                eventKey: payload.type,
                payload: {
                    message: payload.message,
                    title: payload.title,
                    entityId: payload.entityId,
                    recipients: userIds
                }
            }
        });
        // 2. Emit Socket Event
        try {
            const io = (0, socket_1.getIO)();
            userIds.forEach((userId) => {
                io.to(`user:${userId}`).emit("notification", {
                    title: payload.title,
                    message: payload.message,
                    type: payload.type,
                    entityId: payload.entityId
                });
            });
        }
        catch (e) {
            // Socket might not be initialized
        }
    }
};
