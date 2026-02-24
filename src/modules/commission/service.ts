import { prisma } from "../../prisma/client"
import { Prisma } from "@prisma/client"
import { notificationService } from "../notifications/service"

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
  createPlan: (tenantId: string, data: { name: string; targetAmount?: number; baseRate?: number }) =>
    prisma.commissionPlan.create({ 
      data: { 
        tenantId, 
        name: data.name,
        targetAmount: data.targetAmount || 0,
        baseRate: data.baseRate || 0
      } 
    }),

  createRule: (tenantId: string, data: { planId: string; rule: Record<string, unknown> }) =>
    prisma.commissionRule.create({ 
      data: { 
        tenantId, 
        planId: data.planId, 
        rule: data.rule as Prisma.InputJsonValue 
      } 
    }),

  createLedgerEntry: async (tenantId: string, data: { dealId?: string; userId: string; amount: number; entryType: string; currency?: string }) => {
    // 1. Create Ledger Entry
    const entry = await prisma.commissionLedger.create({ 
      data: { 
        tenantId, 
        dealId: data.dealId, 
        userId: data.userId, 
        amount: data.amount, 
        entryType: data.entryType, 
        currency: data.currency || "USD",
        status: "pending"
      } 
    })
    
    // 2. Notify User
    await notificationService.send({
        tenantId,
        userId: data.userId,
        type: data.entryType === 'penalty' ? "warning" : "success",
        title: data.entryType === 'penalty' ? "خصم جديد 📉" : "عمولة جديدة 💰",
        message: `تم تسجيل ${data.entryType === 'penalty' ? 'خصم' : 'عمولة'} بقيمة ${data.amount} ${data.currency || "USD"}`,
        entityType: "commission_ledger",
        entityId: entry.id,
        actionUrl: "/commission"
    }).catch(console.error)
    
    return entry
  },

  approveLedgerEntry: async (tenantId: string, ledgerId: string, approvedBy: string) => {
    // 1. Create Approval Record
    const approval = await prisma.commissionApproval.create({ 
      data: { tenantId, ledgerId, approvedBy, status: "approved", decidedAt: new Date() } 
    })
    
    // 2. Update Ledger Status
    await prisma.commissionLedger.update({
        where: { id: ledgerId },
        data: { status: "approved" }
    })
    
    // 3. Notify User
    const ledger = await prisma.commissionLedger.findUnique({ where: { id: ledgerId } })
    if (ledger) {
        await notificationService.send({
            tenantId,
            userId: ledger.userId,
            type: "success",
            title: "تمت الموافقة على العمولة ✅",
            message: `تمت الموافقة على ${ledger.entryType === 'penalty' ? 'الخصم' : 'العمولة'} بقيمة ${ledger.amount} ${ledger.currency}`,
            entityType: "commission_approval",
            entityId: approval.id,
            actionUrl: "/sales"
        }).catch(console.error)
    }
    return approval
  }
}
