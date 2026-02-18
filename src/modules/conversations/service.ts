import { prisma } from "../../prisma/client"
import { UserPayload } from "../../utils/auth"

export const conversationService = {
  ensureOwnerGroup: async (tenantId: string) => {
    let convo = await prisma.conversation.findFirst({
      where: { tenantId, type: "owner_group", deletedAt: null }
    })
    if (!convo) {
      convo = await prisma.conversation.create({
        data: { tenantId, type: "owner_group" }
      })
    }
    const ownerRole = await prisma.role.findFirst({ where: { tenantId, name: "owner", deletedAt: null } })
    const teamLeaderRole = await prisma.role.findFirst({ where: { tenantId, name: "team_leader", deletedAt: null } })
    const roleIds = [ownerRole?.id, teamLeaderRole?.id].filter(Boolean) as string[]
    if (roleIds.length) {
      const users = await prisma.userRole.findMany({
        where: { tenantId, roleId: { in: roleIds }, revokedAt: null },
        select: { userId: true }
      })
      const userIds = Array.from(new Set(users.map((row) => row.userId)))
      const existing = await prisma.conversationParticipant.findMany({
        where: { tenantId, conversationId: convo.id },
        select: { userId: true }
      })
      const existingSet = new Set(existing.map((row) => row.userId))
      const toAdd = userIds.filter((userId) => !existingSet.has(userId))
      if (toAdd.length) {
        await prisma.conversationParticipant.createMany({
          data: toAdd.map((userId) => ({ tenantId, conversationId: convo.id, userId, role: "member" }))
        })
      }
      const toRemove = existing.filter((row) => !userIds.includes(row.userId))
      if (toRemove.length) {
        await prisma.conversationParticipant.deleteMany({
          where: { tenantId, conversationId: convo.id, userId: { in: toRemove.map((row) => row.userId) } }
        })
      }
    }
    return convo
  },
  ensureTeamGroup: async (tenantId: string, teamId: string) => {
    let convo = await prisma.conversation.findFirst({
      where: { tenantId, type: "team_group", entityType: "team", entityId: teamId, deletedAt: null }
    })
    if (!convo) {
      convo = await prisma.conversation.create({
        data: { tenantId, type: "team_group", entityType: "team", entityId: teamId }
      })
    }
    const members = await prisma.teamMember.findMany({
      where: { tenantId, teamId, leftAt: null, deletedAt: null },
      select: { userId: true }
    })
    const team = await prisma.team.findFirst({ where: { tenantId, id: teamId, deletedAt: null } })
    const ownerRole = await prisma.role.findFirst({ where: { tenantId, name: "owner", deletedAt: null } })
    const ownerUsers = ownerRole
      ? await prisma.userRole.findMany({ where: { tenantId, roleId: ownerRole.id, revokedAt: null }, select: { userId: true } })
      : []
    const userIds = Array.from(
      new Set([...(team?.leaderUserId ? [team.leaderUserId] : []), ...members.map((row) => row.userId), ...ownerUsers.map((row) => row.userId)])
    )
    const existing = await prisma.conversationParticipant.findMany({
      where: { tenantId, conversationId: convo.id },
      select: { userId: true }
    })
    const existingSet = new Set(existing.map((row) => row.userId))
    const toAdd = userIds.filter((userId) => !existingSet.has(userId))
    if (toAdd.length) {
      await prisma.conversationParticipant.createMany({
        data: toAdd.map((userId) => ({ tenantId, conversationId: convo.id, userId, role: "member" }))
      })
    }
    const toRemove = existing.filter((row) => !userIds.includes(row.userId))
    if (toRemove.length) {
      await prisma.conversationParticipant.deleteMany({
        where: { tenantId, conversationId: convo.id, userId: { in: toRemove.map((row) => row.userId) } }
      })
    }
    return convo
  },
  ensureDirect: async (tenantId: string, userId: string, targetUserId: string) => {
    const convo = await prisma.conversation.findFirst({
      where: {
        tenantId,
        type: "direct",
        deletedAt: null,
        participants: { some: { userId } },
        AND: { participants: { some: { userId: targetUserId } } }
      }
    })
    if (convo) return convo
    const created = await prisma.conversation.create({
      data: {
        tenantId,
        type: "direct",
        participants: {
          createMany: {
            data: [
              { tenantId, userId, role: "member" },
              { tenantId, userId: targetUserId, role: "member" }
            ]
          }
        }
      }
    })
    return created
  },
  listConversationsForUser: async (tenantId: string, user: UserPayload) => {
    if (user.roles.includes("owner")) {
      return prisma.conversation.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          participants: { include: { user: { include: { profile: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 }
        },
        orderBy: { updatedAt: "desc" }
      })
    }
    return prisma.conversation.findMany({
      where: {
        tenantId,
        deletedAt: null,
        participants: { some: { userId: user.id } }
      },
      include: {
        participants: { include: { user: { include: { profile: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: { updatedAt: "desc" }
    })
  },
  listMessages: async (tenantId: string, conversationId: string, user: UserPayload, limit = 50) => {
    const canAccess = await prisma.conversationParticipant.findFirst({
      where: { tenantId, conversationId, userId: user.id }
    })
    if (!canAccess && !user.roles.includes("owner")) throw { status: 403, message: "غير مصرح" }
    return prisma.message.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { sender: { include: { profile: true } } }
    })
  },
  sendMessage: async (tenantId: string, conversationId: string, user: UserPayload, payload: { content?: string; contentType?: string; mediaFileId?: string }) => {
    const canAccess = await prisma.conversationParticipant.findFirst({
      where: { tenantId, conversationId, userId: user.id }
    })
    if (!canAccess && !user.roles.includes("owner")) throw { status: 403, message: "غير مصرح" }
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const deleted = await prisma.message.deleteMany({
      where: { tenantId, conversationId, createdAt: { lt: cutoff } }
    })
    if (deleted.count > 0) {
      await prisma.message.create({
        data: { tenantId, conversationId, senderId: user.id, content: "تم حذف الرسائل الأقدم من 7 أيام", contentType: "system" }
      })
    }
    const message = await prisma.message.create({
      data: {
        tenantId,
        conversationId,
        senderId: user.id,
        content: payload.content,
        contentType: payload.contentType || "text",
        mediaFileId: payload.mediaFileId || undefined
      }
    })
    await prisma.conversation.update({ where: { id: conversationId, tenantId }, data: { updatedAt: new Date() } })
    return message
  }
}
