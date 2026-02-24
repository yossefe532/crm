import { prisma } from "../../prisma/client"
import { Request, Response } from "express"
import { goalsService } from "./service"
import { coreService } from "../core/service"
import { logActivity } from "../../utils/activity"

export const goalsController = {
  createPlan: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    if (!roles.includes("owner") && !roles.includes("team_leader")) throw { status: 403, message: "غير مصرح" }
    const name = String(req.body?.name || "").trim()
    const period = String(req.body?.period || "").trim()
    if (!name) throw { status: 400, message: "الاسم مطلوب" }
    if (!["weekly", "monthly"].includes(period)) throw { status: 400, message: "نوع الفترة غير صحيح" }
    if (roles.includes("team_leader") && !req.user?.id) throw { status: 403, message: "غير مصرح" }
    const plan = await goalsService.createPlan(tenantId, { 
      name, 
      period, 
      startsAt: req.body?.startsAt, 
      endsAt: req.body?.endsAt,
      isPinned: req.body?.isPinned === true
    })
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "goal.plan.created", entityType: "goal_plan", entityId: plan.id })
    res.json(plan)
  },
  listPlans: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const plans = await goalsService.listPlans(tenantId)
    res.json(plans)
  },
  deletePlan: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const planId = String(req.params.planId || "")
    if (!req.user?.roles?.includes("owner")) throw { status: 403, message: "غير مصرح" }
    await goalsService.deletePlan(tenantId, planId)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "goal.plan.deleted", entityType: "goal_plan", entityId: planId })
    res.json({ message: "تم حذف الخطة بنجاح" })
  },
  listTargets: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const planId = String(req.params.planId || "").trim()
    if (!planId) throw { status: 400, message: "الخطة مطلوبة" }
    const targets = await goalsService.listTargets(tenantId, planId)
    res.json(targets)
  },
  setTargets: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const roles = req.user?.roles || []
    if (!roles.includes("owner") && !roles.includes("team_leader")) throw { status: 403, message: "غير مصرح" }
    const planId = String(req.params.planId || "").trim()
    const targets = Array.isArray(req.body?.targets)
      ? (req.body.targets as Array<{ subjectType: "user" | "team" | "all"; subjectId: string; metricKey: string; targetValue: number }>)
      : []
    if (!planId) throw { status: 400, message: "الخطة مطلوبة" }
    if (roles.includes("team_leader")) {
      const team = await coreService.getTeamByLeader(tenantId, req.user?.id || "")
      if (!team) throw { status: 400, message: "لا يوجد فريق مرتبط بك" }
      const invalid = targets.some((target) => target.subjectType !== "team" || target.subjectId !== team.id)
      if (invalid) throw { status: 403, message: "لا يمكن تعيين أهداف إلا لفريقك فقط" }
    }
    const normalized = targets.map((target) => ({
      ...target,
      subjectId: target.subjectType === "all" ? tenantId : target.subjectId
    }))
    const saved = await goalsService.setTargets(tenantId, planId, normalized)
    await logActivity({ tenantId, actorUserId: req.user?.id, action: "goal.targets.updated", entityType: "goal_plan", entityId: planId })
    res.json(saved)
  },
  report: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const planId = String(req.params.planId || "").trim()
    const report = await goalsService.buildReport(tenantId, planId)
    res.json(report)
  },
  overview: async (req: Request, res: Response) => {
    const tenantId = req.user?.tenantId || ""
    const period = req.query.period ? String(req.query.period) : "weekly"
    const plan = await goalsService.getActivePlan(tenantId, period)
    if (!plan) {
      res.json({ plan: null, report: null })
      return
    }
    const report = await goalsService.buildReport(tenantId, plan.id)
    res.json({ plan, report })
  }
}
