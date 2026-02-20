import { prisma } from "../../prisma/client"
import { Prisma } from "@prisma/client"

export const commissionService = {
  listLedger: (tenantId: string, userId?: string, limit = 50) => {
    const where: Prisma.CommissionLedgerWhereInput = { tenantId }
    if (userId) {
      where.userId = userId
    }
    return prisma.commissionLedger.findMany({ 
      where, 
      include: { approvals: true },
      orderBy: { createdAt: "desc" }, 
      take: limit 
    })
  },
  createPlan: (tenantId: string, data: { name: string }) =>
    prisma.commissionPlan.create({ data: { tenantId, name: data.name } }),

  createRule: (tenantId: string, data: { planId: string; rule: Record<string, unknown> }) =>
    prisma.commissionRule.create({ data: { tenantId, planId: data.planId, rule: data.rule as Prisma.InputJsonValue } }),

  createLedgerEntry: (tenantId: string, data: { dealId: string; userId: string; amount: number; entryType: string; currency?: string }) =>
    prisma.commissionLedger.create({ data: { tenantId, dealId: data.dealId, userId: data.userId, amount: data.amount, entryType: data.entryType, currency: data.currency || "USD" } }),

  approveLedgerEntry: (tenantId: string, ledgerId: string, approvedBy: string) =>
    prisma.commissionApproval.create({ data: { tenantId, ledgerId, approvedBy, status: "approved", decidedAt: new Date() } })
}
