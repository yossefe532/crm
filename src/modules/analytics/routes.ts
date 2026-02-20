import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { analyticsController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.get("/dashboard", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("analytics.read")(req, res, next)
}, asyncHandler(analyticsController.getDashboardMetrics))
router.get("/leads/:leadId/timeline", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("analytics.read")(req, res, next)
}, asyncHandler(analyticsController.getLeadTimeline))

router.get("/metrics/daily", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("analytics.read")(req, res, next)
}, asyncHandler(analyticsController.listDailyMetrics))
router.get("/rankings", requirePermission("analytics.read"), asyncHandler(analyticsController.listRankings))
router.get("/employees/performance", requirePermission("analytics.read"), asyncHandler(analyticsController.getEmployeePerformance))
router.post("/metrics/daily", requirePermission("analytics.create"), asyncHandler(analyticsController.createDailyMetrics))
router.post("/discipline/snapshots", requirePermission("analytics.create"), asyncHandler(analyticsController.createDisciplineSnapshot))
router.post("/rankings", requirePermission("analytics.create"), asyncHandler(analyticsController.createRankingSnapshot))
