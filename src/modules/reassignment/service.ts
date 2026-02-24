import { prisma } from "../../prisma/client"
import { notificationService } from "../notifications/service"

export const reassignmentService = {
  evaluateAndReassign: async (tenantId: string, leadId: string, triggerKey: string) => {
    const rules = await prisma.reassignmentRule.findMany({ where: { tenantId, name: triggerKey, isEnabled: true } })
    if (rules.length === 0) return null
    const pool = await prisma.reassignmentPool.findFirst({ where: { tenantId } })
    if (!pool) return null
    const members = await prisma.poolMember.findMany({ where: { tenantId, poolId: pool.id }, include: { user: true } })
    if (members.length === 0) return null
    const chosen = (members as Array<{ userId: string; weight: number }>).sort((a, b) => b.weight - a.weight)[0]
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } })
    if (!lead) return null
    
    const oldUserId = lead.assignedUserId

    await prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId: chosen.userId } })
    const event = await prisma.reassignmentEvent.create({ 
      data: { 
        tenantId, 
        leadId, 
        fromUserId: oldUserId || undefined, 
        toUserId: chosen.userId, 
        reason: "Rule: " + (rules[0]?.id || "unknown")
      } 
    })
    await prisma.leadAssignment.create({ data: { tenantId, leadId, assignedUserId: chosen.userId, assignedBy: null, reason: "auto" } })
    
    // Notify Old User
    if (oldUserId) {
        await notificationService.send({
            tenantId,
            userId: oldUserId,
            type: "warning",
            title: "تم سحب العميل منك",
            message: `تم سحب العميل ${lead.name} منك وإعادة تعيينه بسبب ${triggerKey === 'call_missed' ? 'عدم الاتصال' : 'قواعد النظام'}`,
            entityType: "lead",
            entityId: leadId,
            actionUrl: `/leads/${leadId}`
        }).catch(console.error)
    }

    // Notify New User
    await notificationService.send({
        tenantId,
        userId: chosen.userId,
        type: "assignment",
        title: "عميل جديد (إعادة تعيين)",
        message: `تم إسناد العميل ${lead.name} إليك من نظام التوزيع التلقائي`,
        entityType: "lead",
        entityId: leadId,
        actionUrl: `/leads/${leadId}`
    }).catch(console.error)

    return event
  },

  addNegligencePoints: async (tenantId: string, leadId: string, userId: string, points: number, reason: string) => {
    const res = await prisma.negligencePoint.create({ data: { tenantId, leadId, userId, points, reason } })
    
    await notificationService.send({
        tenantId,
        userId,
        type: "error",
        title: "نقاط تقصير",
        message: `تم تسجيل ${points} نقطة تقصير عليك. السبب: ${reason}`,
        entityType: "negligence_point",
        entityId: res.id,
        actionUrl: `/profile` // Or a performance dashboard
    }).catch(console.error)

    return res
  },

  getRules: (tenantId: string, triggerKey: string) =>
    prisma.reassignmentRule.findMany({ where: { tenantId, name: triggerKey, isEnabled: true } }),

  createEvent: (tenantId: string, leadId: string, oldUserId: string | null, userId: string, ruleId: string) =>
    prisma.reassignmentEvent.create({ 
      data: { 
        tenantId, 
        leadId, 
        fromUserId: oldUserId || undefined, 
        toUserId: userId, 
        reason: "Rule: " + ruleId 
      } 
    })
}
