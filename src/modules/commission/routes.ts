import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { commissionController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.get("/ledger", requirePermission("commissions.read"), asyncHandler(commissionController.listLedger))
router.post("/plans", requirePermission("commissions.create"), asyncHandler(commissionController.createPlan))
router.post("/rules", requirePermission("commissions.create"), asyncHandler(commissionController.createRule))
router.post("/ledger", requirePermission("commissions.create"), asyncHandler(commissionController.createLedgerEntry))
router.post("/ledger/:id/approve", requirePermission("commissions.approve"), asyncHandler(commissionController.approveLedgerEntry))
