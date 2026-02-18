import { prisma } from "../prisma/client"
import { notificationService } from "../modules/notifications/service"
import { logActivity } from "../utils/activity"

export const runLeadCountdownJob = async (tenantId: string) => {
  const states = ["call", "meeting", "site_visit", "closing"]
  const leads = await prisma.lead.findMany({ where: { tenantId, status: { in: states } } })
  for (const lead of leads) {
    const existing = await prisma.leadDeadline.findFirst({ where: { tenantId, leadId: lead.id, status: "active" } })
    if (!existing) {
      const state = await prisma.leadStateDefinition.findFirst({ where: { tenantId, code: lead.status } })
      if (!state) continue
      const dueAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)
      await prisma.leadDeadline.create({ data: { tenantId, leadId: lead.id, stateId: state.id, dueAt } })
    }
  }

  const now = new Date()
  const overdue = await prisma.leadDeadline.findMany({
    where: { tenantId, status: "active", dueAt: { lt: now } },
    include: { lead: true, state: true }
  })
  for (const deadline of overdue) {
    await prisma.leadDeadline.update({ where: { id: deadline.id, tenantId }, data: { status: "overdue" } })
    const existingFailure = await prisma.leadFailure.findFirst({ where: { tenantId, leadId: deadline.leadId, failureType: "overdue", status: "pending" } })
    if (!existingFailure) {
      await prisma.leadFailure.create({
        data: {
          tenantId,
          leadId: deadline.leadId,
          failedBy: deadline.lead.assignedUserId || undefined,
          failureType: "overdue",
          status: "pending"
        }
      })
    }
    await prisma.lead.update({ where: { id: deadline.leadId, tenantId }, data: { status: "failed", assignedUserId: null } })
    if (deadline.lead.assignedUserId) {
      const roles = await prisma.userRole.findMany({ where: { tenantId, userId: deadline.lead.assignedUserId, revokedAt: null }, include: { role: true } })
      const roleNames = roles.map((row) => row.role.name)
      if (roleNames.includes("sales")) {
        await prisma.user.update({ where: { id: deadline.lead.assignedUserId }, data: { status: "inactive" } })
      }
    }
    const event = await notificationService.publishEvent(tenantId, "lead.deadline.overdue", {
      leadId: deadline.leadId,
      leadCode: deadline.lead.leadCode,
      leadName: deadline.lead.name,
      stage: deadline.state.code,
      dueAt: deadline.dueAt.toISOString(),
      targets: ["owner"],
      messageAr: `تجاوز العميل ${deadline.lead.name} المهلة في مرحلة ${deadline.state.name}`
    })
    await notificationService.queueDelivery(tenantId, event.id, "in_app")
    await logActivity({
      tenantId,
      action: "lead.deadline.overdue",
      entityType: "lead_deadline",
      entityId: deadline.id,
      metadata: { leadId: deadline.leadId, stage: deadline.state.code }
    })
  }
}
