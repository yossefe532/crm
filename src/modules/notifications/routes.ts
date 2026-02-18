import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { notificationController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.get("/vapid-key", asyncHandler(notificationController.getVapidKey))
router.post("/subscribe", asyncHandler(notificationController.subscribe))
router.post("/broadcast", asyncHandler(notificationController.broadcast))

router.get("/events", requirePermission("notifications.read"), asyncHandler(notificationController.listEvents))
router.get("/policies", requirePermission("notifications.read"), asyncHandler(notificationController.getPolicy))
router.put("/policies", requirePermission("notifications.create"), asyncHandler(notificationController.updatePolicy))
router.post("/events", requirePermission("notifications.create"), asyncHandler(notificationController.publishEvent))
router.post("/rules", requirePermission("notifications.create"), asyncHandler(notificationController.createRule))
router.post("/deliveries", requirePermission("notifications.create"), asyncHandler(notificationController.queueDelivery))
