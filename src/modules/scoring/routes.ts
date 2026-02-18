import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { scoringController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.post("/leads/:leadId/score", requirePermission("leads.score"), asyncHandler(scoringController.scoreLead))
