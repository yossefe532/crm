import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { whatsappController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.post("/send", requirePermission("whatsapp.send"), asyncHandler(whatsappController.sendTemplate))
router.post("/webhooks", asyncHandler(whatsappController.receiveWebhook))
