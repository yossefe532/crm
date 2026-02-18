import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { coreController } from "./controller"
import { requireOwner, requirePermission } from "../../middleware/rbac"
import { validate } from "../../middleware/validate"
import { createUserSchema, updateUserSchema } from "./schema"

export const router = Router()

router.post("/", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader")) return next()
  return requirePermission("users.create")(req, res, next)
}, validate(createUserSchema), asyncHandler(coreController.createUser))
router.get("/", requirePermission("users.read"), asyncHandler(coreController.listUsers))

router.get("/:userId", requirePermission("users.read"), asyncHandler(coreController.getUser))
router.put("/:userId", requireOwner, requirePermission("users.update"), validate(updateUserSchema), asyncHandler(coreController.updateUser))
router.delete("/:userId", requireOwner, requirePermission("users.delete"), asyncHandler(coreController.deleteUser))
router.post("/:userId/reset-password", requireOwner, requirePermission("users.update"), asyncHandler(coreController.resetUserPassword))

router.get("/:userId/permissions", requirePermission("users.read"), asyncHandler(coreController.listUserPermissions))
router.post("/:userId/permissions", requireOwner, requirePermission("users.update"), asyncHandler(coreController.updateUserPermissions))
