import { prisma } from "../prisma/client"
import { reassignmentService } from "../modules/reassignment/service"

export const runCallCheckJob = async (tenantId: string) => {
  const leads = await prisma.lead.findMany({ where: { tenantId, status: "call" } })
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000)
  for (const lead of leads) {
    const recentCall = await prisma.callLog.findFirst({ where: { tenantId, leadId: lead.id, callTime: { gte: cutoff } } })
    if (!recentCall && lead.assignedUserId) {
      await reassignmentService.addNegligencePoints(tenantId, lead.id, lead.assignedUserId, 1, "No call in 48 hours")
      await reassignmentService.evaluateAndReassign(tenantId, lead.id, "call_missed")
    }
  }
}
