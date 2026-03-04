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
  eventKey?: string;
  channels?: NotificationChannel[];
  fallbackChannel?: NotificationChannel;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  actionUrl?: string;
  metadata?: any;
}

type NotificationChannel = "in_app" | "push" | "sms";

type QueuePayload = {
  title: string;
  message: string;
  actionUrl?: string;
  notificationId?: string;
  metadata?: Record<string, unknown>;
};

const MAX_RETRY_ATTEMPTS = 3;
const FALLBACK_RETRY_ATTEMPTS = 2;

const DEFAULT_ROUTING: Record<string, { channels: NotificationChannel[]; fallbackChannel?: NotificationChannel }> = {
  default: { channels: ["in_app", "push"], fallbackChannel: "sms" },
  "notification.mention": { channels: ["in_app", "push"], fallbackChannel: "sms" },
  "notification.assignment": { channels: ["in_app", "push"], fallbackChannel: "sms" },
  "notification.reminder": { channels: ["in_app", "push"], fallbackChannel: "sms" },
  "notification.system": { channels: ["in_app"] },
  "chat.message": { channels: ["in_app", "push"], fallbackChannel: "sms" }
};

const normalizeChannels = (channels: unknown): NotificationChannel[] => {
  if (!Array.isArray(channels)) return [];
  const allowed: NotificationChannel[] = ["in_app", "push", "sms"];
  const normalized = channels.filter((c): c is NotificationChannel => typeof c === "string" && allowed.includes(c as NotificationChannel));
  return Array.from(new Set(normalized));
};

const isMutedNow = (mutedUntil?: Date | null) => !!mutedUntil && mutedUntil.getTime() > Date.now();
const sanitizeError = (error: unknown) => (error instanceof Error ? error.message : "Unknown delivery error").slice(0, 500);
const nextRetryDate = (attempt: number) => new Date(Date.now() + Math.min(30 * 60_000, Math.pow(2, attempt) * 30_000));
const getEventKey = (data: CreateNotificationDto) => data.eventKey || `notification.${data.type}`;

const resolveRouting = async (tenantId: string, userId: string, data: CreateNotificationDto) => {
  const eventKey = getEventKey(data);
  const defaultByEvent = DEFAULT_ROUTING[eventKey] || DEFAULT_ROUTING.default;

  if (data.channels && data.channels.length > 0) {
    return {
      eventKey,
      channels: data.channels,
      fallbackChannel: data.fallbackChannel || defaultByEvent.fallbackChannel
    };
  }

  const exactSetting = await prisma.notificationUserSetting.findUnique({
    where: { tenantId_userId_eventKey: { tenantId, userId, eventKey } }
  });
  const defaultSetting = exactSetting
    ? null
    : await prisma.notificationUserSetting.findUnique({
        where: { tenantId_userId_eventKey: { tenantId, userId, eventKey: "default" } }
      });
  const setting = exactSetting || defaultSetting;

  if (!setting) {
    return {
      eventKey,
      channels: defaultByEvent.channels,
      fallbackChannel: defaultByEvent.fallbackChannel
    };
  }

  if (!setting.isEnabled || isMutedNow(setting.mutedUntil)) {
    return { eventKey, channels: [], fallbackChannel: undefined };
  }

  const channels = normalizeChannels(setting.channels);
  return {
    eventKey,
    channels: channels.length > 0 ? channels : defaultByEvent.channels,
    fallbackChannel: setting.fallbackChannel as NotificationChannel | null | undefined || defaultByEvent.fallbackChannel
  };
};

