import { prisma } from "../../prisma/client"
import { notificationService } from "../notifications/service"

export const taskService = {
  create: async (tenantId: string, userId: string, data: {
    title: string
    description?: string
    assignedUserId?: string
    dueDate?: Date
    priority?: string
    status?: string
    relatedType?: string
    relatedId?: string
  }) => {
    const task = await prisma.task.create({
      data: {
        tenantId,
        title: data.title,
        description: data.description,
        assignedUserId: data.assignedUserId,
        createdByUserId: userId,
        dueDate: data.dueDate,
        priority: data.priority || "medium",
        status: data.status || "open",
        relatedType: data.relatedType,
        relatedId: data.relatedId
      },
      include: {
        assignedUser: {
          include: { profile: true }
        },
        creator: {
          include: { profile: true }
        }
      }
    })

    // Notify Assignee if different from Creator
    if (data.assignedUserId && data.assignedUserId !== userId) {
      const creatorName = task.creator?.profile?.firstName || task.creator?.email || "Unknown"
      await notificationService.send({
        tenantId,
        userId: data.assignedUserId,
        type: "info",
        title: "مهمة جديدة",
        message: `تم إسناد مهمة جديدة لك: ${data.title} بواسطة ${creatorName}`,
        entityType: "task",
        entityId: task.id,
        actionUrl: `/tasks/${task.id}`,
        senderId: userId
      }).catch(console.error)
    }

    return task
  },

  update: async (tenantId: string, taskId: string, userId: string, data: {
    title?: string
    description?: string
    assignedUserId?: string
    dueDate?: Date
    priority?: string
    status?: string
  }) => {
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignedUser: true }
    })

    if (!existingTask || existingTask.tenantId !== tenantId) {
      throw { status: 404, message: "Task not found" }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: data.title,
        description: data.description,
        assignedUserId: data.assignedUserId,
        dueDate: data.dueDate,
        priority: data.priority,
        status: data.status,
        updatedAt: new Date()
      },
      include: {
        assignedUser: { include: { profile: true } },
        creator: { include: { profile: true } }
      }
    })

    // Notify New Assignee
    if (data.assignedUserId && data.assignedUserId !== existingTask.assignedUserId && data.assignedUserId !== userId) {
        const creatorName = updatedTask.creator?.profile?.firstName || updatedTask.creator?.email || "Unknown"
        await notificationService.send({
            tenantId,
            userId: data.assignedUserId,
            type: "info",
            title: "إسناد مهمة",
            message: `تم إسناد المهمة "${updatedTask.title}" إليك بواسطة ${creatorName}`,
            entityType: "task",
            entityId: updatedTask.id,
            actionUrl: `/tasks/${updatedTask.id}`,
            senderId: userId
        }).catch(console.error)
    }

    // Notify Old Assignee if removed
    if (existingTask.assignedUserId && data.assignedUserId && data.assignedUserId !== existingTask.assignedUserId && existingTask.assignedUserId !== userId) {
        await notificationService.send({
            tenantId,
            userId: existingTask.assignedUserId,
            type: "info",
            title: "تغيير في المهمة",
            message: `تم إلغاء إسناد المهمة "${existingTask.title}" عنك`,
            entityType: "task",
            entityId: taskId,
            senderId: userId
        }).catch(console.error)
    }

    // Notify Existing Assignee on Update (if not changed)
    if (existingTask.assignedUserId && existingTask.assignedUserId !== userId && (!data.assignedUserId || data.assignedUserId === existingTask.assignedUserId)) {
         const changes: string[] = []
         if (data.title && data.title !== existingTask.title) changes.push("العنوان")
         if (data.description && data.description !== existingTask.description) changes.push("الوصف")
         if (data.priority && data.priority !== existingTask.priority) changes.push("الأولوية")
          if (data.status && data.status !== existingTask.status) changes.push("الحالة")
          
          if (data.dueDate !== undefined) {
              const newTime = data.dueDate ? new Date(data.dueDate).getTime() : 0
              const oldTime = existingTask.dueDate ? new Date(existingTask.dueDate).getTime() : 0
              if (newTime !== oldTime) changes.push("تاريخ الاستحقاق")
          }

          if (changes.length > 0) {
             await notificationService.send({
                 tenantId,
                 userId: existingTask.assignedUserId,
                 type: "info",
                 title: "تحديث في المهمة",
                 message: `تم تحديث ${changes.join('، ')} في المهمة "${existingTask.title}"`,
                 entityType: "task",
                 entityId: taskId,
                 actionUrl: `/tasks/${taskId}`,
                 senderId: userId
             }).catch(console.error)
         }
    }

    // Notify Creator on Completion
    if (data.status === "completed" && existingTask.status !== "completed" && updatedTask.createdByUserId && updatedTask.createdByUserId !== userId) {
        const completer = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } })
        const completerName = completer?.profile?.firstName || completer?.email || "Unknown"
        
        await notificationService.send({
            tenantId,
            userId: updatedTask.createdByUserId,
            type: "success",
            title: "اكتملت المهمة",
            message: `تم إكمال المهمة "${updatedTask.title}" بواسطة ${completerName}`,
            entityType: "task",
            entityId: taskId,
            actionUrl: `/tasks/${taskId}`,
            senderId: userId
        }).catch(console.error)
    }

    return updatedTask
  },

  delete: async (tenantId: string, taskId: string) => {
    const task = await prisma.task.findFirst({ where: { id: taskId, tenantId } })
    if (!task) throw { status: 404, message: "Task not found" }
    return prisma.task.delete({ where: { id: taskId } })
  },

  list: async (tenantId: string, filters: {
    assignedUserId?: string
    status?: string
    relatedType?: string
    relatedId?: string
    createdByUserId?: string
  }) => {
    return prisma.task.findMany({
      where: {
        tenantId,
        assignedUserId: filters.assignedUserId,
        status: filters.status,
        relatedType: filters.relatedType,
        relatedId: filters.relatedId,
        createdByUserId: filters.createdByUserId
      },
      include: {
        assignedUser: {
            select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true, avatarFileId: true } }
            }
        },
        creator: {
            select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true, avatarFileId: true } }
            }
        }
      },
      orderBy: { createdAt: "desc" }
    })
  },

  get: async (tenantId: string, taskId: string) => {
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId },
      include: {
        assignedUser: {
            select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true, avatarFileId: true } }
            }
        },
        creator: {
            select: {
                id: true,
                email: true,
                profile: { select: { firstName: true, lastName: true, avatarFileId: true } }
            }
        }
      }
    })
    if (!task) throw { status: 404, message: "Task not found" }
    return task
  }
}
