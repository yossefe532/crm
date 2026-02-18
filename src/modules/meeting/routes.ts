import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { meetingController } from "./controller"
import { requirePermission } from "../../middleware/rbac"

export const router = Router()

router.get("/", requirePermission("meetings.read"), asyncHandler(meetingController.listMeetings))
router.post("/", requirePermission("meetings.create"), asyncHandler(meetingController.createMeeting))
router.patch("/:id", requirePermission("meetings.update"), asyncHandler(meetingController.updateStatus))
router.post("/:id/reschedules", requirePermission("meetings.update"), asyncHandler(meetingController.createRescheduleRequest))
router.post("/:id/reminders", requirePermission("meetings.update"), asyncHandler(meetingController.createReminder))
router.post("/:id/remind-now", requirePermission("meetings.update"), asyncHandler(meetingController.sendReminderNow))
