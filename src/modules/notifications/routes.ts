import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { notificationController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

// --- User Notification Routes (No special permission needed, just auth) ---
router.get("/", asyncHandler(notificationController.list))
router.get("/unread-count", asyncHandler(notificationController.getUnreadCount))
router.patch("/read-all", asyncHandler(notificationController.markAllAsRead))
router.patch("/:id/read", asyncHandler(notificationController.markAsRead))
router.delete("/", asyncHandler(notificationController.archiveAll))
router.delete("/:id", asyncHandler(notificationController.archive))

// --- Existing/Admin Routes ---
router.get("/vapid-key", asyncHandler(notificationController.getVapidKey))
router.post("/subscribe", asyncHandler(notificationController.subscribe))
router.post("/test-push", asyncHandler(notificationController.testPush))
router.post("/broadcast", asyncHandler(notificationController.broadcast))

router.get("/events", requirePermission("notifications.read"), asyncHandler(notificationController.listEvents))
router.delete("/events", requirePermission("notifications.read"), asyncHandler(notificationController.clearEvents))
router.get("/policies", requirePermission("notifications.read"), asyncHandler(notificationController.getPolicy))
router.put("/policies", requirePermission("notifications.create"), asyncHandler(notificationController.updatePolicy))
router.post("/events", requirePermission("notifications.create"), asyncHandler(notificationController.publishEvent))
router.post("/rules", requirePermission("notifications.create"), asyncHandler(notificationController.createRule))
router.post("/deliveries", requirePermission("notifications.create"), asyncHandler(notificationController.queueDelivery))
