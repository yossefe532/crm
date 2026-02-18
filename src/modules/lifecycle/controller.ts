import { Request, Response } from "express"
import { lifecycleService } from "./service"
import { logActivity } from "../../utils/activity"
import { intelligenceService } from "../intelligence/service"
import { notificationService } from "../notifications/service"

export const lifecycleController = {
  createState: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const state = await lifecycleService.createState(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead_state.created", entityType: "lead_state", entityId: state.id })
    res.json(state)
  },
  createTransition: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const transition = await lifecycleService.createTransition(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead_transition.created", entityType: "lead_transition", entityId: transition.id })
    res.json(transition)
  },
  transitionLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const state = await lifecycleService.transitionLead(tenantId, req.params.leadId, req.body.toStateId, req.user?.id)
    const event = await notificationService.publishEvent(tenantId, "lead.stage.completed", {
      leadId: req.params.leadId,
      stage: state.code,
      changedBy: req.user?.id,
      targets: ["owner", "team_leader"]
    })
    await notificationService.queueDelivery(tenantId, event.id, "in_app")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.transitioned", entityType: "lead", entityId: req.params.leadId, metadata: { toStateId: req.body.toStateId } })
    intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.params.leadId, userId: req.user?.id })
    res.json(state)
  },
  createDeadline: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const deadline = await lifecycleService.createDeadline(tenantId, req.body.leadId, req.body.stateId, new Date(req.body.dueAt))
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.deadline.created", entityType: "lead_deadline", entityId: deadline.id })
    intelligenceService.queueTrigger({ type: "task_changed", tenantId, leadId: req.body.leadId, userId: req.user?.id })
    res.json(deadline)
  },
  requestExtension: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    if (!roles.includes("owner") && !roles.includes("sales")) {
      throw { status: 403, message: "غير مصرح بطلب تمديد" }
    }
    const extension = await lifecycleService.requestExtension(tenantId, req.body.leadId, req.body.stateId, req.user?.id || "", Number(req.body.extensionHours), req.body.reason)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.extension.requested", entityType: "lead_extension", entityId: extension.id })
    intelligenceService.queueTrigger({ type: "lead_changed", tenantId, leadId: req.body.leadId, userId: req.user?.id })
    res.json(extension)
  },
  approveExtension: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    if (!roles.includes("owner") && !roles.includes("team_leader")) {
      throw { status: 403, message: "غير مصرح باعتماد التمديد" }
    }
    const extension = await lifecycleService.approveExtension(tenantId, req.params.id, req.user?.id || "")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.extension.approved", entityType: "lead_extension", entityId: extension.id })
    res.json(extension)
  },
  rejectExtension: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    if (!roles.includes("owner") && !roles.includes("team_leader")) {
      throw { status: 403, message: "غير مصرح برفض التمديد" }
    }
    const extension = await lifecycleService.rejectExtension(tenantId, req.params.id, req.user?.id || "", req.body?.reason)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.extension.rejected", entityType: "lead_extension", entityId: extension.id })
    res.json(extension)
  }
}
