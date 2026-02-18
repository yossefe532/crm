import { Prisma } from "@prisma/client"
import { prisma } from "../../prisma/client"

type GoalPlan = {
  id: string
  tenantId: string
  name: string
  period: string
  startsAt: Date
  endsAt: Date
  status: string
}

type GoalTarget = {
  id: string
  tenantId: string
  planId: string
  subjectType: "user" | "team" | "all"
  subjectId: string
  metricKey: string
  targetValue: { toNumber(): number }
  weight?: { toNumber(): number } | null
  achievedAt?: Date | null
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))

const resolvePeriodDates = (period: string, startsAt?: string, endsAt?: string) => {
  if (startsAt && endsAt) {
    return { startsAt: new Date(startsAt), endsAt: new Date(endsAt) }
  }
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === "weekly") {
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { startsAt: start, endsAt: end }
  }
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { startsAt: start, endsAt: end }
}

const buildStatus = (ratio: number, periodProgress: number) => {
  if (ratio >= 1) return "success"
  if (ratio >= periodProgress) return "warning"
  return "danger"
}

const buildRating = (score: number) => {
  if (score >= 100) return "ممتاز"
  if (score >= 80) return "جيد جداً"
  if (score >= 60) return "جيد"
  return "بحاجة لتحسين"
}

const getActualValue = async (
  tenantId: string,
  target: GoalTarget,
  range: { from: Date; to: Date }
) => {
  const { from, to } = range
  if (target.metricKey === "leads_created") {
    const count = await prisma.lead.count({
      where: {
        tenantId,
        createdAt: { gte: from, lte: to },
        ...(target.subjectType === "user"
          ? { assignedUserId: target.subjectId }
          : target.subjectType === "team"
            ? { teamId: target.subjectId }
            : {})
      }
    })
    return count
  }
  if (target.metricKey === "leads_closed") {
    const count = await prisma.leadClosure.count({
      where: {
        tenantId,
        status: "approved",
        closedAt: { gte: from, lte: to },
        ...(target.subjectType === "user"
          ? { closedBy: target.subjectId }
          : target.subjectType === "team"
            ? { lead: { teamId: target.subjectId } }
            : {})
      }
    })
    return count
  }
  if (target.metricKey === "revenue") {
    const sum = await prisma.leadClosure.aggregate({
      where: {
        tenantId,
        status: "approved",
        closedAt: { gte: from, lte: to },
        ...(target.subjectType === "user"
          ? { closedBy: target.subjectId }
          : target.subjectType === "team"
            ? { lead: { teamId: target.subjectId } }
            : {})
      },
      _sum: { amount: true }
    })
    return sum._sum.amount?.toNumber() || 0
  }
  if (target.metricKey === "meetings") {
    const count = await prisma.meeting.count({
      where: {
        tenantId,
        startsAt: { gte: from, lte: to },
        ...(target.subjectType === "user"
          ? { organizerUserId: target.subjectId }
          : target.subjectType === "team"
            ? { lead: { teamId: target.subjectId } }
            : {})
      }
    })
    return count
  }
  if (target.metricKey === "calls") {
    const count = await prisma.callLog.count({
      where: {
        tenantId,
        callTime: { gte: from, lte: to },
        ...(target.subjectType === "user"
          ? { callerUserId: target.subjectId }
          : target.subjectType === "team"
            ? { lead: { teamId: target.subjectId } }
            : {})
      }
    })
    return count
  }
  return 0
}

export const goalsService = {
  createPlan: async (tenantId: string, data: { name: string; period: string; startsAt?: string; endsAt?: string }) => {
    const range = resolvePeriodDates(data.period, data.startsAt, data.endsAt)
    return prisma.goalPlan.create({
      data: {
        tenantId,
        name: data.name,
        period: data.period,
        startsAt: range.startsAt,
        endsAt: range.endsAt
      }
    })
  },
  listPlans: (tenantId: string) =>
    prisma.goalPlan.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
  getPlan: (tenantId: string, planId: string) =>
    prisma.goalPlan.findFirst({ where: { tenantId, id: planId } }),
  deletePlan: async (tenantId: string, planId: string) => {
    await prisma.goalTarget.deleteMany({ where: { tenantId, planId } })
    return prisma.goalPlan.delete({ where: { tenantId, id: planId } })
  },
  listTargets: (tenantId: string, planId: string) =>
    prisma.goalTarget.findMany({ where: { tenantId, planId } }),
  setTargets: async (tenantId: string, planId: string, targets: Array<{ subjectType: "user" | "team" | "all"; subjectId: string; metricKey: string; targetValue: number; weight?: number }>) => {
    await prisma.goalTarget.deleteMany({ where: { tenantId, planId } })
    if (!targets.length) return []
    const data = targets.map((target) => ({
      tenantId,
      planId,
      subjectType: target.subjectType,
      subjectId: target.subjectId,
      metricKey: target.metricKey,
      targetValue: new Prisma.Decimal(target.targetValue),
      weight: target.weight !== undefined ? new Prisma.Decimal(target.weight) : undefined
    }))
    await prisma.goalTarget.createMany({ data })
    return prisma.goalTarget.findMany({ where: { tenantId, planId } })
  },
  buildReport: async (tenantId: string, planId: string) => {
    const plan = (await prisma.goalPlan.findFirst({ where: { tenantId, id: planId } })) as GoalPlan | null
    if (!plan) throw { status: 404, message: "الخطة غير موجودة" }
    const targets = (await prisma.goalTarget.findMany({ where: { tenantId, planId } })) as GoalTarget[]
    const now = new Date()
    const rangeEnd = now < plan.endsAt ? now : plan.endsAt
    const totalMs = plan.endsAt.getTime() - plan.startsAt.getTime()
    const elapsedMs = Math.max(0, rangeEnd.getTime() - plan.startsAt.getTime())
    const periodProgress = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 1
    const range = { from: plan.startsAt, to: rangeEnd }
    const rows = []
    for (const target of targets) {
      const actualValue = await getActualValue(tenantId, target, range)
      const targetValue = target.targetValue.toNumber()
      const ratio = targetValue > 0 ? actualValue / targetValue : 0
      const score = clamp(ratio * 100)
      if (ratio >= 1 && !target.achievedAt) {
        await prisma.goalTarget.update({ where: { id: target.id }, data: { achievedAt: now } })
        target.achievedAt = now
      }
      if (ratio < 1 && target.achievedAt) {
        await prisma.goalTarget.update({ where: { id: target.id }, data: { achievedAt: null } })
        target.achievedAt = null
      }
      rows.push({
        id: target.id,
        subjectType: target.subjectType,
        subjectId: target.subjectId,
        metricKey: target.metricKey,
        targetValue,
        actualValue,
        ratio,
        score,
        status: buildStatus(ratio, periodProgress),
        rating: buildRating(score)
      })
    }
    return { plan, periodProgress, rows }
  },

  deleteOldCompletedTargets: async (tenantId: string) => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    await prisma.goalTarget.deleteMany({
      where: {
        tenantId,
        achievedAt: {
          lt: twoDaysAgo
        }
      }
    })
  },
  getActivePlan: async (tenantId: string, period: string) =>
    prisma.goalPlan.findFirst({
      where: { tenantId, period, status: "active", startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
      orderBy: { createdAt: "desc" }
    })
}
