import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { lifecycleController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.get("/states/:code", requirePermission("leads.read"), asyncHandler(lifecycleController.getStateByCode))
router.post("/states", requirePermission("lifecycle.create"), asyncHandler(lifecycleController.createState))
router.post("/transitions", requirePermission("lifecycle.create"), asyncHandler(lifecycleController.createTransition))
router.post("/leads/:leadId/transition", requirePermission("leads.update"), asyncHandler(lifecycleController.transitionLead))
router.post("/leads/:leadId/fail", requirePermission("leads.update"), asyncHandler(lifecycleController.failLead))
router.post("/deadlines", requirePermission("lifecycle.create"), asyncHandler(lifecycleController.createDeadline))
router.post("/extensions", requirePermission("leads.update"), asyncHandler(lifecycleController.requestExtension))
router.post("/extensions/:id/approve", requirePermission("lifecycle.approve"), asyncHandler(lifecycleController.approveExtension))
router.post("/extensions/:id/reject", requirePermission("lifecycle.approve"), asyncHandler(lifecycleController.rejectExtension))
