import { prisma } from "../../prisma/client"
import { notificationService } from "../notifications/service"

export const blacklistService = {
  createEntry: (tenantId: string, data: { phone: string; reason?: string }) =>
    prisma.blacklistEntry.create({ data: { tenantId, phone: data.phone, reason: data.reason } }),

  checkLead: async (tenantId: string, leadId: string, phone: string) => {
    const matches = await prisma.blacklistEntry.findMany({
      where: {
        tenantId,
        phone
      }
    })
    const created = await Promise.all(
      (matches as Array<{ id: string }>).map((entry) =>
        prisma.blacklistMatch.create({ data: { tenantId, leadId, entryId: entry.id } })
      )
    )

    if (created.length > 0) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId, tenantId } })
      
      // Notify assigned user if exists
      if (lead && lead.assignedUserId) {
        await notificationService.send({
          tenantId,
          userId: lead.assignedUserId,
          type: "warning",
          title: "تحذير قائمة سوداء ⛔",
          message: `تنبيه! العميل ${lead.name || lead.leadCode || "غير معروف"} تطابق مع القائمة السوداء. يرجى المراجعة فوراً.`,
          entityType: "blacklist_match",
          entityId: created[0].id,
          actionUrl: `/leads/${leadId}`,
          metadata: { priority: "high" }
        }).catch(console.error)
      }

      // Also notify admins/managers
      const adminUsers = await prisma.user.findMany({
        where: {
          tenantId,
          status: "active",
          roleLinks: {
            some: {
              role: {
                name: { in: ["admin", "manager", "owner"] }
              }
            }
          }
        },
        select: { id: true }
      })
      
      const adminIds = adminUsers.map(u => u.id).filter(id => id !== lead?.assignedUserId) // Avoid double notification

      if (adminIds.length > 0) {
        await notificationService.sendMany(
          adminIds,
          {
            tenantId,
            type: "warning", // Changed from 'alert' to 'warning'
            title: "كشف عميل محظور",
            message: `تم اكتشاف عميل محظور: ${lead?.name || lead?.leadCode}`,
            entityType: "blacklist_match",
            entityId: created[0].id,
            actionUrl: `/leads/${leadId}`,
            metadata: { priority: "high" }
          }
        ).catch(console.error)
      }
    }

    return created
  }
}
