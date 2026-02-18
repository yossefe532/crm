"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const asyncHandler_1 = require("../../utils/asyncHandler");
const controller_1 = require("./controller");
const rbac_1 = require("../../middleware/rbac");
const validate_1 = require("../../middleware/validate");
const schema_1 = require("./schema");
exports.router = (0, express_1.Router)();
exports.router.post("/", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader"))
        return next();
    return (0, rbac_1.requirePermission)("users.create")(req, res, next);
}, (0, validate_1.validate)(schema_1.createUserSchema), (0, asyncHandler_1.asyncHandler)(controller_1.coreController.createUser));
exports.router.get("/", (0, rbac_1.requirePermission)("users.read"), (0, asyncHandler_1.asyncHandler)(controller_1.coreController.listUsers));
exports.router.get("/:userId", (0, rbac_1.requirePermission)("users.read"), (0, asyncHandler_1.asyncHandler)(controller_1.coreController.getUser));
exports.router.put("/:userId", rbac_1.requireOwner, (0, rbac_1.requirePermission)("users.update"), (0, validate_1.validate)(schema_1.updateUserSchema), (0, asyncHandler_1.asyncHandler)(controller_1.coreController.updateUser));
exports.router.delete("/:userId", rbac_1.requireOwner, (0, rbac_1.requirePermission)("users.delete"), (0, asyncHandler_1.asyncHandler)(controller_1.coreController.deleteUser));
exports.router.post("/:userId/reset-password", rbac_1.requireOwner, (0, rbac_1.requirePermission)("users.update"), (0, asyncHandler_1.asyncHandler)(controller_1.coreController.resetUserPassword));
exports.router.get("/:userId/permissions", (0, rbac_1.requirePermission)("users.read"), (0, asyncHandler_1.asyncHandler)(controller_1.coreController.listUserPermissions));
exports.router.post("/:userId/permissions", rbac_1.requireOwner, (0, rbac_1.requirePermission)("users.update"), (0, asyncHandler_1.asyncHandler)(controller_1.coreController.updateUserPermissions));
