import { Request, Response } from "express"
import { analyticsService } from "./service"
import { logActivity } from "../../utils/activity"
import { prisma } from "../../prisma/client"

export const analyticsController = {
  listDailyMetrics: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = req.user?.id
    const roles = req.user?.roles || []
    const role = roles.includes("owner") ? "owner" : roles.includes("team_leader") ? "team_leader" : "sales"

    const metrics = await analyticsService.listDailyMetrics(tenantId, req.query.from as string | undefined, req.query.to as string | undefined, userId, role)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "metrics.daily.listed", entityType: "lead_metrics_daily" })
    res.json(metrics)
  },
  listRankings: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const type = req.query.type ? String(req.query.type) : undefined
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const rows = await analyticsService.listRankingSnapshots(tenantId, type, limit)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "ranking.snapshot.listed", entityType: "ranking_snapshot" })
    res.json(rows)
  },
  createDailyMetrics: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const metrics = await analyticsService.createDailyMetrics(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "metrics.daily.created", entityType: "lead_metrics_daily", entityId: metrics.id })
    res.json(metrics)
  },
  createDisciplineSnapshot: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const snapshot = await analyticsService.createDisciplineSnapshot(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "discipline.snapshot.created", entityType: "discipline_snapshot", entityId: snapshot.id })
    res.json(snapshot)
  },
  createRankingSnapshot: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const snapshot = await analyticsService.createRankingSnapshot(tenantId, req.body)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "ranking.snapshot.created", entityType: "ranking_snapshot", entityId: snapshot.id })
    res.json(snapshot)
  },

  getDashboardMetrics: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const userId = req.user?.id || ""
    const roles = req.user?.roles || []
    const role = roles.includes("owner") ? "owner" : roles.includes("team_leader") ? "team_leader" : "sales"

    const [distribution, conversion, avgTime, salesPerformance, teamPerformance, revenueOverTime, leadSources, keyMetrics, salesStageSummary] = await Promise.all([
      analyticsService.getStageDistribution(tenantId, userId, role),
      analyticsService.getConversionRate(tenantId, userId, role),
      analyticsService.getAvgTimePerStage(tenantId, userId, role),
      analyticsService.getSalesPerformance(tenantId, userId, role),
      analyticsService.getTeamPerformance(tenantId, userId, role),
      analyticsService.getRevenueOverTime(tenantId, userId, role),
      analyticsService.getLeadSources(tenantId, userId, role),
      analyticsService.getKeyMetrics(tenantId, userId, role),
      analyticsService.getSalesStageSummary(tenantId, userId, role)
    ])
    
    res.json({ 
      distribution, 
      conversion, 
      avgTime, 
      salesPerformance, 
      teamPerformance,
      revenueOverTime,
      leadSources,
      keyMetrics,
      salesStageSummary
    })
  },

  getLeadTimeline: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    // Check if user has access to this lead
    if (req.user?.roles?.includes("sales") && !req.user?.roles?.includes("team_leader") && !req.user?.roles?.includes("owner")) {
       const lead = await prisma.lead.findFirst({ where: { id: req.params.leadId, tenantId, assignedUserId: req.user.id } })
       if (!lead) throw { status: 403, message: "غير مصرح" }
    }
    const timeline = await analyticsService.getLeadTimeline(tenantId, req.params.leadId)
    res.json(timeline)
  },
  getEmployeePerformance: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const period = String(req.query.period || "monthly")
    const periodDays = period === "weekly" ? 7 : 30
    const rows = await analyticsService.getEmployeePerformance(tenantId, periodDays)
    res.json(rows)
  }
}
