import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { conversationController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.get("/", requirePermission("conversations.read"), asyncHandler(conversationController.list))
router.get("/owner-group", requirePermission("conversations.read"), asyncHandler(conversationController.getOwnerGroup))
router.post("/direct", requirePermission("conversations.create"), asyncHandler(conversationController.createDirect))
router.post("/team", requirePermission("conversations.create"), asyncHandler(conversationController.createTeamGroup))
router.get("/:id/messages", requirePermission("messages.read"), asyncHandler(conversationController.listMessages))
router.post("/:id/messages", requirePermission("messages.send"), asyncHandler(conversationController.sendMessage))
