import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { intelligenceController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.post("/leads/:leadId/score", requirePermission("analytics.create"), asyncHandler(intelligenceController.scoreLead))
router.post("/discipline/users/:userId", requirePermission("analytics.create"), asyncHandler(intelligenceController.disciplineIndex))
router.post("/deals/:dealId/probability", requirePermission("analytics.create"), asyncHandler(intelligenceController.dealProbability))
router.post("/forecast", requirePermission("analytics.create"), asyncHandler(intelligenceController.revenueForecast))
router.post("/reminders/priority", requirePermission("analytics.create"), asyncHandler(intelligenceController.reminderPriority))
router.post("/leads/:leadId/scripts", requirePermission("analytics.create"), asyncHandler(intelligenceController.scripts))
router.post("/rankings/performance", requirePermission("analytics.create"), asyncHandler(intelligenceController.performanceRanking))
router.post("/webhooks/engagement", asyncHandler(intelligenceController.engagementWebhook))
router.post("/webhooks/triggers", asyncHandler(intelligenceController.triggerWebhook))
