import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { authController } from "./controller"
import { authMiddleware } from "../../middleware/auth"

export const router = Router()

router.post("/login", asyncHandler(authController.login))
router.post("/register", asyncHandler(authController.register))
router.get("/me", authMiddleware, asyncHandler(authController.me))
router.post("/change-password", authMiddleware, asyncHandler(authController.changePassword))
router.post("/update-profile", authMiddleware, asyncHandler(authController.updateProfile))
