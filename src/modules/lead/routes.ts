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
router.get("/", requirePermission("leads.read"), asyncHandler(leadController.listLeads))
router.get("/failures", requirePermission("leads.read"), asyncHandler(leadController.listFailures))
router.get("/closures", requirePermission("leads.read"), asyncHandler(leadController.listClosures))
router.post("/closures/:closureId/decide", requirePermission("leads.update"), asyncHandler(leadController.decideClosure))
router.get("/deadlines", requirePermission("leads.read"), asyncHandler(leadController.listDeadlines))
router.get("/:id", requirePermission("leads.read"), asyncHandler(leadController.getLead))
router.get("/:id/deadline", requirePermission("leads.read"), asyncHandler(leadController.getDeadline))
router.patch("/:id", requirePermission("leads.update"), asyncHandler(leadController.updateLead))
router.patch("/:id/stage", requirePermission("leads.update"), asyncHandler(leadController.updateStage))
router.post("/:id/stage/undo", requirePermission("leads.update"), asyncHandler(leadController.undoStage))
router.post("/:id/close", requirePermission("leads.update"), asyncHandler(leadController.closeLead))
router.post("/:id/fail", requirePermission("leads.update"), asyncHandler(leadController.failLead))
router.post("/failures/:failureId/resolve", requirePermission("leads.update"), asyncHandler(leadController.resolveFailure))
router.delete("/:id", requirePermission("leads.delete"), asyncHandler(leadController.deleteLead))
router.post("/:id/assign", requirePermission("leads.assign"), asyncHandler(leadController.assignLead))
router.post("/:id/unassign", requirePermission("leads.assign"), asyncHandler(leadController.unassignLead))
router.post("/:id/contacts", requirePermission("leads.update"), asyncHandler(leadController.addLeadContact))
router.post("/:id/tasks", requirePermission("leads.update"), asyncHandler(leadController.addLeadTask))
router.get("/tasks", requirePermission("leads.read"), asyncHandler(leadController.listTasks))
router.post("/:id/calls", requirePermission("leads.update"), asyncHandler(leadController.addCallLog))
router.post("/sources", requirePermission("lead_sources.create"), asyncHandler(leadController.createLeadSource))
router.get("/sources", requirePermission("lead_sources.read"), asyncHandler(leadController.listLeadSources))
