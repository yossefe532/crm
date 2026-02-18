import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { blacklistController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.post("/entries", requirePermission("blacklist.create"), asyncHandler(blacklistController.createEntry))
router.post("/check", requirePermission("blacklist.read"), asyncHandler(blacklistController.checkLead))
