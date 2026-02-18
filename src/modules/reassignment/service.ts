import { prisma } from "../../prisma/client"

export const reassignmentService = {
  evaluateAndReassign: async (tenantId: string, leadId: string, triggerKey: string) => {
    const rules = await prisma.reassignmentRule.findMany({ where: { tenantId, triggerKey, isActive: true } })
    if (rules.length === 0) return null
    const pool = await prisma.reassignmentPool.findFirst({ where: { tenantId } })
    if (!pool) return null
    const members = await prisma.poolMember.findMany({ where: { tenantId, poolId: pool.id }, include: { user: true } })
    if (members.length === 0) return null
    const chosen = (members as Array<{ userId: string; weight: number }>).sort((a, b) => b.weight - a.weight)[0]
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } })
    if (!lead) return null
    await prisma.lead.update({ where: { id: leadId, tenantId }, data: { assignedUserId: chosen.userId } })
    const event = await prisma.reassignmentEvent.create({ data: { tenantId, leadId, fromUserId: lead.assignedUserId || undefined, toUserId: chosen.userId, ruleId: rules[0]?.id } })
    await prisma.leadAssignment.create({ data: { tenantId, leadId, assignedUserId: chosen.userId, assignedBy: null, reason: "auto" } })
    return event
  },

  addNegligencePoints: (tenantId: string, leadId: string, userId: string, points: number, reason: string) =>
    prisma.negligencePoint.create({ data: { tenantId, leadId, userId, points, reason } })
}
