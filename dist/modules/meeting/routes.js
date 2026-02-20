"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const asyncHandler_1 = require("../../utils/asyncHandler");
const controller_1 = require("./controller");
const rbac_1 = require("../../middleware/rbac");
exports.router = (0, express_1.Router)();
exports.router.get("/", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("meetings.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.meetingController.listMeetings));
exports.router.post("/", (0, rbac_1.requirePermission)("meetings.create"), (0, asyncHandler_1.asyncHandler)(controller_1.meetingController.createMeeting));
exports.router.patch("/:id", (0, rbac_1.requirePermission)("meetings.update"), (0, asyncHandler_1.asyncHandler)(controller_1.meetingController.updateStatus));
exports.router.post("/:id/reschedules", (0, rbac_1.requirePermission)("meetings.update"), (0, asyncHandler_1.asyncHandler)(controller_1.meetingController.createRescheduleRequest));
exports.router.post("/:id/reminders", (0, rbac_1.requirePermission)("meetings.update"), (0, asyncHandler_1.asyncHandler)(controller_1.meetingController.createReminder));
exports.router.post("/:id/remind-now", (0, rbac_1.requirePermission)("meetings.update"), (0, asyncHandler_1.asyncHandler)(controller_1.meetingController.sendReminderNow));
