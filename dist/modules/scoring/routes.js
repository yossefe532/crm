"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const asyncHandler_1 = require("../../utils/asyncHandler");
const controller_1 = require("./controller");
const rbac_1 = require("../../middleware/rbac");
exports.router = (0, express_1.Router)();
exports.router.post("/leads/:leadId/score", (0, rbac_1.requirePermission)("leads.score"), (0, asyncHandler_1.asyncHandler)(controller_1.scoringController.scoreLead));
