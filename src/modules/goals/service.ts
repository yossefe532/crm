import { Prisma, GoalTarget, GoalPlan } from "@prisma/client"
import { prisma } from "../../prisma/client"
import { notificationService } from "../notifications/service"
import { commissionService } from "../commission/service"

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
    const closureCount = await prisma.leadClosure.count({
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
    
    const dealCount = await prisma.deal.count({
      where: {
        tenantId,
        status: "approved",
        closedAt: { gte: from, lte: to },
        ...(target.subjectType === "user"
          ? { lead: { assignedUserId: target.subjectId } }
          : target.subjectType === "team"
            ? { lead: { teamId: target.subjectId } }
            : {})
      }
    })
    return closureCount + dealCount
  }
  if (target.metricKey === "revenue") {
    const closureSum = await prisma.leadClosure.aggregate({
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

    const dealSum = await prisma.deal.aggregate({
      where: {
        tenantId,
        status: "approved",
        closedAt: { gte: from, lte: to },
        ...(target.subjectType === "user"
          ? { lead: { assignedUserId: target.subjectId } }
          : target.subjectType === "team"
            ? { lead: { teamId: target.subjectId } }
            : {})
      },
      _sum: { price: true }
    })
    
    return (closureSum._sum.amount?.toNumber() || 0) + (dealSum._sum?.price?.toNumber() || 0)
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

const metricNames: Record<string, string> = {
  leads_created: "إنشاء عملاء",
  leads_closed: "إغلاق صفقات",
  revenue: "الإيرادات",
  meetings: "الاجتماعات",
  calls: "المكالمات"
}

const processTargetAchievement = async (
  tenantId: string, 
  plan: GoalPlan, 
  target: GoalTarget, 
  actualValue: number
) => {
    const targetValue = target.targetValue.toNumber()
    const ratio = targetValue > 0 ? actualValue / targetValue : 0
    const now = new Date()

    if (ratio >= 1 && !target.achievedAt) {
        await prisma.goalTarget.update({ where: { id: target.id }, data: { achievedAt: now } })
        target.achievedAt = now

        // Notify achievement
        let recipientIds: string[] = []
        if (target.subjectType === "user") {
          recipientIds = [target.subjectId]
        } else if (target.subjectType === "team") {
          const members = await prisma.teamMember.findMany({
            where: { tenantId, teamId: target.subjectId, leftAt: null },
            select: { userId: true }
          })
          recipientIds = members.map(m => m.userId)
        } else if (target.subjectType === "all") {
           const allUsers = await prisma.user.findMany({ where: { tenantId, status: "active", deletedAt: null }, select: { id: true } })
           recipientIds = allUsers.map(u => u.id)
        }

        // Trigger Commission Bonus
        const bonusAmount = (target as any).bonusAmount
        if (bonusAmount && bonusAmount.toNumber() > 0 && recipientIds.length > 0) {
            for (const userId of recipientIds) {
                await commissionService.createLedgerEntry(tenantId, {
                    userId,
                    amount: bonusAmount.toNumber(),
                    entryType: "goal_bonus",
                    currency: "EGP"
                }).catch(err => console.error("Failed to create bonus commission:", err))
            }
        }

        if (recipientIds.length > 0) {
            const metricName = metricNames[target.metricKey] || target.metricKey
            await notificationService.sendMany(recipientIds, {
                tenantId,
                title: "مبروك! تم تحقيق الهدف 🎉",
                message: `تم تحقيق هدف ${plan.name} (${metricName}) بنسبة ${Math.round(ratio * 100)}%`,
                type: "success",
                entityType: "goal_target",
                entityId: target.id,
                actionUrl: `/goals`
            }).catch(console.error)
        }
    }
    
    if (ratio < 1 && target.achievedAt) {
        await prisma.goalTarget.update({ where: { id: target.id }, data: { achievedAt: null } })
        target.achievedAt = null
    }

    return ratio
}

export const goalsService = {
  createPlan: async (tenantId: string, data: { name: string; period: string; startsAt?: string; endsAt?: string; isPinned?: boolean }) => {
    const range = resolvePeriodDates(data.period, data.startsAt, data.endsAt)
    
    // If this plan is pinned, unpin all others
    if (data.isPinned) {
      await prisma.goalPlan.updateMany({
        where: { tenantId, isPinned: true },
        data: { isPinned: false }
      })
    }

    return prisma.goalPlan.create({
      data: {
        tenantId,
        name: data.name,
        period: data.period,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        isPinned: data.isPinned || false
      }
    })
  },
  listPlans: (tenantId: string) =>
    prisma.goalPlan.findMany({ where: { tenantId }, orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }] }),
  getPlan: (tenantId: string, planId: string) =>
    prisma.goalPlan.findFirst({ where: { tenantId, id: planId } }),
  deletePlan: async (tenantId: string, planId: string) => {
    const plan = await prisma.goalPlan.findFirst({ where: { tenantId, id: planId } })
    if (!plan) throw { status: 404, message: "الخطة غير موجودة" }
    
    const isExpired = plan.endsAt < new Date()
    const isCompleted = plan.status === "completed"
    
    if (!isExpired && !isCompleted) {
      throw { status: 400, message: "لا يمكن حذف الخطة قبل انتهائها أو اكتمالها" }
    }

    await prisma.goalTarget.deleteMany({ where: { tenantId, planId } })
    return prisma.goalPlan.delete({ where: { tenantId, id: planId } })
  },
  listTargets: (tenantId: string, planId: string) =>
    prisma.goalTarget.findMany({ where: { tenantId, planId } }),
  setTargets: async (tenantId: string, planId: string, targets: Array<{ subjectType: "user" | "team" | "all"; subjectId: string; metricKey: string; targetValue: number; weight?: number; bonusAmount?: number }>) => {
    // 1. Get existing plan
    const plan = await prisma.goalPlan.findUnique({ where: { id: planId } })
    if (!plan) throw { status: 404, message: "الخطة غير موجودة" }

    // 2. Clear old targets
    await prisma.goalTarget.deleteMany({ where: { tenantId, planId } })

    if (!targets.length) return []

    // 3. Create new targets
    const data = targets.map((target) => ({
      tenantId,
      planId,
      subjectType: target.subjectType,
      subjectId: target.subjectId,
      metricKey: target.metricKey,
      targetValue: new Prisma.Decimal(target.targetValue),
      weight: target.weight !== undefined ? new Prisma.Decimal(target.weight) : undefined,
      bonusAmount: target.bonusAmount !== undefined ? new Prisma.Decimal(target.bonusAmount) : undefined
    }))
    
    await prisma.goalTarget.createMany({ data })

    // 4. Notify targets (Optimized)
    // Group targets by subject to avoid spamming multiple notifications to the same user/team
    // However, logic below sends one notification per target assignment, which is acceptable if they are distinct goals.
    
    for (const target of targets) {
      let recipientIds: string[] = []
      
      if (target.subjectType === "user") {
        recipientIds = [target.subjectId]
      } else if (target.subjectType === "team") {
        const members = await prisma.teamMember.findMany({
          where: { tenantId, teamId: target.subjectId, leftAt: null, deletedAt: null },
          select: { userId: true }
        })
        recipientIds = members.map(m => m.userId)
      } else if (target.subjectType === "all") {
        const allUsers = await prisma.user.findMany({ 
          where: { tenantId, status: "active", deletedAt: null }, 
          select: { id: true } 
        })
        recipientIds = allUsers.map(u => u.id)
      }

      if (recipientIds.length > 0) {
        const metricName = metricNames[target.metricKey] || target.metricKey
        
        await notificationService.sendMany(recipientIds, {
          tenantId,
          title: "هدف جديد 🎯",
          message: `تم تحديد هدف جديد لك في خطة "${plan.name}": ${metricName} - المستهدف: ${target.targetValue}`,
          type: "assignment",
          entityType: "goal_plan",
          entityId: planId,
          actionUrl: `/goals`
        }).catch(console.error)
      }
    }

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
      const ratio = await processTargetAchievement(tenantId, plan, target, actualValue)
      const score = clamp(ratio * 100)
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
    }),

  checkAchievement: async (tenantId: string, userId: string) => {
    // 1. Get user's team
    const teamMember = await prisma.teamMember.findFirst({ 
        where: { tenantId, userId, leftAt: null }, 
        select: { teamId: true } 
    })
    const teamId = teamMember?.teamId

    // 2. Find active plans
    const now = new Date()
    const activePlans = await prisma.goalPlan.findMany({
        where: { 
            tenantId, 
            status: "active",
            startsAt: { lte: now }, 
            endsAt: { gte: now } 
        }
    })

    // 3. Find relevant targets
    for (const plan of activePlans) {
        const targets = await prisma.goalTarget.findMany({
            where: {
                tenantId,
                planId: plan.id,
                OR: [
                    { subjectType: "user", subjectId: userId },
                    { subjectType: "team", subjectId: teamId || "00000000-0000-0000-0000-000000000000" },
                    { subjectType: "all" }
                ]
            }
        })

        const range = { from: plan.startsAt, to: now < plan.endsAt ? now : plan.endsAt }
        
        for (const target of targets) {
            const actualValue = await getActualValue(tenantId, target, range)
            await processTargetAchievement(tenantId, plan, target, actualValue)
        }
    }
  }
}
