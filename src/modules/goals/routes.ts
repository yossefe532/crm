import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { goalsController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.post("/plans", requirePermission("goals.create"), asyncHandler(goalsController.createPlan))
router.get("/plans", requirePermission("goals.read"), asyncHandler(goalsController.listPlans))
router.delete("/plans/:planId", requirePermission("goals.create"), asyncHandler(goalsController.deletePlan))
router.get("/plans/:planId/targets", requirePermission("goals.read"), asyncHandler(goalsController.listTargets))
router.post("/plans/:planId/targets", requirePermission("goals.update"), asyncHandler(goalsController.setTargets))
router.get("/plans/:planId/report", requirePermission("goals.read"), asyncHandler(goalsController.report))
router.get("/overview", requirePermission("goals.read"), asyncHandler(goalsController.overview))
