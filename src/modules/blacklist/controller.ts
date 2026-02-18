import { Request, Response } from "express"
import { blacklistService } from "./service"
import { logActivity } from "../../utils/activity"

export const blacklistController = {
  createEntry: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const entry = await blacklistService.createEntry(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "blacklist.entry.created", entityType: "blacklist_entry", entityId: entry.id })
    res.json(entry)
  },
  checkLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const matches = await blacklistService.checkLead(tenantId, req.body.leadId, req.body.identifiers || [])
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "blacklist.checked", entityType: "lead", entityId: req.body.leadId })
    res.json(matches)
  }
}
