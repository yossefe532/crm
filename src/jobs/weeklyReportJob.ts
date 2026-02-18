import { prisma } from "../prisma/client"
import { notificationService } from "../modules/notifications/service"
import { logActivity } from "../utils/activity"

export const runWeeklyReportJob = async (tenantId: string) => {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 7)
  const completedLeads = await prisma.lead.findMany({
    where: { tenantId, status: "closing", updatedAt: { gte: weekStart, lte: now }, deletedAt: null },
    select: { id: true, leadCode: true, name: true, assignedUserId: true, teamId: true, status: true, updatedAt: true }
  })
  const overdueDeadlines = await prisma.leadDeadline.findMany({
    where: { tenantId, dueAt: { lt: now }, status: { in: ["active", "overdue"] } },
    include: { lead: true, state: true }
  })
  const overdueLeads = overdueDeadlines.map((deadline) => ({
    leadId: deadline.leadId,
    leadCode: deadline.lead.leadCode,
    leadName: deadline.lead.name,
    stage: deadline.state.code,
    dueAt: deadline.dueAt.toISOString()
  }))

  const event = await notificationService.publishEvent(tenantId, "weekly.report.generated", {
    weekStart: weekStart.toISOString(),
    weekEnd: now.toISOString(),
    completedLeads,
    overdueLeads,
    completedCount: completedLeads.length,
    overdueCount: overdueLeads.length,
    messageAr: `تقرير أسبوعي: عملاء مكتملون ${completedLeads.length}، عملاء متأخرون ${overdueLeads.length}`,
    targets: ["owner", "team_leader"]
  })
  await notificationService.queueDelivery(tenantId, event.id, "in_app")
  await logActivity({
    tenantId,
    action: "weekly.report.generated",
    entityType: "notification_event",
    entityId: event.id,
    metadata: { completedCount: completedLeads.length, overdueCount: overdueLeads.length }
  })
}
