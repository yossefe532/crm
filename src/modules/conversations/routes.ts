import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { conversationController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.get("/", requirePermission("conversations.read"), asyncHandler(conversationController.list))
router.get("/owner-group", requirePermission("conversations.read"), asyncHandler(conversationController.getOwnerGroup))
router.post("/direct", requirePermission("conversations.create"), asyncHandler(conversationController.createDirect))
router.post("/group", requirePermission("conversations.create"), asyncHandler(conversationController.createGroup))
router.post("/team", requirePermission("conversations.create"), asyncHandler(conversationController.createTeamGroup))
router.get("/:id/messages", requirePermission("messages.read"), asyncHandler(conversationController.listMessages))
router.post("/:id/messages", requirePermission("messages.send"), asyncHandler(conversationController.sendMessage))
router.put("/messages/:id", requirePermission("messages.send"), asyncHandler(conversationController.editMessage))
router.delete("/messages/:id", requirePermission("messages.send"), asyncHandler(conversationController.deleteMessage))
router.post("/poke", requirePermission("conversations.create"), asyncHandler(conversationController.pokeUser))
router.post("/:id/read", requirePermission("conversations.read"), asyncHandler(conversationController.markAsRead))
router.post("/:id/participants", requirePermission("conversations.create"), asyncHandler(conversationController.addParticipant))
router.delete("/:id/participants/:userId", requirePermission("conversations.create"), asyncHandler(conversationController.removeParticipant))