export const notificationService = {
  enqueueDelivery: async (params: {
    tenantId: string;
    userId: string;
    eventKey: string;
    channel: NotificationChannel;
    fallbackChannel?: NotificationChannel;
    payload: QueuePayload;
    notificationId?: string;
    maxAttempts?: number;
  }) => {
    return prisma.notificationQueueItem.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        notificationId: params.notificationId,
        eventKey: params.eventKey,
        channel: params.channel,
        fallbackChannel: params.fallbackChannel,
        payload: params.payload as Prisma.InputJsonValue,
        status: "pending",
        attempts: 0,
        maxAttempts: params.maxAttempts || MAX_RETRY_ATTEMPTS,
        nextRetryAt: new Date()
      }
    });
  },

  /**
   * Send a notification to a user (DB + Socket + queued external channels)
   */
  send: async (data: CreateNotificationDto) => {
    try {
      const route = await resolveRouting(data.tenantId, data.userId, data);
      const shouldCreateInApp = route.channels.includes("in_app");

      // 1. Save to database
      const notification = shouldCreateInApp
        ? await prisma.notificationDelivery.create({
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
              isRead: false
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
          })
        : null;

      // 2. Emit via Socket.io
      if (notification) {
        try {
          const io = getIO();
          io.to(`user:${data.userId}`).emit("notification:new", notification);
        } catch (socketError) {
          console.warn("Socket.io not initialized or error emitting:", socketError);
        }
      }

      // 3. Queue external notifications (push/sms) for worker delivery
      const queueTargets = route.channels.filter((c) => c !== "in_app");
      await Promise.all(
        queueTargets.map((channel) =>
          notificationService.enqueueDelivery({
            tenantId: data.tenantId,
            userId: data.userId,
            eventKey: route.eventKey,
            channel,
            fallbackChannel: route.fallbackChannel,
            payload: {
              title: data.title,
              message: data.message,
              actionUrl: data.actionUrl,
              notificationId: notification?.id,
              metadata: (data.metadata || {}) as Record<string, unknown>
            },
            notificationId: notification?.id
          })
        )
      );

      return notification;
    } catch (error) {
      console.error("Failed to send notification:", error);
      throw error;
    }
  },

  dispatchQueueItem: async (queueItemId: string) => {
    const queueItem = await prisma.notificationQueueItem.findUnique({
      where: { id: queueItemId },
      include: { user: { select: { phone: true } } }
    });
    if (!queueItem) return { status: "missing" as const };
    if (queueItem.status !== "processing") return { status: "skipped" as const };

    const payload = queueItem.payload as QueuePayload;

    try {
      if (queueItem.channel === "push") {
        const result = await pushService.send(queueItem.tenantId, queueItem.userId, {
          title: payload.title,
          body: payload.message,
          url: payload.actionUrl
        });

        if (!result || result.sentCount < 1) {
          throw new Error(result?.errors?.[0] || "No active push subscriptions");
        }
      } else if (queueItem.channel === "sms") {
        const to = queueItem.user?.phone;
        if (!to) throw new Error("User phone is missing for SMS fallback");
        await smsService.send(to, `${payload.title}\n${payload.message}`);
      } else {
        throw new Error(`Unsupported channel: ${queueItem.channel}`);
      }

      await prisma.notificationQueueItem.update({
        where: { id: queueItem.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          lastError: null
        }
      });

      return { status: "sent" as const };
    } catch (error) {
      const attempts = queueItem.attempts + 1;
      const lastError = sanitizeError(error);
      const shouldRetry = attempts < queueItem.maxAttempts;

      await prisma.notificationQueueItem.update({
        where: { id: queueItem.id },
        data: {
          status: shouldRetry ? "retry" : "dead",
          attempts,
          nextRetryAt: shouldRetry ? nextRetryDate(attempts) : new Date(),
          lastError
        }
      });

      const fallback = queueItem.fallbackChannel as NotificationChannel | null;
      if (!shouldRetry && fallback && fallback !== queueItem.channel) {
        await notificationService.enqueueDelivery({
          tenantId: queueItem.tenantId,
          userId: queueItem.userId,
          eventKey: queueItem.eventKey,
          channel: fallback,
          payload,
          notificationId: queueItem.notificationId || undefined,
          maxAttempts: FALLBACK_RETRY_ATTEMPTS
        });
      }

      return { status: shouldRetry ? ("retry" as const) : ("dead" as const), error: lastError };
    }
  },

  processQueueBatch: async (limit = 100) => {
    const dueItems = await prisma.notificationQueueItem.findMany({
      where: {
        status: { in: ["pending", "retry"] },
        nextRetryAt: { lte: new Date() }
      },
      orderBy: [{ nextRetryAt: "asc" }, { createdAt: "asc" }],
      take: limit
    });

    let sent = 0;
    let retried = 0;
    let dead = 0;

    for (const item of dueItems) {
      const lock = await prisma.notificationQueueItem.updateMany({
        where: { id: item.id, status: { in: ["pending", "retry"] } },
        data: { status: "processing" }
      });
      if (lock.count === 0) continue;

      const result = await notificationService.dispatchQueueItem(item.id);
      if (result.status === "sent") sent += 1;
      if (result.status === "retry") retried += 1;
      if (result.status === "dead") dead += 1;
    }

    return { processed: dueItems.length, sent, retried, dead };
  },

  listQueue: async (tenantId: string, status?: string, limit = 100) => {
    return prisma.notificationQueueItem.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {})
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200)
    });
  },

  getUserSettings: async (tenantId: string, userId: string) => {
    const settings = await prisma.notificationUserSetting.findMany({
      where: { tenantId, userId },
      orderBy: { eventKey: "asc" }
    });
    if (settings.length > 0) return settings;

    const defaults = [
      {
        tenantId,
        userId,
        eventKey: "default",
        channels: ["in_app", "push"] as NotificationChannel[],
        fallbackChannel: "sms" as NotificationChannel
      },
      {
        tenantId,
        userId,
        eventKey: "notification.system",
        channels: ["in_app"] as NotificationChannel[],
        fallbackChannel: null
      }
    ];

    await prisma.notificationUserSetting.createMany({
      data: defaults.map((d) => ({
        tenantId: d.tenantId,
        userId: d.userId,
        eventKey: d.eventKey,
        channels: d.channels as unknown as Prisma.InputJsonValue,
        fallbackChannel: d.fallbackChannel
      })),
      skipDuplicates: true
    });

    return prisma.notificationUserSetting.findMany({
      where: { tenantId, userId },
      orderBy: { eventKey: "asc" }
    });
  },

  upsertUserSetting: async (
    tenantId: string,
    userId: string,
    payload: {
      eventKey: string;
      channels: NotificationChannel[];
      fallbackChannel?: NotificationChannel | null;
      isEnabled?: boolean;
      mutedUntil?: Date | null;
    }
  ) => {
    const channels = normalizeChannels(payload.channels);
    if (channels.length === 0) throw new Error("At least one channel must be provided");

    return prisma.notificationUserSetting.upsert({
      where: {
        tenantId_userId_eventKey: {
          tenantId,
          userId,
          eventKey: payload.eventKey
        }
      },
      update: {
        channels: channels as unknown as Prisma.InputJsonValue,
        fallbackChannel: payload.fallbackChannel || null,
        isEnabled: payload.isEnabled ?? true,
        mutedUntil: payload.mutedUntil || null
      },
      create: {
        tenantId,
        userId,
        eventKey: payload.eventKey,
        channels: channels as unknown as Prisma.InputJsonValue,
        fallbackChannel: payload.fallbackChannel || null,
        isEnabled: payload.isEnabled ?? true,
        mutedUntil: payload.mutedUntil || null
      }
    });
  },

  removeSubscription: async (tenantId: string, userId: string, endpoint: string) => {
    await pushService.unsubscribe(tenantId, userId, endpoint);
    return { success: true };
  },

  getSubscriptionState: async (tenantId: string, userId: string) => {
    const active = await pushService.hasActiveSubscription(tenantId, userId);
    return { isSubscribed: active };
  },

  // --- Existing Robust Methods ---

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
      ...(params.unreadOnly ? { isRead: false } : {})
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
        totalPages: Math.ceil(total / limit)
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
            { firstName: { in: names, mode: "insensitive" } },
            { lastName: { in: names, mode: "insensitive" } }
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
        eventKey: "notification.mention",
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
    });

    if (users.length === 0) return;

    return notificationService.sendMany(
      users.map(u => u.id),
      {
        tenantId,
        type: "system",
        eventKey: "notification.system",
        title: "إعلان إداري",
        message: message,
        senderId,
        metadata: { isAnnouncement: true }
      }
    );
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
    return { id: "legacy-stub-id", tenantId, code: eventKey, payload };
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
    console.warn(`[Deprecated] queueDelivery called for event ${eventId}. Skipped.`, { tenantId, channel, scheduledAt });
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
    const normalizedMessage = sender?.name ? `رسالة من ${sender.name}: ${message}` : `رسالة الإدارة: ${message}`;
    let users: { id: string }[] = [];

    if (target.type === "user" && typeof target.value === "string") {
      users = [{ id: target.value }];
    } else if (target.type === "users" && Array.isArray(target.value)) {
      users = target.value.map(id => ({ id }));
    } else if (target.type === "all") {
      users = await prisma.user.findMany({ where: { tenantId, deletedAt: null, status: "active" }, select: { id: true } });
    } else if (target.type === "role" && typeof target.value === "string") {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.value);
      users = await prisma.user.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: "active",
          roleLinks: { some: isUuid ? { roleId: target.value } : { role: { name: target.value } } }
        },
        select: { id: true }
      });
    } else if (target.type === "team" && typeof target.value === "string") {
      const members = await prisma.teamMember.findMany({
        where: { tenantId, teamId: target.value, leftAt: null, deletedAt: null },
        select: { userId: true }
      });
      const team = await prisma.team.findFirst({ where: { tenantId, id: target.value } });
      const userIds = Array.from(new Set([...(team?.leaderUserId ? [team.leaderUserId] : []), ...members.map((row) => row.userId)]));
      users = userIds.map(id => ({ id }));
    }

    const requestedChannels = normalizeChannels(channels);
    if (users.length > 0) {
      await notificationService.sendMany(
        users.map(u => u.id),
        {
          tenantId,
          type: "info",
          eventKey: "notification.broadcast",
          title: "إشعار إداري",
          message: normalizedMessage,
          senderId: sender?.id,
          channels: requestedChannels.length > 0 ? requestedChannels : ["in_app", "push"],
          fallbackChannel: "sms",
          metadata: { isBroadcast: true }
        }
      );
    }
  }
}
