import { Request, Response } from "express"
import { reassignmentService } from "./service"
import { logActivity } from "../../utils/activity"

export const reassignmentController = {
  triggerReassignment: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const event = await reassignmentService.evaluateAndReassign(tenantId, req.body.leadId, req.body.triggerKey)
    if (event) {
      await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.reassigned", entityType: "lead", entityId: event.leadId, metadata: { toUserId: event.toUserId } })
    }
    res.json({ event })
  },
  addNegligence: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const record = await reassignmentService.addNegligencePoints(tenantId, req.body.leadId, req.body.userId, Number(req.body.points), req.body.reason)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "negligence.added", entityType: "negligence_point", entityId: record.id })
    res.json(record)
  }
}
