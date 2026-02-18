import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { reassignmentController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.post("/trigger", requirePermission("reassignment.execute"), asyncHandler(reassignmentController.triggerReassignment))
router.post("/negligence", requirePermission("reassignment.execute"), asyncHandler(reassignmentController.addNegligence))
