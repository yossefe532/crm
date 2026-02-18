"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = void 0;
const service_1 = require("./service");
const activity_1 = require("../../utils/activity");
exports.analyticsController = {
    listDailyMetrics: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const metrics = await service_1.analyticsService.listDailyMetrics(tenantId, req.query.from, req.query.to);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "metrics.daily.listed", entityType: "lead_metrics_daily" });
        res.json(metrics);
    },
    listRankings: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const type = req.query.type ? String(req.query.type) : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const rows = await service_1.analyticsService.listRankingSnapshots(tenantId, type, limit);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "ranking.snapshot.listed", entityType: "ranking_snapshot" });
        res.json(rows);
    },
    createDailyMetrics: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const metrics = await service_1.analyticsService.createDailyMetrics(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "metrics.daily.created", entityType: "lead_metrics_daily", entityId: metrics.id });
        res.json(metrics);
    },
    createDisciplineSnapshot: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const snapshot = await service_1.analyticsService.createDisciplineSnapshot(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "discipline.snapshot.created", entityType: "discipline_snapshot", entityId: snapshot.id });
        res.json(snapshot);
    },
    createRankingSnapshot: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const snapshot = await service_1.analyticsService.createRankingSnapshot(tenantId, req.body);
        await (0, activity_1.logActivity)({ tenantId, actorUserId: req.user?.id, action: "ranking.snapshot.created", entityType: "ranking_snapshot", entityId: snapshot.id });
        res.json(snapshot);
    },
    getDashboardMetrics: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const [distribution, conversion, avgTime, salesPerformance, teamPerformance] = await Promise.all([
            service_1.analyticsService.getStageDistribution(tenantId),
            service_1.analyticsService.getConversionRate(tenantId),
            service_1.analyticsService.getAvgTimePerStage(tenantId),
            service_1.analyticsService.getSalesPerformance(tenantId),
            service_1.analyticsService.getTeamPerformance(tenantId)
        ]);
        res.json({ distribution, conversion, avgTime, salesPerformance, teamPerformance });
    },
    getLeadTimeline: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const timeline = await service_1.analyticsService.getLeadTimeline(tenantId, req.params.leadId);
        res.json(timeline);
    },
    getEmployeePerformance: async (req, res) => {
        const tenantId = req.user?.tenantId || "";
        const period = String(req.query.period || "monthly");
        const periodDays = period === "weekly" ? 7 : 30;
        const rows = await service_1.analyticsService.getEmployeePerformance(tenantId, periodDays);
        res.json(rows);
    }
};
