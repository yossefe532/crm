import { Router } from "express"
import { taskController } from "./controller"
import { authMiddleware as authenticate } from "../../middleware/auth"

export const router = Router()

router.use(authenticate)

router.post("/", taskController.create)
router.get("/", taskController.list)
router.get("/:id", taskController.get)
router.patch("/:id", taskController.update)
router.delete("/:id", taskController.delete)

// export const router = router // Removed redundant export
