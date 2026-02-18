"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelligenceController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
exports.intelligenceController = {
    scoreLead: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const score = await service_1.intelligenceService.scoreLead(tenantId, req.params.leadId);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "intelligence.lead.scored", entityType: "lead_score", entityId: score.id });
        res.json(score);
    },
    disciplineIndex: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const snapshot = await service_1.intelligenceService.computeDisciplineIndex(tenantId, req.params.userId);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "intelligence.discipline.scored", entityType: "discipline_snapshot", entityId: snapshot.id });
        res.json(snapshot);
    },
    dealProbability: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const result = await service_1.intelligenceService.computeDealProbability(tenantId, req.params.dealId);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "intelligence.deal.probability", entityType: "risk_score", entityId: result.riskScore.id });
        res.json(result);
    },
    revenueForecast: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const forecast = await service_1.intelligenceService.computeRevenueForecast(tenantId);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "intelligence.revenue.forecast", entityType: "ranking_snapshot" });
        res.json(forecast);
    },
    reminderPriority: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const items = await service_1.intelligenceService.computeReminderPriorities(tenantId, req.body.userId);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "intelligence.reminder.prioritized", entityType: "ranking_snapshot" });
        res.json({ items });
    },
    scripts: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const scripts = await service_1.intelligenceService.generateScripts(tenantId, req.params.leadId, req.body.stage);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "intelligence.scripts.generated", entityType: "ranking_snapshot" });
        res.json({ scripts });
    },
    performanceRanking: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const rows = await service_1.intelligenceService.computePerformanceRanking(tenantId);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "intelligence.performance.rank", entityType: "ranking_snapshot" });
        res.json({ rows });
    },
    engagementWebhook: async (req, res) => {
        const tenantId = req.user?.tenantId || req.body.tenantId || "";
        const event = await service_1.intelligenceService.recordEngagementEvent(tenantId, req.body.leadId, { type: req.body.type, occurredAt: req.body.occurredAt, metadata: req.body.metadata });
        service_1.intelligenceService.queueTrigger({ type: "lead_engaged", tenantId, leadId: req.body.leadId });
        res.json(event);
    },
    triggerWebhook: async (req, res) => {
        const tenantId = req.user?.tenantId || req.body.tenantId || "";
        service_1.intelligenceService.queueTrigger({ type: req.body.type, tenantId, leadId: req.body.leadId, dealId: req.body.dealId, userId: req.body.userId });
        res.json({ status: "queued" });
    }
};
