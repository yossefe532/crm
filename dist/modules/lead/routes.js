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
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.create")(req, res, next);
}, (0, validate_1.validate)(schema_1.createLeadSchema), (0, asyncHandler_1.asyncHandler)(controller_1.leadController.createLead));
exports.router.get("/", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.listLeads));
exports.router.get("/failures", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.listFailures));
exports.router.get("/closures", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.listClosures));
exports.router.post("/closures/:closureId/decide", (0, rbac_1.requirePermission)("leads.update"), (0, asyncHandler_1.asyncHandler)(controller_1.leadController.decideClosure));
exports.router.get("/deadlines", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.listDeadlines));
exports.router.get("/tasks", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.listTasks));
exports.router.post("/sources", (0, rbac_1.requirePermission)("lead_sources.create"), (0, asyncHandler_1.asyncHandler)(controller_1.leadController.createLeadSource));
exports.router.get("/sources", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("lead_sources.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.listLeadSources));
exports.router.get("/:id", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.getLead));
exports.router.get("/:id/deadline", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.read")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.getDeadline));
exports.router.patch("/:id", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.update")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.updateLead));
exports.router.patch("/:id/stage", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.update")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.updateStage));
exports.router.post("/:id/stage/undo", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.update")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.undoStage));
exports.router.post("/:id/close", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.update")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.closeLead));
exports.router.post("/:id/fail", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.update")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.failLead));
exports.router.post("/failures/:failureId/resolve", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.update")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.resolveFailure));
exports.router.delete("/:id", (0, rbac_1.requirePermission)("leads.delete"), (0, asyncHandler_1.asyncHandler)(controller_1.leadController.deleteLead));
exports.router.post("/:id/assign", (0, rbac_1.requirePermission)("leads.assign"), (0, asyncHandler_1.asyncHandler)(controller_1.leadController.assignLead));
exports.router.post("/:id/unassign", (0, rbac_1.requirePermission)("leads.assign"), (0, asyncHandler_1.asyncHandler)(controller_1.leadController.unassignLead));
exports.router.post("/:id/contacts", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.update")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.addLeadContact));
exports.router.post("/:id/tasks", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.update")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.addLeadTask));
exports.router.post("/:id/calls", (req, res, next) => {
    if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales"))
        return next();
    return (0, rbac_1.requirePermission)("leads.update")(req, res, next);
}, (0, asyncHandler_1.asyncHandler)(controller_1.leadController.addCallLog));
