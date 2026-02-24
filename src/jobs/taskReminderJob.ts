import { prisma } from "../prisma/client"
import { notificationService } from "../modules/notifications/service"

const processTenantTasks = async (tenantId: string) => {
  try {
    const now = new Date()
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    // 1. Upcoming Tasks (Standard Reminder)
    const upcomingTasks = await prisma.leadTask.findMany({
      where: {
        tenantId,
        status: { not: "completed" },
        dueAt: {
          gte: fiveMinutesAgo,
          lte: fifteenMinutesFromNow
        }
      },
      include: {
        lead: {
          select: { name: true }
        }
      }
    })

    for (const task of upcomingTasks) {
      if (!task.assignedUserId || !task.dueAt) continue

      const existingNotification = await prisma.notificationDelivery.findFirst({
        where: {
          tenantId,
          userId: task.assignedUserId,
          entityType: "task",
          entityId: task.id,
          type: "reminder",
          createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
      })

      if (!existingNotification) {
        await notificationService.send({
          tenantId,
          userId: task.assignedUserId,
          type: "reminder",
          title: "تذكير بمهمة ⏰",
          message: `تذكير: لديك مهمة "${task.taskType}" للعميل ${task.lead.name} تستحق بحلول ${task.dueAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
          entityType: "task",
          entityId: task.id,
          actionUrl: `/leads/${task.leadId}`,
          metadata: { dueAt: task.dueAt }
        }).catch(err => {
            console.error(`Failed to send reminder for task ${task.id}`, err)
        })
      }
    }

    // 2. Overdue Tasks (Manager Notification)
    // Check tasks overdue by more than 24 hours
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    const overdueTasks = await prisma.leadTask.findMany({
      where: {
        tenantId,
        status: { not: "completed" },
        dueAt: {
          lt: oneDayAgo,
          gt: twoDaysAgo // Check tasks overdue between 24 and 48 hours to avoid processing very old ones repeatedly
        }
      },
      include: {
        lead: {
          include: { team: true }
        },
        assignedUser: {
          include: { profile: true }
        }
      }
    })

    for (const task of overdueTasks) {
      if (!task.assignedUserId) continue

      // Check if we already sent an overdue alert
      const existingAlert = await prisma.notificationDelivery.findFirst({
        where: {
          tenantId,
          entityType: "task",
          entityId: task.id,
          type: "warning", // Use 'warning' for overdue
          createdAt: { gt: twoDaysAgo }
        }
      })

      if (existingAlert) continue

      // Determine Manager (Team Leader or Owner)
      let managerIds: string[] = []
      if (task.lead.team?.leaderUserId && task.lead.team.leaderUserId !== task.assignedUserId) {
        managerIds.push(task.lead.team.leaderUserId)
      } else {
        // Fallback to owner
        const ownerRole = await prisma.role.findFirst({ where: { name: "owner", tenantId } })
        if (ownerRole) {
          const owners = await prisma.userRole.findMany({ where: { roleId: ownerRole.id, tenantId, revokedAt: null }, select: { userId: true } })
          managerIds.push(...owners.map(o => o.userId))
        }
      }

      // Notify Manager
      if (managerIds.length > 0) {
        await notificationService.sendMany(managerIds, {
          tenantId,
          type: "warning",
          title: "تنبيه: مهمة متأخرة ⚠️",
          message: `الموظف لديه مهمة متأخرة لأكثر من 24 ساعة: "${task.taskType}" للعميل ${task.lead.name}`,
          entityType: "task",
          entityId: task.id,
          actionUrl: `/leads/${task.leadId}`,
          senderId: undefined
        }).catch(console.error)
      }
    }

    // ==========================================
    // 3. Upcoming General Tasks (Standard Reminder)
    // ==========================================
    const upcomingGeneralTasks = await prisma.task.findMany({
      where: {
        tenantId,
        status: { not: "completed" },
        dueDate: {
          gte: fiveMinutesAgo,
          lte: fifteenMinutesFromNow
        }
      }
    })

    for (const task of upcomingGeneralTasks) {
      if (!task.assignedUserId || !task.dueDate) continue

      const existingNotification = await prisma.notificationDelivery.findFirst({
        where: {
          tenantId,
          userId: task.assignedUserId,
          entityType: "task",
          entityId: task.id,
          type: "reminder",
          createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
        }
      })

      if (!existingNotification) {
        await notificationService.send({
          tenantId,
          userId: task.assignedUserId,
          type: "reminder",
          title: "تذكير بمهمة ⏰",
          message: `تذكير: لديك مهمة "${task.title}" تستحق بحلول ${task.dueDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
          entityType: "task",
          entityId: task.id,
          actionUrl: `/tasks/${task.id}`,
          metadata: { dueDate: task.dueDate }
        }).catch(err => {
            console.error(`Failed to send reminder for general task ${task.id}`, err)
        })
      }
    }

    // ==========================================
    // 4. Overdue General Tasks (Manager Notification)
    // ==========================================
    const overdueGeneralTasks = await prisma.task.findMany({
      where: {
        tenantId,
        status: { not: "completed" },
        dueDate: {
          lt: oneDayAgo,
          gt: twoDaysAgo
        }
      },
      include: {
        assignedUser: {
          include: { profile: true }
        },
        creator: true
      }
    })

    for (const task of overdueGeneralTasks) {
      if (!task.assignedUserId) continue

      const existingAlert = await prisma.notificationDelivery.findFirst({
        where: {
          tenantId,
          entityType: "task",
          entityId: task.id,
          type: "warning",
          createdAt: { gt: twoDaysAgo }
        }
      })

      if (existingAlert) continue

      // Determine Manager
      // For general tasks, we notify the CREATOR if they are different from assignee
      // Or we can notify admins. Let's notify Creator first.
      let managerIds: string[] = []
      
      if (task.createdByUserId && task.createdByUserId !== task.assignedUserId) {
        managerIds.push(task.createdByUserId)
      } else {
        // If created by self or system, notify admins/owner
        const ownerRole = await prisma.role.findFirst({ where: { name: "owner", tenantId } })
        if (ownerRole) {
           const owners = await prisma.userRole.findMany({ where: { roleId: ownerRole.id, tenantId, revokedAt: null }, select: { userId: true } })
           managerIds.push(...owners.map(o => o.userId))
        }
      }
      
      // Filter out assignee from managers list just in case
      managerIds = managerIds.filter(id => id !== task.assignedUserId)

      if (managerIds.length > 0) {
        const assigneeName = task.assignedUser?.profile?.firstName || task.assignedUser?.email || "الموظف"
        
        await notificationService.sendMany(managerIds, {
          tenantId,
          type: "warning",
          title: "تنبيه: مهمة عامة متأخرة ⚠️",
          message: `الموظف ${assigneeName} لديه مهمة متأخرة لأكثر من 24 ساعة: "${task.title}"`,
          entityType: "task",
          entityId: task.id,
          actionUrl: `/tasks/${task.id}`,
          senderId: undefined
        }).catch(console.error)
      }
    }

  } catch (error) {
    console.error(`Task reminder job failed for tenant ${tenantId}`, error)
  }
}

export const taskReminderJob = async () => {
  const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true } })
  await Promise.all(tenants.map(t => processTenantTasks(t.id)))
}
