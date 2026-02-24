import { Request, Response } from "express"
import { commissionService } from "./service"
import { logActivity } from "../../utils/activity"

export const commissionController = {
  listLedger: async (req: Request, res: Response) => {
    if (!req.user?.tenantId) throw { status: 401, message: "Unauthorized: Missing tenant context" }
    const { userId, limit } = req.query
    // Only owner or team leader can see others? 
    // Sales can only see their own.
    const targetUserId = (req.user.roles.includes("owner") || req.user.roles.includes("team_leader")) ? (userId as string) : req.user.id
    
    const ledger = await commissionService.listLedger(req.user.tenantId, targetUserId, Number(limit) || 50)
    res.json(ledger)
  },
  createPlan: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const plan = await commissionService.createPlan(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "commission.plan.created", entityType: "commission_plan", entityId: plan.id })
    res.json(plan)
  },
  createRule: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const rule = await commissionService.createRule(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "commission.rule.created", entityType: "commission_rule", entityId: rule.id })
    res.json(rule)
  },
  createLedgerEntry: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const entry = await commissionService.createLedgerEntry(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "commission.ledger.created", entityType: "commission_ledger", entityId: entry.id })
    res.json(entry)
  },
  approveLedgerEntry: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const approval = await commissionService.approveLedgerEntry(tenantId, req.params.id, req.user?.id || "")
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "commission.approved", entityType: "commission_approval", entityId: approval.id })
    res.json(approval)
  }
}
