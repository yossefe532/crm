import { Router } from "express"
import { asyncHandler } from "../../utils/asyncHandler"
import { leadController } from "./controller"
import { requirePermission } from "../../middleware/rbac"
import { validate } from "../../middleware/validate"
import { createLeadSchema } from "./schema"

export const router = Router()

router.post("/", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.create")(req, res, next)
}, validate(createLeadSchema), asyncHandler(leadController.createLead))
router.get("/", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.read")(req, res, next)
}, asyncHandler(leadController.listLeads))
router.get("/failures", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.read")(req, res, next)
}, asyncHandler(leadController.listFailures))

router.get("/closures", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.read")(req, res, next)
}, asyncHandler(leadController.listClosures))

router.post("/closures/:closureId/decide", requirePermission("leads.update"), asyncHandler(leadController.decideClosure))

router.get("/deadlines", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.read")(req, res, next)
}, asyncHandler(leadController.listDeadlines))
router.get("/tasks", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.read")(req, res, next)
}, asyncHandler(leadController.listTasks))
router.post("/sources", requirePermission("lead_sources.create"), asyncHandler(leadController.createLeadSource))

router.get("/sources", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("lead_sources.read")(req, res, next)
}, asyncHandler(leadController.listLeadSources))

router.get("/archive/deleted", requirePermission("leads.read"), asyncHandler(leadController.listDeletedLeads))

router.get("/:id", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.read")(req, res, next)
}, asyncHandler(leadController.getLead))
router.get("/:id/deadline", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.read")(req, res, next)
}, asyncHandler(leadController.getDeadline))

router.patch("/:id", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.updateLead))

router.patch("/:id/stage", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.updateStage))

router.post("/:id/stage/undo", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.undoStage))

router.post("/:id/close", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.closeLead))

router.post("/:id/fail", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.failLead))

router.post("/failures/:failureId/resolve", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.resolveFailure))

router.delete("/:id", requirePermission("leads.delete"), asyncHandler(leadController.deleteLead))
router.post("/:id/restore", requirePermission("leads.delete"), asyncHandler(leadController.restoreLead))

router.post("/:id/assign", requirePermission("leads.assign"), asyncHandler(leadController.assignLead))
router.post("/:id/unassign", requirePermission("leads.assign"), asyncHandler(leadController.unassignLead))

router.post("/:id/contacts", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.addLeadContact))

router.post("/:id/tasks", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.addLeadTask))

router.post("/:id/calls", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.addCallLog))

// New Lifecycle Routes
router.post("/:id/advance", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.advanceStage))

router.post("/:id/deal", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.submitDeal))

router.post("/deals/:dealId/approve", asyncHandler(leadController.approveDeal))
router.post("/deals/:dealId/reject", asyncHandler(leadController.rejectDeal))

router.post("/:id/extension", (req, res, next) => {
  if (req.user?.roles?.includes("team_leader") || req.user?.roles?.includes("sales")) return next()
  return requirePermission("leads.update")(req, res, next)
}, asyncHandler(leadController.requestExtension))

router.post("/extensions/:extensionId/approve", asyncHandler(leadController.approveExtension))
router.post("/extensions/:extensionId/reject", asyncHandler(leadController.rejectExtension))

