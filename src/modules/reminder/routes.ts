import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { reminderController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.post("/rules", requirePermission("reminders.create"), asyncHandler(reminderController.createRule))
router.post("/schedules", requirePermission("reminders.create"), asyncHandler(reminderController.schedule))
router.post("/sent", requirePermission("reminders.update"), asyncHandler(reminderController.markSent))
