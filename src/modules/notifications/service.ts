import { prisma } from "../../prisma/client"
import { Prisma } from "@prisma/client"
import { pushService } from "./pushService"
import { smsService } from "./smsService"
import { getIO } from "../../socket"

export type NotificationType = 
  | "info" 
  | "success" 
  | "warning" 
  | "error" 
  | "mention" 
  | "assignment" 
  | "reminder"
  | "system"
  | "poke";

export interface CreateNotificationDto {
  tenantId: string;
  userId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  actionUrl?: string;
  metadata?: any;
}

export const notificationService = {
  // --- New Robust Methods ---

  /**
   * Send a notification to a user (DB + Socket)
   */
  send: async (data: CreateNotificationDto) => {
    try {
      // 1. Save to database
      const notification = await prisma.notificationDelivery.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId,
          senderId: data.senderId,
          type: data.type,
          title: data.title,
          message: data.message,
          entityId: data.entityId,
          entityType: data.entityType,
          actionUrl: data.actionUrl,
          metadata: data.metadata || {},
          isRead: false,
        },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              profile: {
                select: { firstName: true, lastName: true, avatarFileId: true }
              }
            }
          }
        }
      });

      // 2. Emit via Socket.io
      try {
        const io = getIO();
        io.to(`user:${data.userId}`).emit("notification:new", notification);
      } catch (socketError) {
        console.warn("Socket.io not initialized or error emitting:", socketError);
      }

      // 3. Send Push Notification
      try {
        await pushService.send(data.tenantId, data.userId, {
          title: data.title,
          body: data.message,
          url: data.actionUrl
        })
      } catch (pushError) {
        console.warn("Failed to send push notification:", pushError)
      }

      return notification;
    } catch (error) {
      console.error("Failed to send notification:", error);
      throw error;
    }
  },

  /**
   * Send a notification to multiple users
   */
  sendMany: async (userIds: string[], data: Omit<CreateNotificationDto, "userId">) => {
    const promises = userIds.map(userId => 
      notificationService.send({ ...data, userId })
    );
    return Promise.all(promises);
  },

  /**
   * List notifications for a user
   */
  list: async (userId: string, params: { page?: number; limit?: number; unreadOnly?: boolean }) => {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      isArchived: false,
      ...(params.unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total] = await Promise.all([
      prisma.notificationDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              email: true,
              profile: {
                select: { firstName: true, lastName: true, avatarFileId: true }
              }
            }
          }
        }
      }),
      prisma.notificationDelivery.count({ where })
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (id: string, userId: string) => {
    return prisma.notificationDelivery.updateMany({
      where: { id, userId }, // Ensure ownership
      data: { isRead: true }
    });
  },

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead: async (userId: string) => {
    return prisma.notificationDelivery.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  },

  /**
   * Archive a notification
   */
  archive: async (id: string, userId: string) => {
    return prisma.notificationDelivery.updateMany({
      where: { id, userId },
      data: { isArchived: true }
    });
  },

  /**
   * Archive all notifications for a user
   */
  archiveAll: async (userId: string) => {
    return prisma.notificationDelivery.updateMany({
      where: { userId, isArchived: false },
      data: { isArchived: true }
    });
  },
  
  /**
   * Get unread count
   */
  getUnreadCount: async (userId: string) => {
    return prisma.notificationDelivery.count({
      where: { userId, isRead: false, isArchived: false }
    });
  },

  /**
   * Helper to parse text for mentions (@Name) and notify users
   */
  notifyMentions: async (
    tenantId: string,
    text: string,
    sourceUser: { id: string; name: string },
    entityType: string,
    entityId: string,
    actionUrl: string
  ): Promise<string[]> => {
    if (!text) return [];
    
    // Regex to find @Name
    // We assume names are simple words for now, or match existing users
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    
    if (!matches || matches.length === 0) return [];
    
    // Clean matches
    const names = matches.map(m => m.substring(1));
    
    // Find users by first name or last name (simple search)
    // In a real app, you'd want exact username or ID matching
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        profile: {
          OR: [
            { firstName: { in: names, mode: 'insensitive' } },
            { lastName: { in: names, mode: 'insensitive' } }
          ]
        }
      },
      select: { id: true }
    });
    
    if (users.length === 0) return [];
    
    const notifiedUserIds = users.map(u => u.id).filter(id => id !== sourceUser.id);

    // Send notifications
    await notificationService.sendMany(
      notifiedUserIds,
      {
        tenantId,
        type: "mention",
        title: `تم ذكرك بواسطة ${sourceUser.name}`,
        message: text.length > 50 ? text.substring(0, 50) + "..." : text,
        senderId: sourceUser.id,
        entityType,
        entityId,
        actionUrl,
        metadata: { isMention: true }
      }
    );

    return notifiedUserIds;
  },

  /**
   * Send a system announcement to all active users
   */
  sendSystemAnnouncement: async (tenantId: string, message: string, senderId?: string) => {
    const users = await prisma.user.findMany({
        where: { tenantId, status: "active", deletedAt: null },
        select: { id: true }
    })
    
    if (users.length === 0) return

    return notificationService.sendMany(
        users.map(u => u.id),
        {
            tenantId,
            type: "system",
            title: "إعلان إداري",
            message: message,
            senderId,
            metadata: { isAnnouncement: true }
        }
    )
  },

  // --- Legacy Methods (Stubbed/Fixed for Schema Compatibility) ---

  listEvents: (tenantId: string, limit = 20, afterDate?: Date) =>
    prisma.notificationEvent.findMany({ 
      where: { 
        tenantId,
        ...(afterDate ? { createdAt: { gt: afterDate } } : {})
      }, 
      orderBy: { createdAt: "desc" }, 
      take: limit 
    }),
  
  clearEvents: (userId: string) =>
    prisma.user.update({
      where: { id: userId },
      data: { lastNotificationClearTime: new Date() }
    }),

  publishEvent: async (tenantId: string, eventKey: string, payload: Record<string, unknown>) => {
    // Schema changed: NotificationEvent no longer stores payload.
    // This is a stub to prevent compilation errors.
    // If logic requires persistence, use a different table or the new notification flow.
    return { id: "legacy-stub-id", tenantId, code: eventKey };
  },

  createRule: (tenantId: string, data: { eventKey: string; channel: string; recipients?: Record<string, unknown>; templateRef?: string }) =>
    prisma.notificationRule.create({
      data: {
        tenantId,
        eventCode: data.eventKey,
        channels: [data.channel], // Map single channel to array
        recipients: (data.recipients as Prisma.InputJsonValue) || {},
        template: data.templateRef || "Default Template"
      }
    }),

  queueDelivery: async (tenantId: string, eventId: string, channel: string, scheduledAt?: string) => {
    // Schema changed: NotificationDelivery requires userId and does not support eventId.
    // This method is deprecated.
    console.warn(`[Deprecated] queueDelivery called for event ${eventId}. Skipped.`);
    return {};
  },

  broadcast: async (
    tenantId: string,
    target: { type: "all" | "role" | "user" | "users" | "team"; value?: string | string[] },
    message: string,
    channels: string[] = ["in_app", "push"],
    sender?: { id?: string; name?: string }
  ) => {
    // Re-implemented using new 'sendMany' for better consistency
    const normalizedMessage = sender?.name ? `رسالة من ${sender.name}: ${message}` : `رسالة الإدارة: ${message}`
    let users: { id: string }[] = []

    if (target.type === "user" && typeof target.value === "string") {
      users = [{ id: target.value }]
    } else if (target.type === "users" && Array.isArray(target.value)) {
      users = target.value.map(id => ({ id }))
    } else if (target.type === "all") {
      users = await prisma.user.findMany({ where: { tenantId, deletedAt: null, status: "active" }, select: { id: true } })
    } else if (target.type === "role" && typeof target.value === "string") {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.value)
      users = await prisma.user.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: "active",
          roleLinks: { some: isUuid ? { roleId: target.value } : { role: { name: target.value } } }
        },
        select: { id: true }
      })
    } else if (target.type === "team" && typeof target.value === "string") {
      const members = await prisma.teamMember.findMany({
        where: { tenantId, teamId: target.value, leftAt: null, deletedAt: null },
        select: { userId: true }
      })
      const team = await prisma.team.findFirst({ where: { tenantId, id: target.value } })
      const userIds = Array.from(new Set([...(team?.leaderUserId ? [team.leaderUserId] : []), ...members.map((row) => row.userId)]))
      users = userIds.map(id => ({ id }));
    }

    if (channels.includes("in_app")) {
        await notificationService.sendMany(users.map(u => u.id), {
            tenantId,
            type: "info",
            title: "إشعار إداري",
            message: normalizedMessage,
            senderId: sender?.id,
            metadata: { isBroadcast: true }
        });
    }
    
    // Push notification logic could be added here
  }
}
