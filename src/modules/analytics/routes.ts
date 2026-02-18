import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { analyticsController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.get("/dashboard", requirePermission("analytics.read"), asyncHandler(analyticsController.getDashboardMetrics))
router.get("/leads/:leadId/timeline", requirePermission("analytics.read"), asyncHandler(analyticsController.getLeadTimeline))

router.get("/metrics/daily", requirePermission("analytics.read"), asyncHandler(analyticsController.listDailyMetrics))
router.get("/rankings", requirePermission("analytics.read"), asyncHandler(analyticsController.listRankings))
router.get("/employees/performance", requirePermission("analytics.read"), asyncHandler(analyticsController.getEmployeePerformance))
router.post("/metrics/daily", requirePermission("analytics.create"), asyncHandler(analyticsController.createDailyMetrics))
router.post("/discipline/snapshots", requirePermission("analytics.create"), asyncHandler(analyticsController.createDisciplineSnapshot))
router.post("/rankings", requirePermission("analytics.create"), asyncHandler(analyticsController.createRankingSnapshot))
