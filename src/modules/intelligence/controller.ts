import { Request, Response } from "express"
import { intelligenceService } from "./service"
import { logActivity } from "../../utils/activity"

export const intelligenceController = {
  scoreLead: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const score = await intelligenceService.scoreLead(tenantId, req.params.leadId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "intelligence.lead.scored", entityType: "lead_score", entityId: score.id })
    res.json(score)
  },
  disciplineIndex: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const snapshot = await intelligenceService.computeDisciplineIndex(tenantId, req.params.userId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "intelligence.discipline.scored", entityType: "discipline_snapshot", entityId: snapshot.id })
    res.json(snapshot)
  },
  dealProbability: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const result = await intelligenceService.computeDealProbability(tenantId, req.params.dealId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "intelligence.deal.probability", entityType: "risk_score", entityId: result.riskScore.id })
    res.json(result)
  },
  revenueForecast: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const forecast = await intelligenceService.computeRevenueForecast(tenantId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "intelligence.revenue.forecast", entityType: "ranking_snapshot" })
    res.json(forecast)
  },
  reminderPriority: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const items = await intelligenceService.computeReminderPriorities(tenantId, req.body.userId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "intelligence.reminder.prioritized", entityType: "ranking_snapshot" })
    res.json({ items })
  },
  scripts: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const scripts = await intelligenceService.generateScripts(tenantId, req.params.leadId, req.body.stage)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "intelligence.scripts.generated", entityType: "ranking_snapshot" })
    res.json({ scripts })
  },
  performanceRanking: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const rows = await intelligenceService.computePerformanceRanking(tenantId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "intelligence.performance.rank", entityType: "ranking_snapshot" })
    res.json({ rows })
  },
  engagementWebhook: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || req.body.tenantId || ""
    const event = await intelligenceService.recordEngagementEvent(tenantId, req.body.leadId, { type: req.body.type, occurredAt: req.body.occurredAt, metadata: req.body.metadata })
    intelligenceService.queueTrigger({ type: "lead_engaged", tenantId, leadId: req.body.leadId })
    res.json(event)
  },
  triggerWebhook: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || req.body.tenantId || ""
    intelligenceService.queueTrigger({ type: req.body.type, tenantId, leadId: req.body.leadId, dealId: req.body.dealId, userId: req.body.userId })
    res.json({ status: "queued" })
  }
}
