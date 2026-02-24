import { prisma } from "../../prisma/client"
import { UserPayload } from "../../utils/auth"
import { getIO } from "../../socket"
import { notificationService } from "../notifications/service"

export const conversationService = {
  ensureOwnerGroup: async (tenantId: string) => {
    // Group for Owner + All Team Leaders
    let convo = await prisma.conversation.findFirst({
      where: { tenantId, type: "system_leaders", deletedAt: null }
    })

    if (!convo) {
      convo = await prisma.conversation.create({
        data: { 
          tenantId, 
          type: "system_leaders",
          title: "مجموعة القادة",
          metadata: { isSystem: true, subType: "leaders" }
        }
      })
    }

    // Get Owner
    const ownerRole = await prisma.role.findFirst({ where: { tenantId, name: "owner", deletedAt: null } })
    const teamLeaderRole = await prisma.role.findFirst({ where: { tenantId, name: "team_leader", deletedAt: null } })
    
    const ownerUsers = ownerRole 
      ? await prisma.userRole.findMany({ where: { tenantId, roleId: ownerRole.id, revokedAt: null }, select: { userId: true } })
      : []
    const leaderUsers = teamLeaderRole 
      ? await prisma.userRole.findMany({ where: { tenantId, roleId: teamLeaderRole.id, revokedAt: null }, select: { userId: true } })
      : []

    const ownerUserIds = new Set(ownerUsers.map(u => u.userId))
    const allUserIds = Array.from(new Set([...ownerUsers.map(u => u.userId), ...leaderUsers.map(u => u.userId)]))

      // Sync participants
      const existing = await prisma.conversationParticipant.findMany({
        where: { tenantId, conversationId: convo.id },
        select: { userId: true }
      })

      const existingSet = new Set(existing.map((row) => row.userId))
      const toAdd = allUserIds.filter((userId) => !existingSet.has(userId))

      if (toAdd.length) {
      await prisma.conversationParticipant.createMany({
        data: toAdd.map((userId) => ({ 
            tenantId, 
            conversationId: convo.id, 
            userId, 
            role: ownerUserIds.has(userId) ? "admin" : "member" 
        }))
      })

      // Notify new members
      await notificationService.sendMany(toAdd, {
        tenantId,
        type: "info",
        title: "تمت إضافتك إلى مجموعة القادة",
        message: "تمت إضافتك إلى مجموعة القادة في النظام.",
        entityType: "conversation",
        entityId: convo.id,
        actionUrl: `/conversations/${convo.id}`,
        senderId: undefined // System notification
      }).catch(console.error)

      // Emit socket event for real-time list update
      toAdd.forEach(userId => {
          getIO().to(`user:${userId}`).emit("conversation:added", convo)
      })
    }

      // Remove users who are no longer owner/team_leader
      const toRemove = existing.filter((row) => !allUserIds.includes(row.userId))
      if (toRemove.length) {
        await prisma.conversationParticipant.deleteMany({
          where: { tenantId, conversationId: convo.id, userId: { in: toRemove.map((row) => row.userId) } }
        })
      }
    return convo
  },

  editMessage: async (tenantId: string, messageId: string, userId: string, content: string) => {
    const message = await prisma.message.findFirst({
      where: { id: messageId, tenantId, senderId: userId, deletedAt: null }
    })

    if (!message) throw { status: 404, message: "الرسالة غير موجودة أو غير مصرح لك بتعديلها" }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        editedAt: new Date()
      }
    })

    getIO().to(`conversation:${message.conversationId}`).emit("message:updated", updated)

    return updated
  },

  deleteMessage: async (tenantId: string, messageId: string, userId: string) => {
    const message = await prisma.message.findFirst({
      where: { id: messageId, tenantId, deletedAt: null }
    })

    if (!message) throw { status: 404, message: "الرسالة غير موجودة" }

    if (message.senderId !== userId) {
        throw { status: 403, message: "غير مصرح لك بحذف الرسالة" }
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: "تم حذف هذه الرسالة"
      }
    })

    getIO().to(`conversation:${message.conversationId}`).emit("message:deleted", { id: messageId, conversationId: message.conversationId, deletedAt: updated.deletedAt })

    return updated
  },

  ensureTeamGroup: async (tenantId: string, teamId: string) => {
    // Group for Team: Owner + Leader + Members
    let convo = await prisma.conversation.findFirst({
      where: { tenantId, type: "system_team", entityType: "team", entityId: teamId, deletedAt: null }
    })

    const team = await prisma.team.findFirst({ where: { tenantId, id: teamId, deletedAt: null } })
    if (!team) throw new Error("Team not found")

    if (!convo) {
      convo = await prisma.conversation.create({
        data: { 
          tenantId, 
          type: "system_team", 
          entityType: "team", 
          entityId: teamId,
          title: `فريق ${team.name}`,
          metadata: { isSystem: true, subType: "team", teamId }
        }
      })
    } else {
      // Update title if team name changed
      if (convo.title !== `فريق ${team.name}`) {
        await prisma.conversation.update({
          where: { id: convo.id },
          data: { title: `فريق ${team.name}` }
        })
      }
    }

    // Get Members
    const members = await prisma.teamMember.findMany({
      where: { tenantId, teamId, leftAt: null, deletedAt: null },
      select: { userId: true }
    })

    // Get Owner(s)
    const ownerRole = await prisma.role.findFirst({ where: { tenantId, name: "owner", deletedAt: null } })
    const ownerUsers = ownerRole
      ? await prisma.userRole.findMany({ where: { tenantId, roleId: ownerRole.id, revokedAt: null }, select: { userId: true } })
      : []

    const ownerUserIds = new Set(ownerUsers.map(u => u.userId))
    
    const userIds = Array.from(
      new Set([
        ...(team.leaderUserId ? [team.leaderUserId] : []), 
        ...members.map((row) => row.userId), 
        ...ownerUsers.map((row) => row.userId)
      ])
    )

    // Sync participants
    const existing = await prisma.conversationParticipant.findMany({
      where: { tenantId, conversationId: convo.id },
      select: { userId: true }
    })

    const existingSet = new Set(existing.map((row) => row.userId))
    const toAdd = userIds.filter((userId) => !existingSet.has(userId))

    if (toAdd.length) {
      await prisma.conversationParticipant.createMany({
        data: toAdd.map((userId) => ({ 
            tenantId, 
            conversationId: convo.id, 
            userId, 
            role: (userId === team.leaderUserId || ownerUserIds.has(userId)) ? "admin" : "member" 
        }))
      })

      // Notify new members
      await notificationService.sendMany(toAdd, {
        tenantId,
        type: "info",
        title: "تمت إضافتك إلى مجموعة الفريق",
        message: "تمت إضافتك إلى مجموعة الفريق في النظام.",
        entityType: "conversation",
        entityId: convo.id,
        actionUrl: `/conversations/${convo.id}`,
        senderId: undefined // System notification
      }).catch(console.error)

      // Emit socket event
      toAdd.forEach(userId => {
          getIO().to(`user:${userId}`).emit("conversation:added", convo)
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
    // Check if direct conversation exists
    // We need to find a conversation where BOTH are participants and type is 'direct'
    // Prisma doesn't have a simple "has all of these" for related fields in many-to-many easily without raw query or complex ANDs
    // But we can filter by type=direct and verify participants.
    
    // Optimization: Find convos for user1, then filter for user2
    const user1Convos = await prisma.conversationParticipant.findMany({
      where: { tenantId, userId, conversation: { type: "direct", deletedAt: null } },
      select: { conversationId: true }
    })
    
    const user1ConvoIds = user1Convos.map(c => c.conversationId)
    
    if (user1ConvoIds.length > 0) {
      const match = await prisma.conversationParticipant.findFirst({
        where: { 
          tenantId, 
          conversationId: { in: user1ConvoIds }, 
          userId: targetUserId 
        },
        select: { conversationId: true }
      })
      
      if (match) {
        const existing = await prisma.conversation.findUnique({ where: { id: match.conversationId } })
        if (existing) return existing
      }
    }

    // Create new
    const newConvo = await prisma.conversation.create({
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

    // Emit socket event
    getIO().to(`user:${userId}`).emit("conversation:added", newConvo)
    getIO().to(`user:${targetUserId}`).emit("conversation:added", newConvo)

    return newConvo
  },

  createCustomGroup: async (tenantId: string, user: UserPayload, title: string, participantIds: string[]) => {
    // 1. Validate Permissions
    if (!user.roles.includes("owner") && !user.roles.includes("team_leader")) {
      throw { status: 403, message: "غير مصرح لك بإنشاء مجموعات" }
    }

    // 2. Validate Participants based on Role
    let validParticipantIds = new Set<string>()
    validParticipantIds.add(user.id) // Creator is always a member

    if (user.roles.includes("owner")) {
      // Owner can add anyone
      // Verify users exist in tenant
      const users = await prisma.user.findMany({
        where: { tenantId, id: { in: participantIds }, deletedAt: null },
        select: { id: true }
      })
      users.forEach(u => validParticipantIds.add(u.id))
    } else if (user.roles.includes("team_leader")) {
      // Team Leader can only add:
      // - Themselves (already added)
      // - Their Team Members
      // - The Owner (maybe? User said "Owner is member of the team and can see everything", but for custom groups created by Leader, usually it's for sub-tasks. User said "Leader can create group... add people from his team members only".
      // Let's stick to "Team Members".
      
      const myTeams = await prisma.team.findMany({
        where: { tenantId, leaderUserId: user.id, deletedAt: null },
        select: { id: true }
      })
      
      const teamIds = myTeams.map(t => t.id)
      
      const teamMembers = await prisma.teamMember.findMany({
        where: { tenantId, teamId: { in: teamIds }, leftAt: null, deletedAt: null },
        select: { userId: true }
      })
      
      const allowedIds = new Set(teamMembers.map(m => m.userId))
      allowedIds.add(user.id)

      // Allow adding Owner too? User said "Owner is in the team group". For custom groups, maybe not mandatory, but if Leader wants to add Owner, they should be able to?
      // User said: "Team Leader can create group also like that but add people from his team members only". "Only" implies restriction.
      // I will restrict to team members + self.
      
      participantIds.forEach(id => {
        if (allowedIds.has(id)) {
          validParticipantIds.add(id)
        }
      })
    }

    const finalParticipants = Array.from(validParticipantIds)

    if (finalParticipants.length < 2) {
      throw { status: 400, message: "يجب اختيار عضو واحد على الأقل" }
    }

    // 3. Create Conversation
    const convo = await prisma.conversation.create({
      data: {
        tenantId,
        type: "group", // Custom group
        title,
        participants: {
          createMany: {
            data: finalParticipants.map(uid => ({
              tenantId,
              userId: uid,
              role: uid === user.id ? "admin" : "member"
            }))
          }
        }
      }
    })

    // Notify invited members
     const invitees = finalParticipants.filter(uid => uid !== user.id)
     if (invitees.length > 0) {
         const creator = await prisma.user.findUnique({ where: { id: user.id }, include: { profile: true } })
         const creatorName = creator?.profile?.firstName || creator?.email.split('@')[0] || "مستخدم"
         
         await notificationService.sendMany(invitees, {
             tenantId,
             type: "info",
             title: "تمت إضافتك إلى مجموعة جديدة",
             message: `قام ${creatorName} بإضافتك إلى المجموعة "${title}"`,
             entityType: "conversation",
             entityId: convo.id,
             actionUrl: `/conversations/${convo.id}`,
             senderId: user.id
         }).catch(console.error)
     }

    // Emit socket event
    finalParticipants.forEach(uid => {
        getIO().to(`user:${uid}`).emit("conversation:added", convo)
    })

    return convo
  },

  listConversationsForUser: async (tenantId: string, user: UserPayload) => {
    // Sync system groups first (lazy sync)
    // In production, this should be done via events/jobs, but for now we do it here for safety
    if (user.roles.includes("team_leader") || user.roles.includes("owner")) {
      await conversationService.ensureOwnerGroup(tenantId)
    }
    // If user is part of a team, ensure team group
    // This is expensive to do on every list, better to rely on triggers. 
    // Skipping auto-sync here for performance, assuming it's done elsewhere or periodically.
    
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        deletedAt: null,
        participants: { some: { userId: user.id } }
      },
      include: {
        participants: { 
          include: { 
            user: { 
              select: { id: true, email: true, isOnline: true, lastSeen: true, profile: true } 
            } 
          } 
        },
        messages: { 
          orderBy: { createdAt: "desc" }, 
          take: 1 
        }
      },
      orderBy: { updatedAt: "desc" }
    })

    // Map to include unread status
    const result = await Promise.all(conversations.map(async c => {
      const myParticipant = c.participants.find(p => p.userId === user.id)
      const lastReadAt = myParticipant?.lastReadAt || new Date(0) // Default to epoch if never read

      const unreadCount = await prisma.message.count({
        where: {
          tenantId,
          conversationId: c.id,
          createdAt: { gt: lastReadAt },
          senderId: { not: user.id }
        }
      })

      const lastMessage = c.messages[0]
      
      return {
        ...c,
        unreadCount,
        hasUnread: unreadCount > 0,
        lastMessage: lastMessage
      }
    }))

    return result
  },

  listMessages: async (tenantId: string, conversationId: string, user: UserPayload, limit = 50) => {
    const participant = await prisma.conversationParticipant.findFirst({
      where: { tenantId, conversationId, userId: user.id }
    })

    if (!participant && !user.roles.includes("owner")) throw { status: 403, message: "غير مصرح" }

    // Mark as read when listing (viewing)
    if (participant) {
      await prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: { lastReadAt: new Date() }
      })
    }

    return prisma.message.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: "desc" }, // Frontend should reverse
      take: limit,
      include: { 
        sender: { include: { profile: true } },
        replyTo: { include: { sender: { include: { profile: true } } } }
      }
    })
  },

  markAsRead: async (tenantId: string, conversationId: string, userId: string) => {
    const participant = await prisma.conversationParticipant.findFirst({
      where: { tenantId, conversationId, userId }
    })
    if (participant) {
      const now = new Date()
      await prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: { lastReadAt: now }
      })
      
      // Emit read event
      try {
        const io = getIO()
        io.to(`conversation:${conversationId}`).emit('conversation:read', { 
            conversationId, 
            userId, 
            lastReadAt: now 
        })
      } catch (e) {
        // Socket might not be initialized in some contexts (e.g. tests), ignore
      }
    }
  },

  sendMessage: async (tenantId: string, conversationId: string, user: UserPayload, payload: { content?: string; contentType?: string; mediaFileId?: string; mediaDuration?: number; replyToId?: string }) => {
    const canAccess = await prisma.conversationParticipant.findFirst({
      where: { tenantId, conversationId, userId: user.id }
    })

    if (!canAccess && !user.roles.includes("owner")) throw { status: 403, message: "غير مصرح" }

    const message = await prisma.message.create({
      data: {
        tenantId,
        conversationId,
        senderId: user.id,
        content: payload.content,
        contentType: payload.contentType || "text",
        fileId: payload.mediaFileId || undefined,
        metadata: payload.mediaDuration ? { duration: payload.mediaDuration } : undefined,
        replyToId: payload.replyToId || undefined
      },
      include: { 
        sender: { include: { profile: true } },
        replyTo: { include: { sender: { include: { profile: true } } } }
      }
    })

    // Update conversation timestamp
    await prisma.conversation.update({ 
      where: { id: conversationId, tenantId }, 
      data: { updatedAt: new Date() } 
    })
    
    // Emit with full data
    getIO().to(`conversation:${conversationId}`).emit("message:new", message)

    // Notify other participants
    const convo = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { participants: true } })
    if (convo) {
      const sender = await prisma.user.findUnique({ where: { id: user.id }, include: { profile: true } })
      const senderName = sender?.profile?.firstName || sender?.email.split('@')[0] || "مستخدم"
      const text = payload.content || (payload.mediaFileId ? 'ملف مرفق' : 'رسالة جديدة')

      // 1. Notify mentions first
      let mentionedUserIds: string[] = []
      if (payload.content) {
         mentionedUserIds = await notificationService.notifyMentions(
            tenantId,
            payload.content,
            { id: user.id, name: senderName },
            'conversation',
            conversationId,
            `/conversations/${conversationId}`
         ).catch(err => {
             console.error("Failed to notify mentions", err)
             return []
         })
      }

      // 2. Notify others (excluding sender and mentioned users)
      const recipientIds = convo.participants
        .filter(p => p.userId !== user.id && !mentionedUserIds.includes(p.userId))
        .map(p => p.userId)
      
      const preview = text.length > 50 ? text.substring(0, 50) + '...' : text

      // Check for Reply
      if (payload.replyToId) {
          const originalMessage = await prisma.message.findUnique({
              where: { id: payload.replyToId },
              select: { senderId: true }
          })
          
          if (originalMessage && originalMessage.senderId !== user.id && !mentionedUserIds.includes(originalMessage.senderId)) {
              // Notify original sender specifically about the reply
              await notificationService.send({
                  tenantId,
                  userId: originalMessage.senderId,
                  type: "info",
                  title: `رد جديد من ${senderName}`,
                  message: `${senderName} رد على رسالتك: ${preview}`,
                  entityType: "conversation",
                  entityId: conversationId,
                  actionUrl: `/conversations/${conversationId}`,
                  senderId: user.id
              }).catch(console.error)
              
              // Remove from general recipients to avoid double notification
              const index = recipientIds.indexOf(originalMessage.senderId)
              if (index > -1) {
                  recipientIds.splice(index, 1)
              }
          }
      }

      const isPoke = payload.contentType === 'poke'
      const notifTitle = isPoke ? `تنبيه من ${senderName} 👋` : (convo.type === 'direct' ? `رسالة من ${senderName}` : `رسالة في ${convo.title || 'المجموعة'}`)
      const notifMessage = isPoke ? `${senderName} قام بإرسال تنبيه إليك!` : `${senderName}: ${preview}`
      const notifType = isPoke ? 'poke' : 'info'

      if (recipientIds.length > 0) {
        await notificationService.sendMany(recipientIds, {
          tenantId,
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          senderId: user.id,
          entityType: 'conversation',
          entityId: conversationId,
          actionUrl: `/conversations/${conversationId}`
        }).catch(err => console.error("Failed to send chat notification", err))
      }
    }

    // Mark sender as read immediately
    if (canAccess) {
       await prisma.conversationParticipant.update({
        where: { id: canAccess.id },
        data: { lastReadAt: new Date() }
      })
    }

    return message
  },

  addParticipant: async (tenantId: string, conversationId: string, user: UserPayload, targetUserId: string) => {
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId, tenantId },
      include: { participants: true }
    })
    if (!convo) throw { status: 404, message: "المجموعة غير موجودة" }
    if (convo.type !== "group") throw { status: 400, message: "لا يمكن إضافة أعضاء لهذه المحادثة" }

    const requester = convo.participants.find(p => p.userId === user.id)
    if (!requester && !user.roles.includes("owner")) throw { status: 403, message: "غير مصرح" }
    
    // Check admin rights
    if (requester?.role !== "admin" && !user.roles.includes("owner")) {
       throw { status: 403, message: "يجب أن تكون مشرفاً لإضافة أعضاء" }
    }

    // Check if already member
    if (convo.participants.some(p => p.userId === targetUserId)) {
        throw { status: 400, message: "المستخدم عضو بالفعل" }
    }

    // Validate target user eligibility (for Team Leader)
    if (user.roles.includes("team_leader") && !user.roles.includes("owner")) {
        // Check if target is in leader's team
        const myTeams = await prisma.team.findMany({ where: { tenantId, leaderUserId: user.id, deletedAt: null }, select: { id: true } })
        const teamIds = myTeams.map(t => t.id)
        const isMember = await prisma.teamMember.findFirst({
            where: { tenantId, teamId: { in: teamIds }, userId: targetUserId, leftAt: null, deletedAt: null }
        })
        if (!isMember) {
             throw { status: 403, message: "يمكنك إضافة أعضاء فريقك فقط" }
        }
    }

    const newParticipant = await prisma.conversationParticipant.create({
        data: {
            tenantId,
            conversationId,
            userId: targetUserId,
            role: "member"
        }
    })

    // Notify the added user
    const addedUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true, profile: { select: { firstName: true, lastName: true } } } })
    const actor = await prisma.user.findUnique({ where: { id: user.id }, include: { profile: true } })
    const actorName = actor?.profile?.firstName || actor?.email.split('@')[0] || "مستخدم"
    
    const conversationTitle = convo.title || "المجموعة"

    await notificationService.send({
        tenantId,
        userId: targetUserId,
        type: "info",
        title: "تمت إضافتك إلى محادثة",
        message: `قام ${actorName} بإضافتك إلى ${conversationTitle}`,
        entityType: "conversation",
        entityId: conversationId,
        actionUrl: `/conversations/${conversationId}`,
        senderId: user.id
    }).catch(console.error)

    // Notify other participants (optional, maybe just a system message in chat?)
    // For now, let's insert a system message into the chat
    const sysMsg = await prisma.message.create({
        data: {
            tenantId,
            conversationId,
            senderId: user.id, // Or maybe a system user? But we need a senderId. Let's use the actor.
            content: `قام ${actorName} بإضافة ${addedUser?.profile?.firstName || addedUser?.email || "عضو"}`,
            contentType: "system",
        },
        include: { sender: { include: { profile: true } } }
    }).catch(console.error)

    if (sysMsg) {
        getIO().to(`conversation:${conversationId}`).emit("message:new", sysMsg)
    }

    // Emit socket event to the added user
    getIO().to(`user:${targetUserId}`).emit("conversation:added", convo)

    // Emit event to existing participants to update their member list
    getIO().to(`conversation:${conversationId}`).emit("participant:added", {
        conversationId,
        participant: {
            ...newParticipant,
            user: addedUser
        }
    })

    return newParticipant
  },

  removeParticipant: async (tenantId: string, conversationId: string, user: UserPayload, targetUserId: string) => {
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId, tenantId },
      include: { participants: true }
    })
    if (!convo) throw { status: 404, message: "المجموعة غير موجودة" }
    if (convo.type !== "group") throw { status: 400, message: "لا يمكن حذف أعضاء من هذه المحادثة" }

    const requester = convo.participants.find(p => p.userId === user.id)
    
    // Allow leaving
    if (user.id !== targetUserId) {
        // Kick
        if (!requester && !user.roles.includes("owner")) throw { status: 403, message: "غير مصرح" }
        if (requester?.role !== "admin" && !user.roles.includes("owner")) {
             throw { status: 403, message: "يجب أن تكون مشرفاً لحذف أعضاء" }
        }
    }
    
    const participant = convo.participants.find(p => p.userId === targetUserId)
    if (!participant) throw { status: 404, message: "العضو غير موجود" }

    await prisma.conversationParticipant.delete({
        where: { id: participant.id }
    })

    // Notify the removed user (if kicked)
    if (user.id !== targetUserId) {
        const actor = await prisma.user.findUnique({ where: { id: user.id }, include: { profile: true } })
        const actorName = actor?.profile?.firstName || actor?.email.split('@')[0] || "مستخدم"
        
        const conversationTitle = convo.title || "المجموعة"

        await notificationService.send({
            tenantId,
            userId: targetUserId,
            type: "warning",
            title: "تمت إزالتك من المحادثة",
            message: `قام ${actorName} بإزالتك من ${conversationTitle}`,
            entityType: "conversation",
            entityId: conversationId,
            actionUrl: `/conversations/${conversationId}`,
            senderId: user.id
        }).catch(console.error)
    }

    // System message
    const removedUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true, profile: { select: { firstName: true } } } })
    const actor = await prisma.user.findUnique({ where: { id: user.id }, include: { profile: true } })
    const actorName = actor?.profile?.firstName || actor?.email.split('@')[0] || "مستخدم"
    const msgContent = user.id === targetUserId 
        ? `غادر ${removedUser?.profile?.firstName || removedUser?.email} المحادثة`
        : `قام ${actorName} بإزالة ${removedUser?.profile?.firstName || removedUser?.email}`

    const sysMsg = await prisma.message.create({
        data: {
            tenantId,
            conversationId,
            senderId: user.id,
            content: msgContent,
            contentType: "system",
        },
        include: { sender: { include: { profile: true } } }
    }).catch(console.error)

    if (sysMsg) {
        getIO().to(`conversation:${conversationId}`).emit("message:new", sysMsg)
    }

    // Emit socket event to the removed user
    getIO().to(`user:${targetUserId}`).emit("conversation:removed", { conversationId })

    // Emit event to remaining participants
    getIO().to(`conversation:${conversationId}`).emit("participant:removed", {
        conversationId,
        userId: targetUserId
    })
  },

  pokeUser: async (tenantId: string, targetUserId: string, user: UserPayload) => {
    // Check if direct conversation exists or create one
    const convo = await conversationService.ensureDirect(tenantId, user.id, targetUserId)
    
    // Send Notification
    const poker = await prisma.user.findUnique({ where: { id: user.id }, include: { profile: true } })
    const pokerName = poker?.profile?.firstName || poker?.email.split('@')[0] || "مستخدم"
    
    await notificationService.send({
        tenantId,
        userId: targetUserId,
        type: "info", // or a new type 'poke'
        title: "👋 تنبيه",
        message: `قام ${pokerName} بتنبيهك (Poke)`,
        entityType: "conversation",
        entityId: convo.id,
        actionUrl: `/conversations/${convo.id}`,
        senderId: user.id,
        metadata: { isPoke: true }
    })
    
    // Emit special socket event
    getIO().to(`user:${targetUserId}`).emit("user:poke", { 
        senderId: user.id, 
        senderName: pokerName, 
        conversationId: convo.id 
    })
    
    return { success: true }
  }
}
