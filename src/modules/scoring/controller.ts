import { Request, Response } from "express"
import { scoringService } from "./service"
import { logActivity } from "../../utils/activity"

export const scoringController = {
  scoreLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const score = await scoringService.scoreLead(tenantId, req.params.leadId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "lead.scored", entityType: "lead_score", entityId: score.id })
    res.json(score)
  }
}
