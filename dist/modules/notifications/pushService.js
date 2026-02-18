"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushService = void 0;
const web_push_1 = __importDefault(require("web-push"));
const client_1 = require("../../prisma/client");
const env_1 = require("../../config/env");
// Initialize web-push with keys
if (env_1.env.vapidPublicKey && env_1.env.vapidPrivateKey) {
    web_push_1.default.setVapidDetails("mailto:admin@example.com", env_1.env.vapidPublicKey, env_1.env.vapidPrivateKey);
}
exports.pushService = {
    getPublicKey: () => env_1.env.vapidPublicKey,
    getPolicy: async (tenantId) => {
        const module = await client_1.prisma.module.findFirst({ where: { key: "notifications" } });
        const config = module
            ? await client_1.prisma.moduleConfig.findFirst({ where: { tenantId, moduleId: module.id, isActive: true } })
            : null;
        const raw = config?.config || {};
        const policy = {
            enabled: raw.enabled !== false,
            dailyLimit: Math.min(Number(raw.dailyLimit || 10), 50),
            quietHours: {
                enabled: raw.quietHours?.enabled !== false,
                start: Number(raw.quietHours?.start ?? 22),
                end: Number(raw.quietHours?.end ?? 8)
            }
        };
        return policy;
    },
    subscribe: async (tenantId, userId, subscription) => {
        // Store subscription in Note model to avoid schema changes for now
        // entityType: "push_subscription"
        // entityId: userId
        // Check if subscription already exists to avoid duplicates
        const subString = JSON.stringify(subscription);
        const existing = await client_1.prisma.note.findFirst({
            where: {
                tenantId,
                entityType: "push_subscription",
                entityId: userId,
                body: { contains: subString }
            }
        });
        if (!existing) {
            await client_1.prisma.note.create({
                data: {
                    tenantId,
                    entityType: "push_subscription",
                    entityId: userId,
                    body: subString,
                    createdBy: userId
                }
            });
        }
    },
    send: async (tenantId, userId, payload) => {
        if (!env_1.env.vapidPublicKey || !env_1.env.vapidPrivateKey) {
            console.warn("[Push] VAPID keys not configured");
            return;
        }
        const policy = await exports.pushService.getPolicy(tenantId);
        if (!policy.enabled)
            return;
        const now = new Date();
        if (policy.quietHours.enabled) {
            const hour = now.getHours();
            if (policy.quietHours.start <= policy.quietHours.end) {
                if (hour >= policy.quietHours.start && hour < policy.quietHours.end)
                    return;
            }
            else {
                if (hour >= policy.quietHours.start || hour < policy.quietHours.end)
                    return;
            }
        }
        const dayKey = now.toISOString().slice(0, 10);
        const quota = await client_1.prisma.notificationQuota.findUnique({
            where: { tenantId_userId_dayKey: { tenantId, userId, dayKey } }
        });
        if (quota && quota.sentCount >= policy.dailyLimit)
            return;
        await client_1.prisma.notificationQuota.upsert({
            where: { tenantId_userId_dayKey: { tenantId, userId, dayKey } },
            update: { sentCount: { increment: 1 } },
            create: { tenantId, userId, dayKey, sentCount: 1 }
        });
        const subscriptions = await client_1.prisma.note.findMany({
            where: {
                tenantId,
                entityType: "push_subscription",
                entityId: userId
            }
        });
        for (const subNote of subscriptions) {
            try {
                const subscription = JSON.parse(subNote.body);
                await web_push_1.default.sendNotification(subscription, JSON.stringify(payload));
            }
            catch (error) {
                console.error(`[Push] Failed to send to user ${userId}:`, error);
                // If 410 Gone, we should delete the subscription
                if (error?.statusCode === 410) {
                    await client_1.prisma.note.delete({ where: { id: subNote.id } });
                }
            }
        }
    },
    broadcast: async (tenantId, target, message) => {
        let userIds = [];
        if (target.type === "user" && target.value) {
            userIds = [target.value];
        }
        else if (target.type === "all") {
            const users = await client_1.prisma.user.findMany({ where: { tenantId, deletedAt: null, status: "active" }, select: { id: true } });
            userIds = users.map(u => u.id);
        }
        else if (target.type === "role" && target.value) {
            // Find users with role
            const users = await client_1.prisma.user.findMany({
                where: {
                    tenantId,
                    deletedAt: null,
                    status: "active",
                    roleLinks: {
                        some: {
                            role: { name: target.value }
                        }
                    }
                },
                select: { id: true }
            });
            userIds = users.map(u => u.id);
        }
        for (const userId of userIds) {
            await exports.pushService.send(tenantId, userId, {
                title: "إشعار إداري",
                body: message,
                url: "/"
            });
        }
    }
};
