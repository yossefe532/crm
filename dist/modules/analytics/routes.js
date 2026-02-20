"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const asyncHandler_1 = require("../../utils/asyncHandler");
const controller_1 = require("./controller");
const rbac_1 = require("../../middleware/rbac");
exports.router = (0, express_1.Router)();
exports.router.get("/dashboard", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("analytics.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.analyticsController.getDashboardMetrics));
exports.router.get("/leads/:leadId/timeline", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("analytics.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.analyticsController.getLeadTimeline));
exports.router.get("/metrics/daily", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("analytics.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.analyticsController.listDailyMetrics));
exports.router.get("/rankings", (0, rbac_1.requirePermission)("analytics.read"), (0, asyncHandler_1.asyncHandler)(controller_1.analyticsController.listRankings));
exports.router.get("/employees/performance", (0, rbac_1.requirePermission)("analytics.read"), (0, asyncHandler_1.asyncHandler)(controller_1.analyticsController.getEmployeePerformance));
exports.router.post("/metrics/daily", (0, rbac_1.requirePermission)("analytics.create"), (0, asyncHandler_1.asyncHandler)(controller_1.analyticsController.createDailyMetrics));
exports.router.post("/discipline/snapshots", (0, rbac_1.requirePermission)("analytics.create"), (0, asyncHandler_1.asyncHandler)(controller_1.analyticsController.createDisciplineSnapshot));
exports.router.post("/rankings", (0, rbac_1.requirePermission)("analytics.create"), (0, asyncHandler_1.asyncHandler)(controller_1.analyticsController.createRankingSnapshot));
