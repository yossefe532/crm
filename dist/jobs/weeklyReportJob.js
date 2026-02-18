"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWeeklyReportJob = void 0;
const client_1 = require("../prisma/client");
const service_1 = require("../modules/notifications/service");
const activity_1 = require("../utils/activity");
const runWeeklyReportJob = async (tenantId) => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const completedLeads = await client_1.prisma.lead.findMany({
        where: { tenantId, status: "closing", updatedAt: { gte: weekStart, lte: now }, deletedAt: null },
        select: { id: true, leadCode: true, name: true, assignedUserId: true, teamId: true, status: true, updatedAt: true }
    });
    const overdueDeadlines = await client_1.prisma.leadDeadline.findMany({
        where: { tenantId, dueAt: { lt: now }, status: { in: ["active", "overdue"] } },
        include: { lead: true, state: true }
    });
    const overdueLeads = overdueDeadlines.map((deadline) => ({
        leadId: deadline.leadId,
        leadCode: deadline.lead.leadCode,
        leadName: deadline.lead.name,
        stage: deadline.state.code,
        dueAt: deadline.dueAt.toISOString()
    }));
    const event = await service_1.notificationService.publishEvent(tenantId, "weekly.report.generated", {
        weekStart: weekStart.toISOString(),
        weekEnd: now.toISOString(),
        completedLeads,
        overdueLeads,
        completedCount: completedLeads.length,
        overdueCount: overdueLeads.length,
        messageAr: `تقرير أسبوعي: عملاء مكتملون ${completedLeads.length}، عملاء متأخرون ${overdueLeads.length}`,
        targets: ["owner", "team_leader"]
    });
    await service_1.notificationService.queueDelivery(tenantId, event.id, "in_app");
    await (0, activity_1.logActivity)({
        tenantId,
        action: "weekly.report.generated",
        entityType: "notification_event",
        entityId: event.id,
        metadata: { completedCount: completedLeads.length, overdueCount: overdueLeads.length }
    });
};
exports.runWeeklyReportJob = runWeeklyReportJob;
